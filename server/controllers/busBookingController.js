const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const whatsappService = require('../services/whatsappService');

// 1. Create Bus Booking (No Approval Flow)
exports.createBusBooking = async (req, res) => {
    try {
        const { vehicleId, startDate, endDate, destination, purpose, passengerCount } = req.body;
        const userId = req.user.id;

        const vehicle = await prisma.vehicle.findUnique({
            where: { id: parseInt(vehicleId) }
        });

        if (!vehicle) return res.status(404).json({ error: 'Bus tidak ditemukan' });

        // --- Check for Overlapping Bookings ---
        const start = new Date(startDate);
        const end = new Date(endDate);

        const overlapping = await prisma.busBooking.findFirst({
            where: {
                vehicleId: parseInt(vehicleId),
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
            }
        });

        if (overlapping) {
            return res.status(400).json({
                error: `Jadwal bertabrakan dengan booking lain (${new Date(overlapping.startDate).toLocaleString('id-ID')} s/d ${new Date(overlapping.endDate).toLocaleString('id-ID')})`
            });
        }

        const booking = await prisma.busBooking.create({
            data: {
                vehicleId: parseInt(vehicleId),
                userId: req.user ? req.user.id : null,
                isPublic: !req.user,
                requesterName: req.user ? req.user.name : req.body.requesterName,
                requesterPhone: req.user ? req.user.phone : req.body.requesterPhone,
                destination,
                purpose,
                startDate: start,
                endDate: end,
                passengerCount: parseInt(passengerCount)
            },
            include: { vehicle: true, user: true }
        });

        // --- Notifications (Async) ---
        (async () => {
            try {
                // Find Recipients
                // 1. Wegi (Staff Kendaraan)
                // 2. Kepala Bidang Sarana dan Prasarana
                const recipients = await prisma.user.findMany({
                    where: {
                        OR: [
                            { name: { contains: 'Wegi' } },
                            { position: 'Kepala Bidang Sarana dan Prasarana' }
                        ],
                        phone: { not: null, not: '' }
                    }
                });

                if (recipients.length > 0) {
                    const requesterLabel = req.user ? req.user.name : req.body.requesterName;
                    const msg = `*BOOKING BUS BARU*\n\n` +
                        `Pemohon: ${requesterLabel}\n` +
                        `Armada: ${vehicle.name} (${vehicle.plateNumber})\n` +
                        `Tujuan: ${destination}\n` +
                        `Keperluan: ${purpose || '-'}\n` +
                        `Penumpang: ${passengerCount} Orang\n` +
                        `Jadwal: ${new Date(startDate).toLocaleString('id-ID')} s/d ${new Date(endDate).toLocaleString('id-ID')}\n\n` +
                        `_Sistem Manajemen Aset_`;

                    for (const person of recipients) {
                        try {
                            await whatsappService.sendMessage(person.phone, msg);
                        } catch (waError) {
                            console.error(`[Bus Booking] WA Failed for ${person.name}:`, waError.message);
                        }
                    }
                }
            } catch (notifErr) {
                console.error('[Bus Booking] Notification Error:', notifErr.message);
            }
        })();

        res.status(201).json(booking);
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
            include: { vehicle: true, user: true },
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
        // Remove user sensitive info if any (though user is null for public)
        const sanitized = bookings.map(b => ({
            ...b,
            user: b.user ? { name: b.user.name } : null
        }));
        res.json(sanitized);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 3. Delete/Cancel (Optional but useful)
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

module.exports = {
    getAllBusBookings,
    getPublicBusBookings,
    createBusBooking,
    deleteBusBooking
};
