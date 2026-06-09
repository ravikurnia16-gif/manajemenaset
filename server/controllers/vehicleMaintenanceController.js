const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendMessage } = require('../services/whatsappService');

// Get all maintenance logs
exports.getAllMaintenanceLogs = async (req, res) => {
    try {
        const { id: userId, role } = req.user;
        let where = {};

        // Filter by PIC if not a global admin/Sarpras staff
        const isSarpras = role === 'KEPALA_BIDANG' || req.user?.position?.includes('Sarana dan Prasarana') || req.user?.position?.includes('Manajemen Aset');

        if (!['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT'].includes(role) && !isSarpras) {
            where = {
                vehicle: {
                    pics: {
                        some: { id: userId }
                    }
                }
            };
        }

        const logs = await prisma.vehicleService.findMany({
            where,
            include: { vehicle: true },
            orderBy: { date: 'desc' }
        });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get single maintenance log
exports.getMaintenanceLogById = async (req, res) => {
    try {
        const { id: userId, role } = req.user;
        const log = await prisma.vehicleService.findUnique({
            where: { id: parseInt(req.params.id) },
            include: {
                vehicle: {
                    include: { pics: { select: { id: true } } }
                }
            }
        });

        if (!log) return res.status(404).json({ error: 'Log tidak ditemukan' });

        // Access Check
        if (!['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT'].includes(role)) {
            const isPic = log.vehicle.pics.some(p => p.id === userId);
            if (!isPic) return res.status(403).json({ error: 'Anda tidak memiliki akses ke log kendaraan ini.' });
        }

        res.json(log);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create maintenance log (supports multi-item)
exports.createMaintenanceLog = async (req, res) => {
    try {
        const { id: userId, role } = req.user;
        const {
            vehicleId, date, category, type, description, cost, odometer,
            nextServiceOdometer, nextServiceDate, workshop, proofFile, items
        } = req.body;

        // 1. Mandatory Validation
        if (!date || !vehicleId || !category || !type || !cost) {
            return res.status(400).json({ error: 'Data wajib diisi: Tanggal, Kendaraan, Jenis (Rutin/Tidak), Tipe Perbaikan, dan Biaya.' });
        }

        // 2. PIC Validation
        const isSarpras = role === 'KEPALA_BIDANG' || req.user?.position?.includes('Sarana dan Prasarana') || req.user?.position?.includes('Manajemen Aset');

        if (!['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT'].includes(role) && !isSarpras) {
            const vehicle = await prisma.vehicle.findUnique({
                where: { id: parseInt(vehicleId) },
                include: { pics: { select: { id: true } } }
            });
            const isPic = vehicle?.pics.some(p => p.id === userId);
            if (!isPic) return res.status(403).json({ error: 'Anda bukan PIC kendaraan ini.' });
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
                nextServiceDate: nextServiceDate ? new Date(nextServiceDate) : null,
                items: items || null,
                workshop,
                proofFile
            }
        });

        // 3. Update Vehicle Odometer if provided
        // NOTE: Di-comment agar tidak mempengaruhi km terakhir kendaraan
        /*
        if (odometer) {
            await prisma.vehicle.update({
                where: { id: parseInt(vehicleId) },
                data: { odometer: parseInt(odometer) }
            });
        }
        */

        // 4. Auto-update reminders for routine items
        if (items && Array.isArray(items)) {
            const routineItems = items.filter(item => item.isRoutine);
            for (const item of routineItems) {
                if (!item.name) continue;

                // Calculate targets
                const targetKm = (odometer && item.intervalKm)
                    ? parseInt(odometer) + parseInt(item.intervalKm)
                    : (item.nextKm ? parseInt(item.nextKm) : null);

                let targetDate = null;
                if (item.intervalMonths) {
                    targetDate = new Date(date);
                    targetDate.setMonth(targetDate.getMonth() + parseInt(item.intervalMonths));
                } else if (item.nextDate) {
                    targetDate = new Date(item.nextDate);
                }

                await prisma.vehicleMaintenanceReminder.upsert({
                    where: {
                        vehicleId_componentName: {
                            vehicleId: parseInt(vehicleId),
                            componentName: item.name
                        }
                    },
                    create: {
                        vehicleId: parseInt(vehicleId),
                        componentName: item.name,
                        lastServicedKm: odometer ? parseInt(odometer) : null,
                        lastServicedDate: new Date(date),
                        intervalKm: item.intervalKm ? parseInt(item.intervalKm) : null,
                        intervalMonths: item.intervalMonths ? parseInt(item.intervalMonths) : null,
                        targetKm,
                        targetDate,
                        lastCost: item.cost ? parseFloat(item.cost) : null,
                        status: 'OK'
                    },
                    update: {
                        lastServicedKm: odometer ? parseInt(odometer) : null,
                        lastServicedDate: new Date(date),
                        intervalKm: item.intervalKm ? parseInt(item.intervalKm) : null,
                        intervalMonths: item.intervalMonths ? parseInt(item.intervalMonths) : null,
                        targetKm,
                        targetDate,
                        lastCost: item.cost ? parseFloat(item.cost) : null,
                        status: 'OK'
                    }
                });
            }
        }

        res.status(201).json(log);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update maintenance log
exports.updateMaintenanceLog = async (req, res) => {
    try {
        const { id: userId, role } = req.user;
        const {
            date, category, type, description, cost, odometer, nextServiceOdometer, nextServiceDate, workshop, proofFile
        } = req.body;

        // Access Check
        const existingLog = await prisma.vehicleService.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { vehicle: { include: { pics: { select: { id: true } } } } }
        });

        if (!existingLog) return res.status(404).json({ error: 'Log tidak ditemukan' });

        if (!['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT'].includes(role)) {
            const isPic = existingLog.vehicle.pics.some(p => p.id === userId);
            if (!isPic) return res.status(403).json({ error: 'Anda tidak memiliki izin mengedit log kendaraan ini.' });
        }

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
                nextServiceDate: nextServiceDate ? new Date(nextServiceDate) : undefined,
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
        const { id: userId, role } = req.user;

        // Access Check
        const existingLog = await prisma.vehicleService.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { vehicle: { include: { pics: { select: { id: true } } } } }
        });

        if (!existingLog) return res.status(404).json({ error: 'Log tidak ditemukan' });

        if (!['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT'].includes(role)) {
            const isPic = existingLog.vehicle.pics.some(p => p.id === userId);
            if (!isPic) return res.status(403).json({ error: 'Anda tidak memiliki izin menghapus log kendaraan ini.' });
        }

        await prisma.vehicleService.delete({
            where: { id: parseInt(req.params.id) }
        });
        res.json({ message: 'Log pemeliharaan berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Hybrid Reminder Notification Checker
 * Reads from VehicleMaintenanceReminder table, calculates status,
 * and sends WhatsApp for WARNING/OVERDUE items.
 * Re-notifies every 4 days per vehicle.
 */
exports.checkHybridReminderNotifications = async () => {
    try {
        console.log('[Hybrid Reminder] Checking maintenance reminders...');
        const now = new Date();
        const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;

        const vehicles = await prisma.vehicle.findMany({
            where: { status: 'ACTIVE' },
            include: { maintenanceReminders: true }
        });

        const alertVehicles = [];
        for (const vehicle of vehicles) {
            if (!vehicle.maintenanceReminders.length) continue;

            // 4-day cooldown
            if (vehicle.lastKmNotifiedAt) {
                const elapsed = now.getTime() - new Date(vehicle.lastKmNotifiedAt).getTime();
                if (elapsed < FOUR_DAYS_MS) continue;
            }

            const alerts = [];
            for (const r of vehicle.maintenanceReminders) {
                let status = 'OK';
                let detail = '';

                if (r.targetKm && vehicle.odometer) {
                    const kmRemaining = r.targetKm - vehicle.odometer;
                    if (kmRemaining <= 0) { status = 'OVERDUE'; detail += `KM lewat ${Math.abs(kmRemaining).toLocaleString()} km. `; }
                    else if (kmRemaining <= 500) { status = 'WARNING'; detail += `Sisa ${kmRemaining.toLocaleString()} km. `; }
                }

                if (r.targetDate) {
                    const diffDays = Math.ceil((new Date(r.targetDate) - now) / (1000 * 60 * 60 * 24));
                    if (diffDays <= 0 && status !== 'OVERDUE') { status = 'OVERDUE'; detail += `Lewat ${Math.abs(diffDays)} hari.`; }
                    else if (diffDays <= 14 && status === 'OK') { status = 'WARNING'; detail += `Sisa ${diffDays} hari.`; }
                }

                if (status !== 'OK') {
                    alerts.push({ name: r.componentName, status, detail });
                }
            }

            if (alerts.length > 0) alertVehicles.push({ vehicle, alerts });
        }

        if (alertVehicles.length === 0) {
            console.log('[Hybrid Reminder] Semua kendaraan dalam kondisi OK.');
            return;
        }

        const recipients = await prisma.user.findMany({
            where: {
                OR: [
                    { position: 'Kepala Bidang Sarana dan Prasarana' },
                    { position: 'Staff Kendaraan' }
                ],
                phone: { not: null }
            }
        });

        if (recipients.length === 0) return;

        let globalDelay = 0;
        for (const { vehicle, alerts } of alertVehicles) {
            const overdueItems = alerts.filter(a => a.status === 'OVERDUE');
            const warningItems = alerts.filter(a => a.status === 'WARNING');

            let itemList = '';
            if (overdueItems.length > 0) {
                itemList += `\n🔴 *OVERDUE (${overdueItems.length}):*\n`;
                overdueItems.forEach(a => { itemList += `  • ${a.name} — ${a.detail}\n`; });
            }
            if (warningItems.length > 0) {
                itemList += `\n🟡 *SEGERA (${warningItems.length}):*\n`;
                warningItems.forEach(a => { itemList += `  • ${a.name} — ${a.detail}\n`; });
            }

            const message = `🔧 *PENGINGAT PEMELIHARAAN KENDARAAN*\n\n` +
                `Kendaraan: *${vehicle.name} (${vehicle.plateNumber})*\n` +
                `KM Saat Ini: *${(vehicle.odometer || 0).toLocaleString()} km*\n` +
                itemList +
                `\nMohon segera dijadwalkan untuk service. Terima kasih.`;

            for (const person of recipients) {
                const randomGap = Math.floor(Math.random() * (60000 - 30000 + 1)) + 30000;
                globalDelay += randomGap;
                setTimeout(async () => {
                    try {
                        await sendMessage(person.phone, message);
                        console.log(`[Hybrid Reminder] Sent for ${vehicle.name} to ${person.name}`);
                    } catch (e) {
                        console.error(`[Hybrid Reminder] Failed: ${person.name}:`, e.message);
                    }
                }, globalDelay);
            }

            try {
                await prisma.vehicle.update({
                    where: { id: vehicle.id },
                    data: { lastKmNotifiedAt: now }
                });
            } catch (e) { }
        }

        console.log(`[Hybrid Reminder] Scheduled ${alertVehicles.length * recipients.length} notification(s).`);
    } catch (error) {
        console.error('[Hybrid Reminder] Error:', error.message);
    }
};

// Legacy aliases
exports.checkMaintenanceNotifications = exports.checkHybridReminderNotifications;
exports.checkKmServiceNotifications = exports.checkHybridReminderNotifications;
