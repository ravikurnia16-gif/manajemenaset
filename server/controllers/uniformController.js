const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendMessage } = require('../services/whatsappService');
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
            where: { isActive: true },
            include: {
                item: { include: { category: true, clothingType: true, unit: true, vendor: true } },
                size: true,
                stocks: { include: { warehouse: true } }
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

exports.downloadPricingRuleImportTemplate = async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Template_Aturan_Harga');

        sheet.columns = [
            { header: 'Kategori', key: 'category', width: 22 },
            { header: 'Jenis Pakaian', key: 'clothingType', width: 22 },
            { header: 'Unit / Jenjang', key: 'unit', width: 16 },
            { header: 'Gender', key: 'gender', width: 14 },
            { header: 'Ukuran', key: 'sizeNames', width: 22 },
            { header: 'Harga Jual (Rp) *Wajib', key: 'price', width: 24 }
        ];

        // Format header row
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF2563EB' }
        };
        sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        // Sample Data Rows
        sheet.addRow(['Seragam Nasional', 'Kemeja Panjang', 'SMP', 'IKHWAN', 'S;M;L;XL', 120000]);
        sheet.addRow(['Seragam Muslim', 'Gamis', 'SMA', 'AKHWAT', '', 150000]);
        sheet.addRow(['Seragam Olahraga', '', 'SD', '', '', 95000]);

        // Add Notes sheet
        const infoSheet = workbook.addWorksheet('Petunjuk_Pengisian');
        infoSheet.columns = [
            { header: 'Kolom', key: 'col', width: 20 },
            { header: 'Keterangan / Aturan Pengisian', key: 'desc', width: 65 }
        ];
        infoSheet.getRow(1).font = { bold: true };
        infoSheet.addRow(['Kategori', 'Opsional. Isi dengan nama Kategori di Master Data, atau kosongkan jika berlaku untuk semua kategori.']);
        infoSheet.addRow(['Jenis Pakaian', 'Opsional. Isi dengan nama Jenis Pakaian (misal: Kemeja Panjang, Celana), atau kosongkan jika berlaku untuk semua.']);
        infoSheet.addRow(['Unit / Jenjang', 'Opsional. Isi dengan nama Unit (misal: TK, SD, SMP, SMA, Pondok), atau kosongkan jika berlaku untuk semua.']);
        infoSheet.addRow(['Gender', 'Opsional. Isi dengan IKHWAN atau AKHWAT, atau kosongkan jika berlaku untuk semua.']);
        infoSheet.addRow(['Ukuran', 'Opsional. Jika beberapa ukuran, pisahkan dengan titik koma (;), contoh: S;M;L;XL atau 38;40;42. Kosongkan jika berlaku untuk semua ukuran.']);
        infoSheet.addRow(['Harga Jual (Rp)', 'Wajib. Hanya angka tanpa titik/koma (misal: 125000).']);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Template_Import_Aturan_Harga.xlsx"');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Download Template Error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.importPricingRules = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'File Excel tidak ditemukan' });
        const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
        if (rows.length < 2) return res.status(400).json({ error: 'File kosong atau format tidak sesuai' });

        const dataRows = rows.slice(1).filter(r => r.length > 0 && r.some(val => val !== undefined && val !== null && String(val).trim() !== ''));
        if (dataRows.length === 0) return res.status(400).json({ error: 'Tidak ada baris data valid untuk diimpor' });

        // Pre-fetch master data
        const cats = await prisma.uniformCategory.findMany();
        const cTypes = await prisma.uniformClothingType.findMany();
        const units = await prisma.uniformUnit.findMany();
        const sizes = await prisma.uniformSize.findMany();
        const existingRules = await prisma.uniformPricingRule.findMany({ where: { isActive: true } });

        let createdCount = 0;
        let updatedCount = 0;
        const errors = [];

        await prisma.$transaction(async (tx) => {
            for (let i = 0; i < dataRows.length; i++) {
                const rowNum = i + 2;
                const [catIn, clothIn, unitIn, genderIn, sizeNamesIn, priceIn] = dataRows[i];

                // Validate Price
                const rawPrice = String(priceIn || '').replace(/[^\d.]/g, '');
                const price = parseFloat(rawPrice);
                if (isNaN(price) || price <= 0) {
                    errors.push(`Baris ${rowNum}: Harga Jual '${priceIn}' tidak valid (wajib berupa angka > 0)`);
                    continue;
                }

                // Match Category
                let categoryId = null;
                if (catIn && String(catIn).trim()) {
                    const catStr = String(catIn).trim().toLowerCase();
                    const foundCat = cats.find(c => c.name.trim().toLowerCase() === catStr);
                    if (!foundCat) {
                        errors.push(`Baris ${rowNum}: Kategori '${catIn}' tidak ditemukan di Master Data`);
                        continue;
                    }
                    categoryId = foundCat.id;
                }

                // Match Clothing Type
                let clothingTypeId = null;
                if (clothIn && String(clothIn).trim()) {
                    const clothStr = String(clothIn).trim().toLowerCase();
                    const foundCloth = cTypes.find(c => c.name.trim().toLowerCase() === clothStr);
                    if (!foundCloth) {
                        errors.push(`Baris ${rowNum}: Jenis Pakaian '${clothIn}' tidak ditemukan di Master Data`);
                        continue;
                    }
                    clothingTypeId = foundCloth.id;
                }

                // Match Unit
                let unitId = null;
                if (unitIn && String(unitIn).trim()) {
                    const unitStr = String(unitIn).trim().toLowerCase();
                    const foundUnit = units.find(u => u.name.trim().toLowerCase() === unitStr);
                    if (!foundUnit) {
                        errors.push(`Baris ${rowNum}: Unit '${unitIn}' tidak ditemukan di Master Data`);
                        continue;
                    }
                    unitId = foundUnit.id;
                }

                // Match Gender
                let gender = null;
                if (genderIn && String(genderIn).trim()) {
                    const gUpper = String(genderIn).trim().toUpperCase();
                    if (gUpper.includes('IKHWAN') || gUpper === 'L' || gUpper === 'LAKI-LAKI') {
                        gender = 'IKHWAN';
                    } else if (gUpper.includes('AKHWAT') || gUpper === 'P' || gUpper === 'PEREMPUAN') {
                        gender = 'AKHWAT';
                    } else {
                        errors.push(`Baris ${rowNum}: Gender '${genderIn}' tidak valid (harus IKHWAN / AKHWAT atau kosong)`);
                        continue;
                    }
                }

                // Normalize & Validate Size Names against Master Data
                let sizeNames = null;
                if (sizeNamesIn && String(sizeNamesIn).trim()) {
                    const separator = String(sizeNamesIn).includes(';') ? ';' : ',';
                    const list = String(sizeNamesIn).split(separator).map(s => s.trim().toUpperCase()).filter(Boolean);

                    const invalidSizes = list.filter(sz => !sizes.some(s => s.name.toUpperCase() === sz));
                    if (invalidSizes.length > 0) {
                        errors.push(`Baris ${rowNum}: Ukuran '${invalidSizes.join(', ')}' tidak ditemukan di Master Data Ukuran`);
                        continue;
                    }

                    if (list.length > 0) {
                        sizeNames = list.join(';');
                    }
                }

                // Check for existing active rule with identical conditions
                const matchedOldRule = existingRules.find(r =>
                    (r.categoryId ?? null) === categoryId &&
                    (r.clothingTypeId ?? null) === clothingTypeId &&
                    (r.unitId ?? null) === unitId &&
                    (r.gender ?? null) === gender &&
                    (r.sizeNames ?? null) === sizeNames
                );

                if (matchedOldRule) {
                    // Deactivate old rule to keep history
                    await tx.uniformPricingRule.update({
                        where: { id: matchedOldRule.id },
                        data: { isActive: false }
                    });
                    updatedCount++;
                } else {
                    createdCount++;
                }

                // Create new active rule
                await tx.uniformPricingRule.create({
                    data: {
                        categoryId,
                        clothingTypeId,
                        unitId,
                        gender,
                        sizeNames,
                        price,
                        isActive: true
                    }
                });
            }

            if (errors.length > 0 && createdCount === 0 && updatedCount === 0) {
                throw new Error(errors.slice(0, 5).join('\n'));
            }
        });

        res.json({
            message: `Import berhasil! ${createdCount} aturan baru dibuat, ${updatedCount} aturan diperbarui.`,
            createdCount,
            updatedCount,
            warnings: errors
        });
    } catch (error) {
        console.error('Import Pricing Rules Error:', error);
        res.status(400).json({ error: error.message || 'Gagal mengimpor aturan harga' });
    }
};

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

exports.updatePricingRule = async (req, res) => {
    try {
        const { categoryId, clothingTypeId, unitId, gender, sizeNames, price } = req.body;
        if (!price) return res.status(400).json({ error: 'Harga baru harus diisi' });

        const oldRule = await prisma.uniformPricingRule.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!oldRule) return res.status(404).json({ error: 'Aturan lama tidak ditemukan' });

        const newCatId = categoryId !== undefined ? (categoryId ? parseInt(categoryId) : null) : oldRule.categoryId;
        const newClothingTypeId = clothingTypeId !== undefined ? (clothingTypeId ? parseInt(clothingTypeId) : null) : oldRule.clothingTypeId;
        const newUnitId = unitId !== undefined ? (unitId ? parseInt(unitId) : null) : oldRule.unitId;
        const newGender = gender !== undefined ? (gender || null) : oldRule.gender;
        const newSizeNames = sizeNames !== undefined ? (Array.isArray(sizeNames) ? sizeNames.join(';') : (sizeNames || null)) : oldRule.sizeNames;

        await prisma.$transaction(async (tx) => {
            // 1. Nonaktifkan aturan lama (untuk arsip riwayat)
            await tx.uniformPricingRule.update({
                where: { id: oldRule.id },
                data: { isActive: false }
            });

            // 2. Buat aturan baru dengan data yang telah diperbarui
            await tx.uniformPricingRule.create({
                data: {
                    categoryId: newCatId,
                    clothingTypeId: newClothingTypeId,
                    unitId: newUnitId,
                    gender: newGender,
                    sizeNames: newSizeNames,
                    price: parseFloat(price),
                    isActive: true
                }
            });
        });

        res.json({ message: 'Aturan harga berhasil diperbarui dan riwayat disimpan' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getNamaDadaPrice = async (req, res) => {
    try {
        const rule = await prisma.uniformPricingRule.findFirst({
            where: { gender: 'NAMADADA', isActive: true }
        });
        res.json({ price: rule ? rule.price : 15000 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateNamaDadaPrice = async (req, res) => {
    try {
        const { price } = req.body;
        if (!price) return res.status(400).json({ error: 'Harga harus diisi' });

        await prisma.$transaction(async (tx) => {
            await tx.uniformPricingRule.updateMany({
                where: { gender: 'NAMADADA', isActive: true },
                data: { isActive: false }
            });
            await tx.uniformPricingRule.create({
                data: {
                    gender: 'NAMADADA',
                    price: parseFloat(price),
                    isActive: true
                }
            });
        });
        res.json({ message: 'Harga Nama Dada berhasil diperbarui' });
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
                    const vSize = variant.sizeName || (variant.size ? variant.size.name : '');
                    if (!vSize || !sizes.includes(vSize.toLowerCase())) match = false;
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
            where: { isActive: true },
            include: { 
                item: { include: { category: true, clothingType: true, unit: true, vendor: true } }, 
                size: true,
                stocks: { include: { warehouse: true } }
            },
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
            { header: 'Stok', key: 'stock', width: 15 },
            { header: 'Stok minimal', key: 'min', width: 15 }
        ];

        // Sample Data
        sheet.addRow(['Seragam Nasional', 'Kemeja Panjang', 'SMP', 'IKHWAN', 'M', 'Gudang Pusat', 50, 5]);

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

            sheet.getCell(`G${i}`).dataValidation = { type: 'whole', operator: 'greaterThanOrEqual', formulae: [0] };
            sheet.getCell(`H${i}`).dataValidation = { type: 'whole', operator: 'greaterThanOrEqual', formulae: [0] };
            sheet.getCell(`I${i}`).dataValidation = { type: 'whole', operator: 'greaterThanOrEqual', formulae: [0] };
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
        const xlsx = require('xlsx');
        const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
        if (rows.length < 2) return res.status(400).json({ error: 'File kosong atau tidak valid' });

        const header = rows[0];
        const hasVendor = header.includes('Vendor');
        const dataRows = rows.slice(1).filter(r => r.length > 0 && r[0]);
        let successCount = 0;
        let errors = [];

        for (let i = 0; i < dataRows.length; i++) {
            try {
                const row = dataRows[i];
                const catIn = row[0];
                const clothIn = row[1];
                const unitIn = row[2];
                const genderIn = row[3];
                const sizeIn = row[4];
                const whIn = row[5];
                const vendorIn = hasVendor ? row[6] : null;
                const qtyIn = hasVendor ? row[7] : row[6];

                if (!catIn || !clothIn || !genderIn || !sizeIn || !whIn || !qtyIn) {
                    errors.push(`Baris ${i + 2}: Kolom wajib tidak lengkap.`);
                    continue;
                }

                const cat = await prisma.uniformCategory.findFirst({ where: { name: String(catIn).trim() } });
                if (!cat) { errors.push(`Baris ${i + 2}: Kategori '${catIn}' tidak ditemukan.`); continue; }

                const cloth = await prisma.uniformClothingType.findFirst({ where: { name: String(clothIn).trim() } });
                if (!cloth) { errors.push(`Baris ${i + 2}: Jenis Pakaian '${clothIn}' tidak ditemukan.`); continue; }

                let unit = null;
                if (unitIn && String(unitIn).trim() !== '' && String(unitIn).trim().toUpperCase() !== 'UMUM' && String(unitIn).trim() !== '-') {
                    unit = await prisma.uniformUnit.findFirst({ where: { name: String(unitIn).trim() } });
                    if (!unit) { errors.push(`Baris ${i + 2}: Unit '${unitIn}' tidak ditemukan.`); continue; }
                }

                const size = await prisma.uniformSize.findFirst({ where: { name: String(sizeIn).trim().toUpperCase() } });
                if (!size) { errors.push(`Baris ${i + 2}: Ukuran '${sizeIn}' tidak ditemukan.`); continue; }

                const wh = await prisma.uniformWarehouse.findFirst({ where: { name: String(whIn).trim() } });
                if (!wh) { errors.push(`Baris ${i + 2}: Gudang '${whIn}' tidak ditemukan.`); continue; }

                const gender = String(genderIn).trim().toUpperCase();
                const itemName = `${cloth.name} ${cat.name} ${gender === 'IKHWAN' ? 'Ikhwan' : 'Akhwat'} ${unit ? unit.name : 'Umum'}`.trim();

                let item = await prisma.uniformItem.findFirst({
                    where: {
                        categoryId: cat.id,
                        clothingTypeId: cloth.id,
                        unitId: unit ? unit.id : null,
                        gender: gender
                    }
                });

                if (!item) {
                    errors.push(`Baris ${i + 2}: Barang '${itemName}' tidak ditemukan (hanya menambah stok).`);
                    continue;
                }

                let variant = await prisma.uniformVariant.findUnique({
                    where: {
                        itemId_sizeName: { itemId: item.id, sizeName: size.name }
                    }
                });

                if (!variant) {
                    errors.push(`Baris ${i + 2}: Varian ukuran '${size.name}' untuk barang '${itemName}' tidak ditemukan.`);
                    continue;
                }

                const qty = parseInt(qtyIn) || 0;
                const cost = 0; // Default cost

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
                                quantity: qty, avgCost: cost, minStock: item.minStock || 5
                            },
                            update: {
                                quantity: { increment: qty },
                                avgCost: newAvgCost,
                                minStock: item.minStock || 5
                            }
                        });
                    });
                    successCount++;
                }
            } catch (err) {
                errors.push(`Baris ${i + 2}: Error - ${err.message}`);
            }
        }

        if (errors.length > 0 && successCount === 0) {
            return res.status(400).json({ error: 'Import gagal.', details: errors });
        } else if (errors.length > 0) {
            return res.status(200).json({ message: `Berhasil import ${successCount} data, namun ada beberapa error.`, details: errors });
        }

        res.status(200).json({ message: `Berhasil mengimport ${successCount} data stok.` });
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
            where: { isActive: true },
            include: {
                item: { include: { category: true, clothingType: true, unit: true, vendor: true } },
                size: true,
                stocks: { include: { warehouse: true } }
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
                    const separator = rule.sizeNames.includes(';') ? ';' : ',';
                    const sizes = rule.sizeNames.split(separator).map(s => s.trim().toLowerCase());
                    const vSize = variant.sizeName || (variant.size ? variant.size.name : '');
                    if (!vSize || !sizes.includes(vSize.toLowerCase())) match = false;
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
            where: { isActive: true },
            include: { 
                item: { include: { category: true, clothingType: true, unit: true, vendor: true } }, 
                size: true,
                stocks: { include: { warehouse: true } }
            },
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
            { header: 'Stok', key: 'stock', width: 15 },
            { header: 'Stok minimal', key: 'min', width: 15 }
        ];

        // Sample Data
        sheet.addRow(['Seragam Nasional', 'Kemeja Panjang', 'SMP', 'IKHWAN', 'M', 'Gudang Pusat', 50, 5]);

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

            sheet.getCell(`G${i}`).dataValidation = { type: 'whole', operator: 'greaterThanOrEqual', formulae: [0] };
            sheet.getCell(`H${i}`).dataValidation = { type: 'whole', operator: 'greaterThanOrEqual', formulae: [0] };
            sheet.getCell(`I${i}`).dataValidation = { type: 'whole', operator: 'greaterThanOrEqual', formulae: [0] };
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
        const xlsx = require('xlsx');
        const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
        if (rows.length < 2) return res.status(400).json({ error: 'File kosong atau tidak valid' });

        const header = rows[0];
        const hasVendor = header.includes('Vendor');
        const dataRows = rows.slice(1).filter(r => r.length > 0 && r[0]);
        let successCount = 0;
        let errors = [];

        // Generate a single base code for this entire import session
        const baseCode = await generateCode('TRX/SRG', 'uniformStockTransaction');

        try {
            await prisma.$transaction(async (tx) => {
                for (let i = 0; i < dataRows.length; i++) {
                    try {
                        const row = dataRows[i];
                        const catIn = row[0];
                        const clothIn = row[1];
                        const unitIn = row[2];
                        const genderIn = row[3];
                        const sizeIn = row[4];
                        const whIn = row[5];
                        const vendorIn = hasVendor ? row[6] : null;
                        const qtyIn = hasVendor ? row[7] : row[6];

                        const qty = parseInt(qtyIn) || 0;
                        if (qty <= 0) {
                            continue; // Silently skip rows with empty or zero quantity
                        }

                        if (!catIn || !clothIn || !genderIn || !sizeIn || !whIn) {
                            errors.push(`Baris ${i + 2}: Kolom identitas wajib tidak lengkap.`);
                            continue;
                        }

                        const cat = await tx.uniformCategory.findFirst({ where: { name: String(catIn).trim() } });
                        if (!cat) { errors.push(`Baris ${i + 2}: Kategori '${catIn}' tidak ditemukan.`); continue; }

                        const cloth = await tx.uniformClothingType.findFirst({ where: { name: String(clothIn).trim() } });
                        if (!cloth) { errors.push(`Baris ${i + 2}: Jenis Pakaian '${clothIn}' tidak ditemukan.`); continue; }

                        let unit = null;
                        if (unitIn && String(unitIn).trim() !== '' && String(unitIn).trim().toUpperCase() !== 'UMUM' && String(unitIn).trim() !== '-') {
                            unit = await tx.uniformUnit.findFirst({ where: { name: String(unitIn).trim() } });
                            if (!unit) { errors.push(`Baris ${i + 2}: Unit '${unitIn}' tidak ditemukan.`); continue; }
                        }

                        const size = await tx.uniformSize.findFirst({ where: { name: String(sizeIn).trim().toUpperCase() } });
                        if (!size) { errors.push(`Baris ${i + 2}: Ukuran '${sizeIn}' tidak ditemukan.`); continue; }

                        const wh = await tx.uniformWarehouse.findFirst({ where: { name: String(whIn).trim() } });
                        if (!wh) { errors.push(`Baris ${i + 2}: Gudang '${whIn}' tidak ditemukan.`); continue; }

                        const gender = String(genderIn).trim().toUpperCase();
                        const itemName = `${cloth.name} ${cat.name} ${gender === 'IKHWAN' ? 'Ikhwan' : 'Akhwat'} ${unit ? unit.name : 'Umum'}`.trim();

                        let item = await tx.uniformItem.findFirst({
                            where: {
                                categoryId: cat.id,
                                clothingTypeId: cloth.id,
                                unitId: unit ? unit.id : null,
                                gender: gender
                            }
                        });

                        if (!item) {
                            errors.push(`Baris ${i + 2}: Barang '${itemName}' tidak ditemukan (hanya menambah stok).`);
                            continue;
                        }

                        let variant = await tx.uniformVariant.findUnique({
                            where: {
                                itemId_sizeName: { itemId: item.id, sizeName: size.name }
                            }
                        });

                        if (!variant) {
                            errors.push(`Baris ${i + 2}: Varian ukuran '${size.name}' untuk barang '${itemName}' tidak ditemukan.`);
                            continue;
                        }

                        const cost = 0; // Default cost

                        // Append an index to make the code unique across all rows in the Excel file
                        const trcCode = dataRows.length > 1 ? `${baseCode}-${i + 1}` : baseCode;

                        await tx.uniformStockTransaction.create({
                            data: {
                                code: trcCode, type: 'IN',
                                variantId: variant.id,
                                warehouseId: wh.id,
                                quantity: qty,
                                costPerUnit: cost,
                                note: 'Import Excel'
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
                                quantity: qty, avgCost: cost, minStock: item.minStock || 5
                            },
                            update: {
                                quantity: { increment: qty },
                                avgCost: newAvgCost,
                                minStock: item.minStock || 5
                            }
                        });

                        successCount++;
                    } catch (err) {
                        const fullError = err.message ? err.message.replace(/\n/g, ' | ') : String(err);
                        errors.push(`Baris ${i + 2}: Error - ${fullError}`);
                    }
                }

                if (errors.length > 0) {
                    throw new Error("ROLLBACK_DUE_TO_ERRORS");
                }
            });
        } catch (error) {
            if (error.message !== "ROLLBACK_DUE_TO_ERRORS") {
                throw error;
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({ error: 'Import dibatalkan secara keseluruhan karena ada error.', details: errors });
        }

        res.status(200).json({ message: `Berhasil mengimport ${successCount} data stok.` });
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
    const { type, variantId, warehouseId, toWarehouseId, quantity, reason, note, batch } = req.body;
    try {
        // Build list of items to process
        const itemsList = batch && Array.isArray(batch)
            ? batch.map(b => ({ variantId: parseInt(b.variantId), quantity: parseInt(b.quantity) }))
            : [{ variantId: parseInt(variantId), quantity: parseInt(quantity) }];

        const results = await prisma.$transaction(async (tx) => {
            const created = [];

            // Generate a single base code for the whole transaction batch
            const baseCode = await generateCode('TRX/SRG', 'uniformStockTransaction');

            for (let i = 0; i < itemsList.length; i++) {
                const item = itemsList[i];
                // Append an index to make the code unique if there are multiple items
                const code = itemsList.length > 1 ? `${baseCode}-${i + 1}` : baseCode;
                const qty = item.quantity;

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
                        variantId: item.variantId,
                        warehouseId: parseInt(warehouseId),
                        toWarehouseId: toWarehouseId ? parseInt(toWarehouseId) : null,
                        quantity: type === 'OUT' || type === 'ADJUSTMENT' ? -Math.abs(qty) : qty,
                        costPerUnit: 0,
                        totalCost: 0,
                        vendorId: null,
                        reason, note: finalNote,
                        createdById: req.user?.id || null
                    }
                });

                // 2. Update stock (upsert)
                if (type === 'IN') {
                    await tx.uniformStock.upsert({
                        where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: parseInt(warehouseId) } },
                        create: {
                            variantId: item.variantId,
                            warehouseId: parseInt(warehouseId),
                            quantity: qty,
                            avgCost: 0
                        },
                        update: {
                            quantity: { increment: qty }
                        }
                    });
                } else if (type === 'OUT' || type === 'ADJUSTMENT') {
                    const stock = await tx.uniformStock.findUnique({
                        where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: parseInt(warehouseId) } }
                    });
                    if (!stock || stock.quantity < Math.abs(qty)) {
                        const variant = await tx.uniformVariant.findUnique({ where: { id: item.variantId }, include: { item: true } });
                        throw new Error(`Stok tidak mencukupi untuk ${variant?.item?.name || 'barang'} (${variant?.sizeName || '-'})`);
                    }

                    await tx.uniformStock.update({
                        where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: parseInt(warehouseId) } },
                        data: { quantity: { decrement: Math.abs(qty) } }
                    });
                } else if (type === 'MUTATION') {
                    const stock = await tx.uniformStock.findUnique({
                        where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: parseInt(warehouseId) } }
                    });
                    if (!stock || stock.quantity < qty) {
                        const variant = await tx.uniformVariant.findUnique({ where: { id: item.variantId }, include: { item: true } });
                        throw new Error(`Stok tidak mencukupi untuk ${variant?.item?.name || 'barang'} (${variant?.sizeName || '-'})`);
                    }

                    await tx.uniformStock.update({
                        where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: parseInt(warehouseId) } },
                        data: { quantity: { decrement: qty } }
                    });

                    await tx.uniformStock.upsert({
                        where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: parseInt(toWarehouseId) } },
                        create: {
                            variantId: item.variantId,
                            warehouseId: parseInt(toWarehouseId),
                            quantity: qty,
                            avgCost: stock.avgCost
                        },
                        update: {
                            quantity: { increment: qty }
                        }
                    });
                }

                created.push(trx);
            }

            return created;
        });

        res.json(results.length === 1 ? results[0] : { message: `${results.length} transaksi berhasil disimpan`, transactions: results });
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
                items: { include: { variant: { include: { item: true, stocks: true } } } },
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

exports.exportSalesToExcel = async (req, res) => {
    try {
        const { type, status, paymentStatus, search, isOverdue30Days } = req.query;
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

        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

        let data = await prisma.uniformSale.findMany({
            where,
            include: {
                warehouse: { select: { id: true, name: true } },
                package: { select: { id: true, name: true } },
                salePackages: { include: { package: { select: { id: true, name: true } } } },
                items: { include: { variant: { include: { item: true } } } }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (isOverdue30Days === 'true') {
            data = data.filter(s => {
                const isReady = s.status === 'PROSES' || s.status === 'SEDIA' || s.items.some(i => i.status === 'SEDIA');
                const orderDate = new Date(s.updatedAt || s.createdAt);
                return isReady && orderDate <= thirtyDaysAgo;
            });
        }

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Daftar_Pesanan_Seragam');

        sheet.columns = [
            { header: 'No', key: 'no', width: 6 },
            { header: 'Kode Invoice', key: 'code', width: 22 },
            { header: 'Tanggal Pesan', key: 'date', width: 15 },
            { header: 'Tipe', key: 'type', width: 12 },
            { header: 'Nama Pemesan / Siswa', key: 'name', width: 28 },
            { header: 'No HP / WA', key: 'phone', width: 18 },
            { header: 'Unit / Jenjang', key: 'unit', width: 16 },
            { header: 'Status Pesanan', key: 'status', width: 18 },
            { header: 'Status Bayar', key: 'paymentStatus', width: 16 },
            { header: 'Rincian Seragam & Ukuran', key: 'items', width: 45 },
            { header: 'Total Tagihan (Rp)', key: 'totalAmount', width: 20 },
            { header: 'Terbayar (Rp)', key: 'paidAmount', width: 18 },
            { header: 'Sisa Piutang (Rp)', key: 'unpaidAmount', width: 18 },
            { header: 'Catatan / Gudang', key: 'notes', width: 30 }
        ];

        // Style header row
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E40AF' }
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 28;

        let totalTagihan = 0;
        let totalTerbayar = 0;
        let totalPiutang = 0;

        data.forEach((s, idx) => {
            const rowNo = idx + 1;
            const orderDate = new Date(s.createdAt).toLocaleDateString('id-ID');
            const customer = s.customerName || s.studentName || '-';
            const phone = s.customerPhone || '-';
            const unit = s.targetUnit || '-';
            const tagihan = s.totalAmount || 0;
            const terbayar = s.paidAmount || 0;
            const piutang = Math.max(0, tagihan - terbayar);

            totalTagihan += tagihan;
            totalTerbayar += terbayar;
            totalPiutang += piutang;

            let itemsStr = s.items.map(i => `${i.itemName} (${i.size}) x${i.qty} [${i.status}]`).join('; ');
            if (s.note && s.note.includes('[NAMADADA')) {
                const matches = [...s.note.matchAll(/\[(NAMADADA(?:_PUTIH|_COKLAT)?):(\d+):/g)];
                matches.forEach(m => {
                    const type = m[1].includes('PUTIH') ? 'Nama Dada Putih' : 'Nama Dada Coklat';
                    itemsStr += `; ${type} x${m[2]}`;
                });
            }

            const row = sheet.addRow({
                no: rowNo,
                code: s.code,
                date: orderDate,
                type: s.type,
                name: customer,
                phone: phone,
                unit: unit,
                status: s.status,
                paymentStatus: s.paymentStatus === 'PAID' ? 'LUNAS' : s.paymentStatus === 'PARTIAL' ? 'SEBAGIAN' : 'BELUM BAYAR',
                items: itemsStr,
                totalAmount: tagihan,
                paidAmount: terbayar,
                unpaidAmount: piutang,
                notes: s.note || ''
            });

            row.alignment = { vertical: 'middle' };
            row.getCell('no').alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell('code').alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell('date').alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell('type').alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell('phone').alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell('unit').alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell('status').alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell('paymentStatus').alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell('totalAmount').numFmt = '#,##0';
            row.getCell('paidAmount').numFmt = '#,##0';
            row.getCell('unpaidAmount').numFmt = '#,##0';
        });

        // Add Summary Total Row
        const totalRow = sheet.addRow({
            no: '',
            code: 'TOTAL KESELURUHAN',
            date: '',
            type: '',
            name: '',
            phone: '',
            unit: '',
            status: '',
            paymentStatus: '',
            items: `${data.length} Pesanan`,
            totalAmount: totalTagihan,
            paidAmount: totalTerbayar,
            unpaidAmount: totalPiutang,
            notes: ''
        });

        totalRow.font = { bold: true };
        totalRow.getCell('totalAmount').numFmt = '#,##0';
        totalRow.getCell('paidAmount').numFmt = '#,##0';
        totalRow.getCell('unpaidAmount').numFmt = '#,##0';
        totalRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF1F5F9' }
        };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Laporan_Pesanan_Seragam_${Date.now()}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Export Sales Error:', error);
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
                items: { include: { variant: { include: { item: true, stocks: true } } } },
                schedule: true
            }
        });
        if (!data) return res.status(404).json({ error: 'Penjualan tidak ditemukan' });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.trackOrderPublic = async (req, res) => {
    try {
        const { code, phone } = req.query;
        if (!code || !phone) {
            return res.status(400).json({ error: 'Kode referensi dan Nomor HP wajib diisi' });
        }

        const data = await prisma.uniformSale.findFirst({
            where: {
                code: code.trim(),
                customerPhone: phone.trim()
            },
            include: {
                items: true,
                package: true
            }
        });

        if (!data) return res.status(404).json({ error: 'Pesanan tidak ditemukan dengan kombinasi kode dan nomor HP tersebut' });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.confirmIndentPublic = async (req, res) => {
    try {
        const saleId = parseInt(req.params.id);
        const { confirmations } = req.body; // array of { itemId, action: 'INDENT' | 'BATAL' }

        if (!confirmations || !Array.isArray(confirmations)) {
            return res.status(400).json({ error: 'Data konfirmasi tidak valid' });
        }

        const result = await prisma.$transaction(async (tx) => {
            const sale = await tx.uniformSale.findUnique({
                where: { id: saleId },
                include: { items: true }
            });

            if (!sale) throw new Error('Pesanan tidak ditemukan');

            const itemsMap = new Map(sale.items.map(i => [i.id, i]));
            let subtotalAdjustment = 0;
            let updatedCount = 0;
            const actualChanges = [];

            for (const conf of confirmations) {
                const item = itemsMap.get(parseInt(conf.itemId));
                if (!item) continue;

                // Hanya bisa konfirmasi jika statusnya TIDAK_TERSEDIA
                if (item.status !== 'TIDAK_TERSEDIA') continue;

                if (conf.action === 'INDENT') {
                    await tx.uniformSaleItem.update({
                        where: { id: item.id },
                        data: { status: 'INDENT' }
                    });
                    item.status = 'INDENT';
                    updatedCount++;
                    actualChanges.push({ itemName: item.itemName, size: item.size, qty: item.qty, action: 'INDENT' });
                } else if (conf.action === 'BATAL') {
                    await tx.uniformSaleItem.update({
                        where: { id: item.id },
                        data: { status: 'BATAL' }
                    });
                    item.status = 'BATAL';
                    subtotalAdjustment -= item.totalPrice;
                    updatedCount++;
                    actualChanges.push({ itemName: item.itemName, size: item.size, qty: item.qty, action: 'BATAL' });
                }
            }

            if (updatedCount === 0) {
                return sale; // Tidak ada yang diupdate
            }

            // Update Sale Totals & Status
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

            const updatedPaidAmount = Math.min(sale.paidAmount, newTotalAmount);

            const updatedSale = await tx.uniformSale.update({
                where: { id: saleId },
                data: {
                    status: newStatus,
                    subtotal: newSubtotal,
                    totalAmount: newTotalAmount,
                    paidAmount: updatedPaidAmount,
                    paymentStatus
                },
                include: { items: true }
            });

            return { updatedSale, actualChanges };
        });

        // ================= KIRIIM NOTIFIKASI WA KE STAFF GUDANG =================
        try {
            const { updatedSale, actualChanges } = result;

            if (actualChanges && actualChanges.length > 0) {
                const staffList = await prisma.user.findMany({
                    where: {
                        OR: [
                            { position: { contains: 'Gudang' } },
                            { position: { contains: 'Logistik' } }
                        ]
                    }
                });

                if (staffList.length > 0) {
                    let msg = `*KONFIRMASI BARANG KOSONG*\n\nHalo Tim Gudang & Logistik,\nAda konfirmasi terbaru dari wali murid terkait barang seragam yang *Tidak Tersedia*:\n\n*No Invoice:* ${updatedSale.code}\n*Nama Pemesan:* ${updatedSale.customerName || updatedSale.studentName || '-'}\n\n*Keputusan Wali Murid:*\n`;

                    for (const change of actualChanges) {
                        const icon = change.action === 'INDENT' ? '⏳' : '🚫';
                        msg += `- ${change.itemName} (${change.size}) x${change.qty} pcs ➡️ ${icon} *${change.action}*\n`;
                    }

                    msg += `\nSilakan kelola pesanan ini di Dashboard Admin:\nhttps://sarpras.dareliman.or.id/uniform-sales`;

                    for (const staff of staffList) {
                        if (staff.phone) {
                            try {
                                sendMessage(staff.phone, msg);
                            } catch (e) {
                                console.error('Gagal kirim WA ke Staff Gudang:', staff.phone, e);
                            }
                        }
                    }
                }
            }
        } catch (waErr) {
            console.error('Error saat kirim WA ke Staff Gudang:', waErr);
        }

        res.json({ message: 'Konfirmasi berhasil disimpan', data: result.updatedSale });
    } catch (error) {
        console.error('Confirm Indent Error:', error);
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

                let itemStatus = 'PENDING';
                if (!isPending) {
                    itemStatus = canDeliver >= qty ? 'DELIVERED' : 'BACKORDER';
                } else {
                    itemStatus = available >= qty ? 'PENDING' : 'BACKORDER';
                }

                saleItems.push({
                    variantId: parseInt(item.variantId),
                    itemName: variant.item.name,
                    size: variant.sizeName || variant.size?.name,
                    qty,
                    qtyDelivered: canDeliver,
                    unitPrice,
                    totalPrice,
                    status: itemStatus,
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
                            code: trxCode + '-' + Date.now() + Math.floor(Math.random() * 1000),
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

            // Parse Nama Dada from note if exists
            if (note && note.includes('[NAMADADA')) {
                const matches = [...note.matchAll(/\[(NAMADADA(?:_PUTIH|_COKLAT)?):(\d+):(\d+)(?::([A-Z_]+))?\]/g)];
                let replacementNotes = [];
                for (const match of matches) {
                    const ndType = match[1];
                    const ndQty = parseInt(match[2]);
                    const ndPrice = parseInt(match[3]);
                    const ndStatus = match[4] || 'PENDING';
                    subtotal += ndQty * ndPrice;
                    replacementNotes.push(`[${ndType}:${ndQty}:${ndPrice}:${ndStatus}]`);
                }

                if (matches.length > 0) {
                    note = note.replace(/\[NAMADADA[^\]]*\]/g, '').trim();
                    note = (note + '\n' + replacementNotes.join('\n')).trim();
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

        if (result.customerPhone) {
            let itemDetails = '';
            if (result.items && result.items.length > 0) {
                itemDetails = result.items.map(i => `- ${i.itemName} (${i.size || '-'}) x${i.qty}`).join('\n');
            }

            const message = `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\nAlhamdulillah! Pesanan seragam atas nama *${result.customerName || result.studentName || '-'}* telah kami terima dengan rincian sebagai berikut:\n\nKode Referensi: *${result.code}*\n\n${itemDetails}\n\nTotal tagihan: Rp${result.totalAmount.toLocaleString('id-ID')}\n\nMohon ditunggu konfirmasi ketersediaan barang dari Admin kami ya.\n\nAbu/Ummu dapat mengecek status pesanan menggunakan Kode Referensi di link berikut:\nhttps://sarpras.dareliman.or.id/public/lacak-pesanan\n\n_Catatan: Invoice resmi dan nomor rekening transfer akan kami kirimkan via WhatsApp setelah pesanan siap/tersedia._\n\nSyukron, Jazakumullah khairan.`;

            try {
                sendMessage(result.customerPhone, message);
            } catch (e) {
                console.error('Gagal kirim WA ke customer:', e);
            }
        }

        // Notifikasi ke Staff Gudang & Logistik
        try {
            const staffUsers = await prisma.user.findMany({
                where: {
                    position: { contains: 'Gudang dan Logistik' },
                    phone: { not: null, not: '' }
                }
            });

            if (staffUsers.length > 0) {
                let itemsString = '';
                if (result.items && result.items.length > 0) {
                    itemsString = result.items.map(i => `- ${i.itemName} (${i.size || '-'}): ${i.qty} pcs`).join('\n');
                }
                const staffMsg = `🔔 *INFO PESANAN SERAGAM BARU*\n\nDari: ${result.customerName || result.studentName || '-'}\nNo. HP: ${result.customerPhone || '-'}\nKode: ${result.code}\n\n*Rincian Pesanan:*\n${itemsString}\n\nTotal Tagihan: Rp${result.totalAmount.toLocaleString('id-ID')}\n\nSilakan cek aplikasi untuk detailnya.`;

                for (const staff of staffUsers) {
                    if (staff.phone) {
                        try {
                            sendMessage(staff.phone, staffMsg);
                        } catch (e) {
                            console.error(`Gagal kirim WA ke Staff Gudang (${staff.phone}):`, e);
                        }
                    }
                }
            } else {
                console.log('Tidak ada user Staff Gudang dan Logistik untuk notifikasi pesanan baru.');
            }
        } catch (e) {
            console.error('Gagal memproses WA ke Staff Gudang:', e);
        }

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
        const newPaymentStatus = newPaid >= sale.totalAmount ? 'PAID' : newPaid > 0 ? 'PARTIAL' : 'UNPAID';

        const data = await prisma.uniformSale.update({
            where: { id: parseInt(req.params.id) },
            data: {
                paidAmount: newPaid,
                paymentMethod,
                paymentStatus: newPaymentStatus
            }
        });

        // Kirim notifikasi WA ke pelanggan jika status berubah menjadi LUNAS
        if (sale.paymentStatus !== 'PAID' && newPaymentStatus === 'PAID' && sale.customerPhone) {
            const message = `Halo ${sale.customerName || sale.studentName || 'Bapak/Ibu'},\n\nTerima kasih, pembayaran pesanan seragam Anda dengan kode *${sale.code}* telah kami terima dan berstatus *LUNAS*.\n\nSilakan cek invoice terbaru Anda melalui link berikut:\nhttps://sarpras.dareliman.or.id/public/invoice-seragam/${sale.id}\n\nJazakumullahu Khairan,\nManajemen Aset & Logistik`;
            try {
                sendMessage(sale.customerPhone, message);
            } catch (e) {
                console.error('Gagal kirim WA lunas ke customer:', e);
            }
        }

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
            const notifications = { updates: [], hasTidakTersedia: false };

            for (const update of itemUpdates) {
                if (String(update.saleItemId).startsWith('NAMADADA')) {
                    if (sale.note && sale.note.includes('[NAMADADA')) {
                        const regex = new RegExp(`\\[(${update.saleItemId}):(\\d+):(\\d+)(?::([A-Z_]+))?\\]`);
                        const match = sale.note.match(regex);
                        if (match) {
                            const ndQty = parseInt(match[2]);
                            const ndStatus = match[4] || 'PENDING';
                            const newStatus = update.status;

                            if (ndStatus !== newStatus) {
                                let locText = '';
                                if (newStatus === 'SEDIA') {
                                    const transitWhId = parseInt(update.transitWarehouseId);
                                    const transitWh = await tx.uniformWarehouse.findUnique({ where: { id: transitWhId } });
                                    locText = transitWh?.name || 'Gudang';
                                }

                                let itemName = 'Nama Dada (Bordir)';
                                if (update.saleItemId === 'NAMADADA_PUTIH') itemName += ' - Putih';
                                if (update.saleItemId === 'NAMADADA_COKLAT') itemName += ' - Coklat';

                                notifications.updates.push({
                                    itemName: itemName,
                                    size: '-',
                                    qty: ndQty,
                                    oldStatus: ndStatus,
                                    newStatus: newStatus,
                                    location: locText
                                });
                                if (newStatus === 'TIDAK_TERSEDIA') notifications.hasTidakTersedia = true;
                            }

                            const newNoteStr = `[${match[1]}:${match[2]}:${match[3]}:${newStatus}]`;
                            sale.note = sale.note.replace(regex, newNoteStr);
                            await tx.uniformSale.update({
                                where: { id: saleId },
                                data: { note: sale.note }
                            });
                        }
                    }
                    continue; // Skip the rest of stock logic for Nama Dada
                }

                const item = itemsMap.get(parseInt(update.saleItemId));
                if (!item) continue;

                let oldStatus = item.status;
                const newStatus = update.status;
                let isVariantChanged = false;

                // 1. Tangani jika ada perubahan ukuran (variantId) untuk item yang belum diambil
                if (update.variantId && parseInt(update.variantId) !== item.variantId) {
                    const newVariant = await tx.uniformVariant.findUnique({
                        where: { id: parseInt(update.variantId) },
                        include: { item: true }
                    });

                    if (newVariant) {
                        const oldSizeName = item.size;
                        const newUnitPrice = newVariant.sellPrice || newVariant.item?.basePrice || item.unitPrice;
                        const oldTotalPrice = item.totalPrice;
                        const newTotalPrice = newUnitPrice * item.qty;

                        subtotalAdjustment += (newTotalPrice - oldTotalPrice);

                        item.variantId = newVariant.id;
                        item.size = newVariant.sizeName;
                        item.itemName = newVariant.item.name;
                        item.unitPrice = newUnitPrice;
                        item.totalPrice = newTotalPrice;

                        await tx.uniformSaleItem.update({
                            where: { id: item.id },
                            data: {
                                variantId: newVariant.id,
                                size: newVariant.sizeName,
                                itemName: newVariant.item.name,
                                unitPrice: newUnitPrice,
                                totalPrice: newTotalPrice
                            }
                        });

                        notifications.updates.push({
                            itemName: item.itemName,
                            size: `${oldSizeName} ➔ ${newVariant.sizeName}`,
                            qty: item.qty,
                            oldStatus: oldStatus,
                            newStatus: newStatus,
                            location: 'Ganti Ukuran'
                        });

                        isVariantChanged = true;
                    }
                }

                if (oldStatus === newStatus && !isVariantChanged) continue;

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

                // PENDING/INDENT/BACKORDER/TIDAK_TERSEDIA/BATAL -> SEDIA (Mutation: Source -> Transit)
                if (['PENDING', 'INDENT', 'BACKORDER', 'TIDAK_TERSEDIA', 'BATAL'].includes(oldStatus) && newStatus === 'SEDIA') {
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
                            code: trxCode + '-MUT-' + Math.floor(Math.random() * 1000),
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

                else if (['PENDING', 'INDENT', 'BACKORDER', 'TIDAK_TERSEDIA', 'SEDIA', 'BATAL'].includes(oldStatus) && newStatus === 'DIAMBIL') {
                    let whId;
                    if (oldStatus === 'SEDIA') {
                        // Find the warehouse from the last mutation when it was set to SEDIA
                        const lastMutTrx = await tx.uniformStockTransaction.findFirst({
                            where: {
                                referenceType: 'SALE',
                                referenceId: sale.id,
                                variantId: item.variantId,
                                type: 'MUTATION'
                            },
                            orderBy: { id: 'desc' }
                        });
                        if (!lastMutTrx) throw new Error(`Tidak dapat menemukan riwayat gudang saat SEDIA untuk item ${item.itemName}. Harap hubungi admin atau gunakan fitur BATAL terlebih dahulu.`);
                        whId = lastMutTrx.toWarehouseId;
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
                            code: trxCode + '-OUT-' + Math.floor(Math.random() * 1000),
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
                            code: trxCode + '-MUT-' + Math.floor(Math.random() * 1000),
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

                // PENDING/INDENT/BACKORDER/TIDAK_TERSEDIA -> BATAL
                else if (['PENDING', 'INDENT', 'BACKORDER', 'TIDAK_TERSEDIA'].includes(oldStatus) && newStatus === 'BATAL') {
                    subtotalAdjustment -= item.totalPrice;
                }

                // BATAL -> PENDING/INDENT/BACKORDER/TIDAK_TERSEDIA (Undo batal)
                else if (oldStatus === 'BATAL' && ['PENDING', 'INDENT', 'BACKORDER', 'TIDAK_TERSEDIA'].includes(newStatus)) {
                    subtotalAdjustment += item.totalPrice;
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
                            code: trxCode + '-IN-' + Math.floor(Math.random() * 1000),
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
                            code: trxCode + '-IN-' + Math.floor(Math.random() * 1000),
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

                // PENDING/SEDIA/DIAMBIL/dll -> BATAL (Subtotal adj untuk SEDIA dan DIAMBIL sudah ditangani di atas)
                // BATAL -> SEDIA / DIAMBIL
                if (oldStatus === 'BATAL' && ['SEDIA', 'DIAMBIL'].includes(newStatus)) {
                    subtotalAdjustment += item.totalPrice;
                }
                // Tambahkan ke list notifikasi update status
                let locText = '';
                if (newStatus === 'SEDIA') {
                    const transitWhId = parseInt(update.transitWarehouseId);
                    if (transitWhId) {
                        const transitWh = await tx.uniformWarehouse.findUnique({ where: { id: transitWhId } });
                        locText = (transitWh?.location && transitWh.location.trim()) ? transitWh.location.trim() : (transitWh?.name || '');
                    }
                }

                notifications.updates.push({
                    itemName: item.itemName,
                    size: item.size,
                    qty: qty,
                    oldStatus: oldStatus,
                    newStatus: newStatus,
                    location: locText
                });

                if (newStatus === 'TIDAK_TERSEDIA') notifications.hasTidakTersedia = true;

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

            for (const update of itemUpdates) {
                if (update.status !== 'DIAMBIL' && update.status !== 'BATAL') {
                    allFinal = false;
                }
                if (['PENDING', 'INDENT', 'BACKORDER', 'TIDAK_TERSEDIA'].includes(update.status)) {
                    anyPending = true;
                }
                if (update.status === 'SEDIA') {
                    anySedia = true;
                }
            }

            if (allFinal && itemUpdates.length > 0) {
                newStatus = 'SELESAI';
            } else if (anySedia || itemUpdates.some(i => i.status === 'DIAMBIL')) {
                newStatus = 'PROSES';
            } else {
                newStatus = 'PENDING';
            }

            // Adjust invoice
            const newSubtotal = Math.max(0, sale.subtotal + subtotalAdjustment);
            const newTotalAmount = Math.max(0, newSubtotal - sale.discount);
            let paymentStatus = sale.paymentStatus;

            // Adjust paidAmount to not exceed newTotalAmount
            const updatedPaidAmount = Math.min(sale.paidAmount, newTotalAmount);

            if (newTotalAmount === 0) {
                paymentStatus = 'PAID';
            } else if (updatedPaidAmount >= newTotalAmount) {
                paymentStatus = 'PAID';
            } else if (updatedPaidAmount > 0) {
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
                    paidAmount: updatedPaidAmount,
                    paymentStatus
                },
                include: { items: true }
            });

            // Prepare summary of all items for WA notification
            const allItemsSummary = [];
            for (const update of itemUpdates) {
                let itemName = '';
                let size = '';
                let qty = 0;

                if (String(update.saleItemId).startsWith('NAMADADA')) {
                    itemName = 'Nama Dada (Bordir)';
                    if (update.saleItemId === 'NAMADADA_PUTIH') itemName += ' - Putih';
                    if (update.saleItemId === 'NAMADADA_COKLAT') itemName += ' - Coklat';
                    size = '-';
                    qty = update.qty || 1;
                    if (sale.note && sale.note.includes(`[${update.saleItemId}:`)) {
                        const regex = new RegExp(`\\[${update.saleItemId}:(\\d+):`);
                        const match = sale.note.match(regex);
                        if (match) qty = parseInt(match[1]);
                    }
                } else {
                    const item = itemsMap.get(parseInt(update.saleItemId));
                    if (item) {
                        itemName = item.itemName;
                        size = item.size;
                        qty = update.qty || item.qty;
                    }
                }

                const updateLog = notifications.updates.find(u => u.itemName === itemName && u.size === size);
                let loc = updateLog ? updateLog.location : '';

                if (update.status === 'SEDIA' && !loc) {
                    const item = itemsMap.get(parseInt(update.saleItemId));
                    if (item) {
                        const lastMutTrx = await tx.uniformStockTransaction.findFirst({
                            where: {
                                referenceType: 'SALE',
                                referenceId: sale.id,
                                variantId: item.variantId,
                                type: 'MUTATION'
                            },
                            include: { toWarehouse: true },
                            orderBy: { id: 'desc' }
                        });
                        if (lastMutTrx && lastMutTrx.toWarehouse) {
                            loc = (lastMutTrx.toWarehouse.location && lastMutTrx.toWarehouse.location.trim())
                                ? lastMutTrx.toWarehouse.location.trim()
                                : (lastMutTrx.toWarehouse.name || '');
                        }
                    }
                }

                allItemsSummary.push({
                    itemName,
                    size,
                    qty,
                    status: update.status,
                    changed: !!updateLog,
                    oldStatus: updateLog ? updateLog.oldStatus : '',
                    location: loc
                });
            }
            notifications.allItemsSummary = allItemsSummary;

            return { updatedSale, notifications };
        });

        // ================= KIRIIM NOTIFIKASI WA =================
        const { updatedSale, notifications } = result;

        if (updatedSale.customerPhone && notifications.updates.length > 0) {
            let msg = `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\nHalo Abu/Ummu ${updatedSale.customerName || updatedSale.studentName || ''},\n\nBerikut adalah update status terbaru untuk pesanan seragam Abu/Ummu (Kode: *${updatedSale.code}*):\n\n`;

            const sedia = notifications.allItemsSummary.filter(i => i.status === 'SEDIA');
            const diambil = notifications.allItemsSummary.filter(i => i.status === 'DIAMBIL');
            const indent = notifications.allItemsSummary.filter(i => ['INDENT', 'BACKORDER', 'PENDING'].includes(i.status));
            const kosong = notifications.allItemsSummary.filter(i => i.status === 'TIDAK_TERSEDIA');
            const batal = notifications.allItemsSummary.filter(i => i.status === 'BATAL');

            if (sedia.length > 0) {
                msg += `✅ *BARANG TERSEDIA (Siap Diambil)*\n`;

                // Group items by location
                const locationMap = new Map();
                sedia.forEach(i => {
                    const loc = (i.location && i.location.trim()) ? i.location.trim() : '';
                    if (!locationMap.has(loc)) {
                        locationMap.set(loc, []);
                    }
                    locationMap.get(loc).push(i);
                });

                const uniqueLocations = Array.from(locationMap.keys());

                if (uniqueLocations.length === 1) {
                    const locName = uniqueLocations[0];
                    if (locName) {
                        msg += `📍 *Lokasi:* ${locName}\n`;
                    }
                    locationMap.get(locName).forEach(i => {
                        msg += `- ${i.itemName} (${i.size}) x${i.qty} pcs\n`;
                    });
                } else {
                    uniqueLocations.forEach(locName => {
                        if (locName) {
                            msg += `📍 *Lokasi: ${locName}*\n`;
                        } else {
                            msg += `📍 *Lokasi: Pengambilan Utama*\n`;
                        }
                        locationMap.get(locName).forEach(i => {
                            msg += `- ${i.itemName} (${i.size}) x${i.qty} pcs\n`;
                        });
                        msg += '\n';
                    });
                }

                msg += `⏰ *Jadwal Pengambilan:* Hari Kerja (07.30 - 16.00 WIB)\n`;
                msg += `⚠️ *Batas Waktu Pengambilan:* Mohon seragam diambil maksimal dalam waktu *30 hari*. Pesanan yang belum diambil setelah 30 hari akan dibatalkan otomatis dan stok dialihkan kepada pemesan lain.\n\n`;
            }

            if (diambil.length > 0) {
                msg += `📦 *BARANG TELAH DIAMBIL (Diserahkan)*\n`;
                diambil.forEach(i => {
                    msg += `- ${i.itemName} (${i.size}) x${i.qty} pcs\n`;
                });
                msg += '\n';
            }

            if (indent.length > 0) {
                msg += `⏳ *BARANG INDENT (Menunggu Produksi/Stok)*\n`;
                indent.forEach(i => {
                    msg += `- ${i.itemName} (${i.size}) x${i.qty} pcs\n`;
                });
                msg += '\n';
            }

            if (kosong.length > 0) {
                msg += `❌ *BARANG TIDAK TERSEDIA (Kosong)*\n`;
                kosong.forEach(i => {
                    msg += `- ${i.itemName} (${i.size}) x${i.qty} pcs\n`;
                });
                msg += '\n';
            }

            if (batal.length > 0) {
                msg += `🚫 *BATAL*\n`;
                batal.forEach(i => {
                    msg += `- ${i.itemName} (${i.size}) x${i.qty} pcs\n`;
                });
                msg += '\n';
            }

            if (notifications.hasTidakTersedia) {
                msg += `Untuk barang yang KOSONG, mohon konfirmasi Abu/Ummu apakah bersedia menunggu (INDENT) atau membatalkannya melalui link berikut:\nhttps://sarpras.dareliman.or.id/public/konfirmasi-indent/${updatedSale.id}\n\n`;
            }

            if (sedia.length > 0) {
                msg += `💳 *Informasi Pembayaran / Transfer:*\n`;
                msg += `Bank: *BSI (Bank Syariah Indonesia)*\n`;
                msg += `No. Rekening: *7311412188*\n`;
                msg += `Atas Nama: *Syafriyan*\n\n`;
                msg += `Lihat invoice rincian & total tagihan pesanan Abu/Ummu di link berikut:\nhttps://sarpras.dareliman.or.id/public/invoice-seragam/${updatedSale.id}\n\n`;
            } else {
                msg += `Cek status dan rincian pesanan Abu/Ummu di link berikut:\nhttps://sarpras.dareliman.or.id/public/lacak-pesanan\n\n`;
            }

            msg += `Syukron, Jazakumullah khairan.`;

            try {
                sendMessage(updatedSale.customerPhone, msg);
            } catch (e) {
                console.error('Gagal kirim WA update status:', e);
            }
        }

        res.json(updatedSale);
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
        const newPaymentStatus = newPaid >= sale.totalAmount ? 'PAID' : newPaid > 0 ? 'PARTIAL' : 'UNPAID';

        const data = await prisma.uniformSale.update({
            where: { id: parseInt(req.params.id) },
            data: {
                paidAmount: newPaid,
                paymentMethod,
                paymentStatus: newPaymentStatus
            }
        });

        // Kirim Notifikasi WA jika status berubah menjadi PAID (Lunas)
        if (newPaymentStatus === 'PAID' && sale.paymentStatus !== 'PAID' && data.customerPhone) {
            let msg = `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\nHalo Abu/Ummu ${data.customerName || data.studentName || ''},\n\nAlhamdulillah, pembayaran untuk pesanan seragam Abu/Ummu (Kode: *${data.code}*) telah kami terima dan *LUNAS*.\n\n`;
            msg += `Berikut adalah link invoice pesanan Abu/Ummu:\nhttps://sarpras.dareliman.or.id/public/invoice-seragam/${data.id}\n\n`;
            msg += `Syukron, Jazakumullah khairan.`;

            try {
                sendMessage(data.customerPhone, msg);
            } catch (e) {
                console.error('Gagal kirim WA lunas:', e);
            }
        }

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
                            code: trxCode + '-' + Date.now() + Math.floor(Math.random() * 1000),
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

        const sale = await prisma.uniformSale.findUnique({ where: { id: saleId } });
        if (!sale) return res.status(404).json({ error: 'Pesanan tidak ditemukan' });

        let newPaidAmount = sale.paidAmount;
        if (paymentStatus === 'PAID') {
            newPaidAmount = sale.totalAmount;
        } else if (paymentStatus === 'UNPAID') {
            newPaidAmount = 0;
        }

        const updatedSale = await prisma.uniformSale.update({
            where: { id: saleId },
            data: {
                paymentStatus,
                paidAmount: newPaidAmount
            }
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
    const { 
        saleId, reason, note, warehouseId, fromWarehouseId, toWarehouseId, 
        exchanges, fromVariantId, toVariantId, qty, studentName, customerName,
        isPaidDiff = true, paymentMethod = 'CASH'
    } = req.body;

    try {
        const code = await generateCode('EXC/SRG', 'uniformExchange');
        const defaultWhId = parseInt(warehouseId || fromWarehouseId || toWarehouseId || 0);

        let itemsToExchange = exchanges || [];
        if (itemsToExchange.length === 0 && fromVariantId && toVariantId) {
            itemsToExchange = [{ 
                fromVariantId, 
                toVariantId, 
                qty: qty || 1,
                fromWarehouseId: fromWarehouseId || defaultWhId,
                toWarehouseId: toWarehouseId || defaultWhId
            }];
        }

        if (itemsToExchange.length === 0) throw new Error('Tidak ada barang yang ditukar');

        const result = await prisma.$transaction(async (tx) => {
            const exchangeRecords = [];
            let targetSale = null;

            if (saleId) {
                targetSale = await tx.uniformSale.findUnique({
                    where: { id: parseInt(saleId) },
                    include: { items: { include: { variant: { include: { item: true } } } } }
                });
            }

            let totalPriceDiff = 0;

            for (const item of itemsToExchange) {
                const quantity = parseInt(item.qty || 1);
                const fVId = parseInt(item.fromVariantId);
                const tVId = parseInt(item.toVariantId);
                const itemFromWhId = parseInt(item.fromWarehouseId || fromWarehouseId || defaultWhId);
                const itemToWhId = parseInt(item.toWarehouseId || toWarehouseId || defaultWhId);

                if (!itemFromWhId || !itemToWhId) {
                    throw new Error('Pilih gudang masuk (barang lama) dan gudang keluar (barang baru)');
                }

                let targetItem = null;
                if (item.saleItemId && targetSale) {
                    targetItem = targetSale.items?.find(si => si.id === parseInt(item.saleItemId));
                }

                // Ambil info varian baru
                const toVariant = await tx.uniformVariant.findUnique({
                    where: { id: tVId },
                    include: { item: true }
                });
                if (!toVariant) throw new Error('Varian barang pengganti tidak ditemukan');

                // Ambil info varian lama
                const fromVariant = await tx.uniformVariant.findUnique({
                    where: { id: fVId },
                    include: { item: true }
                });

                // Hitung selisih harga per unit
                const oldUnitPrice = item.oldUnitPrice !== undefined ? parseFloat(item.oldUnitPrice) : (fromVariant?.sellPrice || fromVariant?.item?.basePrice || 0);
                const newUnitPrice = toVariant.sellPrice || toVariant.item?.basePrice || 0;
                const itemPriceDiff = (newUnitPrice - oldUnitPrice) * quantity;
                totalPriceDiff += itemPriceDiff;

                const isAlreadyTaken = targetItem ? (targetItem.status === 'DIAMBIL' || targetItem.status === 'DELIVERED') : true;
                const isReadyInWarehouse = targetItem ? targetItem.status === 'SEDIA' : false;
                const isIndentOrPending = targetItem ? (targetItem.status === 'PENDING' || targetItem.status === 'INDENT' || targetItem.status === 'TIDAK_TERSEDIA') : false;

                // Tentukan status akhir item di pesanan
                let finalStatus = targetItem ? (item.newStatus || targetItem.status) : 'COMPLETED';

                const itemTransitWhId = parseInt(item.transitWarehouseId || itemToWhId);
                let transitWhName = '';
                if (itemTransitWhId) {
                    const tWh = await tx.uniformWarehouse.findUnique({ where: { id: itemTransitWhId } });
                    transitWhName = tWh?.name || '';
                }

                // 1. Catat record tukar ukuran
                const exchange = await tx.uniformExchange.create({
                    data: {
                        code,
                        customerName: customerName || targetSale?.customerName || '-',
                        studentName: studentName || targetSale?.studentName || '-',
                        fromVariantId: fVId,
                        toVariantId: tVId,
                        qty: quantity,
                        reason: reason || 'SIZE_MISMATCH',
                        note: `${note || ''}${targetSale ? ` [Ref: ${targetSale.code}]` : ''}${!isAlreadyTaken ? ` [Tukar Saat ${targetItem?.status || 'Belum Diambil'}]` : ''}${transitWhName ? ` [Jemput: ${transitWhName}]` : ''}${itemPriceDiff !== 0 ? ` (Selisih: ${itemPriceDiff > 0 ? '+' : ''}Rp ${itemPriceDiff.toLocaleString('id-ID')})` : ''}`.trim(),
                        status: 'COMPLETED',
                        createdById: req.user?.id || null
                    }
                });
                exchangeRecords.push(exchange);

                // 2. Stok Masuk (+qty) untuk barang lama:
                // Jika barang sudah diambil (DIAMBIL) atau sudah dialokasikan ke gudang (SEDIA), barang lama dikembalikan ke stok gudang masuk.
                if (isAlreadyTaken || isReadyInWarehouse || !targetItem) {
                    await tx.uniformStock.upsert({
                        where: { variantId_warehouseId: { variantId: fVId, warehouseId: itemFromWhId } },
                        create: { variantId: fVId, warehouseId: itemFromWhId, quantity },
                        update: { quantity: { increment: quantity } }
                    });

                    const trxInCode = await generateCode('TRX/SRG', 'uniformStockTransaction');
                    await tx.uniformStockTransaction.create({
                        data: {
                            code: trxInCode,
                            type: 'IN',
                            variantId: fVId,
                            warehouseId: itemFromWhId,
                            quantity: quantity,
                            referenceType: 'EXCHANGE',
                            referenceId: exchange.id,
                            reason: `Pengembalian/Tukar Ukuran (${code}) [Status Lama: ${targetItem?.status || 'DIAMBIL'}] dari ${studentName || targetSale?.studentName || 'Pelanggan'}`,
                            createdById: req.user?.id || null
                        }
                    });
                }

                // 3. Stok Keluar (-qty) untuk barang baru:
                const shouldDeductNewStock = isAlreadyTaken || isReadyInWarehouse || finalStatus === 'SEDIA' || finalStatus === 'DIAMBIL' || !targetItem;

                if (shouldDeductNewStock) {
                    const stockOut = await tx.uniformStock.findUnique({
                        where: { variantId_warehouseId: { variantId: tVId, warehouseId: itemToWhId } }
                    });

                    if (!stockOut || stockOut.quantity < quantity) {
                        if (isIndentOrPending) {
                            finalStatus = 'INDENT';
                        } else {
                            throw new Error(`Stok pengganti (${toVariant.item?.name} - ${toVariant.sizeName}) tidak mencukupi di gudang yang dipilih (Sisa: ${stockOut?.quantity || 0} pcs)`);
                        }
                    } else {
                        await tx.uniformStock.update({
                            where: { variantId_warehouseId: { variantId: tVId, warehouseId: itemToWhId } },
                            data: { quantity: { decrement: quantity } }
                        });

                        const trxOutCode = await generateCode('TRX/SRG', 'uniformStockTransaction');
                        await tx.uniformStockTransaction.create({
                            data: {
                                code: trxOutCode,
                                type: 'OUT',
                                variantId: tVId,
                                warehouseId: itemToWhId,
                                quantity: -quantity,
                                referenceType: 'EXCHANGE',
                                referenceId: exchange.id,
                                reason: `Penyerahan/Alokasi Tukar Ukuran (${code}) [Status Baru: ${finalStatus}] untuk ${studentName || targetSale?.studentName || 'Pelanggan'}`,
                                createdById: req.user?.id || null
                            }
                        });
                    }
                }

                // 4. Update UniformSaleItem jika terhubung dengan pesanan
                if (item.saleItemId && targetSale) {
                    await tx.uniformSaleItem.update({
                        where: { id: parseInt(item.saleItemId) },
                        data: {
                            variantId: tVId,
                            itemName: toVariant.item.name,
                            size: toVariant.sizeName,
                            unitPrice: newUnitPrice,
                            totalPrice: newUnitPrice * quantity,
                            status: finalStatus,
                            ...(finalStatus === 'DIAMBIL' ? { qtyDelivered: quantity, deliveredAt: new Date() } : {})
                        }
                    });
                }
            }

            // 5. Update Keuangan UniformSale jika terhubung ke invoice
            if (targetSale) {
                // Ambil semua item terbaru untuk hitung subtotal baru
                const updatedItems = await tx.uniformSaleItem.findMany({
                    where: { saleId: targetSale.id }
                });

                const newSubtotal = (targetSale.type === 'SPMB' || targetSale.type === 'UNIT_ORDER')
                    ? targetSale.subtotal + totalPriceDiff
                    : updatedItems.filter(i => i.status !== 'BATAL').reduce((acc, it) => acc + it.totalPrice, 0);

                const newTotalAmount = Math.max(0, newSubtotal - (targetSale.discount || 0));
                let newPaidAmount = targetSale.paidAmount || 0;

                if (totalPriceDiff > 0) {
                    // Ada tambahan biaya / kurang bayar
                    if (isPaidDiff) {
                        newPaidAmount += totalPriceDiff;
                    }
                } else if (totalPriceDiff < 0) {
                    // Ada kembalian / kelebihan bayar
                    newPaidAmount = Math.min(newPaidAmount, newTotalAmount);
                }

                const newPaymentStatus = newPaidAmount >= newTotalAmount ? 'PAID' : (newPaidAmount > 0 ? 'PARTIAL' : 'UNPAID');

                const exchangeNote = `[TUKAR_UKURAN: ${code} - Selisih: ${totalPriceDiff >= 0 ? '+' : ''}Rp ${totalPriceDiff.toLocaleString('id-ID')}]`;
                const updatedNote = targetSale.note ? `${targetSale.note}\n${exchangeNote}` : exchangeNote;

                await tx.uniformSale.update({
                    where: { id: targetSale.id },
                    data: {
                        subtotal: newSubtotal,
                        totalAmount: newTotalAmount,
                        paidAmount: newPaidAmount,
                        paymentStatus: newPaymentStatus,
                        paymentMethod: isPaidDiff && totalPriceDiff > 0 ? paymentMethod : targetSale.paymentMethod,
                        note: updatedNote
                    }
                });
            }

            return {
                code,
                exchangeRecords,
                totalPriceDiff,
                saleId: targetSale?.id || null
            };
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
        const whId = warehouseId ? parseInt(warehouseId) : null;
        const stockWhere = whId ? { warehouseId: whId } : {};

        // 1. Basic Counts & Stock Aggregation
        const [
            totalItems, 
            totalVariants, 
            totalStockAgg, 
            allWarehouses,
            allSales,
            saleItems,
            lowStockItems,
            recentStockTrx,
            recentExchanges
        ] = await Promise.all([
            prisma.uniformItem.count({ where: { isActive: true } }),
            prisma.uniformVariant.count({ where: { isActive: true } }),
            prisma.uniformStock.aggregate({ where: stockWhere, _sum: { quantity: true } }),
            prisma.uniformWarehouse.findMany({
                where: { isActive: true },
                include: {
                    stocks: {
                        include: {
                            variant: { include: { item: true } }
                        }
                    }
                }
            }),
            prisma.uniformSale.findMany({
                select: {
                    id: true, code: true, type: true, status: true, 
                    subtotal: true, discount: true, totalAmount: true, 
                    paidAmount: true, paymentStatus: true, createdAt: true,
                    customerName: true, studentName: true
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.uniformSaleItem.findMany({
                select: {
                    id: true, itemName: true, size: true, qty: true, 
                    unitPrice: true, totalPrice: true, status: true,
                    variantId: true, saleId: true
                }
            }),
            prisma.$queryRaw`
                SELECT us.id, us.quantity, us.minStock, us.modalAwal, uv.sizeName, uv.sku, ui.name as itemName, uw.name as warehouseName
                FROM seragam_stok us
                JOIN seragam_varian uv ON us.variantId = uv.id
                JOIN seragam_barang ui ON uv.itemId = ui.id
                JOIN seragam_gudang uw ON us.warehouseId = uw.id
                WHERE us.quantity <= us.minStock
                ORDER BY us.quantity ASC
                LIMIT 20
            `.catch(() => []),
            prisma.uniformStockTransaction.findMany({
                take: 10,
                orderBy: { createdAt: 'desc' },
                include: {
                    variant: { include: { item: true } },
                    warehouse: true,
                    toWarehouse: true
                }
            }),
            prisma.uniformExchange.findMany({
                take: 6,
                orderBy: { createdAt: 'desc' },
                include: {
                    fromVariant: { include: { item: true } },
                    toVariant: { include: { item: true } }
                }
            })
        ]);

        // 2. Calculate Warehouse Stock Breakdown & Total Asset Value
        let totalAssetValue = 0;
        const warehouseBreakdown = allWarehouses.map(w => {
            let whStock = 0;
            let whValue = 0;
            w.stocks.forEach(st => {
                const q = st.quantity || 0;
                const p = st.variant?.sellPrice || st.variant?.item?.basePrice || 0;
                whStock += q;
                whValue += q * p;
            });
            if (!whId || whId === w.id) {
                totalAssetValue += whValue;
            }
            return {
                id: w.id,
                name: w.name,
                location: w.location,
                totalStock: whStock,
                totalValue: whValue
            };
        });

        // 3. Sales Analysis
        const totalSalesCount = allSales.length;
        const spmbSalesCount = allSales.filter(s => s.type === 'SPMB' || s.type === 'UNIT_ORDER').length;
        const retailSalesCount = totalSalesCount - spmbSalesCount;

        const completedSalesCount = allSales.filter(s => s.status === 'COMPLETED' || s.status === 'SELESAI').length;
        const pendingSalesCount = allSales.filter(s => s.status === 'PENDING').length;
        const processSalesCount = allSales.filter(s => s.status === 'PROSES' || s.status === 'PARTIAL_DELIVERED' || s.status === 'SEDIA').length;

        const totalRevenue = allSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
        const totalPaid = allSales.reduce((sum, s) => sum + (s.paidAmount || 0), 0);
        const totalUnpaid = Math.max(0, totalRevenue - totalPaid);

        // 4. Fulfillment & Indent Analysis
        const indentItemsList = saleItems.filter(i => ['INDENT', 'TIDAK_TERSEDIA', 'BACKORDER'].includes(i.status));
        const sediaItemsCount = saleItems.filter(i => i.status === 'SEDIA').length;
        const diambilItemsCount = saleItems.filter(i => ['DIAMBIL', 'DELIVERED', 'COMPLETED'].includes(i.status)).length;
        const batalItemsCount = saleItems.filter(i => i.status === 'BATAL').length;

        // Group Indent by itemName and size to see highest demand
        const indentMap = new Map();
        indentItemsList.forEach(item => {
            const key = `${item.itemName}___${item.size}`;
            if (!indentMap.has(key)) {
                indentMap.set(key, { itemName: item.itemName, size: item.size, count: 0 });
            }
            indentMap.get(key).count += item.qty;
        });
        const topIndentItems = Array.from(indentMap.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);

        // 5. Top Selling Items
        const sellingMap = new Map();
        saleItems.forEach(item => {
            if (item.status !== 'BATAL') {
                const key = item.itemName;
                if (!sellingMap.has(key)) {
                    sellingMap.set(key, { itemName: key, qty: 0, revenue: 0 });
                }
                const rec = sellingMap.get(key);
                rec.qty += item.qty;
                rec.revenue += item.totalPrice || (item.unitPrice * item.qty);
            }
        });
        const topSellingItems = Array.from(sellingMap.values())
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 5);

        // 6. Format Activity Feed
        const combinedActivity = [
            ...recentStockTrx.map(trx => ({
                id: `trx-${trx.id}`,
                type: trx.type, // 'IN', 'OUT', 'MUTATION'
                title: trx.type === 'IN' ? 'Stok Masuk' : trx.type === 'OUT' ? 'Stok Keluar' : 'Mutasi Antar Gudang',
                itemName: trx.variant?.item?.name || 'Seragam',
                size: trx.variant?.sizeName || '-',
                qty: Math.abs(trx.quantity),
                warehouse: trx.warehouse?.name || '-',
                toWarehouse: trx.toWarehouse?.name || null,
                note: trx.note || trx.reason || '',
                date: trx.createdAt
            })),
            ...recentExchanges.map(exc => ({
                id: `exc-${exc.id}`,
                type: 'EXCHANGE',
                title: 'Tukar Ukuran',
                itemName: exc.fromVariant?.item?.name || 'Seragam',
                size: `${exc.fromVariant?.sizeName || '-'} ➔ ${exc.toVariant?.sizeName || '-'}`,
                qty: exc.qty,
                warehouse: exc.customerName || exc.studentName || '-',
                note: exc.note || exc.reason || '',
                date: exc.createdAt
            }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

        // 6. Comprehensive Urgent Restock Calculation
        const allActiveVariants = await prisma.uniformVariant.findMany({
            where: { isActive: true },
            include: {
                item: {
                    select: {
                        id: true,
                        name: true,
                        gender: true,
                        unit: { select: { name: true } },
                        category: { select: { name: true } },
                        clothingType: { select: { name: true } },
                        basePrice: true
                    }
                },
                stocks: {
                    include: {
                        warehouse: { select: { id: true, name: true } }
                    }
                }
            }
        });

        // Group active indent/pending demands from saleItems
        const demandMap = new Map();
        saleItems.forEach(si => {
            if (['PENDING', 'INDENT', 'TIDAK_TERSEDIA', 'BACKORDER'].includes(si.status)) {
                const key = si.variantId ? `v-${si.variantId}` : `name-${si.itemName}___${si.size}`;
                demandMap.set(key, (demandMap.get(key) || 0) + (si.qty || 0));
            }
        });

        // Calculate urgent restock items
        let urgentRestockItems = [];
        allActiveVariants.forEach(v => {
            const applicableStocks = whId ? v.stocks.filter(st => st.warehouseId === whId) : v.stocks;
            const currentStock = applicableStocks.reduce((sum, st) => sum + (st.quantity || 0), 0);
            const minStock = applicableStocks.reduce((sum, st) => sum + (st.minStock || 0), 0) || 5;
            
            const demandByVid = demandMap.get(`v-${v.id}`) || 0;
            const demandByName = demandMap.get(`name-${v.item?.name}___${v.sizeName}`) || 0;
            const totalIndentDemand = demandByVid + demandByName;

            const isDeficit = currentStock < totalIndentDemand;
            const isBelowMin = currentStock <= minStock;
            const isOutOfStock = currentStock <= 0;

            if (isDeficit || isBelowMin || isOutOfStock) {
                const deficitFromIndent = Math.max(0, totalIndentDemand - currentStock);
                const bufferTarget = Math.max(0, minStock - Math.max(0, currentStock - totalIndentDemand));
                const recommendedQty = Math.max(1, deficitFromIndent + bufferTarget);

                let urgency = 'LOW_STOCK';
                let urgencyLabel = 'Stok Menipis';
                if (totalIndentDemand > 0 && currentStock <= 0) {
                    urgency = 'CRITICAL';
                    urgencyLabel = 'DARURAT (Inden & Kosong)';
                } else if (totalIndentDemand > currentStock) {
                    urgency = 'URGENT';
                    urgencyLabel = 'Mendesak (Kurang Stok)';
                } else if (currentStock <= 0) {
                    urgency = 'OUT_OF_STOCK';
                    urgencyLabel = 'Stok Habis (0)';
                }

                urgentRestockItems.push({
                    variantId: v.id,
                    itemId: v.itemId,
                    itemName: v.item?.name || 'Seragam',
                    unitName: v.item?.unit?.name || '-',
                    categoryName: v.item?.category?.name || '-',
                    clothingTypeName: v.item?.clothingType?.name || '-',
                    gender: v.item?.gender || '-',
                    sizeName: v.sizeName || '-',
                    sku: v.sku || '-',
                    currentStock,
                    totalIndentDemand,
                    minStock,
                    recommendedQty,
                    urgency,
                    urgencyLabel,
                    estBudget: recommendedQty * (v.modalAwal || v.item?.basePrice || 0),
                    warehouseBreakdown: applicableStocks.map(st => `${st.warehouse?.name || 'Gudang'}: ${st.quantity} pcs`).join(', ')
                });
            }
        });

        // Sort: CRITICAL first, then URGENT, then OUT_OF_STOCK, then LOW_STOCK, then by recommendedQty desc
        const urgencyWeight = { 'CRITICAL': 1, 'URGENT': 2, 'OUT_OF_STOCK': 3, 'LOW_STOCK': 4 };
        urgentRestockItems.sort((a, b) => {
            const wA = urgencyWeight[a.urgency] || 5;
            const wB = urgencyWeight[b.urgency] || 5;
            if (wA !== wB) return wA - wB;
            return b.recommendedQty - a.recommendedQty;
        });

        res.json({
            totalItems,
            totalVariants,
            totalStock: totalStockAgg._sum.quantity || 0,
            totalAssetValue,
            warehouses: allWarehouses.length,
            warehouseBreakdown,
            sales: {
                total: totalSalesCount,
                spmb: spmbSalesCount,
                retail: retailSalesCount,
                completed: completedSalesCount,
                proses: processSalesCount,
                pending: pendingSalesCount,
                totalRevenue,
                totalPaid,
                totalUnpaid
            },
            fulfillment: {
                totalItemRows: saleItems.length,
                sedia: sediaItemsCount,
                diambil: diambilItemsCount,
                indent: indentItemsList.length,
                batal: batalItemsCount
            },
            topIndentItems,
            topSellingItems,
            lowStockCount: lowStockItems.length,
            lowStockItems,
            urgentRestockCount: urgentRestockItems.length,
            urgentRestockItems,
            recentActivity: combinedActivity
        });
    } catch (error) {
        console.error('Dashboard Error:', error);
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
            if (s.paidAmount > 0) {
                // Dynamically compute active subtotal to ensure cancelled items are not counted in revenue
                let activeSubtotal = s.subtotal;
                if (s.type === 'RETAIL' && s.items) {
                    const validItems = s.items.filter(item => item.status !== 'BATAL');
                    if (validItems.length > 0 || (s.note && s.note.includes('[NAMADADA:'))) {
                        // If it's a retail order with items (or just Nama Dada), we only count the valid items' total price.
                        // This naturally excludes Nama Dada from the financial report.
                        activeSubtotal = validItems.reduce((acc, item) => acc + item.totalPrice, 0);
                    }
                }

                const activeTotalAmount = Math.max(0, activeSubtotal - (s.discount || 0));
                const cappedPaidAmount = Math.min(s.paidAmount, activeTotalAmount);

                if (cappedPaidAmount > 0) {
                    totalRevenue += cappedPaidAmount;
                    cashFlow.push({
                        type: 'IN',
                        date: s.updatedAt,
                        amount: cappedPaidAmount,
                        description: `Pembayaran Pesanan: ${s.code} (${s.customerName || s.studentName || 'Pelanggan'})`,
                        reference: s.code
                    });
                }
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
