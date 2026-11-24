const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const aiOfficeService = require('../services/aiOfficeService');
const { generateAiOfficeDocumentPDF } = require('../services/officePdfService');

exports.getDashboard = async (req, res) => {
    try {
        await aiOfficeService.recoverStaleDraftingItems(prisma).catch(() => {});
        const config = await aiOfficeService.getOrCreateConfig(prisma);
        const today = aiOfficeService.getTodayWib();

        const [
            proposedCount,
            approvedQueueCount,
            draftReadyCount,
            finalizedCount,
            todayReportsCount,
            todayAdminCount,
            recentLogs,
            latestSupervisorReport
        ] = await Promise.all([
            prisma.aiOfficeItem.count({ where: { staffRole: 'ADMINISTRASI', status: 'PROPOSED' } }),
            prisma.aiOfficeItem.count({ where: { staffRole: 'ADMINISTRASI', status: { in: ['APPROVED_FOR_DRAFT', 'DRAFTING'] } } }),
            prisma.aiOfficeItem.count({ where: { staffRole: 'ADMINISTRASI', status: 'DRAFT_READY' } }),
            prisma.aiOfficeItem.count({ where: { staffRole: 'ADMINISTRASI', status: 'FINALIZED' } }),
            prisma.aiOfficeItem.count({ where: { staffRole: 'SUPERVISI', category: 'LAPORAN_HARIAN', outputDate: today } }),
            prisma.aiOfficeItem.count({ where: { staffRole: 'ADMINISTRASI', outputDate: today } }),
            prisma.aiOfficeRunLog.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
            prisma.aiOfficeItem.findFirst({
                where: { staffRole: 'SUPERVISI', category: 'LAPORAN_HARIAN' },
                orderBy: { createdAt: 'desc' }
            })
        ]);

        res.json({
            today,
            config,
            defaultSopFormat: aiOfficeService.DEFAULT_SOP_GENERAL_FORMAT,
            routineState: aiOfficeService.getRoutineState(),
            counts: {
                proposed: proposedCount,
                approvedQueue: approvedQueueCount,
                draftReady: draftReadyCount,
                finalized: finalizedCount,
                todayReports: todayReportsCount,
                todayAdmin: todayAdminCount
            },
            latestSupervisorReport,
            recentLogs
        });
    } catch (err) {
        console.error('[AiOffice] getDashboard error:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.listItems = async (req, res) => {
    try {
        await aiOfficeService.recoverStaleDraftingItems(prisma).catch(() => {});
        const { staffRole, category, status, search } = req.query;
        const where = {};

        if (staffRole && staffRole !== 'ALL') where.staffRole = staffRole;
        if (category && category !== 'ALL') where.category = category;
        if (status && status !== 'ALL') {
            if (status.includes(',')) {
                where.status = { in: status.split(',').map(s => s.trim()) };
            } else {
                where.status = status;
            }
        }
        if (search && search.trim()) {
            const q = search.trim();
            where.OR = [
                { title: { contains: q } },
                { code: { contains: q } },
                { domain: { contains: q } },
                { rationale: { contains: q } }
            ];
        }

        const items = await prisma.aiOfficeItem.findMany({
            where,
            orderBy: [
                { outputDate: 'desc' },
                { createdAt: 'desc' }
            ],
            take: 150
        });

        res.json(items);
    } catch (err) {
        console.error('[AiOffice] listItems error:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.getItemById = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' });
        const item = await prisma.aiOfficeItem.findUnique({ where: { id } });
        if (!item) return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createManualItem = async (req, res) => {
    try {
        const {
            title,
            category = 'SOP',
            domain = 'Umum',
            priority = 'HIGH',
            rationale = '',
            brief = '',
            autoApprove = true,
            draftNow = false
        } = req.body || {};

        if (!title || !String(title).trim()) {
            return res.status(400).json({ error: 'Judul dokumen wajib diisi.' });
        }

        const outputDate = aiOfficeService.getTodayWib();
        const safeCategory = ['SOP', 'ATURAN', 'SURAT', 'LAINNYA'].includes(String(category).toUpperCase())
            ? String(category).toUpperCase()
            : 'SOP';
        const code = await aiOfficeService.generateItemCode(prisma, safeCategory, outputDate);

        let created = await prisma.aiOfficeItem.create({
            data: {
                code,
                staffRole: 'ADMINISTRASI',
                category: safeCategory,
                domain: String(domain || 'Umum').slice(0, 60),
                title: String(title).trim().slice(0, 240),
                rationale: rationale ? String(rationale).trim() : 'Permintaan khusus dari Kepala Bidang Sarana / Pengelola.',
                brief: brief ? String(brief).trim() : null,
                priority: ['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(String(priority).toUpperCase())
                    ? String(priority).toUpperCase()
                    : 'HIGH',
                status: autoApprove ? 'APPROVED_FOR_DRAFT' : 'PROPOSED',
                outputDate,
                triggeredBy: 'REQUEST',
                approvedById: autoApprove ? req.user?.id || null : null,
                approvedByName: autoApprove ? (req.user?.name || req.user?.username || 'Admin') : null,
                approvedAt: autoApprove ? new Date() : null,
                createdById: req.user?.id || null,
                createdByName: req.user?.name || req.user?.username || 'Admin'
            }
        });

        if (autoApprove && draftNow) {
            const drafted = await aiOfficeService.draftApprovedItem({
                prisma,
                itemId: created.id,
                trigger: 'AUTO_ON_ACC',
                actor: req.user
            });
            created = drafted.item;
        }

        res.status(201).json(created);
    } catch (err) {
        console.error('[AiOffice] createManualItem error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
};

exports.accItem = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' });

        const existing = await prisma.aiOfficeItem.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Usulan tidak ditemukan' });

        const { title, brief, priority, category, domain, draftNow = false } = req.body || {};

        let updated = await prisma.aiOfficeItem.update({
            where: { id },
            data: {
                ...(title && String(title).trim() ? { title: String(title).trim().slice(0, 240) } : {}),
                ...(brief !== undefined ? { brief: brief ? String(brief).trim() : null } : {}),
                ...(priority ? { priority: String(priority).toUpperCase() } : {}),
                ...(category ? { category: String(category).toUpperCase() } : {}),
                ...(domain ? { domain: String(domain).slice(0, 60) } : {}),
                status: 'APPROVED_FOR_DRAFT',
                approvedById: req.user?.id || null,
                approvedByName: req.user?.name || req.user?.username || 'Pimpinan',
                approvedAt: new Date()
            }
        });

        if (draftNow) {
            const drafted = await aiOfficeService.draftApprovedItem({
                prisma,
                itemId: updated.id,
                trigger: 'AUTO_ON_ACC',
                actor: req.user
            });
            updated = drafted.item;
        }

        res.json(updated);
    } catch (err) {
        console.error('[AiOffice] accItem error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
};

exports.rejectItem = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' });
        const { reason } = req.body || {};

        const updated = await prisma.aiOfficeItem.update({
            where: { id },
            data: {
                status: 'REJECTED',
                revisionNotes: reason ? String(reason).trim() : 'Ditolak pimpinan'
            }
        });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.draftItem = async (req, res) => {
    try {
        const result = await aiOfficeService.draftApprovedItem({
            prisma,
            itemId: req.params.id,
            trigger: 'MANUAL',
            actor: req.user
        });
        res.json(result);
    } catch (err) {
        console.error('[AiOffice] draftItem error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
};

exports.reviseItem = async (req, res) => {
    try {
        const { instruction } = req.body || {};
        const result = await aiOfficeService.reviseDraftItem({
            prisma,
            itemId: req.params.id,
            instruction,
            actor: req.user
        });
        res.json(result);
    } catch (err) {
        console.error('[AiOffice] reviseItem error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
};

exports.updateItem = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' });

        const existing = await prisma.aiOfficeItem.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Dokumen tidak ditemukan' });

        const { title, content, brief, rationale, domain, priority, status } = req.body || {};
        const allowedStatus = ['PROPOSED', 'APPROVED_FOR_DRAFT', 'DRAFT_READY', 'FINALIZED', 'REJECTED'];

        const updated = await prisma.aiOfficeItem.update({
            where: { id },
            data: {
                ...(title !== undefined ? { title: String(title).trim().slice(0, 240) } : {}),
                ...(content !== undefined ? { content: String(content) } : {}),
                ...(brief !== undefined ? { brief: brief ? String(brief) : null } : {}),
                ...(rationale !== undefined ? { rationale: rationale ? String(rationale) : null } : {}),
                ...(domain !== undefined ? { domain: domain ? String(domain).slice(0, 60) : null } : {}),
                ...(priority !== undefined ? { priority: String(priority).toUpperCase() } : {}),
                ...(status && allowedStatus.includes(status) ? { status } : {})
            }
        });

        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteItem = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' });
        await prisma.aiOfficeItem.delete({ where: { id } });
        res.json({ message: 'Dokumen Kantor AI berhasil dihapus.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.downloadItemPdf = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' });
        const item = await prisma.aiOfficeItem.findUnique({ where: { id } });
        if (!item) return res.status(404).json({ error: 'Dokumen tidak ditemukan' });

        const config = await aiOfficeService.getOrCreateConfig(prisma);
        const pdfBytes = await generateAiOfficeDocumentPDF(item, config);
        const safeName = String(item.code || `kantor-ai-${item.id}`).replace(/[^a-zA-Z0-9_-]/g, '_');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
        res.send(Buffer.from(pdfBytes));
    } catch (err) {
        console.error('[AiOffice] downloadItemPdf error:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.runDailyShift = async (req, res) => {
    try {
        const currentState = aiOfficeService.getRoutineState();
        if (currentState.isRunning) {
            return res.status(200).json({
                started: false,
                alreadyRunning: true,
                routineState: currentState,
                message: 'Shift Kantor AI sedang berjalan di latar belakang.'
            });
        }

        const { force = true } = req.body || {};
        aiOfficeService.runDailyOfficeRoutine({
            prisma,
            trigger: 'MANUAL',
            force: Boolean(force)
        }).catch((err) => {
            console.error('[AiOffice] Background runDailyShift error:', err);
        });

        res.status(202).json({
            started: true,
            alreadyRunning: false,
            routineState: aiOfficeService.getRoutineState(),
            message: 'Shift harian Kantor AI dijalankan di latar belakang. Halaman akan otomatis memperbarui hasil.'
        });
    } catch (err) {
        console.error('[AiOffice] runDailyShift error:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.runSupervisor = async (req, res) => {
    try {
        const { force = true } = req.body || {};
        const result = await aiOfficeService.runSupervisorShift({
            prisma,
            trigger: 'MANUAL',
            actor: req.user,
            force: Boolean(force)
        });
        res.json(result);
    } catch (err) {
        console.error('[AiOffice] runSupervisor error:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.runPropose = async (req, res) => {
    try {
        const { count = 2, focusTopic = '', category = 'ALL', autoDraft = true } = req.body || {};
        if (autoDraft !== false) {
            const currentState = aiOfficeService.getRoutineState();
            if (currentState.isRunning) {
                return res.status(200).json({
                    started: false,
                    alreadyRunning: true,
                    routineState: currentState,
                    message: 'Staf Kantor AI sedang memproses tugas di latar belakang.'
                });
            }

            aiOfficeService.runAutoProposeAndDraft({
                prisma,
                trigger: 'MANUAL',
                count,
                focusTopic,
                category,
                actor: req.user
            }).catch((err) => {
                console.error('[AiOffice] Background runAutoProposeAndDraft error:', err);
            });

            return res.status(202).json({
                started: true,
                alreadyRunning: false,
                routineState: aiOfficeService.getRoutineState(),
                message: 'Staf Administrasi AI langsung ACC & menyusun draft di latar belakang. Hasil akan tampil otomatis di tab Hasil SOP & Dokumen.'
            });
        }

        const result = await aiOfficeService.proposeAdminBacklog({
            prisma,
            trigger: 'MANUAL',
            count,
            focusTopic,
            category,
            actor: req.user,
            autoApprove: false
        });
        res.json(result);
    } catch (err) {
        console.error('[AiOffice] runPropose error:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.getConfig = async (req, res) => {
    try {
        const config = await aiOfficeService.getOrCreateConfig(prisma);
        res.json(config);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateConfig = async (req, res) => {
    try {
        await aiOfficeService.getOrCreateConfig(prisma);
        const {
            isEnabled,
            supervisorName,
            adminStaffName,
            dailyScheduleHour,
            dailyScheduleMinute,
            eveningScheduleHour,
            maxDailyDrafts,
            sopGeneralFormat,
            policyGuidelines
        } = req.body || {};

        const clampInt = (val, min, max, fallback) => {
            const parsed = parseInt(val, 10);
            if (Number.isNaN(parsed)) return fallback;
            return Math.min(max, Math.max(min, parsed));
        };

        const updated = await prisma.aiOfficeConfig.update({
            where: { id: 1 },
            data: {
                ...(typeof isEnabled === 'boolean' ? { isEnabled } : {}),
                ...(supervisorName && String(supervisorName).trim() ? { supervisorName: String(supervisorName).trim() } : {}),
                ...(adminStaffName && String(adminStaffName).trim() ? { adminStaffName: String(adminStaffName).trim() } : {}),
                ...(dailyScheduleHour !== undefined ? { dailyScheduleHour: clampInt(dailyScheduleHour, 0, 23, 7) } : {}),
                ...(dailyScheduleMinute !== undefined ? { dailyScheduleMinute: clampInt(dailyScheduleMinute, 0, 59, 30) } : {}),
                ...(eveningScheduleHour !== undefined ? { eveningScheduleHour: clampInt(eveningScheduleHour, 0, 23, 16) } : {}),
                ...(maxDailyDrafts !== undefined ? { maxDailyDrafts: clampInt(maxDailyDrafts, 1, 5, 2) } : {}),
                ...(sopGeneralFormat && String(sopGeneralFormat).trim() ? { sopGeneralFormat: String(sopGeneralFormat) } : {}),
                ...(policyGuidelines !== undefined ? { policyGuidelines: String(policyGuidelines) } : {})
            }
        });

        res.json(updated);
    } catch (err) {
        console.error('[AiOffice] updateConfig error:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.uploadSopFormat = async (req, res) => {
    try {
        if (!req.file?.buffer) {
            return res.status(400).json({ error: 'Silakan pilih file format SOP terlebih dahulu.' });
        }

        const { originalname, mimeType } = aiOfficeService.validateSopTemplateUpload({
            buffer: req.file.buffer,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype
        });

        const prevConfig = await aiOfficeService.getOrCreateConfig(prisma);
        const saved = await aiOfficeService.saveSopTemplateFile({
            buffer: req.file.buffer,
            originalname,
            mimetype: mimeType
        });

        const updated = await prisma.aiOfficeConfig.update({
            where: { id: 1 },
            data: {
                sopTemplateFileUrl: saved.fileUrl,
                sopTemplateFileName: saved.fileName,
                sopTemplateMimeType: saved.mimeType,
                sopTemplateUploadedAt: new Date()
            }
        });

        if (prevConfig?.sopTemplateFileUrl && prevConfig.sopTemplateFileUrl !== saved.fileUrl) {
            aiOfficeService.deleteSopTemplateFile(prevConfig.sopTemplateFileUrl).catch(() => {});
        }

        res.json({
            config: updated,
            fileUrl: saved.fileUrl,
            fileName: saved.fileName,
            mimeType: saved.mimeType,
            message: `Dokumen format "${saved.fileName}" disimpan sebagai pedoman Staf AI (tidak diekstrak ke teks).`
        });
    } catch (err) {
        console.error('[AiOffice] uploadSopFormat error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
};

exports.deleteSopFormatFile = async (req, res) => {
    try {
        const config = await aiOfficeService.getOrCreateConfig(prisma);
        if (config?.sopTemplateFileUrl) {
            await aiOfficeService.deleteSopTemplateFile(config.sopTemplateFileUrl).catch(() => {});
        }

        const updated = await prisma.aiOfficeConfig.update({
            where: { id: 1 },
            data: {
                sopTemplateFileUrl: null,
                sopTemplateFileName: null,
                sopTemplateMimeType: null,
                sopTemplateUploadedAt: null
            }
        });

        res.json({
            config: updated,
            message: 'Dokumen format SOP dihapus. Staf AI akan memakai format teks.'
        });
    } catch (err) {
        console.error('[AiOffice] deleteSopFormatFile error:', err);
        res.status(500).json({ error: err.message });
    }
};
