const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getAllUnits = async (req, res) => {
    try {
        const units = await prisma.unit.findMany({
            select: {
                id: true,
                name: true,
                code: true,
                description: true,
                phone: true,
                email: true,
                address: true,
                headName: true,
                headNip: true,
                // logo is excluded to improve performance
            }
        });
        res.json(units);
    } catch (error) {
        console.error('GetUnits Error:', error);
        res.status(500).json({ error: 'Database Error (Unit): ' + error.message });
    }
};

exports.getUnitById = async (req, res) => {
    try {
        const { id } = req.params;
        const unit = await prisma.unit.findUnique({
            where: { id: parseInt(id) }
        });
        if (!unit) return res.status(404).json({ error: 'Unit not found' });
        res.json(unit);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createUnit = async (req, res) => {
    try {
        const { name, code, description, phone, email, address, headName, headNip, logo } = req.body;
        const unit = await prisma.unit.create({
            data: {
                name,
                code,
                description,
                phone,
                email,
                address,
                headName,
                headNip,
                logo
            }
        });
        res.json(unit);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateUnit = async (req, res) => {
    try {
        const { id } = req.params;
        // Cek apakah ada perubahan kode Unit
        const oldUnit = await prisma.unit.findUnique({ where: { id: parseInt(id) } });

        const unit = await prisma.unit.update({
            where: { id: parseInt(id) },
            data: {
                name,
                code,
                description,
                phone,
                email,
                address,
                headName,
                headNip,
                logo
            }
        });

        // Sinkronisasi Kode Aset jika Kode Unit Berubah
        if (oldUnit && oldUnit.code !== code) {
            const assets = await prisma.asset.findMany({
                where: { unitId: parseInt(id) }
            });

            for (const asset of assets) {
                const parts = asset.code.split('.');
                // Format: PREFIX.UNITCODE.CATEGORYCODE.YEAR.SEQUENCE
                if (parts.length >= 5 && parts[1] === oldUnit.code) {
                    parts[1] = code;
                    const newAssetCode = parts.join('.');
                    await prisma.asset.update({
                        where: { id: asset.id },
                        data: { code: newAssetCode }
                    });
                } else if (asset.code.includes(`.${oldUnit.code}.`)) {
                    // Fallback
                    const newAssetCode = asset.code.replace(`.${oldUnit.code}.`, `.${code}.`);
                    await prisma.asset.update({
                        where: { id: asset.id },
                        data: { code: newAssetCode }
                    });
                }
            }
        }

        res.json(unit);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteUnit = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.unit.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Unit deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAllRooms = async (req, res) => {
    try {
        const rooms = await prisma.room.findMany({
            include: { unit: true }
        });
        res.json(rooms);
    } catch (error) {
        console.error('GetRooms Error:', error);
        res.status(500).json({ error: 'Database Error (Ruangan): ' + error.message });
    }
};

exports.createRoom = async (req, res) => {
    try {
        const { name, code: manualCode, floor, building, unitId } = req.body;

        let finalCode = manualCode;
        if (!finalCode && unitId) {
            const unit = await prisma.unit.findUnique({ where: { id: parseInt(unitId) } });
            if (unit) {
                const lastRoom = await prisma.room.findFirst({
                    where: {
                        unitId: unit.id,
                        code: {
                            startsWith: `${unit.code}-`
                        }
                    },
                    orderBy: {
                        code: 'desc'
                    }
                });

                let nextSeq = 1;
                if (lastRoom) {
                    const parts = lastRoom.code.split('-');
                    const lastSeqPart = parts[parts.length - 1];
                    const lastSeq = parseInt(lastSeqPart);
                    if (!isNaN(lastSeq)) {
                        nextSeq = lastSeq + 1;
                    }
                }
                
                finalCode = `${unit.code}-${nextSeq.toString().padStart(2, '0')}`;
            }
        }

        const room = await prisma.room.create({
            data: {
                name,
                code: finalCode || `RM-${Math.floor(Math.random() * 9000) + 1000}`,
                floor: floor || '1',
                building: building || '-',
                unitId: unitId ? parseInt(unitId) : null
            }
        });
        res.json(room);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateRoom = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, code, floor, building, unitId } = req.body;
        const room = await prisma.room.update({
            where: { id: parseInt(id) },
            data: {
                name,
                code,
                floor,
                building,
                unitId: unitId ? parseInt(unitId) : null
            }
        });
        res.json(room);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteRoom = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.room.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Room deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAllCategories = async (req, res) => {
    try {
        const categories = await prisma.category.findMany();
        res.json(categories);
    } catch (error) {
        console.error('GetCategories Error:', error);
        res.status(500).json({ error: 'Database Error (Kategori): ' + error.message });
    }
};

exports.createCategory = async (req, res) => {
    try {
        const { name, code, usefulLife, depreciationMethod } = req.body;
        const category = await prisma.category.create({
            data: {
                name,
                code,
                usefulLife: parseInt(usefulLife) || 5,
                depreciationMethod: depreciationMethod || 'STRAIGHT_LINE'
            }
        });
        res.json(category);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, code, usefulLife, depreciationMethod } = req.body;
        const category = await prisma.category.update({
            where: { id: parseInt(id) },
            data: {
                name,
                code,
                usefulLife: usefulLife ? parseInt(usefulLife) : undefined,
                depreciationMethod
            }
        });
        res.json(category);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.category.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Category deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAllVendors = async (req, res) => {
    try {
        const vendors = await prisma.vendor.findMany();
        res.json(vendors);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createVendor = async (req, res) => {
    try {
        const { name, contact, address, email } = req.body;
        const vendor = await prisma.vendor.create({
            data: { name, contact, address, email }
        });
        res.json(vendor);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, contact, address, email } = req.body;
        const vendor = await prisma.vendor.update({
            where: { id: parseInt(id) },
            data: { name, contact, address, email }
        });
        res.json(vendor);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteVendor = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.vendor.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Vendor deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Bulk Delete Operations
exports.deleteMultipleUnits = async (req, res) => {
    try {
        const { ids } = req.body;
        await prisma.unit.deleteMany({ where: { id: { in: ids } } });
        res.json({ message: 'Units deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteMultipleRooms = async (req, res) => {
    try {
        const { ids } = req.body;
        await prisma.room.deleteMany({ where: { id: { in: ids } } });
        res.json({ message: 'Rooms deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteMultipleCategories = async (req, res) => {
    try {
        const { ids } = req.body;
        await prisma.category.deleteMany({ where: { id: { in: ids } } });
        res.json({ message: 'Categories deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteMultipleVendors = async (req, res) => {
    try {
        const { ids } = req.body;
        await prisma.vendor.deleteMany({ where: { id: { in: ids } } });
        res.json({ message: 'Vendors deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
