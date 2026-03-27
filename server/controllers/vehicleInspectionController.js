const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Create a new vehicle inspection
 */
exports.createInspection = async (req, res) => {
    try {
        const { vehicleId, notes, scratches } = req.body;
        const userId = req.user.id;
        const fileUrls = req.fileUrls || {};

        const inspection = await prisma.vehicleInspection.create({
            data: {
                vehicle: { connect: { id: parseInt(vehicleId) } },
                user: { connect: { id: parseInt(userId) } },
                frontPhoto: fileUrls.frontPhoto || null,
                rightPhoto: fileUrls.rightPhoto || null,
                leftPhoto: fileUrls.leftPhoto || null,
                backPhoto: fileUrls.backPhoto || null,
                scratches: scratches ? JSON.parse(scratches) : [],
                notes: notes || null
            }
        });

        res.status(201).json(inspection);
    } catch (error) {
        console.error('Failed to create inspection:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get inspections for a specific vehicle
 */
exports.getVehicleInspections = async (req, res) => {
    try {
        const { id } = req.params;
        const inspections = await prisma.vehicleInspection.findMany({
            where: { vehicleId: parseInt(id) },
            include: {
                user: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(inspections);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get inspection details by ID
 */
exports.getInspectionById = async (req, res) => {
    try {
        const { id } = req.params;
        const inspection = await prisma.vehicleInspection.findUnique({
            where: { id: parseInt(id) },
            include: {
                vehicle: { select: { id: true, name: true, plateNumber: true } },
                user: { select: { id: true, name: true } }
            }
        });

        if (!inspection) {
            return res.status(404).json({ error: 'Inspeksi tidak ditemukan' });
        }

        res.json(inspection);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
