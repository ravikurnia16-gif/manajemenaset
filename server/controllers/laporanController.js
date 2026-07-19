const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

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

        res.json({ success: true, reports, myReport, globalSummary });

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
