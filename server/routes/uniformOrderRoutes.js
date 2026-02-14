const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const path = require('path');

// Middlewares
// Use try-require for robustness or standard require
let authMiddleware;
try {
    const authModule = require('../middleware/authMiddleware');
    authMiddleware = authModule.verifyToken;
} catch (e) {
    console.warn('Warning: authMiddleware not found, securing administrative routes might fail.');
    authMiddleware = (req, res, next) => next();
}

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
            category: { name: { contains: 'seragam' } }
            // stock: { gt: 0 } // Backorder allowed
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
    } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

const createOrder = async (req, res) => {
    try {
        const { customerName, customerPhone, customerUnit, studentName, studentClass, note, items } = req.body;

        // ALLOW EMPTY ITEMS (Decoupled Mode)
        // customerName is optional (Parent name)
        if (!customerPhone || !customerUnit || !studentName) {
            return res.status(400).json({ error: 'Data tidak lengkap' });
        }

        const code = await generateOrderCode();

        let totalAmount = 0;

        // Only process items if they exist (Coupled Mode)
        if (items && items.length > 0) {
            for (const item of items) {
                const warehouseItem = await prisma.warehouseItem.findUnique({ where: { id: parseInt(item.itemId) } });
                if (!warehouseItem) return res.status(400).json({ error: `Item ID ${item.itemId} tidak ditemukan` });

                // Stock check is disabled per previous logic, but price calc remains
                item.price = warehouseItem.purchasePrice || 0;
                totalAmount += item.price * parseInt(item.quantity);
            }
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
                    create: (items || []).map(item => ({
                        itemId: parseInt(item.itemId),
                        quantity: parseInt(item.quantity),
                        price: item.price
                    }))
                }
            },
            include: { items: { include: { item: true } } }
        });

        // Send WhatsApp notifications after delay (30-60 seconds)
        const delayMs = Math.floor(Math.random() * (60000 - 30000 + 1) + 30000);
        console.log(`[WhatsApp] Scheduling notifications with ${delayMs / 1000}s delay...`);

        setTimeout(async () => {
            let sendWhatsAppMessage;
            try {
                const waService = require('../services/whatsappService');
                sendWhatsAppMessage = waService.sendMessage;
            } catch (e) {
                console.error('WA Service not available:', e.message);
                return;
            }

            if (!sendWhatsAppMessage) return;

            try {
                const settings = await prisma.setting.findFirst();

                // Generate Item List String
                let itemListText = '';
                if (order.items && order.items.length > 0) {
                    itemListText = order.items.map((oi, i) =>
                        `- ${oi.item.name} (${oi.item.size || '-'}) x${oi.quantity}`
                    ).join('\n');
                } else if (order.note && order.note.includes('ITEM PESANAN:')) {
                    // Extract from note if decoupled
                    const parts = order.note.split('ITEM PESANAN:');
                    itemListText = parts[1]?.trim() || '_Detail di catatan_';
                }

                // --- WA CONFIRMATION TO CUSTOMER (Pengaju) ---
                if (order.customerPhone) {
                    const customerMsg = `Assalamu'alaikum Warrahmatullahi Wabarakatuh Abu/Ummu *${order.studentName}*\n\n` +
                        `Pesanan seragam atas nama *${order.studentName}* telah kami terima.\n` +
                        `📋 Kode Pesanan: *${order.code}*\n\n` +
                        `*Rincian Pesanan:*\n${itemListText}\n\n` +
                        `InsyaaAllah akan kami hubungi segera.\n` +
                        `Jazaakumullahu khairan.`;

                    await sendWhatsAppMessage(order.customerPhone, customerMsg);
                }

                // --- NOTIFICATION TO JERI SAPUTRA (18121079) ---
                const targetNip = '18121079';
                const targetUser = await prisma.user.findFirst({ where: { nip: targetNip } });

                if (targetUser && targetUser.phone) {
                    const gender = req.body.gender || '-';
                    const specificMsg = `Assalamu'alaikum Warrahmatullahi Wabarakatuh Bapak *${targetUser.name || 'Jeri Saputra'}*,\n\n` +
                        `Telah masuk pesanan baru dengan rincian:\n\n` +
                        `📋 Kode: *${order.code}*\n` +
                        `👨‍🎓 Nama Siswa: *${order.studentName}*\n` +
                        `🚻 Jenis Kelamin: ${gender}\n` +
                        `🏫 Unit: ${order.customerUnit}\n` +
                        `📱 No HP (WA): ${order.customerPhone}\n\n` +
                        `📦 *Pesanan:*\n${itemListText}\n\n` +
                        `📝 Catatan: ${order.note?.split('\n\n')[1]?.replace('ITEM PESANAN:', '')?.trim() || '-'}\n\n` +
                        `Mohon segera diproses. Syukran.`;

                    await sendWhatsAppMessage(targetUser.phone, specificMsg);
                }
            } catch (waError) {
                console.error('WA notification delivery failed:', waError.message);
            }
        }, delayMs);

        res.json({ message: 'Pesanan berhasil dibuat!', order });
    } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
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
    } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
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
    } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const order = await prisma.uniformOrder.update({
            where: { id: parseInt(req.params.id) },
            data: { status }
        });
        res.json({ message: 'Status diperbarui', order });
    } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

const deleteOrder = async (req, res) => {
    try {
        await prisma.uniformOrder.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'Pesanan dihapus' });
    } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
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
