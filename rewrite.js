const fs = require('fs');
const file = 'd:/MANAJEMEN ASET/server/controllers/uniformController.js';
let content = fs.readFileSync(file, 'utf8');

const startRegex = /exports\.importStocks = async \(req, res\) => \{/g;
let match;
const bounds = [];
while ((match = startRegex.exec(content)) !== null) {
    let braceCount = 1;
    let idx = match.index + match[0].length;
    while (braceCount > 0 && idx < content.length) {
        if (content[idx] === '{') braceCount++;
        else if (content[idx] === '}') braceCount--;
        idx++;
    }
    bounds.push({ start: match.index, end: idx });
}

if (bounds.length === 2) {
    const newFunc = `exports.importStocks = async (req, res) => {
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
                    errors.push(\`Baris \${i + 2}: Kolom wajib tidak lengkap.\`);
                    continue;
                }

                const cat = await prisma.uniformCategory.findFirst({ where: { name: String(catIn).trim() } });
                if (!cat) { errors.push(\`Baris \${i + 2}: Kategori '\${catIn}' tidak ditemukan.\`); continue; }

                const cloth = await prisma.uniformClothingType.findFirst({ where: { name: String(clothIn).trim() } });
                if (!cloth) { errors.push(\`Baris \${i + 2}: Jenis Pakaian '\${clothIn}' tidak ditemukan.\`); continue; }

                let unit = null;
                if (unitIn && String(unitIn).trim() !== '' && String(unitIn).trim().toUpperCase() !== 'UMUM' && String(unitIn).trim() !== '-') {
                    unit = await prisma.uniformUnit.findFirst({ where: { name: String(unitIn).trim() } });
                    if (!unit) { errors.push(\`Baris \${i + 2}: Unit '\${unitIn}' tidak ditemukan.\`); continue; }
                }

                const size = await prisma.uniformSize.findFirst({ where: { name: String(sizeIn).trim().toUpperCase() } });
                if (!size) { errors.push(\`Baris \${i + 2}: Ukuran '\${sizeIn}' tidak ditemukan.\`); continue; }

                const wh = await prisma.uniformWarehouse.findFirst({ where: { name: String(whIn).trim() } });
                if (!wh) { errors.push(\`Baris \${i + 2}: Gudang '\${whIn}' tidak ditemukan.\`); continue; }

                const gender = String(genderIn).trim().toUpperCase();
                const itemName = \`\${cloth.name} \${cat.name} \${gender === 'IKHWAN' ? 'Ikhwan' : 'Akhwat'} \${unit ? unit.name : 'Umum'}\`.trim();
                
                let item = await prisma.uniformItem.findFirst({
                    where: {
                        categoryId: cat.id,
                        clothingTypeId: cloth.id,
                        unitId: unit ? unit.id : null,
                        gender: gender
                    }
                });

                if (!item) {
                    errors.push(\`Baris \${i + 2}: Barang '\${itemName}' tidak ditemukan (hanya menambah stok).\`);
                    continue;
                }

                let variant = await prisma.uniformVariant.findUnique({
                    where: {
                        itemId_sizeName: { itemId: item.id, sizeName: size.name }
                    }
                });

                if (!variant) {
                    errors.push(\`Baris \${i + 2}: Varian ukuran '\${size.name}' untuk barang '\${itemName}' tidak ditemukan.\`);
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
                errors.push(\`Baris \${i + 2}: Error - \${err.message}\`);
            }
        }

        if (errors.length > 0 && successCount === 0) {
            return res.status(400).json({ error: 'Import gagal.', details: errors });
        } else if (errors.length > 0) {
            return res.status(200).json({ message: \`Berhasil import \${successCount} data, namun ada beberapa error.\`, details: errors });
        }
        
        res.status(200).json({ message: \`Berhasil mengimport \${successCount} data stok.\` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}`;

    const p1 = content.substring(0, bounds[0].start);
    const p2 = content.substring(bounds[0].end, bounds[1].start);
    const p3 = content.substring(bounds[1].end);
    
    fs.writeFileSync(file, p1 + newFunc + p2 + newFunc + p3);
    console.log("Successfully replaced both importStocks.");
} else {
    console.log("Error finding bounds: " + bounds.length);
}
