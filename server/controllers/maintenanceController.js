const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const whatsappService = require('../services/whatsappService');
const { createNotification } = require('./notificationController');

// Helper to generate Maintenance Code
const generateCode = async () => {
    const year = new Date().getFullYear();
    const count = await prisma.maintenance.count();
    const sequence = (count + 1).toString().padStart(3, '0');
    return `MT/${year}/${sequence}`;
};

// Get all maintenance reports
exports.getAllReports = async (req, res) => {
    const { status, type, unitId, category } = req.query;
    const user = req.user;

    try {
        const whereClause = {};
        if (status) whereClause.status = status;
        if (type) whereClause.type = type;
        if (category) whereClause.category = category;
        if (unitId) whereClause.unitId = parseInt(unitId);

        // Non-admin users only see their own unit
        if (['ADMIN_UNIT', 'USER'].includes(user.role)) {
            whereClause.unitId = user.unitId;
        }

        const reports = await prisma.maintenance.findMany({
            where: whereClause,
            include: {
                user: { select: { username: true, name: true } },
                unit: { select: { name: true } },
                assets: { select: { code: true, name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(reports);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get single report
exports.getReportById = async (req, res) => {
    const { id } = req.params;
    try {
        const report = await prisma.maintenance.findUnique({
            where: { id: parseInt(id) },
            include: {
                user: { select: { username: true, name: true, phone: true } },
                unit: { select: { name: true } },
                assets: { select: { id: true, code: true, name: true, specification: true, condition: true } }
            }
        });
        if (!report) return res.status(404).json({ error: 'Laporan tidak ditemukan' });
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create Report
exports.createReport = async (req, res) => {
    const { title, type, assetIds, description, location, photo, category } = req.body;
    const user = req.user;

    try {
        const code = await generateCode();

        const report = await prisma.maintenance.create({
            data: {
                code,
                userId: user.id,
                unitId: user.unitId,
                type: type || 'NON_ASSET',
                category: category || 'INCIDENTAL',
                assets: type === 'ASSET' && assetIds && assetIds.length > 0 ? {
                    connect: assetIds.map(id => ({ id: parseInt(id) }))
                } : undefined,
                title,
                description,
                location: location || null,
                photo: photo || null,
                status: 'SUBMITTED'
            },
            include: {
                unit: true,
                assets: true
            }
        });

        res.json({ message: 'Laporan berhasil dibuat', data: report });

        // --- In-App Notification (Phase 3) ---
        (async () => {
            try {
                const submitterInfo = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, username: true } });
                const submitterName = submitterInfo?.name || submitterInfo?.username || 'Seseorang';

                const admins = await prisma.user.findMany({
                    where: {
                        OR: [
                            { position: 'Kepala Bidang Sarana dan Prasarana' },
                            { position: 'Staff Manajemen Aset' }
                        ]
                    }
                });

                for (const admin of admins) {
                    await createNotification(
                        admin.id,
                        'Laporan Pemeliharaan Baru',
                        `${submitterName} melaporkan masalah: "${title}".`,
                        'URGENT',
                        '/maintenance'
                    );
                }
            } catch (err) {
                console.error('Failed to send in-app notification for maintenance:', err);
            }
        })();

        // --- WhatsApp Notification (Async) ---
        (async () => {
            try {
                const submitter = await prisma.user.findUnique({
                    where: { id: user.id },
                    include: { unit: true }
                });

                // 1. Notify Submitter
                if (submitter?.phone) {
                    const msgSubmitter = `*Info Laporan Pemeliharaan*\n\n` +
                        `Ustadz/Ustadzah *${submitter.name || submitter.username}*, laporan pemeliharaan Anda telah kami terima.\n\n` +
                        `\u{1F4CB} *Judul* : ${title}\n` +
                        `\u{1F4C4} *Kode* : ${code}\n` +
                        `\u{1F527} *Tipe* : ${type === 'ASSET' ? 'Aset Terdata' : 'Non-Aset / Umum'}\n\n` +
                        `Mohon menunggu proses persetujuan.`;

                    await whatsappService.sendMessage(submitter.phone, msgSubmitter);
                }

                // 2. Notify Leads: Kepala Bidang Sarana dan Prasarana and Eldo
                const admins = await prisma.user.findMany({
                    where: {
                        OR: [
                            { position: 'Kepala Bidang Sarana dan Prasarana' },
                            { position: 'Staff Manajemen Aset' }
                        ],
                        phone: { not: null, not: '' }
                    }
                });

                if (admins.length > 0) {
                    const assetListStr = report.assets?.length > 0
                        ? report.assets.map(a => `- ${a.name} (${a.code})`).join('\n')
                        : '- (Non-Aset)';

                    const msgAdmin = `🔧 *LAPORAN PEMELIHARAAN BARU*\n\n` +
                        `👤 *Pelapor* : ${submitter?.name || submitter?.username || '-'}\n` +
                        `📂 *Kategori* : ${report.category === 'ROUTINE' ? 'Pemeliharaan Rutin' : 'Pemeliharaan Insidentil'}\n` +
                        `📜 *Kode* : ${code}\n` +
                        `📋 *Judul* : ${title}\n` +
                        `📝 *Masalah* : ${description}\n\n` +
                        `📦 *Aset Terkait* :\n${assetListStr}\n\n` +
                        `Mohon segera ditindaklanjuti.`;

                    // Send to all found admins with 30s delay
                    setTimeout(async () => {
                        let cumulativeDelay = 0;
                        for (const admin of admins) {
                            const randomGap = Math.floor(Math.random() * (20000 - 5000 + 1)) + 5000;
                            cumulativeDelay += randomGap;

                            setTimeout(async () => {
                                try {
                                    await whatsappService.sendMessage(admin.phone, msgAdmin);
                                    console.log(`[WA] Maintenance admin notif sent to ${admin.username}`);
                                } catch (e) {
                                    console.error(`[WA] Failed admin notif to ${admin.username}:`, e);
                                }
                            }, cumulativeDelay);
                        }
                    }, 30000);
                }
            } catch (err) {
                console.error('WA Maintenance Create Error:', err);
            }
        })();

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update Status (Workflow Transitions)
exports.updateStatus = async (req, res) => {
    const { id } = req.params;
    const { status, approvalNote, validationNote, rejectionReason, technician, actionTaken, completionNote, cost } = req.body;

    try {
        const updateData = { status };
        if (approvalNote) updateData.approvalNote = approvalNote;
        if (validationNote) updateData.validationNote = validationNote;
        if (rejectionReason) updateData.rejectionReason = rejectionReason;
        if (technician) updateData.technician = technician;
        if (actionTaken) updateData.actionTaken = actionTaken;
        if (completionNote) updateData.completionNote = completionNote;
        if (cost !== undefined) updateData.cost = parseFloat(cost);
        if (status === 'COMPLETED') updateData.completionDate = new Date();

        const report = await prisma.maintenance.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                user: { select: { username: true, name: true, phone: true } },
                unit: { select: { name: true } }
            }
        });

        // --- In-App Notification (Phase 3) ---
        const statusLabels = {
            'APPROVED': 'Disetujui',
            'ASSIGNED': `Ditugaskan ke Teknisi: ${technician || '-'}`,
            'COMPLETED': 'Selesai Dikerjakan',
            'REJECTED': 'Ditolak'
        };

        const notifMsg = `Laporan pemeliharaan "${report.title}" statusnya kini: ${statusLabels[status] || status}.`;
        const notifType = status === 'REJECTED' ? 'WARNING' : (status === 'COMPLETED' ? 'SUCCESS' : 'INFO');

        await createNotification(
            report.userId,
            'Update Pemeliharaan',
            notifMsg,
            notifType,
            `/maintenance/view/${id}`
        );

        res.json(report);

        // --- WhatsApp Notification to Submitter (Async) ---
        (async () => {
            try {
                const submitter = report.user;
                if (!submitter?.phone) return;

                const statusLabels = {
                    'APPROVED': 'Disetujui \u2705',
                    'ASSIGNED': `Ditugaskan ke Teknisi: ${technician || '-'} \u{1F6E0}`,
                    'COMPLETED': 'Selesai \u2705\u2705\u2705',
                    'REJECTED': 'Ditolak \u274C'
                };

                const statusLabel = statusLabels[status] || status;
                let msg = `*Info Laporan Pemeliharaan*\n\n` +
                    `Ustadz/Ustadzah *${submitter.name || submitter.username}*,\n\n` +
                    `Laporan Anda *\"${report.title}\"* (${report.code})\n` +
                    `Status terbaru: *${statusLabel}*\n`;

                if (status === 'REJECTED' && rejectionReason) {
                    msg += `\n*Alasan:* ${rejectionReason}\n`;
                }
                if (status === 'COMPLETED' && actionTaken) {
                    msg += `\n*Tindakan:* ${actionTaken}\n`;
                }

                setTimeout(async () => {
                    try {
                        await whatsappService.sendMessage(submitter.phone, msg);
                        console.log(`[WA] Maintenance status notif sent to ${submitter.username} (${status})`);
                    } catch (e) {
                        console.error('[WA] Failed maintenance status notif:', e);
                    }
                }, 30000);
            } catch (err) {
                console.error('WA Maintenance Status Error:', err);
            }
        })();

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete Report
exports.deleteReport = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.maintenance.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Laporan berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
