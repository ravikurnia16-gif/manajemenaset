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
                pics: { select: { id: true, name: true, phone: true } },
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
                where: { vehicleId: v.id, status: 'COMPLETED', endKm: { not: null } },
                orderBy: { tripEndTime: 'desc' },
                include: { user: { select: { name: true } } }
            });

            const actualOdometer = Math.max(v.odometer || 0, lastBooking?.endKm || 0);

            return {
                ...v,
                odometer: actualOdometer,
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
            include: { pics: { select: { id: true, name: true, phone: true } } }
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
 * Checker for Vehicle Tax Notifications (Pajak Tahunan + 5 Tahunan)
 * Dikirim ke Staff Gudang dan Logistik pada H-25, H-20, H-15, H-10, H-7, H-5, H-3, H-2, H-1
 */
const { sendMessage } = require('../services/whatsappService');

const REMINDER_DAYS = [25, 20, 15, 10, 7, 5, 3, 2, 1];

exports.checkTaxNotifications = async () => {
    try {
        console.log('Checking for vehicle tax notifications...');

        const vehicles = await prisma.vehicle.findMany({
            where: {
                OR: [
                    { taxDueDate: { not: null } },
                    { stnkDueDate: { not: null } }
                ]
            }
        });

        if (vehicles.length === 0) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Only Staff Gudang dan Logistik
        const recipients = await prisma.user.findMany({
            where: {
                position: 'Staff Gudang dan Logistik',
                phone: { not: null }
            }
        });

        if (recipients.length === 0) {
            console.log('No Staff Gudang dan Logistik found for tax notification.');
            return;
        }

        for (const vehicle of vehicles) {
            const alerts = [];

            // Check Pajak Tahunan
            if (vehicle.taxDueDate) {
                const dueDate = new Date(vehicle.taxDueDate);
                dueDate.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((dueDate - today) / (1000 * 3600 * 24));
                if (REMINDER_DAYS.includes(diffDays)) {
                    alerts.push({ type: 'Pajak Tahunan', dueDate: vehicle.taxDueDate, daysLeft: diffDays });
                }
            }

            // Check Pajak 5 Tahunan (STNK)
            if (vehicle.stnkDueDate) {
                const dueDate = new Date(vehicle.stnkDueDate);
                dueDate.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((dueDate - today) / (1000 * 3600 * 24));
                if (REMINDER_DAYS.includes(diffDays)) {
                    alerts.push({ type: 'Pajak 5 Tahunan (STNK)', dueDate: vehicle.stnkDueDate, daysLeft: diffDays });
                }
            }

            for (const alert of alerts) {
                const dayLabel = alert.daysLeft === 1 ? "BESOK" : `${alert.daysLeft} hari lagi`;
                const emoji = alert.daysLeft <= 3 ? '🚨' : alert.daysLeft <= 7 ? '⚠️' : '📢';
                const message = `${emoji} *PENGINGAT ${alert.type.toUpperCase()}*\n\n` +
                    `Kendaraan *${vehicle.name} (${vehicle.plateNumber})* akan jatuh tempo *${alert.type}* ${dayLabel}.\n\n` +
                    `📅 Jatuh Tempo: ${new Date(alert.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}\n` +
                    `Mohon segera diproses pembayarannya.`;

                let cumulativeDelay = 0;
                for (const person of recipients) {
                    const randomGap = Math.floor(Math.random() * (20000 - 5000 + 1)) + 5000;
                    cumulativeDelay += randomGap;
                    setTimeout(async () => {
                        try {
                            await sendMessage(person.phone, message);
                            console.log(`Tax notification (${alert.type}, H-${alert.daysLeft}) sent for ${vehicle.name} to ${person.name}`);
                        } catch (e) {
                            console.error(`[Vehicle Tax] Failed to notify ${person.name}:`, e.message);
                        }
                    }, cumulativeDelay);
                }
            }
        }
    } catch (error) {
        console.error('Failed to check tax notifications:', error.message);
    }
};

/**
 * Checker for Vehicle KIR Notifications
 * Dikirim ke Staff Gudang dan Logistik pada H-25, H-20, H-15, H-10, H-7, H-5, H-3, H-2, H-1
 */
exports.checkKirNotifications = async () => {
    try {
        console.log('Checking for vehicle KIR notifications...');

        const vehicles = await prisma.vehicle.findMany({
            where: { kirDueDate: { not: null } }
        });

        if (vehicles.length === 0) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Only Staff Gudang dan Logistik
        const recipients = await prisma.user.findMany({
            where: {
                position: 'Staff Gudang dan Logistik',
                phone: { not: null }
            }
        });

        if (recipients.length === 0) {
            console.log('No Staff Gudang dan Logistik found for KIR notification.');
            return;
        }

        for (const vehicle of vehicles) {
            const dueDate = new Date(vehicle.kirDueDate);
            dueDate.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((dueDate - today) / (1000 * 3600 * 24));

            if (REMINDER_DAYS.includes(diffDays)) {
                const dayLabel = diffDays === 1 ? "BESOK" : `${diffDays} hari lagi`;
                const emoji = diffDays <= 3 ? '🚨' : diffDays <= 7 ? '⚠️' : '🚚';
                const message = `${emoji} *PENGINGAT JADWAL KIR*\n\n` +
                    `Kendaraan *${vehicle.name} (${vehicle.plateNumber})* akan jatuh tempo *KIR* ${dayLabel}.\n\n` +
                    `📅 Jatuh Tempo: ${new Date(vehicle.kirDueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}\n` +
                    `Mohon segera diproses pendaftarannya.`;

                let cumulativeDelay = 0;
                for (const person of recipients) {
                    const randomGap = Math.floor(Math.random() * (20000 - 5000 + 1)) + 5000;
                    cumulativeDelay += randomGap;
                    setTimeout(async () => {
                        try {
                            await sendMessage(person.phone, message);
                            console.log(`KIR notification (H-${diffDays}) sent for ${vehicle.name} to ${person.name}`);
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

// Mark Tax/KIR as paid and extend the date
exports.markVehicleAsPaid = async (req, res) => {
    try {
        const { id } = req.params;
        const { type, cost } = req.body; // 'TAX', 'STNK', 'KIR' + cost

        const vehicle = await prisma.vehicle.findUnique({ where: { id: parseInt(id) } });
        if (!vehicle) return res.status(404).json({ error: 'Kendaraan tidak ditemukan' });

        let updateData = {};
        let label = "";
        let serviceType = "PAJAK";
        let nextDate = null;

        if (type === 'TAX') {
            const current = vehicle.taxDueDate || new Date();
            nextDate = new Date(current);
            nextDate.setFullYear(nextDate.getFullYear() + 1);
            updateData.taxDueDate = nextDate;
            label = "Pajak Tahunan";
            serviceType = "PAJAK";
        } else if (type === 'STNK') {
            // Pajak 5 Tahunan: update STNK + sekaligus update Pajak Tahunan
            const currentStnk = vehicle.stnkDueDate || new Date();
            nextDate = new Date(currentStnk);
            nextDate.setFullYear(nextDate.getFullYear() + 5);
            updateData.stnkDueDate = nextDate;

            // Also update annual tax date (+1 year from now)
            const currentTax = vehicle.taxDueDate || new Date();
            const nextTaxDate = new Date(currentTax);
            nextTaxDate.setFullYear(nextTaxDate.getFullYear() + 1);
            updateData.taxDueDate = nextTaxDate;

            label = "Pajak 5 Tahunan (STNK)";
            serviceType = "PAJAK";
        } else if (type === 'KIR') {
            const current = vehicle.kirDueDate || new Date();
            nextDate = new Date(current);
            nextDate.setMonth(nextDate.getMonth() + 6);
            updateData.kirDueDate = nextDate;
            label = "Uji KIR";
            serviceType = "OTHER";
        } else {
            return res.status(400).json({ error: 'Tipe pembayaran tidak valid' });
        }

        // 1. Update Vehicle Date
        await prisma.vehicle.update({
            where: { id: parseInt(id) },
            data: updateData
        });

        const parsedCost = parseFloat(cost) || 0;

        // 2. Create Service Log for history (with cost)
        await prisma.vehicleService.create({
            data: {
                vehicleId: parseInt(id),
                date: new Date(),
                type: serviceType,
                category: 'ROUTINE',
                description: `Konfirmasi: ${label} telah dibayar${parsedCost > 0 ? ` (Rp ${parsedCost.toLocaleString('id-ID')})` : ''}. Jadwal berikutnya diperbarui.`,
                cost: parsedCost
            }
        });

        let message = `Konfirmasi ${label} berhasil.`;
        if (type === 'STNK') {
            message += ` Pajak 5 Tahunan diperbarui ke ${nextDate.toLocaleDateString('id-ID')}. Pajak Tahunan juga diperbarui ke ${updateData.taxDueDate.toLocaleDateString('id-ID')}.`;
        } else {
            message += ` Jadwal diperbarui ke ${nextDate.toLocaleDateString('id-ID')}.`;
        }

        res.json({ message, nextDate });
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

        // 2. Fetch ALL Vehicles
        const allVehicles = await prisma.vehicle.findMany({
            where: {}, // Include all, even if inactive
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
            if (v.stnkDueDate && v.stnkDueDate <= thirtyDaysFromNow) {
                urgentActions.push({ id: v.id, vehicle: v.name, plate: v.plateNumber, action: 'Ganti Plat/STNK', type: 'STNK', date: v.stnkDueDate });
            } else if (v.taxDueDate && v.taxDueDate <= thirtyDaysFromNow) {
                urgentActions.push({ id: v.id, vehicle: v.name, plate: v.plateNumber, action: 'Perpanjang Pajak', type: 'TAX', date: v.taxDueDate });
            }

            if (v.kirDueDate && v.kirDueDate <= thirtyDaysFromNow) urgentActions.push({ id: v.id, vehicle: v.name, plate: v.plateNumber, action: 'Uji KIR', type: 'KIR', date: v.kirDueDate });
            const lastRoutine = v.services?.[0];
            if (lastRoutine && v.odometer >= lastRoutine.nextServiceOdometer) urgentActions.push({ id: v.id, vehicle: v.name, plate: v.plateNumber, action: 'Servis Rutin (Overdue)', type: 'SERVICE', km: lastRoutine.nextServiceOdometer });
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
                    select: { 
                        startKm: true, endKm: true, fuelLiters: true, fuelPrice: true, tripStartTime: true, tripEndTime: true,
                        user: { select: { unit: { select: { name: true } } } }
                    }
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
            
            // Calculate Usage per Unit
            const unitUsageMap = {};

            completedBookings.forEach(b => {
                if (b.tripStartTime) {
                    const start = new Date(b.tripStartTime);
                    const end = b.tripEndTime ? new Date(b.tripEndTime) : new Date();
                    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) activeDays.add(new Date(d).toDateString());
                }

                const unitName = b.user?.unit?.name || 'Tanpa Unit';
                if (!unitUsageMap[unitName]) {
                    unitUsageMap[unitName] = { distance: 0, fuelCost: 0 };
                }
                unitUsageMap[unitName].distance += ((b.endKm || 0) - (b.startKm || 0));
                unitUsageMap[unitName].fuelCost += (b.fuelPrice || 0);
            });
            
            const daysInPeriod = isSummary ? 30 : (filterEnd.getDate());
            const utilization = (activeDays.size / daysInPeriod) * 100;

            const unitUsageArray = Object.keys(unitUsageMap).map(unit => ({
                unit,
                distance: unitUsageMap[unit].distance,
                fuelCost: unitUsageMap[unit].fuelCost
            })).sort((a, b) => b.distance - a.distance);

            return {
                id: v.id, name: v.name, plate: v.plateNumber,
                kml: dLiters > 0 ? (dTotalKm / dLiters) : 0,
                utilization: Math.min(utilization, 100),
                cpkm: dTotalKm > 0 ? (dFuelCost + dServiceCost) / dTotalKm : 0,
                fuelCpkm: dTotalKm > 0 ? dFuelCost / dTotalKm : 0,
                totalKm: dTotalKm,
                unitUsage: unitUsageArray
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

        // Yearly service cost (Jan 1 - Dec 31 of current year)
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

        const [fuelTotalObj, serviceTotalObj, fleetKmAll, serviceTotalYearlyObj] = await Promise.all([
            prisma.vehicleFuelLog.aggregate({ _sum: { cost: true, liters: true }, where: { date: { gte: filterStart, lte: filterEnd } } }),
            prisma.vehicleService.aggregate({ _sum: { cost: true }, where: { date: { gte: filterStart, lte: filterEnd } } }),
            prisma.vehicleBooking.findMany({ where: { status: 'COMPLETED', tripEndTime: { gte: filterStart, lte: filterEnd } }, select: { startKm: true, endKm: true, fuelPrice: true, fuelLiters: true } }),
            prisma.vehicleService.aggregate({ _sum: { cost: true }, where: { date: { gte: yearStart, lte: yearEnd } } })
        ]);

        const totalKmAll = fleetKmAll.reduce((sum, b) => sum + ((b.endKm || 0) - (b.startKm || 0)), 0);
        const fuelTotal = (fuelTotalObj._sum.cost || 0) + fleetKmAll.reduce((sum, b) => sum + (b.fuelPrice || 0), 0);
        const fuelLiters = (fuelTotalObj._sum.liters || 0) + fleetKmAll.reduce((sum, b) => sum + (b.fuelLiters || 0), 0);
        const serviceTotal = serviceTotalObj._sum.cost || 0;
        const serviceTotalYearly = serviceTotalYearlyObj._sum.cost || 0;

        // 7. Fleet Availability Status
        const onTripCount = await prisma.vehicleBooking.count({
            where: { status: { in: ['APPROVED', 'BERLANGSUNG'] } }
        });
        const inServiceVehicleIds = await prisma.vehicleService.findMany({
            where: { date: { gte: new Date(now.getFullYear(), now.getMonth(), 1), lte: now } },
            select: { vehicleId: true },
            distinct: ['vehicleId']
        });
        // Vehicles currently on trip
        const onTripVehicleIds = await prisma.vehicleBooking.findMany({
            where: { status: { in: ['APPROVED', 'BERLANGSUNG'] } },
            select: { vehicleId: true },
            distinct: ['vehicleId']
        });
        const onTripSet = new Set(onTripVehicleIds.map(b => b.vehicleId));
        const availableCount = allVehicles.filter(v => !onTripSet.has(v.id)).length;

        // 8. Recent Bookings (last 8)
        const recentBookings = await prisma.vehicleBooking.findMany({
            orderBy: { createdAt: 'desc' },
            take: 8,
            select: {
                id: true, destination: true, purpose: true, status: true,
                startDate: true, endDate: true, createdAt: true,
                user: { select: { name: true, username: true } },
                vehicle: { select: { name: true, plateNumber: true } }
            }
        });

        res.json({
            isSummary,
            period: month && year ? `${month}/${year}` : 'SUMMARY',
            stats: {
                totalVehicles: allVehicles.length,
                activeBookings: activeBookingsCount,
                needingService: urgentActions.filter(a => a.type === 'SERVICE').length,
                taxWarnings: urgentActions.filter(a => ['TAX', 'STNK', 'KIR'].includes(a.type)).length,
                fleetCostPerKm: totalKmAll > 0 ? (fuelTotal + serviceTotal) / totalKmAll : 0,
                fleetKml: fuelLiters > 0 ? (totalKmAll / fuelLiters) : 0,
                totalFuelCost: fuelTotal,
                totalServiceCostYearly: serviceTotalYearly
            },
            availability: {
                available: availableCount,
                onTrip: onTripSet.size,
                total: allVehicles.length
            },
            urgentActions,
            availableMonths,
            vStats: vStats.sort((a, b) => b.totalKm - a.totalKm),
            bookingTrends,
            mileageTrends,
            allVehicleNames,
            recentBookings
        });
    } catch (error) {
        console.error('Vehicle Dashboard Error:', error);
        res.status(500).json({ error: error.message });
    }
};
