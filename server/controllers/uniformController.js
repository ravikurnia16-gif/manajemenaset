const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const xlsx = require('xlsx');
const ExcelJS = require('exceljs');

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

exports.getVariants = async (req, res) => {
    try {
        const data = await prisma.uniformVariant.findMany({
            include: {
                item: { include: { category: true, clothingType: true, unit: true, vendor: true } }
            },
            orderBy: { sku: 'asc' }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.downloadItemImportTemplate = async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Template_Barang');

        sheet.columns = [
            { header: 'Kategori', key: 'cat', width: 20 },
            { header: 'Jenis Pakaian', key: 'type', width: 20 },
            { header: 'Unit', key: 'unit', width: 15 },
            { header: 'Gender', key: 'gender', width: 15 },
            { header: 'Ukuran', key: 'size', width: 15 },
            { header: 'Vendor (Opsional)', key: 'vendor', width: 20 }
        ];

        // Sample Data
        sheet.addRow(['Seragam Nasional', 'Kemeja Panjang', 'SMP', 'IKHWAN', 'M', '']);
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Template_Import_Barang.xlsx"');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.importItems = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'File Excel tidak ditemukan' });
        const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
        if (rows.length < 2) return res.status(400).json({ error: 'File kosong atau tidak valid' });

        const dataRows = rows.slice(1).filter(r => r.length > 0 && r[0]);
        let successCount = 0;

        // Pre-fetch master data
        const cats = await prisma.uniformCategory.findMany();
        const cTypes = await prisma.uniformClothingType.findMany();
        const units = await prisma.uniformUnit.findMany();
        const sizes = await prisma.uniformSize.findMany();
        const vendors = await prisma.uniformVendor.findMany();

        for (let i = 0; i < dataRows.length; i++) {
            const [catIn, clothIn, unitInRaw, genderIn, sizeIn, vendorIn] = dataRows[i];
            
            if (!catIn || !clothIn || !genderIn || !sizeIn) {
                return res.status(400).json({ error: `Baris ${i + 2} ditolak: Kategori, Jenis, Gender, dan Ukuran wajib diisi.` });
            }

            const cat = cats.find(c => c.name.toLowerCase() === String(catIn).trim().toLowerCase());
            if (!cat) return res.status(400).json({ error: `Baris ${i + 2} ditolak: Kategori '${catIn}' tidak ditemukan di Master Data.` });

            const cloth = cTypes.find(c => c.name.toLowerCase() === String(clothIn).trim().toLowerCase());
            if (!cloth) return res.status(400).json({ error: `Baris ${i + 2} ditolak: Jenis Pakaian '${clothIn}' tidak ditemukan di Master Data.` });

            const sizeNameInput = String(sizeIn).trim().toUpperCase();
            const size = sizes.find(s => s.name.toUpperCase() === sizeNameInput);
            if (!size) return res.status(400).json({ error: `Baris ${i + 2} ditolak: Ukuran '${sizeIn}' tidak ditemukan di Master Data.` });

            let vendor = null;
            if (vendorIn) {
                vendor = vendors.find(v => v.name.toLowerCase() === String(vendorIn).trim().toLowerCase());
                if (!vendor) return res.status(400).json({ error: `Baris ${i + 2} ditolak: Vendor '${vendorIn}' tidak ditemukan di Master Data.` });
            }

            const gender = String(genderIn).trim().toUpperCase();
            if (gender !== 'IKHWAN' && gender !== 'AKHWAT') {
                return res.status(400).json({ error: `Baris ${i + 2} ditolak: Gender harus IKHWAN atau AKHWAT.` });
            }

            let rawUnit = String(unitInRaw || '').trim();
            let unitList = [null];
            if (rawUnit && rawUnit.toUpperCase() !== 'UMUM' && rawUnit !== '-') {
                unitList = rawUnit.split(',').map(u => u.trim()).filter(Boolean);
            }

            for (const singleUnit of unitList) {
                let unit = null;
                if (singleUnit) {
                    unit = units.find(u => u.name.toLowerCase() === singleUnit.toLowerCase());
                    if (!unit) return res.status(400).json({ error: `Baris ${i + 2} ditolak: Unit '${singleUnit}' tidak ditemukan di Master Data.` });
                }

                const itemName = `${cloth.name} ${cat.name} ${gender === 'IKHWAN' ? 'Ikhwan' : 'Akhwat'} ${unit ? unit.name : 'Umum'}`.trim();
                
                let item = await prisma.uniformItem.findFirst({
                    where: {
                        categoryId: cat.id,
                        clothingTypeId: cloth.id,
                        unitId: unit ? unit.id : null,
                        gender: gender,
                        vendorId: vendor ? vendor.id : null
                    }
                });

                if (!item) {
                    const prefix = `SRG/${unit ? unit.name.toUpperCase() : 'ALL'}/${gender}/`;
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
                            code: code,
                            categoryId: cat.id,
                            clothingTypeId: cloth.id,
                            unitId: unit ? unit.id : null,
                            gender: gender,
                            vendorId: vendor ? vendor.id : null,
                            sellPrice: 0,
                        }
                    });
                }

                let variant = await prisma.uniformVariant.findUnique({
                    where: { itemId_sizeName: { itemId: item.id, sizeName: size.name } }
                });

                if (!variant) {
                    const sku = `${item.code}-${size.name}`;
                    variant = await prisma.uniformVariant.create({
                        data: { itemId: item.id, sizeName: size.name, sku: sku }
                    });
                }
                successCount++;
            }
        }

        res.json({ message: `Berhasil mengimpor ${successCount} data barang master.` });
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

// ========== PRICING RULES ==========

exports.getPricingRules = async (req, res) => {
    try {
        const rules = await prisma.uniformPricingRule.findMany({
            include: { category: true, clothingType: true, unit: true },
            orderBy: { id: 'desc' }
        });
        res.json(rules);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createPricingRule = async (req, res) => {
    try {
        const { categoryId, clothingTypeId, unitId, gender, sizeNames, price } = req.body;
        if (!price) return res.status(400).json({ error: 'Harga harus diisi' });

        const data = await prisma.uniformPricingRule.create({
            data: {
                categoryId: categoryId ? parseInt(categoryId) : null,
                clothingTypeId: clothingTypeId ? parseInt(clothingTypeId) : null,
                unitId: unitId ? parseInt(unitId) : null,
                gender: gender || null,
                sizeNames: sizeNames || null,
                price: parseFloat(price) || 0
            },
            include: { category: true, clothingType: true, unit: true }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deletePricingRule = async (req, res) => {
    try {
        await prisma.uniformPricingRule.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'Aturan berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.applyPricingRules = async (req, res) => {
    try {
        const rules = await prisma.uniformPricingRule.findMany({ where: { isActive: true } });
        if (!rules.length) return res.json({ message: 'Tidak ada aturan harga aktif yang ditemukan.' });

        // Sort rules by specificity (most specific first)
        const sortedRules = rules.sort((a, b) => {
            const scoreA = (a.categoryId ? 1 : 0) + (a.clothingTypeId ? 1 : 0) + (a.unitId ? 1 : 0) + (a.gender ? 1 : 0) + (a.sizeNames ? 1 : 0);
            const scoreB = (b.categoryId ? 1 : 0) + (b.clothingTypeId ? 1 : 0) + (b.unitId ? 1 : 0) + (b.gender ? 1 : 0) + (b.sizeNames ? 1 : 0);
            return scoreB - scoreA;
        });

        const variants = await prisma.uniformVariant.findMany({
            include: { item: true }
        });

        let updateCount = 0;
        
        for (const variant of variants) {
            let matchedPrice = null;
            
            for (const rule of sortedRules) {
                let match = true;
                
                if (rule.categoryId && variant.item.categoryId !== rule.categoryId) match = false;
                if (rule.clothingTypeId && variant.item.clothingTypeId !== rule.clothingTypeId) match = false;
                if (rule.unitId && variant.item.unitId !== rule.unitId) match = false;
                if (rule.gender && variant.item.gender !== rule.gender) match = false;
                
                if (rule.sizeNames) {
                    const sizes = rule.sizeNames.split(',').map(s => s.trim().toLowerCase());
                    if (!sizes.includes(variant.sizeName.toLowerCase())) match = false;
                }
                
                if (match) {
                    matchedPrice = rule.price;
                    break;
                }
            }

            if (matchedPrice !== null && variant.sellPrice !== matchedPrice) {
                await prisma.uniformVariant.update({
                    where: { id: variant.id },
                    data: { sellPrice: matchedPrice }
                });
                updateCount++;
            }
        }

        res.json({ message: `Berhasil menerapkan harga ke ${updateCount} varian barang.` });
    } catch (error) {
        console.error('Apply Pricing Error:', error);
        res.status(500).json({ error: error.message });
    }
};



// ========== ITEM & VARIANT ==========

exports.getItems = async (req, res) => {
    try {
        const items = await prisma.uniformItem.findMany({
            orderBy: { name: 'asc' },
            include: { category: true, clothingType: true, unit: true }
        });
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getVariants = async (req, res) => {
    try {
        const variants = await prisma.uniformVariant.findMany({
            include: { item: { include: { category: true, clothingType: true, unit: true } }, size: true },
            orderBy: { sku: 'asc' }
        });
        res.json(variants);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.addManualStock = async (req, res) => {
    try {
        const {
            variantId,
            kategori, jenisPakaian, unit, gender, ukuran,
            gudang, vendor, hargaModal, stok, stokMinimal
        } = req.body;

        if (!gudang || !stok) {
            return res.status(400).json({ error: 'Gudang dan Stok wajib diisi.' });
        }
        if (!variantId && (!kategori || !jenisPakaian || !gender || !ukuran)) {
            return res.status(400).json({ error: 'Pilih Barang atau isi atribut lengkap jika barang baru.' });
        }

        const qty = parseInt(stok) || 0;
        const minStock = parseInt(stokMinimal) || 0;
        const cost = parseFloat(hargaModal) || 0;

        await prisma.$transaction(async (tx) => {
            let whObj = await tx.uniformWarehouse.findFirst({ where: { name: gudang } });
            if (!whObj) whObj = await tx.uniformWarehouse.create({ data: { name: gudang, location: '' } });
            
            let vendorObj = null;
            if (vendor && vendor.trim()) {
                vendorObj = await tx.uniformVendor.findFirst({ where: { name: vendor } });
                if (!vendorObj) vendorObj = await tx.uniformVendor.create({ data: { name: vendor } });
            }

            let variant;
            if (variantId) {
                variant = await tx.uniformVariant.findUnique({ where: { id: parseInt(variantId) }, include: { item: true } });
                if (!variant) throw new Error('Variant tidak ditemukan');
            } else {
                // Master Data (Upsert)
                const catObj = await tx.uniformCategory.findFirst({ where: { name: kategori } }) || await tx.uniformCategory.create({ data: { name: kategori } });
                const typeObj = await tx.uniformClothingType.findFirst({ where: { name: jenisPakaian } }) || await tx.uniformClothingType.create({ data: { name: jenisPakaian } });
                const sizeObj = await tx.uniformSize.findFirst({ where: { name: ukuran } }) || await tx.uniformSize.create({ data: { name: ukuran } });
                
                let unitObj = null;
                if (unit && unit.trim() !== '') {
                    unitObj = await tx.uniformUnit.findFirst({ where: { name: unit } }) || await tx.uniformUnit.create({ data: { name: unit } });
                }
                
                const genderCode = gender.toUpperCase() === 'IKHWAN' ? 'IK' : gender.toUpperCase() === 'AKHWAT' ? 'AK' : 'UN';
                const unitName = unitObj ? unitObj.name : 'ALL';
                const genderName = gender.toUpperCase() === 'IKHWAN' ? 'Ikhwan' : gender.toUpperCase() === 'AKHWAT' ? 'Akhwat' : '';
                
                let item = await tx.uniformItem.findFirst({
                    where: { categoryId: catObj.id, clothingTypeId: typeObj.id, gender: gender.toUpperCase(), unitId: unitObj ? unitObj.id : null }
                });

                if (!item) {
                    const prefix = `SRG/${unitName.toUpperCase()}/${genderCode}/`;
                    const count = await tx.uniformItem.count({ where: { code: { startsWith: prefix } } });
                    const code = `${prefix}${String(count + 1).padStart(3, '0')}`;
                    const itemName = `${typeObj.name} ${catObj.name} ${genderName} ${unitName === 'ALL' ? 'Umum' : unitName}`.trim();

                    item = await tx.uniformItem.create({
                        data: {
                            code, name: itemName, categoryId: catObj.id, clothingTypeId: typeObj.id,
                            gender: gender.toUpperCase(), unitId: unitObj ? unitObj.id : null,
                            vendorId: vendorObj ? vendorObj.id : null, sellPrice: 0, minStock
                        }
                    });
                } else if (minStock > 0 && item.minStock !== minStock) {
                    await tx.uniformItem.update({ where: { id: item.id }, data: { minStock } });
                }

                const sku = `${item.code}-${sizeObj.name}`;
                variant = await tx.uniformVariant.upsert({
                    where: { sku }, update: {},
                    create: { itemId: item.id, sku, sizeId: sizeObj.id, sizeName: sizeObj.name }
                });

                // Terapkan Aturan Harga Otomatis jika ada
                const rules = await tx.uniformPricingRule.findMany({ where: { isActive: true } });
                if (rules.length > 0) {
                    const sortedRules = rules.sort((a, b) => {
                        const scoreA = (a.categoryId ? 1 : 0) + (a.clothingTypeId ? 1 : 0) + (a.unitId ? 1 : 0) + (a.gender ? 1 : 0) + (a.sizeNames ? 1 : 0);
                        const scoreB = (b.categoryId ? 1 : 0) + (b.clothingTypeId ? 1 : 0) + (b.unitId ? 1 : 0) + (b.gender ? 1 : 0) + (b.sizeNames ? 1 : 0);
                        return scoreB - scoreA;
                    });
                    for (const rule of sortedRules) {
                        let match = true;
                        if (rule.categoryId && item.categoryId !== rule.categoryId) match = false;
                        if (rule.clothingTypeId && item.clothingTypeId !== rule.clothingTypeId) match = false;
                        if (rule.unitId && item.unitId !== rule.unitId) match = false;
                        if (rule.gender && item.gender !== rule.gender) match = false;
                        if (rule.sizeNames) {
                            const sizeList = rule.sizeNames.split(',').map(s => s.trim().toLowerCase());
                            if (!sizeList.includes(variant.sizeName.toLowerCase())) match = false;
                        }
                        if (match) {
                            await tx.uniformVariant.update({ where: { id: variant.id }, data: { sellPrice: rule.price } });
                            break;
                        }
                    }
                }
            }

            // Stock
            if (qty > 0) {
                const existingStock = await tx.uniformStock.findUnique({
                    where: { variantId_warehouseId: { variantId: variant.id, warehouseId: whObj.id } }
                });

                let newAvgCost = cost;
                if (existingStock && existingStock.quantity > 0) {
                    const totalValue = (existingStock.quantity * existingStock.avgCost) + (qty * cost);
                    newAvgCost = totalValue / (existingStock.quantity + qty);
                }

                await tx.uniformStock.upsert({
                    where: { variantId_warehouseId: { variantId: variant.id, warehouseId: whObj.id } },
                    create: {
                        variantId: variant.id, warehouseId: whObj.id,
                        quantity: qty, minStock, avgCost: cost
                    },
                    update: {
                        quantity: { increment: qty },
                        minStock: minStock > 0 ? minStock : undefined,
                        avgCost: newAvgCost
                    }
                });

                const trxCode = await generateCode('TRX/SRG', 'uniformStockTransaction');
                await tx.uniformStockTransaction.create({
                    data: {
                        code: trxCode,
                        variantId: variant.id, warehouseId: whObj.id,
                        type: 'IN', quantity: qty,
                        costPerUnit: cost, vendorId: vendorObj ? vendorObj.id : null,
                        note: 'Manual Entry'
                    }
                });
            }
        });

        res.json({ message: 'Stok berhasil ditambahkan!' });
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
                        item: { include: { category: true, clothingType: true, vendor: true, unit: true } },
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

// ExcelJS is required at the top of the file

exports.downloadStockImportTemplate = async (req, res) => {
    try {
        const categories = await prisma.uniformCategory.findMany();
        const types = await prisma.uniformClothingType.findMany();
        const units = await prisma.uniformUnit.findMany();
        const sizes = await prisma.uniformSize.findMany();
        const warehouses = await prisma.uniformWarehouse.findMany();
        const vendors = await prisma.uniformVendor.findMany();

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Template_Stok');

        sheet.columns = [
            { header: 'Kategori', key: 'cat', width: 20 },
            { header: 'Jenis Pakaian', key: 'type', width: 20 },
            { header: 'Unit', key: 'unit', width: 15 },
            { header: 'Gender', key: 'gender', width: 15 },
            { header: 'Ukuran', key: 'size', width: 15 },
            { header: 'Lokasi Gudang', key: 'wh', width: 20 },
            { header: 'Vendor', key: 'vendor', width: 20 },
            { header: 'Stok', key: 'stock', width: 15 },
            { header: 'Stok minimal', key: 'min', width: 15 }
        ];

        // Sample Data
        sheet.addRow(['Seragam Nasional', 'Kemeja Panjang', 'SMP', 'IKHWAN', 'M', 'Gudang Pusat', vendors.length ? vendors[0].name : '', 50, 5]);

        // Helper to format arrays as comma-separated string for excel validation formulas
        const formatValidation = (arr, maxLen = 250) => {
            let str = `"${arr.join(',')}"`;
            if (str.length > maxLen) {
                // If the list is too long for direct validation formula, we will just use the first few elements and allow custom inputs.
                // Or better, we could create a hidden sheet. For now, limit the string length to prevent corrupted excel files.
                return `"${arr.slice(0, 15).join(',')}"`; 
            }
            return str;
        };

        const catList = categories.map(c => c.name);
        const typeList = types.map(t => t.name);
        const unitList = units.map(u => u.name);
        const sizeList = sizes.map(s => s.name);
        const whList = warehouses.map(w => w.name);
        const vendorList = vendors.map(v => v.name);

        for (let i = 2; i <= 100; i++) {
            if (catList.length) sheet.getCell(`A${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [formatValidation(catList)] };
            if (typeList.length) sheet.getCell(`B${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [formatValidation(typeList)] };
            if (unitList.length) sheet.getCell(`C${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [formatValidation(unitList)] };
            sheet.getCell(`D${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"IKHWAN,AKHWAT"'] };
            if (sizeList.length) sheet.getCell(`E${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [formatValidation(sizeList)] };
            if (whList.length) sheet.getCell(`F${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [formatValidation(whList)] };
            if (vendorList.length) sheet.getCell(`G${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [formatValidation(vendorList)] };
            
            sheet.getCell(`H${i}`).dataValidation = { type: 'whole', operator: 'greaterThanOrEqual', formulae: [0] };
            sheet.getCell(`I${i}`).dataValidation = { type: 'whole', operator: 'greaterThanOrEqual', formulae: [0] };
            sheet.getCell(`J${i}`).dataValidation = { type: 'whole', operator: 'greaterThanOrEqual', formulae: [0] };
        }

        res.setHeader('Content-Disposition', 'attachment; filename="Template_Import_Stok.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        await workbook.xlsx.write(res);
        res.end();
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

        const header = rows[0];
        const hasVendor = header.includes('Vendor');
        const dataRows = rows.slice(1).filter(r => r.length > 0 && r[0]);
        let successCount = 0;

        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const catIn = row[0];
            const clothIn = row[1];
            const unitInRaw = row[2];
            const genderIn = row[3];
            const sizeIn = row[4];
            const whIn = row[5];
            const vendorIn = hasVendor ? row[6] : null;
            const qtyIn = hasVendor ? row[7] : row[6];
            const minIn = hasVendor ? row[8] : row[7];
            
            if (!catIn || !clothIn || !genderIn || !sizeIn || !whIn || !qtyIn) {
                return res.status(400).json({ error: `Baris ${i + 2} ditolak: Kategori, Jenis, Gender, Ukuran, Lokasi Gudang, dan Stok wajib diisi.` });
            }

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
            const size = await prisma.uniformSize.upsert({
                where: { name: String(sizeIn).trim().toUpperCase() },
                create: { name: String(sizeIn).trim().toUpperCase() },
                update: {}
            });
            let wh = await prisma.uniformWarehouse.findFirst({
                where: { name: String(whIn).trim() }
            });
            if (!wh) {
                wh = await prisma.uniformWarehouse.create({
                    data: { name: String(whIn).trim() }
                });
            }

            let vendor = null;
            if (vendorIn) {
                vendor = await prisma.uniformVendor.findFirst({
                    where: { name: String(vendorIn).trim() }
                });
                if (!vendor) {
                    vendor = await prisma.uniformVendor.create({
                        data: { name: String(vendorIn).trim() }
                    });
                }
            }

            const gender = String(genderIn).trim().toUpperCase();
            
            let rawUnit = String(unitInRaw || '').trim();
            let unitList = [null];
            if (rawUnit && rawUnit.toUpperCase() !== 'UMUM' && rawUnit !== '-') {
                unitList = rawUnit.split(',').map(u => u.trim()).filter(Boolean);
            }

            for (const singleUnit of unitList) {
                let unit = null;
                if (singleUnit) {
                    unit = await prisma.uniformUnit.upsert({
                        where: { name: singleUnit },
                        create: { name: singleUnit },
                        update: {}
                    });
                }
                
                const itemName = `${cloth.name} ${cat.name} ${gender === 'IKHWAN' ? 'Ikhwan' : 'Akhwat'} ${unit ? unit.name : 'Umum'}`.trim();
                
                let item = await prisma.uniformItem.findFirst({
                    where: {
                        categoryId: cat.id,
                        clothingTypeId: cloth.id,
                        unitId: unit ? unit.id : null,
                        gender: gender,
                        vendorId: vendor ? vendor.id : null
                    }
                });

                if (!item) {
                    const prefix = `SRG/${unit ? unit.name.toUpperCase() : 'ALL'}/${gender}/`;
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
                            code: code,
                            categoryId: cat.id,
                            clothingTypeId: cloth.id,
                            unitId: unit ? unit.id : null,
                            gender: gender,
                            vendorId: vendor ? vendor.id : null,
                            sellPrice: 0,
                            minStock: parseInt(minIn) || 5
                        }
                    });
                } else if (minIn) {
                    await prisma.uniformItem.update({ where: { id: item.id }, data: { minStock: parseInt(minIn) } });
                }

                const sku = `${item.code}-${size.name}`;
                const variant = await prisma.uniformVariant.upsert({
                    where: { sku }, update: {},
                    create: { itemId: item.id, sku, sizeId: size.id, sizeName: size.name }
                });

                const currentStock = await prisma.uniformStock.findUnique({
                    where: { variantId_warehouseId: { variantId: variant.id, warehouseId: wh.id } }
                });
                
                const addQty = parseInt(qtyIn) || 0;
                
                if (currentStock) {
                    await prisma.uniformStock.update({
                        where: { id: currentStock.id },
                        data: { quantity: currentStock.quantity + addQty }
                    });
                } else {
                    await prisma.uniformStock.create({
                        data: { variantId: variant.id, warehouseId: wh.id, quantity: addQty }
                    });
                }

                await prisma.uniformStockTransaction.create({
                    data: {
                        variantId: variant.id,
                        warehouseId: wh.id,
                        type: 'IN',
                        quantity: addQty,
                        costPerUnit: 0,
                        note: 'Import Excel / Stok Awal'
                    }
                });
                
                successCount++;
            }
        }

        res.json({ message: `Berhasil mengimpor dan menambah stok ${successCount} item.` });
    } catch (error) {
        console.error("Excel Import Error:", error);
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

exports.getVariants = async (req, res) => {
    try {
        const data = await prisma.uniformVariant.findMany({
            include: {
                item: { include: { category: true, clothingType: true, unit: true, vendor: true } }
            },
            orderBy: { sku: 'asc' }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.downloadItemImportTemplate = async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Template_Barang');

        sheet.columns = [
            { header: 'Kategori', key: 'cat', width: 20 },
            { header: 'Jenis Pakaian', key: 'type', width: 20 },
            { header: 'Unit', key: 'unit', width: 15 },
            { header: 'Gender', key: 'gender', width: 15 },
            { header: 'Ukuran', key: 'size', width: 15 },
            { header: 'Vendor (Opsional)', key: 'vendor', width: 20 }
        ];

        // Sample Data
        sheet.addRow(['Seragam Nasional', 'Kemeja Panjang', 'SMP', 'IKHWAN', 'M', '']);
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Template_Import_Barang.xlsx"');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.importItems = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'File Excel tidak ditemukan' });
        const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
        if (rows.length < 2) return res.status(400).json({ error: 'File kosong atau tidak valid' });

        const dataRows = rows.slice(1).filter(r => r.length > 0 && r[0]);
        let successCount = 0;

        // Pre-fetch master data
        const cats = await prisma.uniformCategory.findMany();
        const cTypes = await prisma.uniformClothingType.findMany();
        const units = await prisma.uniformUnit.findMany();
        const sizes = await prisma.uniformSize.findMany();
        const vendors = await prisma.uniformVendor.findMany();

        for (let i = 0; i < dataRows.length; i++) {
            const [catIn, clothIn, unitIn, genderIn, sizeIn, vendorIn] = dataRows[i];
            
            if (!catIn || !clothIn || !genderIn || !sizeIn) {
                return res.status(400).json({ error: `Baris ${i + 2} ditolak: Kategori, Jenis, Gender, dan Ukuran wajib diisi.` });
            }

            // Validate Master Data (Case-insensitive matching)
            const cat = cats.find(c => c.name.toLowerCase() === String(catIn).trim().toLowerCase());
            if (!cat) return res.status(400).json({ error: `Baris ${i + 2} ditolak: Kategori '${catIn}' tidak ditemukan di Master Data.` });

            const cloth = cTypes.find(c => c.name.toLowerCase() === String(clothIn).trim().toLowerCase());
            if (!cloth) return res.status(400).json({ error: `Baris ${i + 2} ditolak: Jenis Pakaian '${clothIn}' tidak ditemukan di Master Data.` });

            let unit = null;
            if (unitIn && String(unitIn).trim() !== '' && String(unitIn).trim().toUpperCase() !== 'UMUM' && String(unitIn).trim() !== '-') {
                unit = units.find(u => u.name.toLowerCase() === String(unitIn).trim().toLowerCase());
                if (!unit) return res.status(400).json({ error: `Baris ${i + 2} ditolak: Unit '${unitIn}' tidak ditemukan di Master Data.` });
            }

            const sizeNameInput = String(sizeIn).trim().toUpperCase();
            const size = sizes.find(s => s.name.toUpperCase() === sizeNameInput);
            if (!size) return res.status(400).json({ error: `Baris ${i + 2} ditolak: Ukuran '${sizeIn}' tidak ditemukan di Master Data.` });

            let vendor = null;
            if (vendorIn) {
                vendor = vendors.find(v => v.name.toLowerCase() === String(vendorIn).trim().toLowerCase());
                if (!vendor) return res.status(400).json({ error: `Baris ${i + 2} ditolak: Vendor '${vendorIn}' tidak ditemukan di Master Data.` });
            }

            const gender = String(genderIn).trim().toUpperCase();
            if (gender !== 'IKHWAN' && gender !== 'AKHWAT') {
                return res.status(400).json({ error: `Baris ${i + 2} ditolak: Gender harus IKHWAN atau AKHWAT.` });
            }

            const itemName = `${cloth.name} ${cat.name} ${gender === 'IKHWAN' ? 'Ikhwan' : 'Akhwat'} ${unit ? unit.name : 'Umum'}`.trim();
            
            // Find or Create Item
            let item = await prisma.uniformItem.findFirst({
                where: {
                    categoryId: cat.id,
                    clothingTypeId: cloth.id,
                    unitId: unit ? unit.id : null,
                    gender: gender,
                    vendorId: vendor ? vendor.id : null
                }
            });

            if (!item) {
                const prefix = `SRG/${unit ? unit.name.toUpperCase() : 'ALL'}/${gender}/`;
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
                        code: code,
                        categoryId: cat.id,
                        clothingTypeId: cloth.id,
                        unitId: unit ? unit.id : null,
                        gender: gender,
                        vendorId: vendor ? vendor.id : null,
                        sellPrice: 0,
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
                const sku = `${item.code}-${size.name}`;
                variant = await prisma.uniformVariant.create({
                    data: { itemId: item.id, sizeName: size.name, sku: sku }
                });
            }
            successCount++;
        }

        res.json({ message: `Berhasil mengimpor ${successCount} data barang master.` });
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

// ========== PRICING RULES ==========

exports.getPricingRules = async (req, res) => {
    try {
        const rules = await prisma.uniformPricingRule.findMany({
            include: { category: true, clothingType: true, unit: true },
            orderBy: { id: 'desc' }
        });
        res.json(rules);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createPricingRule = async (req, res) => {
    try {
        const { categoryId, clothingTypeId, unitId, gender, sizeNames, price } = req.body;
        if (!price) return res.status(400).json({ error: 'Harga harus diisi' });

        const data = await prisma.uniformPricingRule.create({
            data: {
                categoryId: categoryId ? parseInt(categoryId) : null,
                clothingTypeId: clothingTypeId ? parseInt(clothingTypeId) : null,
                unitId: unitId ? parseInt(unitId) : null,
                gender: gender || null,
                sizeNames: sizeNames || null,
                price: parseFloat(price) || 0
            },
            include: { category: true, clothingType: true, unit: true }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deletePricingRule = async (req, res) => {
    try {
        await prisma.uniformPricingRule.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'Aturan berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.applyPricingRules = async (req, res) => {
    try {
        const rules = await prisma.uniformPricingRule.findMany({ where: { isActive: true } });
        if (!rules.length) return res.json({ message: 'Tidak ada aturan harga aktif yang ditemukan.' });

        // Sort rules by specificity (most specific first)
        const sortedRules = rules.sort((a, b) => {
            const scoreA = (a.categoryId ? 1 : 0) + (a.clothingTypeId ? 1 : 0) + (a.unitId ? 1 : 0) + (a.gender ? 1 : 0) + (a.sizeNames ? 1 : 0);
            const scoreB = (b.categoryId ? 1 : 0) + (b.clothingTypeId ? 1 : 0) + (b.unitId ? 1 : 0) + (b.gender ? 1 : 0) + (b.sizeNames ? 1 : 0);
            return scoreB - scoreA;
        });

        const variants = await prisma.uniformVariant.findMany({
            include: { item: true }
        });

        let updateCount = 0;
        
        for (const variant of variants) {
            let matchedPrice = null;
            
            for (const rule of sortedRules) {
                let match = true;
                
                if (rule.categoryId && variant.item.categoryId !== rule.categoryId) match = false;
                if (rule.clothingTypeId && variant.item.clothingTypeId !== rule.clothingTypeId) match = false;
                if (rule.unitId && variant.item.unitId !== rule.unitId) match = false;
                if (rule.gender && variant.item.gender !== rule.gender) match = false;
                
                if (rule.sizeNames) {
                    const sizes = rule.sizeNames.split(',').map(s => s.trim().toLowerCase());
                    if (!sizes.includes(variant.sizeName.toLowerCase())) match = false;
                }
                
                if (match) {
                    matchedPrice = rule.price;
                    break;
                }
            }

            if (matchedPrice !== null && variant.sellPrice !== matchedPrice) {
                await prisma.uniformVariant.update({
                    where: { id: variant.id },
                    data: { sellPrice: matchedPrice }
                });
                updateCount++;
            }
        }

        res.json({ message: `Berhasil menerapkan harga ke ${updateCount} varian barang.` });
    } catch (error) {
        console.error('Apply Pricing Error:', error);
        res.status(500).json({ error: error.message });
    }
};



// ========== ITEM & VARIANT ==========

exports.getItems = async (req, res) => {
    try {
        const items = await prisma.uniformItem.findMany({
            orderBy: { name: 'asc' },
            include: { category: true, clothingType: true, unit: true }
        });
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getVariants = async (req, res) => {
    try {
        const variants = await prisma.uniformVariant.findMany({
            include: { item: { include: { category: true, clothingType: true, unit: true } }, size: true },
            orderBy: { sku: 'asc' }
        });
        res.json(variants);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.addManualStock = async (req, res) => {
    try {
        const {
            variantId,
            kategori, jenisPakaian, unit, gender, ukuran,
            gudang, vendor, hargaModal, stok, stokMinimal
        } = req.body;

        if (!gudang || !stok) {
            return res.status(400).json({ error: 'Gudang dan Stok wajib diisi.' });
        }
        if (!variantId && (!kategori || !jenisPakaian || !gender || !ukuran)) {
            return res.status(400).json({ error: 'Pilih Barang atau isi atribut lengkap jika barang baru.' });
        }

        const qty = parseInt(stok) || 0;
        const minStock = parseInt(stokMinimal) || 0;
        const cost = parseFloat(hargaModal) || 0;

        await prisma.$transaction(async (tx) => {
            let whObj = await tx.uniformWarehouse.findFirst({ where: { name: gudang } });
            if (!whObj) whObj = await tx.uniformWarehouse.create({ data: { name: gudang, location: '' } });
            
            let vendorObj = null;
            if (vendor && vendor.trim()) {
                vendorObj = await tx.uniformVendor.findFirst({ where: { name: vendor } });
                if (!vendorObj) vendorObj = await tx.uniformVendor.create({ data: { name: vendor } });
            }

            let variant;
            if (variantId) {
                variant = await tx.uniformVariant.findUnique({ where: { id: parseInt(variantId) }, include: { item: true } });
                if (!variant) throw new Error('Variant tidak ditemukan');
            } else {
                // Master Data (Upsert)
                const catObj = await tx.uniformCategory.findFirst({ where: { name: kategori } }) || await tx.uniformCategory.create({ data: { name: kategori } });
                const typeObj = await tx.uniformClothingType.findFirst({ where: { name: jenisPakaian } }) || await tx.uniformClothingType.create({ data: { name: jenisPakaian } });
                const sizeObj = await tx.uniformSize.findFirst({ where: { name: ukuran } }) || await tx.uniformSize.create({ data: { name: ukuran } });
                
                let unitObj = null;
                if (unit && unit.trim() !== '') {
                    unitObj = await tx.uniformUnit.findFirst({ where: { name: unit } }) || await tx.uniformUnit.create({ data: { name: unit } });
                }
                
                const genderCode = gender.toUpperCase() === 'IKHWAN' ? 'IK' : gender.toUpperCase() === 'AKHWAT' ? 'AK' : 'UN';
                const unitName = unitObj ? unitObj.name : 'ALL';
                const genderName = gender.toUpperCase() === 'IKHWAN' ? 'Ikhwan' : gender.toUpperCase() === 'AKHWAT' ? 'Akhwat' : '';
                
                let item = await tx.uniformItem.findFirst({
                    where: { categoryId: catObj.id, clothingTypeId: typeObj.id, gender: gender.toUpperCase(), unitId: unitObj ? unitObj.id : null }
                });

                if (!item) {
                    const prefix = `SRG/${unitName.toUpperCase()}/${genderCode}/`;
                    const count = await tx.uniformItem.count({ where: { code: { startsWith: prefix } } });
                    const code = `${prefix}${String(count + 1).padStart(3, '0')}`;
                    const itemName = `${typeObj.name} ${catObj.name} ${genderName} ${unitName === 'ALL' ? 'Umum' : unitName}`.trim();

                    item = await tx.uniformItem.create({
                        data: {
                            code, name: itemName, categoryId: catObj.id, clothingTypeId: typeObj.id,
                            gender: gender.toUpperCase(), unitId: unitObj ? unitObj.id : null,
                            vendorId: vendorObj ? vendorObj.id : null, sellPrice: 0, minStock
                        }
                    });
                } else if (minStock > 0 && item.minStock !== minStock) {
                    await tx.uniformItem.update({ where: { id: item.id }, data: { minStock } });
                }

                const sku = `${item.code}-${sizeObj.name}`;
                variant = await tx.uniformVariant.upsert({
                    where: { sku }, update: {},
                    create: { itemId: item.id, sku, sizeId: sizeObj.id, sizeName: sizeObj.name }
                });

                // Terapkan Aturan Harga Otomatis jika ada
                const rules = await tx.uniformPricingRule.findMany({ where: { isActive: true } });
                if (rules.length > 0) {
                    const sortedRules = rules.sort((a, b) => {
                        const scoreA = (a.categoryId ? 1 : 0) + (a.clothingTypeId ? 1 : 0) + (a.unitId ? 1 : 0) + (a.gender ? 1 : 0) + (a.sizeNames ? 1 : 0);
                        const scoreB = (b.categoryId ? 1 : 0) + (b.clothingTypeId ? 1 : 0) + (b.unitId ? 1 : 0) + (b.gender ? 1 : 0) + (b.sizeNames ? 1 : 0);
                        return scoreB - scoreA;
                    });
                    for (const rule of sortedRules) {
                        let match = true;
                        if (rule.categoryId && item.categoryId !== rule.categoryId) match = false;
                        if (rule.clothingTypeId && item.clothingTypeId !== rule.clothingTypeId) match = false;
                        if (rule.unitId && item.unitId !== rule.unitId) match = false;
                        if (rule.gender && item.gender !== rule.gender) match = false;
                        if (rule.sizeNames) {
                            const sizeList = rule.sizeNames.split(',').map(s => s.trim().toLowerCase());
                            if (!sizeList.includes(variant.sizeName.toLowerCase())) match = false;
                        }
                        if (match) {
                            await tx.uniformVariant.update({ where: { id: variant.id }, data: { sellPrice: rule.price } });
                            break;
                        }
                    }
                }
            }

            // Stock
            if (qty > 0) {
                const existingStock = await tx.uniformStock.findUnique({
                    where: { variantId_warehouseId: { variantId: variant.id, warehouseId: whObj.id } }
                });

                let newAvgCost = cost;
                if (existingStock && existingStock.quantity > 0) {
                    const totalValue = (existingStock.quantity * existingStock.avgCost) + (qty * cost);
                    newAvgCost = totalValue / (existingStock.quantity + qty);
                }

                await tx.uniformStock.upsert({
                    where: { variantId_warehouseId: { variantId: variant.id, warehouseId: whObj.id } },
                    create: {
                        variantId: variant.id, warehouseId: whObj.id,
                        quantity: qty, minStock, avgCost: cost
                    },
                    update: {
                        quantity: { increment: qty },
                        minStock: minStock > 0 ? minStock : undefined,
                        avgCost: newAvgCost
                    }
                });

                const trxCode = await generateCode('TRX/SRG', 'uniformStockTransaction');
                await tx.uniformStockTransaction.create({
                    data: {
                        code: trxCode,
                        variantId: variant.id, warehouseId: whObj.id,
                        type: 'IN', quantity: qty,
                        costPerUnit: cost, vendorId: vendorObj ? vendorObj.id : null,
                        note: 'Manual Entry'
                    }
                });
            }
        });

        res.json({ message: 'Stok berhasil ditambahkan!' });
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
                        item: { include: { category: true, clothingType: true, vendor: true, unit: true } },
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

// ExcelJS is required at the top of the file

exports.downloadStockImportTemplate = async (req, res) => {
    try {
        const categories = await prisma.uniformCategory.findMany();
        const types = await prisma.uniformClothingType.findMany();
        const units = await prisma.uniformUnit.findMany();
        const sizes = await prisma.uniformSize.findMany();
        const warehouses = await prisma.uniformWarehouse.findMany();
        const vendors = await prisma.uniformVendor.findMany();

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Template_Stok');

        sheet.columns = [
            { header: 'Kategori', key: 'cat', width: 20 },
            { header: 'Jenis Pakaian', key: 'type', width: 20 },
            { header: 'Unit', key: 'unit', width: 15 },
            { header: 'Gender', key: 'gender', width: 15 },
            { header: 'Ukuran', key: 'size', width: 15 },
            { header: 'Lokasi Gudang', key: 'wh', width: 20 },
            { header: 'Vendor', key: 'vendor', width: 20 },
            { header: 'Stok', key: 'stock', width: 15 },
            { header: 'Stok minimal', key: 'min', width: 15 }
        ];

        // Sample Data
        sheet.addRow(['Seragam Nasional', 'Kemeja Panjang', 'SMP', 'IKHWAN', 'M', 'Gudang Pusat', vendors.length ? vendors[0].name : '', 50, 5]);

        // Helper to format arrays as comma-separated string for excel validation formulas
        const formatValidation = (arr, maxLen = 250) => {
            let str = `"${arr.join(',')}"`;
            if (str.length > maxLen) {
                // If the list is too long for direct validation formula, we will just use the first few elements and allow custom inputs.
                // Or better, we could create a hidden sheet. For now, limit the string length to prevent corrupted excel files.
                return `"${arr.slice(0, 15).join(',')}"`; 
            }
            return str;
        };

        const catList = categories.map(c => c.name);
        const typeList = types.map(t => t.name);
        const unitList = units.map(u => u.name);
        const sizeList = sizes.map(s => s.name);
        const whList = warehouses.map(w => w.name);
        const vendorList = vendors.map(v => v.name);

        for (let i = 2; i <= 100; i++) {
            if (catList.length) sheet.getCell(`A${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [formatValidation(catList)] };
            if (typeList.length) sheet.getCell(`B${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [formatValidation(typeList)] };
            if (unitList.length) sheet.getCell(`C${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [formatValidation(unitList)] };
            sheet.getCell(`D${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"IKHWAN,AKHWAT"'] };
            if (sizeList.length) sheet.getCell(`E${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [formatValidation(sizeList)] };
            if (whList.length) sheet.getCell(`F${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [formatValidation(whList)] };
            if (vendorList.length) sheet.getCell(`G${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [formatValidation(vendorList)] };
            
            sheet.getCell(`H${i}`).dataValidation = { type: 'whole', operator: 'greaterThanOrEqual', formulae: [0] };
            sheet.getCell(`I${i}`).dataValidation = { type: 'whole', operator: 'greaterThanOrEqual', formulae: [0] };
            sheet.getCell(`J${i}`).dataValidation = { type: 'whole', operator: 'greaterThanOrEqual', formulae: [0] };
        }

        res.setHeader('Content-Disposition', 'attachment; filename="Template_Import_Stok.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        await workbook.xlsx.write(res);
        res.end();
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
            const [catIn, clothIn, unitIn, genderIn, sizeIn, whIn, vendorIn, qtyIn, minIn] = dataRows[i];
            
            if (!catIn || !clothIn || !genderIn || !sizeIn || !whIn || !qtyIn) {
                return res.status(400).json({ error: `Baris ${i + 2} ditolak: Kategori, Jenis, Gender, Ukuran, Lokasi Gudang, dan Stok wajib diisi.` });
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
            let unit = null;
            if (unitIn && String(unitIn).trim() !== '' && String(unitIn).trim().toUpperCase() !== 'UMUM' && String(unitIn).trim() !== '-') {
                unit = await prisma.uniformUnit.upsert({
                    where: { name: String(unitIn).trim() },
                    create: { name: String(unitIn).trim() },
                    update: {}
                });
            }
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
            const itemName = `${cloth.name} ${cat.name} ${gender === 'IKHWAN' ? 'Ikhwan' : 'Akhwat'} ${unit ? unit.name : 'Umum'}`.trim();
            
            let item = await prisma.uniformItem.findFirst({
                where: {
                    categoryId: cat.id,
                    clothingTypeId: cloth.id,
                    unitId: unit ? unit.id : null,
                    gender: gender,
                    vendorId: vendor ? vendor.id : null
                }
            });

            if (!item) {
                // Generate Code: SRG/UNIT/GENDER/001
                const prefix = `SRG/${unit ? unit.name.toUpperCase() : 'ALL'}/${gender}/`;
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
                        code: code,
                        categoryId: cat.id,
                        clothingTypeId: cloth.id,
                        unitId: unit.id,
                        gender: gender,
                        vendorId: vendor ? vendor.id : null,
                        sellPrice: 0,
                        minStock: parseInt(minIn) || 5
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
                        const totalValue = (existingStock.quantity * existingStock.avgCost) + (qty * cost);
                        newAvgCost = totalValue / (existingStock.quantity + qty);
                    }

                    await tx.uniformStock.upsert({
                        where: { variantId_warehouseId: { variantId: variant.id, warehouseId: wh.id } },
                        create: {
                            variantId: variant.id, warehouseId: wh.id,
                            quantity: qty, avgCost: cost, minStock: item.minStock
                        },
                        update: {
                            quantity: { increment: qty },
                            avgCost: newAvgCost,
                            minStock: item.minStock
                        }
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
            let finalNote = note;
            if (!finalNote) {
                if (type === 'IN') finalNote = 'Penambahan Stok Manual';
                else if (type === 'OUT') finalNote = 'Pengurangan Stok Manual';
                else if (type === 'ADJUSTMENT') finalNote = `Penyesuaian Stok: ${reason || ''}`;
                else if (type === 'MUTATION') {
                    const fromWh = await tx.uniformWarehouse.findUnique({ where: { id: parseInt(warehouseId) } });
                    const toWh = await tx.uniformWarehouse.findUnique({ where: { id: parseInt(toWarehouseId) } });
                    finalNote = `Pindah Gudang dari ${fromWh?.name || 'Gudang'} ke ${toWh?.name || 'Gudang'}`;
                }
            }

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
                    reason, note: finalNote,
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
                    const totalValue = (existingStock.quantity * existingStock.avgCost) + (qty * cost);
                    newAvgCost = totalValue / (existingStock.quantity + qty);
                }

                await tx.uniformStock.upsert({
                    where: { variantId_warehouseId: { variantId: parseInt(variantId), warehouseId: parseInt(warehouseId) } },
                    create: {
                        variantId: parseInt(variantId),
                        warehouseId: parseInt(warehouseId),
                        quantity: qty,
                        avgCost: cost
                    },
                    update: {
                        quantity: { increment: qty },
                        avgCost: newAvgCost
                    }
                });
            } else if (type === 'OUT' || type === 'ADJUSTMENT') {
                // Check stock availability
                const stock = await tx.uniformStock.findUnique({
                    where: { variantId_warehouseId: { variantId: parseInt(variantId), warehouseId: parseInt(warehouseId) } }
                });
                if (!stock || stock.quantity < Math.abs(qty)) {
                    throw new Error('Stok tidak mencukupi di gudang asal');
                }
                
                await tx.uniformStock.update({
                    where: { variantId_warehouseId: { variantId: parseInt(variantId), warehouseId: parseInt(warehouseId) } },
                    data: { quantity: { decrement: Math.abs(qty) } }
                });
            } else if (type === 'MUTATION') {
                // Check stock availability
                const stock = await tx.uniformStock.findUnique({
                    where: { variantId_warehouseId: { variantId: parseInt(variantId), warehouseId: parseInt(warehouseId) } }
                });
                if (!stock || stock.quantity < qty) {
                    throw new Error('Stok tidak mencukupi di gudang asal');
                }

                // Decrement origin
                await tx.uniformStock.update({
                    where: { variantId_warehouseId: { variantId: parseInt(variantId), warehouseId: parseInt(warehouseId) } },
                    data: { quantity: { decrement: qty } }
                });

                // Increment destination
                await tx.uniformStock.upsert({
                    where: { variantId_warehouseId: { variantId: parseInt(variantId), warehouseId: parseInt(toWarehouseId) } },
                    create: {
                        variantId: parseInt(variantId),
                        warehouseId: parseInt(toWarehouseId),
                        quantity: qty,
                        avgCost: stock.avgCost // bawa avg cost dari asal
                    },
                    update: {
                        quantity: { increment: qty }
                    }
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
                    include: { item: { include: { category: true, clothingType: true, unit: true } } }
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
            orderBy: { name: 'asc' },
            include: {
                selections: { include: { project: true } },
                mous: { include: { project: true } },
                evaluations: { include: { project: true } }
            }
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
                package: { select: { id: true, name: true } }, // Legacy
                salePackages: { include: { package: { select: { id: true, name: true } } } },
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
                package: { include: { items: { include: { item: true } } } }, // Legacy
                salePackages: { include: { package: { include: { items: { include: { item: true } } } } } },
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

const { generateDocumentNumber } = require('../services/documentNumberingService');

exports.createSale = async (req, res) => {
    let { type, warehouseId, customerName, customerPhone, studentName, studentClass, targetUnit, packageId, discount, paidAmount, paymentMethod, scheduleId, items, packages, note, status } = req.body;
    try {
        if (!warehouseId) {
            const firstWh = await prisma.uniformWarehouse.findFirst();
            if (firstWh) warehouseId = firstWh.id;
        }

        let code;
        if (type === 'SPMB' || type === 'UNIT_ORDER') {
            code = await generateDocumentNumber('Invoice', 'INVOICE');
        } else {
            code = await generateCode('INV/SRG', 'uniformSale');
        }

        const result = await prisma.$transaction(async (tx) => {
            let subtotal = 0;
            const saleItems = [];
            const salePackagesData = [];
            const isPending = status === 'PENDING';

            const processItem = async (item, unitPriceOverride, salePackageIndex) => {
                const variant = await tx.uniformVariant.findUnique({
                    where: { id: parseInt(item.variantId) },
                    include: { item: true }
                });
                if (!variant) throw new Error(`Variant ID ${item.variantId} tidak ditemukan`);

                let unitPrice = unitPriceOverride !== undefined ? unitPriceOverride : (variant.sellPrice || variant.item.sellPrice || 0);

                const qty = parseInt(item.qty);
                const totalPrice = unitPrice * qty;
                if (unitPriceOverride === undefined) { // Not SPMB/Unit Packages
                    subtotal += totalPrice;
                }

                const stock = await tx.uniformStock.findUnique({
                    where: { variantId_warehouseId: { variantId: parseInt(item.variantId), warehouseId: parseInt(warehouseId) } }
                });

                const available = stock ? stock.quantity : 0;
                const canDeliver = isPending ? 0 : Math.min(qty, available);

                saleItems.push({
                    variantId: parseInt(item.variantId),
                    itemName: variant.item.name,
                    size: variant.sizeName || variant.size?.name,
                    qty,
                    qtyDelivered: canDeliver,
                    unitPrice,
                    totalPrice,
                    status: canDeliver >= qty ? 'DELIVERED' : 'BACKORDER',
                    _packageIndex: salePackageIndex // Temporary internal field to link back
                });

                if (canDeliver > 0 && stock) {
                    await tx.uniformStock.update({
                        where: { variantId_warehouseId: { variantId: parseInt(item.variantId), warehouseId: parseInt(warehouseId) } },
                        data: { quantity: { decrement: canDeliver } }
                    });
                    
                    const totalCostValue = (stock.avgCost || 0) * canDeliver;

                    const trxCode = await generateCode('TRX/SRG', 'uniformStockTransaction');
                    await tx.uniformStockTransaction.create({
                        data: {
                            code: trxCode + '-' + Date.now() + Math.floor(Math.random()*1000),
                            type: 'OUT',
                            variantId: parseInt(item.variantId),
                            warehouseId: parseInt(warehouseId),
                            quantity: -canDeliver,
                            costPerUnit: totalCostValue / canDeliver,
                            totalCost: totalCostValue,
                            referenceType: 'SALE',
                            note: type === 'SPMB' ? 'Pembelian Paket SPMB' : `Pembelian dari ${customerName || studentName || 'Pelanggan'}`,
                            createdById: req.user?.id || null
                        }
                    });
                }
            };

            // Process New Multi-Package Format
            if (packages && packages.length > 0) {
                for (let i = 0; i < packages.length; i++) {
                    const p = packages[i];
                    subtotal += p.qty * p.price;
                    salePackagesData.push({
                        packageId: parseInt(p.packageId),
                        qty: p.qty,
                        price: p.price
                    });
                    for (const item of p.items) {
                        await processItem(item, 0, i); // Price is 0 for items inside packages
                    }
                }
            } else if (items && items.length > 0) {
                // Legacy / Retail format
                let pkg = null;
                if ((type === 'SPMB' || type === 'UNIT_ORDER') && packageId) {
                    pkg = await tx.uniformPackage.findUnique({ where: { id: parseInt(packageId) } });
                    const uniqueSizes = [...new Set(items.map(i => i.size))];
                    const totalPackages = uniqueSizes.reduce((sum, size) => {
                        const sample = items.find(i => i.size === size);
                        return sum + (sample ? parseInt(sample.qty) : 0);
                    }, 0);
                    subtotal = totalPackages * pkg.price;
                    salePackagesData.push({
                        packageId: parseInt(packageId),
                        qty: totalPackages,
                        price: pkg.price
                    });
                }

                for (const item of items) {
                    await processItem(item, pkg ? 0 : undefined, pkg ? 0 : undefined);
                }
            }

            const disc = parseFloat(discount || 0);
            const totalAmount = subtotal - disc;
            const paid = parseFloat(paidAmount || 0);
            const allDelivered = saleItems.length > 0 && saleItems.every(i => i.qtyDelivered >= i.qty);

            // Create sale first to get ID, then we will attach items with their specific package ID if needed
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
                    status: isPending ? 'PENDING' : (allDelivered ? 'COMPLETED' : 'PARTIAL_DELIVERED'),
                    scheduleId: scheduleId ? parseInt(scheduleId) : null,
                    note,
                    salePackages: {
                        create: salePackagesData
                    }
                },
                include: { salePackages: true }
            });

            // Now create items linking to the created salePackages if applicable
            const itemsToCreate = saleItems.map(si => {
                const pkgIdx = si._packageIndex;
                delete si._packageIndex;
                
                let salePackageId = null;
                if (pkgIdx !== undefined && sale.salePackages && sale.salePackages[pkgIdx]) {
                    salePackageId = sale.salePackages[pkgIdx].id;
                }
                
                return {
                    ...si,
                    saleId: sale.id,
                    salePackageId
                };
            });

            if (itemsToCreate.length > 0) {
                await tx.uniformSaleItem.createMany({ data: itemsToCreate });
            }

            return await tx.uniformSale.findUnique({
                where: { id: sale.id },
                include: { items: true, salePackages: true, warehouse: true }
            });
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

exports.deleteSale = async (req, res) => {
    try {
        const saleId = parseInt(req.params.id);
        
        const sale = await prisma.uniformSale.findUnique({
            where: { id: saleId },
            include: { items: true }
        });

        if (!sale) {
            return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
        }

        if (sale.status !== 'PENDING') {
            return res.status(400).json({ error: 'Pesanan yang sudah diproses (sebagian/seluruhnya) tidak dapat dihapus. Harap kembalikan stok secara manual jika ingin membatalkan.' });
        }

        await prisma.uniformSale.delete({
            where: { id: saleId }
        });

        res.json({ message: 'Pesanan berhasil dihapus' });
    } catch (error) {
        console.error('Delete Sale Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Fulfill Pending Sale
exports.manageSaleItems = async (req, res) => {
    const { itemUpdates } = req.body;
    try {
        const saleId = parseInt(req.params.id);
        
        if (!itemUpdates || !Array.isArray(itemUpdates)) {
            return res.status(400).json({ error: 'Data update tidak valid' });
        }

        const result = await prisma.$transaction(async (tx) => {
            const sale = await tx.uniformSale.findUnique({
                where: { id: saleId },
                include: { items: true }
            });

            if (!sale) throw new Error('Pesanan tidak ditemukan');
            
            const itemsMap = new Map(sale.items.map(i => [i.id, i]));
            let subtotalAdjustment = 0;

            for (const update of itemUpdates) {
                const item = itemsMap.get(parseInt(update.saleItemId));
                if (!item) continue;
                
                const oldStatus = item.status;
                const newStatus = update.status;
                
                if (oldStatus === newStatus) continue;

                const qty = item.qty;
                const generateTrxCode = async (prefix) => {
                    const latest = await tx.uniformStockTransaction.findFirst({
                        where: { code: { startsWith: prefix } },
                        orderBy: { id: 'desc' }
                    });
                    const now = new Date();
                    const year = now.getFullYear();
                    let nextNum = 1;
                    if (latest) {
                        const parts = latest.code.split('/');
                        if (parts.length === 4 && parts[2] === year.toString()) {
                            nextNum = parseInt(parts[3]) + 1;
                        }
                    }
                    return `${prefix}/${year}/${nextNum.toString().padStart(3, '0')}`;
                };

                // PENDING/INDENT/TIDAK_TERSEDIA -> SEDIA (Mutation: Source -> Transit)
                if (['PENDING', 'INDENT', 'TIDAK_TERSEDIA'].includes(oldStatus) && newStatus === 'SEDIA') {
                    const sourceWhId = parseInt(update.sourceWarehouseId);
                    const transitWhId = parseInt(update.transitWarehouseId);
                    if (!sourceWhId || !transitWhId) throw new Error(`Pilih gudang asal dan gudang transit untuk item ${item.itemName}`);
                    
                    const stockSource = await tx.uniformStock.findUnique({
                        where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: sourceWhId } }
                    });
                    if (!stockSource || stockSource.quantity < qty) throw new Error(`Stok ${item.itemName} di gudang asal tidak mencukupi`);
                    
                    await tx.uniformStock.update({
                        where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: sourceWhId } },
                        data: { quantity: { decrement: qty } }
                    });
                    
                    await tx.uniformStock.upsert({
                        where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: transitWhId } },
                        create: { variantId: item.variantId, warehouseId: transitWhId, quantity: qty, avgCost: stockSource.avgCost },
                        update: { quantity: { increment: qty } }
                    });

                    const trxCode = await generateTrxCode('TRX/SRG');
                    await tx.uniformStockTransaction.create({
                        data: {
                            code: trxCode + '-MUT-' + Math.floor(Math.random()*1000),
                            type: 'MUTATION',
                            variantId: item.variantId,
                            warehouseId: sourceWhId,
                            toWarehouseId: transitWhId,
                            quantity: qty,
                            costPerUnit: stockSource.avgCost,
                            totalCost: stockSource.avgCost * qty,
                            referenceType: 'SALE',
                            referenceId: sale.id,
                            note: `Pemindahan ke Gudang Transit untuk Pesanan ${sale.code}`,
                            createdById: req.user?.id || null
                        }
                    });
                }
                
                // PENDING/INDENT/TIDAK_TERSEDIA/SEDIA -> DIAMBIL
                else if (['PENDING', 'INDENT', 'TIDAK_TERSEDIA', 'SEDIA'].includes(oldStatus) && newStatus === 'DIAMBIL') {
                    let whId;
                    if (oldStatus === 'SEDIA') {
                        whId = parseInt(update.transitWarehouseId); // Need to know which transit warehouse it was in
                        if (!whId) throw new Error(`Pilih gudang transit (asal ambil) untuk item ${item.itemName}`);
                    } else {
                        whId = parseInt(update.sourceWarehouseId); // Terjual langsung
                        if (!whId) throw new Error(`Pilih gudang asal untuk penjualan langsung item ${item.itemName}`);
                    }
                    
                    const stock = await tx.uniformStock.findUnique({
                        where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: whId } }
                    });
                    if (!stock || stock.quantity < qty) throw new Error(`Stok ${item.itemName} tidak mencukupi untuk DIAMBIL`);
                    
                    await tx.uniformStock.update({
                        where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: whId } },
                        data: { quantity: { decrement: qty } }
                    });
                    
                    const trxCode = await generateTrxCode('TRX/SRG');
                    await tx.uniformStockTransaction.create({
                        data: {
                            code: trxCode + '-OUT-' + Math.floor(Math.random()*1000),
                            type: 'OUT',
                            variantId: item.variantId,
                            warehouseId: whId,
                            quantity: -qty,
                            costPerUnit: stock.avgCost,
                            totalCost: stock.avgCost * qty,
                            referenceType: 'SALE',
                            referenceId: sale.id,
                            note: `Barang DIAMBIL untuk Pesanan ${sale.code}`,
                            createdById: req.user?.id || null
                        }
                    });
                    
                    // Increment delivered qty
                    await tx.uniformSaleItem.update({
                        where: { id: item.id },
                        data: { qtyDelivered: qty } // fully delivered
                    });
                }
                
                // SEDIA -> BATAL
                else if (oldStatus === 'SEDIA' && newStatus === 'BATAL') {
                    const transitWhId = parseInt(update.transitWarehouseId);
                    const returnWhId = parseInt(update.returnWarehouseId);
                    if (!transitWhId || !returnWhId) throw new Error(`Pilih gudang transit dan gudang pengembalian untuk membatalkan item ${item.itemName}`);
                    
                    const stockTransit = await tx.uniformStock.findUnique({
                        where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: transitWhId } }
                    });
                    if (!stockTransit || stockTransit.quantity < qty) throw new Error(`Stok ${item.itemName} di gudang transit tidak ditemukan untuk dibatalkan`);
                    
                    await tx.uniformStock.update({
                        where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: transitWhId } },
                        data: { quantity: { decrement: qty } }
                    });
                    
                    await tx.uniformStock.upsert({
                        where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: returnWhId } },
                        create: { variantId: item.variantId, warehouseId: returnWhId, quantity: qty, avgCost: stockTransit.avgCost },
                        update: { quantity: { increment: qty } }
                    });

                    const trxCode = await generateTrxCode('TRX/SRG');
                    await tx.uniformStockTransaction.create({
                        data: {
                            code: trxCode + '-MUT-' + Math.floor(Math.random()*1000),
                            type: 'MUTATION',
                            variantId: item.variantId,
                            warehouseId: transitWhId,
                            toWarehouseId: returnWhId,
                            quantity: qty,
                            costPerUnit: stockTransit.avgCost,
                            totalCost: stockTransit.avgCost * qty,
                            referenceType: 'SALE',
                            referenceId: sale.id,
                            note: `Pengembalian barang batal dari Gudang Transit untuk Pesanan ${sale.code}`,
                            createdById: req.user?.id || null
                        }
                    });
                    
                    subtotalAdjustment -= item.totalPrice;
                }
                
                // PENDING/INDENT/TIDAK_TERSEDIA -> BATAL
                else if (['PENDING', 'INDENT', 'TIDAK_TERSEDIA'].includes(oldStatus) && newStatus === 'BATAL') {
                    subtotalAdjustment -= item.totalPrice;
                }
                
                // DIAMBIL -> BATAL
                else if (oldStatus === 'DIAMBIL' && newStatus === 'BATAL') {
                    const returnWhId = parseInt(update.returnWarehouseId);
                    if (!returnWhId) throw new Error(`Pilih gudang pengembalian untuk item ${item.itemName}`);
                    
                    await tx.uniformStock.upsert({
                        where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: returnWhId } },
                        create: { variantId: item.variantId, warehouseId: returnWhId, quantity: qty, avgCost: 0 },
                        update: { quantity: { increment: qty } }
                    });

                    const trxCode = await generateTrxCode('TRX/SRG');
                    await tx.uniformStockTransaction.create({
                        data: {
                            code: trxCode + '-IN-' + Math.floor(Math.random()*1000),
                            type: 'IN',
                            variantId: item.variantId,
                            warehouseId: returnWhId,
                            quantity: qty,
                            costPerUnit: 0,
                            totalCost: 0,
                            referenceType: 'SALE',
                            referenceId: sale.id,
                            note: `Pengembalian barang batal (sudah diambil) untuk Pesanan ${sale.code}`,
                            createdById: req.user?.id || null
                        }
                    });
                    
                    subtotalAdjustment -= item.totalPrice;
                    await tx.uniformSaleItem.update({
                        where: { id: item.id },
                        data: { qtyDelivered: 0 }
                    });
                }
                
                // DIAMBIL -> SEDIA (Undo pickup)
                else if (oldStatus === 'DIAMBIL' && newStatus === 'SEDIA') {
                    const returnWhId = parseInt(update.returnWarehouseId); // Should be transit warehouse
                    if (!returnWhId) throw new Error(`Pilih gudang transit pengembalian untuk item ${item.itemName}`);
                    
                    await tx.uniformStock.upsert({
                        where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: returnWhId } },
                        create: { variantId: item.variantId, warehouseId: returnWhId, quantity: qty, avgCost: 0 },
                        update: { quantity: { increment: qty } }
                    });

                    const trxCode = await generateTrxCode('TRX/SRG');
                    await tx.uniformStockTransaction.create({
                        data: {
                            code: trxCode + '-IN-' + Math.floor(Math.random()*1000),
                            type: 'IN',
                            variantId: item.variantId,
                            warehouseId: returnWhId,
                            quantity: qty,
                            costPerUnit: 0,
                            totalCost: 0,
                            referenceType: 'SALE',
                            referenceId: sale.id,
                            note: `Pembatalan pengambilan, kembali ke Gudang Transit untuk Pesanan ${sale.code}`,
                            createdById: req.user?.id || null
                        }
                    });
                    
                    await tx.uniformSaleItem.update({
                        where: { id: item.id },
                        data: { qtyDelivered: 0 }
                    });
                }
                
                // Save item status
                await tx.uniformSaleItem.update({
                    where: { id: item.id },
                    data: { status: newStatus }
                });
                
                // update local map
                item.status = newStatus;
            }

            // Update Sale Status and Totals
            let newStatus = sale.status;
            let allFinal = true;
            let anyPending = false;
            let anySedia = false;
            
            for (const item of itemsMap.values()) {
                if (item.status !== 'DIAMBIL' && item.status !== 'BATAL') {
                    allFinal = false;
                }
                if (['PENDING', 'INDENT', 'TIDAK_TERSEDIA'].includes(item.status)) {
                    anyPending = true;
                }
                if (item.status === 'SEDIA') {
                    anySedia = true;
                }
            }
            
            if (allFinal && itemsMap.size > 0) {
                newStatus = 'SELESAI';
            } else if (anySedia || Array.from(itemsMap.values()).some(i => i.status === 'DIAMBIL')) {
                newStatus = 'PROSES';
            } else {
                newStatus = 'PENDING';
            }

            // Adjust invoice
            const newSubtotal = Math.max(0, sale.subtotal + subtotalAdjustment);
            const newTotalAmount = Math.max(0, newSubtotal - sale.discount);
            let paymentStatus = sale.paymentStatus;
            if (newTotalAmount === 0) {
                paymentStatus = 'PAID';
            } else if (sale.paidAmount >= newTotalAmount) {
                paymentStatus = 'PAID';
            } else if (sale.paidAmount > 0) {
                paymentStatus = 'PARTIAL';
            } else {
                paymentStatus = 'UNPAID';
            }

            const updatedSale = await tx.uniformSale.update({
                where: { id: saleId },
                data: {
                    status: newStatus,
                    subtotal: newSubtotal,
                    totalAmount: newTotalAmount,
                    paymentStatus
                },
                include: { items: true }
            });

            return updatedSale;
        });

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

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

exports.deleteSale = async (req, res) => {
    try {
        const saleId = parseInt(req.params.id);
        
        const sale = await prisma.uniformSale.findUnique({
            where: { id: saleId },
            include: { items: true }
        });

        if (!sale) {
            return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
        }

        if (sale.status !== 'PENDING') {
            return res.status(400).json({ error: 'Pesanan yang sudah diproses (sebagian/seluruhnya) tidak dapat dihapus. Harap kembalikan stok secara manual jika ingin membatalkan.' });
        }

        await prisma.uniformSale.delete({
            where: { id: saleId }
        });

        res.json({ message: 'Pesanan berhasil dihapus' });
    } catch (error) {
        console.error('Delete Sale Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Fulfill Pending Sale
exports.fulfillSale = async (req, res) => {
    const { warehouseId, fulfillments } = req.body;
    try {
        const saleId = parseInt(req.params.id);
        
        if (!warehouseId && (!fulfillments || !Array.isArray(fulfillments))) {
            return res.status(400).json({ error: 'Data fulfillment tidak valid' });
        }

        const result = await prisma.$transaction(async (tx) => {
            const sale = await tx.uniformSale.findUnique({
                where: { id: saleId },
                include: { items: true }
            });

            if (!sale) throw new Error('Pesanan tidak ditemukan');
            if (sale.status !== 'PENDING' && sale.status !== 'PARTIAL_DELIVERED') {
                throw new Error('Pesanan sudah selesai diproses');
            }

            // Map current items so we can track updates
            const itemsMap = new Map(sale.items.map(i => [i.id, i]));

            const processFulfillment = async (item, whId, requestQty) => {
                const needed = item.qty - item.qtyDelivered;
                if (needed <= 0 || requestQty <= 0) return;

                const actualReqQty = Math.min(requestQty, needed);
                
                const stock = await tx.uniformStock.findUnique({
                    where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: whId } }
                });

                const available = stock ? stock.quantity : 0;
                
                if (available < actualReqQty) {
                    throw new Error(`Stok tidak mencukupi untuk ${item.itemName} (Ukuran: ${item.size}). Tersedia: ${available}, Dibutuhkan: ${actualReqQty}`);
                }
                
                const canDeliver = actualReqQty;

                if (canDeliver > 0) {
                    await tx.uniformStock.update({
                        where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: whId } },
                        data: { quantity: { decrement: canDeliver } }
                    });

                    const totalCostValue = (stock.avgCost || 0) * canDeliver;
                    const trxCode = await generateCode('TRX/SRG', 'uniformStockTransaction');
                    
                    await tx.uniformStockTransaction.create({
                        data: {
                            code: trxCode + '-' + Date.now() + Math.floor(Math.random()*1000),
                            type: 'OUT',
                            variantId: item.variantId,
                            warehouseId: whId,
                            quantity: -canDeliver,
                            costPerUnit: totalCostValue / canDeliver,
                            totalCost: totalCostValue,
                            referenceType: 'SALE',
                            note: sale.type === 'SPMB' ? 'Pembelian Paket SPMB' : `Pembelian dari ${sale.customerName || sale.studentName || 'Pelanggan'}`,
                            createdById: req.user?.id || null
                        }
                    });

                    await tx.uniformSaleItem.update({
                        where: { id: item.id },
                        data: {
                            qtyDelivered: { increment: canDeliver },
                            status: (item.qtyDelivered + canDeliver) >= item.qty ? 'DELIVERED' : 'BACKORDER'
                        }
                    });

                    item.qtyDelivered += canDeliver;
                }
            };

            if (fulfillments && Array.isArray(fulfillments)) {
                for (const reqF of fulfillments) {
                    const item = itemsMap.get(parseInt(reqF.saleItemId));
                    if (!item) continue;
                    await processFulfillment(item, parseInt(reqF.warehouseId), parseInt(reqF.qty));
                }
            } else if (warehouseId) {
                const whId = parseInt(warehouseId);
                for (const item of sale.items) {
                    await processFulfillment(item, whId, item.qty - item.qtyDelivered);
                }
            }

            const allItemsDelivered = Array.from(itemsMap.values()).every(i => i.qtyDelivered >= i.qty);

            const updatedSale = await tx.uniformSale.update({
                where: { id: saleId },
                data: {
                    status: allItemsDelivered ? 'COMPLETED' : 'PARTIAL_DELIVERED'
                }
            });

            return updatedSale;
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateSalePayment = async (req, res) => {
    try {
        const saleId = parseInt(req.params.id);
        const { paymentStatus } = req.body;
        
        if (!['PAID', 'UNPAID', 'PARTIAL'].includes(paymentStatus)) {
            return res.status(400).json({ error: 'Status pembayaran tidak valid' });
        }

        const updatedSale = await prisma.uniformSale.update({
            where: { id: saleId },
            data: { paymentStatus }
        });

        res.json(updatedSale);
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
    const { reason, note, warehouseId, exchanges, fromVariantId, toVariantId, qty, studentName } = req.body;
    try {
        const code = await generateCode('EXC/SRG', 'uniformExchange');
        const whId = parseInt(warehouseId);

        let itemsToExchange = exchanges || [];
        if (itemsToExchange.length === 0 && fromVariantId && toVariantId) {
            itemsToExchange = [{ fromVariantId, toVariantId, qty: qty || 1 }];
        }

        if (itemsToExchange.length === 0) throw new Error('Tidak ada barang yang ditukar');

        const result = await prisma.$transaction(async (tx) => {
            const exchangeRecords = [];

            for (const item of itemsToExchange) {
                const quantity = parseInt(item.qty || 1);
                const fVId = parseInt(item.fromVariantId);
                const tVId = parseInt(item.toVariantId);

                // 1. Create exchange record
                const exchange = await tx.uniformExchange.create({
                    data: {
                        code, 
                        customerName: '-', // removed from form
                        studentName: studentName || '-', // restored from form
                        fromVariantId: fVId,
                        toVariantId: tVId,
                        qty: quantity, 
                        reason, note,
                        status: 'COMPLETED',
                        createdById: req.user?.id || null
                    }
                });
                exchangeRecords.push(exchange);

                // 2. Return old variant to stock (IN)
                await tx.uniformStock.upsert({
                    where: { variantId_warehouseId: { variantId: fVId, warehouseId: whId } },
                    create: { variantId: fVId, warehouseId: whId, quantity },
                    update: { quantity: { increment: quantity } }
                });

                // 3. Deduct new variant from stock (OUT)
                const stockOut = await tx.uniformStock.findUnique({
                    where: { variantId_warehouseId: { variantId: tVId, warehouseId: whId } }
                });

                if (!stockOut || stockOut.quantity < quantity) {
                    throw new Error('Stok pengganti tidak mencukupi untuk salah satu barang');
                }

                await tx.uniformStock.update({
                    where: { variantId_warehouseId: { variantId: tVId, warehouseId: whId } },
                    data: { quantity: { decrement: quantity } }
                });
            }

            return exchangeRecords;
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

// ========== VENDOR LIFECYCLE (PROJECT, SELECTION, MOU, EVALUATION) ==========

exports.getProjects = async (req, res) => {
    try {
        const projects = await prisma.uniformProject.findMany({
            orderBy: { year: 'desc' },
            include: {
                selections: {
                    include: { vendor: true }
                },
                mous: {
                    include: { vendor: true }
                },
                evaluations: {
                    include: { vendor: true }
                },
                projectItems: {
                    include: { variant: { include: { item: true } } }
                }
            }
        });
        res.json(projects);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createProject = async (req, res) => {
    try {
        const { year, title, targetQuantity, status, note, items, projectType, directVendorId } = req.body;
        
        const parsedYear = parseInt(year);

        const itemMap = new Map();
        if (items) {
            items.forEach(i => {
                const vId = parseInt(i.variantId);
                const qty = parseInt(i.quantity);
                itemMap.set(vId, (itemMap.get(vId) || 0) + qty);
            });
        }
        const projectItemsData = Array.from(itemMap.entries()).map(([variantId, quantity]) => ({ variantId, quantity }));
        
        const data = await prisma.$transaction(async (tx) => {
            const proj = await tx.uniformProject.create({
                data: { 
                    year: parsedYear, 
                    title, 
                    targetQuantity: parseInt(targetQuantity || 0), 
                    status, 
                    note,
                    projectItems: {
                        create: projectItemsData
                    }
                }
            });

            if (projectType === 'PENUNJUKAN_LANGSUNG' && directVendorId) {
                await tx.uniformVendorSelection.create({
                    data: {
                        projectId: proj.id,
                        vendorId: parseInt(directVendorId),
                        status: 'DIPILIH',
                        reason: 'Penunjukan Langsung'
                    }
                });
            }

            return proj;
        });

        res.json(data);
    } catch (error) {
        console.error('Create Project Error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.updateProject = async (req, res) => {
    try {
        const { year, title, targetQuantity, status, note, items, projectType, directVendorId } = req.body;
        const projectId = parseInt(req.params.id);
        const parsedYear = parseInt(year);

        const data = await prisma.$transaction(async (tx) => {
            if (items) {
                const itemMap = new Map();
                items.forEach(i => {
                    const vId = parseInt(i.variantId);
                    const qty = parseInt(i.quantity);
                    itemMap.set(vId, (itemMap.get(vId) || 0) + qty);
                });
                const projectItemsData = Array.from(itemMap.entries()).map(([variantId, quantity]) => ({ variantId, quantity }));

                await tx.uniformProjectItem.deleteMany({ where: { projectId } });
                if (projectItemsData.length > 0) {
                    await tx.uniformProjectItem.createMany({
                        data: projectItemsData.map(pi => ({ ...pi, projectId }))
                    });
                }
            }

            if (projectType === 'PENUNJUKAN_LANGSUNG' && directVendorId) {
                const existingSelection = await tx.uniformVendorSelection.findFirst({
                    where: { projectId, vendorId: parseInt(directVendorId) }
                });
                
                if (!existingSelection) {
                    await tx.uniformVendorSelection.create({
                        data: {
                            projectId,
                            vendorId: parseInt(directVendorId),
                            status: 'DIPILIH',
                            reason: 'Penunjukan Langsung'
                        }
                    });
                }
            }

            return tx.uniformProject.update({
                where: { id: projectId },
                data: { year: parsedYear, title, targetQuantity: parseInt(targetQuantity || 0), status, note }
            });
        });
        res.json(data);
    } catch (error) {
        console.error('Update Project Error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.createVendorSelection = async (req, res) => {
    try {
        const { projectId, vendorId, proposedPrice, status, reason } = req.body;
        let proposalFileUrl = null;
        if (req.file) {
            proposalFileUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        }

        const data = await prisma.uniformVendorSelection.create({
            data: {
                projectId: parseInt(projectId),
                vendorId: parseInt(vendorId),
                proposedPrice: parseFloat(proposedPrice || 0),
                status: status || 'MENUNGGU',
                reason,
                proposalFileUrl
            }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateVendorSelection = async (req, res) => {
    try {
        const { proposedPrice, status, reason } = req.body;
        
        let updateData = {
            proposedPrice: parseFloat(proposedPrice || 0),
            status,
            reason
        };

        if (req.file) {
            updateData.proposalFileUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        }

        const data = await prisma.uniformVendorSelection.update({
            where: { id: parseInt(req.params.id) },
            data: updateData
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createVendorMoU = async (req, res) => {
    try {
        const { projectId, vendorId, mouNumber, startDate, endDate, status } = req.body;
        let fileUrl = null;
        if (req.file) {
            fileUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        }

        const data = await prisma.uniformVendorMoU.create({
            data: {
                projectId: parseInt(projectId),
                vendorId: parseInt(vendorId),
                mouNumber,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                status: status || 'DRAFT',
                fileUrl
            }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateVendorMoU = async (req, res) => {
    try {
        const { mouNumber, startDate, endDate, status } = req.body;
        
        let updateData = {
            mouNumber,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            status
        };

        if (req.file) {
            updateData.fileUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        }

        const data = await prisma.uniformVendorMoU.update({
            where: { id: parseInt(req.params.id) },
            data: updateData
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateVendorRating = async (vendorId) => {
    try {
        console.log('[VendorRating] Calculating for vendorId:', vendorId);
        const evaluations = await prisma.uniformVendorEvaluation.findMany({
            where: { vendorId: parseInt(vendorId) }
        });
        
        let totalOrders = evaluations.length;
        console.log('[VendorRating] Found evaluations:', totalOrders);
        let avgRating = 0;
        let avgOnTime = 0;
        let avgReject = 0;
        
        if (totalOrders > 0) {
            avgRating = evaluations.reduce((sum, ev) => sum + (parseFloat(ev.rating) || 0), 0) / totalOrders;
            avgOnTime = evaluations.reduce((sum, ev) => sum + (parseFloat(ev.onTimeRate) || 0), 0) / totalOrders;
            avgReject = evaluations.reduce((sum, ev) => sum + (parseFloat(ev.rejectRate) || 0), 0) / totalOrders;
        }
        
        console.log('[VendorRating] Averages - Rating:', avgRating, 'OnTime:', avgOnTime, 'Reject:', avgReject);
        
        await prisma.uniformVendor.update({
            where: { id: parseInt(vendorId) },
            data: {
                rating: avgRating || 0,
                onTimeRate: avgOnTime || 0,
                rejectRate: avgReject || 0,
                totalOrders: totalOrders || 0
            }
        });
        console.log('[VendorRating] Successfully updated vendor:', vendorId);
    } catch (err) {
        console.error('[VendorRating] Error:', err.message);
    }
};

exports.syncAllVendorRatings = async (req, res) => {
    try {
        const vendors = await prisma.uniformVendor.findMany();
        for (const v of vendors) {
            await updateVendorRating(v.id);
        }
        res.json({ message: 'Sync complete' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createVendorEvaluation = async (req, res) => {
    try {
        const { projectId, vendorId, rating, onTimeRate, rejectRate, notes } = req.body;
        const data = await prisma.uniformVendorEvaluation.create({
            data: {
                projectId: parseInt(projectId),
                vendorId: parseInt(vendorId),
                rating: parseFloat(rating || 0),
                onTimeRate: parseFloat(onTimeRate || 0),
                rejectRate: parseFloat(rejectRate || 0),
                notes
            }
        });
        await updateVendorRating(vendorId);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateVendorEvaluation = async (req, res) => {
    try {
        const { rating, onTimeRate, rejectRate, notes } = req.body;
        const data = await prisma.uniformVendorEvaluation.update({
            where: { id: parseInt(req.params.id) },
            data: {
                rating: parseFloat(rating || 0),
                onTimeRate: parseFloat(onTimeRate || 0),
                rejectRate: parseFloat(rejectRate || 0),
                notes
            }
        });
        await updateVendorRating(data.vendorId);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.receiveProjectGoods = async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const { warehouseId, items, isFinal } = req.body; // items: [{ variantId, quantity }]
        
        if (!warehouseId || !items || items.length === 0) {
            return res.status(400).json({ error: 'Data penerimaan tidak valid. Pastikan gudang dan rincian barang diisi.' });
        }

        const project = await prisma.uniformProject.findUnique({
            where: { id: projectId },
            include: { selections: true, projectItems: true }
        });

        if (!project) return res.status(404).json({ error: 'Proyek tidak ditemukan' });

        const selectedVendor = project.selections.find(s => s.status === 'DIPILIH');
        const vendorId = selectedVendor ? selectedVendor.vendorId : null;

        const data = await prisma.$transaction(async (tx) => {
            // Track the updated quantities to check completion later
            const updatedProjectItems = [...project.projectItems];

            // Iterate over received items
            for (const item of items) {
                const qty = parseInt(item.quantity) || 0;
                
                // Update receivedQuantity in projectItem
                const projectItemIndex = updatedProjectItems.findIndex(pi => pi.variantId === parseInt(item.variantId));
                if (projectItemIndex !== -1) {
                    const pi = updatedProjectItems[projectItemIndex];
                    const newReceived = pi.receivedQuantity + qty;
                    updatedProjectItems[projectItemIndex] = { ...pi, receivedQuantity: newReceived };
                    
                    await tx.uniformProjectItem.update({
                        where: { id: pi.id },
                        data: { receivedQuantity: newReceived }
                    });
                }

                if (qty <= 0) continue;

                // Record transaction
                const trx = await tx.uniformStockTransaction.create({
                    data: {
                        code: `TRX/PRJ/${projectId}/${item.variantId}/${Date.now()}`,
                        type: 'IN',
                        variantId: parseInt(item.variantId),
                        warehouseId: parseInt(warehouseId),
                        quantity: qty,
                        referenceType: 'PROJECT',
                        referenceId: projectId,
                        vendorId: vendorId,
                        note: `Penerimaan barang dari Proyek ${project.title}`
                    }
                });

                // Upsert stock
                const existingStock = await tx.uniformStock.findFirst({
                    where: { variantId: parseInt(item.variantId), warehouseId: parseInt(warehouseId) }
                });

                if (existingStock) {
                    await tx.uniformStock.update({
                        where: { id: existingStock.id },
                        data: { quantity: existingStock.quantity + qty }
                    });
                } else {
                    await tx.uniformStock.create({
                        data: {
                            variantId: parseInt(item.variantId),
                            warehouseId: parseInt(warehouseId),
                            quantity: qty,
                            minStock: 3
                        }
                    });
                }
            }

            // Check if all items are fully received
            const allCompleted = updatedProjectItems.every(pi => pi.receivedQuantity >= pi.quantity);

            // Update project status based on completion or isFinal flag
            const finalStatus = (isFinal || allCompleted) ? 'SELESAI' : 'BERJALAN';
            const updatedProj = await tx.uniformProject.update({
                where: { id: projectId },
                data: { status: finalStatus }
            });

            return updatedProj;
        });

        res.json({ message: 'Penerimaan barang berhasil dicatat', data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

exports.getFinanceReport = async (req, res) => {
    try {
        // 1. Total Pendapatan (Revenue)
        // Penjualan yang statusnya bukan CANCELLED
        const sales = await prisma.uniformSale.findMany({
            where: { status: { not: 'CANCELLED' } },
            include: { items: true }
        });
        
        let totalRevenue = 0;
        const cashFlow = [];
        
        sales.forEach(s => {
            // Calculate revenue only from DIAMBIL items
            const revenueFromSale = s.items.reduce((sum, item) => {
                if (item.status === 'DIAMBIL') {
                    return sum + item.totalPrice;
                }
                return sum;
            }, 0);
            
            totalRevenue += revenueFromSale;
            
            if (revenueFromSale > 0) {
                cashFlow.push({
                    type: 'IN',
                    date: s.createdAt,
                    amount: revenueFromSale,
                    description: `Pendapatan Barang Diambil: ${s.code} (${s.customerName || 'Pelanggan'})`,
                    reference: s.code
                });
            }
        });

        // 2. Total Pengeluaran (Expenses)
        // Proyek yang sudah SELESAI
        const completedProjects = await prisma.uniformProject.findMany({
            where: { status: 'SELESAI' },
            include: { selections: { where: { status: 'DIPILIH' } } }
        });
        
        let totalExpenses = 0;
        const projectExpenses = [];
        for (const proj of completedProjects) {
            if (proj.selections.length > 0) {
                const cost = proj.selections[0].proposedPrice || 0;
                totalExpenses += cost;
                projectExpenses.push({
                    id: proj.id,
                    title: proj.title,
                    cost: cost,
                    updatedAt: proj.updatedAt
                });
            }
        }

        // 3. Nilai Stok (Asset Value)
        const stocks = await prisma.uniformStock.findMany({
            include: { variant: { include: { item: true } } }
        });
        
        const totalAssetValue = stocks.reduce((sum, stock) => {
            const price = stock.variant.sellPrice || stock.variant.item.sellPrice || 0;
            return sum + (stock.quantity * price);
        }, 0);

        // 4. Laba / Rugi
        const netProfit = totalRevenue - totalExpenses;

        // Pengeluaran dari Proyek
        projectExpenses.forEach(p => {
            if (p.cost > 0) {
                cashFlow.push({
                    type: 'OUT',
                    date: p.updatedAt,
                    amount: p.cost,
                    description: `Pembayaran Proyek: ${p.title}`,
                    reference: `PRJ-${p.id}`
                });
            }
        });

        // Urutkan berdasarkan tanggal terbaru
        cashFlow.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json({
            summary: {
                totalRevenue,
                totalExpenses,
                netProfit,
                totalAssetValue
            },
            cashFlow: cashFlow.slice(0, 50) // Batasi 50 transaksi terbaru
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};
