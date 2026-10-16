const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { deleteFile } = require('../services/minioService');
const aiService = require('../services/aiService');

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
            taxDueDate, stnkDueDate, kirDueDate, picIds, isRentable, defaultRentalPrice,
            rentalPrice6Hours, rentalPrice12Hours,
            requireDailyChecklist, requireWeeklyChecklist, requireMonthlyChecklist
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
                rentalPrice6Hours: rentalPrice6Hours ? parseFloat(rentalPrice6Hours) : null,
                rentalPrice12Hours: rentalPrice12Hours ? parseFloat(rentalPrice12Hours) : null,
                defaultRentalPrice: defaultRentalPrice ? parseFloat(defaultRentalPrice) : null,
                requireDailyChecklist: requireDailyChecklist === true || requireDailyChecklist === 'true',
                requireWeeklyChecklist: requireWeeklyChecklist === true || requireWeeklyChecklist === 'true',
                requireMonthlyChecklist: requireMonthlyChecklist === true || requireMonthlyChecklist === 'true',
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
            taxDueDate, stnkDueDate, kirDueDate, picIds, isRentable, defaultRentalPrice,
            rentalPrice6Hours, rentalPrice12Hours,
            requireDailyChecklist, requireWeeklyChecklist, requireMonthlyChecklist
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
                rentalPrice6Hours: rentalPrice6Hours ? parseFloat(rentalPrice6Hours) : null,
                rentalPrice12Hours: rentalPrice12Hours ? parseFloat(rentalPrice12Hours) : null,
                defaultRentalPrice: defaultRentalPrice ? parseFloat(defaultRentalPrice) : null,
                requireDailyChecklist: requireDailyChecklist === true || requireDailyChecklist === 'true',
                requireWeeklyChecklist: requireWeeklyChecklist === true || requireWeeklyChecklist === 'true',
                requireMonthlyChecklist: requireMonthlyChecklist === true || requireMonthlyChecklist === 'true',
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
                    { position: 'Kepala Bidang Sarana' },
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
        const { month, year, startDate, endDate } = req.query;
        const now = new Date();
        const thirtyDaysFromNow = new Date(new Date().setDate(now.getDate() + 30));

        // 1. Determine Date Filter Range
        let filterStart, filterEnd, isSummary = true;
        let periodStr = 'SUMMARY';

        if (startDate && endDate) {
            filterStart = new Date(startDate);
            filterStart.setHours(0, 0, 0, 0);
            filterEnd = new Date(endDate);
            filterEnd.setHours(23, 59, 59, 999);
            isSummary = false;
            periodStr = `${startDate} s/d ${endDate}`;
        } else if (month && year) {
            filterStart = new Date(parseInt(year), parseInt(month) - 1, 1);
            filterEnd = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
            isSummary = false;
            periodStr = `${month}/${year}`;
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
        const fuelTrends = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
            const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

            const bCount = await prisma.vehicleBooking.count({
                where: { createdAt: { gte: mStart, lte: mEnd } }
            });

            const completedForMonth = await prisma.vehicleBooking.findMany({
                where: { 
                    status: 'COMPLETED', 
                    OR: [
                        { tripEndTime: { gte: mStart, lte: mEnd } },
                        { tripEndTime: null, startDate: { gte: mStart, lte: mEnd } }
                    ],
                    startKm: { not: null }, 
                    endKm: { not: null } 
                },
                select: { startKm: true, endKm: true, fuelPrice: true, fuelLiters: true, vehicle: { select: { name: true } } }
            });

            const fuelLogForMonth = await prisma.vehicleFuelLog.aggregate({
                _sum: { cost: true, liters: true },
                where: { date: { gte: mStart, lte: mEnd } }
            });

            const monthName = d.toLocaleString('id-ID', { month: 'short', year: 'numeric' });
            const mileageObj = { name: monthName };
            allVehicleNames.forEach(name => mileageObj[name] = 0);
            completedForMonth.forEach(b => { 
                if (b.vehicle?.name) mileageObj[b.vehicle.name] += Math.max(0, (b.endKm || 0) - (b.startKm || 0)); 
            });

            const mFuelCost = (fuelLogForMonth._sum.cost || 0) + completedForMonth.reduce((acc, b) => acc + (b.fuelPrice || 0), 0);
            const mFuelLiters = (fuelLogForMonth._sum.liters || 0) + completedForMonth.reduce((acc, b) => {
                const liters = (b.fuelLiters && b.fuelLiters > 0) ? b.fuelLiters : (b.fuelPrice && b.fuelPrice > 0 ? b.fuelPrice / 10000 : 0);
                return acc + liters;
            }, 0);

            bookingTrends.push({ name: monthName, value: bCount });
            mileageTrends.push(mileageObj);
            fuelTrends.push({ name: monthName, cost: mFuelCost, liters: mFuelLiters });
        }

        // 5. Filtered Vehicle Matrix (vStats)
        const vStats = await Promise.all(allVehicles.map(async v => {
            const bookingWhere = {
                vehicleId: v.id,
                status: 'COMPLETED'
            };
            if (!isSummary) {
                bookingWhere.OR = [
                    { tripEndTime: { gte: filterStart, lte: filterEnd } },
                    { tripEndTime: null, startDate: { gte: filterStart, lte: filterEnd } }
                ];
            }

            const fuelWhere = { vehicleId: v.id };
            const serviceWhere = { vehicleId: v.id };
            if (!isSummary) {
                fuelWhere.date = { gte: filterStart, lte: filterEnd };
                serviceWhere.date = { gte: filterStart, lte: filterEnd };
            }

            const [completedBookings, fuelLogs, serviceLogs] = await Promise.all([
                prisma.vehicleBooking.findMany({
                    where: bookingWhere,
                    select: { 
                        startKm: true, endKm: true, fuelLiters: true, fuelPrice: true, tripStartTime: true, tripEndTime: true,
                        user: { select: { unit: { select: { name: true } } } }
                    }
                }),
                prisma.vehicleFuelLog.findMany({
                    where: fuelWhere,
                    select: { liters: true, cost: true }
                }),
                prisma.vehicleService.findMany({
                    where: serviceWhere,
                    select: { cost: true }
                })
            ]);

            const dTotalKm = completedBookings.reduce((sum, b) => sum + Math.max(0, (b.endKm || 0) - (b.startKm || 0)), 0);
            const dLiters = completedBookings.reduce((sum, b) => {
                const liters = (b.fuelLiters && b.fuelLiters > 0) 
                    ? b.fuelLiters 
                    : (b.fuelPrice && b.fuelPrice > 0 ? b.fuelPrice / 10000 : 0);
                return sum + liters;
            }, 0) + fuelLogs.reduce((sum, l) => {
                const liters = (l.liters && l.liters > 0) 
                    ? l.liters 
                    : (l.cost && l.cost > 0 ? l.cost / 10000 : 0);
                return sum + liters;
            }, 0);
            const dFuelCost = completedBookings.reduce((sum, b) => sum + (b.fuelPrice || 0), 0) + fuelLogs.reduce((sum, l) => sum + (l.cost || 0), 0);
            const dServiceCost = serviceLogs.reduce((sum, l) => sum + (l.cost || 0), 0);

            const activeDays = new Set();
            
            // Calculate Usage per Unit
            const unitUsageMap = {};

            completedBookings.forEach(b => {
                if (b.tripStartTime) {
                    const start = new Date(b.tripStartTime);
                    const end = b.tripEndTime ? new Date(b.tripEndTime) : new Date();
                    const rangeStart = isSummary ? thirtyDaysPast : filterStart;
                    const rangeEnd = filterEnd;

                    const effectiveStart = start < rangeStart ? rangeStart : start;
                    const effectiveEnd = end > rangeEnd ? rangeEnd : end;

                    if (effectiveStart <= effectiveEnd) {
                        for (let d = new Date(effectiveStart); d <= effectiveEnd; d.setDate(d.getDate() + 1)) {
                            activeDays.add(new Date(d).toDateString());
                        }
                    }
                }

                const unitName = b.user?.unit?.name || 'Tanpa Unit';
                if (!unitUsageMap[unitName]) {
                    unitUsageMap[unitName] = { distance: 0, fuelCost: 0 };
                }
                unitUsageMap[unitName].distance += Math.max(0, (b.endKm || 0) - (b.startKm || 0));
                unitUsageMap[unitName].fuelCost += (b.fuelPrice || 0);
            });
            
            const daysInPeriod = isSummary ? 30 : Math.max(1, Math.round((filterEnd - filterStart) / (1000 * 60 * 60 * 24)));
            const utilization = Math.min(100, (activeDays.size / daysInPeriod) * 100);

            const unitUsageArray = Object.keys(unitUsageMap).map(unit => ({
                unit,
                distance: unitUsageMap[unit].distance,
                fuelCost: unitUsageMap[unit].fuelCost
            })).sort((a, b) => b.distance - a.distance);

            const calculatedKml = dLiters > 0 && dTotalKm > 0 ? parseFloat((dTotalKm / dLiters).toFixed(2)) : null;

            return {
                id: v.id, name: v.name, plate: v.plateNumber,
                type: v.type || 'KENDARAAN',
                status: v.status || 'ACTIVE',
                kml: calculatedKml,
                liters: parseFloat(dLiters.toFixed(1)),
                utilization: Math.min(utilization, 100),
                cpkm: dTotalKm > 0 ? (dFuelCost + dServiceCost) / dTotalKm : 0,
                fuelCpkm: dTotalKm > 0 ? dFuelCost / dTotalKm : 0,
                fuelCost: dFuelCost,
                serviceCost: dServiceCost,
                totalKm: dTotalKm,
                tripCount: completedBookings.length,
                unitUsage: unitUsageArray
            };
        }));

        // 6. Overall Stats & availableMonths
        const availableMonthsData = await prisma.vehicleBooking.findMany({
            where: { status: 'COMPLETED' },
            select: { tripEndTime: true, startDate: true }
        });
        const availableMonths = [...new Set(availableMonthsData.map(b => {
            const date = new Date(b.tripEndTime || b.startDate);
            if (!date || isNaN(date.getTime())) return null;
            return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        }).filter(Boolean))].sort().reverse();

        // Yearly service cost (Jan 1 - Dec 31 of current year)
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

        const [fuelTotalObj, serviceTotalObj, fleetKmAll, serviceTotalYearlyObj] = await Promise.all([
            prisma.vehicleFuelLog.aggregate({ 
                _sum: { cost: true, liters: true }, 
                where: isSummary ? {} : { date: { gte: filterStart, lte: filterEnd } } 
            }),
            prisma.vehicleService.aggregate({ 
                _sum: { cost: true }, 
                where: isSummary ? {} : { date: { gte: filterStart, lte: filterEnd } } 
            }),
            prisma.vehicleBooking.findMany({ 
                where: { 
                    status: 'COMPLETED',
                    ...(isSummary ? {} : {
                        OR: [
                            { tripEndTime: { gte: filterStart, lte: filterEnd } },
                            { tripEndTime: null, startDate: { gte: filterStart, lte: filterEnd } }
                        ]
                    })
                }, 
                select: { startKm: true, endKm: true, fuelPrice: true, fuelLiters: true } 
            }),
            prisma.vehicleService.aggregate({ _sum: { cost: true }, where: { date: { gte: yearStart, lte: yearEnd } } })
        ]);

        const totalKmAll = fleetKmAll.reduce((sum, b) => sum + Math.max(0, (b.endKm || 0) - (b.startKm || 0)), 0);
        const fuelTotal = (fuelTotalObj._sum.cost || 0) + fleetKmAll.reduce((sum, b) => sum + (b.fuelPrice || 0), 0);
        const fuelLiters = (fuelTotalObj._sum.liters || 0) + fleetKmAll.reduce((sum, b) => {
            const liters = (b.fuelLiters && b.fuelLiters > 0) ? b.fuelLiters : (b.fuelPrice && b.fuelPrice > 0 ? b.fuelPrice / 10000 : 0);
            return sum + liters;
        }, 0);
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

        // 8. Recent Bookings (Filtered to date range if not summary)
        const recentBookingsWhere = {};
        if (!isSummary) {
            recentBookingsWhere.OR = [
                { startDate: { gte: filterStart, lte: filterEnd } },
                { tripEndTime: { gte: filterStart, lte: filterEnd } },
                { createdAt: { gte: filterStart, lte: filterEnd } }
            ];
        }
        const recentBookings = await prisma.vehicleBooking.findMany({
            where: recentBookingsWhere,
            orderBy: { startDate: 'desc' },
            take: isSummary ? 8 : 100,
            select: {
                id: true, destination: true, purpose: true, status: true,
                startDate: true, endDate: true, createdAt: true,
                startKm: true, endKm: true,
                user: { select: { name: true, username: true } },
                vehicle: { select: { name: true, plateNumber: true } }
            }
        });

        // 9. Upcoming & Recent Bus Bookings (Jadwal Reservasi Bus)
        const busBookingsWhere = {
            status: { not: 'CANCELLED' }
        };
        if (!isSummary) {
            busBookingsWhere.startDate = { gte: filterStart, lte: filterEnd };
        }
        const upcomingBusBookings = await prisma.busBooking.findMany({
            where: busBookingsWhere,
            include: {
                vehicle: { select: { id: true, name: true, plateNumber: true } },
                user: { select: { id: true, name: true, unit: { select: { name: true } } } },
                driver: { select: { id: true, name: true, phone: true } }
            },
            orderBy: { startDate: 'desc' },
            take: isSummary ? 8 : 100
        });

        const activeBusBookingsCount = await prisma.busBooking.count({
            where: {
                endDate: { gte: now },
                status: { not: 'CANCELLED' }
            }
        });

        // 10. Pengguna yang Kena Sanksi Perjalanan (isSanctioned: true)
        const sanctionedUsers = await prisma.user.findMany({
            where: { isSanctioned: true },
            select: {
                id: true, name: true, phone: true, position: true,
                sanctionProposedLift: true, sanctionLiftReason: true,
                unit: { select: { name: true } }
            }
        });

        // 11. Ceklis Kendaraan Terkini
        const recentChecklists = await prisma.vehicleChecklist.findMany({
            take: 6,
            orderBy: { date: 'desc' },
            include: {
                vehicle: { select: { id: true, name: true, plateNumber: true } },
                driver: { select: { id: true, name: true } }
            }
        });

        // =========================================================================
        // 12. LAPORAN 1 & 2: PERJALANAN & BBM MASING-MASING KENDARAAN (AKTIF SAJA)
        // =========================================================================
        const activeVehicles = vStats.filter(v => (v.status || 'ACTIVE') === 'ACTIVE');
        const activeVehicleTripStats = activeVehicles.map(v => ({
            id: v.id,
            name: v.name,
            plate: v.plate,
            type: v.type || 'KENDARAAN',
            tripCount: v.tripCount || 0,
            totalKm: v.totalKm || 0,
            utilization: v.utilization || 0
        })).sort((a, b) => b.tripCount - a.tripCount || b.totalKm - a.totalKm);

        const activeVehicleFuelStats = activeVehicles.map(v => ({
            id: v.id,
            name: v.name,
            plate: v.plate,
            type: v.type || 'KENDARAAN',
            liters: v.liters || 0,
            fuelCost: v.fuelCost || 0,
            totalKm: v.totalKm || 0
        })).sort((a, b) => b.fuelCost - a.fuelCost);

        // =========================================================================
        // 13. LAPORAN 3: JUMLAH & STATISTIK BOOKINGAN BUS
        // =========================================================================
        const allBusFilterWhere = {};
        if (!isSummary) {
            allBusFilterWhere.startDate = { gte: filterStart, lte: filterEnd };
        }
        const allPeriodBusBookings = await prisma.busBooking.findMany({
            where: allBusFilterWhere,
            include: {
                vehicle: { select: { id: true, name: true, plateNumber: true } },
                user: { select: { id: true, name: true, unit: { select: { name: true } } } },
                driver: { select: { id: true, name: true, phone: true } }
            },
            orderBy: { startDate: 'desc' }
        });

        const busStatusCounts = {
            TOTAL: allPeriodBusBookings.length,
            COMPLETED: allPeriodBusBookings.filter(b => b.status === 'COMPLETED').length,
            APPROVED: allPeriodBusBookings.filter(b => b.status === 'APPROVED').length,
            CANCELLED: allPeriodBusBookings.filter(b => b.status === 'CANCELLED').length,
            OTHER: allPeriodBusBookings.filter(b => !['COMPLETED', 'APPROVED', 'CANCELLED'].includes(b.status)).length
        };
        const totalBusPassengers = allPeriodBusBookings.reduce((sum, b) => sum + (b.passengerCount || 0), 0);

        const busBookingsByVehicleMap = {};
        allPeriodBusBookings.forEach(b => {
            const vName = b.vehicle?.name || 'Bus Operasional';
            if (!busBookingsByVehicleMap[vName]) {
                busBookingsByVehicleMap[vName] = {
                    name: vName,
                    plate: b.vehicle?.plateNumber || '-',
                    count: 0,
                    totalKm: 0,
                    totalBill: 0
                };
            }
            busBookingsByVehicleMap[vName].count += 1;
            busBookingsByVehicleMap[vName].totalKm += (b.totalKm || 0);
            busBookingsByVehicleMap[vName].totalBill += (b.totalBill || 0);
        });
        const busBookingsByVehicle = Object.values(busBookingsByVehicleMap).sort((a, b) => b.count - a.count);

        // =========================================================================
        // 14. LAPORAN 4: PEMELIHARAAN YANG TERLAKSANA
        // =========================================================================
        const completedServiceWhere = {
            status: 'COMPLETED'
        };
        if (!isSummary) {
            completedServiceWhere.date = { gte: filterStart, lte: filterEnd };
        }
        const completedServices = await prisma.vehicleService.findMany({
            where: completedServiceWhere,
            include: {
                vehicle: { select: { id: true, name: true, plateNumber: true, type: true } }
            },
            orderBy: { date: 'desc' }
        });

        const totalCompletedServicesCount = completedServices.length;
        const totalCompletedServicesCost = completedServices.reduce((sum, s) => sum + (s.cost || 0), 0);

        const serviceByTypeMap = {};
        completedServices.forEach(s => {
            const type = s.type || s.category || 'LAINNYA';
            if (!serviceByTypeMap[type]) {
                serviceByTypeMap[type] = { type, count: 0, totalCost: 0 };
            }
            serviceByTypeMap[type].count += 1;
            serviceByTypeMap[type].totalCost += (s.cost || 0);
        });
        const completedServicesByType = Object.values(serviceByTypeMap).sort((a, b) => b.count - a.count);

        const serviceByVehicleMap = {};
        completedServices.forEach(s => {
            const vName = s.vehicle?.name || 'Armada';
            if (!serviceByVehicleMap[vName]) {
                serviceByVehicleMap[vName] = {
                    name: vName,
                    plate: s.vehicle?.plateNumber || '-',
                    count: 0,
                    totalCost: 0
                };
            }
            serviceByVehicleMap[vName].count += 1;
            serviceByVehicleMap[vName].totalCost += (s.cost || 0);
        });
        const completedServicesByVehicle = Object.values(serviceByVehicleMap).sort((a, b) => b.totalCost - a.totalCost);

        // =========================================================================
        // 15. LAPORAN 5: SISA OMSET BUS (PEMASUKAN VS PENGELUARAN)
        // =========================================================================
        const busVehicles = allVehicles.filter(v =>
            (v.type && v.type.toLowerCase().includes('bus')) ||
            (v.name && v.name.toLowerCase().includes('bus'))
        );
        const busVehicleIds = busVehicles.map(v => v.id);

        const busBookingRevenue = allPeriodBusBookings
            .filter(b => b.status !== 'CANCELLED')
            .reduce((sum, b) => sum + (b.totalBill || 0), 0);

        const otherIncomeWhere = {};
        if (!isSummary) {
            otherIncomeWhere.date = { gte: filterStart, lte: filterEnd };
        }
        const busOtherIncomes = await prisma.busOtherIncome.findMany({
            where: otherIncomeWhere,
            select: { id: true, amount: true, description: true, date: true }
        });
        const totalBusOtherIncome = busOtherIncomes.reduce((sum, i) => sum + (i.amount || 0), 0);
        const totalBusRevenue = busBookingRevenue + totalBusOtherIncome;

        const busFuelCost = vStats
            .filter(v => busVehicleIds.includes(v.id))
            .reduce((sum, v) => sum + (v.fuelCost || 0), 0);

        const busServiceCost = vStats
            .filter(v => busVehicleIds.includes(v.id))
            .reduce((sum, v) => sum + (v.serviceCost || 0), 0);

        const unexpectedExpenseWhere = {};
        if (!isSummary) {
            unexpectedExpenseWhere.date = { gte: filterStart, lte: filterEnd };
        }
        const busUnexpectedExpenses = await prisma.busUnexpectedExpense.findMany({
            where: unexpectedExpenseWhere,
            select: { id: true, amount: true, description: true, date: true }
        });
        const totalBusUnexpected = busUnexpectedExpenses.reduce((sum, u) => sum + (u.amount || 0), 0);

        const totalBusExpenses = busFuelCost + busServiceCost + totalBusUnexpected;
        const sisaOmsetBus = totalBusRevenue - totalBusExpenses;
        const busMarginPercent = totalBusRevenue > 0 ? parseFloat(((sisaOmsetBus / totalBusRevenue) * 100).toFixed(1)) : 0;

        const busOmsetStats = {
            totalRevenue: totalBusRevenue,
            bookingRevenue: busBookingRevenue,
            otherIncome: totalBusOtherIncome,
            totalExpenses: totalBusExpenses,
            fuelExpenses: busFuelCost,
            maintenanceExpenses: busServiceCost,
            unexpectedExpenses: totalBusUnexpected,
            sisaOmset: sisaOmsetBus,
            marginPercent: busMarginPercent,
            busUnitsCount: busVehicles.length
        };

        // =========================================================================
        // 16. LAPORAN 6: TOP DRIVER (LEADERBOARD SUPIR)
        // =========================================================================
        const officialDrivers = await prisma.user.findMany({
            where: {
                OR: [
                    { position: { contains: 'Sopir' } },
                    { position: { contains: 'Driver' } }
                ]
            },
            select: { id: true, name: true, phone: true, position: true, unit: { select: { name: true } } }
        });

        const vBookingDriverWhere = { driverId: { not: null }, status: 'COMPLETED' };
        const busBookingDriverWhere = { driverId: { not: null } };
        if (!isSummary) {
            vBookingDriverWhere.OR = [
                { tripEndTime: { gte: filterStart, lte: filterEnd } },
                { tripEndTime: null, startDate: { gte: filterStart, lte: filterEnd } }
            ];
            busBookingDriverWhere.startDate = { gte: filterStart, lte: filterEnd };
        }

        const [driverVehicleBookings, driverBusBookings] = await Promise.all([
            prisma.vehicleBooking.findMany({
                where: vBookingDriverWhere,
                select: {
                    driverId: true, startKm: true, endKm: true,
                    driver: { select: { id: true, name: true, phone: true, position: true, unit: { select: { name: true } } } }
                }
            }),
            prisma.busBooking.findMany({
                where: busBookingDriverWhere,
                select: {
                    driverId: true, totalKm: true, status: true,
                    driver: { select: { id: true, name: true, phone: true, position: true, unit: { select: { name: true } } } }
                }
            })
        ]);

        const driverStatsMap = {};
        officialDrivers.forEach(d => {
            driverStatsMap[d.id] = {
                id: d.id,
                name: d.name,
                phone: d.phone || '-',
                position: d.position || 'Driver',
                unit: d.unit?.name || 'Sarpras',
                vehicleTrips: 0,
                vehicleKm: 0,
                busTrips: 0,
                busKm: 0,
                totalTrips: 0,
                totalKm: 0,
                violationCount: 0
            };
        });

        driverVehicleBookings.forEach(b => {
            if (!b.driverId) return;
            if (!driverStatsMap[b.driverId]) {
                driverStatsMap[b.driverId] = {
                    id: b.driverId,
                    name: b.driver?.name || `Driver #${b.driverId}`,
                    phone: b.driver?.phone || '-',
                    position: b.driver?.position || 'Driver',
                    unit: b.driver?.unit?.name || 'Sarpras',
                    vehicleTrips: 0,
                    vehicleKm: 0,
                    busTrips: 0,
                    busKm: 0,
                    totalTrips: 0,
                    totalKm: 0,
                    violationCount: 0
                };
            }
            const km = Math.max(0, (b.endKm || 0) - (b.startKm || 0));
            driverStatsMap[b.driverId].vehicleTrips += 1;
            driverStatsMap[b.driverId].vehicleKm += km;
            driverStatsMap[b.driverId].totalTrips += 1;
            driverStatsMap[b.driverId].totalKm += km;
        });

        driverBusBookings.forEach(b => {
            if (!b.driverId) return;
            if (!driverStatsMap[b.driverId]) {
                driverStatsMap[b.driverId] = {
                    id: b.driverId,
                    name: b.driver?.name || `Driver #${b.driverId}`,
                    phone: b.driver?.phone || '-',
                    position: b.driver?.position || 'Driver',
                    unit: b.driver?.unit?.name || 'Sarpras',
                    vehicleTrips: 0,
                    vehicleKm: 0,
                    busTrips: 0,
                    busKm: 0,
                    totalTrips: 0,
                    totalKm: 0,
                    violationCount: 0
                };
            }
            driverStatsMap[b.driverId].busTrips += 1;
            driverStatsMap[b.driverId].busKm += (b.totalKm || 0);
            driverStatsMap[b.driverId].totalTrips += 1;
            driverStatsMap[b.driverId].totalKm += (b.totalKm || 0);
        });

        const driverIds = Object.keys(driverStatsMap).map(id => parseInt(id));
        const driverViolations = await prisma.driverViolation.findMany({
            where: {
                driverId: { in: driverIds },
                ...(isSummary ? {} : { date: { gte: filterStart, lte: filterEnd } })
            },
            select: { driverId: true }
        });
        driverViolations.forEach(v => {
            if (driverStatsMap[v.driverId]) {
                driverStatsMap[v.driverId].violationCount += 1;
            }
        });

        const topDrivers = Object.values(driverStatsMap)
            .sort((a, b) => b.totalTrips - a.totalTrips || b.totalKm - a.totalKm)
            .map((d, index) => ({
                ...d,
                rank: index + 1
            }));

        // =========================================================================
        // 17. LAPORAN 7: USER YANG MELANGGAR RENTANG TANGGAL
        // =========================================================================
        const formatDuration = (minutes) => {
            if (minutes < 60) return `${minutes} Menit`;
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            if (hours < 24) return `${hours} Jam ${mins > 0 ? mins + ' Menit' : ''}`.trim();
            const days = Math.floor(hours / 24);
            const remHours = hours % 24;
            return `${days} Hari ${remHours > 0 ? remHours + ' Jam' : ''}`.trim();
        };

        const lateBookingWhere = {
            status: 'COMPLETED',
            tripEndTime: { not: null }
        };
        if (!isSummary) {
            lateBookingWhere.OR = [
                { tripEndTime: { gte: filterStart, lte: filterEnd } },
                { startDate: { gte: filterStart, lte: filterEnd } }
            ];
        }
        const completedBookingsForViolations = await prisma.vehicleBooking.findMany({
            where: lateBookingWhere,
            include: {
                user: { select: { id: true, name: true, phone: true, position: true, isSanctioned: true, unit: { select: { name: true } } } },
                vehicle: { select: { id: true, name: true, plateNumber: true } }
            },
            orderBy: { tripEndTime: 'desc' },
            take: 100
        });

        const lateReturns = [];
        completedBookingsForViolations.forEach(b => {
            if (!b.endDate || !b.tripEndTime) return;
            const diffMs = new Date(b.tripEndTime).getTime() - new Date(b.endDate).getTime();
            const lateMins = Math.round(diffMs / 60000);
            if (lateMins >= 15) { // 15 menit batas toleransi wajar
                lateReturns.push({
                    id: b.id,
                    type: 'TERLAMBAT_KEMBALI',
                    statusLabel: 'Selesai Terlambat',
                    userName: b.user?.name || 'Tidak Diketahui',
                    userPhone: b.user?.phone || '-',
                    userUnit: b.user?.unit?.name || 'Umum',
                    userPosition: b.user?.position || 'Staff',
                    isUserSanctioned: !!b.user?.isSanctioned,
                    vehicleName: b.vehicle?.name || '-',
                    vehiclePlate: b.vehicle?.plateNumber || '-',
                    destination: b.destination,
                    purpose: b.purpose || '-',
                    startDate: b.startDate,
                    endDate: b.endDate,
                    actualEndTime: b.tripEndTime,
                    lateMinutes: lateMins,
                    lateDuration: formatDuration(lateMins),
                    warningCount: b.endWarningCount || 0,
                    notes: b.tripNotes || null
                });
            }
        });

        const overdueActiveBookings = await prisma.vehicleBooking.findMany({
            where: {
                status: { in: ['APPROVED', 'BERLANGSUNG'] },
                endDate: { lt: now }
            },
            include: {
                user: { select: { id: true, name: true, phone: true, position: true, isSanctioned: true, unit: { select: { name: true } } } },
                vehicle: { select: { id: true, name: true, plateNumber: true } }
            },
            orderBy: { endDate: 'asc' }
        });

        const overdueActive = overdueActiveBookings.map(b => {
            const diffMs = now.getTime() - new Date(b.endDate).getTime();
            const lateMins = Math.round(diffMs / 60000);
            return {
                id: b.id,
                type: 'SEDANG_OVERDUE',
                statusLabel: 'Belum Kembali (Overdue)',
                userName: b.user?.name || 'Tidak Diketahui',
                userPhone: b.user?.phone || '-',
                userUnit: b.user?.unit?.name || 'Umum',
                userPosition: b.user?.position || 'Staff',
                isUserSanctioned: !!b.user?.isSanctioned,
                vehicleName: b.vehicle?.name || '-',
                vehiclePlate: b.vehicle?.plateNumber || '-',
                destination: b.destination,
                purpose: b.purpose || '-',
                startDate: b.startDate,
                endDate: b.endDate,
                actualEndTime: null,
                lateMinutes: lateMins,
                lateDuration: `Lewat ${formatDuration(lateMins)}`,
                warningCount: b.endWarningCount || 0,
                notes: 'Sedang berjalan melewati batas jadwal pengembalian'
            };
        });

        const allDateViolations = [...overdueActive, ...lateReturns].sort((a, b) => b.lateMinutes - a.lateMinutes);

        const dateViolationsStats = {
            totalViolations: allDateViolations.length,
            overdueActiveCount: overdueActive.length,
            lateReturnCount: lateReturns.length,
            sanctionedCount: sanctionedUsers.length,
            violations: allDateViolations,
            sanctionedUsers
        };

        res.json({
            isSummary,
            period: periodStr,
            startDate: startDate || null,
            endDate: endDate || null,
            stats: {
                totalVehicles: allVehicles.length,
                activeVehiclesCount: activeVehicles.length,
                activeVehiclesTotalTrips: activeVehicleTripStats.reduce((s, v) => s + v.tripCount, 0),
                activeVehiclesFuelCost: activeVehicleFuelStats.reduce((s, v) => s + v.fuelCost, 0),
                activeVehiclesFuelLiters: activeVehicleFuelStats.reduce((s, v) => s + v.liters, 0),
                activeBookings: activeBookingsCount,
                activeBusBookings: activeBusBookingsCount,
                totalBusBookingsCount: allPeriodBusBookings.length,
                completedMaintenanceCount: totalCompletedServicesCount,
                completedMaintenanceCost: totalCompletedServicesCost,
                sisaOmsetBus: sisaOmsetBus,
                totalBusRevenue: totalBusRevenue,
                totalBusExpenses: totalBusExpenses,
                busMarginPercent: busMarginPercent,
                totalDateViolationsCount: allDateViolations.length,
                sanctionedUsersCount: sanctionedUsers.length,
                needingService: urgentActions.filter(a => a.type === 'SERVICE').length,
                taxWarnings: urgentActions.filter(a => ['TAX', 'STNK', 'KIR'].includes(a.type)).length,
                fleetCostPerKm: totalKmAll > 0 ? (fuelTotal + serviceTotal) / totalKmAll : 0,
                fleetKml: fuelLiters > 0 && totalKmAll > 0 ? parseFloat((totalKmAll / fuelLiters).toFixed(2)) : null,
                totalFuelCost: fuelTotal,
                totalFuelLiters: fuelLiters,
                periodTotalKm: totalKmAll,
                periodServiceCost: serviceTotal,
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
            // Dedicated 7 Reports Datasets:
            activeVehicleTripStats,
            activeVehicleFuelStats,
            busBookingStats: {
                total: allPeriodBusBookings.length,
                statusCounts: busStatusCounts,
                totalPassengers: totalBusPassengers,
                byVehicle: busBookingsByVehicle,
                bookings: allPeriodBusBookings
            },
            completedMaintenanceStats: {
                totalCount: totalCompletedServicesCount,
                totalCost: totalCompletedServicesCost,
                byType: completedServicesByType,
                byVehicle: completedServicesByVehicle,
                services: completedServices
            },
            busOmsetStats,
            topDrivers,
            dateViolationsStats,
            bookingTrends,
            mileageTrends,
            fuelTrends,
            allVehicleNames,
            recentBookings,
            upcomingBusBookings,
            sanctionedUsers,
            recentChecklists
        });
    } catch (error) {
        console.error('Vehicle Dashboard Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// --- SANCTION LIFTING (DELEGATED TO PERSONNEL CONTROLLER) ---
const personnelController = require('./personnelController');
exports.proposeSanctionLift = personnelController.proposeSanctionLift;
exports.reviewSanctionLift = personnelController.reviewSanctionLift;

// --- AI FLEET ANALYSIS FOR BIDANG SARANA ---
exports.analyzeFleetWithAI = async (req, res) => {
    try {
        const {
            period, stats, vStats, urgentActions, busSummary,
            activeVehicleTripStats, activeVehicleFuelStats,
            busBookingStats, completedMaintenanceStats,
            busOmsetStats, topDrivers, dateViolationsStats
        } = req.body;

        const activeTripsSummary = (activeVehicleTripStats || []).slice(0, 10).map(v => 
            `- ${v.name} (${v.plate}): ${v.tripCount} perjalanan (${Math.round(v.totalKm || 0).toLocaleString('id-ID')} KM, utilisasi ${v.utilization?.toFixed(0)}%)`
        ).join('\n') || 'Tidak ada perjalanan armada aktif.';

        const activeFuelSummary = (activeVehicleFuelStats || []).slice(0, 10).map(v => 
            `- ${v.name} (${v.plate} - ${v.type || 'Kendaraan'}): ${v.liters ? v.liters.toFixed(1) + ' L' : '0 L'} | Total Pengeluaran BBM: Rp ${Math.round(v.fuelCost || 0).toLocaleString('id-ID')}`
        ).join('\n') || 'Tidak ada data BBM armada aktif.';

        const maintenanceSummary = completedMaintenanceStats 
            ? `Total Pemeliharaan Terlaksana: ${completedMaintenanceStats.totalCount || 0} kegiatan (Total Biaya: Rp ${Math.round(completedMaintenanceStats.totalCost || 0).toLocaleString('id-ID')})\nRincian Kategori: ${(completedMaintenanceStats.byType || []).map(t => `${t.type} (${t.count}x - Rp ${Math.round(t.totalCost).toLocaleString('id-ID')})`).join(', ') || '-'}`
            : 'Belum ada catatan servis.';

        const busOmsetSummary = busOmsetStats 
            ? `Total Pemasukan Bus: Rp ${Math.round(busOmsetStats.totalRevenue || 0).toLocaleString('id-ID')} (Booking Sewa: Rp ${Math.round(busOmsetStats.bookingRevenue || 0).toLocaleString('id-ID')}, Lainnya: Rp ${Math.round(busOmsetStats.otherIncome || 0).toLocaleString('id-ID')})\n` +
              `Total Pengeluaran Bus: Rp ${Math.round(busOmsetStats.totalExpenses || 0).toLocaleString('id-ID')} (BBM: Rp ${Math.round(busOmsetStats.fuelExpenses || 0).toLocaleString('id-ID')}, Servis: Rp ${Math.round(busOmsetStats.maintenanceExpenses || 0).toLocaleString('id-ID')}, Tak Terduga: Rp ${Math.round(busOmsetStats.unexpectedExpenses || 0).toLocaleString('id-ID')})\n` +
              `SISA OMSET BERSIH BUS: Rp ${Math.round(busOmsetStats.sisaOmset || 0).toLocaleString('id-ID')} (Margin: ${busOmsetStats.marginPercent || 0}%)`
            : 'Belum ada data keuangan bus.';

        const topDriversSummary = (topDrivers || []).slice(0, 5).map(d => 
            `#${d.rank} ${d.name} (${d.unit || 'Driver'}): Total ${d.totalTrips} Perjalanan (${Math.round(d.totalKm || 0).toLocaleString('id-ID')} KM) [Mobil: ${d.vehicleTrips}x, Bus: ${d.busTrips}x] - Pelanggaran: ${d.violationCount}`
        ).join('\n') || 'Belum ada data driver.';

        const violationsSummary = dateViolationsStats 
            ? `Total Pelanggaran Rentang Tanggal: ${dateViolationsStats.totalViolations || 0} kasus (Terlambat Selesai: ${dateViolationsStats.lateReturnCount || 0}, Sedang Overdue: ${dateViolationsStats.overdueActiveCount || 0}, Akun Disanksi: ${dateViolationsStats.sanctionedCount || 0})\n` +
              `Contoh Kasus:\n` +
              (dateViolationsStats.violations || []).slice(0, 5).map(v => 
                  `- ${v.userName} (${v.userUnit}): ${v.vehicleName} (${v.vehiclePlate}) -> ${v.statusLabel} (${v.lateDuration}) | Tujuan: ${v.destination}`
              ).join('\n')
            : 'Tidak ada pelanggaran jadwal.';

        const prompt = `
Anda adalah Konsultan Senior Fleet Management & Audit Operasional Kendaraan untuk Bidang Sarana & Prasarana Yayasan Dar El-Iman.
Berikut adalah 7 Laporan Utama Kinerja Operasional Armada Kendaraan untuk periode: ${period || 'Semua Periode'}.

1. 🚗 JUMLAH PERJALANAN MASING-MASING KENDARAAN (AKTIF SAJA):
${activeTripsSummary}

2. ⛽ KONSUMSI BBM MASING-MASING KENDARAAN (AKTIF SAJA):
${activeFuelSummary}

3. 🚌 JUMLAH BOOKINGAN BUS:
Total Booking Bus: ${busBookingStats?.total || 0} agenda (Selesai: ${busBookingStats?.statusCounts?.COMPLETED || 0}, Disetujui/Berjalan: ${busBookingStats?.statusCounts?.APPROVED || 0}, Dibatalkan: ${busBookingStats?.statusCounts?.CANCELLED || 0})
Total Penumpang: ${busBookingStats?.totalPassengers || 0} orang

4. 🛠️ PEMELIHARAAN YANG TERLAKSANA:
${maintenanceSummary}

5. 💰 KEUANGAN & SISA OMSET BUS:
${busOmsetSummary}

6. 🏆 TOP DRIVER (LEADERBOARD SUPIR):
${topDriversSummary}

7. ⚠️ USER YANG MELANGGAR RENTANG TANGGAL PEMINJAMAN:
${violationsSummary}

INSTRUKSI:
Sajikan Analisis AI Komprehensif, Tajam, Berbasis Data, dan Bernada Eksekutif untuk Kepala Bidang Sarana dalam format Markdown yang rapi dengan subjudul berikut:
1. 📊 **Evaluasi Mobilitas & Efisiensi Armada Aktif**: Tinjauan perjalanan dan efisiensi belanja BBM unit aktif.
2. 🚌 **Kinerja Operasional & Profitabilitas Bus**: Analisis volume bookingan bus dan kesehatan sisa omset bersih.
3. 🛠️ **Audit Pemeliharaan & Kelaikan Teknis**: Penilaian realisasi servis kendaraan yang terlaksana dan efisiensi biaya bengkel.
4. 🏆 **Apresiasi & Penilaian Top Driver**: Evaluasi produktivitas supir terbaik dan beban kerjanya.
5. ⚖️ **Audit Disiplin & Pelanggaran Rentang Tanggal**: Evaluasi keterlambatan peminjaman, akar masalah, dan rekomendasi sanksi / SOP perpanjangan.
6. 🎯 **Rekomendasi Strategis 30 Hari ke Depan**: 3-4 langkah aksi konkret untuk optimalisasi anggaran dan kepatuhan.

Gunakan bahasa Indonesia yang profesional, formal, lugas, dan solutif.`;

        const result = await aiService.generateContentWithFallback(prompt);
        const analysis = result?.response?.text() || 'Analisis AI tidak dapat dihasilkan.';

        res.json({ analysis });
    } catch (error) {
        console.error('analyzeFleetWithAI error:', error);
        res.status(500).json({ error: error.message || 'Gagal menghasilkan analisis AI armada.' });
    }
};

// --- LAPORAN SANKSI & PELANGGARAN PERJALANAN ARMADA ---
exports.getVehicleSanctionsReport = async (req, res) => {
    try {
        // 1. User yang saat ini aktif disanksi
        const sanctionedUsers = await prisma.user.findMany({
            where: { isSanctioned: true },
            select: {
                id: true,
                name: true,
                phone: true,
                position: true,
                unit: { select: { name: true } },
                isSanctioned: true,
                sanctionProposedLift: true,
                sanctionLiftReason: true,
                createdAt: true
            }
        });

        // 2. Riwayat Pelanggaran Peminjaman
        const violations = await prisma.driverViolation.findMany({
            where: {
                OR: [
                    { category: 'Sanksi Peminjaman' },
                    { description: { contains: 'perjalanan' } },
                    { description: { contains: 'Armada' } }
                ]
            },
            include: {
                driver: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        position: true,
                        unit: { select: { name: true } }
                    }
                }
            },
            orderBy: { date: 'desc' }
        });

        res.json({
            sanctionedUsers,
            violations
        });
    } catch (err) {
        console.error('getVehicleSanctionsReport error:', err);
        res.status(500).json({ error: err.message });
    }
};

// --- LAPORAN PENGISIAN MINYAK & BBM ARMADA ---
exports.getVehicleFuelReport = async (req, res) => {
    try {
        const { month, year, vehicleId, startDate, endDate } = req.query;
        let dateFilter = {};

        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            dateFilter = { gte: start, lte: end };
        } else if (month && year) {
            const start = new Date(parseInt(year), parseInt(month) - 1, 1);
            const end = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
            dateFilter = { gte: start, lte: end };
        }

        // 1. Log BBM Manual
        const manualLogsWhere = {};
        if (dateFilter.gte) manualLogsWhere.date = dateFilter;
        if (vehicleId && vehicleId !== 'ALL') manualLogsWhere.vehicleId = parseInt(vehicleId);

        const manualFuelLogs = await prisma.vehicleFuelLog.findMany({
            where: manualLogsWhere,
            include: {
                vehicle: { select: { id: true, name: true, plateNumber: true, type: true } }
            },
            orderBy: { date: 'desc' }
        });

        // 2. BBM dari Perjalanan (VehicleBooking)
        const bookingLogsWhere = {
            status: 'COMPLETED',
            fuelPrice: { gt: 0 }
        };
        if (dateFilter.gte) bookingLogsWhere.tripEndTime = dateFilter;
        if (vehicleId && vehicleId !== 'ALL') bookingLogsWhere.vehicleId = parseInt(vehicleId);

        const bookingFuelLogs = await prisma.vehicleBooking.findMany({
            where: bookingLogsWhere,
            include: {
                vehicle: { select: { id: true, name: true, plateNumber: true, type: true } },
                user: { select: { id: true, name: true, phone: true, unit: { select: { name: true } } } }
            },
            orderBy: { tripEndTime: 'desc' }
        });

        // Format and merge transactions
        const transactions = [
            ...manualFuelLogs.map(l => ({
                id: `manual-${l.id}`,
                source: 'LOG_MANUAL',
                date: l.date,
                vehicle: l.vehicle,
                driverName: 'Staff Armada',
                unitName: 'Bidang Sarana',
                liters: l.liters,
                cost: l.cost,
                odometer: l.odometer,
                proofFile: l.proofFile
            })),
            ...bookingFuelLogs.map(b => ({
                id: `booking-${b.id}`,
                source: 'PERJALANAN_DINAS',
                date: b.tripEndTime || b.startDate,
                vehicle: b.vehicle,
                driverName: b.user?.name || '-',
                unitName: b.user?.unit?.name || 'Umum',
                liters: b.fuelLiters || (b.fuelPrice > 0 ? (b.fuelPrice / 10000) : 0),
                cost: b.fuelPrice || 0,
                odometer: b.endKm || b.startKm || 0,
                proofFile: b.fuelReceipt || null
            }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date));

        const totalCost = transactions.reduce((acc, t) => acc + (t.cost || 0), 0);
        const totalLiters = transactions.reduce((acc, t) => acc + (t.liters || 0), 0);

        res.json({
            transactions,
            summary: {
                totalTransactions: transactions.length,
                totalCost,
                totalLiters,
                avgPricePerLiter: totalLiters > 0 ? (totalCost / totalLiters) : 0
            }
        });
    } catch (err) {
        console.error('getVehicleFuelReport error:', err);
        res.status(500).json({ error: err.message });
    }
};
