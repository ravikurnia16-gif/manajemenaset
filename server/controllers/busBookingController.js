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
                            { name: { contains: 'Wegi Fatriadi' } },
                            { position: { contains: 'Kepala Bidang Sarana dan Prasarana' } }
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
                user: { include: { unit: true } }
            },
            orderBy: { startDate: 'asc' }
        });
        res.json(bookings);
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

        await prisma.busBooking.deleteMany({
            where: { token: token.toUpperCase() }
        });

        res.json({ message: 'Booking berhasil dibatalkan', count: bookings.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getAllBusBookings,
    getPublicBusBookings,
    createBusBooking,
    deleteBusBooking,
    cancelByToken
};
