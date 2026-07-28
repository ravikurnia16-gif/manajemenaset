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
    const lastOrder = await prisma.uniformOrder.findFirst({
        where: { code: { startsWith: `ORD/${year}/` } },
        orderBy: { code: 'desc' },
        select: { code: true }
    });

    let nextSequence = 1;
    if (lastOrder) {
        const parts = lastOrder.code.split('/');
        if (parts.length === 3) {
            const lastSeq = parseInt(parts[2]);
            if (!isNaN(lastSeq)) {
                nextSequence = lastSeq + 1;
            }
        }
    }

    return `ORD/${year}/${nextSequence.toString().padStart(3, '0')}`;
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

        // Send WhatsApp notifications via global staggered queue
        (async () => {
            const { sendMessage } = require('../services/whatsappService');
            if (!sendMessage) return;

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

                // 1. Send to Customer
                if (order.customerPhone) {
                    const customerMsg = `Assalamu'alaikum Warahmatullahi Wabarakatuh Abu/Ummu *${order.studentName}*\n\n` +
                        `Pesanan seragam atas nama *${order.studentName}* telah kami terima.\n` +
                        `📋 Kode Pesanan: *${order.code}*\n\n` +
                        `*Rincian Pesanan:*\n${itemListText}\n\n` +
                        `InsyaaAllah pesanan akan segera diproses. Mohon ditunggu, kami akan menginformasikan ketersediaan seragam melalui balasan pesan WhatsApp ini.\n\n` +
                        `Jazaakumullahu khairan.`;

                    await sendMessage(order.customerPhone, customerMsg);
                }

                // 2. Send to Jeri Saputra
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

                    await sendMessage(targetUser.phone, specificMsg);
                }
            } catch (waError) {
                console.error('WA notification delivery failed:', waError.message);
            }
        })();

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

const publicSearchOrder = async (req, res) => {
    try {
        const { name, phone } = req.query;
        if (!name || !phone) return res.status(400).json({ error: 'Nama dan No HP wajib diisi' });

        const orders = await prisma.uniformOrder.findMany({
            where: {
                studentName: { contains: name },
                customerPhone: { contains: phone }
            },
            include: { items: { include: { item: { select: { name: true, size: true, gender: true, type: true } } } } },
            orderBy: { createdAt: 'desc' },
            take: 5
        });

        res.json(orders);
    } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

const getAllOrders = async (req, res) => {
    try {
        const { status, unit, startDate, endDate, search } = req.query;
        const where = {};
        if (status) where.status = status;
        if (unit) where.customerUnit = unit;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate);
        }

        if (search) {
            where.OR = [
                { studentName: { contains: search } },
                { code: { contains: search } },
                { customerPhone: { contains: search } },
                { customerName: { contains: search } }
            ];
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

const updateOrderDetails = async (req, res) => {
    try {
        const { studentName, customerName, customerPhone, customerUnit, note } = req.body;
        const order = await prisma.uniformOrder.update({
            where: { id: parseInt(req.params.id) },
            data: { studentName, customerName, customerPhone, customerUnit, note }
        });
        res.json({ message: 'Detail pesanan diperbarui', order });
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

        const currentItem = await prisma.uniformOrderItem.findUnique({
            where: { id: parseInt(id) },
            include: { order: true, item: true }
        });

        if (!currentItem) return res.status(404).json({ error: 'Item tidak ditemukan' });

        const updatedItem = await prisma.uniformOrderItem.update({
            where: { id: parseInt(id) },
            data: { status, pickupDetails }
        });

        // Stock deduction for single item update bypass WA
        if (currentItem.status !== 'DONE' && status === 'DONE' && currentItem.itemId) {
            const now = new Date();
            const year = now.getFullYear();
            const isUnit = (currentItem.order.note && currentItem.order.note.includes('PESANAN UNIT INTERNAL')) || 
                           (currentItem.order.studentName && currentItem.order.studentName.toUpperCase().includes('PESANAN UNIT'));

            const lastTx = await prisma.warehouseTransaction.findFirst({
                where: { code: { startsWith: `TRX/${year}/` } },
                orderBy: { code: 'desc' }
            });
            
            let nextSequence = 1;
            if (lastTx) {
                const parts = lastTx.code.split('/');
                if (parts.length === 3 && !isNaN(parseInt(parts[2]))) {
                    nextSequence = parseInt(parts[2]) + 1;
                }
            }
            const txCode = `TRX/${year}/${nextSequence.toString().padStart(3, '0')}`;

            await prisma.$transaction(async (tx) => {
                const isSeragam = currentItem.item && currentItem.item.code.startsWith('GD/SRG');
                
                if (!isSeragam) {
                    const transaction = await tx.warehouseTransaction.create({
                        data: {
                            code: txCode, type: 'OUT', date: now,
                            note: `Otomatis dari Pesanan ${isUnit ? 'Unit' : 'Wali Murid'} [${currentItem.order.code}]`,
                            createdById: req.user.id
                        }
                    });

                    await tx.warehouseTransactionItem.create({
                        data: {
                            transactionId: transaction.id,
                            itemId: currentItem.itemId,
                            quantity: currentItem.quantity,
                            recipientName: currentItem.order.customerName || currentItem.order.studentName,
                            recipientUnit: currentItem.order.customerUnit
                        }
                    });

                    await tx.warehouseItem.update({
                        where: { id: currentItem.itemId },
                        data: { stock: { decrement: currentItem.quantity } }
                    });
                }
            });
        }

        res.json(updatedItem);
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

        const { sendMessage } = require('../services/whatsappService');
        let message = '';

        if (type === 'READY') {
            message = `*Bismillah*\n\n` +
                `Kami informasikan kepada Abu/Ummu *${item.order.studentName}* bahwa penjemputan seragam (*${item.itemName || 'Pesanan'}*) dapat dilakukan Pada:\n\n` +
                `Waktu : *${day}*, 07.30 – 16.00 WIB.\n` +
                `Alamat: *Kantor Sarpras, Gunung Juaro, Surau Gadang, Nanggalo, Kota Padang*\n\n` +
                `Demikian pengumuman ini kami sampaikan. Terima kasih.`;
        } else if (type === 'NO_STOCK') {
            message = `*Bismillah*\n\n` +
                `Kami informasikan kepada Abu/Ummu *${item.order.studentName}* bahwa pesanan seragam (*${item.itemName || 'Pesanan'} - Ukuran ${item.size || '-'}*) saat ini sedang *Tidak Tersedia / Kosong*.\n\n` +
                `Syukron Jazakumullah khairan.`;
        } else if (type === 'INDENT') {
            message = `*Bismillah*\n\n` +
                `Kami informasikan kepada Abu/Ummu *${item.order.studentName}* bahwa pesanan seragam (*${item.itemName || 'Pesanan'}*) saat ini kami catat sebagai *Indent (Sedang Dipesankan)*.\n\n` +
                `Kami akan segera menginformasikan kembali jika barang sudah tersedia.\n\n` +
                `Jazakumullahu khairan.`;
        }

        if (message) {
            await sendMessage(item.order.customerPhone, message);
        }

        res.json({ message: 'Notifikasi terkirim' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// --- BULK UPDATE & NOTIFY ---

const bulkUpdateItems = async (req, res) => {
    try {
        const { id } = req.params; // Order ID
        const { updates } = req.body; // Array of { id, status, pickupDetails }

        // Fetch order to get customer details
        const order = await prisma.uniformOrder.findUnique({
            where: { id: parseInt(id) },
            include: { items: true }
        });

        if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan' });

        const isUnitLog = (order.note && order.note.includes('PESANAN UNIT INTERNAL')) || 
                       (order.studentName && order.studentName.toUpperCase().includes('PESANAN UNIT'));
        const now = new Date();
        const year = now.getFullYear();

        // Update items in database
        for (const update of updates) {
            const currentItem = await prisma.uniformOrderItem.findUnique({
                where: { id: parseInt(update.id) },
                include: { item: true }
            });

            const dataToUpdate = {
                status: update.status, 
                pickupDetails: update.pickupDetails || null 
            };

            if (update.size !== undefined) {
                dataToUpdate.size = update.size;

                if (currentItem && currentItem.itemId) {
                    const currentWarehouseItem = await prisma.warehouseItem.findUnique({
                        where: { id: currentItem.itemId }
                    });
                    if (currentWarehouseItem) {
                        const matchingItem = await prisma.warehouseItem.findFirst({
                            where: {
                                name: currentWarehouseItem.name,
                                categoryId: currentWarehouseItem.categoryId,
                                type: currentWarehouseItem.type,
                                gender: currentWarehouseItem.gender,
                                itemUnit: currentWarehouseItem.itemUnit,
                                uniformGroup: currentWarehouseItem.uniformGroup,
                                size: update.size
                            }
                        });
                        if (matchingItem) {
                            dataToUpdate.itemId = matchingItem.id;
                        } else {
                            dataToUpdate.itemId = null;
                        }
                    }
                }
            }

            await prisma.uniformOrderItem.update({
                where: { id: parseInt(update.id) },
                data: dataToUpdate
            });

            const finalItemId = dataToUpdate.itemId !== undefined ? dataToUpdate.itemId : (currentItem ? currentItem.itemId : null);

            // Automatically deduct stock and create transaction if it just became DONE
            if (currentItem && currentItem.status !== 'DONE' && update.status === 'DONE' && finalItemId) {
                // Generate transaction code manually to ensure sequential isolation
                const lastTx = await prisma.warehouseTransaction.findFirst({
                    where: { code: { startsWith: `TRX/${year}/` } },
                    orderBy: { code: 'desc' }
                });
                
                let nextSequence = 1;
                if (lastTx) {
                    const parts = lastTx.code.split('/');
                    if (parts.length === 3 && !isNaN(parseInt(parts[2]))) {
                        nextSequence = parseInt(parts[2]) + 1;
                    }
                }
                const txCode = `TRX/${year}/${nextSequence.toString().padStart(3, '0')}`;

                await prisma.$transaction(async (tx) => {
                    const isSeragam = currentItem.item && currentItem.item.code.startsWith('GD/SRG');
                    
                    if (!isSeragam) {
                        const transaction = await tx.warehouseTransaction.create({
                            data: {
                                code: txCode,
                                type: 'OUT',
                                date: now,
                                note: `Otomatis dari Pesanan ${isUnitLog ? 'Unit' : 'Wali Murid'} [${order.code}]`,
                                createdById: req.user.id
                            }
                        });

                        await tx.warehouseTransactionItem.create({
                            data: {
                                transactionId: transaction.id,
                                itemId: finalItemId,
                                quantity: currentItem.quantity,
                                recipientName: order.customerName || order.studentName,
                                recipientUnit: order.customerUnit
                            }
                        });

                        await tx.warehouseItem.update({
                            where: { id: finalItemId },
                            data: { stock: { decrement: currentItem.quantity } }
                        });
                    }
                });
            }
        }

        // Re-fetch updated items to build WA message
        const updatedItems = await prisma.uniformOrderItem.findMany({
            where: { orderId: parseInt(id) }
        });

        if (order.customerPhone) {
            const { sendMessage } = require('../services/whatsappService');
            let message = '';

            const isUnit = (order.note && order.note.includes('PESANAN UNIT INTERNAL')) || 
                           (order.studentName && order.studentName.toUpperCase().includes('PESANAN UNIT'));

            if (isUnit) {
                // Unit Order Formatting
                const isGenericName = !order.studentName ||
                    order.studentName.toUpperCase().includes('PESANAN UNIT') ||
                    order.studentName.toUpperCase().includes('INTERNAL');

                const subjectLine = isGenericName
                    ? `Berikut adalah rincian status pesanan unit *${order.customerUnit}*:`
                    : `Berikut adalah rincian status pesanan atas nama *${order.studentName}* dari unit *${order.customerUnit}*:`;

                message = `Assalamu'alaikum Warahmatullahi Wabarakatuh\n\n` +
                    `*${order.customerName || 'Ustadz/Ustadzah'}*,\n\n` +
                    `${subjectLine}\n\n`;

                for (const item of updatedItems) {
                    const itemName = item.itemName || 'Item';
                    const qty = item.quantity;
                    const size = item.size ? ` (${item.size})` : '';
                    let statusTxt = item.status === 'DONE' ? 'DISETUJUI & SELESAI (SUDAH DIAMBIL)' : 
                                    item.status === 'READY' ? 'DISETUJUI' :
                                    item.status === 'CANCEL_ITEM' ? 'DITOLAK' : 
                                    item.status === 'PENDING' ? 'MENUNGGU' : item.status;
                    
                    message += `- ${itemName}${size} x${qty} : *${statusTxt}*\n`;
                }

                message += `\nJazaakumullahu khairan.`;

            } else {
                // Warid Formatting
                message = `*Bismillah*\n\n` +
                          `Kami informasikan kepada Abu/Ummu *${order.studentName}*, berikut adalah rincian status pesanan Anda:\n\n`;

                let anyReady = false;
                for (const item of updatedItems) {
                    const itemName = item.itemName || 'Item';
                    const qty = item.quantity;
                    const size = item.size ? ` (${item.size})` : '';
                    let statusTxt = '';
                    
                    if (item.status === 'READY') {
                        statusTxt = `*SEDIA* (${item.pickupDetails || 'Bisa dijemput'})`;
                        anyReady = true;
                    } else if (item.status === 'NO_STOCK') {
                        statusTxt = `*KOSONG*`;
                    } else if (item.status === 'INDENT') {
                        statusTxt = `*INDENT* (Dipesankan)`;
                    } else if (item.status === 'CANCEL_ITEM') {
                        statusTxt = `*DIBATALKAN*`;
                    } else if (item.status === 'DONE') {
                        statusTxt = `*SELESAI*`;
                    } else {
                        statusTxt = `*MENUNGGU*`;
                    }

                    message += `- ${itemName}${size} x${qty} : ${statusTxt}\n`;
                }

                if (anyReady) {
                    message += `\nPelayanan pengambilan seragam buka di Kantor Sarpras (Gunung Juaro, Naggolo, KOTA PADANG) pada jam kerja (07.30 - 16.00 WIB).\n`;
                }
                message += `\nSyukron, Jazakumullah khairan.`;
            }

            if (message) {
                try {
                    await sendMessage(order.customerPhone, message);
                } catch(err) {
                    console.error('[Bulk Update WA] Error:', err.message);
                }
            }
        }

        res.json({ message: 'Update berhasil dan notifikasi terkirim' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// ======================== ROUTES ========================

// Public routes
router.get('/items', getAvailableUniforms);
router.post('/', createOrder);
router.get('/check/:code', checkOrder);
router.get('/search-public', publicSearchOrder);

// Admin routes
router.get('/admin/orders', authMiddleware, getAllOrders);
router.put('/admin/:id', authMiddleware, updateOrderStatus);
router.put('/admin/orders/:id/details', authMiddleware, updateOrderDetails);
router.delete('/admin/:id', authMiddleware, deleteOrder);
router.put('/admin/orders/:id/bulk-items', authMiddleware, bulkUpdateItems);

// New Processing Routes
router.put('/admin/items/:id/status', authMiddleware, updateItemStatus);
router.post('/admin/items/:id/notify', authMiddleware, notifyItemStatus);

module.exports = router;
