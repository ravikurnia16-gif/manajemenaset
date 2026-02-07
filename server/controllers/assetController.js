const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.createAsset = async (req, res) => {
    try {
        const {
            name, categoryId, roomId, unitId,
            price, purchaseDate, condition, brand,
            usefulLife, vendorId, specification, sourceOfFunds
        } = req.body;

        // Generate Code Logic
        // Format: AST-[CategoryCode]-[Year]-[Sequence]
        const category = await prisma.category.findUnique({ where: { id: parseInt(categoryId) } });
        if (!category) return res.status(404).json({ error: 'Category not found' });

        const year = new Date(purchaseDate).getFullYear();

        // Robust sequence generation
        let sequence = 1;
        let code = "";
        let exists = true;

        while (exists) {
            const seqStr = sequence.toString().padStart(4, '0');
            code = `AST-${category.code}-${year}-${seqStr}`;
            const existingAsset = await prisma.asset.findUnique({ where: { code } });
            if (!existingAsset) {
                exists = false;
            } else {
                sequence++;
            }
        }

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
                usefulLife: parseInt(usefulLife || 5),
                condition,
                brand,
                specification,
                sourceOfFunds: sourceOfFunds || "Mandiri",
                quantity: 1
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
        console.error('GetAssets Error:', error);
        res.status(500).json({ error: 'Database Error (Aset): ' + error.message });
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
        const {
            name, categoryId, roomId, unitId,
            price, purchaseDate, condition, brand,
            usefulLife, vendorId, specification, sourceOfFunds
        } = req.body;

        const asset = await prisma.asset.update({
            where: { id: parseInt(id) },
            data: {
                name,
                categoryId: categoryId ? parseInt(categoryId) : undefined,
                roomId: roomId ? parseInt(roomId) : null,
                unitId: unitId ? parseInt(unitId) : null,
                vendorId: vendorId ? parseInt(vendorId) : null,
                price: price ? parseFloat(price) : undefined,
                purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
                condition,
                brand,
                specification,
                sourceOfFunds,
                usefulLife: usefulLife ? parseInt(usefulLife) : undefined
            }
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
        const assetsData = req.body;
        const results = { success: 0, failed: 0, errors: [] };

        for (const item of assetsData) {
            try {
                // 1. Category Lookup/Create
                let category = await prisma.category.findFirst({
                    where: { name: { contains: item.Kategori || 'Umum' } }
                });
                if (!category) {
                    category = await prisma.category.create({
                        data: {
                            name: item.Kategori || 'Umum',
                            code: (item.Kategori || 'UM').substring(0, 2).toUpperCase(),
                            usefulLife: parseInt(item['Umur Ekonomis Aset(tahun)'] || 5),
                            depreciationMethod: 'STRAIGHT_LINE'
                        }
                    });
                }

                // 2. Unit Lookup/Create
                let unit = null;
                if (item['Unit Aset']) {
                    const unitName = String(item['Unit Aset']).trim();
                    unit = await prisma.unit.findFirst({ where: { name: { contains: unitName } } });
                    if (!unit) {
                        const baseCode = unitName.substring(0, 3).toUpperCase();
                        unit = await prisma.unit.create({
                            data: { name: unitName, code: `${baseCode}-${Math.floor(Math.random() * 900) + 100}` }
                        });
                    }
                }

                // 3. Room Lookup/Create
                let room = null;
                if (item['Ruangan Aset']) {
                    const roomName = String(item['Ruangan Aset']).trim();
                    room = await prisma.room.findFirst({ where: { name: { contains: roomName } } });
                    if (!room) {
                        const baseCode = roomName.substring(0, 3).toUpperCase();
                        room = await prisma.room.create({
                            data: { name: roomName, code: `${baseCode}-${Math.floor(Math.random() * 900) + 100}`, floor: '1', building: 'Utama' }
                        });
                    }
                }

                // 4. Vendor Lookup/Create
                let vendor = null;
                if (item['Vendor Aset'] && String(item['Vendor Aset']).trim()) {
                    const vendorName = String(item['Vendor Aset']).trim();
                    vendor = await prisma.vendor.findFirst({ where: { name: { contains: vendorName } } });
                    if (!vendor) {
                        vendor = await prisma.vendor.create({
                            data: { name: vendorName, contact: '-' }
                        });
                    }
                }

                // 5. Generate Asset Code (Robust)
                const yearNow = new Date().getFullYear();
                let seq = 1;
                let assetCode = "";
                let codeExists = true;

                while (codeExists) {
                    const seqStr = seq.toString().padStart(4, '0');
                    assetCode = `AST-${category.code}-${yearNow}-${seqStr}`;
                    const existing = await prisma.asset.findUnique({ where: { code: assetCode } });
                    if (!existing) {
                        codeExists = false;
                    } else {
                        seq++;
                    }
                }

                // 6. Aggregate "Extra Details" into specification
                const extraDetails = [
                    `Jenis Masuk: ${item['Jenis Transaksi Masuk'] || '-'}`,
                    `Bukti Masuk: ${item['Bukti Transaksi Masuk'] || '-'}`,
                    `Pihak Kedua (M): ${item['Nama Pihak Kedua (hanya digunakan kalau pihak kedua baru)'] || item['NIK/NIY Pihak Kedua'] || '-'}`,
                    `Alamat Pihak kedua (M): ${item['Alamat Pihak Kedua (hanya digunakan kalau pihak kedua baru)'] || '-'}`,
                    `--- DATA KELUAR ---`,
                    `Tgl Keluar: ${item['Tanggal Transaksi Keluar (yyyy-mm-dd)'] || '-'}`,
                    `Jenis Keluar: ${item['Jenis Transaksi Keluar'] || '-'}`,
                    `Bukti Keluar: ${item['Bukti Transaksi Keluar'] || '-'}`,
                    `Harga Jual: ${item['Harga Jual'] || 0}`,
                    `Pihak Kedua (K): ${item['Nama Pihak Kedua (hanya digunakan kalau pihak kedua baru)_1'] || item['NIK/NIY Pihak Kedua_1'] || '-'}`
                ].join(' | ');

                // 7. Create Asset
                await prisma.asset.create({
                    data: {
                        code: assetCode,
                        name: String(item['Nama Aset'] || 'Tanpa Nama'),
                        brand: String(item['Merek Aset'] || '-'),
                        categoryId: category.id,
                        unitId: unit ? unit.id : null,
                        roomId: room ? room.id : null,
                        vendorId: vendor ? vendor.id : null,
                        price: parseFloat(String(item['Harga Perolehan'] || 0).replace(/[^\d.-]/g, '')),
                        purchaseDate: item['Tanggal Transaksi Masuk (yyyy-mm-dd)'] ? new Date(item['Tanggal Transaksi Masuk (yyyy-mm-dd)']) : new Date(),
                        usefulLife: parseInt(item['Umur Ekonomis Aset(tahun)'] || 5),
                        condition: String(item['Kondisi Aset'] || 'BAIK').toUpperCase().includes('RUSAK') ? 'RUSAK_RINGAN' : 'BAIK',
                        sourceOfFunds: String(item['Sumber Dana Aset'] || 'Mandiri'),
                        specification: extraDetails.substring(0, 5000), // Safety truncation
                        quantity: 1,
                    }
                });

                results.success++;
            } catch (err) {
                console.error(`Error importing row for ${item['Nama Aset']}:`, err);
                results.failed++;
                results.errors.push(`Gagal pada ${item['Nama Aset']}: ${err.message}`);
            }
        }

        res.json(results);
    } catch (error) {
        console.error("Batch import primary error:", error);
        res.status(500).json({ error: error.message });
    }
};
