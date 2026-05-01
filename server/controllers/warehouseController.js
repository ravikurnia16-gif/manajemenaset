const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { deleteFile } = require('../services/minioService');

// ======================== CATEGORY ========================
exports.getCategories = async (req, res) => {
    try {
        const cats = await prisma.warehouseCategory.findMany({ include: { _count: { select: { items: true } } } });
        res.json(cats);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createCategory = async (req, res) => {
    try {
        const cat = await prisma.warehouseCategory.create({ data: { name: req.body.name } });
        res.json(cat);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// ======================== DASHBOARD ========================
exports.getDashboard = async (req, res) => {
    try {
        const totalItems = await prisma.warehouseItem.count();
        const totalStock = await prisma.warehouseItem.aggregate({ _sum: { stock: true } });
        
        // Manual low stock check
        const allItems = await prisma.warehouseItem.findMany({ include: { category: true } });
        const lowStockItems = allItems.filter(i => i.stock <= i.minStock);

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        // Calculate Valuation using FIFO batches (remainingQty * price)
        const allBatches = await prisma.warehouseTransactionItem.findMany({
            where: { remainingQty: { gt: 0 } },
            select: { remainingQty: true, price: true, itemId: true }
        });

        let totalValuation = 0;
        const itemValuations = {}; // itemId -> total value for that item

        allBatches.forEach(b => {
            const val = (b.remainingQty || 0) * (b.price || 0);
            totalValuation += val;
            itemValuations[b.itemId] = (itemValuations[b.itemId] || 0) + val;
        });

        // Stock per category (with valuation)
        const categories = await prisma.warehouseCategory.findMany({
            include: { items: { select: { id: true, stock: true } } }
        });
        
        const stockByCategory = categories.map(c => {
            const catTotal = c.items.reduce((s, i) => s + i.stock, 0);
            const catValue = c.items.reduce((s, i) => s + (itemValuations[i.id] || 0), 0);
            return { name: c.name, total: catTotal, value: catValue };
        });

        const txThisMonth = await prisma.warehouseTransaction.count({ where: { date: { gte: startOfMonth } } });
        const txInThisMonth = await prisma.warehouseTransaction.count({ where: { date: { gte: startOfMonth }, type: 'IN' } });
        const txOutThisMonth = await prisma.warehouseTransaction.count({ where: { date: { gte: startOfMonth }, type: 'OUT' } });

        const recentTransactions = await prisma.warehouseTransaction.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
                createdBy: { select: { name: true } },
                items: { include: { item: { select: { name: true, size: true } } } }
            }
        });

        const orders = await prisma.uniformOrder.findMany({ select: { status: true, totalAmount: true } });
        const orderStats = orders.reduce((acc, o) => {
            acc[o.status] = (acc[o.status] || 0) + 1;
            if (['PENDING', 'CONFIRMED'].includes(o.status)) {
                acc.totalPendingValue = (acc.totalPendingValue || 0) + (o.totalAmount || 0);
            }
            return acc;
        }, { total: orders.length, PENDING: 0, CONFIRMED: 0, READY: 0, PICKED_UP: 0, totalPendingValue: 0 });

        res.json({
            totalItems,
            totalStock: totalStock._sum.stock || 0,
            totalValuation,
            lowStockCount: lowStockItems.length,
            lowStockItems: lowStockItems.slice(0, 10).map(i => ({ ...i, category: i.category?.name || '-' })),
            txThisMonth, txInThisMonth, txOutThisMonth,
            stockByCategory, recentTransactions, orderStats
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// ======================== STOCK ITEMS ========================
exports.getAllItems = async (req, res) => {
    const { categoryId, gender, size, type, purchaseYear, search } = req.query;
    try {
        const where = {};
        if (categoryId) where.categoryId = parseInt(categoryId);
        if (gender) {
            const genderMap = { 'Ikhwan': ['Ikhwan', 'L', 'ikhwan'], 'Akhwat': ['Akhwat', 'P', 'akhwat'], 'L': ['L', 'Ikhwan'], 'P': ['P', 'Akhwat'] };
            where.gender = { in: genderMap[gender] || [gender] };
        }
        if (size) where.size = size;
        if (type) where.type = type;
        if (purchaseYear) where.purchaseYear = parseInt(purchaseYear);

        const items = await prisma.warehouseItem.findMany({
            where, include: { category: true }, orderBy: { createdAt: 'desc' }
        });

        let filtered = items;
        if (search) {
            const s = search.toLowerCase();
            filtered = items.filter(i =>
                (i.name?.toLowerCase() || '').includes(s) ||
                (i.code?.toLowerCase() || '').includes(s)
            );
        }
        res.json(filtered);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getItemById = async (req, res) => {
    try {
        const item = await prisma.warehouseItem.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { 
                category: true, 
                transactionItems: { 
                    include: { transaction: true }, 
                    orderBy: { transaction: { date: 'desc' } }, 
                    take: 20 
                } 
            }
        });
        if (!item) return res.status(404).json({ error: 'Item not found' });
        res.json(item);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// ======================== MAINTENANCE ========================
exports.fixExistingGenderData = async (req, res) => {
    try {
        if (!['SUPER_ADMIN', 'BIDANG_IT'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Akses ditolak.' });
        }
        const genderMap = [
            { values: ['akhowat', 'akhwat', 'perempuan', 'wanita'], normalized: 'P' },
            { values: ['ikhwan', 'laki-laki', 'pria'], normalized: 'L' }
        ];
        let totalFixed = 0;
        for (const mapping of genderMap) {
            for (const val of mapping.values) {
                const result = await prisma.warehouseItem.updateMany({
                    where: { gender: val }, data: { gender: mapping.normalized }
                });
                totalFixed += result.count;
            }
        }
        res.json({ success: true, message: `Pembersihan selesai. Total ${totalFixed} data diperbaiki.` });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

const generateItemCode = async (categoryName, knownSequence = null) => {
    const prefix = categoryName?.toLowerCase().includes('seragam') ? 'GD/SRG' : 'GD/PLK';
    let nextSequence = knownSequence;
    if (nextSequence === null) {
        const lastItem = await prisma.warehouseItem.findFirst({
            where: { code: { startsWith: `${prefix}/` } }, orderBy: { code: 'desc' }
        });
        nextSequence = 1;
        if (lastItem) {
            const parts = lastItem.code.split('/');
            if (parts.length === 3) {
                const lastSeq = parseInt(parts[2]);
                if (!isNaN(lastSeq)) nextSequence = lastSeq + 1;
            }
        }
    }
    return `${prefix}/${nextSequence.toString().padStart(3, '0')}`;
};

exports.createItem = async (req, res) => {
    const { name, categoryId, type, gender, size, purchaseYear, itemUnit, stock, minStock, purchasePrice, supplier, location, image } = req.body;
    try {
        const category = await prisma.warehouseCategory.findUnique({ where: { id: parseInt(categoryId) } });
        const code = await generateItemCode(category?.name);
        const item = await prisma.warehouseItem.create({
            data: {
                code, name, categoryId: parseInt(categoryId),
                type: type || null, gender: gender || null, size: size || null,
                purchaseYear: purchaseYear ? parseInt(purchaseYear) : null, itemUnit: itemUnit || null,
                stock: parseInt(stock) || 0, minStock: parseInt(minStock) || 5,
                purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
                supplier: supplier || null, location: location || null, image: req.fileUrl || image || null
            }
        });
        res.json(item);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateItem = async (req, res) => {
    const { name, categoryId, type, gender, size, purchaseYear, itemUnit, stock, minStock, purchasePrice, supplier, location, image } = req.body;
    try {
        const item = await prisma.warehouseItem.update({
            where: { id: parseInt(req.params.id) },
            data: {
                name, categoryId: categoryId ? parseInt(categoryId) : undefined,
                type, gender, size, purchaseYear: purchaseYear ? parseInt(purchaseYear) : undefined,
                itemUnit, stock: stock !== undefined ? parseInt(stock) : undefined,
                minStock: minStock !== undefined ? parseInt(minStock) : undefined,
                purchasePrice: purchasePrice !== undefined ? parseFloat(purchasePrice) : undefined,
                supplier, location, image: req.fileUrl !== undefined ? req.fileUrl : (image !== undefined ? image : undefined)
            }
        });
        res.json(item);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.deleteItem = async (req, res) => {
    try {
        const item = await prisma.warehouseItem.findUnique({ where: { id: parseInt(req.params.id) } });
        if (item && item.image) await deleteFile(item.image);
        await prisma.warehouseItem.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'Item dihapus' });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// ======================== IMPORT ========================
exports.importItems = async (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Data import kosong' });
    
    const normalizeGender = (val) => {
        if (!val) return null;
        const v = String(val).trim().toLowerCase();
        if (['p', 'perempuan', 'akhwat', 'akhowat', 'wanita'].includes(v)) return 'P';
        if (['l', 'laki-laki', 'ikhwan', 'pria'].includes(v)) return 'L';
        return null;
    };

    try {
        const result = await prisma.$transaction(async (tx) => {
            let created = 0; let updated = 0;
            const sequenceMap = {};
            for (const row of items) {
                const catId = parseInt(row.categoryId);
                const gender = normalizeGender(row.gender);
                const name = String(row.name).trim();
                const size = row.size ? String(row.size).trim() : null;
                const type = row.type ? String(row.type).trim() : null;
                const itemUnit = row.itemUnit ? String(row.itemUnit).trim() : null;

                const existingItem = await tx.warehouseItem.findFirst({
                    where: { name, categoryId: catId, gender, size, type, itemUnit }
                });

                if (existingItem) {
                    await tx.warehouseItem.update({
                        where: { id: existingItem.id },
                        data: { stock: { increment: parseInt(row.stock) || 0 } }
                    });
                    updated++;
                } else {
                    const category = await tx.warehouseCategory.findUnique({ where: { id: catId } });
                    const prefix = category.name.toLowerCase().includes('seragam') ? 'GD/SRG' : 'GD/PLK';
                    if (sequenceMap[prefix] === undefined) {
                        const lastItem = await tx.warehouseItem.findFirst({
                            where: { code: { startsWith: `${prefix}/` } }, orderBy: { code: 'desc' }
                        });
                        sequenceMap[prefix] = lastItem ? (parseInt(lastItem.code.split('/')[2]) || 0) + 1 : 1;
                    }
                    const code = `${prefix}/${sequenceMap[prefix].toString().padStart(3, '0')}`;
                    await tx.warehouseItem.create({
                        data: {
                            code, name, categoryId: catId, type, gender, size,
                            purchaseYear: row.purchaseYear ? parseInt(row.purchaseYear) : null, itemUnit,
                            stock: parseInt(row.stock) || 0, minStock: parseInt(row.minStock) || 5,
                            purchasePrice: row.purchasePrice ? parseFloat(row.purchasePrice) : null,
                            supplier: row.supplier || null, location: row.location || null
                        }
                    });
                    sequenceMap[prefix]++;
                    created++;
                }
            }
            return { created, updated };
        });
        res.json({ success: true, message: `Import selesai. ${result.created} baru, ${result.updated} update.` });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// ======================== TRANSACTIONS (FIFO) ========================
const generateTxCode = async () => {
    const year = new Date().getFullYear();
    const lastTx = await prisma.warehouseTransaction.findFirst({
        where: { code: { startsWith: `TRX/${year}/` } }, orderBy: { code: 'desc' }
    });
    const nextSeq = lastTx ? (parseInt(lastTx.code.split('/')[2]) || 0) + 1 : 1;
    return `TRX/${year}/${nextSeq.toString().padStart(3, '0')}`;
};

exports.getAllTransactions = async (req, res) => {
    const { type, startDate, endDate } = req.query;
    try {
        const where = {};
        if (type) where.type = type;
        if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = new Date(startDate);
            if (endDate) where.date.lte = new Date(endDate);
        }
        const txs = await prisma.warehouseTransaction.findMany({
            where, include: {
                createdBy: { select: { name: true } },
                items: { include: { item: { select: { code: true, name: true, size: true } } } }
            },
            orderBy: { date: 'desc' }
        });
        res.json(txs);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createTransaction = async (req, res) => {
    const { type, date, note, items } = req.body;
    try {
        const code = await generateTxCode();
        const result = await prisma.$transaction(async (tx) => {
            const transaction = await tx.warehouseTransaction.create({
                data: { code, type, date: new Date(date), note: note || null, createdById: req.user.id }
            });

            for (const item of items) {
                const itemId = parseInt(item.itemId);
                const quantity = parseInt(item.quantity);

                // For OUT transactions, check total available stock first
                if (type === 'OUT') {
                    const warehouseItem = await tx.warehouseItem.findUnique({ where: { id: itemId } });
                    if (warehouseItem.stock < quantity) {
                        throw new Error(`Stok tidak mencukupi untuk item ${warehouseItem.name}. Stok saat ini: ${warehouseItem.stock}`);
                    }
                }

                // Create the transaction item
                const txItem = await tx.warehouseTransactionItem.create({
                    data: {
                        transactionId: transaction.id, itemId, quantity,
                        price: item.price ? parseFloat(item.price) : null,
                        remainingQty: type === 'IN' ? quantity : null, // Only IN items act as batches
                        recipientName: item.recipientName || null,
                        recipientUnit: item.recipientUnit || null
                    }
                });

                // Update WarehouseItem Global Stock
                const delta = type === 'IN' ? quantity : -quantity;
                await tx.warehouseItem.update({
                    where: { id: itemId }, data: { stock: { increment: delta } }
                });

                // FIFO LOGIC for OUT Transactions
                if (type === 'OUT') {
                    let needed = quantity;
                    const batches = await tx.warehouseTransactionItem.findMany({
                        where: { itemId, remainingQty: { gt: 0 } },
                        include: { transaction: true },
                        orderBy: { transaction: { date: 'asc' } } // FIFO: Oldest date first
                    });

                    for (const batch of batches) {
                        if (needed <= 0) break;
                        const take = Math.min(needed, batch.remainingQty);
                        
                        // Deduct from batch
                        await tx.warehouseTransactionItem.update({
                            where: { id: batch.id },
                            data: { remainingQty: { decrement: take } }
                        });

                        // Record the link
                        await tx.warehouseStockDeduction.create({
                            data: { inItemId: batch.id, outItemId: txItem.id, quantity: take }
                        });

                        needed -= take;
                    }
                    
                    if (needed > 0) {
                        // This should theoretically not happen because of the check above, but for safety:
                        throw new Error(`Gagal memproses FIFO: Stok batch tidak sinkron.`);
                    }
                }
            }
            return transaction;
        });

        res.json({ message: 'Transaksi berhasil', data: result });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.deleteTransaction = async (req, res) => {
    try {
        const tx = await prisma.warehouseTransaction.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { items: { include: { deductedFrom: true, deductions: true } } }
        });
        if (!tx) return res.status(404).json({ error: 'Transaksi tidak ditemukan' });

        await prisma.$transaction(async (txPrisma) => {
            for (const item of tx.items) {
                // 1. Reverse Global Stock
                const delta = tx.type === 'IN' ? -item.quantity : item.quantity;
                await txPrisma.warehouseItem.update({
                    where: { id: item.itemId }, data: { stock: { increment: delta } }
                });

                // 2. Reverse FIFO Logic
                if (tx.type === 'OUT') {
                    // Restore remainingQty to the source batches
                    for (const deduction of item.deductedFrom) {
                        await txPrisma.warehouseTransactionItem.update({
                            where: { id: deduction.inItemId },
                            data: { remainingQty: { increment: deduction.quantity } }
                        });
                    }
                    // Deductions will be automatically deleted by Cascade Delete on TransactionItem
                } else if (tx.type === 'IN') {
                    // If an IN transaction is deleted, check if it was already used by any OUT
                    const usedCount = await txPrisma.warehouseStockDeduction.count({ where: { inItemId: item.id } });
                    if (usedCount > 0) {
                        throw new Error(`Tidak dapat menghapus transaksi IN karena stoknya sudah digunakan oleh transaksi OUT.`);
                    }
                }
            }
            await txPrisma.warehouseTransaction.delete({ where: { id: tx.id } });
        });

        res.json({ message: 'Transaksi dihapus dan stok dikembalikan' });
    } catch (e) { res.status(500).json({ error: e.message }); }
};
