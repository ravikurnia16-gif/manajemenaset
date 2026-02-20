const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendMessage } = require('../services/whatsappService');

// 1. Request Booking
exports.requestBooking = async (req, res) => {
    try {
        const { vehicleId, startDate, endDate, destination, purpose, passengerCount, driverId } = req.body;
        const userId = req.user.id;

        const vehicle = await prisma.vehicle.findUnique({
            where: { id: parseInt(vehicleId) },
            include: { pic: true }
        });

        if (!vehicle) return res.status(404).json({ error: 'Kendaraan tidak ditemukan' });

        const booking = await prisma.vehicleBooking.create({
            data: {
                vehicleId: parseInt(vehicleId),
                userId,
                destination,
                purpose,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                passengerCount: parseInt(passengerCount) || 0,
                driverId: driverId ? parseInt(driverId) : null,
                status: 'PENDING'
            },
            include: {
                user: { select: { name: true } },
                vehicle: { select: { name: true, plateNumber: true, pic: true } }
            }
        });

        // Notify PIC via WhatsApp
        if (vehicle.pic && vehicle.pic.phone) {
            const msg = `🚗 *PERMINTAAN PINJAM KENDARAAN*\n\n` +
                `Pemohon: ${booking.user.name}\n` +
                `Armada: ${vehicle.name} (${vehicle.plateNumber})\n` +
                `Jadwal: ${new Date(startDate).toLocaleString('id-ID')} s/d ${new Date(endDate).toLocaleString('id-ID')}\n` +
                `Tujuan: ${destination}\n` +
                `Keperluan: ${purpose}\n\n` +
                `Mohon tinjau di sistem untuk persetujuan.`;
            await sendMessage(vehicle.pic.phone, msg);
        }

        res.status(201).json(booking);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 2. Review Booking (Approve/Reject)
exports.reviewBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, adminNote } = req.body; // status: APPROVED or REJECTED

        const booking = await prisma.vehicleBooking.findUnique({
            where: { id: parseInt(id) },
            include: { vehicle: true, user: true }
        });

        if (!booking) return res.status(404).json({ error: 'Booking tidak ditemukan' });

        // Check permission: Super Admin or Vehicle PIC
        const isSuperAdmin = ['SUPER_ADMIN', 'BIDANG_IT'].includes(req.user.role);
        const isPIC = booking.vehicle.picId === req.user.id;

        if (!isSuperAdmin && !isPIC) {
            return res.status(403).json({ error: 'Akses ditolak. Anda bukan PIC kendaraan ini.' });
        }

        const updated = await prisma.vehicleBooking.update({
            where: { id: parseInt(id) },
            data: {
                status,
                adminNote
            }
        });

        // Notify User
        if (booking.user.phone) {
            const statusLabel = status === 'APPROVED' ? 'DISETUJUI ✅' : 'DITOLAK ❌';
            const msg = `📢 *UPDATE STATUS PEMINJAMAN*\n\n` +
                `Permintaan Anda untuk kendaraan *${booking.vehicle.name}* telah *${statusLabel}*.\n` +
                (adminNote ? `Catatan: ${adminNote}` : '');
            await sendMessage(booking.user.phone, msg);
        }

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 3. Start Trip
exports.startTrip = async (req, res) => {
    try {
        const { id } = req.params;
        const { startKm } = req.body;

        const booking = await prisma.vehicleBooking.findUnique({
            where: { id: parseInt(id) },
            include: { vehicle: true }
        });

        if (!booking) return res.status(404).json({ error: 'Booking tidak ditemukan' });
        if (booking.userId !== req.user.id) return res.status(403).json({ error: 'Akses ditolak' });

        const updated = await prisma.vehicleBooking.update({
            where: { id: parseInt(id) },
            data: {
                startKm: parseInt(startKm),
                tripStartTime: new Date()
            }
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 4. End Trip
exports.endTrip = async (req, res) => {
    try {
        const { id } = req.params;
        const { endKm, tripNotes, fuelRefill, fuelPrice } = req.body;

        const booking = await prisma.vehicleBooking.findUnique({
            where: { id: parseInt(id) },
            include: { vehicle: true }
        });

        if (!booking) return res.status(404).json({ error: 'Booking tidak ditemukan' });
        if (booking.userId !== req.user.id) return res.status(403).json({ error: 'Akses ditolak' });

        const updated = await prisma.vehicleBooking.update({
            where: { id: parseInt(id) },
            data: {
                endKm: parseInt(endKm),
                tripEndTime: new Date(),
                tripNotes,
                fuelRefill: !!fuelRefill,
                fuelPrice: parseFloat(fuelPrice) || 0,
                status: 'COMPLETED'
            }
        });

        // Sync odometer vehicle
        await prisma.vehicle.update({
            where: { id: booking.vehicleId },
            data: { odometer: parseInt(endKm) }
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 5. Get Bookings (Dynamic based on tabs)
exports.getBookings = async (req, res) => {
    try {
        const { tab, vehicleId } = req.query;
        const where = {};

        if (vehicleId) where.vehicleId = parseInt(vehicleId);

        if (tab === 'PENDING') {
            where.status = 'PENDING';
        } else if (tab === 'APPROVED') {
            where.status = 'APPROVED';
        } else if (tab === 'MY_REQUESTS') {
            where.userId = req.user.id;
            where.status = { in: ['PENDING', 'APPROVED'] };
        } else if (tab === 'HISTORY') {
            where.status = { in: ['COMPLETED', 'REJECTED', 'CANCELLED'] };
        }

        const bookings = await prisma.vehicleBooking.findMany({
            where,
            include: {
                user: { select: { name: true, unitId: true, unit: { select: { name: true } } } },
                vehicle: { select: { name: true, plateNumber: true, type: true } },
                driver: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 6. Cancel Booking
exports.cancelBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const booking = await prisma.vehicleBooking.findUnique({ where: { id: parseInt(id) } });

        if (!booking) return res.status(404).json({ error: 'Booking tidak ditemukan' });
        if (booking.userId !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Akses ditolak' });
        }

        const updated = await prisma.vehicleBooking.update({
            where: { id: parseInt(id) },
            data: { status: 'CANCELLED' }
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
