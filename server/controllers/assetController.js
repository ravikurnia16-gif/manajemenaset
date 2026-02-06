const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.createAsset = async (req, res) => {
    try {
        const {
            name, categoryId, roomId, unitId,
            price, purchaseDate, condition, brand,
            quantity, vendorId, specification
        } = req.body;

        // Generate Code Logic
        // Format: AST-[CategoryCode]-[Year]-[Sequence]
        const category = await prisma.category.findUnique({ where: { id: parseInt(categoryId) } });
        if (!category) return res.status(404).json({ error: 'Category not found' });

        const year = new Date(purchaseDate).getFullYear();

        // Get last sequence for this pattern
        // This is a simple count. For production, strictly locking or finding last created is better.
        const count = await prisma.asset.count({
            where: {
                categoryId: parseInt(categoryId),
                purchaseDate: {
                    gte: new Date(`${year}-01-01`),
                    lte: new Date(`${year}-12-31`)
                }
            }
        });

        const sequence = (count + 1).toString().padStart(4, '0');
        // Example: KM-2026-0001 (If Category Code is KM)
        const code = `AST-${category.code}-${year}-${sequence}`;

        const asset = await prisma.asset.create({
            data: {
                code,
                name,
                categoryId: parseInt(categoryId),
                roomId: roomId ? parseInt(roomId) : null,
                unitId: unitId ? parseInt(unitId) : null,
                vendorId: vendorId ? parseInt(vendorId) : null,
                price: parseFloat(price),
                purchaseDate: new Date(purchaseDate),
                condition,
                brand,
                specification,
                quantity: parseInt(quantity || 1)
            }
        });

        res.json(asset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAllAssets = async (req, res) => {
    try {
        const assets = await prisma.asset.findMany({
            include: { category: true, room: true, unit: true, vendor: true }
        });
        res.json(assets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAssetById = async (req, res) => {
    try {
        const { id } = req.params;
        const asset = await prisma.asset.findUnique({
            where: { id: parseInt(id) },
            include: { category: true, room: true, unit: true, vendor: true, movements: true, maintenances: true }
        });
        if (!asset) return res.status(404).json({ error: 'Asset not found' });
        res.json(asset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateAsset = async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;
        const asset = await prisma.asset.update({
            where: { id: parseInt(id) },
            data
        });
        res.json(asset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteAsset = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.asset.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Asset deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
