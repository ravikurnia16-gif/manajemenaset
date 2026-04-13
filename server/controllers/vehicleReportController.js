const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.createWeeklyReport = async (req, res) => {
    const {
        vehicleId,
        weekStartDate,
        weekEndDate,
        startOdometer,
        endOdometer,
        conditionEngine,
        conditionBody,
        conditionInterior,
        isClean,
        notes
    } = req.body;

    const { id: userId, role } = req.user;

    try {
        const { vehicleId } = req.body;
        // PIC Validation
        if (!['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT'].includes(role)) {
            const vehicle = await prisma.vehicle.findUnique({
                where: { id: parseInt(vehicleId) },
                include: { pics: { select: { id: true } } }
            });
            const isPic = vehicle?.pics.some(p => p.id === userId);
            if (!isPic) return res.status(403).json({ error: 'Anda bukan PIC kendaraan ini.' });
        }

        const report = await prisma.vehicleWeeklyReport.create({
            data: {
                vehicleId: parseInt(vehicleId),
                userId,
                weekStartDate: new Date(req.body.weekStartDate),
                weekEndDate: new Date(req.body.weekEndDate),
                startOdometer: parseInt(req.body.startOdometer),
                endOdometer: parseInt(req.body.endOdometer),
                conditionEngine: req.body.conditionEngine,
                conditionBody: req.body.conditionBody,
                conditionInterior: req.body.conditionInterior,
                isClean: req.body.isClean,
                notes: req.body.notes
            }
        });

        // Update vehicle odometer to the latest endOdometer
        await prisma.vehicle.update({
            where: { id: parseInt(vehicleId) },
            data: { odometer: parseInt(endOdometer) }
        });

        res.json({ message: 'Laporan mingguan berhasil disimpan', data: report });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getVehicleReports = async (req, res) => {
    const { id } = req.params;

    try {
        const reports = await prisma.vehicleWeeklyReport.findMany({
            where: { vehicleId: parseInt(id) },
            include: {
                user: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(reports);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getWeeklyDraft = async (req, res) => {
    const { id } = req.params;

    const { id: userId, role } = req.user;

    try {
        const vehicle = await prisma.vehicle.findUnique({
            where: { id: parseInt(id) },
            include: { pics: { select: { id: true } } }
        });

        if (!vehicle) return res.status(404).json({ error: 'Kendaraan tidak ditemukan' });

        // PIC Validation
        if (!['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT'].includes(role)) {
            const isPic = vehicle.pics.some(p => p.id === userId);
            if (!isPic) return res.status(403).json({ error: 'Anda tidak memiliki akses ke laporan kendaraan ini.' });
        }

        const today = new Date();
        const day = today.getDay(); // 0(Sun) to 6(Sat)

        // Find the most recent Saturday
        const diffToSat = (day === 6) ? 0 : day + 1;
        const sat = new Date(today);
        sat.setDate(today.getDate() - diffToSat);
        sat.setHours(0, 0, 0, 0);

        // Find the corresponding Friday
        const fri = new Date(sat);
        fri.setDate(sat.getDate() + 6);
        fri.setHours(23, 59, 59, 999);

        // Fetch completed bookings in this period to get real odometers
        const bookings = await prisma.vehicleBooking.findMany({
            where: {
                vehicleId: parseInt(id),
                status: 'COMPLETED',
                tripEndTime: { gte: sat, lte: fri }
            },
            select: { startKm: true, endKm: true }
        });

        let startOdometer = vehicle.odometer;
        let endOdometer = vehicle.odometer;

        if (bookings.length > 0) {
            const startKms = bookings.map(b => b.startKm).filter(km => km != null);
            const endKms = bookings.map(b => b.endKm).filter(km => km != null);

            if (startKms.length > 0) startOdometer = Math.min(...startKms);
            if (endKms.length > 0) endOdometer = Math.max(...endKms);
        }

        res.json({
            weekStartDate: sat.toISOString().split('T')[0],
            weekEndDate: fri.toISOString().split('T')[0],
            startOdometer,
            endOdometer
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const { sendMessage } = require('../services/whatsappService');
const waTemplateService = require('../services/waTemplateService');

exports.checkMissingWeeklyReports = async () => {
    try {
        console.log('[Scheduler] Checking for missing vehicle weekly reports...');

        const today = new Date();
        const day = today.getDay(); // 5 = Friday

        // Ensure this only runs on Friday conceptually, but calculation is robust:
        const diffToSat = (day === 6) ? 0 : day + 1;
        const sat = new Date(today);
        sat.setDate(today.getDate() - diffToSat);
        sat.setHours(0, 0, 0, 0);

        const fri = new Date(sat);
        fri.setDate(sat.getDate() + 6);
        fri.setHours(23, 59, 59, 999);

        // 1. Get all active vehicles
        const vehicles = await prisma.vehicle.findMany({
            where: { status: 'ACTIVE' },
            select: { id: true, name: true, plateNumber: true }
        });

        if (vehicles.length === 0) return;

        // 2. Get reports for this week
        const reportsThisWeek = await prisma.vehicleWeeklyReport.findMany({
            where: {
                weekStartDate: { gte: sat },
                weekEndDate: { lte: fri }
            },
            select: { vehicleId: true }
        });

        const reportedVehicleIds = new Set(reportsThisWeek.map(r => r.vehicleId));

        // 3. Find missing ones
        const missingVehicles = vehicles.filter(v => !reportedVehicleIds.has(v.id));

        if (missingVehicles.length === 0) {
            console.log('[Scheduler] All active vehicles have reports for this week.');
            return;
        }

        // 4. Send Notification
        const recipients = await prisma.user.findMany({
            where: {
                OR: [
                    { position: 'Kepala Bidang Sarana dan Prasarana' },
                    { name: { contains: 'Ringgo Afriwansyah Putra' } }
                ],
                phone: { not: null, not: '' }
            }
        });

        if (recipients.length === 0) {
            console.log('[Scheduler] No recipients found for missing report notification.');
            return;
        }

        const vehicleListStr = missingVehicles.map(v => `- ${v.name} (${v.plateNumber})`).join('\n');
        const periodStr = `${sat.toLocaleDateString('id-ID')} s/d ${fri.toLocaleDateString('id-ID')}`;

        const message = `⚠️ *PENGINGAT LAPORAN MINGGUAN KENDARAAN*\n\n` +
            `Berikut adalah daftar kendaraan aktif yang *BELUM* dibuatkan Laporan periodik minggu ini (${periodStr}):\n\n` +
            `${vehicleListStr}\n\n` +
            `Mohon kepada petugas terkait untuk segera menginput laporan melalui aplikasi SARPRAS di menu *Data Kendaraan > Laporan*.`;

        let cumulativeDelay = 0;
        for (const person of recipients) {
            const randomGap = Math.floor(Math.random() * (15000 - 5000 + 1)) + 5000;
            cumulativeDelay += randomGap;

            setTimeout(async () => {
                try {
                    await waTemplateService.send('VEHICLE_REPORT_ADMIN', person.phone, {}, message);
                    console.log(`Missing report notification sent to ${person.name} (${person.phone})`);
                } catch (e) {
                    console.error(`[Vehicle Report] Failed to notify ${person.name}:`, e.message);
                }
            }, cumulativeDelay);
        }
    } catch (error) {
        console.error('Failed to check missing vehicle reports:', error.message);
    }
};
