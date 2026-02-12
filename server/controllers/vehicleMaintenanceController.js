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

            for (let i = 0; i < recipients.length; i++) {
                const person = recipients[i];
                setTimeout(async () => {
                    try {
                        await sendWhatsAppMessage(person.phone, message);
                        console.log(`Notification sent for ${log.vehicle.name} to ${person.name} (${person.phone})`);
                    } catch (e) {
                        console.error(`[Vehicle Maintenance] Failed to notify ${person.name}:`, e.message);
                    }
                }, i * 5000); // 5s gap
            }
        }
    } catch (error) {
        console.error('Failed to check maintenance notifications:', error.message);
    }
};
