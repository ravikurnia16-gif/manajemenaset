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

        const booking = await prisma.busBooking.create({
            data: {
                vehicleId: parseInt(vehicleId),
                userId,
                destination,
                purpose,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                passengerCount: parseInt(passengerCount) || 0
            },
            include: {
                user: { select: { name: true, phone: true } },
                vehicle: { select: { name: true, plateNumber: true } }
            }
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
                    const msg = `🚌 *BOOKING JADWAL BUS BARU*\n\n` +
                        `Pemohon: ${booking.user.name}\n` +
                        `Armada: ${vehicle.name} (${vehicle.plateNumber})\n` +
                        `Jadwal: ${new Date(startDate).toLocaleString('id-ID')} s/d ${new Date(endDate).toLocaleString('id-ID')}\n` +
                        `Tujuan: ${destination}\n` +
                        `Keperluan: ${purpose || '-'}\n` +
                        `Penumpang: ${passengerCount} Orang\n\n` +
                        `_Sistem mencatat booking ini secara otomatis._`;

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
exports.getAllBusBookings = async (req, res) => {
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
                user: { select: { name: true, unit: { select: { name: true } } } },
                vehicle: { select: { name: true, plateNumber: true } }
            },
            orderBy: { startDate: 'asc' }
        });

        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 3. Delete/Cancel (Optional but useful)
exports.deleteBusBooking = async (req, res) => {
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
