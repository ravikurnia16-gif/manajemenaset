const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { deleteFile } = require('../services/minioService');
const whatsappService = require('../services/whatsappService');
const { createNotification } = require('./notificationController');
const predictiveService = require('../services/predictiveService');
const crypto = require('crypto');

// --- Business Day Helpers for SLA Respon Awal ---

/**
 * Adjust a date to the next business day (Mon-Fri).
 * Saturday -> Monday, Sunday -> Monday.
 */
const adjustToBusinessDay = (date) => {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sunday, 6=Saturday
    if (day === 0) d.setDate(d.getDate() + 1); // Sunday -> Monday
    if (day === 6) d.setDate(d.getDate() + 2); // Saturday -> Monday
    return d;
};

/**
 * Calculate difference in hours between adjusted business start and response time.
 * Start date is adjusted to next business day if weekend.
 */
const calculateBusinessHoursDiff = (createdAt, respondedAt) => {
    const start = adjustToBusinessDay(createdAt);
    const end = new Date(respondedAt);
    const diffMs = Math.abs(end - start);
    return diffMs / (1000 * 60 * 60); // hours
};

// Get Dashboard Stats
exports.getDashboardStats = async (req, res) => {
    try {
        const { targetDept, month, year } = req.query; // SARPRAS or PEMBANGUNAN

        const whereClause = {};
        if (targetDept) {
            whereClause.targetDept = targetDept;
        }

        // Calculate Start and End of specific Month
        let startOfPeriod = new Date();
        if (month && year) {
            startOfPeriod = new Date(parseInt(year), parseInt(month) - 1, 1);
        } else {
            startOfPeriod.setDate(1);
        }
        startOfPeriod.setHours(0, 0, 0, 0);

        const endOfPeriod = new Date(startOfPeriod);
        endOfPeriod.setMonth(endOfPeriod.getMonth() + 1);

        // 1. Total Cost for Selected Period
        const thisMonthReports = await prisma.maintenance.findMany({
            where: {
                ...whereClause,
                status: 'COMPLETED',
                completionDate: { gte: startOfPeriod, lt: endOfPeriod }
            },
            select: { cost: true }
        });
        const totalCostThisMonth = thisMonthReports.reduce((sum, r) => sum + (r.cost || 0), 0);

        // 2. Active Reports Count
        const activeReportsCount = await prisma.maintenance.count({
            where: {
                ...whereClause,
                status: { notIn: ['COMPLETED', 'REJECTED'] }
            }
        });

        // 3. Overdue Assets Count
        const overdueAssetsCount = await prisma.asset.count({
            where: {
                nextMaintenanceEst: { lt: new Date() },
                condition: { not: 'DISPOSED' }
            }
        });

        // 4. Monthly Trend (Last 6 Months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);
        sixMonthsAgo.setHours(0, 0, 0, 0);

        const recentCompleted = await prisma.maintenance.findMany({
            where: {
                ...whereClause,
                status: 'COMPLETED',
                completionDate: { gte: sixMonthsAgo }
            },
            select: { cost: true, completionDate: true }
        });

        const monthlyTrendMap = {};
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = d.toLocaleString('id-ID', { month: 'short', year: 'numeric' });
            monthlyTrendMap[key] = { name: key, cost: 0, count: 0 };
        }

        recentCompleted.forEach(r => {
            if (r.completionDate) {
                const key = new Date(r.completionDate).toLocaleString('id-ID', { month: 'short', year: 'numeric' });
                if (monthlyTrendMap[key]) {
                    monthlyTrendMap[key].cost += (r.cost || 0);
                    monthlyTrendMap[key].count += 1;
                }
            }
        });
        const monthlyTrend = Object.values(monthlyTrendMap);

        // 5. Recent Active Reports
        const recentReports = await prisma.maintenance.findMany({
            where: {
                ...whereClause,
                status: { notIn: ['COMPLETED', 'REJECTED'] }
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: { unit: { select: { name: true } } }
        });

        // 6. SLA Performance (Sarpras Only)
        // Fetch completed Sarpras tasks in the current period
        const completedSarprasTasks = await prisma.maintenance.findMany({
            where: {
                targetDept: 'SARPRAS',
                status: 'COMPLETED',
                completionDate: { gte: startOfPeriod, lt: endOfPeriod }
            },
            select: {
                createdAt: true,
                completionDate: true,
                urgency: true
            }
        });

        const slaStats = {
            overallAvgDays: 0,
            byUrgency: {
                NORMAL: { avgDays: 0, count: 0 },
                URGENT: { avgDays: 0, count: 0 },
                EMERGENCY: { avgDays: 0, count: 0 }
            }
        };

        let totalDaysAll = 0;
        let validTasksCount = 0;

        completedSarprasTasks.forEach(task => {
            if (task.createdAt && task.completionDate) {
                const created = new Date(task.createdAt);
                const completed = new Date(task.completionDate);
                // Difference in days
                const diffTime = Math.abs(completed - created);
                const diffDays = diffTime / (1000 * 60 * 60 * 24);

                totalDaysAll += diffDays;
                validTasksCount++;

                const urgency = task.urgency || 'NORMAL';
                if (slaStats.byUrgency[urgency]) {
                    const currentUrgencyStats = slaStats.byUrgency[urgency];
                    currentUrgencyStats.avgDays = ((currentUrgencyStats.avgDays * currentUrgencyStats.count) + diffDays) / (currentUrgencyStats.count + 1);
                    currentUrgencyStats.count++;
                }
            }
        });

        if (validTasksCount > 0) {
            slaStats.overallAvgDays = totalDaysAll / validTasksCount;
        }

        // 7. Initial Response Speed (Sarpras Only)
        const respondedSarprasTasks = await prisma.maintenance.findMany({
            where: {
                targetDept: 'SARPRAS',
                firstRespondedAt: { not: null },
                createdAt: { gte: startOfPeriod, lt: endOfPeriod }
            },
            select: {
                createdAt: true,
                firstRespondedAt: true,
                urgency: true
            }
        });

        const initialResponseStats = {
            overallAvgHours: 0,
            totalResponded: 0,
            byUrgency: {
                NORMAL: { avgHours: 0, count: 0 },
                URGENT: { avgHours: 0, count: 0 },
                EMERGENCY: { avgHours: 0, count: 0 }
            }
        };

        let totalHoursAll = 0;
        let validRespondedCount = 0;

        respondedSarprasTasks.forEach(task => {
            if (task.createdAt && task.firstRespondedAt) {
                const diffHours = calculateBusinessHoursDiff(task.createdAt, task.firstRespondedAt);

                totalHoursAll += diffHours;
                validRespondedCount++;

                const urgency = task.urgency || 'NORMAL';
                if (initialResponseStats.byUrgency[urgency]) {
                    const u = initialResponseStats.byUrgency[urgency];
                    u.avgHours = ((u.avgHours * u.count) + diffHours) / (u.count + 1);
                    u.count++;
                }
            }
        });

        if (validRespondedCount > 0) {
            initialResponseStats.overallAvgHours = totalHoursAll / validRespondedCount;
        }
        initialResponseStats.totalResponded = validRespondedCount;

        res.json({
            totalCostThisMonth,
            activeReportsCount,
            overdueAssetsCount,
            monthlyTrend,
            recentReports,
            slaStats,
            initialResponseStats
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

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

// Get all maintenance reports with pagination
exports.getAllReports = async (req, res) => {
    const { status, type, unitId, category, targetDept, search, page = 1, limit = 10, startDate, endDate } = req.query;
    const user = req.user;

    try {
        const whereClause = {};
        if (status) whereClause.status = status;
        if (type) whereClause.type = type;
        if (category) whereClause.category = category;
        if (targetDept) whereClause.targetDept = targetDept;
        if (unitId) whereClause.unitId = parseInt(unitId);

        // Date Range Filter
        if (startDate || endDate) {
            whereClause.createdAt = {};
            if (startDate) whereClause.createdAt.gte = new Date(startDate);
            if (endDate) {
                // Set to end of day
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                whereClause.createdAt.lte = end;
            }
        }

        if (search) {
            whereClause.OR = [
                { title: { contains: search } },
                { code: { contains: search } },
                { description: { contains: search } },
                { user: { name: { contains: search } } },
                { assets: { some: { name: { contains: search } } } },
                { assets: { some: { code: { contains: search } } } }
            ];
        }

        // Non-admin users only see their own unit
        if (['ADMIN_UNIT', 'USER'].includes(user.role)) {
            const isPembangunanTeam = ['Kepala Bidang Pembangunan', 'Staff Pembangunan'].includes(user.position);

            if (isPembangunanTeam) {
                const basePembangunanCondition = { targetDept: 'PEMBANGUNAN' };
                const baseUnitCondition = { unitId: user.unitId };

                if (whereClause.OR) {
                    // Combine search OR with role-based OR
                    const searchOR = whereClause.OR;
                    delete whereClause.OR;
                    whereClause.AND = [
                        { OR: searchOR },
                        { OR: [basePembangunanCondition, baseUnitCondition] }
                    ];
                } else {
                    whereClause.OR = [basePembangunanCondition, baseUnitCondition];
                }
                delete whereClause.unitId;
            } else {
                whereClause.unitId = user.unitId;
            }
        }

        // Pagination setup
        const isAll = limit === 'all' || limit === '-1';
        const take = isAll ? undefined : parseInt(limit);
        const skip = isAll ? undefined : (parseInt(page) - 1) * take;

        const [reports, total] = await Promise.all([
            prisma.maintenance.findMany({
                where: whereClause,
                include: {
                    user: { select: { username: true, name: true } },
                    unit: { select: { name: true } },
                    assets: { select: { code: true, name: true } }
                },
                orderBy: { createdAt: 'desc' },
                take,
                skip
            }),
            prisma.maintenance.count({ where: whereClause })
        ]);

        res.json({
            data: reports,
            meta: {
                total,
                page: isAll ? 1 : parseInt(page),
                limit: isAll ? total : take,
                totalPages: isAll ? 1 : Math.ceil(total / take)
            }
        });
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
                assets: { select: { id: true, code: true, name: true, specification: true, condition: true } },
                workshopOrders: { select: { id: true, code: true, title: true, status: true, workshopType: true } },
                progress: { include: { user: { select: { name: true, username: true, role: true } } }, orderBy: { createdAt: 'asc' } }
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

        const isDirect = (req.body.isDirectOrder === 'true' || req.body.isDirectOrder === true) && user.role === 'SUPER_ADMIN';
        let initialStatus = 'SUBMITTED';
        let technician = null;
        let quickToken = null;

        // Auto-assign for Direct Orders (Penugasan Internal)
        if (isDirect) {
            initialStatus = 'ASSIGNED';
            technician = req.body.technicianName || null;
            
            // Fallback if no technician selected
            if (!technician) {
                const staffAset = await prisma.user.findFirst({
                    where: { position: 'Staff Manajemen Aset' }
                });
                if (staffAset) {
                    technician = staffAset.name || staffAset.username;
                }
            }
            quickToken = crypto.randomBytes(16).toString('hex');
        }

        let finalUnitId = user.unitId;
        if (!finalUnitId) {
            let fallbackUnit = await prisma.unit.findFirst({
                where: { name: { contains: 'Kantor Yayasan' } }
            });
            if (!fallbackUnit) {
                fallbackUnit = await prisma.unit.findFirst({
                    where: { name: { contains: 'Yayasan' } }
                });
            }
            if (!fallbackUnit) {
                fallbackUnit = await prisma.unit.findFirst();
            }
            finalUnitId = fallbackUnit ? fallbackUnit.id : null;
        }

        if (!finalUnitId) {
            return res.status(400).json({ error: 'Gagal membuat laporan: User tidak memiliki Unit dan tidak ada Unit default di sistem.' });
        }

        const report = await prisma.maintenance.create({
            data: {
                code,
                userId: user.id,
                unitId: finalUnitId,
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

                const inAppRoles = [
                    { position: { contains: 'Kepala Bidang Sarana' } },
                    { position: { contains: 'Staff Manajemen Aset' } }
                ];

                const notifRecipients = await prisma.user.findMany({
                    where: {
                        OR: inAppRoles
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
                    const msgSubmitter = `Bismillah.\n*Info Laporan Pemeliharaan*\n\n` +
                        `Ustadz/Ustadzah *${submitter.name || submitter.username}*, laporan pemeliharaan Anda telah kami terima.\n\n` +
                        `\u{1F4CB} *Judul* : ${isDirect ? `[INSTRUKSI KABID] ${title}` : title}\n` +
                        `\u{1F4C4} *Kode* : ${code}\n` +
                        `\u{1F527} *Tipe* : ${type === 'ASSET' ? 'Aset Terdata' : 'Non-Aset / Umum'}\n` +
                        `${isDirect ? `*Status* : Langsung Ditugaskan (Pimpinan) \u2705\n\n` : `\n`}` +
                        `Mohon menunggu proses pengerjaan.`;

                    await whatsappService.sendMessage(submitter.phone, msgSubmitter);
                }

                // 2. WhatsApp Notification
                const waRoles = [
                    { position: { contains: 'Kepala Bidang Sarana' } },
                    { position: { contains: 'Staff Manajemen Aset' } }
                ];

                const waRecipients = await prisma.user.findMany({
                    where: {
                        OR: waRoles,
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

                    const msgAdmin = `Bismillah.\n${targetDept === 'PEMBANGUNAN' ? '🏗️ *LAPORAN PEMBANGUNAN BARU*' : (isDirect ? `👑 *INSTRUKSI LANGSUNG KABID*` : `🔧 *LAPORAN PEMELIHARAAN BARU*`)}\n\n` +
                        `👤 *Pelapor* : ${submitter?.name || submitter?.username || '-'}\n` +
                        `📞 *Kontak* : wa.me/${submitter?.phone?.replace(/^0/, '62') || '-'}\n` +
                        `⚡ *Urgensi* : ${isDirect ? 'PENGERJAAN PRIORITAS' : (urgencyLabels[report.urgency] || report.urgency)}\n` +
                        `📂 *Bidang* : ${targetDept === 'PEMBANGUNAN' ? 'Pembangunan' : 'Sarana & Prasarana'}\n` +
                        `📂 *Kategori* : ${report.category === 'ROUTINE' ? 'Pemeliharaan Rutin' : 'Pemeliharaan Insidentil'}\n` +
                        `📜 *Kode* : ${code}\n` +
                        `📋 *Judul* : ${title}\n` +
                        `📝 *Masalah* : ${description}\n\n` +
                        (targetDept !== 'PEMBANGUNAN' ? `📦 *Aset Terkait* :\n${assetListStr}\n\n` : '') +
                        `${isDirect ? `*Status*: Otomatis Ditugaskan ke ${report.technician || 'Teknisi'}.` : `Mohon segera ditindaklanjuti.`}\n\n` +
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
                        where: { OR: [{ name: report.technician }, { username: report.technician }] }
                    });

                    if (techUser && techUser.phone) {
                        const msgTech = `Bismillah.\n🛠 *PENUGASAN INTERNAL BARU*\n\n` +
                            `Halo *${techUser.name || techUser.username}*,\n` +
                            `Anda mendapatkan instruksi penugasan untuk: *${title}*.\n\n` +
                            `📜 *Kode* : ${code}\n` +
                            `👤 *Pemberi Tugas* : Admin (Penugasan Internal)\n` +
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

// Add Media
exports.addMedia = async (req, res) => {
    const { id } = req.params;
    const user = req.user;

    try {
        const report = await prisma.maintenance.findUnique({ where: { id: parseInt(id) } });
        if (!report) return res.status(404).json({ error: 'Laporan tidak ditemukan' });

        const isAdmin = ['SUPER_ADMIN', 'BIDANG_IT', 'ADMIN_ASET', 'KEPALA_BIDANG'].includes(user.role);
        if (report.userId !== user.id && !isAdmin) {
            return res.status(403).json({ error: 'Anda tidak diizinkan menambahkan dokumentasi ke laporan ini.' });
        }

        const newMedia = req.uploadedMedia || [];
        if (newMedia.length === 0) {
            return res.status(400).json({ error: 'Tidak ada media yang diunggah.' });
        }
        const { isReceipt, isCompletion } = req.query;
        const taggedMedia = newMedia.map(m => ({ 
            ...m, 
            isReceipt: isReceipt === 'true',
            isCompletion: isCompletion === 'true'
        }));

        let mergedMedia = [];
        const existingMedia = report.media;
        if (Array.isArray(existingMedia)) {
            mergedMedia = [...existingMedia, ...taggedMedia];
        } else {
            mergedMedia = [...taggedMedia];
        }

        const updatedReport = await prisma.maintenance.update({
            where: { id: parseInt(id) },
            data: {
                media: mergedMedia,
                photo: report.photo ? report.photo : newMedia.find(m => m.type === 'IMAGE')?.url || null
            }
        });

        res.json({ message: 'Dokumentasi tambahan berhasil disimpan.', data: updatedReport });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update Status (Workflow Transitions)
exports.updateStatus = async (req, res) => {
    const { id } = req.params;
    const { status, approvalNote, validationNote, rejectionReason, technician, technicianPhone, actionTaken, completionNote, cost, costDetails } = req.body;

    try {
        const oldReport = await prisma.maintenance.findUnique({ where: { id: parseInt(id) } });
        if (!oldReport) return res.status(404).json({ error: 'Laporan tidak ditemukan' });

        const updateData = { status };
        if (approvalNote) updateData.approvalNote = approvalNote;
        if (validationNote) updateData.validationNote = validationNote;
        if (rejectionReason) updateData.rejectionReason = rejectionReason;
        if (technician) updateData.technician = technician;
        if (actionTaken) updateData.actionTaken = actionTaken;
        if (completionNote) updateData.completionNote = completionNote;
        if (cost !== undefined) updateData.cost = parseFloat(cost);
        if (costDetails !== undefined) updateData.costDetails = costDetails; // Add this line
        if (status === 'COMPLETED') {
            updateData.completionDate = new Date();
            updateData.quickToken = null; // Clear token after use
        }

        // Record first response time (for SLA Respon Awal)
        if (oldReport.status === 'SUBMITTED' && status !== 'SUBMITTED' && !oldReport.firstRespondedAt) {
            updateData.firstRespondedAt = new Date();
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
        const statusDidUnchange = oldReport.status === status; // New logic for detail updates

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
                let techUser = null;
                if (status === 'ASSIGNED' && technician) {
                    try {
                        techUser = await prisma.user.findFirst({
                            where: { OR: [{ name: technician }, { username: technician }] }
                        });

                        const actualTechPhone = techUser?.phone || technicianPhone;

                        if (actualTechPhone) {
                            const isExternal = !techUser;
                            const baseUrl = process.env.BASE_URL || 'https://sarpras.dareliman.or.id';
                            const maintenanceUrl = `${baseUrl}/pemeliharaan/${report.id}`;

                            // Build photo URLs for external technician
                            let externalExtra = '';
                            if (isExternal) {
                                const formatMediaUrl = (url) => {
                                    if (!url) return '';
                                    if (url.startsWith('http://') || url.startsWith('https://')) return url;
                                    return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
                                };

                                const photoUrls = [];
                                if (report.photo) photoUrls.push(formatMediaUrl(report.photo));
                                if (Array.isArray(report.media)) {
                                    report.media.forEach(m => {
                                        if (m.type === 'IMAGE' && m.url) {
                                            const fullUrl = formatMediaUrl(m.url);
                                            if (!photoUrls.includes(fullUrl)) photoUrls.push(fullUrl);
                                        }
                                    });
                                }

                                externalExtra += `📍 *Lokasi* : ${report.location || '-'}\n`;
                                externalExtra += `🏢 *Unit* : ${report.unit?.name || '-'}\n`;
                                if (photoUrls.length > 0) {
                                    externalExtra += `\n🖼️ *Foto Laporan* :\n`;
                                    photoUrls.forEach((url, i) => {
                                        externalExtra += `${i + 1}. ${url}\n`;
                                    });
                                }
                                externalExtra += '\n';
                            }

                            const msgTech = `Bismillah.\n🛠 *PENUGASAN PEMELIHARAAN*\n\n` +
                                `Halo *${techUser?.name || techUser?.username || technician}*,\n` +
                                `Anda ditugaskan untuk memperbaiki: *${report.title}*.\n\n` +
                                `📜 *Kode* : ${report.code}\n` +
                                `📋 *Judul* : ${report.title}\n` +
                                `📝 *Masalah* : ${report.description}\n\n` +
                                (isExternal ? externalExtra : `🚀 *MULAI PENGERJAAN*:\n${maintenanceUrl}\n\n`) +
                                `Syukron jazakumullahu khairan.`;

                            setTimeout(async () => {
                                await whatsappService.sendMessage(actualTechPhone, msgTech);
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
                let msg = `Bismillah.\n*Info Laporan Pemeliharaan*\n\n` +
                    `Ustadz/Ustadzah *${submitter.name || submitter.username}*,\n\n` +
                    `Laporan Anda *\"${report.title}\"* (${report.code})\n` +
                    `Status terbaru: *${statusLabel}*\n`;

                const selectedTechPhone = techUser?.phone || technicianPhone;
                if (status === 'ASSIGNED' && selectedTechPhone) {
                    const techPhoneFormatted = selectedTechPhone.replace(/^0/, '62');
                    msg += `\n📞 *Kontak Petugas* : wa.me/${techPhoneFormatted}\n`;
                }

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
            include: {
                assets: true,
                user: { select: { name: true, phone: true, username: true } }
            }
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

        // --- Notifications (Async) ---
        (async () => {
            try {
                // 1. In-App Notification to Pelapor
                if (report.userId) {
                    await createNotification(
                        report.userId,
                        'Pemeliharaan Selesai',
                        `Laporan "${report.title}" telah diselesaikan via Quick Link.`,
                        'SUCCESS',
                        `/pemeliharaan/${report.id}`
                    );
                }

                // 2. WhatsApp Notification to Pelapor
                if (report.user?.phone) {
                    const msg = `Bismillah.\n*Info Laporan Pemeliharaan*\n\n` +
                        `Ustadz/Ustadzah *${report.user.name || report.user.username}*,\n\n` +
                        `Laporan Anda *"${report.title}"* (${report.code})\n` +
                        `Status terbaru: *Selesai ✅✅✅*\n\n` +
                        `*Tindakan:* ${actionTaken || 'Dikerjakan via Quick Link'}\n\n` +
                        `Syukron jazakumullahu khairan.`;

                    setTimeout(async () => {
                        try {
                            await whatsappService.sendMessage(report.user.phone, msg);
                        } catch (e) {
                            console.error('[WA] QuickComplete notif error:', e);
                        }
                    }, 5000); // 5s delay for quick link
                }
            } catch (err) {
                console.error('QuickComplete Notification Error:', err);
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

exports.getMaintenanceSchedule = async (req, res) => {
    try {
        const { search, unitId, category } = req.query;

        const whereClause = {
            nextMaintenanceEst: { not: null },
            needsRoutineMaintenance: true,
            condition: { not: 'DISPOSED' }
        };

        if (unitId) whereClause.unitId = parseInt(unitId);
        if (category) whereClause.category = category;
        if (search) {
            whereClause.OR = [
                { name: { contains: search } },
                { code: { contains: search } }
            ];
        }

        const assets = await prisma.asset.findMany({
            where: whereClause,
            include: {
                unit: { select: { name: true } },
                maintenances: {
                    where: { status: { notIn: ['COMPLETED', 'REJECTED'] } },
                    take: 1,
                    orderBy: { createdAt: 'desc' }
                }
            },
            orderBy: { nextMaintenanceEst: 'asc' }
        });

        const schedule = assets.map(asset => {
            const today = new Date();
            const estDate = new Date(asset.nextMaintenanceEst);
            const diffDays = Math.ceil((estDate - today) / (1000 * 60 * 60 * 24));

            let status = 'OK';
            if (diffDays < 0) status = 'OVERDUE';
            else if (diffDays <= 30) status = 'SOON';

            return {
                ...asset,
                serviceStatus: status,
                daysToService: diffDays,
                hasActiveReport: asset.maintenances.length > 0
            };
        });

        res.json(schedule);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Scheduled Task: Send daily reminders for overdue/soon routine maintenance
 * to Kepala Bidang Sarana via WhatsApp.
 */
exports.checkAssetMaintenanceReminders = async () => {
    try {
        console.log('[Scheduler] Checking Asset Maintenance Reminders...');

        // 1. Get Overdue/Soon Assets (only marked routine)
        const assets = await prisma.asset.findMany({
            where: {
                nextMaintenanceEst: { lte: new Date(new Date().setDate(new Date().getDate() + 7)) },
                needsRoutineMaintenance: true,
                condition: { not: 'DISPOSED' }
            },
            include: {
                unit: { select: { name: true } },
                maintenances: {
                    where: { status: { notIn: ['COMPLETED', 'REJECTED'] } },
                    take: 1
                }
            }
        });

        // Filter out those with active reports
        const dueAssets = assets.filter(a => a.maintenances.length === 0);
        if (dueAssets.length === 0) return;

        const overdue = dueAssets.filter(a => new Date(a.nextMaintenanceEst) < new Date());
        const soon = dueAssets.filter(a => new Date(a.nextMaintenanceEst) >= new Date());

        if (overdue.length === 0 && soon.length === 0) return;

        // 2. Prepare Message
        let msg = `Bismillah.\n🔧 *PENGINGAT PEMELIHARAAN RUTIN*\n\n` +
            `Halo Tim Manajemen Aset, berikut adalah ringkasan aset yang membutuhkan pemeliharaan:\n\n`;

        if (overdue.length > 0) {
            msg += `🔴 *OVERDUE (Terlewat)*:\n`;
            overdue.slice(0, 10).forEach(a => {
                msg += `- ${a.name} (${a.unit?.name || 'Umum'})\n`;
            });
            if (overdue.length > 10) msg += `- ...dan ${overdue.length - 10} aset lainnya\n`;
            msg += `\n`;
        }

        if (soon.length > 0) {
            msg += `🟡 *SOON (7 Hari Ke Depan)*:\n`;
            soon.slice(0, 10).forEach(a => {
                msg += `- ${a.name} (${a.unit?.name || 'Umum'})\n`;
            });
            if (soon.length > 10) msg += `- ...dan ${soon.length - 10} aset lainnya\n`;
            msg += `\n`;
        }

        msg += `Silakan cek detail dan proses di menu *Jadwal Servis* pada aplikasi.\n\n` +
            `_Sistem Manajemen Aset_`;

        // 3. Find Recipients (Kepala Bidang Sarana & Staff Manajemen Aset)
        const recipients = await prisma.user.findMany({
            where: {
                OR: [
                    { position: { contains: 'Kepala Bidang Sarana' } },
                    { position: { contains: 'Staff Manajemen Aset' } }
                ],
                phone: { not: null, not: '' }
            }
        });

        // 4. Send WA
        for (const user of recipients) {
            try {
                await whatsappService.sendMessage(user.phone, msg);
                console.log(`[Scheduler] Maintenance reminder sent to ${user.name} (${user.phone})`);
            } catch (e) {
                console.error(`[Scheduler] Failed to send WA to ${user.phone}:`, e.message);
            }
        }

    } catch (error) {
        console.error('[Scheduler] checkAssetMaintenanceReminders Error:', error);
    }
};

/**
 * Scheduled Task: Send daily notification at 08:30 WIB for Sarpras reports
 * that have been in SUBMITTED status for more than 48 hours (calendar hours
 * from business-day-adjusted createdAt).
 * Recipients: Kepala Bidang Sarana (WhatsApp + In-App Notification)
 */
exports.checkUnrespondedReports = async () => {
    try {
        console.log('[Scheduler] Checking Unresponded Sarpras Reports (>48h)...');

        const now = new Date();
        const threshold48h = new Date(now.getTime() - (48 * 60 * 60 * 1000)); // 48 hours ago

        // Find all SUBMITTED Sarpras reports
        const submittedReports = await prisma.maintenance.findMany({
            where: {
                targetDept: 'SARPRAS',
                status: 'SUBMITTED',
                createdAt: { lt: threshold48h }
            },
            include: {
                user: { select: { name: true, username: true } },
                unit: { select: { name: true } }
            },
            orderBy: { createdAt: 'asc' }
        });

        // Filter: only include reports whose business-day-adjusted createdAt is >48h
        const overdueReports = submittedReports.filter(report => {
            const adjustedCreated = adjustToBusinessDay(report.createdAt);
            const diffHours = (now - adjustedCreated) / (1000 * 60 * 60);
            return diffHours > 48;
        });

        if (overdueReports.length === 0) {
            console.log('[Scheduler] No unresponded Sarpras reports >48h. Skipping.');
            return;
        }

        console.log(`[Scheduler] Found ${overdueReports.length} unresponded Sarpras report(s) >48h.`);

        // Prepare WhatsApp Message
        let msg = `Bismillah.\n⚠️ *LAPORAN SARPRAS BELUM DIRESPON (>48 Jam)*\n\n` +
            `Berikut adalah ${overdueReports.length} laporan pemeliharaan Sarpras yang belum direspon lebih dari 48 jam:\n\n`;

        overdueReports.slice(0, 15).forEach((report, i) => {
            const adjustedCreated = adjustToBusinessDay(report.createdAt);
            const hoursAgo = Math.round((now - adjustedCreated) / (1000 * 60 * 60));
            const pelapor = report.user?.name || report.user?.username || '-';
            msg += `${i + 1}. *${report.title}* (${report.code})\n`;
            msg += `   📍 ${report.unit?.name || 'Umum'} | 👤 ${pelapor}\n`;
            msg += `   ⏱️ Sudah ${hoursAgo} jam belum direspon\n\n`;
        });

        if (overdueReports.length > 15) {
            msg += `...dan ${overdueReports.length - 15} laporan lainnya.\n\n`;
        }

        msg += `Mohon segera ditindaklanjuti.\n\n` +
            `_Sistem Manajemen Aset_`;

        // Find Recipients (Kepala Bidang Sarana & Staff Manajemen Aset)
        const recipients = await prisma.user.findMany({
            where: {
                OR: [
                    { position: { contains: 'Kepala Bidang Sarana' } },
                    { position: { contains: 'Staff Manajemen Aset' } }
                ],
                phone: { not: null, not: '' }
            }
        });

        // Send WhatsApp
        for (const user of recipients) {
            try {
                await whatsappService.sendMessage(user.phone, msg);
                console.log(`[Scheduler] Unresponded report summary sent to ${user.name} (${user.phone})`);
            } catch (e) {
                console.error(`[Scheduler] Failed to send WA to ${user.phone}:`, e.message);
            }
        }

        // Send In-App Notification to Kepala Bidang Sarana & Staff Manajemen Aset
        const allKabidSarana = await prisma.user.findMany({
            where: {
                OR: [
                    { position: { contains: 'Kepala Bidang Sarana' } },
                    { position: { contains: 'Staff Manajemen Aset' } }
                ]
            }
        });

        for (const kabid of allKabidSarana) {
            try {
                await createNotification(
                    kabid.id,
                    '⚠️ Laporan Belum Direspon >48 Jam',
                    `Ada ${overdueReports.length} laporan pemeliharaan Sarpras yang belum direspon lebih dari 48 jam. Mohon segera ditindaklanjuti.`,
                    'WARNING',
                    '/pemeliharaan'
                );
            } catch (e) {
                console.error(`[Scheduler] In-app notif error for ${kabid.username}:`, e.message);
            }
        }

    } catch (error) {
        console.error('[Scheduler] checkUnrespondedReports Error:', error);
    }
};
// Complete a single asset in a maintenance report
exports.completeAssetMaintenance = async (req, res) => {
    const { id, assetId } = req.params;
    
    try {
        const report = await prisma.maintenance.findUnique({
            where: { id: parseInt(id) },
            include: { assets: true }
        });

        if (!report) return res.status(404).json({ error: 'Laporan tidak ditemukan' });
        
        // Ensure the asset belongs to this report
        const isAssetInReport = report.assets.some(a => a.id === parseInt(assetId));
        if (!isAssetInReport) {
            return res.status(400).json({ error: 'Aset tidak terkait dengan laporan ini' });
        }

        // We use aiDiagnosis field to store generic metadata since it's unused now
        let metadata = report.aiDiagnosis || {};
        if (typeof metadata !== 'object' || Array.isArray(metadata)) {
            metadata = {};
        }

        const completedIds = metadata.completedAssets || [];
        
        if (completedIds.includes(parseInt(assetId))) {
            return res.status(400).json({ error: 'Aset ini sudah ditandai selesai' });
        }

        completedIds.push(parseInt(assetId));
        metadata.completedAssets = completedIds;

        await prisma.maintenance.update({
            where: { id: parseInt(id) },
            data: { aiDiagnosis: metadata }
        });

        // Trigger predictive maintenance for this specific asset
        try {
            await predictiveService.predictNextMaintenance(parseInt(assetId));
            console.log(`[Predictive] Updated prediction for Asset ID: ${assetId} (Partial Completion)`);
        } catch (err) {
            console.error(`[Predictive] Error for Asset ${assetId}:`, err);
        }

        res.json({ message: 'Aset berhasil ditandai selesai', completedAssets: completedIds });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Add Progress (Chat)
exports.addProgress = async (req, res) => {
    const { id } = req.params;
    const { message } = req.body;
    const user = req.user;

    try {
        const report = await prisma.maintenance.findUnique({
            where: { id: parseInt(id) },
            include: {
                user: { select: { id: true, name: true, username: true, phone: true } }
            }
        });

        if (!report) return res.status(404).json({ error: 'Laporan tidak ditemukan' });
        if (!message || message.trim() === '') return res.status(400).json({ error: 'Pesan tidak boleh kosong' });

        const progress = await prisma.maintenanceProgress.create({
            data: {
                maintenanceId: parseInt(id),
                userId: user.id,
                message: message.trim()
            },
            include: {
                user: { select: { name: true, username: true, role: true } }
            }
        });

        // Notifications
        const isUserReporter = report.userId === user.id;
        const senderName = progress.user?.name || progress.user?.username || 'Seseorang';
        const baseUrl = process.env.BASE_URL || 'https://sarpras.dareliman.or.id';
        const maintenanceUrl = `${baseUrl}/pemeliharaan/${id}`;
        const notifMsg = `[Chat Baru] ${senderName} membalas di laporan "${report.title}": "${message}"`;

        // --- MENTION LOGIC ---
        const mentionedUsernames = [...new Set(message.match(/@([a-zA-Z0-9_.-]+)/g)?.map(m => m.slice(1)) || [])];
        const mentionedUsers = mentionedUsernames.length > 0 
            ? await prisma.user.findMany({ where: { username: { in: mentionedUsernames } } }) 
            : [];
        const mentionedUserIds = mentionedUsers.map(u => u.id);

        for (const mUser of mentionedUsers) {
            if (mUser.id === user.id) continue; // Don't notify self
            await createNotification(mUser.id, 'Anda Di-mention (Pemeliharaan)', notifMsg, 'INFO', `/pemeliharaan/${id}`);
            if (mUser.phone) {
                const waMsg = `Bismillah.\n💬 *ANDA DI-MENTION (PEMELIHARAAN)*\n\n` +
                    `*${senderName}* menyebut Anda pada laporan *${report.code}*:\n` +
                    `"${message}"\n\n` +
                    `Cek selengkapnya: ${maintenanceUrl}`;
                whatsappService.sendMessage(mUser.phone, waMsg).catch(e => console.error(e));
            }
        }

        if (isUserReporter) {
            // Find the last admin/technician who sent a message in this report
            const lastAdminMessage = await prisma.maintenanceProgress.findFirst({
                where: { 
                    maintenanceId: parseInt(id),
                    userId: { not: user.id }
                },
                orderBy: { createdAt: 'desc' },
                include: { user: true }
            });

            let notifRecipients = [];

            if (lastAdminMessage && lastAdminMessage.user) {
                // If there's a previous admin who chatted, notify only them
                notifRecipients.push(lastAdminMessage.user);
            } else {
                // Fallback to all admins if no admin has chatted yet
                const waRoles = [
                    { position: { contains: 'Kepala Bidang Sarana' } },
                    { position: { contains: 'Staff Manajemen Aset' } }
                ];
                notifRecipients = await prisma.user.findMany({
                    where: { OR: waRoles }
                });
            }

            for (const admin of notifRecipients) {
                if (mentionedUserIds.includes(admin.id)) continue;
                // In-App Notif
                await createNotification(
                    admin.id,
                    'Pesan Baru',
                    notifMsg,
                    'INFO',
                    `/pemeliharaan/${id}`
                );
                
                // WA Notif
                if (admin.phone) {
                    const waMsg = `Bismillah.\n💬 *PESAN BARU (PEMELIHARAAN)*\n\n` +
                        `Pelapor *${senderName}* membalas pada laporan *${report.code}*:\n` +
                        `"${message}"\n\n` +
                        `Cek selengkapnya: ${maintenanceUrl}`;
                    whatsappService.sendMessage(admin.phone, waMsg).catch(e => console.error(e));
                }
            }
            // Also notify technician if assigned and has phone
            if (report.status === 'ASSIGNED' || report.status === 'IN_PROGRESS') {
                if (report.technician) {
                    const techUser = await prisma.user.findFirst({
                        where: { OR: [{ name: report.technician }, { username: report.technician }] }
                    });
                    
                    if (techUser && !mentionedUserIds.includes(techUser.id)) {
                        const isAlreadyNotified = notifRecipients.some(r => r.id === techUser.id);
                        
                        if (techUser.phone && !isAlreadyNotified) {
                            const waMsg = `Bismillah.\n💬 *PESAN BARU (PEMELIHARAAN)*\n\n` +
                            `Pelapor *${senderName}* membalas pada tugas Anda *${report.code}*:\n` +
                            `"${message}"\n\n` +
                            `Cek selengkapnya: ${maintenanceUrl}`;
                            whatsappService.sendMessage(techUser.phone, waMsg).catch(e => console.error(e));
                        }
                    }
                }
            }

        } else {
            // Admin or technician is sending the message, notify the reporter
            if (!mentionedUserIds.includes(report.userId)) {
                await createNotification(
                    report.userId,
                    'Pesan Baru',
                    notifMsg,
                    'INFO',
                    `/pemeliharaan/${id}`
                );

                if (report.user?.phone) {
                    const waMsg = `Bismillah.\n💬 *PESAN BARU (PEMELIHARAAN)*\n\n` +
                        `Admin/Teknisi *${senderName}* membalas laporan Anda *${report.code}*:\n` +
                        `"${message}"\n\n` +
                        `Cek selengkapnya: ${maintenanceUrl}`;
                    whatsappService.sendMessage(report.user.phone, waMsg).catch(e => console.error(e));
                }
            }
        }

        res.json({ message: 'Pesan berhasil dikirim', data: progress });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
