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
                // If itemId is provided, look up price in DB
                if (item.itemId) {
                    const warehouseItem = await prisma.warehouseItem.findUnique({ where: { id: parseInt(item.itemId) } });
                    if (warehouseItem) {
                        item.price = warehouseItem.purchasePrice || 0;
                    }
                }

                // If price still not set, use default 0
                const price = item.price || 0;
                totalAmount += price * parseInt(item.quantity || 1);
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
                        itemId: item.itemId ? parseInt(item.itemId) : null,
                        itemName: item.name || null,
                        size: item.size || null,
                        quantity: parseInt(item.quantity || 1),
                        price: item.price || 0
                    }))
                }
            },
            include: { items: { include: { item: true } } }
        });

        // Send WhatsApp notifications with 1-minute interval
        setTimeout(async () => {
            const waService = require('../services/whatsappService');
            const sendWhatsAppMessage = waService.sendMessage;
            if (!sendWhatsAppMessage) return;

            try {
                // Generate Item List String
                let itemListText = '';
                if (order.items && order.items.length > 0) {
                    itemListText = order.items.map((oi, i) =>
                        `- ${oi.itemName || oi.item?.name || 'Item'} (${oi.size || oi.item?.size || '-'}) x${oi.quantity}`
                    ).join('\n');
                } else if (order.note && order.note.includes('ITEM PESANAN:')) {
                    const parts = order.note.split('ITEM PESANAN:');
                    itemListText = parts[1]?.trim() || '_Detail di catatan_';
                }

                // 1. Send to Customer first
                if (order.customerPhone) {
                    const customerMsg = `Assalamu'alaikum Warahmatullahi Wabarakatuh Abu/Ummu *${order.studentName}*\n\n` +
                        `Pesanan seragam atas nama *${order.studentName}* telah kami terima.\n` +
                        `📋 Kode Pesanan: *${order.code}*\n\n` +
                        `*Rincian Pesanan:*\n${itemListText}\n\n` +
                        `InsyaaAllah akan segera diproses.\n` +
                        `Jazaakumullahu khairan.`;

                    await sendWhatsAppMessage(order.customerPhone, customerMsg);
                    console.log(`[WhatsApp] Sent to customer. Waiting 60s for next message...`);
                }

                // 2. Wait 60 seconds before sending to Jeri Saputra
                setTimeout(async () => {
                    try {
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
                            console.log(`[WhatsApp] Sent to Jeri Saputra.`);
                        }
                    } catch (err) {
                        console.error('WA delivery to Jeri failed:', err.message);
                    }
                }, 60000); // 1 minute interval

            } catch (waError) {
                console.error('WA notification delivery failed:', waError.message);
            }
        }, 5000); // 5s initial delay before starting the flow

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

// --- ADMIN: UPDATE ITEM STATUS & NOTIFY ---

const updateItemStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, pickupDetails } = req.body;

        const item = await prisma.uniformOrderItem.update({
            where: { id: parseInt(id) },
            data: { status, pickupDetails },
            include: { order: true }
        });

        res.json(item);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const notifyItemStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { type, day } = req.body; // type: 'READY' or 'NO_STOCK'

        const item = await prisma.uniformOrderItem.findUnique({
            where: { id: parseInt(id) },
            include: { order: true }
        });

        if (!item || !item.order.customerPhone) return res.status(404).json({ error: 'Data tidak lengkap' });

        const waService = require('../services/whatsappService');
        let message = '';

        if (type === 'READY') {
            message = `*(SARPRAS DEI)*\n\n` +
                `Kami informasikan kepada Abu/Ummu *${item.order.studentName}* bahwa penjemputan seragam (*${item.itemName || 'Pesanan'}*) dapat dilakukan Pada:\n\n` +
                `Waktu : *${day}*, 07.30 – 16.00 WIB.\n` +
                `Alamat: *Kantor Sarpras, Gunung Juaro, Surau Gadang, Nanggalo, Kota Padang*\n\n` +
                `Demikian pengumuman ini kami sampaikan. Terima kasih.`;
        } else if (type === 'NO_STOCK') {
            message = `*(SARPRAS DEI)*\n\n` +
                `Kami informasikan kepada Abu/Ummu *${item.order.studentName}* bahwa pesanan seragam (*${item.itemName || 'Pesanan'} - Ukuran ${item.size || '-'}*) saat ini sedang *Tidak Tersedia / Kosong*.\n\n` +
                `Syukron Jazakumullah khairan.`;
        } else if (type === 'INDENT') {
            message = `*(SARPRAS DEI)*\n\n` +
                `Kami informasikan kepada Abu/Ummu *${item.order.studentName}* bahwa pesanan seragam (*${item.itemName || 'Pesanan'}*) saat ini kami catat sebagai *Indent (Sedang Dipesankan)*.\n\n` +
                `Kami akan segera menginformasikan kembali jika barang sudah tersedia.\n\n` +
                `Terima kasih.`;
        }

        if (message) {
            await waService.sendMessage(item.order.customerPhone, message);
        }

        res.json({ message: 'Notifikasi terkirim' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
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

// New Processing Routes
router.put('/admin/items/:id/status', authMiddleware, updateItemStatus);
router.post('/admin/items/:id/notify', authMiddleware, notifyItemStatus);

module.exports = router;
