const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { deleteFile } = require('../middleware/uploadMiddleware');

// Get all standards with filters
exports.getAllStandards = async (req, res) => {
    const { categoryId, search } = req.query;
    try {
        const where = {};
        if (categoryId) where.categoryId = parseInt(categoryId);
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { specification: { contains: search } },
                { note: { contains: search } }
            ];
        }

        const standards = await prisma.assetStandard.findMany({
            where,
            include: { category: true },
            orderBy: { name: 'asc' }
        });
        res.json(standards);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// Get single standard
exports.getStandardById = async (req, res) => {
    try {
        const standard = await prisma.assetStandard.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { category: true }
        });
        if (!standard) return res.status(404).json({ error: 'Standar tidak ditemukan' });
        res.json(standard);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// Create standard
exports.createStandard = async (req, res) => {
    const { name, categoryId, specification, minSpec, estimatedPrice, note, image } = req.body;
    try {
        const standard = await prisma.assetStandard.create({
            data: {
                name,
                categoryId: parseInt(categoryId),
                specification,
                minSpec,
                estimatedPrice: estimatedPrice ? parseFloat(estimatedPrice) : null,
                note,
                image: req.fileUrl || image || null
            }
        });
        res.status(201).json(standard);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// Update standard
exports.updateStandard = async (req, res) => {
    const { name, categoryId, specification, minSpec, estimatedPrice, note, image } = req.body;
    try {
        const current = await prisma.assetStandard.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!current) return res.status(404).json({ error: 'Standar tidak ditemukan' });

        // Handle image deletion if new one uploaded or explicitly cleared
        if (req.fileUrl && current.image) {
            await deleteFile(current.image);
        }

        const standard = await prisma.assetStandard.update({
            where: { id: parseInt(req.params.id) },
            data: {
                name,
                categoryId: categoryId ? parseInt(categoryId) : undefined,
                specification,
                minSpec,
                estimatedPrice: estimatedPrice !== undefined ? (estimatedPrice ? parseFloat(estimatedPrice) : null) : undefined,
                note,
                image: req.fileUrl !== undefined ? req.fileUrl : (image !== undefined ? image : undefined)
            }
        });
        res.json(standard);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// Delete standard
exports.deleteStandard = async (req, res) => {
    try {
        const current = await prisma.assetStandard.findUnique({ where: { id: parseInt(req.params.id) } });
        if (current && current.image) {
            await deleteFile(current.image);
        }
        await prisma.assetStandard.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'Standar berhasil dihapus' });
    } catch (e) { res.status(500).json({ error: e.message }); }
};
