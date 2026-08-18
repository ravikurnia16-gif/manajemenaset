const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
        const data = await prisma.invCategory.findMany({ orderBy: { name: 'asc' } });
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createCategory = async (req, res) => {
    try {
        const data = await prisma.invCategory.create({ data: req.body });
        res.json(data);
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
        const code = await generateItemCode();
        const data = await prisma.invItem.create({
            data: {
                ...req.body,
                code,
                categoryId: parseInt(req.body.categoryId),
                minStock: req.body.minStock ? parseInt(req.body.minStock) : 5,
                price: req.body.price ? parseFloat(req.body.price) : null
            }
        });
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateItem = async (req, res) => {
    try {
        const data = await prisma.invItem.update({
            where: { id: parseInt(req.params.id) },
            data: {
                ...req.body,
                categoryId: req.body.categoryId ? parseInt(req.body.categoryId) : undefined,
                minStock: req.body.minStock !== undefined ? parseInt(req.body.minStock) : undefined,
                price: req.body.price !== undefined ? parseFloat(req.body.price) : undefined
            }
        });
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.deleteItem = async (req, res) => {
    try {
        await prisma.invItem.delete({ where: { id: parseInt(req.params.id) } });
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

exports.createTransaction = async (req, res) => {
    const { type, date, note, itemId, warehouseId, toWarehouseId, quantity } = req.body;
    try {
        const parsedQty = parseInt(quantity);
        if (parsedQty <= 0) return res.status(400).json({ error: 'Quantity must be greater than 0' });
        
        const code = await generateTxCode();
        
        const result = await prisma.$transaction(async (tx) => {
            // Check current stock for OUT or MUTATION
            if (type === 'OUT' || type === 'MUTATION') {
                const stock = await tx.invStock.findUnique({
                    where: { itemId_warehouseId: { itemId: parseInt(itemId), warehouseId: parseInt(warehouseId) } }
                });
                if (!stock || stock.quantity < parsedQty) {
                    throw new Error('Stock is insufficient for this operation.');
                }
            }

            // Create Transaction Record
            const transaction = await tx.invStockTransaction.create({
                data: {
                    code, type, note,
                    date: date ? new Date(date) : new Date(),
                    itemId: parseInt(itemId),
                    warehouseId: parseInt(warehouseId),
                    toWarehouseId: toWarehouseId ? parseInt(toWarehouseId) : null,
                    quantity: parsedQty,
                    createdById: req.user.id
                }
            });

            // Update Stock Source (Decrement for OUT / MUTATION, Increment for IN)
            const delta = type === 'IN' ? parsedQty : -parsedQty;
            await tx.invStock.upsert({
                where: { itemId_warehouseId: { itemId: parseInt(itemId), warehouseId: parseInt(warehouseId) } },
                create: { itemId: parseInt(itemId), warehouseId: parseInt(warehouseId), quantity: delta },
                update: { quantity: { increment: delta } }
            });

            // If MUTATION, increment destination stock
            if (type === 'MUTATION' && toWarehouseId) {
                await tx.invStock.upsert({
                    where: { itemId_warehouseId: { itemId: parseInt(itemId), warehouseId: parseInt(toWarehouseId) } },
                    create: { itemId: parseInt(itemId), warehouseId: parseInt(toWarehouseId), quantity: parsedQty },
                    update: { quantity: { increment: parsedQty } }
                });
            }

            return transaction;
        });
        
        res.json({ message: 'Transaction successful', data: result });
    } catch (e) { res.status(500).json({ error: e.message }); }
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
