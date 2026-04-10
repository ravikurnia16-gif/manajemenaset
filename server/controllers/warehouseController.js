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
        // Manual low stock check (compare stock to each item's own minStock)
        const allItems = await prisma.warehouseItem.findMany({ include: { category: true } });
        const lowStockItems = allItems.filter(i => i.stock <= i.minStock);

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const txThisMonth = await prisma.warehouseTransaction.count({
            where: { date: { gte: startOfMonth } }
        });
        const txInThisMonth = await prisma.warehouseTransaction.count({
            where: { date: { gte: startOfMonth }, type: 'IN' }
        });
        const txOutThisMonth = await prisma.warehouseTransaction.count({
            where: { date: { gte: startOfMonth }, type: 'OUT' }
        });

        // Stock per category
        const categories = await prisma.warehouseCategory.findMany({
            include: { items: { select: { stock: true, purchasePrice: true } } }
        });
        
        let totalValuation = 0;
        const stockByCategory = categories.map(c => {
            const catTotal = c.items.reduce((s, i) => s + i.stock, 0);
            const catValue = c.items.reduce((s, i) => s + (i.stock * (i.purchasePrice || 0)), 0);
            totalValuation += catValue;
            return { name: c.name, total: catTotal, value: catValue };
        });

        // Recent Transactions (Log Aktivitas)
        const recentTransactions = await prisma.warehouseTransaction.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
                createdBy: { select: { name: true } },
                items: { include: { item: { select: { name: true, size: true } } } }
            }
        });

        // Order Stats (Statistik Pesanan)
        const orders = await prisma.uniformOrder.findMany({
            select: { status: true, totalAmount: true }
        });
        const orderStats = orders.reduce((acc, o) => {
            acc[o.status] = (acc[o.status] || 0) + 1;
            acc.totalPendingValue = acc.totalPendingValue || 0;
            if (['PENDING', 'CONFIRMED'].includes(o.status)) {
                acc.totalPendingValue += (o.totalAmount || 0);
            }
            return acc;
        }, { total: orders.length, PENDING: 0, CONFIRMED: 0, READY: 0, PICKED_UP: 0 });

        res.json({
            totalItems,
            totalStock: totalStock._sum.stock || 0,
            totalValuation,
            lowStockCount: lowStockItems.length,
            lowStockItems: lowStockItems.slice(0, 10).map(i => ({ ...i, category: i.category?.name || '-' })),
            txThisMonth,
            txInThisMonth,
            txOutThisMonth,
            stockByCategory,
            recentTransactions,
            orderStats
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
            where,
            include: { category: true },
            orderBy: { createdAt: 'desc' }
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
            include: { category: true, transactionItems: { include: { transaction: true }, orderBy: { transaction: { date: 'desc' } }, take: 20 } }
        });
        if (!item) return res.status(404).json({ error: 'Item not found' });
        res.json(item);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// Generate warehouse item code
const generateItemCode = async (categoryName, knownSequence = null) => {
    const prefix = categoryName?.toLowerCase().includes('seragam') ? 'GD/SRG' : 'GD/PLK';
    
    let nextSequence = knownSequence;
    
    if (nextSequence === null) {
        const lastItem = await prisma.warehouseItem.findFirst({
            where: {
                code: {
                    startsWith: `${prefix}/`
                }
            },
            orderBy: {
                code: 'desc'
            }
        });

        nextSequence = 1;
        if (lastItem) {
            const parts = lastItem.code.split('/');
            if (parts.length === 3) {
                const lastSeq = parseInt(parts[2]);
                if (!isNaN(lastSeq)) {
                    nextSequence = lastSeq + 1;
                }
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
                code, name,
                categoryId: parseInt(categoryId),
                type: type || null,
                gender: gender || null,
                size: size || null,
                purchaseYear: purchaseYear ? parseInt(purchaseYear) : null,
                itemUnit: itemUnit || null,
                stock: parseInt(stock) || 0,
                minStock: parseInt(minStock) || 5,
                purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
                supplier: supplier || null,
                location: location || null,
                image: req.fileUrl || image || null
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
                type, gender, size,
                purchaseYear: purchaseYear ? parseInt(purchaseYear) : undefined,
                itemUnit,
                stock: stock !== undefined ? parseInt(stock) : undefined,
                minStock: minStock !== undefined ? parseInt(minStock) : undefined,
                purchasePrice: purchasePrice !== undefined ? parseFloat(purchasePrice) : undefined,
                supplier, location,
                image: req.fileUrl !== undefined ? req.fileUrl : (image !== undefined ? image : undefined)
            }
        });
        res.json(item);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.deleteItem = async (req, res) => {
    try {
        const item = await prisma.warehouseItem.findUnique({ where: { id: parseInt(req.params.id) } });
        if (item && item.image) {
            await deleteFile(item.image);
        }
        await prisma.warehouseItem.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'Item dihapus' });
    } catch (e) { res.status(500).json({ error: e.message }); }
};




// ======================== IMPORT / EXPORT ========================
exports.importItems = async (req, res) => {
    const { items } = req.body; // Array of item objects
    try {
        let created = 0;
        const sequenceMap = {}; // Cache for prefixes: { 'GD/SRG': 15, 'GD/PLK': 5 }

        for (const row of items) {
            if (!row.name || !row.categoryId) continue;

            const category = await prisma.warehouseCategory.findUnique({ where: { id: parseInt(row.categoryId) } });
            if (!category) continue;

            const prefix = category.name.toLowerCase().includes('seragam') ? 'GD/SRG' : 'GD/PLK';

            // Initialize sequence for this prefix if not already in cache
            if (sequenceMap[prefix] === undefined) {
                const lastItem = await prisma.warehouseItem.findFirst({
                    where: { code: { startsWith: `${prefix}/` } },
                    orderBy: { code: 'desc' }
                });

                let startSeq = 1;
                if (lastItem) {
                    const parts = lastItem.code.split('/');
                    if (parts.length === 3) {
                        const lastSeq = parseInt(parts[2]);
                        if (!isNaN(lastSeq)) startSeq = lastSeq + 1;
                    }
                }
                sequenceMap[prefix] = startSeq;
            }

            const currentSeq = sequenceMap[prefix]++;
            const code = await generateItemCode(category.name, currentSeq);

            await prisma.warehouseItem.create({
                data: {
                    code, name: row.name,
                    categoryId: parseInt(row.categoryId),
                    type: row.type || null,
                    gender: row.gender || null,
                    size: row.size || null,
                    purchaseYear: row.purchaseYear ? parseInt(row.purchaseYear) : null,
                    itemUnit: row.itemUnit || null,
                    stock: parseInt(row.stock) || 0,
                    minStock: parseInt(row.minStock) || 5,
                    purchasePrice: row.purchasePrice ? parseFloat(row.purchasePrice) : null,
                    supplier: row.supplier || null,
                    location: row.location || null,
                    image: row.image || null
                }
            });
            created++;
        }
        res.json({ message: `${created} item berhasil diimport` });
    } catch (e) {
        console.error("Import Error:", e);
        res.status(500).json({ error: e.message });
    }
};

exports.exportItems = async (req, res) => {
    try {
        const items = await prisma.warehouseItem.findMany({ include: { category: true }, orderBy: { code: 'asc' } });
        res.json(items);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// ======================== TRANSACTIONS ========================
const generateTxCode = async () => {
    const year = new Date().getFullYear();
    
    const lastTx = await prisma.warehouseTransaction.findFirst({
        where: {
            code: {
                startsWith: `TRX/${year}/`
            }
        },
        orderBy: {
            code: 'desc'
        }
    });

    let nextSequence = 1;
    if (lastTx) {
        const parts = lastTx.code.split('/');
        if (parts.length === 3) {
            const lastSeq = parseInt(parts[2]);
            if (!isNaN(lastSeq)) {
                nextSequence = lastSeq + 1;
            }
        }
    }

    return `TRX/${year}/${nextSequence.toString().padStart(3, '0')}`;
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
            where,
            include: {
                createdBy: { select: { username: true, name: true } },
                items: { include: { item: { select: { code: true, name: true, size: true, gender: true, itemUnit: true } } } }
            },
            orderBy: { date: 'desc' }
        });
        res.json(txs);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createTransaction = async (req, res) => {
    const { type, date, note, items } = req.body;
    // items: [{ itemId, quantity, recipientName?, recipientUnit? }]
    try {
        const code = await generateTxCode();

        const tx = await prisma.$transaction(async (tx) => {
            const transaction = await tx.warehouseTransaction.create({
                data: {
                    code, type, date: new Date(date),
                    note: note || null,
                    createdById: req.user.id
                }
            });

            for (const item of items) {
                await tx.warehouseTransactionItem.create({
                    data: {
                        transactionId: transaction.id,
                        itemId: parseInt(item.itemId),
                        quantity: parseInt(item.quantity),
                        recipientName: item.recipientName || null,
                        recipientUnit: item.recipientUnit || null
                    }
                });

                // Update stock
                const delta = type === 'IN' ? parseInt(item.quantity) : -parseInt(item.quantity);
                await tx.warehouseItem.update({
                    where: { id: parseInt(item.itemId) },
                    data: { stock: { increment: delta } }
                });
            }

            return transaction;
        });

        res.json({ message: 'Transaksi berhasil', data: tx });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.deleteTransaction = async (req, res) => {
    try {
        // Reverse stock changes first
        const tx = await prisma.warehouseTransaction.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { items: true }
        });
        if (!tx) return res.status(404).json({ error: 'Transaksi tidak ditemukan' });

        await prisma.$transaction(async (prismaClient) => {
            for (const item of tx.items) {
                const delta = tx.type === 'IN' ? -item.quantity : item.quantity;
                await prismaClient.warehouseItem.update({
                    where: { id: item.itemId },
                    data: { stock: { increment: delta } }
                });
            }
            await prismaClient.warehouseTransaction.delete({ where: { id: tx.id } });
        });

        res.json({ message: 'Transaksi dihapus dan stok dikembalikan' });
    } catch (e) { res.status(500).json({ error: e.message }); }
};
