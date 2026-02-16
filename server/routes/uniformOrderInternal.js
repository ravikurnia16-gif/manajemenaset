const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
// Using standard require, assuming middleware exists.
// If not, I'll mock it or catch error.
const { authMiddleware } = require('../middleware/authMiddleware');

// ======================== HELPERS ========================

const generateOrderCode = async () => {
    const year = new Date().getFullYear();
    const count = await prisma.uniformOrder.count();
    return `ORD/${year}/${(count + 1).toString().padStart(3, '0')}`;
};

// ======================== CONTROLLER LOGIC ========================

const getAvailableUniforms = async (req, res) => {
    try {
        const { unit } = req.query;
        const where = {
            category: { name: { contains: 'seragam' } },
            stock: { gt: 0 }
        };
        if (unit) where.itemUnit = unit;

        const items = await prisma.warehouseItem.findMany({
            where,
            include: { category: true },
            orderBy: [{ itemUnit: 'asc' }, { type: 'asc' }, { gender: 'asc' }, { size: 'asc' }]
        });

        const grouped = {};
        items.forEach(item => {
            const u = item.itemUnit || 'Lainnya';
            if (!grouped[u]) grouped[u] = [];
            grouped[u].push(item);
        });

        res.json({ items, grouped });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

const createOrder = async (req, res) => {
    try {
        const { customerName, customerPhone, customerUnit, studentName, studentClass, note, items } = req.body;

        // Relaxed validation for Decoupled Mode
        if (!customerPhone || !customerUnit || !studentName) {
            return res.status(400).json({ error: 'Data tidak lengkap' });
        }

        const code = await generateOrderCode();

        let totalAmount = 0;
        for (const item of items) {
            const warehouseItem = await prisma.warehouseItem.findUnique({ where: { id: parseInt(item.itemId) } });
            if (!warehouseItem) return res.status(400).json({ error: `Item ID ${item.itemId} tidak ditemukan` });
            if (warehouseItem.stock < parseInt(item.quantity)) {
                return res.status(400).json({ error: `Stok ${warehouseItem.name} tidak mencukupi (sisa: ${warehouseItem.stock})` });
            }
            item.price = warehouseItem.purchasePrice || 0;
            totalAmount += item.price * parseInt(item.quantity);
        }

        const order = await prisma.uniformOrder.create({
            data: {
                code,
                customerName,
                customerPhone,
                customerUnit,
                studentName,
                studentClass: studentClass || null,
                note: note || null,
                totalAmount,
                items: {
                    create: items.map(item => ({
                        itemId: parseInt(item.itemId),
                        quantity: parseInt(item.quantity),
                        price: item.price
                    }))
                }
            },
            include: { items: { include: { item: true } } }
        });

        // Send WhatsApp notification
        try {
            const { sendMessage } = require('../services/whatsappService');
            const settings = await prisma.setting.findFirst();
            if (settings?.waGroupId) {
                const itemList = order.items.map((oi, i) =>
                    `${i + 1}. ${oi.item.name} (${oi.item.size || '-'}) x${oi.quantity}`
                ).join('\n');

                const msg = `🛒 *PESANAN SERAGAM BARU*\n\n` +
                    `📋 Kode: *${order.code}*\n` +
                    `👤 Pemesan: ${order.customerName}\n` +
                    `📱 HP: ${order.customerPhone}\n` +
                    `🏫 Unit: ${order.customerUnit}\n` +
                    `👨‍🎓 Siswa: ${order.studentName}${order.studentClass ? ` (${order.studentClass})` : ''}\n\n` +
                    `📦 *Item:*\n${itemList}\n\n` +
                    `💰 Total: Rp ${order.totalAmount.toLocaleString('id-ID')}\n` +
                    `📝 Catatan: ${order.note || '-'}`;

                await sendMessage(settings.waGroupId, msg);
            }
        } catch (waError) {
            console.error('WA notification failed:', waError.message);
        }

        res.json({ message: 'Pesanan berhasil dibuat!', order });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

const checkOrder = async (req, res) => {
    try {
        const { code } = req.params;
        const { phone } = req.query;
        const order = await prisma.uniformOrder.findUnique({
            where: { code },
            include: { items: { include: { item: { select: { name: true, size: true, gender: true, type: true } } } } }
        });
        if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
        if (phone && order.customerPhone !== phone) {
            return res.status(403).json({ error: 'No HP tidak cocok' });
        }
        res.json(order);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

const getAllOrders = async (req, res) => {
    try {
        const { status, unit, startDate, endDate } = req.query;
        const where = {};
        if (status) where.status = status;
        if (unit) where.customerUnit = unit;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate);
        }

        const orders = await prisma.uniformOrder.findMany({
            where,
            include: { items: { include: { item: { select: { name: true, size: true, gender: true, type: true, code: true } } } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json(orders);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const order = await prisma.uniformOrder.update({
            where: { id: parseInt(req.params.id) },
            data: { status }
        });
        res.json({ message: 'Status diperbarui', order });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

const deleteOrder = async (req, res) => {
    try {
        await prisma.uniformOrder.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'Pesanan dihapus' });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// ======================== ROUTES ========================

// Public routes
router.get('/items', getAvailableUniforms);
router.post('/', createOrder);
router.get('/check/:code', checkOrder);

// Admin routes
router.get('/admin/orders', authMiddleware, getAllOrders);
router.put('/admin/:id', authMiddleware, updateOrderStatus);
router.delete('/admin/:id', authMiddleware, deleteOrder);

module.exports = router;
