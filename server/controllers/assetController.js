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

exports.batchImportAssets = async (req, res) => {
    try {
        const assetsData = req.body; // Array of objects from Excel
        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        for (const item of assetsData) {
            try {
                // Smart Lookup or Create Master Data
                // 1. Category
                let category = await prisma.category.findFirst({
                    where: { name: { contains: item.Kategori || 'Umum' } }
                });
                if (!category) {
                    category = await prisma.category.create({
                        data: {
                            name: item.Kategori || 'Umum',
                            code: (item.Kategori || 'UM').substring(0, 2).toUpperCase(),
                            usefulLife: 5,
                            depreciationMethod: 'STRAIGHT_LINE'
                        }
                    });
                }

                // 2. Unit
                let unit = null;
                if (item['Unit Aset']) {
                    const unitName = String(item['Unit Aset']).trim();
                    unit = await prisma.unit.findFirst({
                        where: { name: { contains: unitName } }
                    });
                    if (!unit) {
                        // Generate unique-ish code
                        const baseCode = unitName.substring(0, 3).toUpperCase();
                        const randomSuffix = Math.floor(Math.random() * 900) + 100;
                        unit = await prisma.unit.create({
                            data: {
                                name: unitName,
                                code: `${baseCode}-${randomSuffix}`
                            }
                        });
                    }
                }

                // 3. Room
                let room = null;
                if (item['Ruangan Aset']) {
                    const roomName = String(item['Ruangan Aset']).trim();
                    room = await prisma.room.findFirst({
                        where: { name: { contains: roomName } }
                    });
                    if (!room) {
                        const baseCode = roomName.substring(0, 3).toUpperCase();
                        const randomSuffix = Math.floor(Math.random() * 900) + 100;
                        room = await prisma.room.create({
                            data: {
                                name: roomName,
                                code: `${baseCode}-${randomSuffix}`,
                                floor: '1',
                                building: 'Utama'
                            }
                        });
                    }
                }

                // Generate Asset Code
                const year = new Date().getFullYear();
                const count = await prisma.asset.count({
                    where: { categoryId: category.id }
                });
                const sequence = (count + 1).toString().padStart(4, '0');
                const assetCode = `AST-${category.code}-${year}-${sequence}`;

                // Check if Code already exists to prevent crash
                const existing = await prisma.asset.findUnique({ where: { code: assetCode } });
                const finalCode = existing ? `${assetCode}-DUP-${Math.floor(Math.random() * 100)}` : assetCode;

                // Create Asset
                await prisma.asset.create({
                    data: {
                        code: finalCode,
                        name: String(item['Nama Aset'] || 'Tanpa Nama'),
                        brand: String(item['Merek Aset'] || '-'),
                        categoryId: category.id,
                        unitId: unit ? unit.id : null,
                        roomId: room ? room.id : null,
                        price: parseFloat(String(item['Harga Perolehan'] || 0).replace(/[^\d.-]/g, '')),
                        purchaseDate: item['Tanggal Transaksi Masuk (yyyy-mm-dd)'] ? new Date(item['Tanggal Transaksi Masuk (yyyy-mm-dd)']) : new Date(),
                        condition: 'BAIK',
                        specification: String(item.Spesifikasi || '-'),
                    }
                });

                results.success++;
            } catch (err) {
                console.error(`Error importing row for ${item['Nama Aset']}:`, err);
                results.failed++;
                results.errors.push(`Gagal pada ${item['Nama Aset']}: ${err.message}`);
            }
        }

        console.log(`Import finished. Success: ${results.success}, Failed: ${results.failed}`);
        res.json(results);
    } catch (error) {
        console.error("Batch import primary error:", error);
        res.status(500).json({ error: error.message });
    }
};
