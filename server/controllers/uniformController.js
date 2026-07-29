const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const xlsx = require('xlsx');

// ========== HELPER: Generate Code ==========
const generateCode = async (prefix, model) => {
    const year = new Date().getFullYear();
    const pattern = `${prefix}/${year}/`;
    
    const last = await prisma[model].findFirst({
        where: { code: { startsWith: pattern } },
        orderBy: { code: 'desc' }
    });
    
    let seq = 1;
    if (last) {
        const parts = last.code.split('/');
        const lastSeq = parseInt(parts[parts.length - 1]);
        if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }
    return `${pattern}${seq.toString().padStart(3, '0')}`;
};

// ========== WAREHOUSE ==========

exports.getWarehouses = async (req, res) => {
    try {
        const data = await prisma.uniformWarehouse.findMany({
            orderBy: { name: 'asc' },
            include: { _count: { select: { stocks: true } } }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createWarehouse = async (req, res) => {
    try {
        const data = await prisma.uniformWarehouse.create({ data: req.body });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateWarehouse = async (req, res) => {
    try {
        const { name, location } = req.body;
        const data = await prisma.uniformWarehouse.update({
            where: { id: parseInt(req.params.id) },
            data: { name, location }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteWarehouse = async (req, res) => {
    try {
        await prisma.uniformWarehouse.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'Gudang berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ========== CATEGORY ==========

exports.getCategories = async (req, res) => {
    try {
        const data = await prisma.uniformCategory.findMany({
            orderBy: { name: 'asc' },
            include: { _count: { select: { items: true } } }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createCategory = async (req, res) => {
    try {
        const data = await prisma.uniformCategory.create({ data: req.body });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const data = await prisma.uniformCategory.update({
            where: { id: parseInt(req.params.id) },
            data: req.body
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        await prisma.uniformCategory.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'Kategori berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ========== JENIS PAKAIAN (CLOTHING TYPE) ==========

exports.getClothingTypes = async (req, res) => {
    try {
        const data = await prisma.uniformClothingType.findMany({
            orderBy: { name: 'asc' },
            include: { _count: { select: { items: true } } }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createClothingType = async (req, res) => {
    try {
        const data = await prisma.uniformClothingType.create({ data: { name: req.body.name } });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateClothingType = async (req, res) => {
    try {
        const data = await prisma.uniformClothingType.update({
            where: { id: parseInt(req.params.id) },
            data: { name: req.body.name }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteClothingType = async (req, res) => {
    try {
        await prisma.uniformClothingType.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'Jenis pakaian berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ========== UKURAN (SIZE) ==========

exports.getSizes = async (req, res) => {
    try {
        const data = await prisma.uniformSize.findMany({
            orderBy: { sortOrder: 'asc' }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createSize = async (req, res) => {
    try {
        const { name, sortOrder } = req.body;
        const data = await prisma.uniformSize.create({ data: { name, sortOrder: parseInt(sortOrder || 0) } });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateSize = async (req, res) => {
    try {
        const { name, sortOrder } = req.body;
        const data = await prisma.uniformSize.update({
            where: { id: parseInt(req.params.id) },
            data: { name, sortOrder: sortOrder !== undefined ? parseInt(sortOrder) : undefined }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteSize = async (req, res) => {
    try {
        await prisma.uniformSize.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'Ukuran berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ========== UNIT (JENJANG SEKOLAH) ==========

exports.getUnits = async (req, res) => {
    try {
        const data = await prisma.uniformUnit.findMany({
            orderBy: { id: 'asc' },
            include: { _count: { select: { items: true } } }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createUnit = async (req, res) => {
    try {
        const data = await prisma.uniformUnit.create({ data: { name: req.body.name } });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateUnit = async (req, res) => {
    try {
        const data = await prisma.uniformUnit.update({
            where: { id: parseInt(req.params.id) },
            data: { name: req.body.name }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteUnit = async (req, res) => {
    try {
        await prisma.uniformUnit.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'Unit berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ========== ITEM IMPORT ==========
exports.downloadImportTemplate = (req, res) => {
    try {
        const wb = xlsx.utils.book_new();
        const wsData = [
            ['Kode (Kosongi untuk Auto)', 'Kategori *', 'Jenis Pakaian *', 'Gender *', 'Unit *', 'Vendor', 'Harga Modal *', 'Stok Minimal *', 'Ukuran (pisahkan koma) *'],
            ['', 'Nasional', 'Kemeja', 'IKHWAN', 'SMP', 'Konveksi Berkah', '150000', '5', 'S, M, L, XL']
        ];
        const ws = xlsx.utils.aoa_to_sheet(wsData);
        xlsx.utils.book_append_sheet(wb, ws, "Template_Barang");
        
        const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', 'attachment; filename="Template_Import_Barang_Seragam.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.importItems = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'File Excel tidak ditemukan' });
        
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
        
        if (rows.length < 2) return res.status(400).json({ error: 'File kosong atau tidak ada data (hanya header)' });
        
        const headers = rows[0];
        const dataRows = rows.slice(1);
        
        // Fetch all masters mapping
        const cats = await prisma.uniformCategory.findMany();
        const cTypes = await prisma.uniformClothingType.findMany();
        const units = await prisma.uniformUnit.findMany();
        const vendors = await prisma.uniformVendor.findMany();
        const sizes = await prisma.uniformSize.findMany();
        
        let successCount = 0;
        
        // We'll use a transaction for safety? We can do it one by one to avoid large transaction failures or bulk.
        // Doing sequentially to generate code and find relations
        for (let i = 0; i < dataRows.length; i++) {
            const r = dataRows[i];
            if (!r.length) continue; // skip empty rows
            
            const [codeIn, catIn, typeIn, genderIn, unitIn, vendorIn, priceIn, minStockIn, sizesIn] = r;
            if (!catIn || !typeIn || !genderIn || !unitIn || !priceIn || !sizesIn) {
                return res.status(400).json({ error: `Baris ${i + 2} ditolak: Ada kolom wajib (Kategori, Jenis, Gender, Unit, Harga, Ukuran) yang kosong.` });
            }
            
            // Validate relations strictly
            const catMatch = cats.find(c => c.name.toLowerCase() === String(catIn).trim().toLowerCase());
            if (!catMatch) return res.status(400).json({ error: `Baris ${i + 2} ditolak: Kategori '${catIn}' tidak ditemukan di Master Data.` });
            
            const typeMatch = cTypes.find(c => c.name.toLowerCase() === String(typeIn).trim().toLowerCase());
            if (!typeMatch) return res.status(400).json({ error: `Baris ${i + 2} ditolak: Jenis Pakaian '${typeIn}' tidak ditemukan di Master Data.` });
            
            const unitMatch = units.find(u => u.name.toLowerCase() === String(unitIn).trim().toLowerCase());
            if (!unitMatch) return res.status(400).json({ error: `Baris ${i + 2} ditolak: Unit '${unitIn}' tidak ditemukan di Master Data.` });
            
            let vendorMatch = null;
            if (vendorIn) {
                vendorMatch = vendors.find(v => v.name.toLowerCase() === String(vendorIn).trim().toLowerCase());
                if (!vendorMatch) return res.status(400).json({ error: `Baris ${i + 2} ditolak: Vendor '${vendorIn}' tidak ditemukan di Master Data.` });
            }
            
            const genderStr = String(genderIn).trim().toUpperCase();
            if (genderStr !== 'IKHWAN' && genderStr !== 'AKHWAT') {
                return res.status(400).json({ error: `Baris ${i + 2} ditolak: Gender harus 'IKHWAN' atau 'AKHWAT'.` });
            }
            
            const parsedSizes = String(sizesIn).split(',').map(s => s.trim()).filter(Boolean);
            if (parsedSizes.length === 0) return res.status(400).json({ error: `Baris ${i + 2} ditolak: Ukuran tidak valid.` });
            
            const sizeMap = [];
            for (let sn of parsedSizes) {
                const sMatch = sizes.find(s => s.name.toLowerCase() === sn.toLowerCase());
                if (!sMatch) return res.status(400).json({ error: `Baris ${i + 2} ditolak: Ukuran '${sn}' tidak ditemukan di Master Data.` });
                sizeMap.push(sMatch);
            }
            
            let finalCode = codeIn;
            if (!finalCode) {
                finalCode = await generateCode('SRG', 'uniformItem');
            } else {
                const existing = await prisma.uniformItem.findUnique({ where: { code: String(finalCode) } });
                if (existing) return res.status(400).json({ error: `Baris ${i + 2} ditolak: Kode barang '${finalCode}' sudah digunakan.` });
            }
            
            const generatedName = [typeMatch.name, catMatch.name, genderStr === 'IKHWAN' ? 'Ikhwan' : 'Akhwat', unitMatch.name].filter(Boolean).join(' ');
            
            const newItem = await prisma.uniformItem.create({
                data: {
                    code: finalCode,
                    name: generatedName,
                    categoryId: catMatch.id,
                    clothingTypeId: typeMatch.id,
                    gender: genderStr,
                    unitId: unitMatch.id,
                    vendorId: vendorMatch?.id || null,
                    sellPrice: parseFloat(priceIn) || 0,
                    minStock: parseInt(minStockIn) || 5
                }
            });
            
            const variantsData = sizeMap.map(sm => ({
                itemId: newItem.id,
                sizeId: sm.id,
                sizeName: sm.name,
                sku: `${newItem.code}-${sm.name}`
            }));
            
            await prisma.uniformVariant.createMany({ data: variantsData });
            successCount++;
        }
        
        res.json({ message: `Berhasil mengimport ${successCount} barang.` });
    } catch (err) {
        console.error('Import error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ========== ITEM & VARIANT ==========

exports.getItems = async (req, res) => {
    try {
        const { categoryId, targetUnit, gender, search } = req.query;
        const where = { isActive: true };
        if (categoryId) where.categoryId = parseInt(categoryId);
        if (targetUnit) where.targetUnit = targetUnit;
        if (gender) where.gender = gender;
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { code: { contains: search } }
            ];
        }

        const data = await prisma.uniformItem.findMany({
            where,
            include: {
                category: true,
                clothingType: true,
                unit: true,
                vendor: { select: { id: true, name: true } },
                variants: {
                    where: { isActive: true },
                    include: {
                        size: true,
                        stocks: { include: { warehouse: { select: { id: true, name: true } } } }
                    }
                }
            },
            orderBy: { name: 'asc' }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getItemById = async (req, res) => {
    try {
        const data = await prisma.uniformItem.findUnique({
            where: { id: parseInt(req.params.id) },
            include: {
                category: true,
                clothingType: true,
                unit: true,
                vendor: true,
                variants: {
                    include: {
                        size: true,
                        stocks: { include: { warehouse: true } }
                    }
                }
            }
        });
        if (!data) return res.status(404).json({ error: 'Item tidak ditemukan' });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createItem = async (req, res) => {
    try {
        const { name, categoryId, clothingTypeId, unitId, gender, targetUnit, vendorId, description, image, sellPrice, minStock, sizes } = req.body;
        let code = req.body.code;
        if (!code) code = await generateCode('SRG', 'uniformItem');

        const item = await prisma.uniformItem.create({
            data: {
                code, name, 
                categoryId: parseInt(categoryId),
                clothingTypeId: clothingTypeId ? parseInt(clothingTypeId) : null,
                unitId: unitId ? parseInt(unitId) : null,
                gender, 
                targetUnit: targetUnit || null, 
                vendorId: vendorId ? parseInt(vendorId) : null,
                description, image,
                sellPrice: parseFloat(sellPrice || 0),
                minStock: parseInt(minStock || 5)
            }
        });

        // Auto-create variants for each size
        if (sizes && Array.isArray(sizes) && sizes.length > 0) {
            for (const sz of sizes) {
                const sizeName = sz.name || sz;
                const sizeId = sz.sizeId ? parseInt(sz.sizeId) : null;
                await prisma.uniformVariant.create({
                    data: {
                        itemId: item.id,
                        sizeId,
                        sizeName,
                        sku: `${code}-${sizeName.toUpperCase()}`,
                        sellPrice: sz.sellPrice ? parseFloat(sz.sellPrice) : null
                    }
                });
            }
        } else {
            // Auto-create default variant so item can be used in transactions
            await prisma.uniformVariant.create({
                data: {
                    itemId: item.id,
                    sizeName: 'ALL SIZE',
                    sku: `${code}-ALL`,
                    sellPrice: parseFloat(sellPrice || 0)
                }
            });
        }

        const result = await prisma.uniformItem.findUnique({
            where: { id: item.id },
            include: { category: true, clothingType: true, unit: true, vendor: true, variants: { include: { size: true } } }
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateItem = async (req, res) => {
    try {
        const data = await prisma.uniformItem.update({
            where: { id: parseInt(req.params.id) },
            data: {
                name: req.body.name,
                categoryId: req.body.categoryId ? parseInt(req.body.categoryId) : undefined,
                clothingTypeId: req.body.clothingTypeId ? parseInt(req.body.clothingTypeId) : undefined,
                unitId: req.body.unitId ? parseInt(req.body.unitId) : undefined,
                gender: req.body.gender,
                targetUnit: req.body.targetUnit || undefined,
                vendorId: req.body.vendorId ? parseInt(req.body.vendorId) : undefined,
                description: req.body.description,
                image: req.body.image,
                sellPrice: req.body.sellPrice ? parseFloat(req.body.sellPrice) : undefined,
                minStock: req.body.minStock !== undefined ? parseInt(req.body.minStock) : undefined,
                isActive: req.body.isActive
            },
            include: { category: true, clothingType: true, unit: true, vendor: true, variants: { include: { size: true } } }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteItem = async (req, res) => {
    try {
        // Soft delete
        await prisma.uniformItem.update({
            where: { id: parseInt(req.params.id) },
            data: { isActive: false }
        });
        res.json({ message: 'Item berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ========== VARIANT ==========

exports.createVariant = async (req, res) => {
    const { itemId, sizeName, sizeId, sellPrice } = req.body;
    try {
        const item = await prisma.uniformItem.findUnique({ where: { id: parseInt(itemId) } });
        if (!item) return res.status(404).json({ error: 'Item tidak ditemukan' });

        const variant = await prisma.uniformVariant.create({
            data: {
                itemId: parseInt(itemId),
                sizeId: sizeId ? parseInt(sizeId) : null,
                sizeName: sizeName || 'DEFAULT',
                sku: `${item.code}-${(sizeName || 'DEFAULT').toUpperCase()}`,
                sellPrice: sellPrice ? parseFloat(sellPrice) : null
            }
        });
        res.json(variant);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteVariant = async (req, res) => {
    try {
        await prisma.uniformVariant.update({
            where: { id: parseInt(req.params.id) },
            data: { isActive: false }
        });
        res.json({ message: 'Variant berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ========== STOCK (Multi-Warehouse) ==========

exports.getStocks = async (req, res) => {
    try {
        const { warehouseId, search } = req.query;
        const where = {};
        if (warehouseId) where.warehouseId = parseInt(warehouseId);

        const data = await prisma.uniformStock.findMany({
            where,
            include: {
                variant: {
                    include: {
                        item: { include: { category: true, clothingType: true, vendor: true } },
                        size: true
                    }
                },
                warehouse: true
            },
            orderBy: { variant: { item: { name: 'asc' } } }
        });

        // Client-side search filter (on item name or SKU)
        let filtered = data;
        if (search) {
            const q = search.toLowerCase();
            filtered = data.filter(s =>
                s.variant.item.name.toLowerCase().includes(q) ||
                s.variant.sku.toLowerCase().includes(q) ||
                s.variant.sizeName.toLowerCase().includes(q)
            );
        }

        res.json(filtered);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.downloadStockImportTemplate = (req, res) => {
    try {
        const wb = xlsx.utils.book_new();
        const wsData = [
            ['Kategori', 'Jenis Pakaian', 'Unit', 'Gender', 'Ukuran', 'Lokasi Gudang', 'Vendor', 'Harga Modal', 'Stok', 'Stok minimal'],
            ['Seragam Nasional', 'Kemeja Panjang', 'SMP', 'IKHWAN', 'M', 'Gudang Pusat', 'Konveksi Berkah', '150000', '50', '5']
        ];
        const ws = xlsx.utils.aoa_to_sheet(wsData);
        xlsx.utils.book_append_sheet(wb, ws, "Template_Stok");
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', 'attachment; filename="Template_Import_Stok.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.importStocks = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'File Excel tidak ditemukan' });
        const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
        if (rows.length < 2) return res.status(400).json({ error: 'File kosong atau tidak valid' });

        const dataRows = rows.slice(1).filter(r => r.length > 0 && r[0]);
        let successCount = 0;

        for (let i = 0; i < dataRows.length; i++) {
            const [catIn, clothIn, unitIn, genderIn, sizeIn, whIn, vendorIn, costIn, qtyIn, minIn] = dataRows[i];
            
            if (!catIn || !clothIn || !unitIn || !genderIn || !sizeIn || !whIn || !qtyIn) {
                return res.status(400).json({ error: `Baris ${i + 2} ditolak: Kategori, Jenis, Unit, Gender, Ukuran, Lokasi Gudang, dan Stok wajib diisi.` });
            }

            // Upsert Master Data
            const cat = await prisma.uniformCategory.upsert({
                where: { name: String(catIn).trim() },
                create: { name: String(catIn).trim() },
                update: {}
            });
            const cloth = await prisma.uniformClothingType.upsert({
                where: { name: String(clothIn).trim() },
                create: { name: String(clothIn).trim() },
                update: {}
            });
            const unit = await prisma.uniformUnit.upsert({
                where: { name: String(unitIn).trim() },
                create: { name: String(unitIn).trim() },
                update: {}
            });
            const size = await prisma.uniformSize.upsert({
                where: { name: String(sizeIn).trim().toUpperCase() },
                create: { name: String(sizeIn).trim().toUpperCase() },
                update: {}
            });
            const wh = await prisma.uniformWarehouse.upsert({
                where: { name: String(whIn).trim() },
                create: { name: String(whIn).trim() },
                update: {}
            });
            let vendor = null;
            if (vendorIn) {
                vendor = await prisma.uniformVendor.upsert({
                    where: { name: String(vendorIn).trim() },
                    create: { name: String(vendorIn).trim() },
                    update: {}
                });
            }

            // Find or Create Item
            const gender = String(genderIn).trim().toUpperCase();
            const itemName = `${cat.name} ${cloth.name} ${gender} ${unit.name}`;
            
            let item = await prisma.uniformItem.findFirst({
                where: {
                    categoryId: cat.id,
                    clothingTypeId: cloth.id,
                    unitId: unit.id,
                    gender: gender,
                    vendorId: vendor ? vendor.id : null
                }
            });

            if (!item) {
                // Generate Code: SRG/UNIT/GENDER/001
                const prefix = `SRG/${unit.name.toUpperCase()}/${gender}/`;
                const lastItem = await prisma.uniformItem.findFirst({
                    where: { code: { startsWith: prefix } },
                    orderBy: { code: 'desc' }
                });
                let seq = 1;
                if (lastItem) {
                    const lastSeq = parseInt(lastItem.code.replace(prefix, ''), 10);
                    if (!isNaN(lastSeq)) seq = lastSeq + 1;
                }
                const code = `${prefix}${String(seq).padStart(3, '0')}`;

                item = await prisma.uniformItem.create({
                    data: {
                        name: itemName,
                        code,
                        categoryId: cat.id,
                        clothingTypeId: cloth.id,
                        unitId: unit.id,
                        gender: gender,
                        vendorId: vendor ? vendor.id : null,
                        sellPrice: parseFloat(costIn) || 0,
                        minStock: parseInt(minIn) || 5,
                        targetUnit: unit.name
                    }
                });
            }

            // Find or Create Variant
            let variant = await prisma.uniformVariant.findUnique({
                where: {
                    itemId_sizeName: { itemId: item.id, sizeName: size.name }
                }
            });

            if (!variant) {
                variant = await prisma.uniformVariant.create({
                    data: {
                        itemId: item.id,
                        sizeId: size.id,
                        sizeName: size.name,
                        sku: `${item.code}-${size.name}`,
                        sellPrice: item.sellPrice
                    }
                });
            }

            // Create Stock & Transaction
            const qty = parseInt(qtyIn) || 0;
            const cost = parseFloat(costIn) || item.sellPrice;

            if (qty > 0) {
                const trcCode = await generateCode('TRX/SRG', 'uniformStockTransaction');
                await prisma.$transaction(async (tx) => {
                    await tx.uniformStockTransaction.create({
                        data: {
                            code: trcCode, type: 'IN',
                            variantId: variant.id,
                            warehouseId: wh.id,
                            quantity: qty,
                            costPerUnit: cost,
                            totalCost: cost * qty,
                            vendorId: vendor ? vendor.id : null,
                            reason: 'Import Excel',
                            createdById: req.user?.id || null
                        }
                    });

                    const existingStock = await tx.uniformStock.findUnique({
                        where: { variantId_warehouseId: { variantId: variant.id, warehouseId: wh.id } }
                    });

                    let newAvgCost = cost;
                    if (existingStock && existingStock.quantity > 0) {
                        const totalOldValue = existingStock.quantity * existingStock.avgCost;
                        const totalNewValue = qty * cost;
                        newAvgCost = (totalOldValue + totalNewValue) / (existingStock.quantity + qty);
                    }

                    await tx.uniformStock.upsert({
                        where: { variantId_warehouseId: { variantId: variant.id, warehouseId: wh.id } },
                        create: { variantId: variant.id, warehouseId: wh.id, quantity: qty, avgCost: newAvgCost, modalAwal: cost, minStock: item.minStock },
                        update: { quantity: { increment: qty }, avgCost: newAvgCost }
                    });
                });
            }
            successCount++;
        }

        res.json({ message: `${successCount} stok berhasil di-import` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ========== STOCK TRANSACTION (IN/OUT/MUTATION/ADJUSTMENT) ==========

exports.getStockTransactions = async (req, res) => {
    try {
        const { type, warehouseId } = req.query;
        const where = {};
        if (type) where.type = type;
        if (warehouseId) where.warehouseId = parseInt(warehouseId);

        const data = await prisma.uniformStockTransaction.findMany({
            where,
            include: {
                variant: { include: { item: true } },
                warehouse: { select: { id: true, name: true } },
                toWarehouse: { select: { id: true, name: true } },
                vendor: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 200
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createStockTransaction = async (req, res) => {
    const { type, variantId, warehouseId, toWarehouseId, quantity, costPerUnit, vendorId, reason, note } = req.body;
    try {
        const code = await generateCode('TRX/SRG', 'uniformStockTransaction');
        const qty = parseInt(quantity);
        const cost = parseFloat(costPerUnit || 0);

        const result = await prisma.$transaction(async (tx) => {
            // 1. Create transaction record
            const trx = await tx.uniformStockTransaction.create({
                data: {
                    code, type,
                    variantId: parseInt(variantId),
                    warehouseId: parseInt(warehouseId),
                    toWarehouseId: toWarehouseId ? parseInt(toWarehouseId) : null,
                    quantity: type === 'OUT' || type === 'ADJUSTMENT' ? -Math.abs(qty) : qty,
                    costPerUnit: cost,
                    totalCost: cost * qty,
                    vendorId: vendorId ? parseInt(vendorId) : null,
                    reason, note,
                    createdById: req.user?.id || null
                }
            });

            // 2. Update stock (upsert)
            if (type === 'IN') {
                // Average Cost calculation
                const existingStock = await tx.uniformStock.findUnique({
                    where: { variantId_warehouseId: { variantId: parseInt(variantId), warehouseId: parseInt(warehouseId) } }
                });

                let newAvgCost = cost;
                if (existingStock && existingStock.quantity > 0) {
                    const totalOldValue = existingStock.quantity * existingStock.avgCost;
                    const totalNewValue = qty * cost;
                    newAvgCost = (totalOldValue + totalNewValue) / (existingStock.quantity + qty);
                }
                
                const variantData = await tx.uniformVariant.findUnique({
                    where: { id: parseInt(variantId) },
                    include: { item: { select: { minStock: true } } }
                });
                const globalMinStock = variantData?.item?.minStock || 5;

                await tx.uniformStock.upsert({
                    where: { variantId_warehouseId: { variantId: parseInt(variantId), warehouseId: parseInt(warehouseId) } },
                    create: { variantId: parseInt(variantId), warehouseId: parseInt(warehouseId), quantity: qty, avgCost: newAvgCost, modalAwal: cost, minStock: globalMinStock },
                    update: { quantity: { increment: qty }, avgCost: newAvgCost }
                });
            } else if (type === 'OUT' || type === 'ADJUSTMENT') {
                await tx.uniformStock.update({
                    where: { variantId_warehouseId: { variantId: parseInt(variantId), warehouseId: parseInt(warehouseId) } },
                    data: { quantity: { decrement: Math.abs(qty) } }
                });
            } else if (type === 'MUTATION') {
                // Kurangi dari gudang asal
                await tx.uniformStock.update({
                    where: { variantId_warehouseId: { variantId: parseInt(variantId), warehouseId: parseInt(warehouseId) } },
                    data: { quantity: { decrement: qty } }
                });
                // Tambah ke gudang tujuan
                const sourceStock = await tx.uniformStock.findUnique({
                    where: { variantId_warehouseId: { variantId: parseInt(variantId), warehouseId: parseInt(warehouseId) } }
                });
                await tx.uniformStock.upsert({
                    where: { variantId_warehouseId: { variantId: parseInt(variantId), warehouseId: parseInt(toWarehouseId) } },
                    create: { variantId: parseInt(variantId), warehouseId: parseInt(toWarehouseId), quantity: qty, avgCost: sourceStock?.avgCost || 0 },
                    update: { quantity: { increment: qty } }
                });
            }

            return trx;
        });

        res.json(result);
    } catch (error) {
        console.error('Stock Transaction Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ========== PACKAGES (SPMB) ==========

exports.getPackages = async (req, res) => {
    try {
        const data = await prisma.uniformPackage.findMany({
            where: { isActive: true },
            include: {
                items: {
                    include: { item: { select: { id: true, name: true, code: true, sellPrice: true } } }
                }
            },
            orderBy: { name: 'asc' }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createPackage = async (req, res) => {
    const { name, targetUnit, gender, price, isFixedPrice, items } = req.body;
    try {
        const pkg = await prisma.uniformPackage.create({
            data: {
                name, targetUnit, gender,
                price: parseFloat(price || 0),
                isFixedPrice: isFixedPrice !== false,
                items: {
                    create: (items || []).map(i => ({
                        itemId: parseInt(i.itemId),
                        qty: parseInt(i.qty || 1)
                    }))
                }
            },
            include: { items: { include: { item: true } } }
        });
        res.json(pkg);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updatePackage = async (req, res) => {
    const { name, targetUnit, gender, price, isFixedPrice, items, isActive } = req.body;
    const id = parseInt(req.params.id);
    try {
        // Delete existing items and recreate
        if (items) {
            await prisma.uniformPackageItem.deleteMany({ where: { packageId: id } });
        }
        const pkg = await prisma.uniformPackage.update({
            where: { id },
            data: {
                name, targetUnit, gender,
                price: price !== undefined ? parseFloat(price) : undefined,
                isFixedPrice,
                isActive,
                ...(items ? {
                    items: {
                        create: items.map(i => ({
                            itemId: parseInt(i.itemId),
                            qty: parseInt(i.qty || 1)
                        }))
                    }
                } : {})
            },
            include: { items: { include: { item: true } } }
        });
        res.json(pkg);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deletePackage = async (req, res) => {
    try {
        await prisma.uniformPackage.update({
            where: { id: parseInt(req.params.id) },
            data: { isActive: false }
        });
        res.json({ message: 'Paket berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ========== VENDOR ==========

exports.getVendors = async (req, res) => {
    try {
        const data = await prisma.uniformVendor.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createVendor = async (req, res) => {
    try {
        const data = await prisma.uniformVendor.create({ data: req.body });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateVendor = async (req, res) => {
    try {
        const data = await prisma.uniformVendor.update({
            where: { id: parseInt(req.params.id) },
            data: req.body
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteVendor = async (req, res) => {
    try {
        await prisma.uniformVendor.update({
            where: { id: parseInt(req.params.id) },
            data: { isActive: false }
        });
        res.json({ message: 'Vendor berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ========== SALES (POS / SPMB / UNIT ORDER) ==========

exports.getSales = async (req, res) => {
    try {
        const { type, status, paymentStatus, search } = req.query;
        const where = {};
        if (type) where.type = type;
        if (status) where.status = status;
        if (paymentStatus) where.paymentStatus = paymentStatus;
        if (search) {
            where.OR = [
                { code: { contains: search } },
                { customerName: { contains: search } },
                { studentName: { contains: search } }
            ];
        }

        const data = await prisma.uniformSale.findMany({
            where,
            include: {
                warehouse: { select: { id: true, name: true } },
                package: { select: { id: true, name: true } },
                items: true,
                schedule: { select: { id: true, title: true, date: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 200
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getSaleById = async (req, res) => {
    try {
        const data = await prisma.uniformSale.findUnique({
            where: { id: parseInt(req.params.id) },
            include: {
                warehouse: true,
                package: { include: { items: { include: { item: true } } } },
                items: { include: { variant: { include: { item: true } } } },
                schedule: true
            }
        });
        if (!data) return res.status(404).json({ error: 'Penjualan tidak ditemukan' });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createSale = async (req, res) => {
    const { type, warehouseId, customerName, customerPhone, studentName, studentClass, targetUnit, packageId, discount, paidAmount, paymentMethod, scheduleId, items, note } = req.body;
    try {
        const code = await generateCode('INV/SRG', 'uniformSale');

        const result = await prisma.$transaction(async (tx) => {
            // Calculate totals
            let subtotal = 0;
            const saleItems = [];

            for (const item of items) {
                const variant = await tx.uniformVariant.findUnique({
                    where: { id: parseInt(item.variantId) },
                    include: { item: true }
                });
                if (!variant) throw new Error(`Variant ID ${item.variantId} tidak ditemukan`);

                const unitPrice = variant.sellPrice || variant.item.sellPrice || 0;
                const qty = parseInt(item.qty);
                const totalPrice = unitPrice * qty;
                subtotal += totalPrice;

                // Check stock availability
                const stock = await tx.uniformStock.findUnique({
                    where: { variantId_warehouseId: { variantId: parseInt(item.variantId), warehouseId: parseInt(warehouseId) } }
                });

                const available = stock?.quantity || 0;
                const canDeliver = Math.min(qty, available);

                saleItems.push({
                    variantId: parseInt(item.variantId),
                    itemName: variant.item.name,
                    size: variant.size,
                    qty,
                    qtyDelivered: canDeliver,
                    unitPrice,
                    totalPrice,
                    status: canDeliver >= qty ? 'DELIVERED' : canDeliver > 0 ? 'BACKORDER' : 'BACKORDER'
                });

                // Reduce stock
                if (canDeliver > 0 && stock) {
                    await tx.uniformStock.update({
                        where: { id: stock.id },
                        data: { quantity: { decrement: canDeliver } }
                    });

                    // Create OUT transaction
                    const trxCode = await generateCode('TRX/SRG', 'uniformStockTransaction');
                    await tx.uniformStockTransaction.create({
                        data: {
                            code: trxCode + '-' + Date.now(),
                            type: 'OUT',
                            variantId: parseInt(item.variantId),
                            warehouseId: parseInt(warehouseId),
                            quantity: -canDeliver,
                            costPerUnit: stock.avgCost || 0,
                            totalCost: (stock.avgCost || 0) * canDeliver,
                            referenceType: 'SALE',
                            note: `Penjualan ${code}`,
                            createdById: req.user?.id || null
                        }
                    });
                }
            }

            const disc = parseFloat(discount || 0);
            const totalAmount = subtotal - disc;
            const paid = parseFloat(paidAmount || 0);
            const allDelivered = saleItems.every(i => i.qtyDelivered >= i.qty);

            const sale = await tx.uniformSale.create({
                data: {
                    code, type: type || 'RETAIL',
                    warehouseId: parseInt(warehouseId),
                    customerName, customerPhone, studentName, studentClass, targetUnit,
                    packageId: packageId ? parseInt(packageId) : null,
                    subtotal, discount: disc, totalAmount,
                    paidAmount: paid,
                    paymentStatus: paid >= totalAmount ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID',
                    paymentMethod,
                    status: allDelivered ? 'COMPLETED' : 'PARTIAL_DELIVERED',
                    scheduleId: scheduleId ? parseInt(scheduleId) : null,
                    note,
                    items: { create: saleItems }
                },
                include: { items: true, warehouse: true }
            });

            return sale;
        });

        res.json(result);
    } catch (error) {
        console.error('Create Sale Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Update payment
exports.updateSalePayment = async (req, res) => {
    const { paidAmount, paymentMethod } = req.body;
    try {
        const sale = await prisma.uniformSale.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!sale) return res.status(404).json({ error: 'Penjualan tidak ditemukan' });

        const newPaid = parseFloat(paidAmount || 0);
        const data = await prisma.uniformSale.update({
            where: { id: parseInt(req.params.id) },
            data: {
                paidAmount: newPaid,
                paymentMethod,
                paymentStatus: newPaid >= sale.totalAmount ? 'PAID' : newPaid > 0 ? 'PARTIAL' : 'UNPAID'
            }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ========== EXCHANGE (TUKAR UKURAN) ==========

exports.getExchanges = async (req, res) => {
    try {
        const data = await prisma.uniformExchange.findMany({
            include: {
                fromVariant: { include: { item: true } },
                toVariant: { include: { item: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createExchange = async (req, res) => {
    const { customerName, studentName, fromVariantId, toVariantId, qty, reason, note, warehouseId } = req.body;
    try {
        const code = await generateCode('EXC/SRG', 'uniformExchange');
        const quantity = parseInt(qty || 1);
        const whId = parseInt(warehouseId);

        const result = await prisma.$transaction(async (tx) => {
            // 1. Create exchange record
            const exchange = await tx.uniformExchange.create({
                data: {
                    code, customerName, studentName,
                    fromVariantId: parseInt(fromVariantId),
                    toVariantId: parseInt(toVariantId),
                    qty: quantity, reason, note,
                    status: 'COMPLETED',
                    createdById: req.user?.id || null
                }
            });

            // 2. Return old variant to stock (IN)
            await tx.uniformStock.upsert({
                where: { variantId_warehouseId: { variantId: parseInt(fromVariantId), warehouseId: whId } },
                create: { variantId: parseInt(fromVariantId), warehouseId: whId, quantity },
                update: { quantity: { increment: quantity } }
            });

            // 3. Deduct new variant from stock (OUT)
            await tx.uniformStock.update({
                where: { variantId_warehouseId: { variantId: parseInt(toVariantId), warehouseId: whId } },
                data: { quantity: { decrement: quantity } }
            });

            return exchange;
        });

        res.json(result);
    } catch (error) {
        console.error('Exchange Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ========== SCHEDULE ==========

exports.getSchedules = async (req, res) => {
    try {
        const data = await prisma.uniformSchedule.findMany({
            include: { _count: { select: { sales: true } } },
            orderBy: { date: 'asc' }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createSchedule = async (req, res) => {
    try {
        const data = await prisma.uniformSchedule.create({ data: req.body });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateSchedule = async (req, res) => {
    try {
        const data = await prisma.uniformSchedule.update({
            where: { id: parseInt(req.params.id) },
            data: req.body
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteSchedule = async (req, res) => {
    try {
        await prisma.uniformSchedule.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'Jadwal berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ========== DASHBOARD STATS ==========

exports.getDashboardStats = async (req, res) => {
    try {
        const { warehouseId } = req.query;
        const stockWhere = warehouseId ? { warehouseId: parseInt(warehouseId) } : {};

        const [totalItems, totalVariants, totalStock, totalSales, pendingSales, warehouseCount] = await Promise.all([
            prisma.uniformItem.count({ where: { isActive: true } }),
            prisma.uniformVariant.count({ where: { isActive: true } }),
            prisma.uniformStock.aggregate({ where: stockWhere, _sum: { quantity: true } }),
            prisma.uniformSale.count(),
            prisma.uniformSale.count({ where: { status: { in: ['PENDING', 'PARTIAL_DELIVERED'] } } }),
            prisma.uniformWarehouse.count({ where: { isActive: true } })
        ]);

        // Low stock: find items where quantity <= minStock
        const lowStockItems = await prisma.$queryRaw`
            SELECT us.id, us.quantity, us.minStock, us.modalAwal, uv.sizeName, uv.sku, ui.name as itemName, uw.name as warehouseName
            FROM seragam_stok us
            JOIN seragam_varian uv ON us.variantId = uv.id
            JOIN seragam_barang ui ON uv.itemId = ui.id
            JOIN seragam_gudang uw ON us.warehouseId = uw.id
            WHERE us.quantity <= us.minStock
            ORDER BY us.quantity ASC
            LIMIT 20
        `.catch(() => []);

        res.json({
            totalItems,
            totalVariants,
            totalStock: totalStock._sum.quantity || 0,
            lowStockCount: lowStockItems.length,
            lowStockItems,
            totalSales,
            pendingSales,
            warehouses: warehouseCount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
