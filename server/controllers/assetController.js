const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.createAsset = async (req, res) => {
    try {
        const {
            name, categoryId, roomId, unitId,
            price, purchaseDate, condition, brand,
            usefulLife, vendorId, specification, sourceOfFunds, quantity,
            acquisitionStatus
        } = req.body;

        const category = await prisma.category.findUnique({ where: { id: parseInt(categoryId) } });
        if (!category) return res.status(404).json({ error: 'Category not found' });

        const year = new Date(purchaseDate).getFullYear();
        const patternPrefix = `AST-${category.code}-${year}-`;

        // Find current max sequence in DB
        const lastAsset = await prisma.asset.findFirst({
            where: { code: { startsWith: patternPrefix } },
            orderBy: { code: 'desc' }
        });

        let currentSeq = 1;
        if (lastAsset) {
            const lastSeqPart = lastAsset.code.split('-').pop();
            currentSeq = (parseInt(lastSeqPart) || 0) + 1;
        }

        const assets = [];
        const numToCreate = parseInt(quantity || 1);

        for (let i = 0; i < numToCreate; i++) {
            const code = `${patternPrefix}${(currentSeq + i).toString().padStart(4, '0')}`;
            assets.push(prisma.asset.create({
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
                    acquisitionStatus: acquisitionStatus || "Pembelian",
                    quantity: 1 // Actual item count is per record
                }
            }));
        }

        const createdAssets = await Promise.all(assets);
        res.json(createdAssets[0]); // Return the first one for simplicity
    } catch (error) {
        console.error("Create asset error:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.getAllAssets = async (req, res) => {
    try {
        const { role, unitId } = req.user;
        let where = {};

        // Only Super Admin and Admin Aset can see all data
        if (role !== 'SUPER_ADMIN' && role !== 'ADMIN_ASET') {
            where.unitId = unitId;
        }

        const assets = await prisma.asset.findMany({
            where,
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
            usefulLife, vendorId, specification, sourceOfFunds,
            acquisitionStatus
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
                usefulLife: usefulLife ? parseInt(usefulLife) : undefined,
                acquisitionStatus
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

exports.deleteMultipleAssets = async (req, res) => {
    try {
        const { ids } = req.body; // Array of IDs
        if (!ids || !Array.isArray(ids)) {
            return res.status(400).json({ error: 'IDs must be an array' });
        }

        await prisma.asset.deleteMany({
            where: { id: { in: ids.map(id => parseInt(id)) } }
        });

        res.json({ message: `${ids.length} assets deleted` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.batchImportAssets = async (req, res) => {
    try {
        const assetsData = req.body;
        if (!Array.isArray(assetsData) || assetsData.length === 0) {
            return res.status(400).json({ error: 'Data import kosong' });
        }

        const requiredColumns = [
            { key: 'Nama Aset', label: 'Kolom A (Nama Aset)' },
            { key: 'Merek Aset', label: 'Kolom B (Merek Aset)' },
            { key: 'Vendor Aset', label: 'Kolom C (Vendor Aset)' },
            { key: 'Umur Ekonomis Aset(tahun)', label: 'Kolom F (Umur Ekonomis)' },
            { key: 'Kondisi Aset', label: 'Kolom G (Kondisi Aset)' },
            { key: 'Sumber Dana Aset', label: 'Kolom H (Sumber Dana)' },
            { key: 'Ruangan Aset', label: 'Kolom I (Ruangan Aset)' },
            { key: 'Unit Aset', label: 'Kolom J (Unit Aset)' },
            { key: 'Kategori', label: 'Kolom K (Kategori)' },
            { key: 'Tanggal Transaksi Masuk (yyyy-mm-dd)', label: 'Kolom L (Tanggal Transaksi Masuk)' },
            { key: 'Jenis Transaksi Masuk', label: 'Kolom M (Jenis Transaksi Masuk)' },
            { key: 'Harga Perolehan', label: 'Kolom O (Harga Perolehan)' }
        ];

        // --- Step 1: Validation Pass (Strict) ---
        const existingUnits = await prisma.unit.findMany({ select: { name: true } });
        const unitNames = existingUnits.map(u => u.name.toLowerCase());

        for (let i = 0; i < assetsData.length; i++) {
            const item = assetsData[i];
            const rowNum = i + 1;

            // Check required fields
            for (const col of requiredColumns) {
                const val = item[col.key];
                if (val === undefined || val === null || String(val).trim() === '') {
                    return res.status(400).json({
                        error: `Data tidak lengkap di baris ${rowNum}: ${col.label} wajib diisi.`
                    });
                }
            }

            // --- STRICT UNIT VALIDATION ---
            const unitNameInput = String(item['Unit Aset']).trim().toLowerCase();
            if (!unitNames.includes(unitNameInput)) {
                return res.status(400).json({
                    error: `Unit "${item['Unit Aset']}" di baris ${rowNum} tidak terdaftar di sistem. Silakan hubungi Super Admin.`
                });
            }

            // Check numeric formats
            const price = parseFloat(String(item['Harga Perolehan']).replace(/[^\d.-]/g, ''));
            if (isNaN(price)) {
                return res.status(400).json({
                    error: `Format Harga Perolehan salah di baris ${rowNum}: harus berupa angka.`
                });
            }

            const usefulLife = parseInt(item['Umur Ekonomis Aset(tahun)']);
            if (isNaN(usefulLife)) {
                return res.status(400).json({
                    error: `Format Umur Ekonomis salah di baris ${rowNum}: harus berupa angka.`
                });
            }

            // Check date format
            const purchaseDate = new Date(item['Tanggal Transaksi Masuk (yyyy-mm-dd)']);
            if (isNaN(purchaseDate.getTime())) {
                return res.status(400).json({
                    error: `Format Tanggal Transaksi Masuk salah di baris ${rowNum}: gunakan format YYYY-MM-DD.`
                });
            }
        }

        // --- Step 2: Atomic Import (Transaction) ---
        const result = await prisma.$transaction(async (tx) => {
            const seqCache = {};
            let successCount = 0;

            for (const item of assetsData) {
                // 1. Category Lookup/Create
                const catName = String(item.Kategori).trim();
                let category = await tx.category.findFirst({
                    where: { name: { equals: catName } }
                });

                if (!category) {
                    let baseCatCode = catName.substring(0, 2).toUpperCase();
                    let finalCatCode = baseCatCode;
                    let cCount = 1;
                    while (await tx.category.findUnique({ where: { code: finalCatCode } })) {
                        finalCatCode = `${baseCatCode}${cCount++}`;
                    }
                    category = await tx.category.create({
                        data: {
                            name: catName,
                            code: finalCatCode,
                            usefulLife: parseInt(item['Umur Ekonomis Aset(tahun)']),
                            depreciationMethod: 'STRAIGHT_LINE'
                        }
                    });
                }

                // 2. Unit Lookup (STRICT - NO CREATE)
                const unitName = String(item['Unit Aset']).trim();
                let unit = await tx.unit.findFirst({ where: { name: { equals: unitName } } });
                if (!unit) {
                    throw new Error(`Unit "${unitName}" tidak ditemukan di database.`);
                }

                // 3. Room Lookup/Create
                const roomName = String(item['Ruangan Aset']).trim();
                let room = await tx.room.findFirst({ where: { name: { equals: roomName } } });
                if (!room) {
                    const baseCode = roomName.substring(0, 3).toUpperCase();
                    room = await tx.room.create({
                        data: { name: roomName, code: `${baseCode}-${Math.floor(Math.random() * 900) + 100}`, floor: '1', building: 'Utama' }
                    });
                }

                // 4. Vendor Lookup/Create
                const vendorName = String(item['Vendor Aset']).trim();
                let vendor = await tx.vendor.findFirst({ where: { name: { equals: vendorName } } });
                if (!vendor) {
                    vendor = await tx.vendor.create({
                        data: { name: vendorName, contact: '-' }
                    });
                }

                // 5. Code Generation
                const year = new Date(item['Tanggal Transaksi Masuk (yyyy-mm-dd)']).getFullYear();
                const patternPrefix = `AST-${category.code}-${year}-`;

                if (!seqCache[patternPrefix]) {
                    const lastAsset = await tx.asset.findFirst({
                        where: { code: { startsWith: patternPrefix } },
                        orderBy: { code: 'desc' }
                    });
                    seqCache[patternPrefix] = lastAsset ? (parseInt(lastAsset.code.split('-').pop()) || 0) : 0;
                }
                seqCache[patternPrefix]++;
                const code = `${patternPrefix}${seqCache[patternPrefix].toString().padStart(4, '0')}`;

                // 6. Specification Aggregation
                const extra = [
                    `Jenis Masuk: ${item['Jenis Transaksi Masuk'] || '-'}`,
                    `Bukti Masuk: ${item['Bukti Transaksi Masuk'] || '-'}`,
                    `Harga Jual: ${item['Harga Jual'] || 0}`
                ].join(' | ');

                // 7. Create Asset
                await tx.asset.create({
                    data: {
                        code,
                        name: String(item['Nama Aset']),
                        brand: String(item['Merek Aset']),
                        categoryId: category.id,
                        unitId: unit.id,
                        roomId: room.id,
                        vendorId: vendor.id,
                        price: parseFloat(String(item['Harga Perolehan']).replace(/[^\d.-]/g, '')),
                        purchaseDate: new Date(item['Tanggal Transaksi Masuk (yyyy-mm-dd)']),
                        usefulLife: parseInt(item['Umur Ekonomis Aset(tahun)']),
                        condition: String(item['Kondisi Aset']).toUpperCase().includes('RUSAK') ? 'RUSAK_RINGAN' : 'BAIK',
                        sourceOfFunds: String(item['Sumber Dana Aset']),
                        specification: extra,
                        quantity: 1
                    }
                });
                successCount++;
            }
            return successCount;
        });

        res.json({ success: result, message: `Berhasil mengimport ${result} aset.` });
    } catch (error) {
        console.error("Atomic Batch Import Error:", error);
        res.status(500).json({ error: 'Gagal Import: ' + error.message });
    }
};
