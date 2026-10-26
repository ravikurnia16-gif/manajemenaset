const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const whatsappService = require('../services/whatsappService');
const { uploadFile } = require('../services/minioService');
const aiService = require('../services/aiService');
const { createNotification } = require('./notificationController');
const { isHolidayOrWeekend, getNationalHoliday } = require('../utils/holidayHelper');
const localData = require('../services/localDataStorage');

dayjs.extend(utc);
dayjs.extend(timezone);

const SARPRAS_KEYWORDS = [
    'manajemen aset',
    'staff manajemen aset',
    'admin aset',
    'gudang dan logistik',
    'gudang',
    'kendaraan',
    'teknisi aset',
    'teknisi',
    'keuangan dan administrasi',
    'infrastruktur it',
    'desainer',
    'staff it'
];

// Filter for staff users: Role ADMIN_ASET or position matches Sarpras keywords (Exclude Kabid, Admin Unit, and non-asset roles)
const STAFF_USER_WHERE = {
    OR: [
        { role: 'ADMIN_ASET' },
        ...SARPRAS_KEYWORDS.map(kw => ({ position: { contains: kw } }))
    ],
    NOT: [
        { role: 'KABID_SARPRAS' },
        { position: { contains: 'Kepala Bidang' } }
    ]
};

/**
 * Helper to check if a user is Kepala Bidang Sarana (Reviewer / Full Access)
 */
const isKabid = (user) => {
    if (!user) return false;
    const role = user.role || '';
    const pos = (user.position || '').toLowerCase();
    return role === 'KABID_SARPRAS' || role === 'SUPER_ADMIN' || role === 'ADMIN_ASET' || role === 'BIDANG_IT' || role === 'KEPALA_BIDANG' || pos.includes('kepala bidang sarana') || pos.includes('kabid sarpras');
};

/**
 * Helper to get the last N working days (Monday - Friday) starting from fromDate.
 * Excludes Saturday (6), Sunday (0), and National Holidays.
 */
const getLastWorkingDays = (count = 2, fromDate = dayjs().tz('Asia/Jakarta')) => {
    const workingDays = [];
    let curr = fromDate.clone();
    
    while (workingDays.length < count) {
        const dayOfWeek = curr.day(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        const isNatHoliday = !!getNationalHoliday(curr);
        if (dayOfWeek >= 1 && dayOfWeek <= 5 && !isNatHoliday) {
            workingDays.push(curr.clone());
        }
        curr = curr.subtract(1, 'day');
    }
    return workingDays;
};

/**
 * Helper to check if a report has submitted items (PPP items or legacy manual points)
 */
const isReportSubmitted = (rep) => {
    if (!rep || !rep.metadata) return false;
    const meta = rep.metadata;

    // 1. Check unified PPP items
    const c = Array.isArray(meta.completedItems) ? meta.completedItems : [];
    const ip = Array.isArray(meta.inProgressItems) ? meta.inProgressItems : [];
    const obs = Array.isArray(meta.obstacleItems) ? meta.obstacleItems : [];
    const tp = Array.isArray(meta.tomorrowPlans) ? meta.tomorrowPlans : [];

    const hasPppContent = c.some(p => p && ((p.title && p.title.trim()) || (p.text && p.text.trim()) || (p.photos && p.photos.length > 0)))
        || ip.some(p => p && ((p.title && p.title.trim()) || (p.text && p.text.trim()) || (p.photos && p.photos.length > 0)))
        || obs.some(p => p && ((p.title && p.title.trim()) || (p.obstacleNote && p.obstacleNote.trim()) || (p.photos && p.photos.length > 0)))
        || tp.some(p => p && ((p.title && p.title.trim()) || (p.text && p.text.trim())));

    if (hasPppContent) return true;

    // 2. Fallback to legacy manualPoints
    if (meta.manualPoints) {
        const pts = meta.manualPoints;
        const m = pts.morning || pts.morningPoints || [];
        const a = pts.afternoon || pts.afternoonPoints || [];
        const hasM = Array.isArray(m) && m.some(p => p && ((typeof p === 'string' && p.trim()) || (p.text && p.text.trim()) || (p.photos && p.photos.length > 0)));
        const hasA = Array.isArray(a) && a.some(p => p && ((typeof p === 'string' && p.trim()) || (p.text && p.text.trim()) || (p.photos && p.photos.length > 0)));
        return hasM || hasA;
    }
    return false;
};

/**
 * GET /api/laporan
 * Fetch daily reports.
 * - Kabid Sarpras: can view all staff reports.
 * - Admin Aset: can ONLY view their own report.
 */
exports.getReports = async (req, res) => {
    try {
        const { date, startDate, endDate, category, search, status, staffId } = req.query;
        
        let gteDate, lteDate;
        const isMultiDay = Boolean(startDate || endDate);

        if (isMultiDay) {
            gteDate = startDate 
                ? dayjs.tz(startDate, 'Asia/Jakarta').startOf('day').toDate() 
                : dayjs().tz('Asia/Jakarta').subtract(6, 'day').startOf('day').toDate();
            lteDate = endDate 
                ? dayjs.tz(endDate, 'Asia/Jakarta').endOf('day').toDate() 
                : dayjs().tz('Asia/Jakarta').endOf('day').toDate();
        } else {
            let targetDate = dayjs().tz('Asia/Jakarta');
            if (date) {
                targetDate = dayjs.tz(date, 'Asia/Jakarta');
            }
            gteDate = targetDate.startOf('day').toDate();
            lteDate = targetDate.endOf('day').toDate();
        }

        const isUserKabid = isKabid(req.user);
        const reqUserId = parseInt(req.user.id, 10);
        
        let whereClause = {
            type: 'DAILY',
            NOT: { content: 'SETORAN_HAFALAN' },
            date: {
                gte: gteDate,
                lte: lteDate
            }
        };

        if (staffId && staffId !== 'ALL') {
            whereClause.userId = parseInt(staffId, 10);
        }

        // Strict RBAC: Non-Kabid can ONLY see their own report (any role)
        if (!isUserKabid) {
            whereClause.userId = reqUserId;
        } else if (!whereClause.userId) {
            whereClause.OR = [
                { user: STAFF_USER_WHERE },
                { userId: reqUserId }
            ];
        }

        const rawReports = await prisma.personnelReport.findMany({
            where: whereClause,
            include: {
                user: {
                    select: { id: true, name: true, username: true, position: true, role: true, phone: true }
                }
            },
            orderBy: [
                { date: 'desc' },
                { updatedAt: 'desc' }
            ]
        });

        // Consolidate reports by userId (or userId + date in multi-day range mode)
        const userReportsMap = {};
        for (const r of rawReports) {
            const dateStr = dayjs(r.date).format('YYYY-MM-DD');
            const mapKey = isMultiDay ? `${r.userId}_${dateStr}` : `${r.userId}`;

            if (!userReportsMap[mapKey]) {
                userReportsMap[mapKey] = { 
                    ...r, 
                    reportDateFormatted: dateStr,
                    metadata: { 
                        ...r.metadata, 
                        completedItems: Array.isArray(r.metadata?.completedItems) ? [...r.metadata.completedItems] : [],
                        inProgressItems: Array.isArray(r.metadata?.inProgressItems) ? [...r.metadata.inProgressItems] : [],
                        obstacleItems: Array.isArray(r.metadata?.obstacleItems) ? [...r.metadata.obstacleItems] : [],
                        tomorrowPlans: Array.isArray(r.metadata?.tomorrowPlans) ? [...r.metadata.tomorrowPlans] : [],
                        manualPoints: { morning: [], afternoon: [] } 
                    } 
                };
            } else {
                const targetMeta = userReportsMap[mapKey].metadata;
                if (Array.isArray(r.metadata?.completedItems)) {
                    targetMeta.completedItems = targetMeta.completedItems.concat(r.metadata.completedItems);
                }
                if (Array.isArray(r.metadata?.inProgressItems)) {
                    targetMeta.inProgressItems = targetMeta.inProgressItems.concat(r.metadata.inProgressItems);
                }
                if (Array.isArray(r.metadata?.obstacleItems)) {
                    targetMeta.obstacleItems = targetMeta.obstacleItems.concat(r.metadata.obstacleItems);
                }
                if (Array.isArray(r.metadata?.tomorrowPlans)) {
                    targetMeta.tomorrowPlans = targetMeta.tomorrowPlans.concat(r.metadata.tomorrowPlans);
                }
            }
            
            const targetPts = userReportsMap[mapKey].metadata.manualPoints;
            const pts = r.metadata?.manualPoints || {};
            const m = pts.morningPoints || pts.morning || [];
            const a = pts.afternoonPoints || pts.afternoon || [];
            
            if (Array.isArray(m)) {
                targetPts.morning = targetPts.morning.concat(m.filter(p => p && (typeof p === 'string' ? p.trim() !== '' : (p.text && p.text.trim() !== '') || (p.photos && p.photos.length > 0))));
            }
            if (Array.isArray(a)) {
                targetPts.afternoon = targetPts.afternoon.concat(a.filter(p => p && (typeof p === 'string' ? p.trim() !== '' : (p.text && p.text.trim() !== '') || (p.photos && p.photos.length > 0))));
            }

            if (r.metadata?.verification) {
                userReportsMap[mapKey].metadata.verification = r.metadata.verification;
            }
        }

        // For Kabid, filter staff matching staff keywords AND keep Kepala Bidang Sarana reports / own report; exclude auto logs
        let reports = Object.values(userReportsMap).filter(r => {
            const pos = (r.user?.position || '').toLowerCase();
            const isKabidUser = r.user?.role === 'KABID_SARPRAS' || pos.includes('kepala bidang sarana') || pos.includes('kabid sarpras');
            const isStaff = r.user?.role === 'ADMIN_ASET' || isKabidUser || SARPRAS_KEYWORDS.some(kw => pos.includes(kw));
            if (!isStaff && r.userId !== reqUserId) return false;
            const hasManual = isReportSubmitted(r);
            const hasRealManualContent = r.content && !r.content.includes('(Otomatis)');
            return hasManual || hasRealManualContent;
        });

        // Optional filtering by category tag, search keyword, or status for Kabid
        if (category && category !== 'ALL') {
            reports = reports.filter(r => {
                const meta = r.metadata || {};
                const c = Array.isArray(meta.completedItems) ? meta.completedItems : [];
                const ip = Array.isArray(meta.inProgressItems) ? meta.inProgressItems : [];
                const obs = Array.isArray(meta.obstacleItems) ? meta.obstacleItems : [];
                const pts = meta.manualPoints;
                const m = pts?.morning || [];
                const a = pts?.afternoon || [];
                const all = [...c, ...ip, ...obs, ...m, ...a];
                return all.some(p => (p.categoryTag || '').toUpperCase() === category.toUpperCase());
            });
        }

        if (search && search.trim()) {
            const q = search.toLowerCase();
            reports = reports.filter(r => {
                const userName = (r.user?.name || '').toLowerCase();
                const pos = (r.user?.position || '').toLowerCase();
                const meta = r.metadata || {};
                const c = Array.isArray(meta.completedItems) ? meta.completedItems : [];
                const ip = Array.isArray(meta.inProgressItems) ? meta.inProgressItems : [];
                const obs = Array.isArray(meta.obstacleItems) ? meta.obstacleItems : [];
                const pts = meta.manualPoints;
                const m = pts?.morning || [];
                const a = pts?.afternoon || [];
                const all = [...c, ...ip, ...obs, ...m, ...a];
                const hasMatchText = all.some(p => 
                    (p.title || '').toLowerCase().includes(q) || 
                    (p.text || '').toLowerCase().includes(q) || 
                    (p.obstacleNote || '').toLowerCase().includes(q)
                );
                return userName.includes(q) || pos.includes(q) || hasMatchText;
            });
        }

        if (status && status !== 'ALL') {
            reports = reports.filter(r => {
                const submitted = isReportSubmitted(r);
                if (status === 'LENGKAP') return submitted;
                if (status === 'PARSIAL') return submitted;
                if (status === 'BELUM') return !submitted;
                return true;
            });
        }

        const myReport = userReportsMap[reqUserId] || reports.find(r => r.userId === reqUserId) || null;

        // Auto Carry-Over: Cari laporan hari kerja sebelumnya untuk menarik rencana besok
        let suggestedFromYesterday = [];
        try {
            const yesterdayReport = await prisma.personnelReport.findFirst({
                where: {
                    userId: reqUserId,
                    type: 'DAILY',
                    NOT: { content: 'SETORAN_HAFALAN' },
                    date: { lt: gteDate }
                },
                orderBy: { date: 'desc' }
            });

            if (yesterdayReport && yesterdayReport.metadata) {
                let yMeta = yesterdayReport.metadata;
                if (typeof yMeta === 'string') {
                    try { yMeta = JSON.parse(yMeta); } catch (e) { yMeta = {}; }
                }

                if (Array.isArray(yMeta.tomorrowPlans) && yMeta.tomorrowPlans.length > 0) {
                    suggestedFromYesterday = yMeta.tomorrowPlans
                        .filter(tp => tp && (tp.title || tp.text))
                        .map(tp => ({
                            text: tp.title || tp.text || '',
                            categoryTag: tp.categoryTag || 'UMUM',
                            status: 'IN_PROGRESS',
                            progressPercentage: 50,
                            sourceType: tp.sourceType || 'PLAN',
                            sourceId: tp.sourceId || null,
                            planItemIndex: tp.planItemIndex !== undefined ? tp.planItemIndex : null,
                            projectId: tp.projectId || null,
                            projectItemIndex: tp.projectItemIndex !== undefined ? tp.projectItemIndex : null,
                            obstacleNote: '',
                            photos: [],
                            isFromYesterday: true
                        }));
                }
            }
        } catch (errPrev) {
            console.error('Error fetching yesterday report for carry-over:', errPrev);
        }

        // Ambil Project Aktif dan Rencana Pekanan Aktif milik user untuk opsi penarikan
        let userProjects = [];
        let userWeeklyPlans = [];
        try {
            const allUserPlans = await prisma.personnelReport.findMany({
                where: {
                    userId: reqUserId,
                    type: 'WEEKLY'
                },
                orderBy: { updatedAt: 'desc' }
            });

            allUserPlans.forEach(p => {
                let m = p.metadata;
                if (typeof m === 'string') {
                    try { m = JSON.parse(m); } catch (e) { m = {}; }
                }
                if (!m) return;
                const items = Array.isArray(m.items) ? m.items : [];
                const isProject = !!m.isProject || m.planType === 'PROJECT';
                const planObj = {
                    id: p.id,
                    title: m.title || p.content || 'Rencana Kerja',
                    categoryTag: m.categoryTag || p.category || 'UMUM',
                    startDate: m.startDate || p.date,
                    endDate: m.endDate || null,
                    priority: m.priority || 'SEDANG',
                    status: m.status || 'PENDING',
                    percentage: m.percentage || 0,
                    items,
                    isProject,
                    planType: m.planType || (isProject ? 'PROJECT' : 'WEEKLY')
                };

                if (isProject) {
                    userProjects.push(planObj);
                } else if (m.isPlan) {
                    userWeeklyPlans.push(planObj);
                }
            });
        } catch (ePlans) {
            console.error('Error fetching user projects/weekly plans:', ePlans);
        }

        res.json({ 
            success: true, 
            reports, 
            myReport,
            suggestedFromYesterday,
            userProjects,
            userWeeklyPlans,
            isKabid: isUserKabid 
        });

    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ error: 'Terjadi kesalahan pada server' });
    }
};

/**
 * POST /api/laporan/my
 * Save or update daily report for the logged in Admin Aset.
 */
exports.updateMyReport = async (req, res) => {
    const userId = parseInt(req.user.id, 10);
    if (process.env.USE_LOCAL_STORAGE === 'true') {
        const report = localData.saveDailyReport(req.body, userId);
        return res.json({ success: true, message: 'Laporan harian PPP berhasil disimpan (tersimpan lokal).', report, isLocalOffline: true });
    }
    try {
        const { category, targetDate, manualPoints, tomorrowPlans, completedItems, inProgressItems, obstacleItems } = req.body;
        
        // Selalu gunakan zona waktu Waktu Indonesia Barat (WIB / Asia/Jakarta)
        let reportDate = dayjs().tz('Asia/Jakarta');
        if (targetDate) {
            reportDate = dayjs.tz(targetDate, 'Asia/Jakarta');
        }

        // Normalisasi batas awal dan akhir hari berdasarkan WIB
        const dateStart = reportDate.startOf('day').toDate();
        const dateEnd = reportDate.endOf('day').toDate();

        // Cari laporan yang sudah ada pada tanggal tersebut (prioritaskan yang memiliki manualPoints)
        const existingReports = await prisma.personnelReport.findMany({
            where: {
                userId,
                type: 'DAILY',
                NOT: { content: 'SETORAN_HAFALAN' },
                date: {
                    gte: dateStart,
                    lte: dateEnd
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        // Pilih laporan yang sudah punya manualPoints, atau rekaman pertama
        let report = existingReports.find(r => r.metadata && r.metadata.manualPoints) || existingReports[0] || null;

        // Ambil data lama jika ada untuk smart merge
        const existingMetadata = typeof report?.metadata === 'object' && report?.metadata !== null ? report.metadata : {};
        const oldPoints = existingMetadata.manualPoints || {};
        const oldMorning = Array.isArray(oldPoints.morning || oldPoints.morningPoints) ? (oldPoints.morning || oldPoints.morningPoints) : [];
        const oldAfternoon = Array.isArray(oldPoints.afternoon || oldPoints.afternoonPoints) ? (oldPoints.afternoon || oldPoints.afternoonPoints) : [];

        // Deteksi apakah data dikirim dalam Format PPP (Completed, In-Progress, Obstacles)
        const hasPppPayload = Array.isArray(completedItems) || Array.isArray(inProgressItems) || Array.isArray(obstacleItems);

        let finalMorning = [];
        let finalAfternoon = [];

        if (hasPppPayload) {
            const safeCompleted = Array.isArray(completedItems) ? completedItems : [];
            const safeInProgress = Array.isArray(inProgressItems) ? inProgressItems : [];
            const safeObstacles = Array.isArray(obstacleItems) ? obstacleItems : [];

            // A. Pekerjaan Selesai Hari Ini -> ke Morning points (status COMPLETED, 100%)
            safeCompleted.forEach(c => {
                finalMorning.push({
                    text: (c.title || c.text || 'Tugas Selesai').trim(),
                    output: (c.output || '').trim(),
                    categoryTag: c.categoryTag || category || 'UMUM',
                    status: 'COMPLETED',
                    progressPercentage: 100,
                    sourceType: c.sourceType || null,
                    sourceId: c.sourceId || null,
                    planItemIndex: c.planItemIndex !== undefined && c.planItemIndex !== null ? parseInt(c.planItemIndex) : null,
                    projectId: c.projectId || null,
                    projectItemIndex: c.projectItemIndex !== undefined && c.projectItemIndex !== null ? parseInt(c.projectItemIndex) : null,
                    obstacleNote: '',
                    isRoutine: !!c.isRoutine,
                    photos: Array.isArray(c.photos) ? c.photos : [],
                    updatedAt: new Date().toISOString()
                });
            });

            // C. Kendala Lapangan -> ke Morning points (status OBSTACLE)
            safeObstacles.forEach(obs => {
                finalMorning.push({
                    text: (obs.title || obs.obstacleNote || 'Kendala Lapangan').trim(),
                    output: '',
                    categoryTag: obs.categoryTag || category || 'UMUM',
                    status: 'OBSTACLE',
                    progressPercentage: 0,
                    obstacleNote: (obs.obstacleNote || obs.title || '').trim(),
                    actionPlan: (obs.actionPlan || '').trim(),
                    sourceType: obs.sourceType || null,
                    sourceId: obs.sourceId || null,
                    photos: Array.isArray(obs.photos) ? obs.photos : [],
                    updatedAt: new Date().toISOString()
                });
            });

            // B. Sedang Dikerjakan (On-Progress) -> ke Afternoon points (status IN_PROGRESS)
            safeInProgress.forEach(p => {
                const pct = p.progressPercentage !== undefined ? parseInt(p.progressPercentage) : 50;
                finalAfternoon.push({
                    text: (p.title || p.text || 'Tugas On-Progress').trim(),
                    output: '',
                    targetDate: p.targetDate || '',
                    categoryTag: p.categoryTag || category || 'UMUM',
                    status: 'IN_PROGRESS',
                    progressPercentage: pct,
                    sourceType: p.sourceType || null,
                    sourceId: p.sourceId || null,
                    planItemIndex: p.planItemIndex !== undefined && p.planItemIndex !== null ? parseInt(p.planItemIndex) : null,
                    projectId: p.projectId || null,
                    projectItemIndex: p.projectItemIndex !== undefined && p.projectItemIndex !== null ? parseInt(p.projectItemIndex) : null,
                    obstacleNote: '',
                    isRoutine: !!p.isRoutine,
                    photos: Array.isArray(p.photos) ? p.photos : [],
                    updatedAt: new Date().toISOString()
                });
            });
        } else {
            // Legacy mapping
            const incomingMorning = Array.isArray(manualPoints?.morning) ? manualPoints.morning : [];
            const incomingAfternoon = Array.isArray(manualPoints?.afternoon) ? manualPoints.afternoon : [];

            const mapPoint = (p) => ({
                text: (p.text || '').trim(),
                categoryTag: p.categoryTag || category || 'UMUM',
                status: p.status || 'COMPLETED',
                progressPercentage: p.progressPercentage !== undefined ? parseInt(p.progressPercentage) : (p.status === 'COMPLETED' ? 100 : 50),
                sourceType: p.sourceType || null,
                sourceId: p.sourceId || null,
                planItemIndex: p.planItemIndex !== undefined && p.planItemIndex !== null ? parseInt(p.planItemIndex) : null,
                projectId: p.projectId || null,
                projectItemIndex: p.projectItemIndex !== undefined && p.projectItemIndex !== null ? parseInt(p.projectItemIndex) : null,
                obstacleNote: (p.obstacleNote || '').trim(),
                isRoutine: !!p.isRoutine,
                photos: Array.isArray(p.photos) ? p.photos : [],
                review: p.review || null,
                updatedAt: new Date().toISOString()
            });

            finalMorning = incomingMorning.map(mapPoint);
            if (finalMorning.length === 0 && oldMorning.length > 0 && incomingAfternoon.length > 0) {
                finalMorning = oldMorning;
            }

            finalAfternoon = incomingAfternoon.map(mapPoint);
            if (finalAfternoon.length === 0 && oldAfternoon.length > 0 && incomingMorning.length > 0) {
                finalAfternoon = oldAfternoon;
            }
        }

        const formattedPoints = {
            morning: finalMorning,
            afternoon: finalAfternoon
        };

        const mergedCompletedItems = completedItems !== undefined 
            ? (Array.isArray(completedItems) ? completedItems : []) 
            : (existingMetadata.completedItems || []);
        const mergedInProgressItems = inProgressItems !== undefined 
            ? (Array.isArray(inProgressItems) ? inProgressItems : []) 
            : (existingMetadata.inProgressItems || []);
        const mergedObstacleItems = obstacleItems !== undefined 
            ? (Array.isArray(obstacleItems) ? obstacleItems : []) 
            : (existingMetadata.obstacleItems || []);
        const mergedTomorrowPlans = tomorrowPlans !== undefined 
            ? (Array.isArray(tomorrowPlans) ? tomorrowPlans : []) 
            : (existingMetadata.tomorrowPlans || []);

        // Buat ringkasan teks otomatis ke kolom content
        const summaryLines = ['[LAPORAN HARIAN PPP]'];
        if (mergedCompletedItems.length > 0) {
            summaryLines.push('A. PEKERJAAN SELESAI HARI INI:');
            mergedCompletedItems.forEach((p, idx) => {
                const out = p.output ? ` (Output: ${p.output})` : '';
                summaryLines.push(`${idx + 1}. [${p.categoryTag || category || 'UMUM'}] ${p.title || p.text || 'Tugas Selesai'}${out}`);
            });
        } else if (finalMorning.length > 0) {
            summaryLines.push('A. PEKERJAAN SELESAI:');
            finalMorning.forEach((p, idx) => {
                const obs = p.status === 'OBSTACLE' && p.obstacleNote ? ` (Kendala: ${p.obstacleNote})` : '';
                summaryLines.push(`${idx + 1}. [${p.categoryTag || 'UMUM'}] ${p.text || 'Dokumentasi Foto'} [${p.status}]${obs}`);
            });
        }

        if (mergedInProgressItems.length > 0) {
            summaryLines.push('B. SEDANG DIKERJAKAN (ON-PROGRESS):');
            mergedInProgressItems.forEach((p, idx) => {
                const pct = p.progressPercentage ? ` [${p.progressPercentage}%]` : '';
                const tgt = p.targetDate ? ` (Target: ${p.targetDate})` : '';
                summaryLines.push(`${idx + 1}. [${p.categoryTag || category || 'UMUM'}] ${p.title || p.text || 'Tugas On-Progress'}${pct}${tgt}`);
            });
        } else if (finalAfternoon.length > 0) {
            summaryLines.push('B. DALAM PROSES:');
            finalAfternoon.forEach((p, idx) => {
                const obs = p.status === 'OBSTACLE' && p.obstacleNote ? ` (Kendala: ${p.obstacleNote})` : '';
                summaryLines.push(`${idx + 1}. [${p.categoryTag || 'UMUM'}] ${p.text || 'Dokumentasi Foto'} [${p.status}]${obs}`);
            });
        }

        if (mergedObstacleItems.length > 0) {
            summaryLines.push('C. KENDALA LAPANGAN:');
            mergedObstacleItems.forEach((obs, idx) => {
                const act = obs.actionPlan ? ` (Solusi: ${obs.actionPlan})` : '';
                summaryLines.push(`${idx + 1}. [${obs.categoryTag || category || 'UMUM'}] ${obs.obstacleNote || obs.title || 'Kendala'}${act}`);
            });
        }

        if (mergedTomorrowPlans.length > 0) {
            const isFriday = reportDate.day() === 5;
            summaryLines.push(isFriday ? 'D. RENCANA PEKERJAAN PEKAN DEPAN:' : 'D. RENCANA KERJA BESOK:');
            mergedTomorrowPlans.forEach((tp, idx) => {
                if (tp.title) summaryLines.push(`${idx + 1}. [${tp.categoryTag || category || 'UMUM'}] ${tp.title} [Prioritas: ${tp.priority || 'SEDANG'}]`);
            });
        }

        const autoContent = summaryLines.join('\n');

        // Simpan pada tengah hari (12:00:00 WIB) agar aman dari pergeseran batas hari UTC vs WIB
        const normalizedDate = reportDate.hour(12).minute(0).second(0).toDate();

        const newMetadata = {
            ...existingMetadata,
            manualPoints: formattedPoints,
            completedItems: mergedCompletedItems,
            inProgressItems: mergedInProgressItems,
            obstacleItems: mergedObstacleItems,
            tomorrowPlans: mergedTomorrowPlans,
            lastSubmittedAt: new Date().toISOString()
        };

        if (report) {
            report = await prisma.personnelReport.update({
                where: { id: report.id },
                data: { 
                    content: autoContent || report.content || '',
                    category: category || report.category || 'UMUM',
                    date: normalizedDate,
                    metadata: newMetadata
                }
            });
        } else {
            report = await prisma.personnelReport.create({
                data: {
                    userId,
                    type: 'DAILY',
                    category: category || 'UMUM',
                    content: autoContent, 
                    metadata: newMetadata,
                    date: normalizedDate
                }
            });
        }

        // Two-way synchronization for linked tasks (ASSIGNMENT or MAINTENANCE)
        (async () => {
            try {
                const allPoints = [...finalMorning, ...finalAfternoon];
                for (const p of allPoints) {
                    if (p.sourceType === 'ASSIGNMENT' && p.sourceId) {
                        try {
                            const pct = p.status === 'COMPLETED' ? 100 : (p.progressPercentage || 50);
                            await prisma.personnelAssignment.update({
                                where: { id: parseInt(p.sourceId) },
                                data: {
                                    status: p.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS',
                                    progressPercentage: pct,
                                    actualCompletionDate: p.status === 'COMPLETED' ? new Date() : null
                                }
                            });

                            // 2-Way Sync: Update linked Plan
                            try {
                                const kinerjaCtrl = require('./kinerjaManajemenController');
                                if (kinerjaCtrl && typeof kinerjaCtrl.syncAssignmentToPlan === 'function') {
                                    await kinerjaCtrl.syncAssignmentToPlan(parseInt(p.sourceId), pct, p.status);
                                }
                            } catch (ePlanSync) {}
                        } catch (e) {
                            console.error('[Laporan] Error syncing assignment:', e.message);
                        }
                    } else if (p.sourceType === 'MAINTENANCE' && p.sourceId) {
                        try {
                            const pct = p.status === 'COMPLETED' ? 100 : (p.progressPercentage || 50);
                            await prisma.maintenance.update({
                                where: { id: parseInt(p.sourceId) },
                                data: {
                                    status: p.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS',
                                    ...(p.status === 'COMPLETED' ? { completionDate: new Date() } : {})
                                }
                            });
                        } catch (e) {
                            console.error('[Laporan] Error syncing maintenance:', e.message);
                        }
                    } else if ((p.sourceType === 'PLAN' || p.sourceType === 'WEEKLY_PLAN') && p.sourceId) {
                        try {
                            const plan = await prisma.personnelReport.findUnique({
                                where: { id: parseInt(p.sourceId) }
                            });
                            if (plan && plan.metadata && plan.metadata.isPlan) {
                                const updatedMeta = { ...plan.metadata };
                                const pct = p.status === 'COMPLETED' ? 100 : (p.progressPercentage !== undefined ? parseInt(p.progressPercentage) : 50);
                                let linkedProjectId = null;
                                let linkedProjectItemIdx = null;

                                if (updatedMeta.items && Array.isArray(updatedMeta.items) && updatedMeta.items.length > 0 && p.planItemIndex !== null && p.planItemIndex !== undefined) {
                                    const idx = parseInt(p.planItemIndex);
                                    if (updatedMeta.items[idx]) {
                                        updatedMeta.items[idx].percentage = pct;
                                        updatedMeta.items[idx].status = pct === 100 ? 'SELESAI' : (pct > 0 ? 'PROSES' : 'PENDING');
                                        linkedProjectId = updatedMeta.items[idx].projectId || updatedMeta.projectId || null;
                                        linkedProjectItemIdx = updatedMeta.items[idx].projectItemIndex !== undefined ? updatedMeta.items[idx].projectItemIndex : null;
                                    }
                                    // Recalculate whole plan status
                                    const allItemsDone = updatedMeta.items.every(it => it.percentage === 100 || it.status === 'SELESAI');
                                    const avg = Math.round(updatedMeta.items.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / updatedMeta.items.length);
                                    updatedMeta.percentage = avg;
                                    updatedMeta.status = (allItemsDone || avg === 100) ? 'SELESAI' : (avg > 0 ? 'PROSES' : 'PENDING');
                                } else {
                                    // Single-goal plan without sub-items
                                    updatedMeta.percentage = pct;
                                    updatedMeta.status = pct === 100 ? 'SELESAI' : (pct > 0 ? 'PROSES' : 'PENDING');
                                    linkedProjectId = updatedMeta.projectId || null;
                                }

                                await prisma.personnelReport.update({
                                    where: { id: plan.id },
                                    data: { metadata: updatedMeta }
                                });
                                console.log(`[Laporan] Auto-synced daily report update to plan ${plan.id} (Status: ${updatedMeta.status}, Progres: ${updatedMeta.percentage}%)`);

                                // Upward Chain Sync: Update Project Induk jika butir rencana pekanan ini terhubung ke Project
                                if (linkedProjectId) {
                                    try {
                                        const prj = await prisma.personnelReport.findUnique({ where: { id: parseInt(linkedProjectId) } });
                                        if (prj && prj.metadata) {
                                            const prjMeta = { ...prj.metadata };
                                            const prjItems = Array.isArray(prjMeta.items) ? [...prjMeta.items] : [];
                                            if (linkedProjectItemIdx !== null && prjItems[linkedProjectItemIdx]) {
                                                prjItems[linkedProjectItemIdx].percentage = pct;
                                                prjItems[linkedProjectItemIdx].status = pct === 100 ? 'SELESAI' : (pct > 0 ? 'PROSES' : 'PENDING');
                                            }
                                            const prjAvg = prjItems.length > 0 
                                                ? Math.round(prjItems.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / prjItems.length) 
                                                : pct;
                                            prjMeta.items = prjItems;
                                            prjMeta.percentage = prjAvg;
                                            prjMeta.status = prjAvg === 100 ? 'SELESAI' : (prjAvg > 0 ? 'PROSES' : 'PENDING');
                                            await prisma.personnelReport.update({
                                                where: { id: prj.id },
                                                data: { metadata: prjMeta }
                                            });
                                            console.log(`[Laporan] Upward chain synced to Project ${prj.id} (Progres: ${prjAvg}%)`);
                                        }
                                    } catch (errPrjSync) {
                                        console.error('[Laporan] Error upward syncing to project:', errPrjSync.message);
                                    }
                                }
                            }
                        } catch (e) {
                            console.error('[Laporan] Error syncing plan:', e.message);
                        }
                    } else if (p.sourceType === 'PROJECT' && p.sourceId) {
                        // Direct pull from Project
                        try {
                            const prj = await prisma.personnelReport.findUnique({ where: { id: parseInt(p.sourceId) } });
                            if (prj && prj.metadata) {
                                const prjMeta = { ...prj.metadata };
                                const prjItems = Array.isArray(prjMeta.items) ? [...prjMeta.items] : [];
                                const pct = p.status === 'COMPLETED' ? 100 : (p.progressPercentage !== undefined ? parseInt(p.progressPercentage) : 50);
                                if (p.planItemIndex !== null && p.planItemIndex !== undefined && prjItems[p.planItemIndex]) {
                                    prjItems[p.planItemIndex].percentage = pct;
                                    prjItems[p.planItemIndex].status = pct === 100 ? 'SELESAI' : (pct > 0 ? 'PROSES' : 'PENDING');
                                }
                                const prjAvg = prjItems.length > 0 
                                    ? Math.round(prjItems.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / prjItems.length) 
                                    : pct;
                                prjMeta.items = prjItems;
                                prjMeta.percentage = prjAvg;
                                prjMeta.status = prjAvg === 100 ? 'SELESAI' : (prjAvg > 0 ? 'PROSES' : 'PENDING');
                                await prisma.personnelReport.update({
                                    where: { id: prj.id },
                                    data: { metadata: prjMeta }
                                });
                                console.log(`[Laporan] Direct project sync for ${prj.id} (Progres: ${prjAvg}%)`);
                            }
                        } catch (ePrjDirect) {
                            console.error('[Laporan] Error syncing direct project:', ePrjDirect.message);
                        }
                    }
                }
            } catch (syncErr) {
                console.error('[Laporan] Sync linked items error:', syncErr.message);
            }
        })();

        res.json({ success: true, report });
    } catch (error) {
        console.error('Error updating report:', error);
        if (error.message?.includes("reach database") || error.code === 'P1001') {
            const report = localData.saveDailyReport(req.body, userId);
            return res.json({ success: true, message: 'Laporan harian PPP berhasil disimpan (tersimpan lokal).', report, isLocalOffline: true });
        }
        res.status(500).json({ error: 'Terjadi kesalahan pada server saat menyimpan laporan' });
    }
};

/**
 * GET /api/laporan/status
 * Check if the user has reported today (PPP or legacy).
 */
exports.getReportStatus = async (req, res) => {
    try {
        const userId = parseInt(req.user.id, 10);
        const targetDate = dayjs().tz('Asia/Jakarta');
        const startOfDay = targetDate.startOf('day').toDate();
        const endOfDay = targetDate.endOf('day').toDate();

        let reports = [];
        try {
            reports = await prisma.personnelReport.findMany({
                where: {
                    userId,
                    type: 'DAILY',
                    NOT: { content: 'SETORAN_HAFALAN' },
                    date: { gte: startOfDay, lte: endOfDay }
                }
            });
        } catch (dbErr) {
            console.warn('[getReportStatus] Database unreachable, checking localDataStorage:', dbErr.message);
            const localRes = localData.getDailyPpp(targetDate.format('YYYY-MM-DD'), userId, false);
            reports = localRes.localReports || [];
        }

        const hasReported = reports.some(r => isReportSubmitted(r));

        res.json({ 
            hasReported, 
            hasMorning: hasReported, 
            hasAfternoon: hasReported,
            isKabid: isKabid(req.user)
        });
    } catch (error) {
        console.error('Error fetching report status:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * GET /api/laporan/dashboard/analytics
 * Executive analytics for Kepala Bidang Sarana.
 */
exports.getDashboardAnalytics = async (req, res) => {
    try {
        if (!isKabid(req.user)) {
            return res.status(403).json({ error: 'Akses ditolak. Dashboard hanya untuk Kepala Bidang Sarana.' });
        }

        const targetDate = req.query.date ? dayjs.tz(req.query.date, 'Asia/Jakarta') : dayjs().tz('Asia/Jakarta');
        const startOfDay = targetDate.startOf('day').toDate();
        const endOfDay = targetDate.endOf('day').toDate();

        // 1. Get all staff users (Role ADMIN_ASET or Sarpras position, exclude Kabid)
        const staffUsers = await prisma.user.findMany({
            where: STAFF_USER_WHERE,
            select: { id: true, name: true, position: true, role: true, phone: true }
        });

        // 2. Fetch today's reports for Staff users
        const todayReports = await prisma.personnelReport.findMany({
            where: {
                type: 'DAILY',
                NOT: { content: 'SETORAN_HAFALAN' },
                date: { gte: startOfDay, lte: endOfDay },
                user: STAFF_USER_WHERE
            },
            include: {
                user: { select: { id: true, name: true, position: true, role: true } }
            }
        });

        // Calculate Compliance metrics
        let lengkapCount = 0;
        let parsialCount = 0;
        let belumCount = 0;
        let totalActivitiesToday = 0;
        let totalPhotosToday = 0;
        const activeObstacles = [];
        const categoryCounts = {
            GUDANG: 0,
            ASET: 0,
            TEKNISI: 0,
            KENDARAAN: 0,
            KEUANGAN: 0,
            IT: 0,
            DESAINER: 0,
            UMUM: 0
        };

        const staffStatusList = staffUsers.map(st => {
            const rep = todayReports.find(r => r.userId === st.id);
            const meta = rep?.metadata || {};
            const isDone = isReportSubmitted(rep);

            let status = 'BELUM';
            if (isDone) {
                status = 'LENGKAP';
                lengkapCount++;
            } else {
                belumCount++;
            }

            // Aggregate items & obstacles from PPP or legacy points
            const c = Array.isArray(meta.completedItems) ? meta.completedItems : [];
            const ip = Array.isArray(meta.inProgressItems) ? meta.inProgressItems : [];
            const obs = Array.isArray(meta.obstacleItems) ? meta.obstacleItems : [];
            const m = meta.manualPoints?.morning || meta.manualPoints?.morningPoints || [];
            const a = meta.manualPoints?.afternoon || meta.manualPoints?.afternoonPoints || [];

            let allItems = [];
            if (c.length > 0 || ip.length > 0 || obs.length > 0) {
                allItems = [
                    ...c.map(it => ({ ...it, text: it.title || it.text, status: 'COMPLETED' })),
                    ...ip.map(it => ({ ...it, text: it.title || it.text, status: 'IN_PROGRESS' })),
                    ...obs.map(it => ({ ...it, text: it.title || it.obstacleNote, status: 'OBSTACLE' }))
                ];
            } else {
                allItems = [...(Array.isArray(m) ? m : []), ...(Array.isArray(a) ? a : [])];
            }

            allItems.forEach(item => {
                totalActivitiesToday++;
                if (item.photos && Array.isArray(item.photos)) totalPhotosToday += item.photos.length;
                
                const cat = (item.categoryTag || 'UMUM').toUpperCase();
                if (categoryCounts[cat] !== undefined) categoryCounts[cat]++;
                else categoryCounts.UMUM++;

                if (item.status === 'OBSTACLE' || item.obstacleNote) {
                    activeObstacles.push({
                        staffName: st.name,
                        position: st.position,
                        activity: item.text || item.title || 'Kendala Lapangan',
                        categoryTag: item.categoryTag || 'UMUM',
                        obstacleNote: item.obstacleNote || item.text || 'Terkendala di lapangan',
                        photos: item.photos || [],
                        time: item.updatedAt || rep?.updatedAt
                    });
                }
            });

            return {
                id: st.id,
                name: st.name,
                position: st.position,
                phone: st.phone || null,
                status,
                hasMorning: isDone,
                hasAfternoon: isDone,
                lastSubmittedAt: rep?.metadata?.lastSubmittedAt || rep?.updatedAt || null
            };
        });

        // 3. Check 2-working-days inactivity (Monday to Friday only)
        const last2WorkDays = getLastWorkingDays(2, targetDate);
        const startOf2WorkDays = last2WorkDays[last2WorkDays.length - 1].startOf('day').toDate();
        const endOf2WorkDays = last2WorkDays[0].endOf('day').toDate();

        const reportsIn2Days = await prisma.personnelReport.findMany({
            where: {
                type: 'DAILY',
                NOT: { content: 'SETORAN_HAFALAN' },
                date: { gte: startOf2WorkDays, lte: endOf2WorkDays },
                user: STAFF_USER_WHERE
            }
        });

        const consecutiveMissingStaff = [];
        staffUsers.forEach(st => {
            let missedDays = [];
            last2WorkDays.forEach(day => {
                const dStr = day.format('YYYY-MM-DD');
                const rep = reportsIn2Days.find(r => r.userId === st.id && dayjs(r.date).tz('Asia/Jakarta').format('YYYY-MM-DD') === dStr);
                if (!isReportSubmitted(rep)) {
                    missedDays.push(day.format('dddd, DD/MM/YYYY'));
                }
            });

            if (missedDays.length >= 2) {
                consecutiveMissingStaff.push({
                    id: st.id,
                    name: st.name,
                    position: st.position,
                    phone: st.phone || null,
                    missedDays
                });
            }
        });

        // 4. Trend last 7 days
        const trend7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = targetDate.subtract(i, 'day');
            const dStart = d.startOf('day').toDate();
            const dEnd = d.endOf('day').toDate();

            const dReports = await prisma.personnelReport.findMany({
                where: { 
                    type: 'DAILY', 
                    NOT: { content: 'SETORAN_HAFALAN' },
                    date: { gte: dStart, lte: dEnd },
                    user: STAFF_USER_WHERE
                }
            });

            let dLengkap = 0;
            let dParsial = 0;
            let dBelum = 0;

            staffUsers.forEach(st => {
                const rep = dReports.find(r => r.userId === st.id);
                if (isReportSubmitted(rep)) dLengkap++;
                else dBelum++;
            });

            trend7Days.push({
                date: d.format('DD MMM'),
                Lengkap: dLengkap,
                Parsial: 0,
                Belum: dBelum
            });
        }

        // 5. Leaderboard 30 days
        const monthStart = targetDate.subtract(30, 'day').startOf('day').toDate();
        const monthReports = await prisma.personnelReport.findMany({
            where: { 
                type: 'DAILY', 
                NOT: { content: 'SETORAN_HAFALAN' },
                date: { gte: monthStart, lte: endOfDay },
                user: STAFF_USER_WHERE
            }
        });

        const leaderboard = staffUsers.map(st => {
            const userReps = monthReports.filter(r => r.userId === st.id);
            let completeDays = 0;
            let totalTasks = 0;

            userReps.forEach(r => {
                if (isReportSubmitted(r)) completeDays++;
                const meta = r.metadata || {};
                const c = Array.isArray(meta.completedItems) ? meta.completedItems.length : 0;
                const ip = Array.isArray(meta.inProgressItems) ? meta.inProgressItems.length : 0;
                const obs = Array.isArray(meta.obstacleItems) ? meta.obstacleItems.length : 0;
                const pts = meta.manualPoints;
                const m = Array.isArray(pts?.morning || pts?.morningPoints) ? (pts.morning || pts.morningPoints).length : 0;
                const a = Array.isArray(pts?.afternoon || pts?.afternoonPoints) ? (pts.afternoon || pts.afternoonPoints).length : 0;
                totalTasks += ((c + ip + obs) || (m + a));
            });

            const score = Math.min(100, Math.round((completeDays / 26) * 100)); // assuming 26 working days
            return {
                id: st.id,
                name: st.name,
                position: st.position,
                completeDays,
                totalTasks,
                score
            };
        }).sort((a, b) => b.score - a.score);

        const totalStaff = staffUsers.length || 1;
        const complianceRate = Math.round((lengkapCount / totalStaff) * 100);

        res.json({
            success: true,
            summary: {
                totalStaff: staffUsers.length,
                lengkapCount,
                parsialCount,
                belumCount,
                complianceRate,
                totalActivitiesToday,
                totalPhotosToday
            },
            staffStatusList,
            categoryCounts,
            activeObstacles,
            consecutiveMissingStaff,
            trend7Days,
            leaderboard
        });

    } catch (error) {
        console.error('Error fetching dashboard analytics:', error);
        res.status(500).json({ error: 'Gagal memuat analitik dashboard' });
    }
};

/**
 * GET /api/laporan/weekly-summary
 * Aggregated data for Kabid Weekly PDF Report generation.
 */
exports.getWeeklySummary = async (req, res) => {
    try {
        if (!isKabid(req.user)) {
            return res.status(403).json({ error: 'Akses ditolak.' });
        }

        let startDate = req.query.startDate ? dayjs.tz(req.query.startDate, 'Asia/Jakarta') : dayjs().tz('Asia/Jakarta').startOf('week').add(1, 'day'); // Monday
        let endDate = req.query.endDate ? dayjs.tz(req.query.endDate, 'Asia/Jakarta') : startDate.add(4, 'day'); // Friday

        const dStart = startDate.startOf('day').toDate();
        const dEnd = endDate.endOf('day').toDate();

        const reports = await prisma.personnelReport.findMany({
            where: {
                type: 'DAILY',
                NOT: { content: 'SETORAN_HAFALAN' },
                date: { gte: dStart, lte: dEnd },
                user: STAFF_USER_WHERE
            },
            include: {
                user: { select: { id: true, name: true, position: true, role: true } }
            },
            orderBy: { date: 'asc' }
        });

        // Find Kabid user in DB for accurate NIY signature
        const kabidUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { position: { contains: 'Kepala Bidang Sarana' } },
                    { role: 'KABID_SARPRAS' }
                ]
            },
            select: { id: true, name: true, nip: true, username: true, position: true }
        }) || req.user;

        // Strictly exclude any reports submitted by Kepala Bidang Sarana
        const isKabidEntity = (u) => {
            if (!u) return false;
            const role = (u.role || '').toUpperCase();
            const pos = (u.position || '').toLowerCase();
            const name = (u.name || '').toLowerCase();
            return (
                role === 'KABID_SARPRAS' ||
                role === 'SUPER_ADMIN' ||
                pos.includes('kepala bidang') ||
                pos.includes('kabid') ||
                name.includes('ravi kurnia') ||
                (kabidUser?.id && u.id === kabidUser.id)
            );
        };

        const staffOnlyReports = reports.filter(r => !isKabidEntity(r.user));

        // Group by Date, Staff, & Division
        const dailyDivisionBreakdown = [];
        const documentationPhotos = [];
        const staffMap = {};
        let curr = startDate.clone();
        let totalCompleted = 0;
        let totalInProgress = 0;
        let totalObstacles = 0;
        const obstacleList = [];
        const positionMap = {};

        while (curr.isBefore(endDate.endOf('day'))) {
            const dateStr = curr.format('YYYY-MM-DD');
            const dayReports = staffOnlyReports.filter(r => dayjs(r.date).tz('Asia/Jakarta').format('YYYY-MM-DD') === dateStr);

            const activities = [];
            dayReports.forEach(r => {
                const posName = r.user?.position || 'Staf Sarana & Prasarana';
                const staffName = r.user?.name || 'Staf Sarana';
                const staffId = r.user?.id ? String(r.user.id) : staffName;

                if (!staffMap[staffId]) {
                    staffMap[staffId] = {
                        userId: r.user?.id,
                        staffName,
                        position: posName,
                        points: [],
                        totalActivities: 0,
                        totalCompleted: 0,
                        totalInProgress: 0,
                        totalObstacles: 0
                    };
                }

                if (!positionMap[posName]) {
                    positionMap[posName] = {
                        position: posName,
                        totalCompleted: 0,
                        totalInProgress: 0,
                        totalObstacles: 0,
                        totalActivities: 0,
                        taskSummaries: new Set(),
                        categories: new Set(),
                        obstacles: []
                    };
                }

                const pts = r.metadata?.manualPoints;
                const m = pts?.morning || pts?.morningPoints || [];
                const a = pts?.afternoon || pts?.afternoonPoints || [];
                
                [...m, ...a].forEach(item => {
                    const photos = Array.isArray(item.photos) ? item.photos : [];
                    
                    // Collect photos for the lampiran dokumentasi foto page
                    photos.forEach(ph => {
                        const url = typeof ph === 'string' ? ph : (ph?.url || '');
                        if (url && url.trim()) {
                            documentationPhotos.push({
                                photoUrl: url.trim(),
                                date: curr.format('dddd, DD MMMM YYYY'),
                                dateShort: curr.format('DD/MM'),
                                staffName,
                                position: posName,
                                categoryTag: item.categoryTag || 'UMUM',
                                activity: item.text || 'Dokumentasi Lapangan',
                                status: item.status || 'COMPLETED',
                                obstacleNote: item.obstacleNote || ''
                            });
                        }
                    });

                    if (item.text || photos.length > 0) {
                        const status = item.status || 'COMPLETED';
                        const textClean = (item.text || '').trim();

                        positionMap[posName].totalActivities++;
                        if (status === 'COMPLETED') {
                            totalCompleted++;
                            positionMap[posName].totalCompleted++;
                        } else if (status === 'IN_PROGRESS') {
                            totalInProgress++;
                            positionMap[posName].totalInProgress++;
                        } else if (status === 'OBSTACLE') {
                            totalObstacles++;
                            positionMap[posName].totalObstacles++;
                            obstacleList.push({
                                date: curr.format('DD/MM/YYYY'),
                                staffName,
                                position: posName,
                                activity: textClean || 'Kendala Lapangan',
                                obstacleNote: item.obstacleNote || 'Kendala'
                            });
                            positionMap[posName].obstacles.push({
                                date: curr.format('DD/MM/YYYY'),
                                note: item.obstacleNote || 'Kendala',
                                task: textClean || 'Tugas operasional'
                            });
                        }

                        if (item.categoryTag) {
                            positionMap[posName].categories.add(item.categoryTag);
                        }

                        if (textClean) {
                            positionMap[posName].taskSummaries.add(textClean);

                            // Record individual point for the staff member
                            staffMap[staffId].totalActivities++;
                            if (status === 'COMPLETED') staffMap[staffId].totalCompleted++;
                            else if (status === 'IN_PROGRESS') staffMap[staffId].totalInProgress++;
                            else if (status === 'OBSTACLE') staffMap[staffId].totalObstacles++;

                            staffMap[staffId].points.push({
                                date: curr.format('dddd, DD MMMM YYYY'),
                                dateShort: curr.format('DD/MM'),
                                text: textClean,
                                status,
                                categoryTag: item.categoryTag || 'UMUM',
                                obstacleNote: item.obstacleNote || '',
                                photos: photos.map(p => typeof p === 'string' ? p : p?.url).filter(Boolean)
                            });
                        }

                        activities.push({
                            userId: r.user?.id,
                            staffName,
                            position: posName,
                            categoryTag: item.categoryTag || 'UMUM',
                            activity: textClean || '(Dokumentasi Foto Lapangan)',
                            status,
                            obstacleNote: item.obstacleNote || '',
                            photos: photos.map(p => typeof p === 'string' ? p : p?.url).filter(Boolean)
                        });
                    }
                });
            });

            dailyDivisionBreakdown.push({
                date: curr.format('dddd, DD MMMM YYYY'),
                dateShort: curr.format('DD/MM'),
                totalActivities: activities.length,
                activities
            });

            curr = curr.add(1, 'day');
        }

        const positionSummary = Object.values(positionMap).map(p => ({
            position: p.position,
            totalCompleted: p.totalCompleted,
            totalInProgress: p.totalInProgress,
            totalObstacles: p.totalObstacles,
            totalActivities: p.totalActivities,
            completionRate: p.totalActivities > 0 ? Math.round((p.totalCompleted / p.totalActivities) * 100) : 0,
            categories: Array.from(p.categories),
            keyTasks: Array.from(p.taskSummaries),
            obstacles: p.obstacles
        })).sort((a, b) => b.totalActivities - a.totalActivities);

        // Array of staff with their respective points, sorted by staff name
        const staffSummary = Object.values(staffMap)
            .filter(s => s.points.length > 0)
            .sort((a, b) => a.staffName.localeCompare(b.staffName));

        res.json({
            success: true,
            kabid: {
                name: kabidUser?.name || req.user?.name || 'Ravi Kurnia',
                niy: kabidUser?.nip || kabidUser?.username || req.user?.nip || req.user?.username || '',
                position: kabidUser?.position || req.user?.position || 'Kepala Bidang Sarana'
            },
            period: {
                startDate: startDate.format('YYYY-MM-DD'),
                endDate: endDate.format('YYYY-MM-DD'),
                formattedPeriod: `${startDate.format('DD MMMM YYYY')} s.d. ${endDate.format('DD MMMM YYYY')}`
            },
            stats: {
                totalCompleted,
                totalInProgress,
                totalObstacles,
                totalAll: totalCompleted + totalInProgress + totalObstacles
            },
            positionSummary,
            staffSummary,
            dailyDivisionBreakdown,
            obstacleList,
            documentationPhotos
        });

    } catch (error) {
        console.error('Error generating weekly summary:', error);
        res.status(500).json({ error: 'Gagal memuat rekap mingguan' });
    }
};

/**
 * PUT /api/laporan/:id/verify
 * Kabid review & feedback on staff daily report.
 */
exports.verifyReport = async (req, res) => {
    try {
        if (!isKabid(req.user)) {
            return res.status(403).json({ error: 'Hanya Kepala Bidang Sarana yang dapat memverifikasi laporan.' });
        }

        const { id } = req.params;
        const { status, feedbackNote } = req.body; // status: 'VERIFIED' | 'NEEDS_REVISION'

        const report = await prisma.personnelReport.findUnique({
            where: { id: parseInt(id) },
            include: {
                user: {
                    select: { id: true, name: true, phone: true }
                }
            }
        });

        if (!report) {
            return res.status(404).json({ error: 'Laporan tidak ditemukan' });
        }

        const existingMetadata = typeof report.metadata === 'object' && report.metadata !== null ? report.metadata : {};
        const verificationData = {
            verifiedBy: 'Ravi Kurnia',
            status: status || 'VERIFIED',
            feedbackNote: feedbackNote || '',
            verifiedAt: new Date().toISOString()
        };

        const updated = await prisma.personnelReport.update({
            where: { id: parseInt(id) },
            data: {
                metadata: {
                    ...existingMetadata,
                    verification: verificationData
                }
            }
        });

        // Notifikasi ke staf pelapor (In-App & WhatsApp)
        if (report.userId) {
            const isVerified = verificationData.status === 'VERIFIED';
            createNotification(
                report.userId,
                'Verifikasi Laporan Harian',
                `Laporan harian Anda (${dayjs(report.date).tz('Asia/Jakarta').format('DD/MM/YYYY')}) telah ${isVerified ? 'diverifikasi ✅' : 'diminta dilengkapi ⚠️'}${verificationData.feedbackNote ? ': "' + verificationData.feedbackNote + '"' : '.'}`,
                isVerified ? 'SUCCESS' : 'WARNING',
                '/laporan-staff/laporan'
            ).catch(err => console.warn('In-app notif failed:', err.message));

            if (report.user?.phone) {
                const statusLabel = isVerified ? '✅ Terverifikasi Lengkap' : '⚠️ Perlu Dilengkapi / Revisi';
                const waMessage = `*VERIFIKASI LAPORAN HARIAN*\n\n` +
                    `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n` +
                    `Yth. *${report.user.name}*,\n\n` +
                    `Laporan harian Anda untuk tanggal *${dayjs(report.date).tz('Asia/Jakarta').format('dddd, DD MMMM YYYY')}* telah ditinjau oleh Kepala Bidang Sarana:\n\n` +
                    `📊 *Status:* ${statusLabel}\n` +
                    (verificationData.feedbackNote ? `💬 *Catatan / Arahan:* "${verificationData.feedbackNote}"\n\n` : '\n') +
                    `Silakan cek selengkapnya di aplikasi Manajemen Aset pada menu Laporan Harian.\n\n` +
                    `_Pesan otomatis Sistem Manajemen Aset Yayasan Dar el-Iman_`;

                whatsappService.sendMessage(report.user.phone, waMessage).catch(err => {
                    console.warn('[WhatsApp] Gagal kirim notifikasi verifikasi laporan:', err.message);
                });
            }
        }

        res.json({ success: true, verification: verificationData, report: updated });
    } catch (error) {
        console.error('Error verifying report:', error);
        res.status(500).json({ error: 'Gagal memverifikasi laporan' });
    }
};

/**
 * PUT /api/laporan/:id/point-review
 * Review / feedback on a specific point in a report by Kepala Bidang Sarana.
 * body: {
 *   period: 'morning' | 'afternoon',
 *   pointIndex: number,
 *   status: 'APPROVED' | 'REVISION' | 'NOTE' | null,
 *   feedbackNote: string
 * }
 */
exports.updatePointReview = async (req, res) => {
    try {
        if (!isKabid(req.user)) {
            return res.status(403).json({ error: 'Hanya Kepala Bidang Sarana yang dapat memberikan ulasan butir kegiatan.' });
        }

        const { id } = req.params;
        const { period, pointIndex, status, feedbackNote } = req.body;

        const validPeriods = ['morning', 'afternoon', 'completed', 'inprogress', 'obstacle', 'plans'];
        if (!validPeriods.includes(period)) {
            return res.status(400).json({ error: 'Kategori butir tidak valid.' });
        }

        const report = await prisma.personnelReport.findUnique({
            where: { id: parseInt(id) },
            include: {
                user: {
                    select: { id: true, name: true, phone: true }
                }
            }
        });

        if (!report) {
            return res.status(404).json({ error: 'Laporan tidak ditemukan' });
        }

        const existingMetadata = typeof report.metadata === 'object' && report.metadata !== null ? { ...report.metadata } : {};
        const manualPoints = existingMetadata.manualPoints ? { ...existingMetadata.manualPoints } : { morning: [], afternoon: [] };

        // Determine target list to update
        let targetList = [];
        let pppKey = null;
        if (period === 'completed') pppKey = 'completedItems';
        else if (period === 'inprogress') pppKey = 'inProgressItems';
        else if (period === 'obstacle') pppKey = 'obstacleItems';
        else if (period === 'plans') pppKey = 'tomorrowPlans';

        if (pppKey) {
            targetList = Array.isArray(existingMetadata[pppKey]) ? [...existingMetadata[pppKey]] : [];
        } else {
            targetList = Array.isArray(manualPoints[period]) ? [...manualPoints[period]] : [];
        }

        if (pointIndex < 0 || pointIndex >= targetList.length) {
            return res.status(400).json({ error: 'Indeks butir laporan tidak ditemukan' });
        }

        const targetPoint = { ...targetList[pointIndex] };
        const pointText = targetPoint.title || targetPoint.text || targetPoint.obstacleNote || 'Dokumentasi Lapangan';
        let reviewData = null;

        // If status is null and feedbackNote is empty, remove review
        if (!status && (!feedbackNote || !feedbackNote.trim())) {
            delete targetPoint.review;
        } else {
            reviewData = {
                status: status || 'NOTE',
                feedbackNote: (feedbackNote || '').trim(),
                reviewerName: req.user.name || 'Ravi Kurnia',
                reviewedAt: new Date().toISOString()
            };
            targetPoint.review = reviewData;
        }

        targetList[pointIndex] = targetPoint;

        const updatedMetadata = { ...existingMetadata };
        if (pppKey) {
            updatedMetadata[pppKey] = targetList;
            // Also sync to legacy manualPoints if present so both representations stay synced
            if (period === 'completed' && Array.isArray(manualPoints.morning) && manualPoints.morning[pointIndex]) {
                manualPoints.morning[pointIndex] = { ...manualPoints.morning[pointIndex], review: reviewData };
                updatedMetadata.manualPoints = manualPoints;
            } else if (period === 'inprogress' && Array.isArray(manualPoints.afternoon) && manualPoints.afternoon[pointIndex]) {
                manualPoints.afternoon[pointIndex] = { ...manualPoints.afternoon[pointIndex], review: reviewData };
                updatedMetadata.manualPoints = manualPoints;
            }
        } else {
            manualPoints[period] = targetList;
            updatedMetadata.manualPoints = manualPoints;
            // Also sync to corresponding PPP item if present
            if (period === 'morning' && Array.isArray(updatedMetadata.completedItems) && updatedMetadata.completedItems[pointIndex]) {
                updatedMetadata.completedItems[pointIndex] = { ...updatedMetadata.completedItems[pointIndex], review: reviewData };
            } else if (period === 'afternoon' && Array.isArray(updatedMetadata.inProgressItems) && updatedMetadata.inProgressItems[pointIndex]) {
                updatedMetadata.inProgressItems[pointIndex] = { ...updatedMetadata.inProgressItems[pointIndex], review: reviewData };
            }
        }

        const updated = await prisma.personnelReport.update({
            where: { id: parseInt(id) },
            data: {
                metadata: updatedMetadata
            }
        });

        // Beri tahu staf yang diulas via In-App Notification dan WhatsApp
        if (reviewData && report.userId) {
            const sessionName = (period === 'completed' || period === 'morning') ? 'Pekerjaan Selesai' 
                : ((period === 'inprogress' || period === 'afternoon') ? 'Dalam Proses' 
                : (period === 'obstacle' ? 'Kendala Lapangan' : 'Rencana Kerja'));
            const statusLabel = reviewData.status === 'APPROVED' ? '✅ Disetujui / Sesuai' : (reviewData.status === 'REVISION' ? '⚠️ Perlu Perbaikan' : '💡 Catatan Arahan');

            // 1. In-App Notification
            createNotification(
                report.userId,
                `Ulasan Kegiatan: ${sessionName} #${pointIndex + 1}`,
                `Ulasan Kabid (${statusLabel}): "${pointText.substring(0, 45)}${pointText.length > 45 ? '...' : ''}"${reviewData.feedbackNote ? ' - ' + reviewData.feedbackNote : ''}`,
                reviewData.status === 'APPROVED' ? 'SUCCESS' : (reviewData.status === 'REVISION' ? 'WARNING' : 'INFO'),
                '/laporan-staff/laporan'
            ).catch(err => console.warn('In-app notif failed:', err.message));

            // 2. WhatsApp Notification
            if (report.user?.phone) {
                const waMessage = `*ULASAN BUTIR KEGIATAN LAPORAN*\n\n` +
                    `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n` +
                    `Yth. *${report.user.name}*,\n\n` +
                    `Kepala Bidang Sarana (Ustadz Ravi Kurnia) telah memberikan ulasan pada butir kegiatan Anda:\n\n` +
                    `📅 *Tanggal:* ${dayjs(report.date).tz('Asia/Jakarta').format('dddd, DD MMMM YYYY')}\n` +
                    `📌 *Kategori:* ${sessionName} (Butir #${pointIndex + 1})\n` +
                    `📝 *Kegiatan:* ${pointText}\n` +
                    `📊 *Penilaian:* ${statusLabel}\n` +
                    (reviewData.feedbackNote ? `💬 *Catatan / Arahan:* "${reviewData.feedbackNote}"\n\n` : '\n') +
                    `Silakan cek selengkapnya di aplikasi Manajemen Aset pada menu Laporan Harian.\n\n` +
                    `_Pesan otomatis Sistem Manajemen Aset Yayasan Dar el-Iman_`;

                whatsappService.sendMessage(report.user.phone, waMessage).catch(err => {
                    console.warn('[WhatsApp] Gagal kirim notifikasi ulasan butir kegiatan:', err.message);
                });
            }
        }

        res.json({
            success: true,
            period,
            pointIndex,
            review: reviewData,
            report: updated
        });
    } catch (error) {
        console.error('Error updating point review:', error);
        res.status(500).json({ error: 'Gagal memperbarui ulasan butir kegiatan' });
    }
};

/**
 * GET /api/laporan/my-stats
 * Personal scorecard for Admin Aset including missed working days list.
 */
exports.getMyStats = async (req, res) => {
    try {
        const userId = parseInt(req.user.id, 10);
        const { month } = req.query; // format YYYY-MM opsional
        const now = dayjs().tz('Asia/Jakarta');
        
        let targetMonth = now;
        if (month && dayjs(month).isValid()) {
            targetMonth = dayjs.tz(month, 'Asia/Jakarta');
        }

        const monthStart = targetMonth.startOf('month');
        const monthEnd = targetMonth.endOf('month');

        const monthReports = await prisma.personnelReport.findMany({
            where: {
                userId,
                type: 'DAILY',
                NOT: { content: 'SETORAN_HAFALAN' },
                date: { gte: monthStart.toDate(), lte: monthEnd.toDate() }
            },
            orderBy: { date: 'desc' }
        });

        let completedDays = 0;
        let totalActivities = 0;
        let latestFeedback = null;

        // Hitung hari kerja (Senin - Jumat) dari tanggal 1 sampai hari ini (atau akhir bulan jika melihat bulan lalu)
        const missedDates = [];
        let curr = monthStart.clone();
        const todayStr = now.format('YYYY-MM-DD');
        const limitDate = targetMonth.isSame(now, 'month') ? now : monthEnd;

        while (curr.isBefore(limitDate) || curr.format('YYYY-MM-DD') === limitDate.format('YYYY-MM-DD')) {
            const dayOfWeek = curr.day(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
            if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                const dateStr = curr.format('YYYY-MM-DD');
                
                // Cari SEMUA laporan pada tanggal tersebut agar tidak tertahan pada baris autoLog
                const dayReports = monthReports.filter(r => dayjs(r.date).tz('Asia/Jakarta').format('YYYY-MM-DD') === dateStr);
                const hasSubmitted = dayReports.some(r => isReportSubmitted(r));

                if (hasSubmitted) {
                    completedDays++;
                } else {
                    missedDates.push({
                        date: dateStr,
                        formattedDate: curr.format('dddd, DD MMMM YYYY'),
                        shortDate: curr.format('DD MMM'),
                        hasMorning: false,
                        hasAfternoon: false,
                        status: 'BELUM',
                        isToday: dateStr === todayStr
                    });
                }
            }
            curr = curr.add(1, 'day');
        }

        // Hitung total kegiatan dan ambil umpan balik verifikasi terakhir Kabid
        monthReports.forEach(r => {
            const pts = r.metadata?.manualPoints;
            const m = pts?.morning || pts?.morningPoints || [];
            const a = pts?.afternoon || pts?.afternoonPoints || [];
            totalActivities += ((Array.isArray(m) ? m.length : 0) + (Array.isArray(a) ? a.length : 0));

            if (!latestFeedback && r.metadata?.verification?.feedbackNote) {
                latestFeedback = {
                    date: dayjs(r.date).tz('Asia/Jakarta').format('DD MMM YYYY'),
                    status: r.metadata.verification.status,
                    note: r.metadata.verification.feedbackNote,
                    by: r.metadata.verification.verifiedBy
                };
            }
        });

        // Total hari kerja yang sudah berjalan
        let totalWorkDaysPassed = 0;
        let countCurr = monthStart.clone();
        while (countCurr.isBefore(limitDate) || countCurr.format('YYYY-MM-DD') === limitDate.format('YYYY-MM-DD')) {
            const d = countCurr.day();
            if (d >= 1 && d <= 5) totalWorkDaysPassed++;
            countCurr = countCurr.add(1, 'day');
        }

        const disciplineScore = totalWorkDaysPassed > 0 
            ? Math.min(100, Math.round((completedDays / totalWorkDaysPassed) * 100)) 
            : 100;

        res.json({
            success: true,
            stats: {
                completedDays,
                totalWorkDaysPassed,
                totalActivities,
                disciplineScore,
                latestFeedback,
                missedDates // Array hari kerja yang belum lengkap
            }
        });
    } catch (error) {
        console.error('Error fetching personal stats:', error);
        res.status(500).json({ error: 'Gagal memuat statistik personal' });
    }
};

/**
 * POST /api/laporan/ai/analyze
 * Gemini AI analysis for Kabid Sarpras (Single Date or Custom Date Range).
 */
exports.analyzeWithAI = async (req, res) => {
    try {
        if (!isKabid(req.user)) {
            return res.status(403).json({ error: 'Akses ditolak.' });
        }

        const { date, startDate, endDate, mode = 'DAILY_DIGEST' } = req.body; // mode: 'DAILY_DIGEST' | 'TEAM_PERFORMANCE' | 'OBSTACLE_SOLUTIONS'
        
        let targetStart, targetEnd, formattedPeriod;
        
        if (startDate && endDate) {
            targetStart = dayjs(startDate).tz('Asia/Jakarta').startOf('day');
            targetEnd = dayjs(endDate).tz('Asia/Jakarta').endOf('day');
            formattedPeriod = targetStart.isSame(targetEnd, 'day')
                ? targetStart.format('DD MMMM YYYY')
                : `${targetStart.format('DD MMMM YYYY')} s.d. ${targetEnd.format('DD MMMM YYYY')}`;
        } else {
            const targetDate = date ? dayjs.tz(date, 'Asia/Jakarta') : dayjs().tz('Asia/Jakarta');
            targetStart = targetDate.startOf('day');
            targetEnd = targetDate.endOf('day');
            formattedPeriod = targetStart.format('DD MMMM YYYY');
        }

        const reports = await prisma.personnelReport.findMany({
            where: {
                type: 'DAILY',
                NOT: { content: 'SETORAN_HAFALAN' },
                date: { gte: targetStart.toDate(), lte: targetEnd.toDate() },
                user: STAFF_USER_WHERE
            },
            include: {
                user: { select: { id: true, name: true, position: true, role: true } }
            },
            orderBy: { date: 'asc' }
        });

        // Strictly exclude any reports submitted by Kepala Bidang Sarana
        const validReports = reports.filter(r => {
            const u = r.user;
            if (!u) return false;
            const role = (u.role || '').toUpperCase();
            const pos = (u.position || '').toLowerCase();
            const name = (u.name || '').toLowerCase();
            return !(
                role === 'KABID_SARPRAS' ||
                role === 'SUPER_ADMIN' ||
                pos.includes('kepala bidang') ||
                pos.includes('kabid') ||
                name.includes('ravi kurnia')
            );
        });

        const activityList = [];
        const obstacles = [];
        const staffTaskCount = {};

        validReports.forEach(r => {
            const pts = r.metadata?.manualPoints;
            const m = pts?.morning || pts?.morningPoints || [];
            const a = pts?.afternoon || pts?.afternoonPoints || [];
            const staffName = r.user?.name || 'Staf';
            const staffPos = r.user?.position || 'Staf Sarana';
            const dateStr = dayjs(r.date).format('DD/MM/YYYY');

            [...m, ...a].forEach(item => {
                if (item.text) {
                    staffTaskCount[staffName] = (staffTaskCount[staffName] || 0) + 1;
                    activityList.push({
                        date: dateStr,
                        staff: staffName,
                        position: staffPos,
                        category: item.categoryTag || 'UMUM',
                        text: item.text,
                        status: item.status || 'COMPLETED'
                    });
                    if (item.status === 'OBSTACLE' || item.obstacleNote) {
                        obstacles.push({
                            date: dateStr,
                            staff: staffName,
                            position: staffPos,
                            activity: item.text,
                            obstacleNote: item.obstacleNote
                        });
                    }
                }
            });
        });

        // Build position-based data mapping (strictly by position, masking staff personal names)
        const positionGrouping = {};
        activityList.forEach(a => {
            const pos = a.position || 'Staf Sarana';
            if (!positionGrouping[pos]) {
                positionGrouping[pos] = {
                    position: pos,
                    categories: new Set(),
                    tasks: [],
                    obstacles: []
                };
            }
            if (a.category) positionGrouping[pos].categories.add(a.category);
            if (a.text) positionGrouping[pos].tasks.push(a.text);
        });

        obstacles.forEach(o => {
            const pos = o.position || 'Staf Sarana';
            if (positionGrouping[pos] && o.obstacleNote) {
                positionGrouping[pos].obstacles.push(o.obstacleNote);
            }
        });

        const positionSummaryText = Object.values(positionGrouping).map(p => {
            const cats = Array.from(p.categories).join(', ') || 'Umum';
            const sampleTasks = p.tasks.slice(0, 20).join('; ');
            const obsInfo = p.obstacles.length > 0 ? `Catatan kendala: ${p.obstacles.slice(0, 3).join('; ')}` : 'Operasional lancar tanpa kendala kritis.';
            return `### ${p.position}\n- Bidang Tugas: ${cats}\n- Realisasi Pekerjaan: ${sampleTasks}\n- Kondisi Lapangan: ${obsInfo}`;
        }).join('\n\n');

        let prompt = '';
        if (mode === 'STAFF_NARRATIVE') {
            prompt = `
Anda adalah Asisten Eksekutif Kepala Bidang Sarana Yayasan Dar el-Iman Padang.
Tugas Anda adalah menyusun "RANGKUMAN NARASI KINERJA PER POSISI STAF" dalam format NARASI RESMI (prosa deskriptif) untuk dicantumkan dalam Dokumen Laporan Kinerja Mingguan kepada Pimpinan Yayasan (Periode: ${formattedPeriod}).

Berikut data aktivitas kerja lapangan per posisi staf:
${positionSummaryText}

INSTRUKSI DAN ATURAN WAJIB (SANGAT KETAT):
1. JANGAN PERNAH MENGGUNAKAN FORMAT TABEL DALAM BENTUK APAPUN! Seluruh laporan wajib disajikan dalam bentuk narasi / paragraf deskriptif mengalir yang elegan dan terstruktur.
2. JANGAN MEMUNCULKAN NAMA PRIBADI STAF! Sebutkan hanya POSISI / JABATAN staf (misal: "Staf Pemeliharaan Kelistrikan & AC", "Staf Sipil & Bangunan", "Staf Pengemudi & Operasional Armada", dll).
3. TIDAK PERLU mencantumkan persentase capaian kinerja (DILARANG menampilkan angka persentase seperti 80%, 100%, dll).
4. TIDAK PERLU mencantumkan angka jumlah pekerjaan selesai dan berapa pekerjaan yang diproses (DILARANG menampilkan metrik angka selesai / dalam proses).
5. Untuk setiap posisi staf di atas, buatkan 1 (satu) sampai 2 (dua) paragraf narasi profesional yang merangkum:
   - Fokus pekerjaan dan ruang lingkup pemeliharaan sarana yang ditangani selama periode laporan.
   - Kontribusi nyata terhadap kesiapan dan kelayakan fasilitas dakwah, pendidikan, maupun operasional yayasan.
   - Kesiapsiagaan serta penyelesaian hambatan lapangan secara umum bila ada.
6. Format penulisan per posisi:
   ### [Nama Posisi / Jabatan]
   [Paragraf narasi deskriptif yang rapi, mengapresiasi kinerja staf, lugas, dan bernada eksekutif formal].
7. Gunakan Bahasa Indonesia baku, santun, objektif, dan berwibawa tinggi sehingga sangat layak dipresentasikan kepada Dewan Pimpinan Yayasan.
`;
        } else if (mode === 'WEEKLY_EXECUTIVE') {
            prompt = `
Anda adalah Asisten Eksekutif Senior & Konsultan Manajemen Fasilitas Yayasan Dar el-Iman / Bidang Sarana & Prasarana.
Berikut data rekapitulasi kinerja & aktivitas kerja tim Sarpras untuk periode laporan (${formattedPeriod}):

RINGKASAN POSISI STAF LAPANGAN:
${positionSummaryText}

TUGAS ANDA:
Buatkan "ANALISIS & EVALUASI STRATEGIS KINERJA BIDANG SARANA" resmi untuk dicantumkan dalam Dokumen Laporan Mingguan Kepala Bidang Sarana kepada Pimpinan Yayasan.
Laporan disajikan dalam bentuk NARASI RESMI TANPA TABEL, TANPA NAMA PRIBADI STAF, TANPA PERSENTASE CAPAIAN, DAN TANPA METRIK ANGKA SELESAI/PROSES.

Laporan memuat struktur naratif berikut:
1. 🎯 IKHTISAR CAPAIAN & PROGRES STRATEGIS FASILITAS:
   Sintesis pekerjaan yang berhasil dituntaskan dan dampak operasionalnya bagi fasilitas dakwah dan pendidikan yayasan.
2. 👥 RANGKUMAN NARASI KINERJA PER POSISI STAF:
   Ulasan naratif per posisi/jabatan staf (tanpa nama pribadi, tanpa persentase angka) mengenai bidang tugas yang ditangani dan kontribusinya.
3. ⚠️ EVALUASI PENANGANAN KENDALA LAPANGAN & MITIGASI:
   Evaluasi hambatan teknis/material di lapangan serta langkah penanganan cepat yang dilakukan tim sarana.
4. 💡 REKOMENDASI KEBIJAKAN & ARAHAN TINDAK LANJUT UNTUK PIMPINAN:
   3-4 poin rekomendasi strategis alokasi anggaran dan pemeliharaan preventif demi kelancaran sarana yayasan.

Gunakan bahasa Indonesia baku, lugas, elegan, bernada eksekutif formal, tanpa basa-basi, dan terstruktur rapi.
`;
        } else if (mode === 'OBSTACLE_SOLUTIONS') {
            prompt = `
Anda adalah Konsultan Ahli Manajemen Fasilitas & Sarana Prasarana Yayasan Dar el-Iman Padang.
Berikut daftar kendala operasional lapangan yang dilaporkan tim selama periode (${formattedPeriod}):

${obstacles.length === 0 ? 'Alhamdulillah, tidak ada kendala/masalah kritis yang dilaporkan pada periode ini.' : obstacles.map((o, idx) => `${idx + 1}. [${o.date}] Posisi: ${o.position || 'Staf Sarana'} | Pekerjaan: ${o.activity} | Kendala: ${o.obstacleNote}`).join('\n')}

TUGAS ANDA:
Berikan analisis akar masalah, langkah mitigasi cepat, alokasi solusi praktis, dan rekomendasi arahan prioritas bagi Kepala Bidang Sarana (Ustadz Ravi Kurnia) untuk mengatasi kendala-kendala tersebut.
Gunakan format narasi poin yang tegas, profesional, dan solutif tanpa tabel dan tanpa nama pribadi staf.
`;
        } else if (mode === 'TEAM_PERFORMANCE') {
            prompt = `
Anda adalah Asisten Eksekutif Evaluasi Kinerja untuk Kepala Bidang Sarana Yayasan Dar el-Iman Padang.
Berikut data kontribusi kerja staf Sarpras selama periode (${formattedPeriod}):

${positionSummaryText}

TUGAS ANDA:
Buatkan "Evaluasi Produktivitas & Distribusi Beban Kerja Tim Sarana" untuk Kepala Bidang Sarana dalam bentuk narasi tanpa tabel:
1. 📊 Penilaian Keseimbangan & Beban Kerja Tim.
2. 🌟 Posisi Staf yang Menghadapi Volume Penanganan Tertinggi & Catatan Kinerja.
3. 💡 Saran Strategis untuk Peningkatan Efektivitas & Koordinasi Lapangan.

Gunakan bahasa Indonesia formal, elegan, objektif, tanpa tabel, tanpa nama pribadi staf, dan tanpa metrik persentase.
`;
        } else {
            prompt = `
Anda adalah Asisten Eksekutif Cerdas untuk Kepala Bidang Sarana Yayasan Dar el-Iman Padang.
Berikut data laporan kinerja per posisi staf tim Sarpras untuk periode (${formattedPeriod}):

${positionSummaryText}

TUGAS ANDA:
Buatkan "Rangkuman Eksekutif & Narasi Kinerja Tim Sarana" untuk periode ${formattedPeriod} dalam bentuk teks narasi tanpa tabel, tanpa nama pribadi staf, dan tanpa persentase angka:
1. 🎯 Capaian Utama & Progres Operasional Pemeliharaan Fasilitas.
2. 👥 Rangkuman Narasi Kinerja Masing-Masing Posisi Staf.
3. ⚠️ Isu/Hambatan Lapangan & Rekomendasi Solusi untuk Kepala Bidang Sarana.

Gunakan bahasa Indonesia baku, elegan, dan bernilai eksekutif tinggi.
`;
        }

        let resultText = '';
        try {
            const aiResponse = await aiService.generateContentWithFallback(prompt);
            resultText = aiResponse?.response?.text() || '';
        } catch (aiErr) {
            console.warn('[LaporanAI] Gemini AI error, generating programmatic fallback narrative analysis:', aiErr.message);
            resultText = Object.values(positionGrouping).map(p => {
                const cats = Array.from(p.categories).join(', ') || 'sarana dan prasarana';
                const sampleTasks = p.tasks.slice(0, 4).join(', ');
                const moreText = p.tasks.length > 4 ? ` serta penanganan agenda pemeliharaan teknis pendukung lainnya` : '';
                return `### ${p.position}\nSelama periode ${formattedPeriod}, ${p.position} fokus menjalankan pemeliharaan dan pengawalan sarana di bidang ${cats}. Pekerjaan yang dilaksanakan mencakup ${sampleTasks}${moreText}. Seluruh penugasan diarahkan untuk memastikan fasilitas yayasan selalu dalam kondisi prima, aman, dan siap menunjang kelancaran program dakwah dan pendidikan Yayasan Dar el Iman.`;
            }).join('\n\n');
        }

        res.json({
            success: true,
            period: formattedPeriod,
            startDate: targetStart.format('YYYY-MM-DD'),
            endDate: targetEnd.format('YYYY-MM-DD'),
            totalActivities: activityList.length,
            totalObstacles: obstacles.length,
            analysis: resultText,
            generatedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error running AI analysis:', error);
        res.status(500).json({ error: error.message || 'Gagal menjalankan analisis AI' });
    }
};

/**
 * POST /api/laporan/upload-photo
 * Direct photo upload to MinIO bucket sarpras-media/laporan/
 */
exports.uploadReportPhoto = async (req, res) => {
    try {
        if (!req.file && !req.body.base64) {
            return res.status(400).json({ error: 'Tidak ada file foto yang dikirim' });
        }

        let fileBuffer, fileName, mimeType;

        if (req.file) {
            fileBuffer = req.file.buffer;
            fileName = req.file.originalname;
            mimeType = req.file.mimetype;
        } else if (req.body.base64) {
            const matches = req.body.base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                return res.status(400).json({ error: 'Format base64 tidak valid' });
            }
            mimeType = matches[1];
            fileBuffer = Buffer.from(matches[2], 'base64');
            const ext = mimeType.split('/')[1] || 'jpg';
            fileName = `report_${req.user.id}_${Date.now()}.${ext}`;
        }

        const fileUrl = await uploadFile(fileBuffer, fileName, mimeType, 'laporan');

        res.json({
            success: true,
            url: fileUrl,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error uploading report photo to MinIO:', error);
        res.status(500).json({ error: 'Gagal mengunggah foto ke MinIO' });
    }
};

/**
 * Cron Job: Send daily report reminders to Admin Aset staff only.
 * Morning trigger: 13:30 WIB
 * Afternoon trigger: 19:00 WIB
 * Skipped on Saturdays, Sundays, and National Holidays.
 */
exports.sendReportReminders = async () => {
    try {
        const targetDate = dayjs().tz('Asia/Jakarta');

        // Pengecekan hari libur: Sabtu, Ahad, dan Libur Nasional tidak dikirimkan
        const offDayCheck = await isHolidayOrWeekend(targetDate, prisma);
        if (offDayCheck.isOffDay) {
            console.log(`[Scheduler] Pengingat laporan tidak dikirimkan: Hari ini adalah ${offDayCheck.reason}.`);
            return;
        }

        const startOfDay = targetDate.startOf('day').toDate();
        const endOfDay = targetDate.endOf('day').toDate();
        const isFriday = targetDate.day() === 5;
        const planSectionName = isFriday ? 'Rencana Pekerjaan Pekan Depan' : 'Rencana Kerja Besok';

        // Target ONLY Admin Aset staff (Exclude Kepala Bidang Sarana)
        const staffUsers = await prisma.user.findMany({
            where: STAFF_USER_WHERE,
            select: { id: true, name: true, phone: true }
        });

        const reports = await prisma.personnelReport.findMany({
            where: { 
                type: 'DAILY', 
                NOT: { content: 'SETORAN_HAFALAN' },
                date: { gte: startOfDay, lte: endOfDay },
                user: STAFF_USER_WHERE
            }
        });

        for (const user of staffUsers) {
            const userReports = reports.filter(r => r.userId === user.id);
            const hasReported = userReports.some(r => isReportSubmitted(r));

            if (!hasReported) {
                // In-App Notification
                createNotification(
                    user.id,
                    `Pengingat Laporan Harian & ${planSectionName}`,
                    `Mengingatkan di sore hari ini untuk mengisi Laporan Kegiatan Harian (Metode PPP) serta menyusun ${planSectionName}. Silakan segera lengkapi di menu Laporan Harian.`,
                    'WARNING',
                    '/laporan-staff/laporan'
                ).catch(err => console.warn('In-app reminder error:', err.message));

                if (user.phone) {
                    const msg = `*PENGINGAT PENGISIAN LAPORAN HARIAN & RENCANA KERJA*\n\n` +
                        `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n` +
                        `Halo *${user.name}*,\n\n` +
                        `Mengingatkan kembali di sore hari ini untuk mengisi *Laporan Kegiatan Harian (Metode PPP)* serta menyusun *${planSectionName}* pada aplikasi Sistem Manajemen Aset.\n\n` +
                        `📌 *Panduan Pengisian Laporan Harian (Metode PPP):*\n` +
                        `1. 🟢 *Pekerjaan Selesai:* Butir tugas yang tuntas 100% hari ini\n` +
                        `2. 🟡 *Sedang Dikerjakan:* Butir tugas yang masih dalam proses\n` +
                        `3. 🔴 *Kendala Lapangan:* Kendala dan tindak lanjut (jika ada)\n` +
                        `4. 🟣 *${planSectionName}:* Rencana tugas hari berikutnya (opsional / dianjurkan)\n\n` +
                        `Mohon segera melengkapi laporan kegiatan Anda di menu *Laporan Harian*.\n\n` +
                        `Terima kasih atas kerja samanya.\n` +
                        `_Pesan otomatis Sistem Manajemen Aset Yayasan Dar el-Iman_`;
                    await whatsappService.sendMessage(user.phone, msg);
                }
            }
        }
    } catch (error) {
        console.error('Error sending report reminders:', error);
    }
};

/**
 * POST /api/laporan/remind-staff
 * Manual trigger by Kepala Bidang Sarana to remind staff who haven't completed daily report.
 * body: {
 *   userId?: number, // optional: if specified, reminds this user only; if not, reminds all incomplete staff
 *   date?: string // format YYYY-MM-DD, defaults to today WIB
 * }
 */
exports.remindStaffMissingReport = async (req, res) => {
    try {
        if (!isKabid(req.user)) {
            return res.status(403).json({ error: 'Hanya Kepala Bidang Sarana yang dapat mengirimkan pengingat laporan.' });
        }

        const { userId, date } = req.body;
        const targetDate = date ? dayjs.tz(date, 'Asia/Jakarta') : dayjs().tz('Asia/Jakarta');

        // Pengecekan hari libur: Sabtu, Ahad, dan Libur Nasional tidak dikirimkan
        const offDayCheck = await isHolidayOrWeekend(targetDate, prisma);
        if (offDayCheck.isOffDay) {
            return res.status(400).json({ 
                error: `Hari yang dipilih (${targetDate.format('dddd, DD MMMM YYYY')}) adalah ${offDayCheck.reason}. Pemberitahuan pengisian laporan pada hari Sabtu, Ahad, dan libur nasional tidak dikirimkan.` 
            });
        }

        const startOfDay = targetDate.startOf('day').toDate();
        const endOfDay = targetDate.endOf('day').toDate();
        const dateFormatted = targetDate.format('dddd, DD MMMM YYYY');

        // Filter staff users
        const whereClause = { ...STAFF_USER_WHERE };
        if (userId) {
            whereClause.id = parseInt(userId, 10);
        }

        const staffUsers = await prisma.user.findMany({
            where: whereClause,
            select: { id: true, name: true, position: true, phone: true }
        });

        if (!staffUsers.length) {
            return res.status(404).json({ error: 'Staf tidak ditemukan.' });
        }

        // Fetch reports on target date
        const reports = await prisma.personnelReport.findMany({
            where: {
                type: 'DAILY',
                NOT: { content: 'SETORAN_HAFALAN' },
                date: { gte: startOfDay, lte: endOfDay },
                user: STAFF_USER_WHERE
            }
        });

        const remindedList = [];

        const isFriday = targetDate.day() === 5;
        const planSectionName = isFriday ? 'Rencana Pekerjaan Pekan Depan' : 'Rencana Kerja Besok';

        for (const staff of staffUsers) {
            const userReports = reports.filter(r => r.userId === staff.id);
            const hasReported = userReports.some(r => isReportSubmitted(r));

            // Jika sudah melaporkan secara utuh, lewati
            if (hasReported) {
                continue;
            }

            // 1. Send In-App Notification
            createNotification(
                staff.id,
                `Pengingat Laporan Harian & ${planSectionName}`,
                `Ustadz Ravi Kurnia mengingatkan Anda untuk segera melengkapi Laporan Kegiatan Harian (Metode PPP) dan menyusun ${planSectionName} tanggal ${dateFormatted}.`,
                'WARNING',
                '/laporan-staff/laporan'
            ).catch(err => console.warn('In-app reminder error:', err.message));

            // 2. Send WhatsApp Notification
            if (staff.phone) {
                const waMessage = `*PENGINGAT PENGISIAN LAPORAN HARIAN & RENCANA KERJA*\n\n` +
                    `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n` +
                    `Yth. *${staff.name}* (${staff.position || 'Staf Sarana'}),\n\n` +
                    `Pemberitahuan dari Kepala Bidang Sarana (Ustadz Ravi Kurnia):\n\n` +
                    `Anda terpantau belum mengisi / melengkapi laporan kerja untuk:\n` +
                    `📅 *Hari/Tanggal:* ${dateFormatted}\n` +
                    `📝 *Agenda:* Laporan Kegiatan Harian (Metode PPP) & ${planSectionName}\n\n` +
                    `Mohon untuk segera mengisi rincian kegiatan kerja serta rencana kerja Anda melalui menu *Laporan Harian* pada aplikasi Sistem Manajemen Aset.\n\n` +
                    `Terima kasih atas kerja sama dan dedikasinya.\n\n` +
                    `_Pesan resmi Sistem Manajemen Aset Yayasan Dar el-Iman_`;

                whatsappService.sendMessage(staff.phone, waMessage).catch(err => {
                    console.warn(`[WhatsApp] Gagal kirim pengingat ke ${staff.name}:`, err.message);
                });
            }

            remindedList.push({
                id: staff.id,
                name: staff.name,
                position: staff.position,
                phone: staff.phone,
                missingSession: 'Laporan Harian (PPP)'
            });
        }

        res.json({
            success: true,
            totalReminded: remindedList.length,
            remindedList,
            message: remindedList.length > 0 
                ? `Berhasil mengirim pengingat ke ${remindedList.length} staf.` 
                : 'Semua staf yang diperiksa sudah mengisi laporan lengkap.'
        });

    } catch (error) {
        console.error('Error reminding staff:', error);
        res.status(500).json({ error: 'Gagal mengirim pengingat ke staf.' });
    }
};

/**
 * Notify Kepala Bidang Sarana about staff who haven't reported for 2 working days (Monday - Friday).
 * Runs Monday to Friday at 16:30 WIB.
 */
exports.notifyKabidInactiveStaff = async (req, res) => {
    try {
        const now = dayjs().tz('Asia/Jakarta');

        // Hari kerja: Senin (1) sampai Jumat (5), lewati jika akhir pekan atau hari libur nasional
        const offDayCheck = await isHolidayOrWeekend(now, prisma);
        if (offDayCheck.isOffDay) {
            console.log(`[Scheduler] Hari libur terdeteksi (${offDayCheck.reason}), skipping Kabid inactivity alert.`);
            if (res) return res.json({ message: `Hari ini adalah ${offDayCheck.reason}, pengecekan dilewati.` });
            return;
        }

        const kabidUsers = await prisma.user.findMany({
            where: {
                OR: [
                    { role: 'KABID_SARPRAS' },
                    { position: { contains: 'Kepala Bidang Sarana' } },
                    { position: { contains: 'Kabid Sarpras' } }
                ]
            },
            select: { id: true, name: true, phone: true }
        });

        if (!kabidUsers.length) {
            if (res) return res.status(404).json({ error: 'Kepala Bidang Sarana tidak ditemukan.' });
            return;
        }

        const staffUsers = await prisma.user.findMany({
            where: STAFF_USER_WHERE,
            select: { id: true, name: true, position: true, phone: true }
        });

        const last2WorkDays = getLastWorkingDays(2, now);
        const startOf2WorkDays = last2WorkDays[last2WorkDays.length - 1].startOf('day').toDate();
        const endOf2WorkDays = last2WorkDays[0].endOf('day').toDate();

        const reportsIn2Days = await prisma.personnelReport.findMany({
            where: {
                type: 'DAILY',
                NOT: { content: 'SETORAN_HAFALAN' },
                date: { gte: startOf2WorkDays, lte: endOf2WorkDays },
                user: STAFF_USER_WHERE
            }
        });

        const inactiveStaff = [];
        staffUsers.forEach(st => {
            let missedDays = [];
            last2WorkDays.forEach(day => {
                const dStr = day.format('YYYY-MM-DD');
                const rep = reportsIn2Days.find(r => r.userId === st.id && dayjs(r.date).tz('Asia/Jakarta').format('YYYY-MM-DD') === dStr);
                if (!isReportSubmitted(rep)) {
                    missedDays.push(day.format('dddd, DD/MM/YYYY'));
                }
            });

            if (missedDays.length >= 2) {
                inactiveStaff.push({
                    id: st.id,
                    name: st.name,
                    position: st.position,
                    missedDays
                });
            }
        });

        if (inactiveStaff.length === 0) {
            console.log('[Scheduler] Semua staf aktif melapor dalam 2 hari kerja terakhir.');
            if (res) return res.json({ success: true, message: 'Semua staf tertib melapor dalam 2 hari kerja terakhir.', inactiveStaff: [] });
            return;
        }

        const msgLines = inactiveStaff.map((s, idx) => 
            `${idx + 1}. *${s.name}* (${s.position || 'Staf Sarana'})\n   - Tidak melapor pada: ${s.missedDays.join(' & ')}`
        ).join('\n\n');

        for (const kabid of kabidUsers) {
            const message = `📢 *PERINGATAN KEDISIPLINAN STAF - BIDANG SARANA*\n\n` +
                `Bismillah Ustadz Ravi Kurnia (Kepala Bidang Sarana),\n\n` +
                `Berikut adalah daftar staf yang *tidak mengisi laporan kegiatan selama 2 hari kerja berturut-turut* (Senin - Jumat):\n\n` +
                `${msgLines}\n\n` +
                `Mohon untuk dapat ditindaklanjuti. Laporan lengkap dapat diakses melalui menu "Laporan & Kinerja Staf".\n\n` +
                `Syukron,\n*Sistem Manajemen Aset - Bidang Sarana*`;

            if (kabid.phone) {
                await whatsappService.sendMessage(kabid.phone, message);
            }

            await createNotification(
                kabid.id,
                'Peringatan Kedisiplinan Staf (2 Hari)',
                `Terdapat ${inactiveStaff.length} staf tidak mengisi laporan selama 2 hari kerja berturut-turut.`,
                'WARNING',
                '/laporan'
            );
        }

        console.log(`[Scheduler] Berhasil mengirim peringatan 2 hari tidak lapor ke ${kabidUsers.length} Kabid untuk ${inactiveStaff.length} staf.`);
        if (res) return res.json({ success: true, message: `Peringatan berhasil dikirim ke Kepala Bidang Sarana untuk ${inactiveStaff.length} staf.`, inactiveStaff });
    } catch (error) {
        console.error('Error in notifyKabidInactiveStaff:', error);
        if (res) return res.status(500).json({ error: 'Gagal mengirim notifikasi ke Kepala Bidang Sarana.' });
    }
};

/**
 * Monthly Kabid Matrix
 */
exports.getKabidSummary = async (req, res) => {
    try {
        const targetStartDate = req.query.startDate ? dayjs.tz(req.query.startDate, 'Asia/Jakarta') : (req.query.date ? dayjs.tz(req.query.date, 'Asia/Jakarta') : dayjs().tz('Asia/Jakarta'));
        const targetEndDate = req.query.endDate ? dayjs.tz(req.query.endDate, 'Asia/Jakarta') : targetStartDate;
        
        const startOfDay = targetStartDate.startOf('day').toDate();
        const endOfDay = targetEndDate.endOf('day').toDate();

        let staffUsers = [];
        try {
            staffUsers = await prisma.user.findMany({
                where: STAFF_USER_WHERE,
                select: { id: true, name: true, position: true }
            });
        } catch (dbErr) {
            console.warn('[getKabidSummary] DB error fetching staffUsers, reading local:', dbErr.message);
            const allUsers = localData.readJson ? localData.readJson('users.json', []) : [];
            staffUsers = allUsers
                .filter(u => u.role !== 'KABID_SARPRAS' && !(u.position || '').includes('Kepala Bidang'))
                .map(u => ({ id: u.id, name: u.name, position: u.position || 'Staf Sarana' }));
        }

        let reports = [];
        try {
            reports = await prisma.personnelReport.findMany({
                where: {
                    type: 'DAILY',
                    NOT: { content: 'SETORAN_HAFALAN' },
                    date: { gte: startOfDay, lte: endOfDay },
                    user: STAFF_USER_WHERE
                }
            });
        } catch (dbErr) {
            console.warn('[getKabidSummary] DB error fetching reports, reading local:', dbErr.message);
            const allLocal = localData.readJson ? localData.readJson('daily_reports.json', []) : [];
            reports = allLocal.filter(r => {
                if (r.type !== 'DAILY' || r.content === 'SETORAN_HAFALAN') return false;
                const d = dayjs(r.date);
                return d.isAfter(targetStartDate.startOf('day').subtract(1, 'second')) && d.isBefore(targetEndDate.endOf('day').add(1, 'second'));
            });
        }

        const dateRange = [];
        let curr = targetStartDate.startOf('day');
        while (curr.isBefore(targetEndDate.endOf('day'))) {
            dateRange.push(curr.format('YYYY-MM-DD'));
            curr = curr.add(1, 'day');
        }

        const summary = staffUsers.map(user => {
            const userReports = reports.filter(r => r.userId === user.id);
            const summaryByDate = {};
            
            let rootHasMorning = false;
            let rootHasAfternoon = false;
            let rootStatus = 'BELUM';
            let rootReportData = null;
            let rootReportId = null;

            dateRange.forEach((dateStr, idx) => {
                const dateStart = dayjs.tz(dateStr, 'Asia/Jakarta').startOf('day');
                const dateEnd = dayjs.tz(dateStr, 'Asia/Jakarta').endOf('day');
                
                const dailyReports = userReports.filter(r => 
                    dayjs(r.date).isAfter(dateStart.subtract(1, 'second')) && 
                    dayjs(r.date).isBefore(dateEnd.add(1, 'second'))
                );

                let hasReport = false;
                let isPppFormat = false;
                let hasMorning = false;
                let hasAfternoon = false;
                let allCompleted = [];
                let allInProgress = [];
                let allObstacles = [];
                let allTomorrowPlans = [];
                let allMorningPoints = [];
                let allAfternoonPoints = [];
                let foundReportId = null;

                for (const r of dailyReports) {
                    if (!foundReportId) foundReportId = r.id;
                    const meta = r.metadata || {};

                    const c = Array.isArray(meta.completedItems) ? meta.completedItems.filter(p => p && ((p.title && p.title.trim()) || (p.text && p.text.trim()) || (p.photos && p.photos.length > 0))) : [];
                    const ip = Array.isArray(meta.inProgressItems) ? meta.inProgressItems.filter(p => p && ((p.title && p.title.trim()) || (p.text && p.text.trim()) || (p.photos && p.photos.length > 0))) : [];
                    const obs = Array.isArray(meta.obstacleItems) ? meta.obstacleItems.filter(p => p && ((p.title && p.title.trim()) || (p.obstacleNote && p.obstacleNote.trim()) || (p.photos && p.photos.length > 0))) : [];
                    const tp = Array.isArray(meta.tomorrowPlans) ? meta.tomorrowPlans.filter(p => p && ((p.title && p.title.trim()) || (p.text && p.text.trim()))) : [];

                    if (c.length > 0 || ip.length > 0 || obs.length > 0 || tp.length > 0) {
                        isPppFormat = true;
                        hasReport = true;
                        allCompleted.push(...c);
                        allInProgress.push(...ip);
                        allObstacles.push(...obs);
                        allTomorrowPlans.push(...tp);
                    }

                    if (meta.manualPoints) {
                        const pts = meta.manualPoints;
                        const m = pts.morningPoints || pts.morning || [];
                        const a = pts.afternoonPoints || pts.afternoon || [];
                        const mValid = Array.isArray(m) && m.some(p => p && ((typeof p === 'string' && p.trim()) || (p.text && p.text.trim()) || (p.photos && p.photos.length > 0)));
                        const aValid = Array.isArray(a) && a.some(p => p && ((typeof p === 'string' && p.trim()) || (p.text && p.text.trim()) || (p.photos && p.photos.length > 0)));

                        if (mValid) hasMorning = true;
                        if (aValid) hasAfternoon = true;
                        if (mValid || aValid) hasReport = true;

                        if (Array.isArray(m)) allMorningPoints.push(...m);
                        if (Array.isArray(a)) allAfternoonPoints.push(...a);
                    } else if (r.content && r.content.trim()) {
                        hasReport = true;
                    }

                    if (isReportSubmitted(r)) {
                        hasReport = true;
                    }
                }

                // Tentukan status kedisiplinan:
                // Format Baru PPP: 1 laporan per hari. Setiap laporan yang telah disubmit adalah LENGKAP (✓).
                // Arsip Lama (sebelum 26 Okt 2026 dan hanya memiliki manualPoints lama):
                // Jika memiliki 2 sesi -> LENGKAP, jika hanya 1 sesi -> PARSIAL.
                let status = 'BELUM';
                if (hasReport) {
                    const isNewFormatDate = dateStr >= '2026-10-26';
                    if (isPppFormat || isNewFormatDate) {
                        status = 'LENGKAP';
                    } else if (hasMorning && hasAfternoon) {
                        status = 'LENGKAP';
                    } else if (hasMorning || hasAfternoon) {
                        status = 'PARSIAL';
                    } else {
                        status = 'LENGKAP';
                    }
                }

                const reportData = (allCompleted.length > 0 || allInProgress.length > 0 || allObstacles.length > 0 || allTomorrowPlans.length > 0 || allMorningPoints.length > 0 || allAfternoonPoints.length > 0)
                    ? {
                        completedItems: allCompleted,
                        inProgressItems: allInProgress,
                        obstacleItems: allObstacles,
                        tomorrowPlans: allTomorrowPlans,
                        morning: allMorningPoints,
                        afternoon: allAfternoonPoints
                    }
                    : null;

                summaryByDate[dateStr] = {
                    hasMorning: status === 'LENGKAP',
                    hasAfternoon: status === 'LENGKAP',
                    status,
                    reportId: foundReportId,
                    reportData
                };

                if (idx === 0) {
                    rootHasMorning = status === 'LENGKAP';
                    rootHasAfternoon = status === 'LENGKAP';
                    rootStatus = status;
                    rootReportData = reportData;
                    rootReportId = foundReportId;
                }
            });

            return {
                ...user,
                hasMorning: rootHasMorning,
                hasAfternoon: rootHasAfternoon,
                status: rootStatus,
                reportId: rootReportId,
                reportData: rootReportData,
                summaryByDate
            };
        });

        res.json({ dateRange, summary });
    } catch (error) {
        console.error('Error fetching kabid summary:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// =========================================================================
// MODUL SETORAN HAFALAN (ZIYADAH & MURAJAAH) - TABEL KHUSUS SetoranHafalan
// =========================================================================

/**
 * GET /api/laporan/hafalan
 * Mengambil riwayat setoran hafalan dari tabel khusus SetoranHafalan
 */
exports.getSetoranHafalan = async (req, res) => {
    try {
        const { staffId, tipe, juz, startDate, endDate, search } = req.query;
        const isUserKabid = isKabid(req.user);

        let whereClause = {};

        // Non-Kabid hanya dapat melihat data setorannya sendiri
        if (!isUserKabid) {
            whereClause.userId = req.user.id;
        } else if (staffId && staffId !== 'ALL') {
            whereClause.userId = parseInt(staffId, 10);
        }

        if (tipe && tipe !== 'ALL') {
            whereClause.tipeSetoran = tipe;
        }

        if (juz && juz !== 'ALL') {
            whereClause.juz = parseInt(juz, 10);
        }

        if (startDate || endDate) {
            whereClause.date = {};
            if (startDate) {
                whereClause.date.gte = dayjs.tz(startDate, 'Asia/Jakarta').startOf('day').toDate();
            }
            if (endDate) {
                whereClause.date.lte = dayjs.tz(endDate, 'Asia/Jakarta').endOf('day').toDate();
            }
        }

        if (search && search.trim()) {
            const q = search.trim();
            whereClause.OR = [
                { surah: { contains: q } },
                { pembimbing: { contains: q } },
                { catatan: { contains: q } },
                { user: { name: { contains: q } } }
            ];
        }

        const records = await prisma.setoranHafalan.findMany({
            where: whereClause,
            include: {
                user: {
                    select: { id: true, name: true, username: true, position: true, role: true }
                }
            },
            orderBy: {
                date: 'desc'
            }
        });

        res.json({
            success: true,
            records,
            isKabid: isUserKabid
        });
    } catch (error) {
        console.error('Error fetching setoran hafalan:', error);
        res.status(500).json({ error: 'Gagal memuat riwayat setoran hafalan' });
    }
};

/**
 * GET /api/laporan/hafalan/stats
 * Ringkasan statistik hafalan (total setoran, Ziyadah, Murajaah, total ayat)
 */
exports.getSetoranHafalanStats = async (req, res) => {
    try {
        const { staffId } = req.query;
        const isUserKabid = isKabid(req.user);

        let whereClause = {};

        if (!isUserKabid) {
            whereClause.userId = req.user.id;
        } else if (staffId && staffId !== 'ALL') {
            whereClause.userId = parseInt(staffId, 10);
        }

        const records = await prisma.setoranHafalan.findMany({
            where: whereClause,
            orderBy: { date: 'desc' },
            include: {
                user: { select: { id: true, name: true } }
            }
        });

        let totalSetoran = records.length;
        let totalZiyadah = 0;
        let totalMurajaah = 0;
        let totalAyat = 0;
        const juzDistribution = {};

        records.forEach(r => {
            if ((r.tipeSetoran || '').toLowerCase() === 'ziyadah') totalZiyadah++;
            else if ((r.tipeSetoran || '').toLowerCase() === 'murajaah') totalMurajaah++;

            totalAyat += (r.totalAyat || (r.ayatAkhir >= r.ayatAwal ? r.ayatAkhir - r.ayatAwal + 1 : 0));

            const juz = r.juz || 30;
            juzDistribution[juz] = (juzDistribution[juz] || 0) + 1;
        });

        const latestRecord = records[0] ? {
            id: records[0].id,
            date: records[0].date,
            userName: records[0].user?.name,
            tipeSetoran: records[0].tipeSetoran,
            surah: records[0].surah,
            juz: records[0].juz,
            ayatAwal: records[0].ayatAwal,
            ayatAkhir: records[0].ayatAkhir,
            totalAyat: records[0].totalAyat,
            nilai: records[0].nilai
        } : null;

        res.json({
            success: true,
            stats: {
                totalSetoran,
                totalZiyadah,
                totalMurajaah,
                totalAyat,
                juzDistribution,
                latestRecord
            }
        });
    } catch (error) {
        console.error('Error fetching setoran hafalan stats:', error);
        res.status(500).json({ error: 'Gagal memuat statistik setoran hafalan' });
    }
};

/**
 * POST /api/laporan/hafalan
 * Mencatat setoran hafalan baru ke tabel SetoranHafalan
 */
exports.createSetoranHafalan = async (req, res) => {
    try {
        const {
            staffId,
            tipeSetoran = 'Ziyadah',
            juz = 30,
            surah,
            surahNumber,
            ayatAwal,
            ayatAkhir,
            pembimbing = '',
            nilai = 'Mumtaz',
            catatan = '',
            tanggalSetoran
        } = req.body;

        if (!surah || ayatAwal === undefined || ayatAkhir === undefined) {
            return res.status(400).json({ error: 'Surah, ayat awal, dan ayat akhir wajib diisi.' });
        }

        const isUserKabid = isKabid(req.user);
        const targetUserId = (isUserKabid && staffId) ? parseInt(staffId, 10) : req.user.id;

        const awal = parseInt(ayatAwal, 10);
        const akhir = parseInt(ayatAkhir, 10);
        if (isNaN(awal) || isNaN(akhir) || awal < 1 || akhir < 1) {
            return res.status(400).json({ error: 'Nomor ayat tidak valid.' });
        }
        if (awal > akhir) {
            return res.status(400).json({ error: 'Ayat awal tidak boleh lebih besar dari ayat akhir.' });
        }
        const totalAyat = akhir - awal + 1;

        let reportDate = dayjs().tz('Asia/Jakarta');
        if (tanggalSetoran) {
            reportDate = dayjs.tz(tanggalSetoran, 'Asia/Jakarta');
        }

        const record = await prisma.setoranHafalan.create({
            data: {
                userId: targetUserId,
                tipeSetoran: tipeSetoran === 'Murajaah' ? 'Murajaah' : 'Ziyadah',
                juz: parseInt(juz, 10) || 30,
                surah: surah.trim(),
                surahNumber: parseInt(surahNumber, 10) || 0,
                ayatAwal: awal,
                ayatAkhir: akhir,
                totalAyat,
                pembimbing: pembimbing ? pembimbing.trim() : null,
                nilai: nilai || 'Mumtaz',
                catatan: catatan ? catatan.trim() : null,
                recordedBy: req.user.name || req.user.username,
                date: reportDate.toDate()
            },
            include: {
                user: {
                    select: { id: true, name: true, username: true, position: true, role: true }
                }
            }
        });

        res.status(201).json({
            success: true,
            message: 'Setoran hafalan berhasil disimpan',
            record
        });
    } catch (error) {
        console.error('Error creating setoran hafalan:', error);
        res.status(500).json({ error: 'Gagal menyimpan setoran hafalan' });
    }
};

/**
 * PUT /api/laporan/hafalan/:id
 * Memperbarui data setoran hafalan di tabel SetoranHafalan
 */
exports.updateSetoranHafalan = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const existing = await prisma.setoranHafalan.findUnique({
            where: { id }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Data setoran hafalan tidak ditemukan' });
        }

        const isUserKabid = isKabid(req.user);
        if (!isUserKabid && existing.userId !== req.user.id) {
            return res.status(403).json({ error: 'Anda tidak memiliki izin mengubah setoran ini' });
        }

        const {
            tipeSetoran,
            juz,
            surah,
            surahNumber,
            ayatAwal,
            ayatAkhir,
            pembimbing,
            nilai,
            catatan,
            tanggalSetoran
        } = req.body;

        const awal = ayatAwal !== undefined ? parseInt(ayatAwal, 10) : existing.ayatAwal;
        const akhir = ayatAkhir !== undefined ? parseInt(ayatAkhir, 10) : existing.ayatAkhir;
        const totalAyat = (awal && akhir && akhir >= awal) ? (akhir - awal + 1) : existing.totalAyat;

        let dateUpdate = existing.date;
        if (tanggalSetoran) {
            dateUpdate = dayjs.tz(tanggalSetoran, 'Asia/Jakarta').toDate();
        }

        const updated = await prisma.setoranHafalan.update({
            where: { id },
            data: {
                tipeSetoran: tipeSetoran || existing.tipeSetoran,
                juz: juz !== undefined ? parseInt(juz, 10) : existing.juz,
                surah: surah || existing.surah,
                surahNumber: surahNumber !== undefined ? parseInt(surahNumber, 10) : existing.surahNumber,
                ayatAwal: awal,
                ayatAkhir: akhir,
                totalAyat,
                pembimbing: pembimbing !== undefined ? (pembimbing ? pembimbing.trim() : null) : existing.pembimbing,
                nilai: nilai || existing.nilai,
                catatan: catatan !== undefined ? (catatan ? catatan.trim() : null) : existing.catatan,
                date: dateUpdate
            },
            include: {
                user: { select: { id: true, name: true, position: true } }
            }
        });

        res.json({
            success: true,
            message: 'Setoran hafalan berhasil diperbarui',
            record: updated
        });
    } catch (error) {
        console.error('Error updating setoran hafalan:', error);
        res.status(500).json({ error: 'Gagal memperbarui setoran hafalan' });
    }
};

/**
 * DELETE /api/laporan/hafalan/:id
 * Menghapus data setoran hafalan dari tabel SetoranHafalan
 */
exports.deleteSetoranHafalan = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const existing = await prisma.setoranHafalan.findUnique({
            where: { id }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Data setoran hafalan tidak ditemukan' });
        }

        const isUserKabid = isKabid(req.user);
        if (!isUserKabid && existing.userId !== req.user.id) {
            return res.status(403).json({ error: 'Anda tidak memiliki izin menghapus data ini' });
        }

        await prisma.setoranHafalan.delete({
            where: { id }
        });

        res.json({
            success: true,
            message: 'Setoran hafalan berhasil dihapus'
        });
    } catch (error) {
        console.error('Error deleting setoran hafalan:', error);
        res.status(500).json({ error: 'Gagal menghapus setoran hafalan' });
    }
};

/**
 * POST /api/laporan/ai/breakdown-plan
 * AI Task Breakdown using Google Gemini
 */
exports.breakdownPlanWithAI = async (req, res) => {
    const { title, position, category, startDate, endDate, priority } = req.body;

    if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Judul rencana kerja wajib diisi.' });
    }

    try {
        const startStr = startDate ? dayjs(startDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
        const endStr = endDate ? dayjs(endDate).format('YYYY-MM-DD') : dayjs().add(7, 'day').format('YYYY-MM-DD');

        const prompt = `
Anda adalah Asisten Ahli Perencanaan Kerja & Manajemen Sarana Prasarana Yayasan Dar el-Iman Padang.
Rencana kerja yang akan disusun oleh staf:
- Judul Rencana: ${title}
- Divisi/Posisi: ${position || category || 'Staff Sarpras'}
- Tanggal Mulai: ${startStr}
- Tanggal Estimasi Selesai (Batas Akhir): ${endStr}
- Prioritas Awal: ${priority || 'SEDANG'}

TUGAS ANDA:
1. Analisis urgensi rencana ini dan tentukan "priority": pilih salah satu dari "TINGGI" (kritis/urgent/keamanan/kebocoran/darurat), "SEDANG" (penting/terjadwal standar), atau "RENDAH" (rutin/berkala/kebersihan).
2. Rincikan pekerjaan ini menjadi 3 sampai 5 butir langkah kerja konkret yang runtut secara kronologis.
3. Untuk setiap butir langkah dalam array "steps":
   - "activity": Uraian tindakan kerja teknis yang jelas dan profesional (maksimal 15 kata per langkah).
   - "targetDate": Tanggal estimasi langkah dalam format YYYY-MM-DD. Tanggal langkah HARUS dimulai dari ${startStr} dan MAKSIMAL ${endStr} (TIDAK BOLEH melebihi ${endStr}). Urutkan tanggal dari awal sampai deadline.
4. "targetOutput": 1 kalimat wujud hasil akhir/output konkret yang terukur setelah seluruh rencana ini selesai (contoh: "1 Dokumen SOP disahkan", "Unit pendingin normal 20°C", "Instalasi jalur kabel panel utama tuntas & aman").
5. "scopeNote": 1-2 kalimat ringkasan ruang lingkup pengerjaan atau saran keselamatan kerja (K3).

KEMBALIKAN HANYA FORMAT JSON MURNI TANPA MARKDOWN (tanpa blok backtick json):
{
  "priority": "TINGGI",
  "targetOutput": "Wujud hasil akhir terukur...",
  "steps": [
    { "activity": "Langkah pertama...", "targetDate": "${startStr}" }
  ],
  "scopeNote": "Ruang lingkup..."
}
`;

        let rawResponse = '';
        try {
            const aiResult = await aiService.generateContentWithFallback(prompt);
            rawResponse = aiResult?.response?.text() || '';
        } catch (aiErr) {
            console.warn('[AI Plan Breakdown] Gemini error, using fallback rule:', aiErr.message);
        }

        let parsedData = null;
        if (rawResponse) {
            try {
                const cleanJson = rawResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
                parsedData = JSON.parse(cleanJson);
            } catch (jsonErr) {
                console.warn('[AI Plan Breakdown] JSON parse failed, trying regex extraction:', jsonErr.message);
                const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        parsedData = JSON.parse(jsonMatch[0]);
                    } catch (e) { }
                }
            }
        }

        // Fallback rule-based if AI was unavailable or parsing failed
        if (!parsedData || !Array.isArray(parsedData.steps) || parsedData.steps.length === 0) {
            const startD = dayjs(startStr);
            const endD = dayjs(endStr);
            const diffDays = Math.max(1, endD.diff(startD, 'day'));
            const midDate = startD.add(Math.floor(diffDays / 2), 'day').format('YYYY-MM-DD');

            parsedData = {
                priority: priority || 'SEDANG',
                targetOutput: `Pekerjaan ${title} tuntas 100%, teruji aman, dan siap digunakan.`,
                steps: [
                    { activity: `Pemeriksaan awal & identifikasi kebutuhan: ${title}`, targetDate: startD.format('YYYY-MM-DD') },
                    { activity: `Persiapan material, alat pelindung & suku cadang`, targetDate: midDate },
                    { activity: `Pelaksanaan tindakan pengerjaan fisik utama`, targetDate: endStr },
                    { activity: `Uji coba fungsi, pembersihan area kerja & serah terima`, targetDate: endStr }
                ],
                scopeNote: `Pengerjaan target ${title} sesuai SOP pemeliharaan sarana dan keselamatan kerja.`
            };
        }

        // Ensure dates are strictly within [startStr, endStr]
        parsedData.steps = parsedData.steps.map((st, idx) => {
            let tDate = st.targetDate;
            if (!tDate || dayjs(tDate).isAfter(dayjs(endStr), 'day') || dayjs(tDate).isBefore(dayjs(startStr), 'day')) {
                tDate = endStr;
            }
            return {
                activity: st.activity || `Langkah ke-${idx + 1}`,
                targetDate: tDate
            };
        });

        res.json({
            success: true,
            data: parsedData
        });
    } catch (err) {
        console.error('[AI Breakdown Error]:', err);
        res.status(500).json({ error: 'Gagal merinci langkah dengan AI.' });
    }
};

/**
 * POST /api/laporan/ai/polish-text
 * Polishes informal, shorthand Indonesian text into executive/corporate formal prose for daily reports & work plans.
 */
exports.polishTextWithAI = async (req, res) => {
    const { text, categoryTag, mode = 'activity' } = req.body;

    if (!text || !text.trim() || text.trim().length < 3) {
        return res.status(400).json({ error: 'Teks terlalu pendek untuk dirapikan (minimal 3 karakter).' });
    }

    const trimmed = text.trim();

    try {
        const prompt = `
Anda adalah Asisten Redaksi & Tata Bahasa Formal untuk Laporan Kinerja Staf Sarana Prasarana Yayasan Dar el-Iman Padang.
Tugas Anda adalah merapikan catatan kegiatan kerja staf berikut menjadi kalimat laporan kerja resmi berbahasa Indonesia yang baku, profesional, jelas, dan lugas.

KATEGORI BIDANG: ${categoryTag || 'UMUM'}
JABATAN STAF: ${req.user?.position || 'Staf Operasional'}
TIPE TEKS: ${mode === 'obstacle' ? 'Catatan Kendala/Hambatan Lapangan' : 'Uraian Aktivitas Kerja'}

TEKS ASAL DARI STAF:
"${trimmed}"

ATURAN WAJIB:
1. Perbaiki singkatan informal menjadi kata baku (contoh: "lnt/lt" -> "Lantai", "ac" -> "AC", "udh/sdh" -> "telah", "benerin/bikin" -> "memperbaiki/membuat", "nyuci" -> "mencuci dan membersihkan", "cek" -> "melakukan pengecekan/pemeriksaan", "ga ada/gak ada" -> "tidak tersedia").
2. Gunakan kata kerja aktif formal yang sesuai (contoh: "Melakukan inspeksi...", "Melaksanakan perbaikan...", "Mengganti komponen...", "Menyusun rekapitulasi...", "Memperbaiki unit...").
3. Jaga substansi fakta dan rincian pekerjaan agar TETAP ASLI DAN AKURAT sesuai maksud staf. JANGAN mengarang atau menambah fakta fiktif yang tidak disebutkan dalam teks asal.
4. Buat menjadi 1 kalimat yang padat, berbobot, dan elegan (maksimal 20-25 kata).
5. KEMBALIKAN HANYA TEKS HASIL AKHIR SAJA (plain text murni), tanpa tanda kutip pembuka/penutup, tanpa penjelasan tambahan, tanpa kata sambutan, dan tanpa format markdown.
`;

        let polishedText = '';
        try {
            const aiResult = await aiService.generateContentWithFallback(prompt);
            let rawText = aiResult?.response?.text() || '';
            // Clean up any quotation marks or backticks
            polishedText = rawText.replace(/^["'`]+|["'`]+$/g, '').trim();
        } catch (aiErr) {
            console.warn('[AI Polish Text] Gemini error, using heuristic fallback:', aiErr.message);
        }

        // Programmatic heuristic fallback if Gemini failed or returned empty
        if (!polishedText) {
            let fallback = trimmed;
            const dictionary = [
                { pattern: /\bbenerin\b/gi, replacement: 'Memperbaiki' },
                { pattern: /\bperbaiki\b/gi, replacement: 'Melakukan perbaikan' },
                { pattern: /\bcek\b/gi, replacement: 'Melakukan pengecekan dan pemeriksaan' },
                { pattern: /\bganti\b/gi, replacement: 'Melakukan penggantian' },
                { pattern: /\bnyuci\b/gi, replacement: 'Mencuci dan membersihkan' },
                { pattern: /\bbersihin\b/gi, replacement: 'Membersihkan' },
                { pattern: /\bberesin\b/gi, replacement: 'Merapikan dan menata' },
                { pattern: /\bbikin\b/gi, replacement: 'Menyusun dan membuat' },
                { pattern: /\bservis\b/gi, replacement: 'Melakukan servis dan perawatan' },
                { pattern: /\bantar\b/gi, replacement: 'Mengantarkan' },
                { pattern: /\bjemput\b/gi, replacement: 'Menjemput' },
                { pattern: /\blnt\b|\blt\b/gi, replacement: 'Lantai' },
                { pattern: /\bgdg\b/gi, replacement: 'Gedung' },
                { pattern: /\bac\b/gi, replacement: 'unit AC' },
                { pattern: /\bsdh\b|\budh\b/gi, replacement: 'sudah' },
                { pattern: /\byg\b/gi, replacement: 'yang' },
                { pattern: /\bkrn\b/gi, replacement: 'karena' },
                { pattern: /\bdg\b|\bdgn\b/gi, replacement: 'dengan' },
                { pattern: /\butk\b/gi, replacement: 'untuk' },
                { pattern: /\bblm\b/gi, replacement: 'belum' },
                { pattern: /\bgak\b|\bga\b/gi, replacement: 'tidak' },
                { pattern: /\btoko langganan\b/gi, replacement: 'vendor rekanan' }
            ];

            dictionary.forEach(entry => {
                fallback = fallback.replace(entry.pattern, entry.replacement);
            });

            // Ensure first letter is capitalized
            fallback = fallback.charAt(0).toUpperCase() + fallback.slice(1);
            if (!fallback.endsWith('.')) fallback += '.';
            polishedText = fallback;
        }

        res.json({
            success: true,
            original: trimmed,
            polished: polishedText
        });
    } catch (err) {
        console.error('[AI Polish Error]:', err);
        res.status(500).json({ error: 'Gagal merapikan teks dengan AI.' });
    }
};



