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
        const now = new Date();
        const thirtyDaysFromNow = new Date(new Date().setDate(now.getDate() + 30));

        // 1. Basic Stats & Tax
        const [totalVehicles, activeBookingsCount, taxWarnings] = await Promise.all([
            prisma.vehicle.count({ where: { status: 'ACTIVE' } }),
            prisma.vehicleBooking.count({
                where: {
                    status: 'APPROVED',
                    tripStartTime: { not: null },
                    tripEndTime: null
                }
            }),
            prisma.vehicle.count({
                where: {
                    status: 'ACTIVE',
                    OR: [
                        { taxDueDate: { lte: thirtyDaysFromNow } },
                        { stnkDueDate: { lte: thirtyDaysFromNow } }
                    ]
                }
            })
        ]);

        // 2. Needing Service Calculation
        // Since nextServiceOdometer is in the VehicleService model, we fetch vehicles and check their latest routine service
        const vehiclesForService = await prisma.vehicle.findMany({
            where: { status: 'ACTIVE' },
            select: {
                id: true,
                odometer: true,
                services: {
                    where: { category: 'ROUTINE', nextServiceOdometer: { not: null } },
                    orderBy: { odometer: 'desc' },
                    take: 1
                }
            }
        });

        const needingService = vehiclesForService.filter(v => {
            const lastRoutine = v.services?.[0];
            if (!lastRoutine) return false; // Or should we return true if no service history? Assuming false for now.
            return v.odometer >= lastRoutine.nextServiceOdometer;
        }).length;

        // New additions for charts
        const destinations = await prisma.vehicleBooking.groupBy({
            by: ['destination'],
            where: { status: 'COMPLETED' },
            _count: { _all: true }
        });
        const topDestinations = destinations.sort((a, b) => b._count._all - a._count._all).slice(0, 5).map(d => ({
            name: d.destination || 'Tanpa Tujuan',
            value: d._count._all
        }));

        const vehicleUsage = await prisma.vehicleBooking.groupBy({
            by: ['vehicleId'],
            where: { status: 'COMPLETED' },
            _count: { _all: true }
        });
        const vehiclesRaw = await prisma.vehicle.findMany({ select: { id: true, name: true } });
        const vehicleMap = {};
        vehiclesRaw.forEach(v => vehicleMap[v.id] = v.name);
        const topVehicles = vehicleUsage.sort((a, b) => b._count._all - a._count._all).slice(0, 5).map(u => ({
            name: vehicleMap[u.vehicleId] || 'Unknown',
            value: u._count._all
        }));

        const allVehicleNames = vehiclesRaw.map(v => v.name);

        // 3. Monthly Trends (Bookings & Mileage - Last 6 Months)
        const bookingTrends = [];
        const mileageTrends = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
            const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

            // Booking Count
            const bCount = await prisma.vehicleBooking.count({
                where: { createdAt: { gte: mStart, lte: mEnd } }
            });

            // Mileage Calculation (endKm - startKm)
            const completedBookings = await prisma.vehicleBooking.findMany({
                where: {
                    status: 'COMPLETED',
                    tripEndTime: { gte: mStart, lte: mEnd },
                    startKm: { not: null },
                    endKm: { not: null }
                },
                select: { startKm: true, endKm: true, vehicle: { select: { name: true } } }
            });

            const monthName = d.toLocaleString('id-ID', { month: 'short', year: 'numeric' });

            const mileageObj = { name: monthName };
            allVehicleNames.forEach(name => mileageObj[name] = 0);

            completedBookings.forEach(b => {
                if (b.vehicle && b.vehicle.name) {
                    mileageObj[b.vehicle.name] += (b.endKm - b.startKm);
                }
            });

            bookingTrends.push({ name: monthName, value: bCount });
            mileageTrends.push(mileageObj);
        }

        // 4. Vehicle Type Distribution
        const types = await prisma.vehicle.groupBy({
            by: ['type'],
            where: { status: 'ACTIVE' },
            _count: { _all: true }
        });

        // 5. Cost Analytics (Total & Trends)
        const [fuelLogs, serviceLogs, refillBookings] = await Promise.all([
            prisma.vehicleFuelLog.findMany({ select: { cost: true, date: true } }),
            prisma.vehicleService.findMany({ select: { cost: true, date: true } }),
            prisma.vehicleBooking.findMany({
                where: { fuelRefill: true, fuelPrice: { gt: 0 } },
                select: { fuelPrice: true, updatedAt: true }
            })
        ]);

        const totalFuelCost = fuelLogs.reduce((sum, log) => sum + log.cost, 0) +
            refillBookings.reduce((sum, b) => sum + b.fuelPrice, 0);
        const totalServiceCost = serviceLogs.reduce((sum, log) => sum + log.cost, 0);

        // Monthly Cost Trends (Last 6 Months)
        const costTrends = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
            const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

            const mFuel = fuelLogs
                .filter(log => log.date >= mStart && log.date <= mEnd)
                .reduce((sum, log) => sum + log.cost, 0) +
                refillBookings
                    .filter(b => b.updatedAt >= mStart && b.updatedAt <= mEnd)
                    .reduce((sum, b) => sum + b.fuelPrice, 0);

            const mService = serviceLogs
                .filter(log => log.date >= mStart && log.date <= mEnd)
                .reduce((sum, log) => sum + log.cost, 0);

            costTrends.push({
                name: d.toLocaleString('id-ID', { month: 'short' }),
                fuel: mFuel,
                service: mService
            });
        }

        res.json({
            stats: {
                totalVehicles,
                activeBookings: activeBookingsCount,
                needingService,
                taxWarnings,
                totalFuelCost,
                totalServiceCost
            },
            bookingTrends,
            costTrends,
            mileageTrends,
            topDestinations,
            topVehicles,
            allVehicleNames,
            typeDistribution: types.map(t => ({ name: t.type, value: t._count._all }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
