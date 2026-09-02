const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendMessage } = require('../services/whatsappService');
const { createNotification } = require('./notificationController');
const { sendPushToKabid } = require('../services/pushService');

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
 * 2. CRON JOBS & AUTOMATIONS
 */

// Helper: Get staff kendaraan users
const getStaffKendaraan = async () => {
    return prisma.user.findMany({
        where: {
            position: { contains: 'Kendaraan' },
            phone: { not: null, not: '' }
        }
    });
};

// Helper: Get Kepala Bidang Sarana users
const getKabidSarana = async () => {
    return prisma.user.findMany({
        where: {
            OR: [
                { position: 'Kepala Bidang Sarana' },
                { position: { contains: 'Kepala Bidang Sarana' } }
            ]
        }
    });
};

// Helper: Unified Checklist Auditor
// Checks Daily (>=2 days), Weekly (>=1 week), and Monthly (>=1 month) missing checklists
// and sends ONE SINGLE SUMMARY MESSAGE to Kepala Bidang Sarana.
const auditAllChecklistsUnified = async () => {
    console.log(`[${new Date().toLocaleString('id-ID')}] [Checklist] Running Unified Checklist Audit...`);
    try {
        const vehicles = await prisma.vehicle.findMany({
            where: {
                status: 'ACTIVE',
                OR: [
                    { requireDailyChecklist: true },
                    { requireWeeklyChecklist: true },
                    { requireMonthlyChecklist: true }
                ]
            },
            include: { pics: { select: { id: true, name: true, phone: true } } }
        });

        if (vehicles.length === 0) return;

        const now = new Date();

        // 1. Calculate Daily threshold (2 workdays ago)
        let dailyStart = new Date();
        dailyStart.setHours(0, 0, 0, 0);
        let daysSub = 2;
        while (daysSub > 0) {
            dailyStart.setDate(dailyStart.getDate() - 1);
            if (dailyStart.getDay() !== 0 && dailyStart.getDay() !== 6) daysSub--;
        }

        // 2. Calculate Weekly threshold (7 days ago)
        const weeklyStart = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        weeklyStart.setHours(0, 0, 0, 0);

        // 3. Calculate Monthly threshold (30 days ago)
        const monthlyStart = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        monthlyStart.setHours(0, 0, 0, 0);

        const missingDaily = [];
        const missingWeekly = [];
        const missingMonthly = [];

        for (const v of vehicles) {
            // Check Daily
            if (v.requireDailyChecklist) {
                const count = await prisma.vehicleChecklist.count({
                    where: {
                        vehicleId: v.id,
                        type: { in: ['DAILY', 'HARIAN'] },
                        date: { gte: dailyStart, lte: now }
                    }
                });
                if (count === 0) missingDaily.push(v);
            }

            // Check Weekly
            if (v.requireWeeklyChecklist) {
                const count = await prisma.vehicleChecklist.count({
                    where: {
                        vehicleId: v.id,
                        type: { in: ['WEEKLY', 'MINGGUAN'] },
                        date: { gte: weeklyStart, lte: now }
                    }
                });
                if (count === 0) missingWeekly.push(v);
            }

            // Check Monthly
            if (v.requireMonthlyChecklist) {
                const count = await prisma.vehicleChecklist.count({
                    where: {
                        vehicleId: v.id,
                        type: { in: ['MONTHLY', 'BULANAN'] },
                        date: { gte: monthlyStart, lte: now }
                    }
                });
                if (count === 0) missingMonthly.push(v);
            }
        }

        const totalMissingItems = missingDaily.length + missingWeekly.length + missingMonthly.length;
        if (totalMissingItems === 0) {
            console.log('[Checklist] All required vehicle checklists are up to date.');
            return;
        }

        const kabidList = await getKabidSarana();
        const staffList = await getStaffKendaraan();

        // Construct ONE SINGLE CONSOLIDATED MESSAGE
        let msg = `Bismillah.\n⚠️ *RANGKUMAN CEKLIS KENDARAAN BELUM DIISI*\n\n` +
            `Berikut adalah rangkuman armada yang *BELUM DILAKUKAN* pengisian ceklis oleh Penanggung Jawab (PJ):\n\n`;

        if (missingDaily.length > 0) {
            msg += `🔴 *CEKLIS HARIAN (Belum diisi >= 2 hari kerja)*:\n`;
            missingDaily.forEach(v => {
                const picNames = v.pics?.length > 0 ? v.pics.map(p => p.name).join(', ') : 'Belum Ada PJ';
                msg += `- *${v.name}* (${v.plateNumber}) | PJ: _${picNames}_\n`;
            });
            msg += `\n`;
        }

        if (missingWeekly.length > 0) {
            msg += `🟡 *CEKLIS MINGGUAN (Belum diisi >= 1 minggu)*:\n`;
            missingWeekly.forEach(v => {
                const picNames = v.pics?.length > 0 ? v.pics.map(p => p.name).join(', ') : 'Belum Ada PJ';
                msg += `- *${v.name}* (${v.plateNumber}) | PJ: _${picNames}_\n`;
            });
            msg += `\n`;
        }

        if (missingMonthly.length > 0) {
            msg += `🔵 *CEKLIS BULANAN (Belum diisi >= 1 bulan)*:\n`;
            missingMonthly.forEach(v => {
                const picNames = v.pics?.length > 0 ? v.pics.map(p => p.name).join(', ') : 'Belum Ada PJ';
                msg += `- *${v.name}* (${v.plateNumber}) | PJ: _${picNames}_\n`;
            });
            msg += `\n`;
        }

        msg += `Mohon perhatian dan perbaikan pengisian oleh Penanggung Jawab kendaraan terkait.\n\n` +
            `_Sistem Manajemen Aset_`;

        // 1. Send ONE WhatsApp message to each Kepala Bidang Sarana
        for (const k of kabidList) {
            if (k.phone) {
                await sendMessage(k.phone, msg).catch(e => console.error('[Checklist] WA Kabid Error:', e.message));
            }
            // 2. Send In-App Notification to Kepala Bidang Sarana
            await createNotification(
                k.id,
                '⚠️ Rangkuman Ceklis Kendaraan Terlewat',
                `Terdapat ${totalMissingItems} item ceklis kendaraan (Harian/Mingguan/Bulanan) yang belum diisi oleh PJ.`,
                'WARNING',
                '/kendaraan'
            );
        }

        // 3. Send Push Notification to Kepala Bidang Sarana
        await sendPushToKabid(
            '⚠️ Rangkuman Ceklis Kendaraan Terlewat',
            `Terdapat ${totalMissingItems} item ceklis kendaraan yang belum diisi.`,
            '/kendaraan'
        );

        // 4. Send the same consolidated message to Staff Kendaraan as action alert
        for (const s of staffList) {
            if (s.phone) sendMessage(s.phone, msg).catch(e => console.error('[Checklist] WA Staff Error:', e.message));
        }

    } catch (err) {
        console.error('[Checklist] Unified Audit Error:', err.message);
    }
};

// Scheduled triggers
exports.auditDailyChecklists = async () => {
    await auditAllChecklistsUnified();
};

exports.sendWeeklyChecklistReminder = async () => {
    console.log(`[${new Date().toLocaleString('id-ID')}] [Checklist] Sending Weekly Checklist Reminder...`);
    try {
        const vehicles = await prisma.vehicle.findMany({ where: { requireWeeklyChecklist: true, status: 'ACTIVE' } });
        if (vehicles.length === 0) return;

        const staff = await getStaffKendaraan();
        for (const s of staff) {
            const msg = `🚗 *PENGINGAT CEKLIS MINGGUAN*\n\nAssalamu'alaikum, mengingatkan kepada Staf Kendaraan untuk melakukan pengisian Ceklis Mingguan pada armada wajib minggu ini.\n\nTerdapat ${vehicles.length} kendaraan yang wajib dicek.`;
            sendMessage(s.phone, msg);
        }
    } catch (err) {
        console.error('[Checklist] Weekly Reminder Error:', err.message);
    }
};

exports.auditWeeklyChecklists = async () => {
    await auditAllChecklistsUnified();
};

exports.auditMonthlyChecklists = async () => {
    await auditAllChecklistsUnified();
};


/**
 * 3. FRONTEND SUMMARY API
 * Returns list of vehicles missing required checklists (daily >= 2 days, weekly >= 1 week, monthly >= 1 month)
 */
exports.getMissingChecklistsSummary = async (req, res) => {
    try {
        const vehicles = await prisma.vehicle.findMany({
            where: {
                status: 'ACTIVE',
                OR: [
                    { requireDailyChecklist: true },
                    { requireWeeklyChecklist: true },
                    { requireMonthlyChecklist: true }
                ]
            },
            include: {
                pics: { select: { id: true, name: true, phone: true } },
                vehicleChecklists: {
                    orderBy: { date: 'desc' },
                    take: 5,
                    select: { id: true, type: true, date: true, createdAt: true }
                }
            }
        });

        const now = new Date();

        // 2 workdays ago for daily
        let dailyStart = new Date();
        dailyStart.setHours(0, 0, 0, 0);
        let daysSub = 2;
        while (daysSub > 0) {
            dailyStart.setDate(dailyStart.getDate() - 1);
            if (dailyStart.getDay() !== 0 && dailyStart.getDay() !== 6) daysSub--;
        }

        // 7 days ago for weekly
        const weeklyStart = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

        // 30 days ago for monthly
        const monthlyStart = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

        const result = [];

        for (const v of vehicles) {
            const missingTypes = [];

            // Check Daily
            if (v.requireDailyChecklist) {
                const hasDaily = v.vehicleChecklists.some(c =>
                    ['DAILY', 'HARIAN'].includes(c.type) && new Date(c.date || c.createdAt) >= dailyStart
                );
                if (!hasDaily) missingTypes.push({ type: 'DAILY', label: 'Harian (>= 2 hari)' });
            }

            // Check Weekly
            if (v.requireWeeklyChecklist) {
                const hasWeekly = v.vehicleChecklists.some(c =>
                    ['WEEKLY', 'MINGGUAN'].includes(c.type) && new Date(c.date || c.createdAt) >= weeklyStart
                );
                if (!hasWeekly) missingTypes.push({ type: 'WEEKLY', label: 'Mingguan (>= 1 minggu)' });
            }

            // Check Monthly
            if (v.requireMonthlyChecklist) {
                const hasMonthly = v.vehicleChecklists.some(c =>
                    ['MONTHLY', 'BULANAN'].includes(c.type) && new Date(c.date || c.createdAt) >= monthlyStart
                );
                if (!hasMonthly) missingTypes.push({ type: 'MONTHLY', label: 'Bulanan (>= 1 bulan)' });
            }

            if (missingTypes.length > 0) {
                result.push({
                    id: v.id,
                    name: v.name,
                    plateNumber: v.plateNumber,
                    pics: v.pics,
                    missingTypes
                });
            }
        }

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * 4. MANUAL AUDIT TRIGGER API
 */
exports.triggerChecklistAudit = async (req, res) => {
    try {
        await auditAllChecklistsUnified();
        res.json({ message: 'Audit ceklis kendaraan berhasil dijalankan. 1 Pesan rangkuman notifikasi telah dikirim.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

