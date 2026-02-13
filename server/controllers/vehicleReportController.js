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

    const userId = req.user.id;

    try {
        const report = await prisma.vehicleWeeklyReport.create({
            data: {
                vehicleId: parseInt(vehicleId),
                userId,
                weekStartDate: new Date(weekStartDate),
                weekEndDate: new Date(weekEndDate),
                startOdometer: parseInt(startOdometer),
                endOdometer: parseInt(endOdometer),
                conditionEngine,
                conditionBody,
                conditionInterior,
                isClean,
                notes
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
