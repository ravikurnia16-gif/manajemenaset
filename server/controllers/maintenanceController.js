const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { deleteFile } = require('../services/minioService');
const whatsappService = require('../services/whatsappService');
const { createNotification } = require('./notificationController');
const predictiveService = require('../services/predictiveService');
const crypto = require('crypto');

// Helper to generate Maintenance Code
const generateCode = async (targetDept = 'SARPRAS') => {
    const year = new Date().getFullYear();
    const prefix = targetDept === 'PEMBANGUNAN' ? 'PBG' : 'MT';
    
    // Find the latest record for this year and specific prefix to get the highest sequence
    const lastRecord = await prisma.maintenance.findFirst({
        where: {
            code: {
                startsWith: `${prefix}/${year}/`
            }
        },
        orderBy: {
            code: 'desc'
        }
    });

    let nextSequence = 1;
    if (lastRecord) {
        const parts = lastRecord.code.split('/');
        if (parts.length === 3) {
            const lastSeq = parseInt(parts[2]);
            if (!isNaN(lastSeq)) {
                nextSequence = lastSeq + 1;
            }
        }
    }

    const sequence = nextSequence.toString().padStart(3, '0');
    return `${prefix}/${year}/${sequence}`;
};

// Get all maintenance reports
exports.getAllReports = async (req, res) => {
    const { status, type, unitId, category, targetDept } = req.query;
    const user = req.user;

    try {
        const whereClause = {};
        if (status) whereClause.status = status;
        if (type) whereClause.type = type;
        if (category) whereClause.category = category;
        if (targetDept) whereClause.targetDept = targetDept;
        if (unitId) whereClause.unitId = parseInt(unitId);

        // Non-admin users only see their own unit
        if (['ADMIN_UNIT', 'USER'].includes(user.role)) {
            // Expansion: Pembangunan staff can see ALL Pembangunan reports globally
            const isPembangunanTeam = ['Kepala Bidang Pembangunan', 'Staff Pembangunan'].includes(user.position);
            
            if (isPembangunanTeam) {
                whereClause.OR = [
                    { targetDept: 'PEMBANGUNAN' },
                    { unitId: user.unitId }
                ];
                // Remove the top-level unitId if it was set
                delete whereClause.unitId;
            } else {
                whereClause.unitId = user.unitId;
            }
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
    const { title, type, assetIds, description, location, photo, category, urgency, targetDept } = req.body;
    const user = req.user;

    try {
        const code = await generateCode(targetDept || 'SARPRAS');

        // --- Process Media ---
        const media = req.uploadedMedia || [];
        const firstImagePath = media.find(m => m.type === 'IMAGE')?.url || photo || null;

        // AI Analysis removed for stability

        const isDirect = (req.body.isDirectOrder === 'true' || req.body.isDirectOrder === true) && user.role === 'SUPER_ADMIN' && targetDept !== 'PEMBANGUNAN';
        let initialStatus = 'SUBMITTED';
        let technician = null;
        let quickToken = null;

        // Auto-assign for Direct Orders
        if (isDirect) {
            initialStatus = 'ASSIGNED';
            // Find Staff Manajemen Aset
            const staffAset = await prisma.user.findFirst({
                where: { position: 'Staff Manajemen Aset' }
            });
            if (staffAset) {
                technician = staffAset.name || staffAset.username;
                quickToken = crypto.randomBytes(16).toString('hex');
            }
        }

        const report = await prisma.maintenance.create({
            data: {
                code,
                userId: user.id,
                unitId: user.unitId,
                type: type || 'NON_ASSET',
                category: category || 'INCIDENTAL',
                urgency: urgency || 'NORMAL',
                isDirectOrder: isDirect,
                technician,
                quickToken,
                assets: type === 'ASSET' && assetIds && assetIds.length > 0 ? {
                    connect: assetIds.map(id => ({ id: parseInt(id) }))
                } : undefined,
                title: isDirect ? `[INSTRUKSI KABID] ${title}` : title,
                description,
                location: location || null,
                photo: firstImagePath,
                media: media.length > 0 ? media : undefined,
                status: initialStatus,
                targetDept: targetDept || 'SARPRAS'
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

                // 1. In-App Notification (Only Staff Manajemen Aset for incoming requests)
                const notifRecipients = await prisma.user.findMany({
                    where: {
                        position: 'Staff Manajemen Aset'
                    }
                });
 
                for (const admin of notifRecipients) {
                    await createNotification(
                        admin.id,
                        targetDept === 'PEMBANGUNAN' ? 'Laporan Pembangunan Baru' : 'Laporan Pemeliharaan Baru',
                        `${submitterName} melaporkan masalah: "${title}".`,
                        'URGENT',
                        `/pemeliharaan/${report.id}`
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
                        `\u{1F4CB} *Judul* : ${isDirect ? `[INSTRUKSI KABID] ${title}` : title}\n` +
                        `\u{1F4C4} *Kode* : ${code}\n` +
                        `\u{1F527} *Tipe* : ${type === 'ASSET' ? 'Aset Terdata' : 'Non-Aset / Umum'}\n` +
                        `${isDirect ? `*Status* : Langsung Ditugaskan (Pimpinan) \u2705\n\n` : `\n`}` +
                        `Mohon menunggu proses pengerjaan.`;

                    await whatsappService.sendMessage(submitter.phone, msgSubmitter);
                }

                // 2. WhatsApp Notification (Only Staff Manajemen Aset for incoming requests)
                const waRecipients = await prisma.user.findMany({
                    where: {
                        position: 'Staff Manajemen Aset',
                        phone: { not: null, not: '' }
                    }
                });

                if (waRecipients.length > 0) {
                    const assetListStr = report.assets?.length > 0
                        ? report.assets.map(a => `- ${a.name} (${a.code})`).join('\n')
                        : '- (Non-Aset)';

                    const urgencyLabels = {
                        'NORMAL': 'Biasa',
                        'URGENT': '🚨 Penting',
                        'EMERGENCY': '🔴 DARURAT'
                    };

                    const msgAdmin = `${targetDept === 'PEMBANGUNAN' ? '🏗️ *LAPORAN PEMBANGUNAN BARU*' : (isDirect ? `👑 *INSTRUKSI LANGSUNG KABID*` : `🔧 *LAPORAN PEMELIHARAAN BARU*`)}\n\n` +
                        `👤 *Pelapor* : ${submitter?.name || submitter?.username || '-'}\n` +
                        `📞 *Kontak* : wa.me/${submitter?.phone?.replace(/^0/, '62') || '-'}\n` +
                        `⚡ *Urgensi* : ${isDirect ? 'PENGERJAAN PRIORITAS' : (urgencyLabels[report.urgency] || report.urgency)}\n` +
                        `📂 *Bidang* : ${targetDept === 'PEMBANGUNAN' ? 'Pembangunan' : 'Sarana & Prasarana'}\n` +
                        `📂 *Kategori* : ${report.category === 'ROUTINE' ? 'Pemeliharaan Rutin' : 'Pemeliharaan Insidentil'}\n` +
                        `📜 *Kode* : ${code}\n` +
                        `📋 *Judul* : ${title}\n` +
                        `📝 *Masalah* : ${description}\n\n` +
                        (targetDept !== 'PEMBANGUNAN' ? `📦 *Aset Terkait* :\n${assetListStr}\n\n` : '') +
                        `${isDirect ? `*Status*: Otomatis Ditugaskan ke Staff Aset.` : `Mohon segera ditindaklanjuti.`}\n\n` +
                        `Syukron jazakumullahu khairan.`;

                    // Send to all found recipients with delay
                    setTimeout(async () => {
                        let cumulativeDelay = 0;
                        for (const admin of waRecipients) {
                            const randomGap = Math.floor(Math.random() * (15000 - 5000 + 1)) + 5000;
                            cumulativeDelay += randomGap;
 
                            setTimeout(async () => {
                                try {
                                    await whatsappService.sendMessage(admin.phone, msgAdmin);
                                } catch (e) {
                                    console.error(`[WA] Failed admin notif to ${admin.username}:`, e);
                                }
                            }, cumulativeDelay);
                        }
                    }, isDirect ? 2000 : 30000); // Faster for direct orders
                }

                // 3. Notify Technician (If Direct Order)
                if (isDirect && report.status === 'ASSIGNED' && report.technician) {
                    const techUser = await prisma.user.findFirst({
                        where: { position: 'Staff Manajemen Aset' }
                    });

                    if (techUser && techUser.phone) {
                        const msgTech = `🛠 *PENUGASAN MANDAT KABID*\n\n` +
                            `Halo *${techUser.name || techUser.username}*,\n` +
                            `Anda mendapatkan instruksi langsung untuk memperbaiki: *${title}*.\n\n` +
                            `📜 *Kode* : ${code}\n` +
                            `👤 *Pemberi Tugas* : Super Admin (Atas Perintah Kabid)\n` +
                            `📝 *Masalah* : ${description}\n\n` +
                            `Mohon segera ditindaklanjuti. Syukron.`;

                        setTimeout(async () => {
                            await whatsappService.sendMessage(techUser.phone, msgTech);
                        }, 5000);
                    }
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
        if (status === 'COMPLETED') {
            updateData.completionDate = new Date();
            updateData.quickToken = null; // Clear token after use
        }
        
        // Generate quickToken if assigned
        if (status === 'ASSIGNED') {
            updateData.quickToken = crypto.randomBytes(16).toString('hex');
        }

        const report = await prisma.maintenance.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                user: { select: { username: true, name: true, phone: true } },
                unit: { select: { name: true } },
                assets: true // Include assets for prediction logic
            }
        });

        // Check if status changed
        const statusDidUnchange = report.status === status; // New logic for detail updates

        // --- Predictive Maintenance Trigger (If Completed) ---
        if (status === 'COMPLETED' && report.type === 'ASSET' && report.assets.length > 0) {
            (async () => {
                for (const asset of report.assets) {
                    try {
                        await predictiveService.predictNextMaintenance(asset.id);
                        console.log(`[Predictive] Updated prediction for Asset ID: ${asset.id}`);
                    } catch (err) {
                        console.error(`[Predictive] Error for Asset ${asset.id}:`, err);
                    }
                }
            })();
        }

        // --- In-App Notification (Phase 3) ---
        const statusLabels = {
            'APPROVED': 'Disetujui',
            'ASSIGNED': `Ditugaskan kepada: ${technician || '-'}`,
            'IN_PROGRESS': 'Sedang Dikerjakan',
            'COMPLETED': 'Selesai Dikerjakan',
            'REJECTED': 'Ditolak'
        };

        const notifMsg = statusDidUnchange 
            ? `Teknisi memperbarui detail pekerjaan pada laporan "${report.title}".`
            : `Laporan pemeliharaan "${report.title}" statusnya kini: ${statusLabels[status] || status}.`;
        
        const notifType = status === 'REJECTED' ? 'WARNING' : (status === 'COMPLETED' ? 'SUCCESS' : 'INFO');

        await createNotification(
            report.userId,
            'Update Pemeliharaan',
            notifMsg,
            notifType,
            `/pemeliharaan/${id}`
        );

        // Bell notification to assigned technician
        if (status === 'ASSIGNED' && technician) {
            try {
                const techUser = await prisma.user.findFirst({
                    where: { OR: [{ name: technician }, { username: technician }] }
                });
                if (techUser) {
                    await createNotification(
                        techUser.id,
                        'Penugasan Baru',
                        `Anda ditugaskan untuk menangani: "${report.title}" (${report.code}).`,
                        'URGENT',
                        `/pemeliharaan/${id}`
                    );
                }
            } catch (e) {
                console.error('Bell notif to technician error:', e);
            }
        }

        res.json(report);

        // --- WhatsApp Notification (Async) ---
        (async () => {
            try {
                // SKIP WA IF ONLY DETAIL UPDATE
                if (statusDidUnchange && !rejectionReason) return; 

                // --- WhatsApp Notification to Technician (Async) ---
                if (status === 'ASSIGNED' && technician) {
                    try {
                        const techUser = await prisma.user.findFirst({
                            where: { OR: [{ name: technician }, { username: technician }] }
                        });
                        
                        if (techUser && techUser.phone) {
                            const msgTech = `🛠 *PENUGASAN PEMELIHARAAN*\n\n` +
                                `Halo *${techUser.name || techUser.username}*,\n` +
                                `Anda ditugaskan untuk memperbaiki: *${report.title}*.\n\n` +
                                `📜 *Kode* : ${report.code}\n` +
                                `📋 *Judul* : ${report.title}\n` +
                                `📝 *Masalah* : ${report.description}\n\n` +
                                `Terima kasih!`;
                                
                            setTimeout(async () => {
                                await whatsappService.sendMessage(techUser.phone, msgTech);
                            }, 45000); // Send slightly after submitter notif
                        }
                    } catch (e) {
                        console.error('WA Tech Notif Error:', e);
                    }
                }
                
                const submitter = report.user;
                if (!submitter?.phone) return;

                const statusLabels = {
                    'APPROVED': 'Disetujui \u2705',
                    'ASSIGNED': `Ditugaskan kepada: ${technician || '-'} \u{1F6E0}`,
                    'IN_PROGRESS': 'Sedang Dikerjakan \u2699\ufe0f',
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
                        console.log(`[WA] Status notif sent to ${submitter.username}`);
                    } catch (e) {
                        console.error('WA Status Error:', e);
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

// Quick Completion via Token (Public)
exports.quickComplete = async (req, res) => {
    const { token } = req.params;
    const { actionTaken, cost } = req.body;

    try {
        const report = await prisma.maintenance.findUnique({
            where: { quickToken: token },
            include: { assets: true }
        });

        if (!report) {
            return res.status(404).json({ error: 'Token tidak valid atau sudah kedaluwarsa.' });
        }

        if (report.status === 'COMPLETED') {
            return res.status(400).json({ error: 'Pekerjaan ini sudah selesai sebelumnya.' });
        }

        const updatedReport = await prisma.maintenance.update({
            where: { id: report.id },
            data: {
                status: 'COMPLETED',
                actionTaken: actionTaken || 'Dikerjakan via Quick Link',
                cost: cost ? parseFloat(cost) : report.cost,
                completionDate: new Date(),
                quickToken: null // Clear token
            }
        });

        // Trigger predictive maintenance if applicable
        if (report.type === 'ASSET' && report.assets.length > 0) {
            for (const asset of report.assets) {
                try {
                    await predictiveService.predictNextMaintenance(asset.id);
                } catch (e) {
                    console.error('QuickComplete Predictive Error:', e);
                }
            }
        }

        res.json({ message: 'Laporan berhasil diperbarui!', data: updatedReport });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete Report
exports.deleteReport = async (req, res) => {
    const { id } = req.params;
    try {
        const report = await prisma.maintenance.findUnique({ where: { id: parseInt(id) } });
        if (report && report.photo) {
            await deleteFile(report.photo);
        }
        await prisma.maintenance.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Laporan berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
