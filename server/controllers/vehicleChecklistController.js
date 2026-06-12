const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendMessage } = require('../services/whatsappService');

/**
 * 1. CRUD FOR VEHICLE CHECKLIST
 */

exports.getChecklists = async (req, res) => {
    try {
        const checklists = await prisma.vehicleChecklist.findMany({
            include: {
                vehicle: { select: { name: true, plateNumber: true, type: true } },
                driver: { select: { name: true, position: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });
        res.json(checklists);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createChecklist = async (req, res) => {
    const { vehicleId, type, checks, fuelLevel, notes, status } = req.body;
    try {
        const checklist = await prisma.vehicleChecklist.create({
            data: {
                vehicleId: parseInt(vehicleId),
                driverId: req.user.id,
                date: new Date(),
                type,
                checks: typeof checks === 'string' ? JSON.parse(checks) : checks,
                fuelLevel,
                notes,
                status: status || 'SIAP JALAN'
            }
        });
        res.status(201).json({ message: 'Ceklis berhasil disimpan', data: checklist });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * 2. CRON JOBS / AUTOMATIONS
 */

// Helper: Get staff kendaraan phones
const getStaffKendaraan = async () => {
    return prisma.user.findMany({
        where: {
            OR: [
                { role: 'ADMIN_ASET' },
                { role: 'SUPER_ADMIN' },
                { position: { contains: 'Kendaraan' } }
            ],
            phone: { not: null }
        }
    });
};

// A. Daily Checklist Audit (Mon-Fri 18:00)
exports.auditDailyChecklists = async () => {
    console.log(`[${new Date().toLocaleString('id-ID')}] [Checklist] Auditing Daily Checklists...`);
    try {
        const vehicles = await prisma.vehicle.findMany({ where: { requireDailyChecklist: true } });
        if (vehicles.length === 0) return;

        // Calculate past 2 workdays range
        let endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        let startDate = new Date();
        startDate.setHours(0, 0, 0, 0);

        let daysToSubtract = 2;
        while (daysToSubtract > 0) {
            startDate.setDate(startDate.getDate() - 1);
            if (startDate.getDay() !== 0 && startDate.getDay() !== 6) {
                daysToSubtract--;
            }
        }

        const staff = await getStaffKendaraan();

        for (const v of vehicles) {
            const count = await prisma.vehicleChecklist.count({
                where: {
                    vehicleId: v.id,
                    type: 'HARIAN',
                    date: { gte: startDate, lte: endDate }
                }
            });

            if (count < 4) { // Target: 2 per day * 2 days = 4
                const msg = `⚠️ *Peringatan Ceklis Harian*\n\nKendaraan *${v.name} (${v.plateNumber})* tidak mengisi ceklis harian secara rutin (2x sehari) dalam 2 hari kerja terakhir. Total pengisian hanya: ${count} kali.\n\nMohon Staf Kendaraan segera menindaklanjuti.`;
                for (const s of staff) {
                    sendMessage(s.phone, msg);
                }
            }
        }
    } catch (err) {
        console.error('[Checklist] Daily Audit Error:', err.message);
    }
};

// B. Weekly Checklist Reminder (Monday 07:15)
exports.sendWeeklyChecklistReminder = async () => {
    console.log(`[${new Date().toLocaleString('id-ID')}] [Checklist] Sending Weekly Checklist Reminder...`);
    try {
        const vehicles = await prisma.vehicle.findMany({ where: { requireWeeklyChecklist: true } });
        if (vehicles.length === 0) return;

        const staff = await getStaffKendaraan();
        for (const s of staff) {
            const msg = `🚗 *PENGINGAT CEKLIS MINGGUAN*\n\nAssalamu'alaikum, mengingatkan kepada Staf Kendaraan untuk melakukan pengisian Ceklis Mingguan pada armada wajib hari ini.\n\nTerdapat ${vehicles.length} kendaraan yang wajib dicek.`;
            sendMessage(s.phone, msg);
        }
    } catch (err) {
        console.error('[Checklist] Weekly Reminder Error:', err.message);
    }
};

// C. Weekly Checklist Audit (Friday 18:05)
exports.auditWeeklyChecklists = async () => {
    console.log(`[${new Date().toLocaleString('id-ID')}] [Checklist] Auditing Weekly Checklists...`);
    try {
        const vehicles = await prisma.vehicle.findMany({ where: { requireWeeklyChecklist: true } });
        if (vehicles.length === 0) return;

        const monday = new Date();
        monday.setDate(monday.getDate() - 4); // If today is Friday
        monday.setHours(0, 0, 0, 0);

        const friday = new Date();
        friday.setHours(23, 59, 59, 999);

        const staff = await getStaffKendaraan();

        for (const v of vehicles) {
            const count = await prisma.vehicleChecklist.count({
                where: {
                    vehicleId: v.id,
                    type: 'MINGGUAN',
                    date: { gte: monday, lte: friday }
                }
            });

            if (count === 0) {
                const msg = `❌ *PELANGGARAN CEKLIS MINGGUAN*\n\nKendaraan *${v.name} (${v.plateNumber})* BELUM DILAKUKAN CEKLIS MINGGUAN sepanjang minggu ini.\n\nMohon Staf Kendaraan segera menyelesaikan tanggung jawab pengecekan.`;
                for (const s of staff) {
                    sendMessage(s.phone, msg);
                }
            }
        }
    } catch (err) {
        console.error('[Checklist] Weekly Audit Error:', err.message);
    }
};
