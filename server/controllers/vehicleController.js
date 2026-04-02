const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { deleteFile } = require('../services/minioService');

// Get all vehicles (with latest service KM info)
exports.getAllVehicles = async (req, res) => {
    try {
        const { id: userId, role } = req.user || {};
        const { forMaintenance } = req.query;
        let where = {};

        // Filter by PIC if requested for maintenance and not a global admin/Sarpras staff
        const isSarpras = role === 'KEPALA_BIDANG' || req.user?.position?.includes('Sarana dan Prasarana') || req.user?.position?.includes('Manajemen Aset');
        
        if (forMaintenance === 'true' && userId && !['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT'].includes(role) && !isSarpras) {
            where = {
                pics: {
                    some: { id: userId }
                }
            };
        }

        const vehicles = await prisma.vehicle.findMany({
            where,
            include: {
                pics: { select: { id: true, name: true } },
                bookings: {
                    where: { 
                        status: { in: ['APPROVED', 'BERLANGSUNG'] }, 
                        tripStartTime: { not: null }, 
                        tripEndTime: null 
                    },
                    take: 1,
                    include: { user: { select: { name: true } } }
                },
                services: {
                    where: { category: 'ROUTINE', nextServiceOdometer: { not: null } },
                    orderBy: { date: 'desc' },
                    take: 1,
                    select: { nextServiceOdometer: true, odometer: true, date: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Get last completed user for each vehicle
        const result = await Promise.all(vehicles.map(async v => {
            const latestService = v.services?.[0];
            const activeBooking = v.bookings?.[0];

            const lastBooking = await prisma.vehicleBooking.findFirst({
                where: { vehicleId: v.id, status: 'COMPLETED' },
                orderBy: { tripEndTime: 'desc' },
                include: { user: { select: { name: true } } }
            });

            return {
                ...v,
                nextServiceOdometer: latestService?.nextServiceOdometer || null,
                lastServiceOdometer: latestService?.odometer || null,
                lastServiceDate: latestService?.date || null,
                currentUsedBy: activeBooking?.user?.name || null,
                lastUsedBy: lastBooking?.user?.name || null,
                isBorrowed: !!activeBooking,
                services: undefined,
                bookings: undefined
            };
        }));

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get vehicle by ID
exports.getVehicleById = async (req, res) => {
    try {
        const vehicle = await prisma.vehicle.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { pics: { select: { id: true, name: true } } }
        });
        if (!vehicle) return res.status(404).json({ error: 'Kendaraan tidak ditemukan' });
        res.json(vehicle);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create vehicle
exports.createVehicle = async (req, res) => {
    try {
        const {
            name, brand, model, type, plateNumber,
            fuelType, capacity, color, odometer, photo, status,
            taxDueDate, stnkDueDate, kirDueDate, picIds, isRentable, defaultRentalPrice
        } = req.body;

        console.log('[DEBUG] Create Vehicle Payload:', { name, plateNumber, taxDueDate, stnkDueDate, kirDueDate, picIds, isRentable, defaultRentalPrice });

        const vehicle = await prisma.vehicle.create({
            data: {
                name,
                brand,
                model,
                type,
                plateNumber,
                fuelType,
                capacity,
                color,
                odometer: parseInt(odometer) || 0,
                photo: req.fileUrl || null,
                status: status || 'ACTIVE',
                isRentable: isRentable === true || isRentable === 'true',
                defaultRentalPrice: defaultRentalPrice ? parseFloat(defaultRentalPrice) : null,
                taxDueDate: taxDueDate ? new Date(taxDueDate) : null,
                stnkDueDate: stnkDueDate ? new Date(stnkDueDate) : null,
                kirDueDate: kirDueDate ? new Date(kirDueDate) : null,
                pics: {
                    connect: (picIds || []).map(id => ({ id: parseInt(id) }))
                }
            }
        });
        res.status(201).json(vehicle);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Plat nomor sudah terdaftar' });
        }
        res.status(500).json({ error: error.message });
    }
};

// Update vehicle
exports.updateVehicle = async (req, res) => {
    try {
        const { role } = req.user;
        if (role === 'USER') {
            return res.status(403).json({ error: 'Anda tidak memiliki hak akses untuk mengedit data kendaraan.' });
        }
        const {
            name, brand, model, type, plateNumber,
            fuelType, capacity, color, odometer, photo, status,
            taxDueDate, stnkDueDate, kirDueDate, picIds, isRentable, defaultRentalPrice
        } = req.body;

        // Handle picIds from FormData (it often arrives as picIds[] or multiple picIds fields)
        let resolvedPicIds = picIds;
        if (!resolvedPicIds && req.body['picIds[]']) {
            resolvedPicIds = req.body['picIds[]'];
        }
        // Ensure it's an array
        if (resolvedPicIds && !Array.isArray(resolvedPicIds)) {
            resolvedPicIds = [resolvedPicIds];
        }

        const oldVehicle = await prisma.vehicle.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!oldVehicle) return res.status(404).json({ error: 'Vehicle not found' });

        const parseDate = (d) => {
            if (!d) return null;
            const date = new Date(d);
            return isNaN(date.getTime()) ? null : date;
        };

        const vehicle = await prisma.vehicle.update({
            where: { id: parseInt(req.params.id) },
            data: {
                name,
                brand,
                model,
                type,
                plateNumber,
                fuelType,
                capacity: capacity ? capacity.toString() : undefined,
                color,
                odometer: odometer !== undefined ? parseInt(odometer) : undefined,
                photo: (req.fileUrl && req.fileUrl !== 'undefined' && req.fileUrl !== 'null') ? req.fileUrl : oldVehicle.photo,
                status,
                isRentable: isRentable === true || isRentable === 'true',
                defaultRentalPrice: defaultRentalPrice ? parseFloat(defaultRentalPrice) : null,
                taxDueDate: parseDate(taxDueDate),
                stnkDueDate: parseDate(stnkDueDate),
                kirDueDate: parseDate(kirDueDate),
                pics: {
                    set: (resolvedPicIds || [])
                        .map(id => parseInt(id))
                        .filter(id => !isNaN(id))
                        .map(id => ({ id }))
                }
            }
        });

        // Cleanup old photo if updated
        if (req.fileUrl && req.fileUrl !== 'undefined' && oldVehicle?.photo && oldVehicle.photo !== req.fileUrl) {
            console.log('[DEBUG] Cleaning up old photo:', oldVehicle.photo);
            await deleteFile(oldVehicle.photo);
        }

        res.json(vehicle);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Checker for Vehicle Tax Notifications (25 days before)
 */
const { sendMessage } = require('../services/whatsappService');

exports.checkTaxNotifications = async () => {
    try {
        console.log('Checking for vehicle tax notifications (25 days)...');

        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 25);

        const startOfTarget = new Date(targetDate.setHours(0, 0, 0, 0));
        const endOfTarget = new Date(targetDate.setHours(23, 59, 59, 999));

        const vehicles = await prisma.vehicle.findMany({
            where: {
                status: 'ACTIVE',
                OR: [
                    { taxDueDate: { gte: startOfTarget, lte: endOfTarget } },
                    { stnkDueDate: { gte: startOfTarget, lte: endOfTarget } }
                ]
            }
        });

        if (vehicles.length === 0) return;

        // Find recipients: Leads (Kepala Bidang Sarana dan Prasarana) and Eldo
        const recipients = await prisma.user.findMany({
            where: {
                OR: [
                    { position: 'Kepala Bidang Sarana dan Prasarana' },
                    { position: 'Staff Manajemen Aset' }
                    // Eldo replaced by position
                ],
                phone: { not: null, not: '' }
            }
        });

        if (recipients.length === 0) {
            console.log('No recipients (Ravi or Eldo) found or they do not have phone numbers for tax notification.');
            return;
        }

        for (const vehicle of vehicles) {
            let taxType = "";
            let dueDate = null;

            if (vehicle.taxDueDate >= startOfTarget && vehicle.taxDueDate <= endOfTarget) {
                taxType = "Pajak Tahunan";
                dueDate = vehicle.taxDueDate;
            } else {
                taxType = "Pajak 5 Tahunan (STNK)";
                dueDate = vehicle.stnkDueDate;
            }

            const message = `📢 *PENGINGAT PAJAK KENDARAAN*\n\n` +
                `Kendaraan *${vehicle.name} (${vehicle.plateNumber})* akan jatuh tempo *${taxType}* dalam 25 hari.\n\n` +
                `Tanggal Jatuh Tempo: ${new Date(dueDate).toLocaleDateString('id-ID')}\n` +
                `Mohon segera diproses pembayarannya.`;

            let cumulativeDelay = 0;
            for (const person of recipients) {
                const randomGap = Math.floor(Math.random() * (20000 - 5000 + 1)) + 5000;
                cumulativeDelay += randomGap;

                setTimeout(async () => {
                    try {
                        await sendMessage(person.phone, message);
                        console.log(`Tax notification sent for ${vehicle.name} to ${person.name} (${person.phone})`);
                    } catch (e) {
                        console.error(`[Vehicle Tax] Failed to notify ${person.name}:`, e.message);
                    }
                }, cumulativeDelay);
            }
        }
    } catch (error) {
        console.error('Failed to check tax notifications:', error.message);
    }
};

/**
 * Checker for Vehicle KIR Notifications
 * Sent 30 days before, then every 5 days (25, 20, 15, 10, 5, 0)
 */
exports.checkKirNotifications = async () => {
    try {
        console.log('Checking for vehicle KIR notifications...');

        const vehicles = await prisma.vehicle.findMany({
            where: {
                status: 'ACTIVE',
                kirDueDate: { not: null }
            }
        });

        if (vehicles.length === 0) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find recipients: Leads and Finance Staff
        const recipients = await prisma.user.findMany({
            where: {
                position: { in: ['Kepala Bidang Sarana dan Prasarana', 'Staff Keuangan dan Administrasi (Sarpras)'] },
                phone: { not: null, not: '' }
            }
        });

        if (recipients.length === 0) {
            console.log('No recipients found for KIR notification.');
            return;
        }

        for (const vehicle of vehicles) {
            const dueDate = new Date(vehicle.kirDueDate);
            dueDate.setHours(0, 0, 0, 0);

            const diffInTime = dueDate.getTime() - today.getTime();
            const diffInDays = Math.ceil(diffInTime / (1000 * 3600 * 24));

            // Notify on day 30, 25, 20, 15, 10, 5, and 0
            if ([30, 25, 20, 15, 10, 5, 0].includes(diffInDays)) {
                const dayLabel = diffInDays === 0 ? "HARI INI" : `dalam ${diffInDays} hari`;
                const message = `🚚 *PENGINGAT JADWAL KIR*\n\n` +
                    `Kendaraan *${vehicle.name} (${vehicle.plateNumber})* akan jatuh tempo *KIR* ${dayLabel}.\n\n` +
                    `Tanggal Jatuh Tempo: ${new Date(vehicle.kirDueDate).toLocaleDateString('id-ID')}\n` +
                    `Mohon segera diproses pendaftarannya.`;

                let cumulativeDelay = 0;
                for (const person of recipients) {
                    const randomGap = Math.floor(Math.random() * (20000 - 5000 + 1)) + 5000;
                    cumulativeDelay += randomGap;

                    setTimeout(async () => {
                        try {
                            await sendMessage(person.phone, message);
                            console.log(`KIR notification sent for ${vehicle.name} to ${person.name} (${person.phone})`);
                        } catch (e) {
                            console.error(`[Vehicle KIR] Failed to notify ${person.name}:`, e.message);
                        }
                    }, cumulativeDelay);
                }
            }
        }
    } catch (error) {
        console.error('Failed to check KIR notifications:', error.message);
    }
};

// Manual trigger for testing notifications
exports.triggerTaxCheck = async (req, res) => {
    try {
        await exports.checkTaxNotifications();
        res.json({ message: 'Tax notification check triggered. Check server console for logs.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Send a direct test message to Kabid Sarpras
exports.sendTestWA = async (req, res) => {
    try {
        const recipients = await prisma.user.findMany({
            where: {
                OR: [
                    { position: 'Kepala Bidang Sarana dan Prasarana' },
                    { position: 'Staff Manajemen Aset' }
                    // Eldo replaced by position
                ],
                phone: { not: null, not: '' }
            }
        });

        if (recipients.length === 0) {
            return res.status(404).json({ error: 'Ravi atau Eldo tidak ditemukan atau tidak memiliki nomor HP.' });
        }

        let cumulativeDelay = 0;
        for (const person of recipients) {
            const randomGap = Math.floor(Math.random() * (20000 - 5000 + 1)) + 5000;
            cumulativeDelay += randomGap;

            setTimeout(async () => {
                const message = `🧪 *TEST NOTIFIKASI SISTEM*\n\nWhatsApp Service Aktif!\nTarget: ${person.name}\nNomor: ${person.phone}\nPesan ini dikirim untuk memverifikasi jalur komunikasi.`;
                await sendMessage(person.phone, message);
            }, cumulativeDelay);
        }
        res.json({ message: `Test messages sent to ${recipients.length} recipients` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Send a direct message without DB lookup (for local testing without DB)
exports.sendPureTestWA = async (req, res) => {
    try {
        const { phone } = req.query;
        if (!phone) return res.status(400).json({ error: 'Parameter ?phone=... wajib diisi' });

        const message = `🧪 *TEST PURE WA*\n\nWhatsApp Service successfully reached from local server!\nTarget: ${phone}\nPesan ini dikirim tanpa koneksi database.`;

        await sendMessage(phone, message);
        res.json({ message: `Pure test message sent to ${phone}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete vehicle
exports.deleteVehicle = async (req, res) => {
    try {
        const { role } = req.user;
        if (role === 'USER') {
            return res.status(403).json({ error: 'Anda tidak memiliki hak akses untuk menghapus data kendaraan.' });
        }
        const { id } = req.params;
        const vehicle = await prisma.vehicle.findUnique({ where: { id: parseInt(id) } });

        if (vehicle?.photo) {
            await deleteFile(vehicle.photo);
        }

        await prisma.vehicle.delete({
            where: { id: parseInt(id) }
        });
        res.json({ message: 'Kendaraan berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getVehicleDashboard = async (req, res) => {
    try {
        const { month, year } = req.query;
        const now = new Date();
        const thirtyDaysFromNow = new Date(new Date().setDate(now.getDate() + 30));

        // 1. Determine Date Filter Range
        let filterStart, filterEnd, isSummary = true;
        if (month && year) {
            filterStart = new Date(parseInt(year), parseInt(month) - 1, 1);
            filterEnd = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
            isSummary = false;
        } else {
            // Default to all-time summary or last 30 days depending on metric
            filterStart = new Date(0); // All time
            filterEnd = new Date(now);
        }

        const thirtyDaysPast = new Date(new Date().setDate(now.getDate() - 30));

        // 2. Fetch ALL Active Vehicles
        const allVehicles = await prisma.vehicle.findMany({
            where: { status: 'ACTIVE' },
            include: {
                services: {
                    where: { category: 'ROUTINE', nextServiceOdometer: { not: null } },
                    orderBy: { odometer: 'desc' },
                    take: 1
                }
            }
        });
        const allVehicleNames = allVehicles.map(v => v.name);

        const activeBookingsCount = await prisma.vehicleBooking.count({
            where: { status: 'BERLANGSUNG' }
        });

        // 3. Urgent Actions (Real-time - Always showing upcoming)
        const urgentActions = [];
        allVehicles.forEach(v => {
            if (v.taxDueDate && v.taxDueDate <= thirtyDaysFromNow) urgentActions.push({ vehicle: v.name, plate: v.plateNumber, action: 'Perpanjang Pajak', type: 'TAX', date: v.taxDueDate });
            if (v.stnkDueDate && v.stnkDueDate <= thirtyDaysFromNow) urgentActions.push({ vehicle: v.name, plate: v.plateNumber, action: 'Ganti Plat/STNK', type: 'STNK', date: v.stnkDueDate });
            if (v.kirDueDate && v.kirDueDate <= thirtyDaysFromNow) urgentActions.push({ vehicle: v.name, plate: v.plateNumber, action: 'Uji KIR', type: 'KIR', date: v.kirDueDate });
            const lastRoutine = v.services?.[0];
            if (lastRoutine && v.odometer >= lastRoutine.nextServiceOdometer) urgentActions.push({ vehicle: v.name, plate: v.plateNumber, action: 'Servis Rutin (Overdue)', type: 'SERVICE', km: lastRoutine.nextServiceOdometer });
        });
        urgentActions.sort((a, b) => (a.date || 0) - (b.date || 0));

        // 4. Monthly Trends (Always 6 Months back from NOW)
        const bookingTrends = [];
        const mileageTrends = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
            const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

            const bCount = await prisma.vehicleBooking.count({
                where: { createdAt: { gte: mStart, lte: mEnd } }
            });

            const completedForMonth = await prisma.vehicleBooking.findMany({
                where: { status: 'COMPLETED', tripEndTime: { gte: mStart, lte: mEnd }, startKm: { not: null }, endKm: { not: null } },
                select: { startKm: true, endKm: true, vehicle: { select: { name: true } } }
            });

            const monthName = d.toLocaleString('id-ID', { month: 'short', year: 'numeric' });
            const mileageObj = { name: monthName };
            allVehicleNames.forEach(name => mileageObj[name] = 0);
            completedForMonth.forEach(b => { if (b.vehicle?.name) mileageObj[b.vehicle.name] += (b.endKm - b.startKm); });

            bookingTrends.push({ name: monthName, value: bCount });
            mileageTrends.push(mileageObj);
        }

        // 5. Filtered Vehicle Matrix (vStats)
        const vStats = await Promise.all(allVehicles.map(async v => {
            const [completedBookings, fuelLogs, serviceLogs] = await Promise.all([
                prisma.vehicleBooking.findMany({
                    where: { vehicleId: v.id, status: 'COMPLETED', tripEndTime: { gte: isSummary ? thirtyDaysPast : filterStart, lte: filterEnd } },
                    select: { startKm: true, endKm: true, fuelLiters: true, fuelPrice: true, tripStartTime: true, tripEndTime: true }
                }),
                prisma.vehicleFuelLog.findMany({
                    where: { vehicleId: v.id, date: { gte: isSummary ? thirtyDaysPast : filterStart, lte: filterEnd } },
                    select: { liters: true, cost: true }
                }),
                prisma.vehicleService.findMany({
                    where: { vehicleId: v.id, date: { gte: isSummary ? thirtyDaysPast : filterStart, lte: filterEnd } },
                    select: { cost: true }
                })
            ]);

            const dTotalKm = completedBookings.reduce((sum, b) => sum + ((b.endKm || 0) - (b.startKm || 0)), 0);
            const dLiters = completedBookings.reduce((sum, b) => sum + (b.fuelLiters || 0), 0) + fuelLogs.reduce((sum, l) => sum + l.liters, 0);
            const dFuelCost = completedBookings.reduce((sum, b) => sum + (b.fuelPrice || 0), 0) + fuelLogs.reduce((sum, l) => sum + l.cost, 0);
            const dServiceCost = serviceLogs.reduce((sum, l) => sum + l.cost, 0);

            const activeDays = new Set();
            completedBookings.forEach(b => {
                if (b.tripStartTime) {
                    const start = new Date(b.tripStartTime);
                    const end = b.tripEndTime ? new Date(b.tripEndTime) : new Date();
                    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) activeDays.add(new Date(d).toDateString());
                }
            });
            const daysInPeriod = isSummary ? 30 : (filterEnd.getDate());
            const utilization = (activeDays.size / daysInPeriod) * 100;

            return {
                id: v.id, name: v.name, plate: v.plateNumber,
                kml: dLiters > 0 ? (dTotalKm / dLiters) : 0,
                utilization: Math.min(utilization, 100),
                cpkm: dTotalKm > 0 ? (dFuelCost + dServiceCost) / dTotalKm : 0,
                totalKm: dTotalKm
            };
        }));

        // 6. Overall Stats & availableMonths
        const availableMonthsData = await prisma.vehicleBooking.findMany({
            where: { status: 'COMPLETED' },
            select: { tripEndTime: true },
            distinct: ['tripEndTime']
        });
        const availableMonths = [...new Set(availableMonthsData.map(b => {
            const date = new Date(b.tripEndTime);
            return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        }))].sort().reverse();

        const [fuelTotalObj, serviceTotalObj, fleetKmAll] = await Promise.all([
            prisma.vehicleFuelLog.aggregate({ _sum: { cost: true, liters: true }, where: { date: { gte: filterStart, lte: filterEnd } } }),
            prisma.vehicleService.aggregate({ _sum: { cost: true }, where: { date: { gte: filterStart, lte: filterEnd } } }),
            prisma.vehicleBooking.findMany({ where: { status: 'COMPLETED', tripEndTime: { gte: filterStart, lte: filterEnd } }, select: { startKm: true, endKm: true, fuelPrice: true, fuelLiters: true } })
        ]);

        const totalKmAll = fleetKmAll.reduce((sum, b) => sum + ((b.endKm || 0) - (b.startKm || 0)), 0);
        const fuelTotal = (fuelTotalObj._sum.cost || 0) + fleetKmAll.reduce((sum, b) => sum + (b.fuelPrice || 0), 0);
        const fuelLiters = (fuelTotalObj._sum.liters || 0) + fleetKmAll.reduce((sum, b) => sum + (b.fuelLiters || 0), 0);
        const serviceTotal = serviceTotalObj._sum.cost || 0;

        res.json({
            isSummary,
            period: month && year ? `${month}/${year}` : 'SUMMARY',
            stats: {
                totalVehicles: allVehicles.length,
                activeBookings: activeBookingsCount,
                needingService: urgentActions.filter(a => a.type === 'SERVICE').length,
                taxWarnings: urgentActions.filter(a => ['TAX', 'STNK', 'KIR'].includes(a.type)).length,
                fleetCostPerKm: totalKmAll > 0 ? (fuelTotal + serviceTotal) / totalKmAll : 0,
                fleetKml: fuelLiters > 0 ? (totalKmAll / fuelLiters) : 0
            },
            urgentActions,
            availableMonths,
            vStats: vStats.sort((a, b) => b.totalKm - a.totalKm),
            bookingTrends,
            mileageTrends,
            allVehicleNames
        });
    } catch (error) {
        console.error('Vehicle Dashboard Error:', error);
        res.status(500).json({ error: error.message });
    }
};
