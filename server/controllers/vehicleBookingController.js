const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendMessage } = require('../services/whatsappService');
const { createNotification } = require('./notificationController');

// Helper for WA date formatting
const formatWAWaktu = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year} ${hh}.${mm}`;
};

// Helper for Overlap Detection
const findOverlappingBooking = async (vehicleId, start, end, excludeId = null) => {
    return await prisma.vehicleBooking.findFirst({
        where: {
            vehicleId: parseInt(vehicleId),
            id: excludeId ? { not: parseInt(excludeId) } : undefined,
            status: { in: ['APPROVED', 'BERLANGSUNG'] },
            OR: [
                // Standard overlapping logic: (Start1 < End2) AND (Start2 < End1)
                {
                    startDate: { lt: end },
                    endDate: { gt: start }
                }
            ]
        },
        include: { user: { select: { name: true } } }
    });
};

// 1. Request Booking
exports.requestBooking = async (req, res) => {
    try {
        const { vehicleId, startDate, endDate, destination, purpose, passengerCount, driverId, isRented, rentalPrice, renterPhone, startKm } = req.body;
        const userId = req.user.id;

        // Fetch User to check phone
        const currentUser = await prisma.user.findUnique({ where: { id: userId } });
        if (renterPhone && (!currentUser.phone || currentUser.phone.trim() === '')) {
            await prisma.user.update({
                where: { id: userId },
                data: { phone: renterPhone }
            });
        }

        const vehicle = await prisma.vehicle.findUnique({
            where: { id: parseInt(vehicleId) },
            include: { pics: true }
        });

        if (!vehicle) return res.status(404).json({ error: 'Kendaraan tidak ditemukan' });

        const start = new Date(startDate);
        const end = new Date(endDate);
        const now = new Date();

        // 1. Check for strict overlaps with APPROVED or BERLANGSUNG bookings
        const conflict = await findOverlappingBooking(vehicleId, start, end);
        if (conflict) {
            return res.status(400).json({
                error: `Jadwal bentrok! Kendaraan sudah dipesan oleh ${conflict.user.name} pada: ${formatWAWaktu(conflict.startDate)} - ${formatWAWaktu(conflict.endDate)}.`
            });
        }

        // 2. Fallback check for any active trip in progress (status BERLANGSUNG)
        const activeTrip = await prisma.vehicleBooking.findFirst({
            where: {
                vehicleId: parseInt(vehicleId),
                status: 'BERLANGSUNG'
            }
        });

        if (activeTrip && activeTrip.id !== conflict?.id) {
            return res.status(400).json({ error: 'Kendaraan sedang digunakan dalam perjalanan. Silakan pilih armada lain atau tunggu hingga selesai.' });
        }

        if (!destination) {
            return res.status(400).json({ error: 'Tujuan wajib diisi.' });
        }

        if (start < now && !vehicle.type?.toLowerCase().includes('motor')) {
            // For general vehicles, we don't allow past starts
            // For motors, we might allow it if they start immediately
            return res.status(400).json({ error: 'Waktu mulai peminjaman tidak boleh di masa lampau.' });
        }

        if (end <= start) {
            return res.status(400).json({ error: 'Waktu selesai harus setelah waktu mulai.' });
        }

        const isPIC = vehicle.pics.some(p => p.id === userId);
        const isKabidSarpras = currentUser.position === 'Kepala Bidang Sarana dan Prasarana';

        // Special Roles: Yayasan Leadership (Auto-Approval)
        const yayasanPositions = ['Ketua Yayasan', 'Bendahara Yayasan', 'Sekretaris Yayasan'];
        const isYayasan = yayasanPositions.includes(currentUser.position);

        // Logic for Motorcycle Auto-Approval and Optional immediate Start
        let initialStatus = (isPIC || isYayasan || isKabidSarpras) ? 'APPROVED' : 'PENDING';
        let tripStartTime = null;
        let finalStartKm = null;

        const isMotor = vehicle.type?.toLowerCase().includes('motor');
        if (isMotor) {
            if (startKm) {
                const inputKm = parseInt(startKm);
                if (isNaN(inputKm)) return res.status(400).json({ error: 'KM Awal harus angka.' });
                if (inputKm < (vehicle.odometer || 0)) {
                    return res.status(400).json({ error: `KM Awal (${inputKm}) tidak boleh lebih kecil dari odometer (${vehicle.odometer || 0}).` });
                }

                // Discrepancy Notification for Motorcycle Auto-Start (> 1 km)
                const currentOdometer = vehicle.odometer || 0;
                if (inputKm - currentOdometer > 1) {
                    const diff = inputKm - currentOdometer;
                    const discMsg = `⚠️ *PERINGATAN DISKREPANSI ODOMETER (MOTOR)*\n\n` +
                        `Terdapat selisih kilometer saat peminjaman motor dimulai:\n` +
                        `Armada: *${vehicle.name} (${vehicle.plateNumber})*\n` +
                        `Pengguna: ${currentUser.name}\n` +
                        `KM Terakhir Sistem: ${currentOdometer}\n` +
                        `KM Awal Input: ${inputKm}\n` +
                        `Selisih: *${diff} KM*\n\n` +
                        `_Mohon tindak lanjuti jika terdapat indikasi penggunaan motor di luar sistem._`;

                    const recipients = await prisma.user.findMany({
                        where: {
                            OR: [
                                { position: { contains: 'Kepala Bidang Sarana dan Prasarana' } },
                                { position: { contains: 'Staff Kendaraan' } }
                            ],
                            AND: [{ phone: { not: null } }, { NOT: { phone: '' } }, { NOT: { phone: '08' } }]
                        }
                    });

                    const recipientIds = new Set(recipients.map(r => r.id));
                    const picRecipients = (vehicle.pics || []).filter(p => !recipientIds.has(p.id) && p.phone);
                    const allRecipients = [...recipients, ...picRecipients];

                    for (const person of allRecipients) {
                        try {
                            if (person.phone) await sendMessage(person.phone, discMsg);
                            await createNotification(
                                person.id,
                                'Peringatan Diskrepansi Odometer',
                                `Selisih ${diff} KM pada motor ${vehicle.name} (${vehicle.plateNumber}) oleh ${currentUser.name}.`,
                                'WARNING',
                                '/kendaraan/laporan'
                            );
                        } catch (err) {
                            console.error(`Failed to notify ${person.name || 'PIC'}:`, err.message);
                        }
                    }
                }

                initialStatus = 'BERLANGSUNG';
                tripStartTime = new Date();
                finalStartKm = inputKm;
            } else {
                initialStatus = 'APPROVED';
            }
        }

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
                status: initialStatus,
                startKm: finalStartKm,
                tripStartTime,
                isRented: isRented === true || isRented === 'true',
                rentalPrice: rentalPrice ? parseFloat(rentalPrice) : null
            },
            include: {
                user: { select: { name: true, phone: true, position: true } },
                vehicle: { select: { id: true, name: true, plateNumber: true, type: true, pics: true } },
                driver: { select: { name: true } }
            }
        });

        const isRental = booking.isRented;
        const termHeader = isRental ? 'SEWA' : 'PINJAM';
        const termAction = isRental ? 'penyewaan' : 'peminjaman';
        const termTitle = isRental ? 'Sewa' : 'Pinjam';

        // Notify ALL PICs via WhatsApp
        if (vehicle.pics && vehicle.pics.length > 0) {
            const startStr = formatWAWaktu(startDate);
            const endStr = formatWAWaktu(endDate);
            const driverName = booking.driver?.name || (booking.driverId ? 'Driver Terpilih' : 'Tanpa Driver / Lepas Kunci');

            let msgHeader = `🚗 *PERMINTAAN ${termHeader} KENDARAAN*`;
            if (isMotor) {
                msgHeader = `🏍️ *PENGGUNAAN MOTOR (AUTO-APPROVED)*`;
            } else if (isYayasan) {
                msgHeader = `👑 *PEMBERITAHUAN PENGGUNAAN KENDARAAN (PIMPINAN)*`;
            } else if (isPIC) {
                msgHeader = `🚗 *LAPORAN PENGGUNAAN KENDARAAN (PIC)*`;
            }

            let statusText = `Mohon tinjau di sistem untuk persetujuan.`;
            if (initialStatus === 'APPROVED') statusText = `*Status*: Otomatis Disetujui (${isMotor ? 'Sistem' : (isYayasan ? 'Yayasan' : 'PIC')})`;
            if (initialStatus === 'BERLANGSUNG') statusText = `*Status*: BERLANGSUNG (Perjalanan sudah dimulai)`;

            let msg = `${msgHeader}\n\n` +
                `Pemohon: ${booking.user.name}\n` +
                `Armada: ${vehicle.name} (${vehicle.plateNumber})\n` +
                `Driver: ${driverName}\n` +
                `Jadwal: ${startStr} - ${endStr}\n` +
                `Tujuan: ${destination}\n` +
                `Keperluan: ${purpose}\n\n` +
                statusText;

            if (initialStatus === 'PENDING') {
                const domainUrl = process.env.VITE_API_URL ? process.env.VITE_API_URL.replace('/api', '') : 'https://sarpras.dareliman.or.id';
                const routeStr = isRental ? 'sewa' : 'peminjaman';
                msg += `\n\n🔗 *Tinjau & Setujui di sini:*\n${domainUrl}/kendaraan/${routeStr}`;
            }

            for (const pic of vehicle.pics) {
                if (pic.phone) {
                    await sendMessage(pic.phone, msg);
                }
                // Add System Notification for PICs
                await createNotification(
                    pic.id,
                    (isMotor || isYayasan) ? 'Penggunaan Kendaraan' : `Permintaan ${termTitle} Kendaraan`,
                    (isMotor || isYayasan)
                        ? `${booking.user.name} menggunakan ${vehicle.name}.`
                        : `${booking.user.name} mengajukan ${termAction} ${vehicle.name}.`,
                    (isMotor || isYayasan) ? 'URGENT' : 'INFO',
                    isRental ? '/kendaraan/sewa' : '/kendaraan/peminjaman'
                );
            }
        }

        // Special Notification to Head of Sarpras for Yayasan usage
        if (isYayasan) {
            const headSarpras = await prisma.user.findFirst({
                where: { position: 'Kepala Bidang Sarana dan Prasarana' }
            });

            if (headSarpras && headSarpras.phone) {
                const startStr = formatWAWaktu(startDate);
                const endStr = formatWAWaktu(endDate);
                const msgHead = `📢 *INFO PRIORITAS PIMPINAN YAYASAN*\n\n` +
                    `Ustadz *${booking.user.name}* akan menggunakan kendaraan:\n\n` +
                    `Armada: ${vehicle.name} (${vehicle.plateNumber})\n` +
                    `Jadwal: ${startStr} - ${endStr}\n` +
                    `Tujuan: ${destination}\n\n` +
                    `*Status*: Sistem telah memberikan Persetujuan Otomatis.`;

                await sendMessage(headSarpras.phone, msgHead);
                await createNotification(
                    headSarpras.id,
                    'Prioritas Pimpinan Yayasan',
                    `${booking.user.name} menggunakan ${vehicle.name}.`,
                    'URGENT',
                    '/kendaraan/peminjaman'
                );
            }
        }

        // If Auto-Approved or Started, notify the requester too
        if ((initialStatus === 'APPROVED' || initialStatus === 'BERLANGSUNG') && booking.user.phone) {
            let msg = `📢 *KONFIRMASI ${isRental ? 'PENYEWAAN' : 'PEMINJAMAN'}*\n\n` +
                `Permintaan Anda untuk kendaraan *${vehicle.name}* telah *DISETUJUI OTOMATIS*\n\n`;

            if (initialStatus === 'BERLANGSUNG') {
                msg += `✅ Perjalanan Anda telah dimulai dengan KM Awal: ${finalStartKm}.\n\nJangan lupa selesaikan (End Trip) saat kembali.`;
            } else {
                msg += (isMotor ? `Silakan mulai perjalanan saat Anda berangkat.` : (isYayasan ? `Sistem mendeteksi posisi Anda sebagai ${booking.user.position}.` : `Sistem mendeteksi Anda sebagai PIC armada ini.`));
            }

            msg += `\n\nSelamat bertugas!`;
            await sendMessage(booking.user.phone, msg);
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
            include: {
                vehicle: { include: { pics: true } },
                user: true
            }
        });

        if (!booking) return res.status(404).json({ error: 'Booking tidak ditemukan' });

        const admin = await prisma.user.findUnique({ where: { id: req.user.id } });
        const adminName = admin?.name || req.user.username || 'Admin';

        // Check permission: Super Admin or one of the Vehicle PICs or Kabid Sarpras
        const isSuperAdmin = ['SUPER_ADMIN', 'BIDANG_IT'].includes(req.user.role);
        const isPIC = booking.vehicle.pics.some(p => p.id === req.user.id);
        const isKabidSarpras = admin?.position === 'Kepala Bidang Sarana dan Prasarana';

        if (!isSuperAdmin && !isPIC && !isKabidSarpras) {
            return res.status(403).json({ error: 'Akses ditolak. Anda bukan PIC resmi kendaraan ini.' });
        }

        // Check for overlaps before approving
        if (status === 'APPROVED') {
            const conflict = await findOverlappingBooking(booking.vehicleId, booking.startDate, booking.endDate, id);
            if (conflict) {
                return res.status(400).json({
                    error: `Gagal menyetujui! Sudah ada jadwal yang disetujui untuk ${conflict.user.name} pada jam tersebut.`
                });
            }
        }

        const updated = await prisma.vehicleBooking.update({
            where: { id: parseInt(id) },
            data: {
                status,
                adminNote
            }
        });

        // Notify User
        const isRental = booking.isRented;
        const termHeader = isRental ? 'PENYEWAAN' : 'PEMINJAMAN';
        const termAction = isRental ? 'Penyewaan' : 'Peminjaman';
        const termSmall = isRental ? 'sewa' : 'peminjaman';

        if (booking.user.phone) {
            let msg = '';
            if (status === 'APPROVED') {
                const startStr = formatWAWaktu(booking.startDate);
                const endStr = formatWAWaktu(booking.endDate);

                msg = `✅ *REQUEST ${termHeader} DISETUJUI*\n\n` +
                    `Armada: ${booking.vehicle.name} (${booking.vehicle.plateNumber})\n` +
                    `Waktu: ${startStr} - ${endStr}\n` +
                    `Tujuan: ${booking.destination}\n` +
                    `Disetujui oleh: ${adminName}\n\n` +
                    `Silakan mulai perjalanan melalui aplikasi SARPRAS saat akan memulai Perjalanan`;

                if (adminNote) msg += `\n\nCatatan: ${adminNote}`;
            } else {
                msg = `📢 *UPDATE STATUS ${termHeader}*\n\n` +
                    `Permintaan Anda untuk kendaraan *${booking.vehicle.name}* telah *DITOLAK ❌*.\n` +
                    (adminNote ? `Catatan: ${adminNote}` : '');
            }
            await sendMessage(booking.user.phone, msg);
        }

        // Add System Notification for User
        await createNotification(
            booking.userId,
            `${termAction} ${status === 'APPROVED' ? 'Disetujui' : 'Ditolak'}`,
            `Permintaan ${termSmall} kendaraan ${booking.vehicle.name} Anda telah ${status === 'APPROVED' ? 'disetujui' : 'ditolak'}.`,
            status === 'APPROVED' ? 'SUCCESS' : 'WARNING',
            isRental ? '/kendaraan/sewa' : '/kendaraan/peminjaman'
        );

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
            include: { vehicle: true, user: true }
        });

        if (!booking) return res.status(404).json({ error: 'Booking tidak ditemukan' });
        if (booking.userId !== req.user.id) return res.status(403).json({ error: 'Akses ditolak' });

        const currentOdometer = booking.vehicle.odometer || 0;
        const inputKm = parseInt(startKm);

        if (isNaN(inputKm)) {
            return res.status(400).json({ error: 'Kilometer awal harus berupa angka' });
        }

        // 1. Strict Validation: Cannot be lower than current odometer
        if (inputKm < currentOdometer) {
            return res.status(400).json({
                error: `KM Awal (${inputKm}) tidak boleh lebih kecil dari odometer kendaraan saat ini (${currentOdometer}).`
            });
        }

        // 2. Discrepancy Notification (> 1 km)
        if (inputKm - currentOdometer > 1) {
            const diff = inputKm - currentOdometer;
            const discMsg = `⚠️ *PERINGATAN DISKREPANSI ODOMETER*\n\n` +
                `Terdapat selisih kilometer saat mulai perjalanan:\n` +
                `Armada: *${booking.vehicle.name} (${booking.vehicle.plateNumber})*\n` +
                `Pengguna: ${booking.user.name}\n` +
                `KM Terakhir Sistem: ${currentOdometer}\n` +
                `KM Awal Input: ${inputKm}\n` +
                `Selisih: *${diff} KM*\n\n` +
                `_Mohon tindak lanjuti jika terdapat indikasi penggunaan armada di luar sistem._`;

            // A. Notify Kepala Bidang Sarpras & Staff Kendaraan & Vehicle PICs
            const recipients = await prisma.user.findMany({
                where: {
                    OR: [
                        { position: { contains: 'Kepala Bidang Sarana dan Prasarana' } }, // Matches "Kepala Bidang Sarana..."
                        { position: { contains: 'Staff Kendaraan' } } // Matches "Staff Kendaraan", "Staf Kendaraan", "Pengelola Kendaraan", etc.
                    ],
                    AND: [
                        { phone: { not: null } },
                        { NOT: { phone: '' } },
                        { NOT: { phone: '08' } }
                    ]
                }
            });

            // Also include Vehicle PICs that are not already in recipients
            const vehicleWithPics = await prisma.vehicle.findUnique({
                where: { id: booking.vehicleId },
                include: { pics: true }
            });
            const recipientIds = new Set(recipients.map(r => r.id));
            const picRecipients = (vehicleWithPics?.pics || []).filter(p => !recipientIds.has(p.id) && p.phone);
            const allRecipients = [...recipients, ...picRecipients];

            for (const person of allRecipients) {
                try {
                    if (person.phone) await sendMessage(person.phone, discMsg);
                    await createNotification(
                        person.id,
                        'Peringatan Diskrepansi Odometer',
                        `Selisih ${diff} KM pada ${booking.vehicle.name} (${booking.vehicle.plateNumber}) oleh ${booking.user.name}.`,
                        'WARNING',
                        '/kendaraan/laporan'
                    );
                } catch (err) {
                    console.error(`Failed to notify ${person.position || 'PIC'}:`, err.message);
                }
            }
        }

        const updated = await prisma.vehicleBooking.update({
            where: { id: parseInt(id) },
            data: {
                startKm: inputKm,
                tripStartTime: new Date(),
                status: 'BERLANGSUNG'
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
        const { endKm, tripNotes, fuelRefill, fuelPrice, fuelLiters, fuelCondition } = req.body;

        const booking = await prisma.vehicleBooking.findUnique({
            where: { id: parseInt(id) },
            include: { vehicle: true }
        });

        if (!booking) return res.status(404).json({ error: 'Booking tidak ditemukan' });
        if (booking.userId !== req.user.id) return res.status(403).json({ error: 'Akses ditolak' });

        const startKmValue = booking.startKm || 0;
        const endKmValue = parseInt(endKm);

        if (endKmValue < startKmValue) {
            return res.status(400).json({
                error: `KM Akhir (${endKmValue}) tidak boleh lebih kecil dari KM Awal (${startKmValue}).`
            });
        }

        const updated = await prisma.vehicleBooking.update({
            where: { id: parseInt(id) },
            data: {
                endKm: parseInt(endKm),
                tripEndTime: new Date(),
                tripNotes,
                fuelRefill: !!fuelRefill,
                fuelPrice: parseFloat(fuelPrice) || 0,
                fuelLiters: fuelLiters ? parseFloat(fuelLiters) : null,
                fuelCondition: fuelCondition || null,
                status: 'COMPLETED'
            }
        });

        // Sync odometer & last fuel condition to vehicle
        await prisma.vehicle.update({
            where: { id: booking.vehicleId },
            data: {
                odometer: parseInt(endKm),
                ...(fuelCondition ? { lastFuelCondition: fuelCondition } : {})
            }
        });

        // Fuel Notification Logic
        if (fuelCondition === 'LOW' || fuelCondition === 'MEDIUM') {
            const vehicleInfo = await prisma.vehicle.findUnique({
                where: { id: booking.vehicleId },
                include: { bookings: { where: { id: parseInt(id) }, include: { user: true } } }
            });

            const staffRecipients = await prisma.user.findMany({
                where: {
                    position: { contains: 'Staff Kendaraan' },
                    AND: [
                        { phone: { not: null } },
                        { NOT: { phone: '' } },
                        { NOT: { phone: '08' } }
                    ]
                }
            });

            if (vehicleInfo && staffRecipients.length > 0) {
                const bookInfo = vehicleInfo.bookings[0];
                const notifLevel = fuelCondition === 'LOW' ? 'URGENT' : 'WARNING';
                const notifEmoji = fuelCondition === 'LOW' ? '🚨' : '⚠️';
                const conditionStr = fuelCondition === 'LOW' ? 'Kecil dari 1/4 (Sangat Minim)' : 'Antara 1/4 dan 1/2';

                const fuelMsg = `${notifEmoji} *LAPORAN KONDISI BBM ARMADA*\n\n` +
                    `Armada: *${vehicleInfo.name} (${vehicleInfo.plateNumber})*\n` +
                    `Pengguna Terakhir: ${bookInfo.user.name}\n` +
                    `Kondisi BBM saat ini: *${conditionStr}*\n\n` +
                    `Mohon agar Tim Staff Kendaraan segera menindaklanjuti untuk pengisian BBM armada agar siap digunakan untuk perjalanan selanjutnya.`;

                for (const staff of staffRecipients) {
                    try {
                        if (staff.phone) {
                            await sendMessage(staff.phone, fuelMsg);
                        }
                        await createNotification(
                            staff.id,
                            `Peringatan Kondisi BBM ${vehicleInfo.plateNumber}`,
                            `Kondisi BBM ${vehicleInfo.name} dilaporkan ${conditionStr} oleh pengemudi terakhir.`,
                            notifLevel,
                            '/kendaraan'
                        );
                    } catch (err) {
                        console.error('Failed to send fuel notification to Staff:', err.message);
                    }
                }
            }
        }

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 5. Get Bookings (Dynamic based on tabs)
exports.getBookings = async (req, res) => {
    try {
        const { tab, vehicleId, startDate, endDate, isRented } = req.query;
        const where = {};

        if (isRented === 'true') where.isRented = true;
        if (isRented === 'false') where.isRented = false;

        if (vehicleId) where.vehicleId = parseInt(vehicleId);

        const currentUser = await prisma.user.findUnique({
            where: { id: req.user.id }
        });

        const isSuperAdmin = ['SUPER_ADMIN', 'BIDANG_IT'].includes(req.user.role);
        const isAdminAset = req.user.role === 'ADMIN_ASET';
        const isKabidSarpras = currentUser?.position === 'Kepala Bidang Sarana dan Prasarana';
        const isNormalOrPIC = !isSuperAdmin && !isAdminAset && !isKabidSarpras;

        if (tab === 'PENDING' || tab === 'APPROVAL') {
            where.status = 'PENDING';
            if (isNormalOrPIC && tab === 'APPROVAL') {
                where.vehicle = { pics: { some: { id: req.user.id } } };
            }
        } else if (tab === 'APPROVED') {
            where.status = 'APPROVED';
        } else if (tab === 'CALENDAR') {
            where.status = { in: ['APPROVED', 'BERLANGSUNG', 'COMPLETED'] };
            // Add Date Range Filters for CALENDAR
            if (startDate || endDate) {
                // If it's for month calendar, we want any booking that intersects the month
                // Usually startDate is start of month, endDate is end of month
                // So: booking.startDate <= endDate AND booking.endDate >= startDate
                const conditions = [];
                if (startDate) {
                    const viewStart = new Date(startDate);
                    viewStart.setHours(0, 0, 0, 0);
                    // booking ends after view start
                    where.endDate = { ...where.endDate, gte: viewStart };
                }
                if (endDate) {
                    const viewEnd = new Date(endDate);
                    viewEnd.setHours(23, 59, 59, 999);
                    // booking starts before view end
                    where.startDate = { ...where.startDate, lte: viewEnd };
                }
            }
        } else if (tab === 'MY_REQUESTS') {
            where.userId = req.user.id;
            // No status filter = get all user request history
        } else if (tab === 'MY_HISTORY') {
            where.userId = req.user.id;
            where.status = { in: ['COMPLETED', 'REJECTED', 'CANCELLED'] };
        } else if (tab === 'HISTORY') {
            if (isNormalOrPIC) {
                where.vehicle = { pics: { some: { id: req.user.id } } };
            }
            // Add Date Range Filters for History
            if (startDate || endDate) {
                where.startDate = {};
                if (startDate) {
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    where.startDate.gte = start;
                }
                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    where.startDate.lte = end;
                }
            }
        }

        let orderBy = { createdAt: 'desc' }; // Default: Newest request first
        if (tab === 'HISTORY' || tab === 'MY_REQUESTS' || tab === 'MY_HISTORY') {
            orderBy = { startDate: 'desc' }; // User wants newest event first
        }

        const bookings = await prisma.vehicleBooking.findMany({
            where,
            include: {
                user: { select: { name: true, unitId: true, unit: { select: { name: true } } } },
                vehicle: { select: { name: true, plateNumber: true, type: true, odometer: true } },
                driver: { select: { name: true } }
            },
            orderBy: [orderBy, { id: 'desc' }]
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
            data: { status: 'CANCELLED' },
            include: { vehicle: true }
        });

        // Notify PICs about cancellation
        for (const pic of updated.vehicle.pics || []) {
            await createNotification(
                pic.id,
                'Peminjaman Kendaraan Dibatalkan',
                `User ${req.user.name} membatalkan peminjaman ${updated.vehicle.name}.`,
                'INFO',
                '/kendaraan/peminjaman'
            );
        }

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 7. Automated Check for Overdue Trips (Used by Scheduler)
exports.checkOverdueVehicleBookings = async () => {
    console.log(`[${new Date().toLocaleString()}] [Job] Checking for overdue vehicle trips...`);
    try {
        const now = new Date();

        // Find bookings that are BERLANGSUNG but passed endDate
        // status BERLANGSUNG means it's currently in progress
        // We check if tripEndTime is null and endDate is in the past
        const overdueBookings = await prisma.vehicleBooking.findMany({
            where: {
                status: { in: ['BERLANGSUNG'] },
                endDate: { lt: now },
                tripEndTime: null
            },
            include: {
                user: true,
                vehicle: true
            }
        });

        if (overdueBookings.length === 0) {
            console.log('[Job] No overdue vehicle trips found.');
            return;
        }

        console.log(`[Job] Found ${overdueBookings.length} overdue trips. Sending reminders...`);

        // Fetch Staff Kendaraan recipients once
        const staffRecipients = await prisma.user.findMany({
            where: {
                position: { contains: 'Staff Kendaraan' },
                AND: [
                    { phone: { not: null } },
                    { NOT: { phone: '' } },
                    { NOT: { phone: '08' } }
                ]
            }
        });

        for (const booking of overdueBookings) {
            const diffMs = now - new Date(booking.endDate);
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

            // 1. Notifikasi Sistem (Lonceng) ke Peminjam
            await createNotification(
                booking.userId,
                'Pengingat: Selesaikan Perjalanan',
                `Perjalanan dengan ${booking.vehicle.name} ke ${booking.destination} seharusnya selesai pada ${new Date(booking.endDate).toLocaleString('id-ID')}.`,
                'WARNING',
                '/kendaraan/peminjaman'
            );

            // 2. Notifikasi WhatsApp ke Peminjam
            if (booking.user.phone) {
                const waMsg = `⏰ *PENGINGAT PENYELESAIAN PERJALANAN*\n\n` +
                    `Armada: ${booking.vehicle.name} (${booking.vehicle.plateNumber})\n` +
                    `Destinasi: ${booking.destination}\n` +
                    `Waktu Seharusnya Selesai: ${new Date(booking.endDate).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}\n` +
                    `Sudah Lewat: *${diffHours} jam*\n\n` +
                    `Apakah perjalanan Anda sudah selesai?\n\n` +
                    `⚠️ Mohon segera selesaikan perjalanan melalui aplikasi Sarpras dengan menginputkan Kilometer Akhir agar armada dapat digunakan oleh pengguna lain.\n\n` +
                    `Terima kasih.`;

                await sendMessage(booking.user.phone, waMsg);
            }

            // 3. Notifikasi WhatsApp ke Staff Kendaraan
            if (staffRecipients.length > 0) {
                const cleanPhone = booking.user.phone ? booking.user.phone.replace(/\D/g, '').replace(/^0/, '62') : null;
                const waLink = cleanPhone ? `https://wa.me/${cleanPhone}` : null;

                const waStaffMsg = `⚠️ *PERINGATAN KETERLAMBATAN PENGEMBALIAN ARMADA*\n\n` +
                    `Armada: *${booking.vehicle.name} (${booking.vehicle.plateNumber})*\n` +
                    `Peminjam: ${booking.user.name}\n` +
                    (waLink ? `WA Peminjam: ${waLink}\n` : `No. HP Peminjam: ${booking.user.phone || '-'}\n`) +
                    `Tujuan: ${booking.destination}\n` +
                    `Batas Waktu: ${new Date(booking.endDate).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}\n` +
                    `Keterlambatan: *${diffHours} jam*\n\n` +
                    `Peminjam melewati batas waktu peminjaman namun belum menekan tombol [Akhiri Perjalanan] di sistem.\n\n` +
                    `Mohon untuk segera menindaklanjuti atau menghubungi peminjam yang bersangkutan.`;

                for (const staff of staffRecipients) {
                    try {
                        if (staff.phone) {
                            await sendMessage(staff.phone, waStaffMsg);
                        }
                    } catch (err) {
                        console.error('Failed to notify staff about overdue trip:', err.message);
                    }
                }
            }
        }
    } catch (error) {
        console.error('[Job Error] checkOverdueVehicleBookings failed:', error);
    }
};

// 8. Pengecekan Otomatis untuk Pengingat Mulai Perjalanan (Dijalankan oleh Penjadwal)
exports.checkUpcomingVehicleBookings = async () => {
    console.log(`[${new Date().toLocaleString()}] [Job] Memeriksa Peminjaman Kendaraan (Pengingat Terus-Menerus)...`);
    try {
        const now = new Date();
        const thirtyMinsLater = new Date(now.getTime() + 30 * 60 * 1000);
        const fifteenMinsLater = new Date(now.getTime() + 15 * 60 * 1000);

        // 1. PENGINGAT DINI (ADVANCE): Perjalanan yang akan dimulai dalam ~30 menit
        // Ini akan memicu ketika waktu saat ini adalah 30 menit sebelum jadwal keberangkatan
        const advanceBookings = await prisma.vehicleBooking.findMany({
            where: {
                status: 'APPROVED',
                startDate: { gte: now, lte: thirtyMinsLater },
                tripStartTime: null
            },
            include: { user: true, vehicle: true }
        });

        for (const booking of advanceBookings) {
            const diffMs = new Date(booking.startDate) - now;
            const diffMins = Math.round(diffMs / (1000 * 60));

            // Hanya kirim notifikasi jika berada dalam rentang waktu agar hanya dikirim sekali pada H-30 menit
            if (diffMins >= 15 && diffMins <= 30) {
                await createNotification(
                    booking.userId,
                    '📢 Pengingat: Perjalanan Segera Dimulai',
                    `Armada ${booking.vehicle.name} Anda dijadwalkan berangkat dalam ${diffMins} menit lagi.`,
                    'INFO',
                    '/kendaraan/peminjaman'
                );

                if (booking.user.phone) {
                    const msg = `🔔 *PENGINGAT KEBERANGKATAN KENDARAAN*\n\n` +
                        `Bismillah Ustadz ${booking.user.name},\n\n` +
                        `🚗 *Armada*: ${booking.vehicle.name} (${booking.vehicle.plateNumber})\n` +
                        `📍 *Tujuan*: ${booking.destination}\n` +
                        `📅 *Jadwal*: ${formatWAWaktu(booking.startDate)}\n\n` +
                        `Keberangkatan dijadwalkan dalam *${diffMins} menit lagi*. Mohon bersiap.\n\n` +
                        `_Syukron Jazakumullah Khairan._`;
                    await sendMessage(booking.user.phone, msg);
                }
            }
        }

        // 2. PENGINGAT LUPA MEMULAI (TERUS-MENERUS): Perjalanan yang jadwalnya sudah lewat
        // Tidak ada batasan jendela waktu di sini (akan dikirim setiap 30 menit selama status masih APPROVED)
        const lateBookings = await prisma.vehicleBooking.findMany({
            where: {
                status: 'APPROVED',
                startDate: { lte: now },
                tripStartTime: null
            },
            include: { user: true, vehicle: true }
        });

        for (const booking of lateBookings) {
            const diffMs = now - new Date(booking.startDate);
            const diffMins = Math.floor(diffMs / (1000 * 60));

            // Notifikasi Sistem (Lonceng)
            await createNotification(
                booking.userId,
                '⚠️ Pengingat: Segera Mulai Perjalanan',
                `Jadwal armada ${booking.vehicle.name} Anda sudah dimulai pada ${formatWAWaktu(booking.startDate)}. Mohon segera klik 'Mulai Perjalanan'.`,
                'WARNING',
                '/kendaraan/peminjaman'
            );

            // Notifikasi WhatsApp
            if (booking.user.phone) {
                const msg = `🚗 *PENGINGAT MEMULAI PERJALANAN*\n\n` +
                    `📦 *Status*: TELAT MEMULAI\n` +
                    `Armada: ${booking.vehicle.name} (${booking.vehicle.plateNumber})\n` +
                    `Jadwal Keberangkatan: ${formatWAWaktu(booking.startDate)}\n` +
                    `Keterlambatan: *${diffMins} menit*\n\n` +
                    `⚠️ Mohon segera input *KM AWAL* di aplikasi SARPRAS jika Anda sudah mulai menggunakan armada.\n\n` +
                    `_Notifikasi ini akan dikirim setiap 30 menit sampai perjalanan dimulai._`;
                await sendMessage(booking.user.phone, msg);
            }
        }
    } catch (error) {
        console.error('[Job Error] checkUpcomingVehicleBookings failed:', error);
    }
};
