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

        if (currentUser.isSanctioned) {
            return res.status(403).json({ error: 'Akun Anda sedang disanksi dan tidak dapat melakukan peminjaman. Silakan ajukan pencabutan sanksi pada menu Pelanggaran User.' });
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
        const currentUserPosition = (currentUser?.position || '').toLowerCase();
        const isKabidSarpras = currentUser.role === 'KABID_SARPRAS' || currentUserPosition.includes('kepala bidang sarana') || currentUserPosition.includes('kabid sarpras');

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
                                { position: { contains: 'Kepala Bidang Sarana' } },
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
                driver: { select: { name: true, phone: true } }
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
                `Pemohon: ${booking.user.name} (${booking.user.phone || '-'})\n` +
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

        // Notify WA Rule Engine
        const { triggerWaNotification } = require('../services/whatsappService');
        await triggerWaNotification('NEW_VEHICLE_BOOKING', {
            NAMA_PEMINJAM: booking.user.name,
            KENDARAAN: vehicle.name,
            PLAT: vehicle.plateNumber,
            TUJUAN: destination,
            KEPERLUAN: purpose,
            START: formatWAWaktu(startDate),
            END: formatWAWaktu(endDate)
        });

        // Special Notification to Head of Sarpras for Yayasan usage
        if (isYayasan) {
            const headSarpras = await prisma.user.findFirst({
                where: { position: 'Kepala Bidang Sarana' }
            });

            if (headSarpras && headSarpras.phone) {
                const startStr = formatWAWaktu(startDate);
                const endStr = formatWAWaktu(endDate);
                const msgHead = `📢 *INFO PRIORITAS PIMPINAN YAYASAN*\n\n` +
                    `Ustadz *${booking.user.name}* (${booking.user.phone || '-'}) akan menggunakan kendaraan:\n\n` +
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

        // Notify Driver if Auto-Approved/Started and driver is different from requester
        if ((initialStatus === 'APPROVED' || initialStatus === 'BERLANGSUNG') && booking.driverId && booking.driverId !== booking.userId && booking.driver?.phone) {
            const startStr = formatWAWaktu(startDate);
            const endStr = formatWAWaktu(endDate);
            const driverMsg = `📢 *TUGAS PERJALANAN (DISETUJUI OTOMATIS)*\n\n` +
                `Halo *${booking.driver.name}*, Anda telah ditunjuk sebagai pengemudi untuk perjalanan berikut:\n` +
                `Pemohon: ${booking.user.name}\n` +
                `Armada: ${vehicle.name} (${vehicle.plateNumber})\n` +
                `Waktu: ${startStr} - ${endStr}\n` +
                `Tujuan: ${destination}\n\n` +
                `*Pesan ini berlaku sebagai bukti sah untuk pengambilan kunci armada kepada PIC/Admin Sarpras.*\nSelamat bertugas dan hati-hati di jalan!`;
            
            await sendMessage(booking.driver.phone, driverMsg);

            await createNotification(
                booking.driverId,
                'Tugas Perjalanan Baru',
                `Anda ditugaskan sebagai pengemudi untuk perjalanan ${booking.user.name} menggunakan ${vehicle.name}.`,
                'INFO',
                isRental ? '/kendaraan/sewa' : '/kendaraan/peminjaman'
            );
        }

        if (req.io) req.io.emit('booking_update');
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
                user: true,
                driver: true
            }
        });

        if (!booking) return res.status(404).json({ error: 'Booking tidak ditemukan' });

        const admin = await prisma.user.findUnique({ where: { id: req.user.id } });
        const adminName = admin?.name || req.user.username || 'Admin';

        const isSuperAdmin = ['SUPER_ADMIN', 'BIDANG_IT'].includes(req.user.role);
        const isPIC = booking.vehicle.pics.some(p => p.id === req.user.id);
        const adminPosition = (admin?.position || '').toLowerCase();
        const isKabidSarpras = req.user.role === 'KABID_SARPRAS' || adminPosition.includes('kepala bidang sarana') || adminPosition.includes('kabid sarpras');
        const isAdminAset = req.user.role === 'ADMIN_ASET';

        if (!isSuperAdmin && !isPIC && !isKabidSarpras && !isAdminAset) {
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
                    `Silakan mulai perjalanan melalui aplikasi SARPRAS saat akan memulai Perjalanan:\n` +
                    `🔗 ${process.env.VITE_API_URL ? process.env.VITE_API_URL.replace('/api', '') : 'https://sarpras.dareliman.or.id'}/kendaraan/${termSmall}`;

                if (adminNote) msg += `\n\nCatatan: ${adminNote}`;
            } else {
                msg = `📢 *UPDATE STATUS ${termHeader}*\n\n` +
                    `Permintaan Anda untuk kendaraan *${booking.vehicle.name}* telah *DITOLAK ❌*.\n` +
                    (adminNote ? `Catatan: ${adminNote}` : '');
            }
            await sendMessage(booking.user.phone, msg);
        }

        // Notify Driver if status is APPROVED and driver is different from user
        if (status === 'APPROVED' && booking.driverId && booking.driverId !== booking.userId && booking.driver?.phone) {
            const startStr = formatWAWaktu(booking.startDate);
            const endStr = formatWAWaktu(booking.endDate);
            const driverMsg = `📢 *TUGAS PERJALANAN (DISETUJUI)*\n\n` +
                `Halo *${booking.driver.name}*, Anda telah ditunjuk sebagai pengemudi untuk perjalanan berikut:\n` +
                `Pemohon: ${booking.user.name}\n` +
                `Armada: ${booking.vehicle.name} (${booking.vehicle.plateNumber})\n` +
                `Waktu: ${startStr} - ${endStr}\n` +
                `Tujuan: ${booking.destination}\n\n` +
                `*Pesan ini berlaku sebagai bukti sah untuk pengambilan kunci armada kepada PIC/Admin Sarpras.*\nSelamat bertugas dan hati-hati di jalan!`;
            
            await sendMessage(booking.driver.phone, driverMsg);

            await createNotification(
                booking.driverId,
                'Tugas Perjalanan Baru',
                `Anda ditugaskan sebagai pengemudi untuk perjalanan ${booking.user.name} menggunakan ${booking.vehicle.name}.`,
                'INFO',
                isRental ? '/kendaraan/sewa' : '/kendaraan/peminjaman'
            );
        }

        // Add System Notification for User
        await createNotification(
            booking.userId,
            `${termAction} ${status === 'APPROVED' ? 'Disetujui' : 'Ditolak'}`,
            `Permintaan ${termSmall} kendaraan ${booking.vehicle.name} Anda telah ${status === 'APPROVED' ? 'disetujui' : 'ditolak'}.`,
            status === 'APPROVED' ? 'SUCCESS' : 'WARNING',
            isRental ? '/kendaraan/sewa' : '/kendaraan/peminjaman'
        );

        // Notify WA Rule Engine
        const { triggerWaNotification } = require('../services/whatsappService');
        await triggerWaNotification('VEHICLE_BOOKING_STATUS_CHANGED', {
            NAMA_PEMINJAM: booking.user.name,
            KENDARAAN: booking.vehicle.name,
            STATUS: status === 'APPROVED' ? 'Disetujui' : 'Ditolak',
            CATATAN: adminNote || '-'
        });

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
        const startPhotoUrl = req.fileUrl || null;

        const booking = await prisma.vehicleBooking.findUnique({
            where: { id: parseInt(id) },
            include: { vehicle: true, user: true }
        });

        if (!booking) return res.status(404).json({ error: 'Booking tidak ditemukan' });
        if (booking.userId !== req.user.id && booking.driverId !== req.user.id) return res.status(403).json({ error: 'Akses ditolak' });

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

        // 2. Discrepancy Validation & Mandatory Photo Check (> 1 km)
        const diff = inputKm - currentOdometer;
        if (diff > 1) {
            // Check if photo was uploaded for discrepancy
            if (!startPhotoUrl) {
                return res.status(400).json({
                    error: `Terdeteksi selisih Odometer sebesar ${diff} KM dari posisi terakhir (${currentOdometer} KM). Anda WAJIB mengambil/mengunggah foto Odometer awal sebagai bukti sebelum memulai perjalanan.`
                });
            }

            const discMsg = `⚠️ *PERINGATAN DISKREPANSI ODOMETER*\n\n` +
                `Terdapat selisih kilometer saat mulai perjalanan:\n` +
                `Armada: *${booking.vehicle.name} (${booking.vehicle.plateNumber})*\n` +
                `Pengguna: ${booking.user.name}\n` +
                `KM Terakhir Sistem: ${currentOdometer}\n` +
                `KM Awal Input: ${inputKm}\n` +
                `Selisih: *${diff} KM*\n` +
                `Foto Odometer Awal: ${startPhotoUrl}\n\n` +
                `_Mohon tindak lanjuti jika terdapat indikasi penggunaan armada di luar sistem._`;

            // A. Notify Kepala Bidang Sarpras & Staff Kendaraan & Vehicle PICs
            const recipients = await prisma.user.findMany({
                where: {
                    OR: [
                        { position: { contains: 'Kepala Bidang Sarana' } },
                        { position: { contains: 'Staff Kendaraan' } }
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
                        `Selisih ${diff} KM pada ${booking.vehicle.name} (${booking.vehicle.plateNumber}) oleh ${booking.user.name}. Foto bukti telah dilampirkan.`,
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
                startPhoto: startPhotoUrl,
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
        const { endKm, tripNotes, fuelRefill, fuelPrice, fuelLiters, fuelCondition, returnLocation, hasIncident, incidentNotes } = req.body;
        const photoUrl = req.fileUrl || null;
        const isIncident = hasIncident === true || hasIncident === 'true';

        const booking = await prisma.vehicleBooking.findUnique({
            where: { id: parseInt(id) },
            include: { vehicle: true, user: true }
        });

        if (!booking) return res.status(404).json({ error: 'Booking tidak ditemukan' });
        if (booking.userId !== req.user.id && booking.driverId !== req.user.id) return res.status(403).json({ error: 'Akses ditolak' });

        const startKmValue = booking.startKm || 0;
        const endKmValue = parseInt(endKm);

        if (endKmValue < startKmValue) {
            return res.status(400).json({
                error: `KM Akhir (${endKmValue}) tidak boleh lebih kecil dari KM Awal (${startKmValue}).`
            });
        }

        // Incident Validation: If incident reported, photo is mandatory!
        if (isIncident && !photoUrl) {
            return res.status(400).json({
                error: 'Wajib mengunggah foto bukti kejadian/kerusakan bila Anda melaporkan adanya insiden saat perjalanan.'
            });
        }

        let maintenanceId = null;
        if (isIncident) {
            // Auto-create incidental maintenance ticket
            const serviceLog = await prisma.vehicleService.create({
                data: {
                    vehicleId: booking.vehicleId,
                    date: new Date(),
                    category: 'INSIDENTAL',
                    type: 'PERBAIKAN_KERUSAKAN',
                    description: `[LAPORAN INSIDEN JALAN oleh ${booking.user.name}]: ${incidentNotes || 'Tidak ada deskripsi'}`,
                    cost: 0,
                    odometer: parseInt(endKm),
                    proofFile: photoUrl,
                    workshop: 'Perlu Penanganan Sarpras'
                }
            });
            maintenanceId = serviceLog.id;

            // Notify Sarpras & Staff Kendaraan about incident
            const incidentRecipients = await prisma.user.findMany({
                where: {
                    OR: [
                        { position: { contains: 'Kepala Bidang Sarana' } },
                        { position: { contains: 'Staff Kendaraan' } }
                    ],
                    AND: [
                        { phone: { not: null } },
                        { NOT: { phone: '' } },
                        { NOT: { phone: '08' } }
                    ]
                }
            });

            const incidentMsg = `🚨 *LAPORAN INSIDEN / KERUSAKAN KENDARAAN*\n\n` +
                `Armada: *${booking.vehicle.name} (${booking.vehicle.plateNumber})*\n` +
                `Pengemudi: ${booking.user.name}\n` +
                `KM Akhir: ${endKm}\n` +
                `Deskripsi Insiden:\n"${incidentNotes || '-'}"\n\n` +
                `*Foto Bukti Kejadian:* ${photoUrl || '-'}\n\n` +
                `_Tiket Pemeliharaan Insidental otomatis dibuat di sistem untuk ditindaklanjuti Tim Sarpras._`;

            for (const person of incidentRecipients) {
                try {
                    if (person.phone) await sendMessage(person.phone, incidentMsg);
                    await createNotification(
                        person.id,
                        `Insiden Kendaraan ${booking.vehicle.plateNumber}`,
                        `Dilaporkan insiden pada ${booking.vehicle.name} oleh ${booking.user.name}. Tiket perbaikan telah dibuat.`,
                        'URGENT',
                        '/kendaraan/pemeliharaan'
                    );
                } catch (err) {
                    console.error('Failed to notify incident to staff:', err.message);
                }
            }
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
                returnLocation: returnLocation || null,
                hasIncident: isIncident,
                incidentPhoto: isIncident ? photoUrl : null,
                incidentNotes: isIncident ? incidentNotes : null,
                maintenanceId,
                status: 'COMPLETED'
            }
        });

        // Sync odometer, last fuel condition & last position to vehicle
        await prisma.vehicle.update({
            where: { id: booking.vehicleId },
            data: {
                odometer: parseInt(endKm),
                ...(fuelCondition ? { lastFuelCondition: fuelCondition } : {}),
                ...(returnLocation ? { lastPosition: returnLocation } : {})
            }
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// 4. Perpanjang Jadwal (Extend Trip)
exports.extendTrip = async (req, res) => {
    try {
        const { id } = req.params;
        const { newEndDate, extendReason } = req.body;

        if (!newEndDate || !extendReason) {
            return res.status(400).json({ error: 'Batas Waktu Baru dan Alasan Kendala wajib diisi.' });
        }

        const booking = await prisma.vehicleBooking.findUnique({
            where: { id: parseInt(id) },
            include: { vehicle: true, user: true }
        });

        if (!booking) return res.status(404).json({ error: 'Peminjaman tidak ditemukan.' });

        if (booking.status !== 'BERLANGSUNG') {
            return res.status(400).json({ error: 'Hanya perjalanan yang sedang BERLANGSUNG yang dapat diperpanjang.' });
        }

        // Only the requester, driver, or admins can extend
        const isAdmin = ['ADMIN_ASET', 'SUPER_ADMIN', 'BIDANG_IT'].includes(req.user.role) || req.user.position?.includes('Sarana');
        if (booking.userId !== req.user.id && booking.driverId !== req.user.id && !isAdmin) {
            return res.status(403).json({ error: 'Anda tidak memiliki akses untuk memperpanjang perjalanan ini.' });
        }

        const newEnd = new Date(newEndDate);
        if (newEnd <= new Date(booking.endDate)) {
            return res.status(400).json({ error: 'Waktu selesai baru harus lebih lama dari batas waktu sebelumnya.' });
        }

        // Tambah jeda 30 menit (Buffer Time) agar tidak dempet
        const bufferEnd = new Date(newEnd.getTime() + 30 * 60 * 1000); 

        const conflict = await prisma.vehicleBooking.findFirst({
            where: {
                vehicleId: booking.vehicleId,
                id: { not: booking.id },
                status: { in: ['APPROVED', 'PENDING', 'BERLANGSUNG'] },
                startDate: { lt: bufferEnd },
                endDate: { gt: booking.startDate } 
            },
            include: { user: { select: { name: true } } }
        });

        if (conflict) {
            return res.status(400).json({
                error: `Gagal memperpanjang. Jadwal bentrok/dempet dengan peminjaman oleh ${conflict.user.name} pada ${formatWAWaktu(conflict.startDate)}. Harus ada jeda minimal 30 menit.`
            });
        }

        // Update the booking
        const updated = await prisma.vehicleBooking.update({
            where: { id: booking.id },
            data: {
                endDate: newEnd,
                purpose: booking.purpose ? `${booking.purpose}\n\n[PERPANJANGAN: Problem di jalan]: ${extendReason}` : `[PERPANJANGAN: Problem di jalan]: ${extendReason}`
            }
        });

        // Notify Staff if necessary? Not required, just update.
        // We can send WA to user to confirm extension.
        if (booking.user.phone) {
            const msg = `✅ *PERPANJANGAN WAKTU BERHASIL*\n\n` +
                `Jadwal pengembalian armada ${booking.vehicle.name} telah berhasil diperpanjang.\n` +
                `Batas Waktu Baru: *${formatWAWaktu(newEnd)}*\n\n` +
                `Semoga kendala Anda segera teratasi. Hati-hati di jalan!`;
            
            try {
                await sendMessage(booking.user.phone, msg);
            } catch(e) {}
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
        const currentUserPosition = (currentUser?.position || '').toLowerCase();
        const isKabidSarpras = req.user.role === 'KABID_SARPRAS' || currentUserPosition.includes('kepala bidang sarana') || currentUserPosition.includes('kabid sarpras');
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
            where.OR = [
                { userId: req.user.id },
                { driverId: req.user.id }
            ];
            // No status filter = get all user request history
        } else if (tab === 'MY_HISTORY') {
            where.OR = [
                { userId: req.user.id },
                { driverId: req.user.id }
            ];
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
        const { reason } = req.body;
        const booking = await prisma.vehicleBooking.findUnique({ 
            where: { id: parseInt(id) },
            include: { user: true }
        });

        if (!booking) return res.status(404).json({ error: 'Booking tidak ditemukan' });
        
        // Allow cancel if user is the requester or super admin
        if (booking.userId !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Akses ditolak' });
        }

        const updated = await prisma.vehicleBooking.update({
            where: { id: parseInt(id) },
            data: { 
                status: 'CANCELLED',
                adminNote: reason ? `Dibatalkan User: ${reason}` : 'Dibatalkan oleh User'
            },
            include: { vehicle: { include: { pics: true } } }
        });

        // Notify PICs about cancellation
        for (const pic of updated.vehicle.pics || []) {
            await createNotification(
                pic.id,
                'Peminjaman Kendaraan Dibatalkan',
                `User ${booking.user.name} membatalkan peminjaman ${updated.vehicle.name}${reason ? ' dengan alasan: ' + reason : ''}.`,
                'INFO',
                '/kendaraan/peminjaman'
            );
        }

        if (req.io) req.io.emit('booking_update');
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

        // Ambil daftar Staff Kendaraan untuk notifikasi jika ada pembekuan akun
        const staffRecipients = await prisma.user.findMany({
            where: {
                position: { contains: 'Staff Kendaraan' },
                AND: [{ phone: { not: null } }, { NOT: { phone: '' } }, { NOT: { phone: '08' } }]
            }
        });

        for (const booking of overdueBookings) {
            const diffMs = now - new Date(booking.endDate);
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

            // Increment warning count
            const updatedBooking = await prisma.vehicleBooking.update({
                where: { id: booking.id },
                data: { endWarningCount: { increment: 1 } }
            });

            if (updatedBooking.endWarningCount >= 10) {
                // Auto-complete trip and apply sanction
                await prisma.vehicleBooking.update({
                    where: { id: booking.id },
                    data: {
                        status: 'COMPLETED',
                        endKm: booking.startKm,
                        tripEndTime: new Date(),
                        tripNotes: 'Diselesaikan Otomatis Sistem: Tidak mengakhiri perjalanan setelah 10 kali peringatan',
                    }
                });

                await prisma.user.update({
                    where: { id: booking.userId },
                    data: { isSanctioned: true }
                });

                await prisma.driverViolation.create({
                    data: {
                        driverId: booking.userId,
                        date: new Date(),
                        category: "Sanksi Peminjaman",
                        description: `Diselesaikan otomatis karena tidak mengakhiri perjalanan setelah 10 kali peringatan (Armada: ${booking.vehicle.name}, Plat: ${booking.vehicle.plateNumber}).`,
                        sanction: "Akun Dibekukan"
                    }
                });

                await createNotification(
                    booking.userId,
                    'Sanksi Pelanggaran: Peminjaman Kendaraan',
                    `Akun Anda disanksi karena tidak mengakhiri perjalanan ${booking.vehicle.name} setelah 10 kali peringatan.`,
                    'URGENT',
                    '/kendaraan/peminjaman'
                );

                if (booking.user.phone) {
                    const sanctionMsg = `🚨 *PEMBERITAHUAN SANKSI PELANGGARAN* 🚨\n\n` +
                        `Bismillah Ustadz ${booking.user.name},\n\n` +
                        `Perjalanan Anda dengan armada *${booking.vehicle.name}* telah diselesaikan secara otomatis oleh sistem karena Anda mengabaikan 10 kali peringatan pengakhiran perjalanan.\n\n` +
                        `Sebagai sanksi, hak akses peminjaman kendaraan Anda *DIBEKUKAN*.\n\n` +
                        `Silakan ajukan pencabutan sanksi melalui menu *Pelanggaran User* di aplikasi SARPRAS.\n\n` +
                        `_Sistem Manajemen Aset_`;
                    await sendMessage(booking.user.phone, sanctionMsg);
                }

                // Notifikasi ke Staff Kendaraan tentang Pembekuan
                if (staffRecipients.length > 0) {
                    const waStaffMsg = `🚨 *LAPORAN SANKSI PEMBEKUAN AKUN* 🚨\n\n` +
                        `Terdapat pengguna yang baru saja *DIBEKUKAN* hak akses peminjaman kendaraannya oleh sistem karena mengabaikan 10 kali peringatan pengakhiran perjalanan.\n\n` +
                        `Peminjam: *${booking.user.name}*\n` +
                        `Armada: ${booking.vehicle.name} (${booking.vehicle.plateNumber})\n` +
                        `Tujuan: ${booking.destination}\n\n` +
                        `Mohon Tim Staff Kendaraan menindaklanjuti secara langsung kepada pengguna terkait untuk memastikan armada telah dikembalikan.`;

                    for (const staff of staffRecipients) {
                        try {
                            if (staff.phone) await sendMessage(staff.phone, waStaffMsg);
                        } catch (err) {
                            console.error('Failed to notify staff about sanction:', err.message);
                        }
                    }
                }
                continue;
            }

            // 1. Notifikasi Sistem (Lonceng) ke Peminjam
            await createNotification(
                booking.userId,
                'Pengingat: Selesaikan Perjalanan',
                `Perjalanan dengan ${booking.vehicle.name} ke ${booking.destination} seharusnya selesai pada ${new Date(booking.endDate).toLocaleString('id-ID')}. (Peringatan ke-${updatedBooking.endWarningCount})`,
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
                    `💡 _Tips: Jika Anda mengalami kendala di perjalanan (contoh: macet), Anda dapat menekan tombol *Perpanjang* di aplikasi agar jadwal Anda diperbarui._\n\n` +
                    `🔗 Akses menu peminjaman di sini:\n${process.env.VITE_API_URL ? process.env.VITE_API_URL.replace('/api', '') : 'https://sarpras.dareliman.or.id'}/kendaraan/peminjaman\n\n` +
                    `Terima kasih.`;

                await sendMessage(booking.user.phone, waMsg);
            }

            // 3. Notifikasi WhatsApp ke Staff Kendaraan (DIHAPUS SESUAI PERMINTAAN)
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
                        `🔗 Akses menu peminjaman di sini:\n${process.env.VITE_API_URL ? process.env.VITE_API_URL.replace('/api', '') : 'https://sarpras.dareliman.or.id'}/kendaraan/peminjaman\n\n` +
                        `_Syukron Jazakumullah Khairan._`;
                    await sendMessage(booking.user.phone, msg);
                }
            }
        }

        // 2. PENGINGAT LUPA MEMULAI (TERUS-MENERUS): Perjalanan yang jadwalnya sudah lewat
        // Tidak ada batasan jendela waktu di sini (akan dikirim setiap jam selama status masih APPROVED)
        const lateBookings = await prisma.vehicleBooking.findMany({
            where: {
                status: 'APPROVED',
                startDate: { lte: now },
                tripStartTime: null
            },
            include: { user: true, vehicle: true }
        });

        // Ambil daftar Staff Kendaraan untuk notifikasi pembekuan
        const staffRecipients = await prisma.user.findMany({
            where: {
                position: { contains: 'Staff Kendaraan' },
                AND: [{ phone: { not: null } }, { NOT: { phone: '' } }, { NOT: { phone: '08' } }]
            }
        });

        for (const booking of lateBookings) {
            const diffMs = now - new Date(booking.startDate);
            const diffMins = Math.floor(diffMs / (1000 * 60));

            // Increment warning count
            const updatedBooking = await prisma.vehicleBooking.update({
                where: { id: booking.id },
                data: { startWarningCount: { increment: 1 } }
            });

            if (updatedBooking.startWarningCount >= 10) {
                // Auto-cancel trip and apply sanction
                await prisma.vehicleBooking.update({
                    where: { id: booking.id },
                    data: {
                        status: 'CANCELLED',
                        adminNote: 'Dibatalkan Otomatis Sistem: Tidak memulai perjalanan setelah 10 kali peringatan'
                    }
                });

                await prisma.user.update({
                    where: { id: booking.userId },
                    data: { isSanctioned: true }
                });

                await prisma.driverViolation.create({
                    data: {
                        driverId: booking.userId,
                        date: new Date(),
                        category: "Sanksi Peminjaman",
                        description: `Dibatalkan otomatis karena tidak memulai perjalanan setelah 10 kali peringatan (Armada: ${booking.vehicle.name}, Plat: ${booking.vehicle.plateNumber}).`,
                        sanction: "Akun Dibekukan"
                    }
                });

                await createNotification(
                    booking.userId,
                    'Sanksi Pelanggaran: Peminjaman Kendaraan',
                    `Akun Anda disanksi karena tidak memulai perjalanan ${booking.vehicle.name} setelah 10 kali peringatan.`,
                    'URGENT',
                    '/kendaraan/peminjaman'
                );

                if (booking.user.phone) {
                    const sanctionMsg = `🚨 *PEMBERITAHUAN SANKSI PELANGGARAN* 🚨\n\n` +
                        `Bismillah Ustadz ${booking.user.name},\n\n` +
                        `Peminjaman armada *${booking.vehicle.name}* Anda telah dibatalkan secara otomatis oleh sistem karena Anda mengabaikan 10 kali peringatan memulai perjalanan.\n\n` +
                        `Sebagai sanksi, hak akses peminjaman kendaraan Anda *DIBEKUKAN*.\n\n` +
                        `Silakan ajukan pencabutan sanksi melalui menu *Pelanggaran User* di aplikasi SARPRAS.\n\n` +
                        `_Sistem Manajemen Aset_`;
                    await sendMessage(booking.user.phone, sanctionMsg);
                }

                // Notifikasi ke Staff Kendaraan tentang Pembekuan
                if (staffRecipients.length > 0) {
                    const waStaffMsg = `🚨 *LAPORAN SANKSI PEMBEKUAN AKUN* 🚨\n\n` +
                        `Terdapat pengguna yang baru saja *DIBEKUKAN* hak akses peminjaman kendaraannya oleh sistem karena mengabaikan 10 kali peringatan untuk memulai perjalanan.\n\n` +
                        `Peminjam: *${booking.user.name}*\n` +
                        `Armada: ${booking.vehicle.name} (${booking.vehicle.plateNumber})\n` +
                        `Tujuan: ${booking.destination}\n\n` +
                        `Tiket telah dibatalkan otomatis. Mohon Tim Staff Kendaraan memastikan armada siap digunakan oleh pengguna lain.`;

                    for (const staff of staffRecipients) {
                        try {
                            if (staff.phone) await sendMessage(staff.phone, waStaffMsg);
                        } catch (err) {
                            console.error('Failed to notify staff about sanction:', err.message);
                        }
                    }
                }
                continue;
            }

            // Notifikasi Sistem (Lonceng)
            await createNotification(
                booking.userId,
                '⚠️ Pengingat: Segera Mulai Perjalanan',
                `Jadwal armada ${booking.vehicle.name} Anda sudah dimulai pada ${formatWAWaktu(booking.startDate)}. Mohon segera klik 'Mulai Perjalanan'. (Peringatan ke-${updatedBooking.startWarningCount})`,
                'WARNING',
                '/kendaraan/peminjaman'
            );

            // Notifikasi WhatsApp ke Peminjam
            if (booking.user.phone) {
                const msg = `🚗 *PENGINGAT MEMULAI PERJALANAN*\n\n` +
                    `📦 *Status*: TELAT MEMULAI\n` +
                    `Armada: ${booking.vehicle.name} (${booking.vehicle.plateNumber})\n` +
                    `Jadwal Keberangkatan: ${formatWAWaktu(booking.startDate)}\n` +
                    `Keterlambatan: *${diffMins} menit*\n\n` +
                    `⚠️ Mohon segera input *KM AWAL* di aplikasi SARPRAS (pada *Sub menu Permohonan saya*) jika Anda sudah mulai menggunakan armada.\n\n` +
                    `🔗 Akses menu peminjaman di sini:\n${process.env.VITE_API_URL ? process.env.VITE_API_URL.replace('/api', '') : 'https://sarpras.dareliman.or.id'}/kendaraan/peminjaman\n\n` +
                    `_Notifikasi ini akan dikirim setiap 1 jam sampai perjalanan dimulai._`;
                await sendMessage(booking.user.phone, msg);
            }

            // Notifikasi WhatsApp ke Staff Kendaraan (DIHAPUS SESUAI PERMINTAAN)
        }
    } catch (error) {
        console.error('[Job Error] checkUpcomingVehicleBookings failed:', error);
    }
};

// 9. Update Booking History (Admin/Staff Only)
exports.updateBookingHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const { startKm, endKm, fuelLiters, fuelPrice, tripNotes, returnLocation } = req.body;

        const booking = await prisma.vehicleBooking.findUnique({
            where: { id: parseInt(id) },
            include: { vehicle: true }
        });

        if (!booking) return res.status(404).json({ error: 'Peminjaman tidak ditemukan' });

        // Check if user is Admin / SuperAdmin / KabidSarpras / Staff Kendaraan
        const isSuperAdmin = ['SUPER_ADMIN', 'BIDANG_IT'].includes(req.user.role);
        const isAdminAset = req.user.role === 'ADMIN_ASET';
        const isKabidSarpras = req.user.position === 'Kepala Bidang Sarana';
        const isStaffKendaraan = req.user.position?.toLowerCase().includes('staff kendaraan') || req.user.position === 'Staff Kendaraan';

        if (!isSuperAdmin && !isAdminAset && !isKabidSarpras && !isStaffKendaraan) {
            return res.status(403).json({ error: 'Akses ditolak. Anda tidak memiliki izin untuk mengedit riwayat.' });
        }

        const parsedStartKm = startKm !== undefined && startKm !== '' ? parseInt(startKm) : booking.startKm;
        const parsedEndKm = endKm !== undefined && endKm !== '' ? parseInt(endKm) : booking.endKm;

        if (parsedEndKm !== null && parsedStartKm !== null && parsedEndKm < parsedStartKm) {
            return res.status(400).json({ error: 'KM Akhir tidak boleh lebih kecil dari KM Awal.' });
        }

        const updated = await prisma.vehicleBooking.update({
            where: { id: parseInt(id) },
            data: {
                startKm: parsedStartKm,
                endKm: parsedEndKm,
                fuelLiters: fuelLiters !== undefined && fuelLiters !== '' ? parseFloat(fuelLiters) : null,
                fuelPrice: fuelPrice !== undefined && fuelPrice !== '' ? parseFloat(fuelPrice) : 0,
                tripNotes: tripNotes !== undefined ? tripNotes : booking.tripNotes,
                returnLocation: returnLocation !== undefined ? returnLocation : booking.returnLocation
            }
        });

        // Update vehicle odometer if endKm is higher than current odometer
        if (parsedEndKm && (!booking.vehicle.odometer || booking.vehicle.odometer < parsedEndKm)) {
            await prisma.vehicle.update({
                where: { id: booking.vehicleId },
                data: { odometer: parsedEndKm }
            });
        }

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// --- GPS Tracking ---
exports.updateBookingLocation = async (req, res) => {
    try {
        const { id } = req.params;
        const { latitude, longitude, speed } = req.body;
        
        const bookingId = parseInt(id);
        const booking = await prisma.vehicleBooking.findUnique({
            where: { id: bookingId }
        });

        if (!booking) return res.status(404).json({ error: 'Peminjaman tidak ditemukan' });

        const history = await prisma.vehicleLocationHistory.create({
            data: {
                bookingId,
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                speed: speed ? parseFloat(speed) : null
            }
        });

        await prisma.vehicle.update({
            where: { id: booking.vehicleId },
            data: {
                currentLat: parseFloat(latitude),
                currentLng: parseFloat(longitude),
                lastLocationUpdate: new Date()
            }
        });

        res.json(history);
    } catch (error) {
        console.error('Error updating location:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getBookingRoute = async (req, res) => {
    try {
        const { id } = req.params;
        const route = await prisma.vehicleLocationHistory.findMany({
            where: { bookingId: parseInt(id) },
            orderBy: { createdAt: 'asc' }
        });
        res.json(route);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getActiveTracking = async (req, res) => {
    try {
        const vehicles = await prisma.vehicle.findMany({
            where: { currentLat: { not: null }, currentLng: { not: null } },
            include: {
                bookings: {
                    where: { status: 'BERLANGSUNG' },
                    take: 1,
                    include: {
                        user: { select: { name: true, phone: true } },
                        driver: { select: { name: true, phone: true } }
                    }
                }
            }
        });

        const activeTrackingData = vehicles.map(v => {
            const activeBooking = v.bookings[0] || null;
            return {
                id: activeBooking ? activeBooking.id : `v-${v.id}`,
                status: activeBooking ? 'BERLANGSUNG' : 'IDLE',
                destination: activeBooking ? activeBooking.destination : 'Parkir/Standby',
                user: activeBooking ? activeBooking.user : null,
                driver: activeBooking ? activeBooking.driver : null,
                vehicle: {
                    id: v.id,
                    name: v.name,
                    plateNumber: v.plateNumber,
                    type: v.type,
                    currentLat: v.currentLat,
                    currentLng: v.currentLng,
                    lastLocationUpdate: v.lastLocationUpdate
                }
            };
        });

        res.json(activeTrackingData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getVehicleRouteHistory = async (req, res) => {
    try {
        const { date, bookingId, vehicleId } = req.query;

        // Base query
        const whereClause = {};

        if (bookingId) {
            whereClause.bookingId = parseInt(bookingId);
        } else if (vehicleId) {
            whereClause.booking = { vehicleId: parseInt(vehicleId) };
            
            // If date is provided, filter by that date
            if (date) {
                const targetDate = new Date(date);
                const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
                const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
                
                whereClause.createdAt = {
                    gte: startOfDay,
                    lte: endOfDay
                };
            } else {
                // Default to today if no date and no booking id specified
                const today = new Date();
                const startOfDay = new Date(today.setHours(0, 0, 0, 0));
                whereClause.createdAt = { gte: startOfDay };
            }
        } else {
            return res.status(400).json({ error: "Please provide bookingId or vehicleId" });
        }

        const history = await prisma.vehicleLocationHistory.findMany({
            where: whereClause,
            orderBy: { createdAt: 'asc' }
        });

        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
