const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const whatsappService = require('../services/whatsappService');
const { deleteFile } = require('../services/minioService');

exports.getFundingSources = async (req, res) => {
    try {
        const sources = await prisma.asset.findMany({
            select: { sourceOfFunds: true },
            distinct: ['sourceOfFunds']
        });
        const uniqueSources = sources
            .map(s => s.sourceOfFunds)
            .filter(s => s) // Remove nulls
            .sort();
        res.json(uniqueSources);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createAsset = async (req, res) => {
    try {
        const {
            code: manualCode,
            name, categoryId, roomId, unitId,
            price, purchaseDate, condition, brand,
            quantity,
            acquisitionStatus,
            picId, picName,
            vendorName, usefulLife, specification, sourceOfFunds,
            isLendable,
            needsRoutineMaintenance, maintenanceInterval,
            // Additional fields for "Other" options
            newCategoryName, newCategoryCode,
            newRoomName, newRoomCode, newRoomFloor, newRoomBuilding
        } = req.body;

        const result = await prisma.$transaction(async (tx) => {
            let finalCategoryId = categoryId;
            let finalRoomId = roomId;

            // 1. Handle New Category
            if (categoryId === 'other') {
                const newCat = await tx.category.create({
                    data: {
                        name: newCategoryName,
                        code: newCategoryCode || newCategoryName.substring(0, 3).toUpperCase(),
                        usefulLife: parseInt(usefulLife || 5),
                        depreciationMethod: 'STRAIGHT_LINE'
                    }
                });
                finalCategoryId = newCat.id;
            }



            // 2. Handle New Room
            if (roomId === 'other') {
                const unit = await tx.unit.findUnique({ where: { id: parseInt(unitId) } });
                let finalRoomCode = newRoomCode;

                if (!finalRoomCode && unit) {
                    const lastRoom = await tx.room.findFirst({
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

                    finalRoomCode = `${unit.code}-${nextSeq.toString().padStart(2, '0')}`;
                }

                // Check if room with same name exists in this unit
                const existingRoom = await tx.room.findFirst({
                    where: {
                        name: newRoomName,
                        unitId: unitId ? parseInt(unitId) : null
                    }
                });

                if (existingRoom) {
                    finalRoomId = existingRoom.id;
                } else {
                    const newRoom = await tx.room.create({
                        data: {
                            name: newRoomName,
                            code: finalRoomCode || `RM-${Math.floor(Math.random() * 9000) + 1000}`,
                            floor: newRoomFloor || '1',
                            building: newRoomBuilding || '-',
                            unitId: unitId ? parseInt(unitId) : null
                        }
                    });
                    finalRoomId = newRoom.id;
                }
            }

            // 4. Validation & Setup for Asset Creation
            const category = await tx.category.findUnique({ where: { id: parseInt(finalCategoryId) } });
            if (!category) throw new Error('Category not found');

            const unit = await tx.unit.findUnique({ where: { id: parseInt(unitId) } });
            if (!unit) throw new Error('Unit not found');

            const settings = await tx.setting.findUnique({ where: { id: 1 } });
            const prefix = settings?.assetCodePrefix || 'AST';
            const year = purchaseDate ? new Date(purchaseDate).getFullYear() : 'YYYY';
            const patternPrefix = `${prefix}.${unit.code}.${category.code}.${year}.`;

            // Find current max sequence in DB
            const lastAsset = await tx.asset.findFirst({
                where: { code: { startsWith: patternPrefix } },
                orderBy: { code: 'desc' }
            });

            let currentSeq = 1;
            if (lastAsset) {
                const parts = lastAsset.code.split('.');
                const lastSeqPart = parts[parts.length - 1];
                currentSeq = (parseInt(lastSeqPart) || 0) + 1;
            }

            const createdAssets = [];
            const numToCreate = parseInt(quantity || 1);

            for (let i = 0; i < numToCreate; i++) {
                let finalCode;
                if (manualCode && numToCreate === 1) {
                    finalCode = manualCode;
                } else {
                    finalCode = `${patternPrefix}${(currentSeq + i).toString().padStart(4, '0')}`;
                }

                createdAssets.push(tx.asset.create({
                    data: {
                        code: finalCode,
                        name,
                        categoryId: parseInt(finalCategoryId),
                        roomId: finalRoomId ? parseInt(finalRoomId) : null,
                        unitId: unitId ? parseInt(unitId) : null,
                        vendorName: vendorName || null,
                        price: parseFloat(price || 0),
                        purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
                        usefulLife: parseInt(usefulLife || 5),
                        condition: condition || 'BAIK',
                        brand,
                        specification,
                        sourceOfFunds: sourceOfFunds || "Mandiri",
                        acquisitionStatus: acquisitionStatus || "Pembelian",
                        isLendable: isLendable === true || isLendable === 'true',
                        quantity: 1,
                        picId: picId ? parseInt(picId) : null,
                        picName: picName || null,
                        image: req.fileUrl || null,
                        needsRoutineMaintenance: needsRoutineMaintenance === true || needsRoutineMaintenance === 'true',
                        maintenanceInterval: maintenanceInterval ? parseInt(maintenanceInterval) : 180
                    }
                }));
            }

            const assets = await Promise.all(createdAssets);
            return assets[0];
        });

        res.json(result);
    } catch (error) {
        console.error("Create asset error:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.getAllAssets = async (req, res) => {
    try {
        const { role, unitId } = req.user;
        const {
            validationStatus,
            unverifiedSince,
            page = 1,
            limit = 10,
            search = '',
            unitId: filterUnitId,
            roomId: filterRoomId,
            startDate,
            endDate,
            isLendable,
            needsRoutine,
            condition
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        let where = {};
        // Note: condition: { notIn: ['DISPOSED'] } is temporarily disabled 
        // until database schema is confirmed to be in sync.

        // 1. Role-based Restriction
        const isGlobalAdmin = ['SUPER_ADMIN', 'ADMIN_ASET', 'KEPALA_BIDANG', 'BIDANG_IT', 'KABID_SARPRAS'].includes(role) || req.user.position === 'Kepala Bidang Sarana dan Prasarana';
        if (!isGlobalAdmin) {
            where.unitId = unitId;
        }

        // 2. Explicit Filters (if provided and allowed)
        if (filterUnitId) {
            // Allow filtering by unitId if:
            // 1. User is global admin
            // 2. User is filtering their own unit
            // 3. User is specifically looking for lendable assets (Cross-unit borrowing)
            if (isGlobalAdmin || parseInt(filterUnitId) === unitId || isLendable === 'true' || isLendable === true) {
                where.unitId = parseInt(filterUnitId);
            }
        }
        if (filterRoomId) {
            where.roomId = parseInt(filterRoomId);
        }

        // 3. Validation Filter
        if (validationStatus && validationStatus !== 'ALL') {
            where.validationStatus = validationStatus;
        }

        // 4. Lendable Filter
        if (isLendable === 'true' || isLendable === true) {
            where.isLendable = true;
        }

        // 5. Condition Filter (if needed by frontend)
        if (condition) {
            where.condition = condition;
        }

        // 4. Routine Maintenance Filter
        if (needsRoutine === 'true' || needsRoutine === true) {
            where.needsRoutineMaintenance = true;
        }

        // 5. Search (Name, Code, Unit, or Room)
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { code: { contains: search } },
                { unit: { name: { contains: search } } },
                { room: { name: { contains: search } } }
            ];
        }

        // 5. Unverified Since (For Periodical Validation)
        if (unverifiedSince) {
            const dateThreshold = new Date(unverifiedSince);
            // We need to use AND if we already have OR from search
            const dateCondition = {
                OR: [
                    { validatedAt: { lt: dateThreshold } },
                    { validatedAt: null }
                ]
            };

            if (where.OR) {
                where.AND = [dateCondition];
            } else {
                where.OR = dateCondition.OR;
            }
        }

        // 6. Registration Date Range (Cetak Rentang Tanggal)
        if (startDate || endDate) {
            where.purchaseDate = {};
            if (startDate) where.purchaseDate.gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                where.purchaseDate.lte = end;
            }
        }

        // 6. Execute Queries (Transaction for consistency or just parallel)
        const [total, assets] = await prisma.$transaction([
            prisma.asset.count({ where }),
            prisma.asset.findMany({
                where,
                skip,
                take,
                include: {
                    category: true,
                    room: { include: { unit: true } },
                    unit: true,
                    validatedBy: { select: { username: true } }
                },
                orderBy: { createdAt: 'desc' }
            })
        ]);

        res.json({
            data: assets,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / take)
            }
        });
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
            include: {
                category: true,
                room: { include: { unit: true } },
                unit: true,

                movements: {
                    include: { requester: { select: { name: true } } },
                    orderBy: { date: 'asc' }
                },
                maintenances: {
                    orderBy: { createdAt: 'asc' }
                },
                disposal: true,
                pic: { select: { name: true } }
            }
        });

        if (!asset) return res.status(404).json({ error: 'Asset not found' });

        // Build Timeline
        const history = [];

        // 1. Creation
        history.push({
            type: 'CREATION',
            date: asset.purchaseDate || asset.createdAt,
            title: 'Aset Terdaftar',
            description: `Aset pertama kali didaftarkan dengan harga Rp ${asset.price.toLocaleString()}`,
            icon: 'Plus'
        });

        // 2. Movements (Mutasi)
        asset.movements.forEach(m => {
            history.push({
                type: 'MOVEMENT',
                date: m.date,
                title: 'Mutasi Aset',
                description: `Aset dipindahkan dari ${m.fromLocation} ke ${m.toLocation}. Alasan: ${m.reason || '-'}`,
                subTitle: `Diajukan oleh: ${m.requester?.name || 'System'}`,
                status: m.status,
                icon: 'ArrowLeftRight'
            });
        });

        // 3. Maintenances (Pemeliharaan)
        asset.maintenances.forEach(m => {
            history.push({
                type: 'MAINTENANCE',
                date: m.createdAt,
                title: 'Pemeliharaan / Perbaikan',
                description: m.title,
                subTitle: m.technician ? `Teknisi: ${m.technician}` : null,
                status: m.status,
                icon: 'Wrench'
            });
        });

        // 4. Disposal (Penghapusan)
        if (asset.disposal) {
            history.push({
                type: 'DISPOSAL',
                date: asset.disposal.disposalDate,
                title: 'Penghapusan Aset',
                description: `Metode: ${asset.disposal.method}. Alasan: ${asset.disposal.reason}`,
                status: asset.disposal.status,
                icon: 'Trash2'
            });
        }

        // Sort history by date descending (Newest first)
        history.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json({
            ...asset,
            timeline: history
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateAsset = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            code,
            name, categoryId, roomId, unitId,
            price, purchaseDate, condition, brand,
            usefulLife, vendorName, specification, sourceOfFunds,
            acquisitionStatus,
            picId, picName,
            isLendable,
            needsRoutineMaintenance,
            maintenanceInterval
        } = req.body;

        const oldAsset = await prisma.asset.findUnique({ where: { id: parseInt(id) } });

        const asset = await prisma.asset.update({
            where: { id: parseInt(id) },
            data: {
                code,
                name,
                categoryId: categoryId ? parseInt(categoryId) : undefined,
                roomId: roomId ? parseInt(roomId) : null,
                unitId: unitId ? parseInt(unitId) : null,
                vendorName: vendorName || null,
                price: price ? parseFloat(price) : undefined,
                purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
                condition,
                brand,
                specification,
                sourceOfFunds,
                usefulLife: usefulLife ? parseInt(usefulLife) : undefined,
                acquisitionStatus,
                picId: picId ? parseInt(picId) : null,
                picName: picName || null,
                isLendable: isLendable === true || isLendable === 'true',
                needsRoutineMaintenance: needsRoutineMaintenance !== undefined ? (needsRoutineMaintenance === true || needsRoutineMaintenance === 'true') : undefined,
                maintenanceInterval: maintenanceInterval !== undefined ? parseInt(maintenanceInterval) : undefined,
                image: req.fileUrl || undefined
            }
        });

        // Cleanup old image from MinIO if updated
        if (req.fileUrl && oldAsset?.image) {
            await deleteFile(oldAsset.image);
        }

        res.json(asset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteAsset = async (req, res) => {
    try {
        const { id } = req.params;
        const asset = await prisma.asset.findUnique({ where: { id: parseInt(id) } });

        if (asset?.image) {
            await deleteFile(asset.image);
        }

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

exports.validateAsset = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, note } = req.body; // status: VALIDATED, NEEDS_UPDATE, REJECTED
        const userId = req.user.userId;

        const asset = await prisma.asset.update({
            where: { id: parseInt(id) },
            data: {
                validationStatus: status,
                validatedAt: new Date(),
                validatedById: userId,
                validationNote: note
            }
        });

        // Log the activity
        await prisma.log.create({
            data: {
                userId: userId,
                action: 'VALIDATE_ASSET',
                details: `Asset ${asset.code} status changed to ${status}. Note: ${note || '-'}`
            }
        });

        res.json(asset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.validateMultipleAssets = async (req, res) => {
    try {
        const { ids, status, note } = req.body;
        const userId = req.user.userId;

        if (!ids || !Array.isArray(ids)) {
            return res.status(400).json({ error: 'IDs must be an array' });
        }

        const numericIds = ids.map(id => parseInt(id));

        await prisma.asset.updateMany({
            where: { id: { in: numericIds } },
            data: {
                validationStatus: status,
                validatedAt: new Date(),
                validatedById: userId,
                validationNote: note
            }
        });

        // Log the activity (Bulk log)
        await prisma.log.create({
            data: {
                userId: userId,
                action: 'BULK_VALIDATE_ASSET',
                details: `${ids.length} assets status changed to ${status}. Note: ${note || '-'}`
            }
        });

        res.json({ message: `${ids.length} assets validated successfully` });
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
            { key: 'Vendor Aset', label: 'Kolom C (Vendor Aset - Opsional)' },
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
        const [existingUnits, existingCategories] = await Promise.all([
            prisma.unit.findMany({ select: { name: true } }),
            prisma.category.findMany({ select: { name: true } })
        ]);
        const unitNames = existingUnits.map(u => u.name.toLowerCase());
        const categoryNames = existingCategories.map(c => c.name.toLowerCase());

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

            // --- STRICT CATEGORY VALIDATION ---
            const categoryInput = String(item['Kategori']).trim().toLowerCase();
            if (!categoryNames.includes(categoryInput)) {
                return res.status(400).json({
                    error: `Kategori "${item['Kategori']}" di baris ${rowNum} tidak terdaftar di sistem. Silakan tambahkan kategori tersebut ke Master Data terlebih dahulu.`
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
                // 1. Category Lookup (STRICT - NO CREATE)
                const catName = String(item.Kategori).trim();
                let category = await tx.category.findFirst({
                    where: { name: { equals: catName } }
                });

                if (!category) {
                    throw new Error(`Kategori "${catName}" tidak ditemukan di database.`);
                }

                // 2. Unit Lookup (STRICT - NO CREATE)
                const unitName = String(item['Unit Aset']).trim();
                let unit = await tx.unit.findFirst({ where: { name: { equals: unitName } } });
                if (!unit) {
                    throw new Error(`Unit "${unitName}" tidak ditemukan di database.`);
                }

                // 3. Room Lookup/Create (Scoped by Unit)
                const roomName = String(item['Ruangan Aset']).trim();
                let room = await tx.room.findFirst({
                    where: {
                        name: { equals: roomName },
                        unitId: unit.id
                    }
                });

                if (!room) {
                    // Get next sequence for room code
                    const lastRoom = await tx.room.findFirst({
                        where: {
                            unitId: unit.id,
                            code: { startsWith: `${unit.code}-` }
                        },
                        orderBy: { code: 'desc' }
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
                    const finalRoomCode = `${unit.code}-${nextSeq.toString().padStart(2, '0')}`;

                    room = await tx.room.create({
                        data: {
                            name: roomName,
                            code: finalRoomCode,
                            floor: '1',
                            building: '-',
                            unitId: unit.id
                        }
                    });
                }

                // 4. Vendor Name (standalone text, not linked to Vendor table)
                const vendorInput = String(item['Vendor Aset'] || '').trim();

                // 5. Code Generation
                const year = new Date(item['Tanggal Transaksi Masuk (yyyy-mm-dd)']).getFullYear();

                // Fetch prefix from settings (could be optimized with cache if needed, but simple for now)
                const settings = await tx.setting.findFirst();
                const prefix = settings?.assetCodePrefix || 'AST';
                const patternPrefix = `${prefix}.${unit.code}.${category.code}.${year}.`;

                if (!seqCache[patternPrefix]) {
                    const lastAsset = await tx.asset.findFirst({
                        where: { code: { startsWith: patternPrefix } },
                        orderBy: { code: 'desc' }
                    });
                    if (lastAsset) {
                        const parts = lastAsset.code.split('.');
                        const lastSeqPart = parts[parts.length - 1];
                        seqCache[patternPrefix] = parseInt(lastSeqPart) || 0;
                    } else {
                        seqCache[patternPrefix] = 0;
                    }
                }
                seqCache[patternPrefix]++;
                const code = `${patternPrefix}${seqCache[patternPrefix].toString().padStart(4, '0')}`;

                // 6. Support Case-Insensitive Funding Source Matching
                const SUPPORTED_FUNDING_SOURCES = ['Yayasan', 'BOS', 'Hibah', 'Pemerintah', 'Cashback', 'Mandiri', 'Lainnya'];
                const rawSource = String(item['Sumber Dana Aset'] || '').trim();
                const matchedSource = SUPPORTED_FUNDING_SOURCES.find(s => s.toLowerCase() === rawSource.toLowerCase());
                const finalSource = matchedSource || rawSource || 'Lainnya';

                // 7. Create Asset
                await tx.asset.create({
                    data: {
                        code,
                        name: String(item['Nama Aset']),
                        brand: String(item['Merek Aset']),
                        categoryId: category.id,
                        unitId: unit.id,
                        roomId: room.id,
                        vendorName: vendorInput || null,
                        price: parseFloat(String(item['Harga Perolehan']).replace(/[^\d.-]/g, '')),
                        purchaseDate: new Date(item['Tanggal Transaksi Masuk (yyyy-mm-dd)']),
                        usefulLife: parseInt(item['Umur Ekonomis Aset(tahun)']),
                        condition: String(item['Kondisi Aset']).toUpperCase().includes('RUSAK') ? 'RUSAK_RINGAN' : 'BAIK',
                        sourceOfFunds: finalSource,
                        picName: item['PIC (Nama Manual)'] ? String(item['PIC (Nama Manual)']) : null,
                        specification: null, // Kosongkan saat import
                        needsRoutineMaintenance: false, // Proteksi otomatis: default tidak rutin
                        maintenanceInterval: 180, // Default 6 bulan
                        quantity: 1
                    }
                });
                successCount++;
            }
            return successCount;
        }, {
            maxWait: 10000, // 10s wait for lock
            timeout: 60000  // 60s transaction timeout
        });

        res.json({ success: result, message: `Berhasil mengimport ${result} aset.` });
    } catch (error) {
        console.error("Atomic Batch Import Error:", error);
        res.status(500).json({ error: 'Gagal Import: ' + error.message });
    }
};

exports.validateAsset = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, note } = req.body;
        const userId = req.user.id;

        if (!['UNVERIFIED', 'VALIDATED', 'NEEDS_UPDATE', 'REJECTED'].includes(status)) {
            return res.status(400).json({ error: 'Invalid validation status' });
        }

        const asset = await prisma.asset.update({
            where: { id: parseInt(id) },
            data: {
                validationStatus: status,
                validatedAt: new Date(),
                validatedById: userId,
                validationNote: note
            },
            include: { validatedBy: { select: { username: true } } }
        });

        res.json(asset);
    } catch (error) {
        console.error('Validate Asset Error:', error);
        res.status(500).json({ error: 'Failed to validate asset: ' + error.message });
    }
};

exports.validateMultipleAssets = async (req, res) => {
    try {
        const { ids, status, note } = req.body;
        const userId = req.user.id; // From verifyToken

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Invalid or empty IDs array' });
        }

        if (!['UNVERIFIED', 'VALIDATED', 'NEEDS_UPDATE', 'REJECTED'].includes(status)) {
            return res.status(400).json({ error: 'Invalid validation status' });
        }

        const result = await prisma.$transaction(async (tx) => {
            const updateResult = await tx.asset.updateMany({
                where: { id: { in: ids } },
                data: {
                    validationStatus: status,
                    validatedAt: new Date(),
                    validatedById: userId,
                    validationNote: note
                }
            });
            return updateResult;
        });

        res.json({ message: `Successfully validated ${result.count} assets`, count: result.count });
    } catch (error) {
        console.error('Bulk Validate Error:', error);
        res.status(500).json({ error: 'Failed to validate assets: ' + error.message });
    }
};

exports.getAssetPublic = async (req, res) => {
    try {
        const { id } = req.params;
        const asset = await prisma.asset.findUnique({
            where: { id: parseInt(id) },
            include: {
                category: true,

                room: true,
                unit: true,
                pic: {
                    select: { id: true, name: true, username: true }
                }
            }
        });

        if (!asset) return res.status(404).json({ error: 'Aset tidak ditemukan' });

        // Calculation Logic
        const now = new Date();
        const purchaseDate = new Date(asset.purchaseDate || asset.createdAt);

        // Months elapsed since purchase
        const diffMonths = (now.getFullYear() - purchaseDate.getFullYear()) * 12 + (now.getMonth() - purchaseDate.getMonth());
        const monthsElapsed = Math.max(0, diffMonths);

        // Total useful life in months
        const totalMonths = (asset.usefulLife || 5) * 12;

        // Straight line depreciation
        const monthlyDepreciation = asset.price / totalMonths;
        const accumulatedDepreciation = Math.min(asset.price, monthlyDepreciation * monthsElapsed);
        const currentBookValue = Math.max(0, Math.round(asset.price - accumulatedDepreciation));

        // Remaining Life
        const remainingMonthsTotal = Math.max(0, totalMonths - monthsElapsed);
        const remainingYears = Math.floor(remainingMonthsTotal / 12);
        const remainingMonths = remainingMonthsTotal % 12;

        res.json({
            id: asset.id,
            code: asset.code,
            name: asset.name,
            brand: asset.brand || '-',
            specification: asset.specification || '-',
            condition: asset.condition,
            isLendable: asset.isLendable || false,
            purchaseDate: asset.purchaseDate,
            price: asset.price,
            sourceOfFunds: asset.sourceOfFunds || 'Mandiri',
            category: asset.category?.name || '-',
            vendor: asset.vendorName || '-',
            room: asset.room?.name || '-',
            building: asset.room?.building || '-',
            unit: asset.unit?.name || '-',
            bookValue: currentBookValue,
            image: asset.image,
            remainingLife: {
                years: remainingYears,
                months: remainingMonths,
                text: `${remainingYears} Tahun ${remainingMonths} Bulan`
            }
        });
    } catch (error) {
        console.error('Public Asset GET Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.getMediaAssets = async (req, res) => {
    try {
        const assets = await prisma.asset.findMany({
            where: {
                unitId: 17
            },
            include: {
                category: { select: { name: true } },
                room: { select: { name: true, building: true } },
                unit: { select: { name: true } }
            },
            orderBy: { purchaseDate: 'desc' }
        });

        // Format hasil pencarian (Sederhana dan aman untuk public API)
        const formattedAssets = assets.map(asset => ({
            id: asset.id,
            code: asset.code,
            name: asset.name,
            brand: asset.brand || '-',
            specification: asset.specification || '-',
            condition: asset.condition,
            purchaseDate: asset.purchaseDate,
            price: asset.price,
            category: asset.category?.name || '-',
            room: asset.room?.name || '-',
            building: asset.room?.building || '-',
            unit: asset.unit?.name || '-',
            image: asset.image
        }));

        res.json({
            success: true,
            count: formattedAssets.length,
            data: formattedAssets
        });
    } catch (error) {
        console.error('Media Assets API Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.getAssetSummary = async (req, res) => {
    try {
        const { role, unitId } = req.user;
        const { unitId: filterUnitId, roomId: filterRoomId } = req.query;

        let where = {
            condition: { not: 'DISPOSED' }
        };

        const isGlobalAdmin = ['SUPER_ADMIN', 'ADMIN_ASET', 'KEPALA_BIDANG', 'BIDANG_IT', 'KABID_SARPRAS'].includes(role) || req.user.position === 'Kepala Bidang Sarana dan Prasarana';

        if (!isGlobalAdmin) {
            where.unitId = unitId;
        } else if (filterUnitId) {
            where.unitId = parseInt(filterUnitId);
        }

        if (filterRoomId) {
            where.roomId = parseInt(filterRoomId);
        }

        // 1. Get Categories Aggregation
        const categoryStats = await prisma.category.findMany({
            include: {
                _count: {
                    select: {
                        assets: {
                            where
                        }
                    }
                }
            }
        });

        const categories = categoryStats
            .map(c => ({
                id: c.id,
                name: c.name,
                count: c._count.assets
            }))
            .filter(c => c.count > 0)
            .sort((a, b) => b.count - a.count);

        // Helper to match exact words (preventing 'rACun' from matching 'AC')
        const exactWord = (word) => ([
            { name: word },
            { name: { startsWith: `${word} ` } },
            { name: { endsWith: ` ${word}` } },
            { name: { contains: ` ${word} ` } }
        ]);

        // 2. Get Keyword Statistics
        const keywords = [
            { label: 'AC', query: { OR: exactWord('AC') }, exclude: 'Outdoor' },
            { label: 'Kipas Angin', query: { OR: exactWord('Kipas') } },
            { label: 'Laptop', query: { OR: exactWord('Laptop') } },
            { label: 'Komputer', query: { OR: [...exactWord('Komputer'), ...exactWord('PC'), ...exactWord('Computer')] }, exclude: 'Meja' },
        //    { label: 'Meja', query: { OR: exactWord('Meja') } },
        //    { label: 'Kursi', query: { OR: exactWord('Kursi') } },
        //    { label: 'Proyektor', query: { OR: exactWord('Proyektor') } },
        //    { label: 'Dispenser', query: { OR: exactWord('Dispenser') } },
        ];

        const keywordCounts = await Promise.all(keywords.map(async (k) => {
            let keywordWhere = { ...where };

            if (k.query.OR) {
                keywordWhere.OR = k.query.OR;
            } else {
                keywordWhere.name = k.query;
            }

            if (k.exclude) {
                const excludeCondition = { NOT: { name: { contains: k.exclude } } };
                if (keywordWhere.AND) {
                    keywordWhere.AND.push(excludeCondition);
                } else {
                    const originalCondition = keywordWhere.OR ? { OR: keywordWhere.OR } : { name: keywordWhere.name };
                    delete keywordWhere.OR;
                    delete keywordWhere.name;
                    keywordWhere.AND = [originalCondition, excludeCondition];
                }
            }

            const count = await prisma.asset.count({ where: keywordWhere });
            return {
                label: k.label,
                count: count,
                icon: k.label
            };
        }));

        res.json({
            total: await prisma.asset.count({ where }),
            categories,
            keywordCounts: keywordCounts.filter(k => k.count > 0)
        });
    } catch (error) {
        console.error('Get Asset Summary Error:', error);
        res.status(500).json({ error: error.message });
    }
};
