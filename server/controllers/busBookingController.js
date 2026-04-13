const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const whatsappService = require('../services/whatsappService');
const { createNotification } = require('./notificationController');
const { formatPhoneForWA } = require('../utils/phoneFormatter');

// 1. Create Bus Booking (No Approval Flow)
const createBusBooking = async (req, res) => {
    try {
        const { vehicleId, vehicleIds, startDate, endDate, destination, purpose, passengerCount } = req.body;

        // Support both single vehicleId and array of vehicleIds
        const vIds = vehicleIds || [vehicleId];

        if (!vIds || vIds.length === 0) {
            return res.status(400).json({ error: 'Pilih setidaknya satu armada' });
        }

        // Generate a 6-character secret token
        const token = Math.random().toString(36).substring(2, 8).toUpperCase();

        const start = new Date(startDate);
        const end = new Date(endDate);

        // Check for overlaps for each vehicle
        for (const vId of vIds) {
            const overlapping = await prisma.busBooking.findFirst({
                where: {
                    vehicleId: parseInt(vId),
                    OR: [
                        {
                            AND: [
                                { startDate: { lte: start } },
                                { endDate: { gte: start } }
                            ]
                        },
                        {
                            AND: [
                                { startDate: { lte: end } },
                                { endDate: { gte: end } }
                            ]
                        },
                        {
                            AND: [
                                { startDate: { gte: start } },
                                { endDate: { lte: end } }
                            ]
                        }
                    ]
                },
                include: { vehicle: true }
            });

            if (overlapping) {
                return res.status(400).json({
                    error: `Jadwal bertabrakan dengan booking lain untuk ${overlapping.vehicle.name} (${new Date(overlapping.startDate).toLocaleString('id-ID')} s/d ${new Date(overlapping.endDate).toLocaleString('id-ID')})`
                });
            }
        }

        // Determine Unit
        let bookingUnit = req.body.unit;
        if (req.user) {
            const userWithUnit = await prisma.user.findUnique({
                where: { id: req.user.id },
                include: { unit: true }
            });
            bookingUnit = req.body.unit || userWithUnit?.unit?.name || 'Internal';
        }

        const requesterPhone = req.body.requesterPhone || (req.user ? req.user.phone : null);
        const requesterName = req.body.requesterName || (req.user ? req.user.name : null);

        if (!requesterPhone) {
            return res.status(400).json({ error: 'Nomor HP wajib diisi' });
        }
        if (!requesterName) {
            return res.status(400).json({ error: 'Nama pemesan wajib diisi' });
        }

        // Create multiple bookings if needed
        const createdBookings = [];
        for (const vId of vIds) {
            const booking = await prisma.busBooking.create({
                data: {
                    vehicleId: parseInt(vId),
                    userId: req.user ? req.user.id : null,
                    isPublic: !req.user,
                    requesterName,
                    requesterPhone,
                    unit: bookingUnit,
                    destination,
                    purpose,
                    startDate: start,
                    endDate: end,
                    passengerCount: parseInt(passengerCount),
                    token: token
                },
                include: { vehicle: true, user: true }
            });
            createdBookings.push(booking);
        }

        // --- Notifications (Async) ---
        (async () => {
            try {
                const requesterLabel = requesterName;
                const vehicleNames = createdBookings.map(b => `${b.vehicle.name} (${b.vehicle.plateNumber})`).join(', ');

                // 1. Notify Requester
                if (requesterPhone) {
                    const requesterMsg = `*Bismillah Ustadz/Ustadzah ${requesterLabel.toUpperCase()}*\n\n` +
                        `Booking bus  telah dicatat.\n` +
                        `Armada: ${vehicleNames}\n` +
                        `Token Batal: *${token}*\n\n` +
                        `Simpan token ini jika Anda ingin membatalkan pesanan secara mandiri di halaman publik.\n\n` +
                        `_Sistem Manajemen Aset_`;

                    try {
                        await whatsappService.sendMessage(requesterPhone, requesterMsg);
                    } catch (waError) {
                        console.error(`[Bus Booking] Requester WA Failed:`, waError.message);
                    }
                }

                // 2. Notify Admins & Staff Kendaraan
                const recipients = await prisma.user.findMany({
                    where: {
                        OR: [
                            { position: { contains: 'Kepala Bidang Sarana dan Prasarana' } },
                            { position: { contains: 'Staff Manajemen Aset' } },
                            { position: { contains: 'Staff Kendaraan' } }
                        ],
                        phone: { not: null, not: '' }
                    }
                });

                // 3. Notify Vehicle PICs specifically for these buses
                const vPICs = [];
                for (const booking of createdBookings) {
                    if (booking.vehicle?.pics) {
                        vPICs.push(...booking.vehicle.pics);
                    }
                }

                // Combine and Deduplicate Recipients
                const finalRecipients = [];
                const seenIds = new Set();

                [...recipients, ...vPICs].forEach(r => {
                    if (r && r.id && !seenIds.has(r.id) && r.phone) {
                        finalRecipients.push(r);
                        seenIds.add(r.id);
                    }
                });

                if (finalRecipients.length > 0) {
                    const cleanPhone = formatPhoneForWA(requesterPhone);
                    const waLink = cleanPhone ? `https://wa.me/${cleanPhone}` : null;

                    const adminMsg = `*BOOKING BUS BARU*\n\n` +
                        `Pemohon: ${requesterLabel}\n` +
                        `No. HP: ${requesterPhone || '-'}\n` +
                        `Armada: ${vehicleNames}\n` +
                        `Tujuan: ${destination}\n` +
                        `Keperluan: ${purpose || '-'}\n` +
                        `Penumpang: ${passengerCount} Orang\n` +
                        `Jadwal: ${new Date(startDate).toLocaleString('id-ID')} s/d ${new Date(endDate).toLocaleString('id-ID')}\n` +
                        `Token: ${token}\n\n` +
                        (waLink ? `*Hubungi Pemesan:* ${waLink}\n\n` : '') +
                        `_Sistem Manajemen Aset_`;

                    for (const person of finalRecipients) {
                        try {
                            await whatsappService.sendMessage(person.phone, adminMsg);
                            // Add System Notification
                            await createNotification(
                                person.id,
                                'Booking Bus Baru',
                                `Booking bus baru dari ${requesterLabel} untuk ${vehicleNames}.`,
                                'INFO',
                                '/kendaraan/booking-bus'
                            );
                        } catch (waError) {
                            console.error(`[Bus Booking] Staff WA Failed for ${person.name}:`, waError.message);
                        }
                    }
                }
            } catch (notifErr) {
                console.error('[Bus Booking] Notification Error:', notifErr.message);
            }
        })();

        res.status(201).json({ bookings: createdBookings, token });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 2. Get All Bus Bookings
const getAllBusBookings = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const where = {};

        if (startDate && endDate) {
            where.startDate = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }

        const bookings = await prisma.busBooking.findMany({
            where,
            include: {
                vehicle: true,
                user: { include: { unit: true } },
                driver: { select: { id: true, name: true, phone: true, position: true } }
            },
            orderBy: { startDate: 'asc' }
        });

        // Split into upcoming and past
        const now = new Date();
        const upcoming = bookings.filter(b => new Date(b.endDate) >= now);
        const past = bookings.filter(b => new Date(b.endDate) < now);

        // Sort past by most recent first (descending)
        past.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

        res.json([...upcoming, ...past]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getPublicBusBookings = async (req, res) => {
    try {
        const bookings = await prisma.busBooking.findMany({
            include: { vehicle: true },
            orderBy: { startDate: 'asc' }
        });

        // Remove user sensitive info and TOKEN for public
        const sanitized = bookings.map(b => ({
            ...b,
            token: null, // Critical: Hide token
            user: b.user ? { name: b.user.name } : null
        }));
        res.json(sanitized);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Bus Expense Summary (Fuel + Maintenance) for Revenue Dashboard
const getBusExpenseSummary = async (req, res) => {
    try {
        // 1. Find all bus-type vehicles
        const busVehicles = await prisma.vehicle.findMany({
            where: {
                OR: [
                    { type: { contains: 'Bus' } },
                    { name: { contains: 'Bus' } }
                ]
            },
            select: { id: true, name: true }
        });

        const busVehicleIds = busVehicles.map(v => v.id);

        // 2. BBM: Hanya dari VehicleBooking.fuelPrice
        const vehicleBookingFuel = await prisma.vehicleBooking.findMany({
            where: { 
                vehicleId: { in: busVehicleIds },
                fuelRefill: true,
                fuelPrice: { gt: 0 }
            },
            select: { fuelPrice: true, startDate: true, vehicleId: true }
        });

        // 3. Perawatan: Dari VehicleService (Service Kendaraan)
        const serviceRecords = await prisma.vehicleService.findMany({
            where: {
                vehicleId: { in: busVehicleIds },
                cost: { gt: 0 }
            },
            select: { cost: true, date: true, description: true, type: true }
        });

        // 4. Summarize
        const totalFuel = vehicleBookingFuel.reduce((s, f) => s + (f.fuelPrice || 0), 0);
        const totalMaintenance = serviceRecords.reduce((s, m) => s + (m.cost || 0), 0);

        res.json({
            totalFuel,
            totalMaintenance,
            totalExpenses: totalFuel + totalMaintenance,
            fuelRecords: vehicleBookingFuel.map(f => ({ cost: f.fuelPrice, date: f.startDate })),
            maintenanceRecords: serviceRecords.map(m => ({ 
                cost: m.cost, 
                date: m.date,
                title: m.description || m.type 
            }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getPublicBusInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        const booking = await prisma.busBooking.findUnique({
            where: { id: parseInt(id) },
            include: { vehicle: true }
        });

        if (!booking) return res.status(404).json({ error: 'Invoice tidak ditemukan' });

        // Remove sensitive info
        const sanitized = {
            id: booking.id,
            requesterName: booking.requesterName,
            unit: booking.unit,
            destination: booking.destination,
            passengerCount: booking.passengerCount,
            startDate: booking.startDate,
            endDate: booking.endDate,
            totalKm: booking.totalKm,
            totalBill: booking.totalBill,
            isPaid: booking.isPaid,
            paidAt: booking.paidAt,
            vehicle: { name: booking.vehicle?.name, plateNumber: booking.vehicle?.plateNumber }
        };
        res.json(sanitized);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getPublicBusInvoiceBatch = async (req, res) => {
    try {
        const { ids } = req.query; // ?ids=1,2,3
        if (!ids) return res.status(400).json({ error: 'IDs are required' });

        const idArray = ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
        
        const bookings = await prisma.busBooking.findMany({
            where: { id: { in: idArray }, isPaid: true },
            include: { vehicle: true },
            orderBy: { id: 'asc' }
        });

        // Remove sensitive info
        const sanitized = bookings.map(booking => ({
            id: booking.id,
            requesterName: booking.requesterName,
            unit: booking.unit,
            destination: booking.destination,
            passengerCount: booking.passengerCount,
            startDate: booking.startDate,
            endDate: booking.endDate,
            totalKm: booking.totalKm,
            totalBill: booking.totalBill,
            isPaid: booking.isPaid,
            paidAt: booking.paidAt,
            vehicle: { name: booking.vehicle?.name, plateNumber: booking.vehicle?.plateNumber }
        }));
        
        res.json(sanitized);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 3. Delete/Cancel (Internal)
const deleteBusBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const booking = await prisma.busBooking.findUnique({ where: { id: parseInt(id) } });

        if (!booking) return res.status(404).json({ error: 'Booking tidak ditemukan' });

        // Only owner or admin can delete
        if (booking.userId !== req.user.id && !['SUPER_ADMIN', 'ADMIN_ASET'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Akses ditolak' });
        }

        // Cancel associated Vehicle Booking if any
        await prisma.vehicleBooking.updateMany({
            where: { adminNote: `[BUS_BOOKING]-${id}` },
            data: { status: 'CANCELLED' }
        });

        await prisma.busBooking.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Booking berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 4. Cancel by Token (Public/Internal)
const cancelByToken = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ error: 'Token diperlukan' });

        const bookings = await prisma.busBooking.findMany({
            where: { token: token.toUpperCase() }
        });

        if (bookings.length === 0) {
            return res.status(404).json({ error: 'Token tidak valid atau tidak ditemukan' });
        }

        for (const b of bookings) {
            await prisma.vehicleBooking.updateMany({
                where: { adminNote: `[BUS_BOOKING]-${b.id}` },
                data: { status: 'CANCELLED' }
            });
        }

        await prisma.busBooking.deleteMany({
            where: { token: token.toUpperCase() }
        });

        res.json({ message: 'Booking berhasil dibatalkan', count: bookings.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 5. Assign Driver
const assignDriver = async (req, res) => {
    try {
        const { id } = req.params;
        const { driverId } = req.body;
        const user = req.user;

        // Fetch current user with position
        const currentUser = await prisma.user.findUnique({ where: { id: user.id } });

        const isSarpras = currentUser?.position?.toLowerCase().includes('sarana dan prasarana');
        const isTechAdmin = ['SUPER_ADMIN', 'BIDANG_IT'].includes(user.role);

        if (!isSarpras && !isTechAdmin) {
            return res.status(403).json({ error: 'Akses ditolak. Hanya bagian Sarana dan Prasarana yang dapat menugaskan supir.' });
        }

        const booking = await prisma.busBooking.update({
            where: { id: parseInt(id) },
            data: { driverId: driverId ? parseInt(driverId) : null },
            include: {
                driver: { select: { name: true, phone: true } },
                vehicle: true
            }
        });

        // --- MANAGE VEHICLE BOOKING SYNCHRONIZATION ---
        const tag = `[BUS_BOOKING]-${booking.id}`;

        const existingVBooking = await prisma.vehicleBooking.findFirst({
            where: { adminNote: tag }
        });

        if (driverId) {
            if (existingVBooking) {
                await prisma.vehicleBooking.update({
                    where: { id: existingVBooking.id },
                    data: {
                        userId: parseInt(driverId),
                        driverId: parseInt(driverId),
                        status: existingVBooking.status === 'CANCELLED' ? 'APPROVED' : undefined
                    }
                });
            } else {
                await prisma.vehicleBooking.create({
                    data: {
                        vehicleId: booking.vehicleId,
                        userId: parseInt(driverId),
                        driverId: parseInt(driverId),
                        destination: booking.destination,
                        purpose: `Tugas Bus: ${booking.purpose || booking.requesterName}`,
                        startDate: booking.startDate,
                        endDate: booking.endDate,
                        status: 'APPROVED',
                        adminNote: tag,
                        passengerCount: booking.passengerCount
                    }
                });
            }
        } else {
            if (existingVBooking) {
                await prisma.vehicleBooking.update({
                    where: { id: existingVBooking.id },
                    data: { status: 'CANCELLED' }
                });
            }
        }

        // Notify Driver (Async)
        if (booking.driver?.phone) {
            (async () => {
                const msg = `*PENUGASAN SUPIR BUS*\n\n` +
                    `Assalamu'alaikum ${booking.driver.name},\n\n` +
                    `Anda telah ditugaskan untuk mengendarai armada berikut:\n` +
                    `🚌 *Bus*: ${booking.vehicle.name} (${booking.vehicle.plateNumber})\n` +
                    `📍 *Tujuan*: ${booking.destination}\n` +
                    `📅 *Jadwal*: ${new Date(booking.startDate).toLocaleString('id-ID')} s/d ${new Date(booking.endDate).toLocaleString('id-ID')}\n\n` +
                    `Tugas ini sudah masuk secara otomatis ke menu *Permohonan Saya*. Silakan klik *Mulai Perjalanan* saat Anda berangkat.\n\nSyukron.`;
                try { await whatsappService.sendMessage(booking.driver.phone, msg); } catch (e) { }
            })();
        }

        res.json(booking);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 6. Automated Notifications (H-1) & Booking Confirmation Public Endpoint
const checkBusBookingNotifications = async () => {
    try {
        const now = new Date();
        const h1 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const h1End = new Date(h1);
        h1End.setHours(23, 59, 59, 999);

        console.log(`[Bus Booking] Checking for H-1 trips on ${h1.toLocaleDateString('id-ID')}...`);

        const bookings = await prisma.busBooking.findMany({
            where: {
                startDate: {
                    gte: h1,
                    lte: h1End
                },
                status: 'APPROVED',
                isReminderSent: false
            },
            include: {
                vehicle: true,
                driver: { select: { name: true } }
            }
        });

        if (bookings.length === 0) return;

        // Group by token
        const grouped = bookings.reduce((acc, booking) => {
            if (!booking.token) return acc;
            if (!acc[booking.token]) acc[booking.token] = [];
            acc[booking.token].push(booking);
            return acc;
        }, {});

        const domainUrl = process.env.VITE_API_URL ? process.env.VITE_API_URL.replace('/api', '') : 'https://sarpras.dareliman.or.id';

        for (const token of Object.keys(grouped)) {
            const group = grouped[token];
            const requesterPhone = group[0].requesterPhone;
            const requesterName = group[0].requesterName;
            const destination = group[0].destination;
            const startDate = group[0].startDate;

            if (!requesterPhone) continue;

            let msg = `📢 *KONFIRMASI JADWAL BUS (H-1)* 🚌\n\n` +
                `Bismillah Ustadz/Ustadzah *${(requesterName || '').toUpperCase()}*,\n\n` +
                `Kami dari Bagian Sarpras ingin memastikan kembali rencana keberangkatan bus untuk:\n` +
                `📍 *Tujuan*: ${destination}\n` +
                `📅 *Jadwal*: ${new Date(startDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}\n\n`;

            msg += `Berikut armada yang Ustadz/Ustadzah pesan. Mohon klik link di bawah ini untuk konfirmasi apakah jadwal masing-masing bus tetap *JADI* dilaksanakan atau *BATAL*:\n\n`;

            for (const b of group) {
                const link = `${domainUrl}/public/confirm-bus/${b.id}/${b.token}`;
                msg += `🚌 *${b.vehicle.name}* (${b.vehicle.plateNumber})\n` +
                       `🔗 Konfirmasi: ${link}\n\n`;
            }

            msg += `Konfirmasi Ustadz/Ustadzah sangat kami harapkan agar kami dapat menyiapkan armada dengan maksimal. Syukron.\n_Sistem Manajemen Aset_`;

            try {
                await whatsappService.sendMessage(requesterPhone, msg);
                console.log(`[Bus Booking] H-1 Reminder sent to ${requesterName} (${requesterPhone})`);
                
                // Mark as sent
                await prisma.busBooking.updateMany({
                    where: { id: { in: group.map(b => b.id) } },
                    data: { isReminderSent: true }
                });
            } catch (err) {
                console.error(`[Bus Booking] H-1 WA Failed for ${requesterName}:`, err.message);
            }
        }
    } catch (err) {
        console.error('[Bus Booking] H-1 Notif Error:', err);
    }
};

const publicConfirmBooking = async (req, res) => {
    try {
        const { id, token } = req.params;
        const { decision } = req.body; // 'JADI' or 'BATAL'

        if (!['JADI', 'BATAL'].includes(decision)) {
            return res.status(400).json({ error: 'Keputusan tidak valid' });
        }

        const booking = await prisma.busBooking.findUnique({
            where: { id: parseInt(id) },
            include: { vehicle: true, driver: { select: { name: true } } }
        });

        if (!booking || booking.token !== token) {
            return res.status(404).json({ error: 'Booking tidak ditemukan atau token tidak valid' });
        }

        if (decision === 'JADI') {
            await prisma.busBooking.update({
                where: { id: parseInt(id) },
                data: { status: 'CONFIRMED' }
            });
            // Also update VehicleBooking if exists
            await prisma.vehicleBooking.updateMany({
                where: { adminNote: `[BUS_BOOKING]-${id}` },
                data: { status: 'APPROVED' }
            });
        } else if (decision === 'BATAL') {
            await prisma.busBooking.update({
                where: { id: parseInt(id) },
                data: { status: 'CANCELLED' }
            });
            await prisma.vehicleBooking.updateMany({
                where: { adminNote: `[BUS_BOOKING]-${id}` },
                data: { status: 'CANCELLED' }
            });
        }

        // Notify Staff Kendaraan
        const staffKendaraan = await prisma.user.findMany({
            where: {
                position: { contains: 'Staff Kendaraan' },
                phone: { not: null, not: '' }
            }
        });

        if (staffKendaraan.length > 0) {
            let staffMsg = '';
            if (decision === 'JADI') {
                staffMsg = `✅ *KONFIRMASI JADWAL BUS (FIX)*\n\n` +
                    `Alhamdulillah! Pemesan *${booking.requesterName}* telah mengonfirmasi bahwa jadwal bus ke *${booking.destination}* besok *TETAP JADI*.\n\n` +
                    `🚌 *Armada*: ${booking.vehicle.name} (${booking.vehicle.plateNumber})\n` +
                    `👤 *Driver*: ${booking.driver?.name || '_Belum ditentukan_'}\n\n` +
                    `Mohon dipastikan armada dan personil dalam kondisi prima. Jazakallah Khairan.\n_Sistem Manajemen Aset_`;
            } else {
                staffMsg = `❌ *PEMBATALAN JADWAL BUS*\n\n` +
                    `Informasi: Pemesan *${booking.requesterName}* telah *MEMBATALKAN* jadwal bus ke *${booking.destination}* untuk besok.\n\n` +
                    `Armada *${booking.vehicle.name}* (${booking.vehicle.plateNumber}) kini tersedia kembali (Status: Tersedia) untuk unit lain yang membutuhkan. Syukron.\n_Sistem Manajemen Aset_`;
            }

            for (const staff of staffKendaraan) {
                try {
                    await whatsappService.sendMessage(staff.phone, staffMsg);
                } catch (err) {
                    console.error(`[Bus Booking] Staff WA Failed for ${staff.name}:`, err.message);
                }
            }
        }

        res.json({ message: `Konfirmasi ${decision} berhasil dicatat.`, status: decision === 'JADI' ? 'CONFIRMED' : 'CANCELLED' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 7. Overdue Payment Reminders (7 Days after bill appearance)
const checkUnpaidBusInvoices = async () => {
    try {
        const now = new Date();
        const aWeekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        aWeekAgo.setHours(23, 59, 59, 999); // Anything completed on or before 7 days ago

        console.log(`[Bus Revenue] Checking for unpaid invoices older than ${aWeekAgo.toLocaleDateString('id-ID')}...`);

        const unpaidBookings = await prisma.busBooking.findMany({
            where: {
                isPaid: false,
                status: 'COMPLETED',
                completedAt: {
                    lte: aWeekAgo
                }
            },
            include: { vehicle: true }
        });

        if (unpaidBookings.length === 0) return;

        // Find Recipients: Staff Keuangan & Administrasi (Sarpras)
        const recipients = await prisma.user.findMany({
            where: {
                position: 'Staff Keuangan dan Administrasi (Sarpras)',
                phone: { not: null, not: '' }
            }
        });

        if (recipients.length === 0) return;

        // Build summary message
        let hasReminders = false;
        let summaryMsg = `⚠️ *LAPORAN TAGIHAN BUS MENUNGGAK* ⚠️\n\n` +
            `Bismillah, pengingat tagihan bus yang belum lunas (interval 3 hari):\n\n`;

        unpaidBookings.forEach((b) => {
            const ageDays = Math.floor((now - new Date(b.completedAt)) / (1000 * 60 * 60 * 24));
            
            // Only remind on day 7, 10, 13, 16, etc.
            if (ageDays >= 7 && (ageDays - 7) % 3 === 0) {
                hasReminders = true;
                summaryMsg += `• *${b.requesterName}* (${b.unit || 'Umum'})\n` +
                    `  💰 Rp ${b.totalBill?.toLocaleString('id-ID')}\n` +
                    `  ⏳ Tertunda: ${ageDays} hari\n\n`;
            }
        });

        if (!hasReminders) return;

        summaryMsg += `_Mohon segera dilakukan penagihan/koordinasi. Syukron._`;

        for (const staff of recipients) {
            try {
                await whatsappService.sendMessage(staff.phone, summaryMsg);
                console.log(`[Bus Revenue] Overdue reminder sent to ${staff.name}`);
            } catch (e) {
                console.error(`[Bus Revenue] Failed sending to ${staff.phone}:`, e.message);
            }
        }
    } catch (err) {
        console.error('[Bus Revenue] Overdue Check Error:', err);
    }
};

// 7. Complete Trip & Generate Bill
const completeBusBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const { totalKm } = req.body;

        // Role Check
        if (!['ADMIN_ASET', 'SUPER_ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Akses ditolak. Hanya Admin Aset atau Super Admin yang diizinkan.' });
        }

        const booking = await prisma.busBooking.findUnique({
            where: { id: parseInt(id) },
            include: { vehicle: true }
        });

        if (!booking) return res.status(404).json({ error: 'Booking tidak ditemukan' });

        const kmVal = parseInt(totalKm);
        const billAmount = kmVal * 2000;

        const updated = await prisma.busBooking.update({
            where: { id: parseInt(id) },
            data: {
                totalKm: kmVal,
                totalBill: billAmount,
                status: 'COMPLETED',
                completedAt: new Date()
            }
        });

        // Send WA Notification to Requester
        if (booking.requesterPhone) {
            const msg = `📢 *TAGIHAN PERJALANAN BUS* 🚌\n\n` +
                `Bismillah Ustadz/Ustadzah *${(booking.requesterName || '').toUpperCase()}*,\n` +
                `Berikut adalah rincian tagihan perjalanan bus Anda:\n\n` +
                `🏢 *Unit*: ${booking.unit || '-'}\n` +
                `📍 *Tujuan*: ${booking.destination}\n` +
                `📅 *Tanggal*: ${new Date(booking.startDate).toLocaleDateString('id-ID')}\n` +
                `🛣️ *Jarak Tempuh*: ${kmVal} KM\n` +
                `---------------------------\n` +
                `💰 *TOTAL TAGIHAN: Rp ${billAmount.toLocaleString('id-ID')}*\n\n` +
                `Mohon untuk segera melakukan penyelesaian administrasi ke Bagian Keuangan Sarpras. Syukron.\n\n` +
                `_Sistem Manajemen Aset_`;

            try {
                await whatsappService.sendMessage(booking.requesterPhone, msg);
            } catch (e) {
                console.error('[Bus Billing] WA Failed:', e.message);
            }

            // --- Notify Finance Staff ---
            try {
                const finStaffs = await prisma.user.findMany({
                    where: {
                        position: 'Staff Keuangan dan Administrasi (Sarpras)',
                        phone: { not: null, not: '' }
                    }
                });

                if (finStaffs.length > 0) {
                    const finMsg = `📢 *PELAPORAN TAGIHAN BUS (KEUANGAN)* 🚌\n\n` +
                        `Bismillah, pemberitahuan tagihan baru untuk penggunaan bus:\n\n` +
                        `👤 *Pemesan*: ${booking.requesterName}\n` +
                        `🏢 *Unit*: ${booking.unit || '-'}\n` +
                        `📍 *Tujuan*: ${booking.destination}\n` +
                        `📅 *Tanggal*: ${new Date(booking.startDate).toLocaleDateString('id-ID')}\n` +
                        `🛣️ *Jarak*: ${kmVal} KM\n` +
                        `---------------------------\n` +
                        `💰 *TAGIHAN: Rp ${billAmount.toLocaleString('id-ID')}*\n\n` +
                        `_Mohon dipantau pengadministrasiannya. Syukron._`;

                    for (const staff of finStaffs) {
                        await whatsappService.sendMessage(staff.phone, finMsg);
                    }
                }
            } catch (e) {
                console.error('[Bus Finance Notif] Failed:', e.message);
            }
        }

        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 8. Mark as Paid
const markBusAsPaid = async (req, res) => {
    try {
        const { id } = req.params;

        // Role Check
        if (!['ADMIN_ASET', 'SUPER_ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Akses ditolak. Hanya Admin Aset atau Super Admin yang diizinkan.' });
        }

        const updated = await prisma.busBooking.update({
            where: { id: parseInt(id) },
            data: {
                isPaid: true,
                paidAt: new Date()
            },
            include: { vehicle: true }
        });

        // Send WhatsApp Invoice Receipt
        if (updated.requesterPhone) {
            const domainUrl = process.env.VITE_API_URL ? process.env.VITE_API_URL.replace('/api', '') : 'https://sarpras.dareliman.or.id';
            const invoiceLink = `${domainUrl}/public/invoice-bus/${updated.id}`;
            
            const msg = `🧾 *KUITANSI PELUNASAN BUS YDI* 🚌\n\n` +
                `Alhamdulillah Ustadz/Ustadzah *${(updated.requesterName || '').toUpperCase()}*,\n` +
                `Pembayaran sewa operasional bus telah kami terima.\n\n` +
                `📍 *Tujuan*: ${updated.destination}\n` +
                `💰 *Total (Lunas)*: Rp ${updated.totalBill?.toLocaleString('id-ID')}\n` +
                `📅 *Tgl Lunas*: ${new Date(updated.paidAt).toLocaleDateString('id-ID')}\n\n` +
                `🔗 *Unduh INVOICE DIGITAL (PDF):*\n${invoiceLink}\n\n` +
                `Jazakumullahu khairan atas kerjasamanya.\n` +
                `_Bagian Keuangan & Sarpras Yayasan Dar el-Iman_`;

            try {
                await whatsappService.sendMessage(updated.requesterPhone, msg);
            } catch (e) {
                console.error('[Bus Finance] Invoice WA Failed:', e.message);
            }
        }
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get Bus Initial Fund from Settings
const getBusInitialFund = async (req, res) => {
    try {
        const setting = await prisma.setting.findFirst({ where: { id: 1 } });
        res.json({ busInitialFund: setting?.busInitialFund || 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Set Bus Initial Fund in Settings
const setBusInitialFund = async (req, res) => {
    try {
        const { amount } = req.body;
        const updated = await prisma.setting.upsert({
            where: { id: 1 },
            update: { busInitialFund: parseFloat(amount) || 0 },
            create: { id: 1, busInitialFund: parseFloat(amount) || 0 }
        });
        res.json({ busInitialFund: updated.busInitialFund });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getAllBusBookings,
    getPublicBusBookings,
    getPublicBusInvoice,
    getPublicBusInvoiceBatch,
    getBusExpenseSummary,
    getBusInitialFund,
    setBusInitialFund,
    createBusBooking,
    deleteBusBooking,
    cancelByToken,
    assignDriver,
    checkBusBookingNotifications,
    checkUnpaidBusInvoices,
    completeBusBooking,
    markBusAsPaid,
    publicConfirmBooking
};
