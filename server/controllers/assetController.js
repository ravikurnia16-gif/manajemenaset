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
            isLendable, rentalFee,
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
                        rentalFee: rentalFee ? parseFloat(rentalFee) : null,
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
        const isGlobalAdmin = ['SUPER_ADMIN', 'ADMIN_ASET', 'KEPALA_BIDANG', 'BIDANG_IT', 'KABID_SARPRAS'].includes(role) || req.user.position === 'Kepala Bidang Sarana';
        
        let allowedUnitIds = [unitId];
        const userUnit = await prisma.unit.findUnique({ where: { id: unitId } });
        if (userUnit && userUnit.name.startsWith('Kantor Yayasan -')) {
            const parentUnit = await prisma.unit.findFirst({ where: { name: 'Kantor Yayasan' } });
            if (parentUnit) allowedUnitIds.push(parentUnit.id);
        }

        if (!isGlobalAdmin) {
            where.unitId = { in: allowedUnitIds };
        }

        // 2. Explicit Filters (if provided and allowed)
        if (filterUnitId) {
            // Allow filtering by unitId if:
            // 1. User is global admin
            // 2. User is filtering their own unit (or parent unit)
            // 3. User is specifically looking for lendable assets (Cross-unit borrowing)
            if (isGlobalAdmin || allowedUnitIds.includes(parseInt(filterUnitId)) || isLendable === 'true' || isLendable === true) {
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
            if (req.query.semanticSearch === 'true') {
                const aiService = require('../services/aiService');
                try {
                    const parsed = await aiService.parseSemanticAssetSearch(search);
                    
                    // Build complex condition from parsed JSON
                    let semanticConditions = [];

                    if (parsed.keywords && parsed.keywords.length > 0) {
                        // All keywords must match SOMEWHERE in the asset (name, brand, or spec)
                        const keywordConditions = parsed.keywords.map(kw => ({
                            OR: [
                                { name: { contains: kw } },
                                { brand: { contains: kw } },
                                { specification: { contains: kw } }
                            ]
                        }));
                        semanticConditions.push({ AND: keywordConditions });
                    }

                    if (parsed.roomName) {
                        semanticConditions.push({ room: { name: { contains: parsed.roomName } } });
                    }

                    if (parsed.categoryName) {
                        semanticConditions.push({ category: { name: { contains: parsed.categoryName } } });
                    }

                    if (parsed.condition) {
                        semanticConditions.push({ condition: parsed.condition });
                    }

                    if (semanticConditions.length > 0) {
                        where.AND = where.AND ? [...where.AND, ...semanticConditions] : semanticConditions;
                    } else {
                        // Fallback if AI returns empty
                        where.OR = [
                            { name: { contains: search } },
                            { code: { contains: search } }
                        ];
                    }
                } catch (aiError) {
                    console.error("AI Semantic Search Error:", aiError);
                    // Fallback to standard search on failure
                    where.OR = [
                        { name: { contains: search } },
                        { code: { contains: search } },
                        { unit: { name: { contains: search } } },
                        { room: { name: { contains: search } } }
                    ];
                }
            } else {
                where.OR = [
                    { name: { contains: search } },
                    { code: { contains: search } },
                    { unit: { name: { contains: search } } },
                    { room: { name: { contains: search } } }
                ];
            }
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
            let noteStr = m.completionNote || m.actionTaken || '';
            if (m.status === 'REJECTED') noteStr = m.rejectionReason || '';

            history.push({
                id: m.id,
                type: 'MAINTENANCE',
                date: m.createdAt,
                title: 'Pemeliharaan / Perbaikan',
                description: m.title,
                issue: m.description,
                note: noteStr,
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
            isLendable, rentalFee,
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
                rentalFee: rentalFee ? parseFloat(rentalFee) : null,
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

        // Filter out empty rows (e.g. trailing empty rows from Excel)
        const validAssets = assetsData.filter(item => {
            if (!item || typeof item !== 'object') return false;
            const hasAnyValue = Object.values(item).some(v => v !== null && v !== undefined && String(v).trim() !== '');
            const hasAssetName = item['Nama Aset'] && String(item['Nama Aset']).trim() !== '';
            return hasAnyValue && hasAssetName;
        });

        if (validAssets.length === 0) {
            return res.status(400).json({ error: 'File Excel tidak berisi data aset yang valid atau nama aset kosong.' });
        }

        const requiredColumns = [
            { key: 'Nama Aset', label: 'Nama Aset' },
            { key: 'Merek Aset', label: 'Merek Aset' },
            { key: 'Vendor Aset', label: 'Vendor Aset' },
            { key: 'Kategori', label: 'Kategori' },
            { key: 'Unit Aset', label: 'Unit Aset' },
            { key: 'Ruangan Aset', label: 'Ruangan Aset' },
            { key: 'Kondisi Aset', label: 'Kondisi Aset' },
            { key: 'Sumber Dana Aset', label: 'Sumber Dana Aset' },
            {
                key: ['Status Perolehan', 'Jenis Transaksi Masuk'],
                label: 'Status Perolehan'
            },
            { key: 'Tanggal Transaksi Masuk (yyyy-mm-dd)', label: 'Tanggal Transaksi Masuk (yyyy-mm-dd)' },
            { key: 'Harga Perolehan', label: 'Harga Perolehan' },
            { key: 'Umur Ekonomis Aset(tahun)', label: 'Umur Ekonomis Aset(tahun)' },
            {
                key: [
                    'Butuh Pemeliharaan (isi jumlah hari jika ya, 0 jika tidak)',
                    'Butuh Pemeliharaan (Hari / 0 jika tidak)',
                    'Butuh Pemeliharaan (ya/tidak)',
                    'Butuh Pemeliharaan'
                ],
                label: 'Butuh Pemeliharaan (isi jumlah hari jika ya, 0 jika tidak)'
            },
            {
                key: ['Bisa Dipinjam (ya/tidak)', 'Bisa Dipinjam'],
                label: 'Bisa Dipinjam (ya/tidak)'
            },
            {
                key: ['Biaya Pinjam', 'Biaya Sewa'],
                label: 'Biaya Pinjam'
            }
        ];

        // Date helper
        const parseDate = (rawDate) => {
            if (!rawDate) return null;
            if (rawDate instanceof Date && !isNaN(rawDate.getTime())) return rawDate;
            const str = String(rawDate).trim();
            const d = new Date(str);
            if (!isNaN(d.getTime())) return d;
            const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
            if (ddmmyyyy) {
                return new Date(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]));
            }
            return null;
        };

        // --- Step 1: Validation Pass (Strict) ---
        const [existingUnits, existingCategories] = await Promise.all([
            prisma.unit.findMany({ select: { name: true } }),
            prisma.category.findMany({ select: { name: true } })
        ]);
        const unitNames = existingUnits.map(u => u.name.toLowerCase());
        const categoryNames = existingCategories.map(c => c.name.toLowerCase());

        for (let i = 0; i < validAssets.length; i++) {
            const item = validAssets[i];
            const excelRowNum = i + 2; // Excel row number (1-based + 1 for header)

            // Check required fields
            for (const col of requiredColumns) {
                let val;
                if (Array.isArray(col.key)) {
                    for (const k of col.key) {
                        if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') {
                            val = item[k];
                            break;
                        }
                    }
                } else {
                    val = item[col.key];
                }

                if (val === undefined || val === null || String(val).trim() === '') {
                    return res.status(400).json({
                        error: `Data tidak lengkap di baris Excel ${excelRowNum}: ${col.label} wajib diisi.`
                    });
                }
            }

            // --- STRICT UNIT VALIDATION ---
            const unitNameInput = String(item['Unit Aset']).trim().toLowerCase();
            if (!unitNames.includes(unitNameInput)) {
                return res.status(400).json({
                    error: `Unit "${item['Unit Aset']}" di baris Excel ${excelRowNum} tidak terdaftar di sistem. Silakan sesuaikan dengan nama Unit di Master Data.`
                });
            }

            // --- STRICT CATEGORY VALIDATION ---
            const categoryInput = String(item['Kategori']).trim().toLowerCase();
            if (!categoryNames.includes(categoryInput)) {
                return res.status(400).json({
                    error: `Kategori "${item['Kategori']}" di baris Excel ${excelRowNum} tidak terdaftar di sistem. Silakan tambahkan kategori tersebut ke Master Data terlebih dahulu.`
                });
            }

            // Check numeric formats
            const rawPrice = item['Harga Perolehan'];
            const price = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice || 0).replace(/[^\d.-]/g, ''));
            if (isNaN(price) || price < 0) {
                return res.status(400).json({
                    error: `Format Harga Perolehan salah di baris Excel ${excelRowNum}: harus berupa angka nominal.`
                });
            }

            const rawLife = item['Umur Ekonomis Aset(tahun)'];
            const usefulLife = (rawLife !== undefined && rawLife !== null && String(rawLife).trim() !== '') ? parseInt(rawLife) : 5;
            if (isNaN(usefulLife) || usefulLife <= 0) {
                return res.status(400).json({
                    error: `Format Umur Ekonomis salah di baris Excel ${excelRowNum}: harus berupa angka tahun.`
                });
            }

            // Check date format
            const purchaseDate = parseDate(item['Tanggal Transaksi Masuk (yyyy-mm-dd)']);
            if (!purchaseDate) {
                return res.status(400).json({
                    error: `Format Tanggal Transaksi Masuk salah di baris Excel ${excelRowNum}: gunakan format YYYY-MM-DD.`
                });
            }
        }

        // --- Step 2: Atomic Import (Transaction) ---
        const result = await prisma.$transaction(async (tx) => {
            const seqCache = {};
            let successCount = 0;

            for (const item of validAssets) {
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

                // 4. Vendor Name
                const vendorInput = String(item['Vendor Aset'] || '').trim();

                // 5. Code Generation
                const purchaseDate = parseDate(item['Tanggal Transaksi Masuk (yyyy-mm-dd)']);
                const year = purchaseDate.getFullYear();

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

                // 6. Kondisi Matching
                const rawCond = String(item['Kondisi Aset'] || '').toUpperCase().trim();
                let condition = 'BAIK';
                if (rawCond.includes('BERAT')) condition = 'RUSAK_BERAT';
                else if (rawCond.includes('RINGAN') || rawCond.includes('RUSAK')) condition = 'RUSAK_RINGAN';
                else condition = 'BAIK';

                // 7. Sumber Dana Matching
                const SUPPORTED_FUNDING_SOURCES = ['Yayasan', 'BOS', 'Hibah', 'Pemerintah', 'Cashback', 'Mandiri', 'Lainnya'];
                const rawSource = String(item['Sumber Dana Aset'] || '').trim();
                const matchedSource = SUPPORTED_FUNDING_SOURCES.find(s => s.toLowerCase() === rawSource.toLowerCase());
                const finalSource = matchedSource || rawSource || 'Yayasan';

                // 8. Status Perolehan Matching
                const SUPPORTED_ACQUISITIONS = ['Pembelian', 'Hibah/Wakaf', 'Sewa', 'Lainnya'];
                const rawAcq = String(item['Status Perolehan'] ?? item['Jenis Transaksi Masuk'] ?? '').trim();
                let matchedAcq = SUPPORTED_ACQUISITIONS.find(a => a.toLowerCase() === rawAcq.toLowerCase());
                if (!matchedAcq) {
                    if (rawAcq.toLowerCase().includes('hibah') || rawAcq.toLowerCase().includes('wakaf')) matchedAcq = 'Hibah/Wakaf';
                    else if (rawAcq.toLowerCase().includes('sewa')) matchedAcq = 'Sewa';
                    else if (rawAcq.toLowerCase().includes('beli') || rawAcq.toLowerCase().includes('pengadaan')) matchedAcq = 'Pembelian';
                    else matchedAcq = rawAcq || 'Pembelian';
                }

                // 9. Butuh Pemeliharaan & Interval
                const rawMaint = item['Butuh Pemeliharaan (isi jumlah hari jika ya, 0 jika tidak)'] ??
                                 item['Butuh Pemeliharaan (Hari / 0 jika tidak)'] ??
                                 item['Butuh Pemeliharaan (ya/tidak)'] ??
                                 item['Butuh Pemeliharaan'];
                let needsRoutineMaintenance = false;
                let maintenanceInterval = 180;
                if (rawMaint !== undefined && rawMaint !== null) {
                    const strMaint = String(rawMaint).trim().toLowerCase();
                    const numMaint = parseInt(strMaint);
                    if (!isNaN(numMaint) && numMaint > 0) {
                        needsRoutineMaintenance = true;
                        maintenanceInterval = numMaint;
                    } else if (['ya', 'true', '1', 'y', 'yes'].includes(strMaint)) {
                        needsRoutineMaintenance = true;
                        maintenanceInterval = 180;
                    } else {
                        needsRoutineMaintenance = false;
                        maintenanceInterval = 0;
                    }
                }

                let nextMaintenanceEst = null;
                if (needsRoutineMaintenance && maintenanceInterval > 0) {
                    nextMaintenanceEst = new Date(purchaseDate.getTime() + maintenanceInterval * 24 * 60 * 60 * 1000);
                }

                // 10. Bisa Dipinjam & Biaya Pinjam
                const rawLend = item['Bisa Dipinjam (ya/tidak)'] ?? item['Bisa Dipinjam'];
                let isLendable = false;
                if (rawLend !== undefined && rawLend !== null) {
                    const strLend = String(rawLend).trim().toLowerCase();
                    if (['ya', 'true', '1', 'y', 'yes', 'bisa'].includes(strLend)) {
                        isLendable = true;
                    }
                }

                const rawRental = item['Biaya Pinjam'] ?? item['Biaya Sewa'];
                let rentalFee = null;
                if (rawRental !== undefined && rawRental !== null && String(rawRental).trim() !== '') {
                    const numRental = parseFloat(String(rawRental).replace(/[^\d.-]/g, ''));
                    if (!isNaN(numRental) && numRental > 0) {
                        rentalFee = numRental;
                    }
                }

                // 11. Parse price & usefulLife
                const rawPrice = item['Harga Perolehan'];
                const price = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice || 0).replace(/[^\d.-]/g, ''));
                const rawLife = item['Umur Ekonomis Aset(tahun)'];
                const usefulLife = (rawLife !== undefined && rawLife !== null && String(rawLife).trim() !== '') ? parseInt(rawLife) : 5;

                // 12. Create Asset
                await tx.asset.create({
                    data: {
                        code,
                        name: String(item['Nama Aset']).trim(),
                        brand: item['Merek Aset'] ? String(item['Merek Aset']).trim() : '-',
                        categoryId: category.id,
                        unitId: unit.id,
                        roomId: room.id,
                        vendorName: vendorInput || null,
                        price: price,
                        purchaseDate: purchaseDate,
                        usefulLife: usefulLife,
                        condition: condition,
                        sourceOfFunds: finalSource,
                        acquisitionStatus: matchedAcq,
                        isLendable: isLendable,
                        rentalFee: rentalFee,
                        needsRoutineMaintenance: needsRoutineMaintenance,
                        maintenanceInterval: maintenanceInterval,
                        nextMaintenanceEst: nextMaintenanceEst,
                        picName: item['PIC (Nama Manual)'] ? String(item['PIC (Nama Manual)']).trim() : null,
                        specification: null,
                        quantity: 1
                    }
                });
                successCount++;
            }
            return successCount;
        }, {
            maxWait: 10000,
            timeout: 60000
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

        // Market Value Calculation
        let nilaiKondisi = 0;
        if (asset.condition === 'BAIK') nilaiKondisi = 1;
        else if (asset.condition === 'RUSAK_RINGAN') nilaiKondisi = 0.5;
        else if (asset.condition === 'RUSAK_BERAT') nilaiKondisi = 0.2;
        
        const nilaiKalkulasi = currentBookValue * nilaiKondisi;
        
        let persentaseKategori = 0.10; // Default
        const kat = (asset.category?.name || '').toLowerCase();
        if (kat.includes('elektronik')) persentaseKategori = 0.15;
        else if (kat.includes('kendaraan')) persentaseKategori = 0.20;
        else if (kat.includes('furniture') || kat.includes('furnitur') || kat.includes('inventaris') || kat.includes('operasional')) persentaseKategori = 0.10;
        
        const nilaiMinimum = asset.price * persentaseKategori;
        const marketValue = Math.max(nilaiKalkulasi, nilaiMinimum);

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
            marketValue: Math.round(marketValue),
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

        const isGlobalAdmin = ['SUPER_ADMIN', 'ADMIN_ASET', 'KEPALA_BIDANG', 'BIDANG_IT', 'KABID_SARPRAS'].includes(role) || req.user.position === 'Kepala Bidang Sarana';

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
