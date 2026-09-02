const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const whatsappService = require('../services/whatsappService');
const { uploadFile } = require('../services/minioService');
const aiService = require('../services/aiService');

dayjs.extend(utc);
dayjs.extend(timezone);

const SARPRAS_KEYWORDS = [
    'manajemen aset',
    'gudang dan logistik',
    'kendaraan',
    'teknisi aset',
    'teknisi',
    'keuangan dan administrasi',
    'admin aset'
];

/**
 * Helper to check if a user is Kepala Bidang Sarana (Reviewer / Full Access)
 */
const isKabid = (user) => {
    if (!user) return false;
    const role = user.role || '';
    const pos = (user.position || '').toLowerCase();
    return role === 'KABID_SARPRAS' || pos.includes('kepala bidang sarana') || pos.includes('kabid sarpras');
};

/**
 * GET /api/laporan
 * Fetch daily reports.
 * - Kabid Sarpras: can view all staff reports.
 * - Admin Aset: can ONLY view their own report.
 */
exports.getReports = async (req, res) => {
    try {
        const { date, category, search, status } = req.query;
        
        let targetDate = dayjs().tz('Asia/Jakarta');
        if (date) {
            targetDate = dayjs(date).tz('Asia/Jakarta');
        }
        const startOfDay = targetDate.startOf('day').toDate();
        const endOfDay = targetDate.endOf('day').toDate();

        const isUserKabid = isKabid(req.user);
        
        let whereClause = {
            type: 'DAILY',
            date: {
                gte: startOfDay,
                lte: endOfDay
            }
        };

        // Strict RBAC: Non-Kabid can ONLY see their own report
        if (!isUserKabid) {
            whereClause.userId = req.user.id;
        }

        const rawReports = await prisma.personnelReport.findMany({
            where: whereClause,
            include: {
                user: {
                    select: { id: true, name: true, username: true, position: true, role: true }
                }
            },
            orderBy: {
                updatedAt: 'desc'
            }
        });

        // Consolidate reports by userId
        const userReportsMap = {};
        for (const r of rawReports) {
            if (!userReportsMap[r.userId]) {
                userReportsMap[r.userId] = { 
                    ...r, 
                    metadata: { 
                        ...r.metadata, 
                        manualPoints: { morning: [], afternoon: [] } 
                    } 
                };
            }
            
            const targetPts = userReportsMap[r.userId].metadata.manualPoints;
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
                userReportsMap[r.userId].metadata.verification = r.metadata.verification;
            }
        }

        let reports = Object.values(userReportsMap);

        // Optional filtering by category tag, search keyword, or status for Kabid
        if (category && category !== 'ALL') {
            reports = reports.filter(r => {
                const pts = r.metadata?.manualPoints;
                const m = pts?.morning || [];
                const a = pts?.afternoon || [];
                const all = [...m, ...a];
                return all.some(p => (p.categoryTag || '').toUpperCase() === category.toUpperCase());
            });
        }

        if (search && search.trim()) {
            const q = search.toLowerCase();
            reports = reports.filter(r => {
                const userName = (r.user?.name || '').toLowerCase();
                const pos = (r.user?.position || '').toLowerCase();
                const pts = r.metadata?.manualPoints;
                const m = pts?.morning || [];
                const a = pts?.afternoon || [];
                const all = [...m, ...a];
                const hasMatchText = all.some(p => (p.text || '').toLowerCase().includes(q) || (p.obstacleNote || '').toLowerCase().includes(q));
                return userName.includes(q) || pos.includes(q) || hasMatchText;
            });
        }

        if (status && status !== 'ALL') {
            reports = reports.filter(r => {
                const pts = r.metadata?.manualPoints;
                const m = pts?.morning || [];
                const a = pts?.afternoon || [];
                const hasM = m.length > 0;
                const hasA = a.length > 0;
                if (status === 'LENGKAP') return hasM && hasA;
                if (status === 'PARSIAL') return (hasM && !hasA) || (!hasM && hasA);
                if (status === 'BELUM') return !hasM && !hasA;
                return true;
            });
        }

        const myReport = reports.find(r => r.userId === req.user.id) || null;

        res.json({ 
            success: true, 
            reports, 
            myReport,
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
    try {
        const { category, targetDate, manualPoints } = req.body;
        
        let reportDate = dayjs().tz('Asia/Jakarta');
        if (targetDate) {
            reportDate = dayjs(targetDate).tz('Asia/Jakarta');
        }

        const dateStart = reportDate.startOf('day').toDate();
        const dateEnd = reportDate.endOf('day').toDate();

        let report = await prisma.personnelReport.findFirst({
            where: {
                userId: req.user.id,
                type: 'DAILY',
                date: {
                    gte: dateStart,
                    lte: dateEnd
                }
            }
        });

        const formattedPoints = {
            morning: (manualPoints?.morning || []).map(p => ({
                text: p.text || '',
                categoryTag: p.categoryTag || category || 'UMUM',
                status: p.status || 'COMPLETED', // COMPLETED, IN_PROGRESS, OBSTACLE
                obstacleNote: p.obstacleNote || '',
                isRoutine: !!p.isRoutine,
                photos: Array.isArray(p.photos) ? p.photos : [],
                updatedAt: new Date().toISOString()
            })),
            afternoon: (manualPoints?.afternoon || []).map(p => ({
                text: p.text || '',
                categoryTag: p.categoryTag || category || 'UMUM',
                status: p.status || 'COMPLETED',
                obstacleNote: p.obstacleNote || '',
                isRoutine: !!p.isRoutine,
                photos: Array.isArray(p.photos) ? p.photos : [],
                updatedAt: new Date().toISOString()
            }))
        };

        if (report) {
            const existingMetadata = typeof report.metadata === 'object' && report.metadata !== null ? report.metadata : {};
            report = await prisma.personnelReport.update({
                where: { id: report.id },
                data: { 
                    metadata: {
                        ...existingMetadata,
                        manualPoints: formattedPoints,
                        lastSubmittedAt: new Date().toISOString()
                    }
                }
            });
        } else {
            report = await prisma.personnelReport.create({
                data: {
                    userId: req.user.id,
                    type: 'DAILY',
                    category: category || 'UMUM',
                    content: '', 
                    metadata: {
                        manualPoints: formattedPoints,
                        lastSubmittedAt: new Date().toISOString()
                    },
                    date: reportDate.toDate()
                }
            });
        }

        res.json({ success: true, report });
    } catch (error) {
        console.error('Error updating report:', error);
        res.status(500).json({ error: 'Terjadi kesalahan pada server' });
    }
};

/**
 * GET /api/laporan/status
 * Check if the user has reported morning/afternoon today.
 */
exports.getReportStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        const targetDate = dayjs().tz('Asia/Jakarta');
        const startOfDay = targetDate.startOf('day').toDate();
        const endOfDay = targetDate.endOf('day').toDate();

        const reports = await prisma.personnelReport.findMany({
            where: {
                userId,
                type: 'DAILY',
                date: { gte: startOfDay, lte: endOfDay }
            }
        });

        let hasMorning = false;
        let hasAfternoon = false;
        
        for (const report of reports) {
            if (report.metadata && report.metadata.manualPoints) {
                const pts = report.metadata.manualPoints;
                const m = pts.morningPoints || pts.morning || [];
                const a = pts.afternoonPoints || pts.afternoon || [];
                if (!hasMorning) {
                    hasMorning = Array.isArray(m) && m.some(p => p && (typeof p === 'string' ? p.trim() !== '' : (p.text && p.text.trim() !== '') || (p.photos && p.photos.length > 0)));
                }
                if (!hasAfternoon) {
                    hasAfternoon = Array.isArray(a) && a.some(p => p && (typeof p === 'string' ? p.trim() !== '' : (p.text && p.text.trim() !== '') || (p.photos && p.photos.length > 0)));
                }
            }
            if (hasMorning && hasAfternoon) break;
        }

        res.json({ 
            hasReported: hasMorning || hasAfternoon, 
            hasMorning, 
            hasAfternoon,
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

        const targetDate = req.query.date ? dayjs(req.query.date).tz('Asia/Jakarta') : dayjs().tz('Asia/Jakarta');
        const startOfDay = targetDate.startOf('day').toDate();
        const endOfDay = targetDate.endOf('day').toDate();

        // 1. Get all staff users (exclude Kabid)
        const staffUsers = await prisma.user.findMany({
            where: {
                OR: [
                    { role: 'ADMIN_ASET' },
                    ...SARPRAS_KEYWORDS.map(kw => ({ position: { contains: kw } }))
                ],
                NOT: [
                    { role: 'KABID_SARPRAS' },
                    { position: { contains: 'Kepala Bidang' } }
                ]
            },
            select: { id: true, name: true, position: true, role: true }
        });

        // 2. Fetch today's reports
        const todayReports = await prisma.personnelReport.findMany({
            where: {
                type: 'DAILY',
                date: { gte: startOfDay, lte: endOfDay }
            },
            include: {
                user: { select: { id: true, name: true, position: true } }
            }
        });

        // Calculate Compliance metrics
        let lengkapCount = 0;
        let parsialCount = 0;
        let belumCount = 0;
        let onTimeSubmissions = 0;
        let totalActivitiesToday = 0;
        let totalPhotosToday = 0;
        const activeObstacles = [];
        const categoryCounts = {
            GUDANG: 0,
            ASET: 0,
            TEKNISI: 0,
            KENDARAAN: 0,
            KEUANGAN: 0,
            UMUM: 0
        };

        const staffStatusList = staffUsers.map(st => {
            const rep = todayReports.find(r => r.userId === st.id);
            const pts = rep?.metadata?.manualPoints;
            const m = pts?.morning || pts?.morningPoints || [];
            const a = pts?.afternoon || pts?.afternoonPoints || [];
            
            const hasM = Array.isArray(m) && m.some(p => p && ((typeof p === 'string' && p.trim()) || (p.text && p.text.trim()) || (p.photos && p.photos.length > 0)));
            const hasA = Array.isArray(a) && a.some(p => p && ((typeof p === 'string' && p.trim()) || (p.text && p.text.trim()) || (p.photos && p.photos.length > 0)));
            
            let status = 'BELUM';
            if (hasM && hasA) {
                status = 'LENGKAP';
                lengkapCount++;
            } else if (hasM || hasA) {
                status = 'PARSIAL';
                parsialCount++;
            } else {
                belumCount++;
            }

            // Aggregate items & obstacles
            const allItems = [...(Array.isArray(m) ? m : []), ...(Array.isArray(a) ? a : [])];
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
                        activity: item.text,
                        categoryTag: item.categoryTag || 'UMUM',
                        obstacleNote: item.obstacleNote || 'Terkendala di lapangan',
                        photos: item.photos || [],
                        time: item.updatedAt || rep.updatedAt
                    });
                }
            });

            return {
                id: st.id,
                name: st.name,
                position: st.position,
                status,
                hasMorning: hasM,
                hasAfternoon: hasA,
                lastSubmittedAt: rep?.metadata?.lastSubmittedAt || rep?.updatedAt || null
            };
        });

        // 3. Trend last 7 days
        const trend7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = targetDate.subtract(i, 'day');
            const dStart = d.startOf('day').toDate();
            const dEnd = d.endOf('day').toDate();

            const dReports = await prisma.personnelReport.findMany({
                where: { type: 'DAILY', date: { gte: dStart, lte: dEnd } }
            });

            let dLengkap = 0;
            let dParsial = 0;
            let dBelum = 0;

            staffUsers.forEach(st => {
                const rep = dReports.find(r => r.userId === st.id);
                const pts = rep?.metadata?.manualPoints;
                const m = pts?.morning || pts?.morningPoints || [];
                const a = pts?.afternoon || pts?.afternoonPoints || [];
                const hasM = Array.isArray(m) && m.some(p => p && ((typeof p === 'string' && p.trim()) || (p.text && p.text.trim())));
                const hasA = Array.isArray(a) && a.some(p => p && ((typeof p === 'string' && p.trim()) || (p.text && p.text.trim())));

                if (hasM && hasA) dLengkap++;
                else if (hasM || hasA) dParsial++;
                else dBelum++;
            });

            trend7Days.push({
                date: d.format('DD MMM'),
                Lengkap: dLengkap,
                Parsial: dParsial,
                Belum: dBelum
            });
        }

        // 4. Leaderboard 30 days
        const monthStart = targetDate.subtract(30, 'day').startOf('day').toDate();
        const monthReports = await prisma.personnelReport.findMany({
            where: { type: 'DAILY', date: { gte: monthStart, lte: endOfDay } }
        });

        const leaderboard = staffUsers.map(st => {
            const userReps = monthReports.filter(r => r.userId === st.id);
            let completeDays = 0;
            let totalTasks = 0;

            userReps.forEach(r => {
                const pts = r.metadata?.manualPoints;
                const m = pts?.morning || pts?.morningPoints || [];
                const a = pts?.afternoon || pts?.afternoonPoints || [];
                const hasM = Array.isArray(m) && m.length > 0;
                const hasA = Array.isArray(a) && a.length > 0;
                if (hasM && hasA) completeDays++;
                totalTasks += (m.length + a.length);
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

        let startDate = req.query.startDate ? dayjs(req.query.startDate).tz('Asia/Jakarta') : dayjs().tz('Asia/Jakarta').startOf('week').add(1, 'day'); // Monday
        let endDate = req.query.endDate ? dayjs(req.query.endDate).tz('Asia/Jakarta') : startDate.add(5, 'day'); // Saturday

        const dStart = startDate.startOf('day').toDate();
        const dEnd = endDate.endOf('day').toDate();

        const reports = await prisma.personnelReport.findMany({
            where: {
                type: 'DAILY',
                date: { gte: dStart, lte: dEnd }
            },
            include: {
                user: { select: { id: true, name: true, position: true } }
            },
            orderBy: { date: 'asc' }
        });

        // Group by Date & Division
        const dailyDivisionBreakdown = [];
        let curr = startDate.clone();
        let totalCompleted = 0;
        let totalInProgress = 0;
        let totalObstacles = 0;
        const obstacleList = [];

        while (curr.isBefore(endDate.endOf('day'))) {
            const dateStr = curr.format('YYYY-MM-DD');
            const dayReports = reports.filter(r => dayjs(r.date).format('YYYY-MM-DD') === dateStr);

            const activities = [];
            dayReports.forEach(r => {
                const pts = r.metadata?.manualPoints;
                const m = pts?.morning || pts?.morningPoints || [];
                const a = pts?.afternoon || pts?.afternoonPoints || [];
                
                [...m, ...a].forEach(item => {
                    if (item.text) {
                        const status = item.status || 'COMPLETED';
                        if (status === 'COMPLETED') totalCompleted++;
                        else if (status === 'IN_PROGRESS') totalInProgress++;
                        else if (status === 'OBSTACLE') {
                            totalObstacles++;
                            obstacleList.push({
                                date: curr.format('DD/MM/YYYY'),
                                staffName: r.user?.name,
                                activity: item.text,
                                obstacleNote: item.obstacleNote || 'Kendala'
                            });
                        }

                        activities.push({
                            staffName: r.user?.name,
                            position: r.user?.position,
                            categoryTag: item.categoryTag || 'UMUM',
                            activity: item.text,
                            status,
                            obstacleNote: item.obstacleNote || ''
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

        res.json({
            success: true,
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
            dailyDivisionBreakdown,
            obstacleList
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
            where: { id: parseInt(id) }
        });

        if (!report) {
            return res.status(404).json({ error: 'Laporan tidak ditemukan' });
        }

        const existingMetadata = typeof report.metadata === 'object' && report.metadata !== null ? report.metadata : {};
        const verificationData = {
            verifiedBy: req.user.name || 'Kepala Bidang Sarana',
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

        res.json({ success: true, verification: verificationData, report: updated });
    } catch (error) {
        console.error('Error verifying report:', error);
        res.status(500).json({ error: 'Gagal memverifikasi laporan' });
    }
};

/**
 * GET /api/laporan/my-stats
 * Personal scorecard for Admin Aset.
 */
exports.getMyStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const now = dayjs().tz('Asia/Jakarta');
        const monthStart = now.startOf('month').toDate();
        const monthEnd = now.endOf('month').toDate();

        const monthReports = await prisma.personnelReport.findMany({
            where: {
                userId,
                type: 'DAILY',
                date: { gte: monthStart, lte: monthEnd }
            },
            orderBy: { date: 'desc' }
        });

        let completedDays = 0;
        let totalActivities = 0;
        let latestFeedback = null;

        monthReports.forEach(r => {
            const pts = r.metadata?.manualPoints;
            const m = pts?.morning || pts?.morningPoints || [];
            const a = pts?.afternoon || pts?.afternoonPoints || [];
            const hasM = Array.isArray(m) && m.length > 0;
            const hasA = Array.isArray(a) && a.length > 0;
            if (hasM && hasA) completedDays++;
            totalActivities += (m.length + a.length);

            if (!latestFeedback && r.metadata?.verification?.feedbackNote) {
                latestFeedback = {
                    date: dayjs(r.date).format('DD MMM YYYY'),
                    status: r.metadata.verification.status,
                    note: r.metadata.verification.feedbackNote,
                    by: r.metadata.verification.verifiedBy
                };
            }
        });

        const workingDaysPassed = Math.max(1, now.date());
        const disciplineScore = Math.min(100, Math.round((completedDays / workingDaysPassed) * 100));

        res.json({
            success: true,
            stats: {
                completedDays,
                totalActivities,
                disciplineScore,
                latestFeedback
            }
        });
    } catch (error) {
        console.error('Error fetching personal stats:', error);
        res.status(500).json({ error: 'Gagal memuat statistik personal' });
    }
};

/**
 * POST /api/laporan/ai/analyze
 * Gemini AI analysis for Kabid Sarpras.
 */
exports.analyzeWithAI = async (req, res) => {
    try {
        if (!isKabid(req.user)) {
            return res.status(403).json({ error: 'Akses ditolak.' });
        }

        const { date, mode } = req.body; // mode: 'DAILY_DIGEST' | 'TEAM_PERFORMANCE' | 'OBSTACLE_SOLUTIONS'
        const targetDate = date ? dayjs(date).tz('Asia/Jakarta') : dayjs().tz('Asia/Jakarta');
        const startOfDay = targetDate.startOf('day').toDate();
        const endOfDay = targetDate.endOf('day').toDate();

        const reports = await prisma.personnelReport.findMany({
            where: {
                type: 'DAILY',
                date: { gte: startOfDay, lte: endOfDay }
            },
            include: {
                user: { select: { name: true, position: true } }
            }
        });

        const activityList = [];
        const obstacles = [];

        reports.forEach(r => {
            const pts = r.metadata?.manualPoints;
            const m = pts?.morning || pts?.morningPoints || [];
            const a = pts?.afternoon || pts?.afternoonPoints || [];
            [...m, ...a].forEach(item => {
                if (item.text) {
                    activityList.push({
                        staff: r.user?.name,
                        position: r.user?.position,
                        category: item.categoryTag || 'UMUM',
                        text: item.text,
                        status: item.status || 'COMPLETED'
                    });
                    if (item.status === 'OBSTACLE' || item.obstacleNote) {
                        obstacles.push({
                            staff: r.user?.name,
                            activity: item.text,
                            obstacleNote: item.obstacleNote
                        });
                    }
                }
            });
        });

        let prompt = '';
        if (mode === 'OBSTACLE_SOLUTIONS') {
            prompt = `
Anda adalah Konsultan Ahli Manajemen Fasilitas & Aset (Sarana & Prasarana).
Berikut adalah daftar kendala/masalah operasional yang dilaporkan oleh staf di lapangan hari ini (${targetDate.format('DD MMMM YYYY')}):

${obstacles.length === 0 ? 'Tidak ada kendala kritis yang dilaporkan hari ini.' : obstacles.map((o, idx) => `${idx + 1}. Staf: ${o.staff} | Pekerjaan: ${o.activity} | Kendala: ${o.obstacleNote}`).join('\n')}

TUGAS ANDA:
Berikan rekomendasi solusi praktis, langkah mitigasi cepat, dan alokasi tindakan prioritas bagi Kepala Bidang Sarana untuk menyelesaikan kendala tersebut.
Gunakan format poin yang tegas, profesional, dan aplikatif.
`;
        } else {
            prompt = `
Anda adalah Asisten Eksekutif Cerdas untuk Kepala Bidang Sarana Yayasan Dar el-Iman.
Berikut adalah data laporan kegiatan staf hari ini (${targetDate.format('DD MMMM YYYY')}):

TOTAL PEKERJAAN DILAPORKAN: ${activityList.length} butir
RINCIAN AKTIVITAS STAF:
${activityList.map(a => `- [${a.category}] ${a.staff} (${a.position}): ${a.text} [Status: ${a.status}]`).join('\n')}

KENDALA: ${obstacles.length > 0 ? obstacles.map(o => `${o.staff}: ${o.obstacleNote}`).join(', ') : 'Nihil'}

TUGAS ANDA:
Buatkan "Executive Summary & AI Performance Analysis" yang ringkas, elegan, dan profesional yang memuat:
1. 🎯 Ringkasan Pencapaian Utama Hari Ini (Highlight hasil kerja signifikan).
2. 📊 Analisis Distribusi & Produktivitas Tim (Evaluasi apakah pembagian kerja sudah proporsional).
3. ⚠️ Isu/Kendala Kritis & Rekomendasi Tindak Lanjut untuk Kepala Bidang Sarana.

Gunakan bahasa Indonesia yang formal, padat, dan bernilai eksekutif tinggi.
`;
        }

        const aiResponse = await aiService.generateContentWithFallback(prompt);
        const resultText = aiResponse?.response?.text() || 'Gagal menghasilkan analisis AI.';

        res.json({
            success: true,
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
 * Afternoon trigger: 16:16 WIB
 */
exports.sendReportReminders = async () => {
    try {
        const targetDate = dayjs().tz('Asia/Jakarta');
        const startOfDay = targetDate.startOf('day').toDate();
        const endOfDay = targetDate.endOf('day').toDate();
        const hour = targetDate.hour();
        const isMorningShift = hour < 15; // Triggered at 13:30

        // Target ONLY Admin Aset staff (Exclude Kepala Bidang Sarana)
        const staffUsers = await prisma.user.findMany({
            where: {
                OR: [
                    { role: 'ADMIN_ASET' },
                    ...SARPRAS_KEYWORDS.map(kw => ({ position: { contains: kw } }))
                ],
                NOT: [
                    { role: 'KABID_SARPRAS' },
                    { position: { contains: 'Kepala Bidang' } }
                ]
            },
            select: { id: true, name: true, phone: true }
        });

        const reports = await prisma.personnelReport.findMany({
            where: { type: 'DAILY', date: { gte: startOfDay, lte: endOfDay } }
        });

        for (const user of staffUsers) {
            if (!user.phone) continue;
            
            const userReports = reports.filter(r => r.userId === user.id);
            let hasReported = false;

            for (const userReport of userReports) {
                if (userReport.metadata && userReport.metadata.manualPoints) {
                    const pts = userReport.metadata.manualPoints;
                    const m = pts.morningPoints || pts.morning || [];
                    const a = pts.afternoonPoints || pts.afternoon || [];
                    if (isMorningShift) {
                        hasReported = Array.isArray(m) && m.some(p => p && (typeof p === 'string' ? p.trim() !== '' : (p.text && p.text.trim() !== '') || (p.photos && p.photos.length > 0)));
                    } else {
                        hasReported = Array.isArray(a) && a.some(p => p && (typeof p === 'string' ? p.trim() !== '' : (p.text && p.text.trim() !== '') || (p.photos && p.photos.length > 0)));
                    }
                }
                if (hasReported) break;
            }

            if (!hasReported) {
                const shiftName = isMorningShift ? 'Pagi (07.15 - 12.00)' : 'Siang (13.00 - 16.15)';
                const msg = `Halo ${user.name},\n\nAnda belum mengisi *Laporan Kegiatan ${shiftName}* hari ini.\nMohon segera melengkapi laporan Anda pada menu "Laporan Harian" di Sistem Manajemen Aset.\n\nTerima kasih.`;
                await whatsappService.sendMessage(user.phone, msg);
            }
        }
    } catch (error) {
        console.error('Error sending report reminders:', error);
    }
};

/**
 * Monthly Kabid Matrix (Backwards compatibility & monthly export)
 */
exports.getKabidSummary = async (req, res) => {
    try {
        const targetStartDate = req.query.startDate ? dayjs(req.query.startDate).tz('Asia/Jakarta') : (req.query.date ? dayjs(req.query.date).tz('Asia/Jakarta') : dayjs().tz('Asia/Jakarta'));
        const targetEndDate = req.query.endDate ? dayjs(req.query.endDate).tz('Asia/Jakarta') : targetStartDate;
        
        const startOfDay = targetStartDate.startOf('day').toDate();
        const endOfDay = targetEndDate.endOf('day').toDate();

        const staffUsers = await prisma.user.findMany({
            where: {
                OR: [
                    { role: 'ADMIN_ASET' },
                    ...SARPRAS_KEYWORDS.map(kw => ({ position: { contains: kw } }))
                ],
                NOT: [
                    { role: 'KABID_SARPRAS' },
                    { position: { contains: 'Kepala Bidang' } }
                ]
            },
            select: { id: true, name: true, position: true }
        });

        const reports = await prisma.personnelReport.findMany({
            where: {
                type: 'DAILY',
                date: { gte: startOfDay, lte: endOfDay }
            }
        });

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

                let hasMorning = false;
                let hasAfternoon = false;
                let allMorningPoints = [];
                let allAfternoonPoints = [];

                for (const r of dailyReports) {
                    if (r.metadata && r.metadata.manualPoints) {
                        const pts = r.metadata.manualPoints;
                        const m = pts.morningPoints || pts.morning || [];
                        const a = pts.afternoonPoints || pts.afternoon || [];
                        if (!hasMorning) hasMorning = Array.isArray(m) && m.some(p => p && ((typeof p === 'string' && p.trim()) || (p.text && p.text.trim()) || (p.photos && p.photos.length > 0)));
                        if (!hasAfternoon) hasAfternoon = Array.isArray(a) && a.some(p => p && ((typeof p === 'string' && p.trim()) || (p.text && p.text.trim()) || (p.photos && p.photos.length > 0)));
                        
                        if (Array.isArray(m)) allMorningPoints = allMorningPoints.concat(m);
                        if (Array.isArray(a)) allAfternoonPoints = allAfternoonPoints.concat(a);
                    }
                }

                let status = 'BELUM';
                if (hasMorning && hasAfternoon) status = 'LENGKAP';
                else if (hasMorning || hasAfternoon) status = 'PARSIAL';

                const reportData = (allMorningPoints.length > 0 || allAfternoonPoints.length > 0)
                    ? { morning: allMorningPoints, afternoon: allAfternoonPoints }
                    : null;

                summaryByDate[dateStr] = {
                    hasMorning,
                    hasAfternoon,
                    status,
                    reportId: dailyReports.length > 0 ? dailyReports[0].id : null,
                    reportData
                };

                if (idx === 0) {
                    rootHasMorning = hasMorning;
                    rootHasAfternoon = hasAfternoon;
                    rootStatus = status;
                    rootReportData = reportData;
                    rootReportId = dailyReports.length > 0 ? dailyReports[0].id : null;
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
