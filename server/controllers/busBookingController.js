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

// 6. Automated Notifications (H-2)
const checkBusBookingNotifications = async () => {
    try {
        const now = new Date();
        const h2 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
        const h2End = new Date(h2);
        h2End.setHours(23, 59, 59, 999);

        console.log(`[Bus Booking] Checking for trips on ${h2.toLocaleDateString('id-ID')}...`);

        const bookings = await prisma.busBooking.findMany({
            where: {
                startDate: {
                    gte: h2,
                    lte: h2End
                }
            },
            include: {
                vehicle: true,
                driver: { select: { name: true } }
            }
        });

        if (bookings.length === 0) return;

        // Find Recipients: Kabid Sarpras & Staff Manajemen Aset
        const recipients = await prisma.user.findMany({
            where: {
                OR: [
                    { position: { contains: 'Kepala Bidang Sarana dan Prasarana' } },
                    { position: { contains: 'Manajemen Aset' } }
                ],
                phone: { not: null, not: '' }
            }
        });

        if (recipients.length === 0) return;

        for (const booking of bookings) {
            const msg = `🗓️ *PENGINGAT PERJALANAN BUS (H-2)* 🗓️\n\n` +
                `Informasi perjalanan yang akan dilaksanakan lusa:\n\n` +
                `🚌 *Armada*: ${booking.vehicle.name} (${booking.vehicle.plateNumber})\n` +
                `📍 *Tujuan*: ${booking.destination}\n` +
                `📅 *Jadwal*: ${new Date(booking.startDate).toLocaleString('id-ID')}\n` +
                `👤 *Supir*: ${booking.driver?.name || '_Belum ditentukan_'} ⚠️\n` +
                `🏢 *Unit*: ${booking.unit || 'Umum'}\n\n` +
                `Mohon pastikan persiapan armada dan personil sudah siap. Syukron.`;

            for (const person of recipients) {
                try {
                    await whatsappService.sendMessage(person.phone, msg);
                    console.log(`[Bus Booking] H-2 Notif sent to ${person.name} for trip to ${booking.destination}`);
                } catch (e) { }
            }
        }
    } catch (err) {
        console.error('[Bus Booking] H-2 Notif Error:', err);
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

        // Update Vehicle Odometer (Incremental)
        if (booking.vehicleId) {
            await prisma.vehicle.update({
                where: { id: booking.vehicleId },
                data: { odometer: { increment: kmVal } }
            });
        }

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
            }
        });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getAllBusBookings,
    getPublicBusBookings,
    createBusBooking,
    deleteBusBooking,
    cancelByToken,
    assignDriver,
    checkBusBookingNotifications,
    completeBusBooking,
    markBusAsPaid
};
