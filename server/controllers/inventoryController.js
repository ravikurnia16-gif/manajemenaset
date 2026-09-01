const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const xlsx = require('xlsx');
const fs = require('fs');
const { uploadFile, deleteFile } = require('../services/minioService');

const uploadBase64 = async (base64String, folder = 'inventory/items') => {
    if (!base64String || typeof base64String !== 'string' || !base64String.startsWith('data:')) return base64String;
    try {
        const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) return null;
        const type = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const extension = type.split('/')[1] || 'jpg';
        const fileName = `item_${Date.now()}.${extension}`;
        return await uploadFile(buffer, fileName, type, folder);
    } catch (e) {
        console.error('Base64 Upload to MinIO Error:', e);
        return null;
    }
};

// ==========================================
// MASTER WAREHOUSE
// ==========================================
exports.getWarehouses = async (req, res) => {
    try {
        const data = await prisma.uniformWarehouse.findMany({ orderBy: { name: 'asc' } });
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createWarehouse = async (req, res) => {
    try {
        const data = await prisma.uniformWarehouse.create({ data: req.body });
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateWarehouse = async (req, res) => {
    try {
        const data = await prisma.uniformWarehouse.update({
            where: { id: parseInt(req.params.id) },
            data: req.body
        });
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.deleteWarehouse = async (req, res) => {
    try {
        await prisma.uniformWarehouse.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'Warehouse deleted' });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// ==========================================
// MASTER CATEGORY
// ==========================================
exports.getCategories = async (req, res) => {
    try {
        const data = await prisma.invCategory.findMany({ 
            include: { _count: { select: { items: true } } },
            orderBy: { name: 'asc' } 
        });
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createCategory = async (req, res) => {
    try {
        const data = await prisma.invCategory.create({ data: { name: req.body.name } });
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateCategory = async (req, res) => {
    try {
        const data = await prisma.invCategory.update({
            where: { id: parseInt(req.params.id) },
            data: { name: req.body.name }
        });
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.deleteCategory = async (req, res) => {
    try {
        const categoryId = parseInt(req.params.id);
        const itemCount = await prisma.invItem.count({ where: { categoryId } });
        if (itemCount > 0) {
            return res.status(400).json({ error: `Kategori tidak dapat dihapus karena masih digunakan oleh ${itemCount} barang.` });
        }
        await prisma.invCategory.delete({ where: { id: categoryId } });
        res.json({ message: 'Category deleted' });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// ==========================================
// MASTER ITEM
// ==========================================
const generateItemCode = async (prefix = 'INV/BRG') => {
    const items = await prisma.invItem.findMany({
        where: { code: { startsWith: `${prefix}/` } },
        select: { code: true }
    });
    let maxSeq = 0;
    for (const it of items) {
        const parts = it.code.split('/');
        if (parts.length === 3) {
            const seq = parseInt(parts[2], 10);
            if (!isNaN(seq) && seq > maxSeq) {
                maxSeq = seq;
            }
        }
    }
    return `${prefix}/${(maxSeq + 1).toString().padStart(4, '0')}`;
};

exports.getItems = async (req, res) => {
    const { categoryId, search } = req.query;
    try {
        const where = {};
        if (categoryId) where.categoryId = parseInt(categoryId);
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { code: { contains: search } }
            ];
        }
        
        const items = await prisma.invItem.findMany({
            where,
            include: { 
                category: true,
                stocks: { include: { warehouse: true } }
            },
            orderBy: { name: 'asc' }
        });
        
        // Add totalStock virtual field
        const result = items.map(item => {
            const totalStock = item.stocks.reduce((acc, stock) => acc + stock.quantity, 0);
            return { ...item, totalStock };
        });
        
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createItem = async (req, res) => {
    try {
        const { id, category, stocks, totalStock, image, ...rest } = req.body;
        const code = await generateItemCode();

        let imageUrl = null;
        if (image && image.startsWith('data:')) {
            imageUrl = await uploadBase64(image, 'inventory/items');
        } else if (image) {
            imageUrl = image;
        }

        const data = await prisma.invItem.create({
            data: {
                ...rest,
                code,
                categoryId: parseInt(req.body.categoryId),
                minStock: req.body.minStock ? parseInt(req.body.minStock) : 5,
                price: req.body.price ? parseFloat(req.body.price) : null,
                sellingPrice: req.body.sellingPrice ? parseFloat(req.body.sellingPrice) : null,
                image: imageUrl
            }
        });
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateItem = async (req, res) => {
    try {
        const { id, category, stocks, totalStock, image, ...rest } = req.body;
        const itemId = parseInt(req.params.id);
        const existingItem = await prisma.invItem.findUnique({ where: { id: itemId } });

        let imageUrl = undefined;
        if (image !== undefined) {
            if (image && image.startsWith('data:')) {
                imageUrl = await uploadBase64(image, 'inventory/items');
                if (existingItem?.image && existingItem.image.startsWith('/api/media/')) {
                    deleteFile(existingItem.image).catch(console.error);
                }
            } else if (image === null) {
                imageUrl = null;
                if (existingItem?.image && existingItem.image.startsWith('/api/media/')) {
                    deleteFile(existingItem.image).catch(console.error);
                }
            } else {
                imageUrl = image;
            }
        }

        const data = await prisma.invItem.update({
            where: { id: itemId },
            data: {
                ...rest,
                categoryId: req.body.categoryId ? parseInt(req.body.categoryId) : undefined,
                minStock: req.body.minStock !== undefined ? parseInt(req.body.minStock) : undefined,
                price: req.body.price !== undefined ? parseFloat(req.body.price) : undefined,
                sellingPrice: req.body.sellingPrice !== undefined ? parseFloat(req.body.sellingPrice) : undefined,
                image: imageUrl
            }
        });
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.deleteItem = async (req, res) => {
    try {
        const itemId = parseInt(req.params.id);
        const item = await prisma.invItem.findUnique({ where: { id: itemId } });
        if (item?.image && item.image.startsWith('/api/media/')) {
            deleteFile(item.image).catch(console.error);
        }
        await prisma.invItem.delete({ where: { id: itemId } });
        res.json({ message: 'Item deleted' });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// ==========================================
// STOCK TRANSACTIONS (LEDGER)
// ==========================================
const generateTxCode = async () => {
    const year = new Date().getFullYear();
    const prefix = `TRX/INV/${year}/`;
    const txs = await prisma.invStockTransaction.findMany({
        where: { code: { startsWith: prefix } },
        select: { code: true }
    });
    let maxSeq = 0;
    for (const tx of txs) {
        const parts = tx.code.split('/');
        if (parts.length === 4) {
            const seq = parseInt(parts[3], 10);
            if (!isNaN(seq) && seq > maxSeq) {
                maxSeq = seq;
            }
        }
    }
    return `${prefix}${(maxSeq + 1).toString().padStart(4, '0')}`;
};

exports.getTransactions = async (req, res) => {
    const { type, warehouseId, itemId, startDate, endDate } = req.query;
    try {
        const where = {};
        if (type) where.type = type;
        if (warehouseId) where.warehouseId = parseInt(warehouseId);
        if (itemId) where.itemId = parseInt(itemId);
        if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = new Date(startDate);
            if (endDate) where.date.lte = new Date(endDate);
        }
        
        const txs = await prisma.invStockTransaction.findMany({
            where,
            include: {
                item: true,
                warehouse: true,
                toWarehouse: true,
                createdBy: { select: { name: true, username: true } }
            },
            orderBy: { date: 'desc' }
        });
        res.json(txs);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getTransactionById = async (req, res) => {
    const { id } = req.params;
    try {
        const tx = await prisma.invStockTransaction.findFirst({
            where: {
                OR: [
                    { id: isNaN(parseInt(id)) ? -1 : parseInt(id) },
                    { code: id }
                ]
            },
            include: {
                item: { include: { category: true } },
                warehouse: true,
                toWarehouse: true,
                createdBy: { select: { name: true, username: true } }
            }
        });
        if (!tx) return res.status(404).json({ error: 'Bukti transaksi tidak ditemukan' });
        res.json(tx);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createTransaction = async (req, res) => {
    const { type, date, note, itemId, warehouseId, toWarehouseId, quantity, items } = req.body;
    try {
        if (!type || !['IN', 'OUT', 'MUTATION'].includes(type)) {
            return res.status(400).json({ error: 'Tipe transaksi harus IN, OUT, atau MUTATION' });
        }
        if (!warehouseId) {
            return res.status(400).json({ error: 'Gudang sumber wajib dipilih' });
        }

        const sourceWhId = parseInt(warehouseId);
        let destWhId = null;
        if (type === 'MUTATION') {
            if (!toWarehouseId) return res.status(400).json({ error: 'Gudang tujuan wajib dipilih untuk mutasi' });
            destWhId = parseInt(toWarehouseId);
            if (sourceWhId === destWhId) return res.status(400).json({ error: 'Gudang sumber dan tujuan tidak boleh sama' });
        }

        // Format items list (supports multi-item or single item)
        let transactionItems = [];
        if (Array.isArray(items) && items.length > 0) {
            transactionItems = items.map(it => ({
                itemId: parseInt(it.itemId),
                quantity: parseInt(it.quantity, 10),
                note: (it.note || note || '').toString().trim()
            }));
        } else if (itemId && quantity) {
            transactionItems = [{
                itemId: parseInt(itemId),
                quantity: parseInt(quantity, 10),
                note: (note || '').toString().trim()
            }];
        } else {
            return res.status(400).json({ error: 'Minimal harus memilih 1 barang untuk ditransaksikan' });
        }

        // Validation for each item
        for (const it of transactionItems) {
            if (isNaN(it.itemId) || !it.itemId) {
                return res.status(400).json({ error: 'Ada barang yang belum dipilih dengan benar' });
            }
            if (isNaN(it.quantity) || it.quantity <= 0) {
                return res.status(400).json({ error: 'Jumlah / kuantitas barang harus lebih dari 0' });
            }
        }

        // Generate base sequence for TxCode
        const year = new Date().getFullYear();
        const prefix = `TRX/INV/${year}/`;
        const existingTxs = await prisma.invStockTransaction.findMany({
            where: { code: { startsWith: prefix } },
            select: { code: true }
        });
        let maxSeq = 0;
        for (const tx of existingTxs) {
            const parts = tx.code.split('/');
            if (parts.length === 4) {
                const seq = parseInt(parts[3], 10);
                if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
            }
        }

        const txDate = date ? new Date(date) : new Date();

        const result = await prisma.$transaction(async (tx) => {
            const createdRecords = [];

            for (const item of transactionItems) {
                // Check stock if OUT or MUTATION
                if (type === 'OUT' || type === 'MUTATION') {
                    const stock = await tx.invStock.findUnique({
                        where: { itemId_warehouseId: { itemId: item.itemId, warehouseId: sourceWhId } }
                    });
                    const available = stock?.quantity || 0;
                    if (available < item.quantity) {
                        const itInfo = await tx.invItem.findUnique({
                            where: { id: item.itemId },
                            select: { name: true, unit: true }
                        });
                        throw new Error(`Stok "${itInfo?.name || 'Barang'}" tidak mencukupi di gudang ini (Tersedia: ${available} ${itInfo?.unit || ''}, Diminta: ${item.quantity})`);
                    }
                }

                maxSeq++;
                const code = `${prefix}${maxSeq.toString().padStart(4, '0')}`;

                const createdTx = await tx.invStockTransaction.create({
                    data: {
                        code,
                        type,
                        note: item.note || `Transaksi ${type}`,
                        date: txDate,
                        itemId: item.itemId,
                        warehouseId: sourceWhId,
                        toWarehouseId: destWhId,
                        quantity: item.quantity,
                        createdById: req.user.id
                    },
                    include: {
                        item: true,
                        warehouse: true,
                        toWarehouse: true
                    }
                });

                // Update source warehouse stock
                const delta = type === 'IN' ? item.quantity : -item.quantity;
                await tx.invStock.upsert({
                    where: { itemId_warehouseId: { itemId: item.itemId, warehouseId: sourceWhId } },
                    create: { itemId: item.itemId, warehouseId: sourceWhId, quantity: delta },
                    update: { quantity: { increment: delta } }
                });

                // Update destination warehouse stock if MUTATION
                if (type === 'MUTATION' && destWhId) {
                    await tx.invStock.upsert({
                        where: { itemId_warehouseId: { itemId: item.itemId, warehouseId: destWhId } },
                        create: { itemId: item.itemId, warehouseId: destWhId, quantity: item.quantity },
                        update: { quantity: { increment: item.quantity } }
                    });
                }

                createdRecords.push(createdTx);
            }

            return createdRecords;
        });

        res.json({
            message: `Berhasil mencatat ${result.length} transaksi barang`,
            data: result
        });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
};

const parseExcelDate = (val) => {
    if (!val) return new Date();
    if (val instanceof Date && !isNaN(val.getTime())) return val;
    if (typeof val === 'number') {
        // Excel serial date conversion
        return new Date(Math.round((val - 25569) * 86400 * 1000));
    }
    const d = new Date(val);
    return !isNaN(d.getTime()) ? d : new Date();
};

exports.importTransactions = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Tidak ada file yang diunggah' });

        const workbook = xlsx.readFile(req.file.path, { cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

        if (data.length === 0) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Data file import kosong' });
        }

        // Ambil data referensi Master Data
        const items = await prisma.invItem.findMany({ select: { id: true, code: true, name: true, unit: true } });
        const warehouses = await prisma.uniformWarehouse.findMany({ select: { id: true, name: true } });

        const normalize = (str) => (str || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');

        const itemNameMap = new Map();
        const itemCodeMap = new Map();
        for (const item of items) {
            if (item.name) itemNameMap.set(normalize(item.name), item);
            if (item.code) itemCodeMap.set(normalize(item.code), item);
        }

        const whMap = new Map();
        for (const wh of warehouses) {
            if (wh.name) whMap.set(normalize(wh.name), wh);
        }

        let successCount = 0;
        let errors = [];

        // Generate base sequence for TxCode
        const year = new Date().getFullYear();
        const prefix = `TRX/INV/${year}/`;
        const existingTxs = await prisma.invStockTransaction.findMany({
            where: { code: { startsWith: prefix } },
            select: { code: true }
        });
        let maxSeq = 0;
        for (const tx of existingTxs) {
            const parts = tx.code.split('/');
            if (parts.length === 4) {
                const seq = parseInt(parts[3], 10);
                if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
            }
        }

        for (const [index, row] of data.entries()) {
            try {
                // Normalisasi Tipe Transaksi
                let type = (row['Tipe'] || row['Type'] || row['Jenis'] || '').toString().trim().toUpperCase();
                if (type === 'MASUK' || type === 'STOK MASUK') type = 'IN';
                if (type === 'KELUAR' || type === 'STOK KELUAR') type = 'OUT';
                if (type === 'MUTASI' || type === 'MUTASI GUDANG' || type === 'PINDAH') type = 'MUTATION';

                if (!['IN', 'OUT', 'MUTATION'].includes(type)) {
                    throw new Error(`Tipe "${row['Tipe'] || row['Type'] || ''}" tidak valid. Harus IN (Masuk), OUT (Keluar), atau MUTATION (Mutasi)`);
                }

                // Pencarian Nama Barang (harus sesuai master data barang)
                const rawItemName = (row['Nama Barang'] || row['Nama'] || row['Item Name'] || row['Barang'] || row['Item'] || '').toString().trim();
                const rawItemCode = (row['Kode Barang'] || row['Kode'] || row['Item Code'] || '').toString().trim();

                let item = null;
                if (rawItemName && itemNameMap.has(normalize(rawItemName))) {
                    item = itemNameMap.get(normalize(rawItemName));
                } else if (rawItemCode && itemCodeMap.has(normalize(rawItemCode))) {
                    item = itemCodeMap.get(normalize(rawItemCode));
                } else if (rawItemName && itemCodeMap.has(normalize(rawItemName))) {
                    item = itemCodeMap.get(normalize(rawItemName));
                }

                if (!item) {
                    throw new Error(`Barang "${rawItemName || rawItemCode || 'Tidak Disebutkan'}" tidak ditemukan di Master Data Barang`);
                }

                // Kuantitas
                const qtyVal = row['Kuantitas'] ?? row['Jumlah'] ?? row['Qty'] ?? row['Quantity'];
                const parsedQty = parseInt(qtyVal, 10);
                if (isNaN(parsedQty) || parsedQty <= 0) {
                    throw new Error(`Kuantitas tidak valid: "${qtyVal || ''}" (harus bilangan bulat lebih dari 0)`);
                }

                // Gudang Sumber (harus sesuai nama gudang yang ada)
                const rawWhSource = (row['Gudang Sumber'] || row['Gudang Asal'] || row['Gudang'] || row['Warehouse'] || row['Source Warehouse'] || '').toString().trim();
                if (!rawWhSource) throw new Error('Gudang Sumber wajib diisi');

                const whSource = whMap.get(normalize(rawWhSource));
                if (!whSource) {
                    throw new Error(`Gudang sumber "${rawWhSource}" tidak ditemukan di Master Gudang`);
                }
                const warehouseId = whSource.id;

                // Gudang Tujuan (wajib jika MUTATION, harus sesuai nama gudang yang ada)
                let toWarehouseId = null;
                let whTargetName = '';
                if (type === 'MUTATION') {
                    const rawWhTarget = (row['Gudang Tujuan'] || row['Gudang Ke'] || row['Target Warehouse'] || row['Destination Warehouse'] || '').toString().trim();
                    if (!rawWhTarget) throw new Error('Gudang Tujuan wajib diisi untuk transaksi MUTATION');

                    const whTarget = whMap.get(normalize(rawWhTarget));
                    if (!whTarget) {
                        throw new Error(`Gudang tujuan "${rawWhTarget}" tidak ditemukan di Master Gudang`);
                    }
                    toWarehouseId = whTarget.id;
                    whTargetName = whTarget.name;
                    if (warehouseId === toWarehouseId) {
                        throw new Error('Gudang sumber dan gudang tujuan tidak boleh sama');
                    }
                }

                // Tanggal: Terisi otomatis waktu sekarang jika tidak ada / kosong
                const rawDate = row['Tanggal'] || row['Date'] || row['Tgl'];
                const date = parseExcelDate(rawDate);

                // Catatan
                const rawNote = (row['Catatan'] || row['Keterangan'] || row['Note'] || row['Notes'] || '').toString().trim();
                const note = rawNote || (type === 'MUTATION' ? `Mutasi dari ${whSource.name} ke ${whTargetName}` : `Import Transaksi ${type}`);

                await prisma.$transaction(async (tx) => {
                    // Check stock for OUT / MUTATION
                    if (type === 'OUT' || type === 'MUTATION') {
                        const stock = await tx.invStock.findUnique({
                            where: { itemId_warehouseId: { itemId: item.id, warehouseId } }
                        });
                        const currentQty = stock?.quantity || 0;
                        if (currentQty < parsedQty) {
                            throw new Error(`Stok "${item.name}" di ${whSource.name} tidak mencukupi (Tersedia: ${currentQty}, Diminta: ${parsedQty})`);
                        }
                    }

                    maxSeq++;
                    const code = `${prefix}${maxSeq.toString().padStart(4, '0')}`;

                    await tx.invStockTransaction.create({
                        data: {
                            code,
                            type,
                            note,
                            date,
                            itemId: item.id,
                            warehouseId,
                            toWarehouseId,
                            quantity: parsedQty,
                            createdById: req.user.id
                        }
                    });

                    const delta = type === 'IN' ? parsedQty : -parsedQty;
                    await tx.invStock.upsert({
                        where: { itemId_warehouseId: { itemId: item.id, warehouseId } },
                        create: { itemId: item.id, warehouseId, quantity: delta },
                        update: { quantity: { increment: delta } }
                    });

                    if (type === 'MUTATION' && toWarehouseId) {
                        await tx.invStock.upsert({
                            where: { itemId_warehouseId: { itemId: item.id, warehouseId: toWarehouseId } },
                            create: { itemId: item.id, warehouseId: toWarehouseId, quantity: parsedQty },
                            update: { quantity: { increment: parsedQty } }
                        });
                    }
                });

                successCount++;
            } catch (err) {
                errors.push(`Baris ${index + 2}: ${err.message}`);
            }
        }

        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        res.json({
            message: 'Import selesai',
            successCount,
            errorCount: errors.length,
            errors
        });

    } catch (e) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: e.message });
    }
};

// ==========================================
// ORDERS
// ==========================================
const generateOrderCode = async () => {
    const year = new Date().getFullYear();
    const prefix = `ORD/INV/${year}/`;
    const orders = await prisma.invOrder.findMany({
        where: { code: { startsWith: prefix } },
        select: { code: true }
    });
    let maxSeq = 0;
    for (const order of orders) {
        const parts = order.code.split('/');
        if (parts.length === 4) {
            const seq = parseInt(parts[3], 10);
            if (!isNaN(seq) && seq > maxSeq) {
                maxSeq = seq;
            }
        }
    }
    return `${prefix}${(maxSeq + 1).toString().padStart(4, '0')}`;
};

exports.getOrders = async (req, res) => {
    const { status } = req.query;
    try {
        const where = status ? { status } : {};
        const orders = await prisma.invOrder.findMany({
            where,
            include: {
                items: { include: { item: true } },
                createdBy: { select: { name: true, username: true } }
            },
            orderBy: { date: 'desc' }
        });
        res.json(orders);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getOrderById = async (req, res) => {
    const { id } = req.params;
    try {
        const order = await prisma.invOrder.findFirst({
            where: {
                OR: [
                    { id: isNaN(parseInt(id)) ? -1 : parseInt(id) },
                    { code: id }
                ]
            },
            include: {
                items: {
                    include: {
                        item: {
                            include: { category: true }
                        }
                    }
                },
                createdBy: { select: { name: true, username: true } }
            }
        });
        if (!order) return res.status(404).json({ error: 'Invoice pesanan gudang tidak ditemukan' });
        res.json(order);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createOrder = async (req, res) => {
    const { requesterName, requesterUnit, date, note, items } = req.body;
    try {
        if (!items || items.length === 0) return res.status(400).json({ error: 'Pilih minimal satu barang.' });
        
        const code = await generateOrderCode();
        
        const order = await prisma.invOrder.create({
            data: {
                code, requesterName, requesterUnit, note,
                date: date ? new Date(date) : new Date(),
                createdById: req.user.id,
                items: {
                    create: items.map(item => ({
                        itemId: parseInt(item.itemId),
                        qtyRequested: parseInt(item.qtyRequested),
                        note: item.note
                    }))
                }
            },
            include: { items: true }
        });
        
        res.json(order);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateOrderStatus = async (req, res) => {
    const { id } = req.params;
    const { status, note, approvedItems, warehouseId } = req.body; // approvedItems: array of { orderItemId, qtyApproved }
    
    try {
        const order = await prisma.invOrder.findUnique({ where: { id: parseInt(id) }, include: { items: true } });
        if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });
        
        const result = await prisma.$transaction(async (tx) => {
            // Jika memproses menjadi COMPLETED, kita harus memotong stok di warehouseId yang dipilih
            if (status === 'COMPLETED' && order.status !== 'COMPLETED') {
                if (!warehouseId) throw new Error('Pilih gudang sumber untuk memproses pesanan.');
                
                const txCode = await generateTxCode();
                
                // Lakukan pemotongan stok & catat transaksi untuk setiap item yang di-approve
                for (const item of order.items) {
                    const approvedQty = approvedItems?.find(ai => ai.orderItemId === item.id)?.qtyApproved || item.qtyApproved;
                    if (approvedQty > 0) {
                        // Cek stok
                        const stock = await tx.invStock.findUnique({
                            where: { itemId_warehouseId: { itemId: item.itemId, warehouseId: parseInt(warehouseId) } }
                        });
                        if (!stock || stock.quantity < approvedQty) {
                            throw new Error(`Stok tidak mencukupi untuk item ID ${item.itemId}.`);
                        }
                        
                        // Potong stok
                        await tx.invStock.update({
                            where: { itemId_warehouseId: { itemId: item.itemId, warehouseId: parseInt(warehouseId) } },
                            data: { quantity: { decrement: approvedQty } }
                        });
                        
                        // Catat transaksi OUT
                        await tx.invStockTransaction.create({
                            data: {
                                code: txCode + `-${item.id}`,
                                type: 'OUT',
                                date: new Date(),
                                itemId: item.itemId,
                                warehouseId: parseInt(warehouseId),
                                quantity: approvedQty,
                                note: `Pengeluaran untuk pesanan ${order.code}`,
                                createdById: req.user.id
                            }
                        });
                        
                        // Update OrderItem qtyDelivered
                        await tx.invOrderItem.update({
                            where: { id: item.id },
                            data: { qtyDelivered: approvedQty }
                        });
                    }
                }
            }
            
            // Update items qtyApproved jika ada (saat status = APPROVED atau lainnya)
            if (approvedItems && Array.isArray(approvedItems)) {
                for (const ai of approvedItems) {
                    await tx.invOrderItem.update({
                        where: { id: parseInt(ai.orderItemId) },
                        data: { qtyApproved: parseInt(ai.qtyApproved) }
                    });
                }
            }
            
            // Update status & note
            const updatedOrder = await tx.invOrder.update({
                where: { id: parseInt(id) },
                data: { status, note: note || order.note }
            });
            
            return updatedOrder;
        });
        
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// ==========================================
// VENDORS
// ==========================================
exports.getVendors = async (req, res) => {
    try {
        const data = await prisma.invVendor.findMany({ orderBy: { name: 'asc' } });
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createVendor = async (req, res) => {
    try {
        const data = await prisma.invVendor.create({ data: req.body });
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateVendor = async (req, res) => {
    try {
        const data = await prisma.invVendor.update({
            where: { id: parseInt(req.params.id) },
            data: req.body
        });
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.deleteVendor = async (req, res) => {
    try {
        await prisma.invVendor.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'Vendor deleted' });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// ==========================================
// DASHBOARD SUMMARY
// ==========================================
exports.getDashboardSummary = async (req, res) => {
    try {
        const [items, warehouses, transactions, orders, categories] = await Promise.all([
            prisma.invItem.findMany({
                include: {
                    category: true,
                    stocks: { include: { warehouse: true } }
                }
            }),
            prisma.uniformWarehouse.findMany({ orderBy: { name: 'asc' } }),
            prisma.invStockTransaction.findMany({
                take: 10,
                orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
                include: { item: true, warehouse: true, toWarehouse: true, createdBy: { select: { id: true, name: true, username: true } } }
            }),
            prisma.invOrder.findMany({
                orderBy: { date: 'desc' },
                include: { items: { include: { item: true } } }
            }),
            prisma.invCategory.findMany({
                include: { _count: { select: { items: true } } }
            })
        ]);

        let totalItems = items.length;
        let totalCategories = categories.length;
        let totalWarehouses = warehouses.length;

        let totalStockVolume = 0;
        let totalAssetValue = 0;
        let lowStockCount = 0;
        let outOfStockCount = 0;

        const alertItems = [];

        items.forEach(item => {
            const currentStock = item.stocks.reduce((acc, s) => acc + s.quantity, 0);
            totalStockVolume += currentStock;
            const price = item.sellingPrice || item.price || 0;
            totalAssetValue += (currentStock * price);

            const isOut = currentStock === 0;
            const isLow = currentStock > 0 && currentStock <= (item.minStock || 5);

            if (isOut) outOfStockCount++;
            else if (isLow) lowStockCount++;

            if (isOut || isLow) {
                alertItems.push({
                    id: item.id,
                    code: item.code,
                    name: item.name,
                    unit: item.unit,
                    image: item.image,
                    minStock: item.minStock || 5,
                    categoryName: item.category?.name || '-',
                    currentStock,
                    isOut,
                    isLow
                });
            }
        });

        const pendingOrdersCount = orders.filter(o => o.status === 'PENDING').length;
        const approvedOrdersCount = orders.filter(o => o.status === 'APPROVED').length;
        const processOrdersCount = orders.filter(o => o.status === 'PROCESS').length;
        const completedOrdersCount = orders.filter(o => o.status === 'COMPLETED').length;
        const rejectedOrdersCount = orders.filter(o => o.status === 'REJECTED').length;

        const recentPendingOrders = orders.filter(o => o.status === 'PENDING').slice(0, 5);

        const categoryChartData = categories.map(cat => ({
            name: cat.name,
            totalItems: cat._count?.items || 0
        })).filter(c => c.totalItems > 0);

        const orderStatusData = [
            { name: 'Menunggu', value: pendingOrdersCount, color: '#f59e0b' },
            { name: 'Disetujui', value: approvedOrdersCount, color: '#3b82f6' },
            { name: 'Diproses', value: processOrdersCount, color: '#6366f1' },
            { name: 'Selesai', value: completedOrdersCount, color: '#10b981' },
            { name: 'Ditolak', value: rejectedOrdersCount, color: '#ef4444' },
        ].filter(d => d.value > 0);

        res.json({
            metrics: {
                totalItems,
                totalCategories,
                totalWarehouses,
                totalStockVolume,
                totalAssetValue,
                lowStockCount,
                outOfStockCount,
                pendingOrders: pendingOrdersCount,
                completedOrders: completedOrdersCount,
                totalOrders: orders.length
            },
            recentTransactions: transactions,
            recentPendingOrders,
            alertItems: alertItems.slice(0, 10),
            categoryChartData,
            orderStatusData,
            warehouses
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
