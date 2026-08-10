const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const whatsappService = require('../services/whatsappService');

dayjs.extend(utc);
dayjs.extend(timezone);

exports.getReports = async (req, res) => {
    try {
        const { category, date } = req.query; // date in YYYY-MM-DD
        
        // Define target date range
        let targetDate = dayjs().tz('Asia/Jakarta');
        if (date) {
            targetDate = dayjs(date).tz('Asia/Jakarta');
        }
        const startOfDay = targetDate.startOf('day').toDate();
        const endOfDay = targetDate.endOf('day').toDate();

        // Determine if user is admin/viewer or viewing their own
        // Note: Sesuai request, HANYA Kepala Bidang Sarana yang berhak melihat semua Laporan
        const isGlobalAdmin = req.user.role === 'KABID_SARPRAS' || (req.user.position && req.user.position.toLowerCase().includes('kepala bidang Sarana'));
        
        let whereClause = {
            type: 'DAILY',
            date: {
                gte: startOfDay,
                lte: endOfDay
            }
        };

        // DO NOT filter by category for DAILY reports so we get the unified team feed
        // if (category) {
        //     whereClause.category = category;
        // }

        // If not an admin, they can only view their own report
        if (!isGlobalAdmin) {
            whereClause.userId = req.user.id;
        }

        const rawReports = await prisma.personnelReport.findMany({
            where: whereClause,
            include: {
                user: {
                    select: { name: true, position: true }
                }
            },
            orderBy: {
                updatedAt: 'desc'
            }
        });

        // Merge duplicate reports by userId (in case they saved under different categories previously)
        const userReportsMap = {};
        for (const r of rawReports) {
            // Bersihkan log mentah (rute API) lama agar tidak tampil di frontend
            if (r.category === 'KENDARAAN') {
                r.content = '';
            }

            if (!userReportsMap[r.userId]) {
                // Clone the report and reset manualPoints for merging
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
            
            if (Array.isArray(m)) targetPts.morning = targetPts.morning.concat(m.filter(p => p && (typeof p === 'string' ? p.trim() !== '' : p.text && p.text.trim() !== '')));
            if (Array.isArray(a)) targetPts.afternoon = targetPts.afternoon.concat(a.filter(p => p && (typeof p === 'string' ? p.trim() !== '' : p.text && p.text.trim() !== '')));
        }

        const reports = Object.values(userReportsMap);

        // Also if user is viewing their own and report doesn't exist, return empty
        let myReport = reports.find(r => r.userId === req.user.id);

        // Filter reports for the "Rekap Laporan Tim" feed so we don't show empty auto-reports
        const filteredReports = reports.filter(r => {
            if (!r.metadata || !r.metadata.manualPoints) return false;
            const pts = r.metadata.manualPoints;
            
            if (Array.isArray(pts)) {
                return pts.length > 0;
            } else {
                const m = pts.morningPoints || pts.morning || [];
                const a = pts.afternoonPoints || pts.afternoon || [];
                const hasM = Array.isArray(m) && m.some(p => p && (typeof p === 'string' ? p.trim() !== '' : p.text && p.text.trim() !== ''));
                const hasA = Array.isArray(a) && a.some(p => p && (typeof p === 'string' ? p.trim() !== '' : p.text && p.text.trim() !== ''));
                return hasM || hasA;
            }
        });

        // Compute Global Summary for KENDARAAN
        let globalSummary = null;
        if (category === 'KENDARAAN') {
            const vehicleBookings = await prisma.vehicleBooking.findMany({
                where: { createdAt: { gte: startOfDay, lte: endOfDay } },
                include: { user: true, vehicle: true }
            });
            const busBookings = await prisma.busBooking.findMany({
                where: { createdAt: { gte: startOfDay, lte: endOfDay } }
            });
            const vehicleServices = await prisma.vehicleService.findMany({
                where: { createdAt: { gte: startOfDay, lte: endOfDay } }
            });

            let summaryLines = [];
            
            if (vehicleBookings.length > 0) {
                const userBookings = {};
                vehicleBookings.forEach(b => {
                    const userName = b.user?.name || 'Anonim';
                    const vehicleName = b.vehicle?.name || b.vehicle?.plateNumber || 'Kendaraan';
                    if (!userBookings[userName]) userBookings[userName] = {};
                    if (!userBookings[userName][vehicleName]) userBookings[userName][vehicleName] = 0;
                    userBookings[userName][vehicleName]++;
                });

                const names = Object.keys(userBookings).map(userName => {
                    const vehicles = Object.keys(userBookings[userName]).map(vName => {
                        const count = userBookings[userName][vName];
                        return count > 1 ? `${vName} x${count}` : vName;
                    }).join(', ');
                    return `${userName} (${vehicles})`;
                }).join(', ');
                
                summaryLines.push(`- Terdapat ${vehicleBookings.length} peminjaman kendaraan operasional hari ini (Peminjam: ${names}).`);
            }
            
            if (busBookings.length > 0) {
                const unassignedBus = busBookings.filter(b => b.status === 'PENDING' || !b.driverName).length;
                const assignedBus = busBookings.filter(b => b.driverName).length;
                let busTxt = `- Terdapat ${busBookings.length} pesanan bus hari ini.`;
                if (unassignedBus > 0) busTxt += ` ${unassignedBus} pesanan belum ditugaskan.`;
                if (assignedBus > 0) busTxt += ` ${assignedBus} pesanan sudah ditugaskan ke sopir.`;
                summaryLines.push(busTxt);
            }
            
            if (vehicleServices.length > 0) {
                const pendingSvc = vehicleServices.filter(s => s.status === 'PENDING').length;
                const completedSvc = vehicleServices.filter(s => s.status === 'COMPLETED').length;
                let svcTxt = `- Terdapat ${vehicleServices.length} kendaraan masuk servis hari ini.`;
                if (pendingSvc > 0) svcTxt += ` ${pendingSvc} kendaraan belum diservis.`;
                if (completedSvc > 0) svcTxt += ` ${completedSvc} kendaraan sudah diservis.`;
                summaryLines.push(svcTxt);
            }

            if (summaryLines.length > 0) {
                globalSummary = "Rangkuman Aktivitas Divisi Hari Ini:\n" + summaryLines.join('\n');
            } else {
                globalSummary = "Belum ada aktivitas kendaraan/bus yang tercatat hari ini.";
            }
        }

        res.json({ success: true, reports: filteredReports, myReport, globalSummary });

    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ error: 'Terjadi kesalahan pada server' });
    }
};

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
                // Remove category filter so we only ever have ONE daily report per user per day
                date: {
                    gte: dateStart,
                    lte: dateEnd
                }
            }
        });

        // Ensure we preserve existing metadata, just update manualPoints
        if (report) {
            const existingMetadata = typeof report.metadata === 'object' && report.metadata !== null ? report.metadata : {};
            report = await prisma.personnelReport.update({
                where: { id: report.id },
                data: { 
                    metadata: {
                        ...existingMetadata,
                        manualPoints: manualPoints || []
                    }
                }
            });
        } else {
            report = await prisma.personnelReport.create({
                data: {
                    userId: req.user.id,
                    type: 'DAILY',
                    category: category || 'UMUM',
                    content: '', // manual points are in metadata
                    metadata: {
                        manualPoints: manualPoints || []
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
                    hasMorning = Array.isArray(m) && m.some(p => p && (typeof p === 'string' ? p.trim() !== '' : p.text && p.text.trim() !== ''));
                }
                if (!hasAfternoon) {
                    hasAfternoon = Array.isArray(a) && a.some(p => p && (typeof p === 'string' ? p.trim() !== '' : p.text && p.text.trim() !== ''));
                }
            }
            if (hasMorning && hasAfternoon) break;
        }

        res.json({ 
            hasReported: hasMorning || hasAfternoon, 
            hasMorning, 
            hasAfternoon 
        });
    } catch (error) {
        console.error('Error fetching report status:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.getKabidSummary = async (req, res) => {
    try {
        const targetStartDate = req.query.startDate ? dayjs(req.query.startDate).tz('Asia/Jakarta') : (req.query.date ? dayjs(req.query.date).tz('Asia/Jakarta') : dayjs().tz('Asia/Jakarta'));
        const targetEndDate = req.query.endDate ? dayjs(req.query.endDate).tz('Asia/Jakarta') : targetStartDate;
        
        const startOfDay = targetStartDate.startOf('day').toDate();
        const endOfDay = targetEndDate.endOf('day').toDate();

        const sarprasKeywords = [
            'manajemen aset',
            'gudang dan logistik',
            'kendaraan',
            'teknisi aset',
            'keuangan dan administrasi'
        ];

        const users = await prisma.user.findMany({
            where: {
                OR: sarprasKeywords.map(keyword => ({
                    position: { contains: keyword }
                }))
            },
            select: {
                id: true,
                name: true,
                position: true
            }
        });

        const reports = await prisma.personnelReport.findMany({
            where: {
                type: 'DAILY',
                date: { gte: startOfDay, lte: endOfDay }
            }
        });

        // Generate date array
        const dateRange = [];
        let curr = targetStartDate.startOf('day');
        while (curr.isBefore(targetEndDate.endOf('day'))) {
            dateRange.push(curr.format('YYYY-MM-DD'));
            curr = curr.add(1, 'day');
        }

        const summary = users.map(user => {
            const userReports = reports.filter(r => r.userId === user.id);
            const summaryByDate = {};
            
            // Default for the single selected day (for backwards compatibility)
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
                        if (!hasMorning) hasMorning = Array.isArray(m) && m.some(p => p && (typeof p === 'string' ? p.trim() !== '' : p.text && p.text.trim() !== ''));
                        if (!hasAfternoon) hasAfternoon = Array.isArray(a) && a.some(p => p && (typeof p === 'string' ? p.trim() !== '' : p.text && p.text.trim() !== ''));
                        
                        if (Array.isArray(m)) allMorningPoints = allMorningPoints.concat(m.filter(p => p && (typeof p === 'string' ? p.trim() !== '' : p.text && p.text.trim() !== '')));
                        if (Array.isArray(a)) allAfternoonPoints = allAfternoonPoints.concat(a.filter(p => p && (typeof p === 'string' ? p.trim() !== '' : p.text && p.text.trim() !== '')));
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

                // Root props map to the first date in range
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

        res.json({
            dateRange,
            summary
        });
    } catch (error) {
        console.error('Error fetching kabid summary:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.sendReportReminders = async () => {
    try {
        const targetDate = dayjs().tz('Asia/Jakarta');
        const startOfDay = targetDate.startOf('day').toDate();
        const endOfDay = targetDate.endOf('day').toDate();
        const hour = targetDate.hour();
        const isMorningShift = hour < 14;

        const sarprasKeywords = [
            'manajemen aset',
            'gudang dan logistik',
            'kendaraan',
            'teknisi aset',
            'keuangan dan administrasi'
        ];

        const users = await prisma.user.findMany({
            where: {
                OR: sarprasKeywords.map(keyword => ({
                    position: { contains: keyword }
                }))
            },
            select: { id: true, name: true, phone: true }
        });

        const reports = await prisma.personnelReport.findMany({
            where: { type: 'DAILY', date: { gte: startOfDay, lte: endOfDay } }
        });

        for (const user of users) {
            if (!user.phone) continue;
            
            const userReports = reports.filter(r => r.userId === user.id);
            let hasReported = false;

            for (const userReport of userReports) {
                if (userReport.metadata && userReport.metadata.manualPoints) {
                    const pts = userReport.metadata.manualPoints;
                    const m = pts.morningPoints || pts.morning || [];
                    const a = pts.afternoonPoints || pts.afternoon || [];
                    if (isMorningShift) {
                        hasReported = Array.isArray(m) && m.some(p => p && (typeof p === 'string' ? p.trim() !== '' : p.text && p.text.trim() !== ''));
                    } else {
                        hasReported = Array.isArray(a) && a.some(p => p && (typeof p === 'string' ? p.trim() !== '' : p.text && p.text.trim() !== ''));
                    }
                }
                if (hasReported) break;
            }

            if (!hasReported) {
                const shiftName = isMorningShift ? 'Pagi (07.30 - 12.00)' : 'Siang (13.00 - 16.15)';
                const msg = `Halo ${user.name},\n\nAnda belum mengisi *Laporan Kegiatan ${shiftName}* hari ini.\nMohon segera melengkapi laporan Anda pada menu "Laporan Saya" di Sistem Manajemen Aset.\n\nTerima kasih.`;
                await whatsappService.sendMessage(user.phone, msg);
            }
        }
    } catch (error) {
        console.error('Error sending report reminders:', error);
    }
};
