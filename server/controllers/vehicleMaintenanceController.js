const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendWhatsAppMessage } = require('../services/whatsappService');

// Get all maintenance logs
exports.getAllMaintenanceLogs = async (req, res) => {
    try {
        const logs = await prisma.vehicleService.findMany({
            include: { vehicle: true },
            orderBy: { date: 'desc' }
        });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create maintenance log
exports.createMaintenanceLog = async (req, res) => {
    try {
        const {
            vehicleId, date, category, type, description, cost, odometer, nextServiceOdometer, workshop, proofFile
        } = req.body;

        // 1. Mandatory Validation
        if (!date || !vehicleId || !category || !type || !cost) {
            return res.status(400).json({ error: 'Data wajib diisi: Tanggal, Kendaraan, Jenis (Rutin/Tidak), Tipe Perbaikan, dan Biaya.' });
        }

        // 2. Conditional Validation for Routine
        if (category === 'ROUTINE') {
            if (!odometer || !nextServiceOdometer) {
                return res.status(400).json({ error: 'Untuk Pemeliharaan Rutin, KM saat ini dan KM servis berikutnya wajib diisi.' });
            }
        }

        const log = await prisma.vehicleService.create({
            data: {
                vehicleId: parseInt(vehicleId),
                date: new Date(date),
                category,
                type,
                description: description || '-',
                cost: parseFloat(cost),
                odometer: odometer ? parseInt(odometer) : null,
                nextServiceOdometer: nextServiceOdometer ? parseInt(nextServiceOdometer) : null,
                workshop,
                proofFile
            }
        });

        // 3. Update Vehicle Odometer if provided
        if (odometer) {
            await prisma.vehicle.update({
                where: { id: parseInt(vehicleId) },
                data: { odometer: parseInt(odometer) }
            });
        }

        res.status(201).json(log);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update maintenance log
exports.updateMaintenanceLog = async (req, res) => {
    try {
        const {
            date, category, type, description, cost, odometer, nextServiceOdometer, workshop, proofFile
        } = req.body;

        const log = await prisma.vehicleService.update({
            where: { id: parseInt(req.params.id) },
            data: {
                date: date ? new Date(date) : undefined,
                category,
                type,
                description,
                cost: cost ? parseFloat(cost) : undefined,
                odometer: odometer ? parseInt(odometer) : undefined,
                nextServiceOdometer: nextServiceOdometer ? parseInt(nextServiceOdometer) : undefined,
                workshop,
                proofFile
            }
        });
        res.json(log);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete maintenance log
exports.deleteMaintenanceLog = async (req, res) => {
    try {
        await prisma.vehicleService.delete({
            where: { id: parseInt(req.params.id) }
        });
        res.json({ message: 'Log pemeliharaan berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Checker for 5-month notification
 * This should ideally be run by a cron job or on server start periodically.
 */
exports.checkMaintenanceNotifications = async () => {
    try {
        console.log('Checking for vehicle maintenance notifications (5 months)...');

        // Find Routine services from exactly 5 months ago
        const fiveMonthsAgo = new Date();
        fiveMonthsAgo.setMonth(fiveMonthsAgo.getMonth() - 5);

        // Start of that day and end of that day
        const startOfDay = new Date(fiveMonthsAgo.setHours(0, 0, 0, 0));
        const endOfDay = new Date(fiveMonthsAgo.setHours(23, 59, 59, 999));

        const dueLogs = await prisma.vehicleService.findMany({
            where: {
                category: 'ROUTINE',
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            },
            include: { vehicle: true }
        });

        if (dueLogs.length === 0) return;

        // Find specific recipients: Ravi Kurnia (24071613) and Eldo (26021760) only
        const recipients = await prisma.user.findMany({
            where: {
                OR: [
                    { nip: '24071613' }, // Ravi Kurnia
                    { nip: '26021760' }  // Eldo
                ],
                phone: { not: null, not: '' }
            }
        });

        if (recipients.length === 0) {
            console.log('Ravi or Eldo not found or have no phone for notification.');
            return;
        }

        for (const log of dueLogs) {
            const message = `📢 *PENGINGAT PEMELIHARAAN KENDARAAN*\n\n` +
                `Kendaraan *${log.vehicle.name} (${log.vehicle.plateNumber})* telah melewati 5 bulan sejak servis rutin terakhir pada tanggal ${new Date(log.date).toLocaleDateString('id-ID')}.\n\n` +
                `Mohon segera agendakan pengecekan/servis berikutnya.\n` +
                `KM Terakhir: ${log.odometer?.toLocaleString()} km\n` +
                `Target Servis: ${log.nextServiceOdometer?.toLocaleString()} km`;

            let cumulativeDelay = 0;
            for (const person of recipients) {
                const randomGap = Math.floor(Math.random() * (20000 - 5000 + 1)) + 5000;
                cumulativeDelay += randomGap;

                setTimeout(async () => {
                    try {
                        await sendWhatsAppMessage(person.phone, message);
                        console.log(`Notification sent for ${log.vehicle.name} to ${person.name} (${person.phone})`);
                    } catch (e) {
                        console.error(`[Vehicle Maintenance] Failed to notify ${person.name}:`, e.message);
                    }
                }, cumulativeDelay);
            }
        }
    } catch (error) {
        console.error('Failed to check maintenance notifications:', error.message);
    }
};

/**
 * Checker for KM-based Service Notifications
 * Sends WhatsApp to Syafrian & Ravi Kurnia when a vehicle's current KM
 * is within 500 km of its next service target.
 * Re-reminds every 4 days until nextServiceOdometer is updated.
 */
exports.checkKmServiceNotifications = async () => {
    try {
        console.log('[KM Service] Checking for vehicles approaching next service KM...');

        // Get all active vehicles with their latest ROUTINE service that has a nextServiceOdometer
        const vehicles = await prisma.vehicle.findMany({
            where: { status: 'ACTIVE' },
            include: {
                services: {
                    where: { category: 'ROUTINE', nextServiceOdometer: { not: null } },
                    orderBy: { date: 'desc' },
                    take: 1
                }
            }
        });

        // Filter vehicles that are within 500 km of nextServiceOdometer
        const dueVehicles = vehicles.filter(v => {
            const latestService = v.services?.[0];
            if (!latestService?.nextServiceOdometer) return false;
            const kmRemaining = latestService.nextServiceOdometer - (v.odometer || 0);
            return kmRemaining <= 500; // Within 500 km OR past due
        });

        if (dueVehicles.length === 0) {
            console.log('[KM Service] No vehicles approaching service KM threshold.');
            return;
        }

        console.log(`[KM Service] Found ${dueVehicles.length} vehicle(s) within 500 km of next service.`);

        // Check 4-day cooldown: only notify if lastKmNotifiedAt is null or >= 4 days ago
        const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;
        const now = new Date();

        const vehiclesToNotify = dueVehicles.filter(v => {
            if (!v.lastKmNotifiedAt) return true;
            const elapsed = now.getTime() - new Date(v.lastKmNotifiedAt).getTime();
            return elapsed >= FOUR_DAYS_MS;
        });

        if (vehiclesToNotify.length === 0) {
            console.log('[KM Service] All due vehicles were notified recently (< 4 days). Skipping.');
            return;
        }

        // Find recipients: Syafrian (25041676) and Ravi Kurnia (24071613)
        const recipients = await prisma.user.findMany({
            where: {
                OR: [
                    { nip: '25041676' }, // Syafrian
                    { nip: '24071613' }  // Ravi Kurnia
                ],
                phone: { not: null, not: '' }
            }
        });

        if (recipients.length === 0) {
            console.log('[KM Service] Syafrian or Ravi Kurnia not found or have no phone number.');
            return;
        }

        let globalDelay = 0;

        for (const vehicle of vehiclesToNotify) {
            const latestService = vehicle.services[0];
            const kmRemaining = latestService.nextServiceOdometer - (vehicle.odometer || 0);
            const statusText = kmRemaining <= 0
                ? `⚠️ *SUDAH MELEWATI* target service (${Math.abs(kmRemaining).toLocaleString()} km lebih)`
                : `Sisa *${kmRemaining.toLocaleString()} km* lagi menuju service berikutnya`;

            const message = `🔧 *PENGINGAT SERVICE KENDARAAN*\n\n` +
                `Kendaraan *${vehicle.name} (${vehicle.plateNumber})*\n\n` +
                `KM Saat Ini: *${(vehicle.odometer || 0).toLocaleString()} km*\n` +
                `Target Service: *${latestService.nextServiceOdometer.toLocaleString()} km*\n\n` +
                `${statusText}\n\n` +
                `Mohon segera dijadwalkan untuk service rutin. Terima kasih.`;

            for (const person of recipients) {
                // Random delay between 30-60 seconds between each message
                const randomGap = Math.floor(Math.random() * (60000 - 30000 + 1)) + 30000;
                globalDelay += randomGap;

                setTimeout(async () => {
                    try {
                        await sendWhatsAppMessage(person.phone, message);
                        console.log(`[KM Service] Notification sent for ${vehicle.name} to ${person.name} (${person.phone})`);
                    } catch (e) {
                        console.error(`[KM Service] Failed to notify ${person.name}:`, e.message);
                    }
                }, globalDelay);
            }

            // Update lastKmNotifiedAt on the vehicle
            try {
                await prisma.vehicle.update({
                    where: { id: vehicle.id },
                    data: { lastKmNotifiedAt: now }
                });
            } catch (e) {
                console.error(`[KM Service] Failed to update lastKmNotifiedAt for ${vehicle.name}:`, e.message);
            }
        }

        console.log(`[KM Service] Scheduled ${vehiclesToNotify.length * recipients.length} notification(s) with 30-60s delays.`);
    } catch (error) {
        console.error('[KM Service] Failed to check KM notifications:', error.message);
    }
};
