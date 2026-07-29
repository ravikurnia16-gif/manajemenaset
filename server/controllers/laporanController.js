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
        const isGlobalAdmin = ['SUPER_ADMIN', 'BIDANG_IT', 'ADMIN_ASET', 'KABID_SARPRAS'].includes(req.user.role);
        
        let whereClause = {
            type: 'DAILY',
            date: {
                gte: startOfDay,
                lte: endOfDay
            }
        };

        if (category) {
            whereClause.category = category;
        }

        // If not an admin, they can only view their own report
        if (!isGlobalAdmin) {
            whereClause.userId = req.user.id;
        }

        const reports = await prisma.personnelReport.findMany({
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

        // Bersihkan log mentah (rute API) lama agar tidak tampil di frontend
        // Karena sekarang sudah digantikan oleh Global Summary
        reports.forEach(r => {
            if (r.category === 'KENDARAAN') {
                r.content = '';
            }
        });

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
                category: category || 'UMUM',
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
        const { date } = req.query;
        let targetDate = dayjs().tz('Asia/Jakarta');
        if (date) {
            targetDate = dayjs(date).tz('Asia/Jakarta');
        }
        const startOfDay = targetDate.startOf('day').toDate();
        const endOfDay = targetDate.endOf('day').toDate();

        const sarprasPositions = [
            'Staff Manajemen Aset',
            'Staff Gudang dan Logistik',
            'Staff Kendaraan',
            'Staff Teknisi Aset',
            'Staff Keuangan dan Administrasi (Sarpras)'
        ];

        const users = await prisma.user.findMany({
            where: {
                position: { in: sarprasPositions },
                isActive: true
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

        const summary = users.map(user => {
            // Find ALL reports for this user on this day (across all categories)
            const userReports = reports.filter(r => r.userId === user.id);
            let hasMorning = false;
            let hasAfternoon = false;

            // Collect all manual points across all categories
            let allMorningPoints = [];
            let allAfternoonPoints = [];

            for (const userReport of userReports) {
                if (userReport.metadata && userReport.metadata.manualPoints) {
                    const pts = userReport.metadata.manualPoints;
                    const m = pts.morningPoints || pts.morning || [];
                    const a = pts.afternoonPoints || pts.afternoon || [];
                    if (!hasMorning) {
                        hasMorning = Array.isArray(m) && m.some(p => p && (typeof p === 'string' ? p.trim() !== '' : p.text && p.text.trim() !== ''));
                    }
                    if (!hasAfternoon) {
                        hasAfternoon = Array.isArray(a) && a.some(p => p && (typeof p === 'string' ? p.trim() !== '' : p.text && p.text.trim() !== ''));
                    }
                    // Accumulate points
                    if (Array.isArray(m)) allMorningPoints = allMorningPoints.concat(m.filter(p => p && (typeof p === 'string' ? p.trim() !== '' : p.text && p.text.trim() !== '')));
                    if (Array.isArray(a)) allAfternoonPoints = allAfternoonPoints.concat(a.filter(p => p && (typeof p === 'string' ? p.trim() !== '' : p.text && p.text.trim() !== '')));
                }
                if (hasMorning && hasAfternoon) break; // Already LENGKAP, no need to check more
            }

            let status = 'BELUM';
            if (hasMorning && hasAfternoon) status = 'LENGKAP';
            else if (hasMorning || hasAfternoon) status = 'PARSIAL';

            return {
                ...user,
                hasMorning,
                hasAfternoon,
                status,
                reportId: userReports.length > 0 ? userReports[0].id : null,
                reportData: (allMorningPoints.length > 0 || allAfternoonPoints.length > 0)
                    ? { morning: allMorningPoints, afternoon: allAfternoonPoints }
                    : null
            };
        });

        res.json(summary);
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

        const sarprasPositions = [
            'Staff Manajemen Aset',
            'Staff Gudang dan Logistik',
            'Staff Kendaraan',
            'Staff Teknisi Aset',
            'Staff Keuangan dan Administrasi (Sarpras)',
            'Kepala Bidang Sarana'
        ];

        const users = await prisma.user.findMany({
            where: {
                position: { in: sarprasPositions },
                isActive: true
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
