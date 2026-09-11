const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { uploadFile, deleteFile } = require('../services/minioService');
const whatsappService = require('../services/whatsappService');
const { createNotification } = require('./notificationController');

// Helper to generate Request Code
const generateCode = async (type) => {
    const year = new Date().getFullYear();
    const typeCode = type === 'KAYU' ? 'KY' : (type === 'BESI' ? 'BS' : 'UM');

    const lastRecord = await prisma.workshopOrder.findFirst({
        where: {
            code: {
                startsWith: `WS/${typeCode}/${year}/`
            }
        },
        orderBy: {
            code: 'desc'
        }
    });

    let nextSequence = 1;
    if (lastRecord) {
        const parts = lastRecord.code.split('/');
        if (parts.length === 4) {
            const lastSeq = parseInt(parts[3]);
            if (!isNaN(lastSeq)) {
                nextSequence = lastSeq + 1;
            }
        }
    }

    const sequence = nextSequence.toString().padStart(3, '0');
    return `WS/${typeCode}/${year}/${sequence}`;
};

// Generate Surat Pesanan E-Office
const generateSuratPesanan = async (order, user) => {
    // Cari data user lengkap untuk tanda tangan nanti (walaupun di draft, authornya jelas)
    const author = await prisma.user.findUnique({ where: { id: user.id } });

    const contentData = {
        orderCode: order.code,
        destination: "Workshop",
        workshopType: order.workshopType,
        title: order.title,
        priority: order.priority,
        deadline: order.deadline ? new Date(order.deadline).toISOString().split('T')[0] : '-',
        estimatedCost: order.estimatedCost,
        items: order.items.map(item => ({
            name: item.name,
            spec: item.spec,
            qty: item.qty,
            unit: item.unit
        })),
        notes: order.notes,
        orderStatus: order.status
    };

    const newDoc = await prisma.officeDocument.create({
        data: {
            type: 'SURAT_PESANAN',
            subject: `Surat Pesanan Workshop - ${order.title}`,
            category: 'Pesanan',
            content: JSON.stringify(contentData),
            authorId: user.id,
            status: 'PENDING_APPROVAL', // Langsung diarahkan ke Kabid untuk TTE
            priority: order.priority === 'URGENT' ? 'SANGAT_SEGERA' : (order.priority === 'HIGH' ? 'SEGERA' : 'BIASA'),
            party2Name: 'Workshop'
        }
    });

    // Update order dengan link surat
    await prisma.workshopOrder.update({
        where: { id: order.id },
        data: { officeDocumentId: newDoc.id }
    });

    return newDoc;
};

// --- CONTROLLER FUNCTIONS ---

// 1. Dashboard Stats
exports.getDashboardStats = async (req, res) => {
    const user = req.user;
    try {
        const isFullWorkshopAdmin = ['SUPER_ADMIN', 'ADMIN_ASET'].includes(user.role) || user.unitId === 21;
        const isWorkshopAdmin = isFullWorkshopAdmin || (user.unit?.name || '').toLowerCase().includes('workshop');
        
        let whereClause = {};
        if (!isWorkshopAdmin) {
            if (user.unitId) {
                whereClause = { unitId: user.unitId };
            } else {
                whereClause = { requestedById: user.id };
            }
        } else if (!isFullWorkshopAdmin) {
             // Jika hanya admin unit workshop biasa, dia cuma bisa lihat orderan ke unitnya
             whereClause = { workshopUnitId: user.unitId };
        }

        const totalOrders = await prisma.workshopOrder.count({ where: whereClause });
        const inProgress = await prisma.workshopOrder.count({ where: { ...whereClause, status: 'IN_PROGRESS' } });
        const completed = await prisma.workshopOrder.count({ where: { ...whereClause, status: 'COMPLETED' } });
        
        const kayuStats = await prisma.workshopOrder.count({ where: { ...whereClause, workshopType: 'KAYU' } });
        const besiStats = await prisma.workshopOrder.count({ where: { ...whereClause, workshopType: 'BESI' } });

        const recentOrders = await prisma.workshopOrder.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: { requestedBy: { select: { name: true } }, unit: { select: { name: true } } }
        });

        res.json({
            totalOrders,
            inProgress,
            completed,
            byType: { KAYU: kayuStats, BESI: besiStats },
            recentOrders
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 2. Get All Orders
exports.getAllOrders = async (req, res) => {
    const user = req.user;
    const { type, status, priority } = req.query;

    try {
        const isFullWorkshopAdmin = ['SUPER_ADMIN', 'ADMIN_ASET'].includes(user.role) || user.unitId === 21;
        const isWorkshopAdmin = isFullWorkshopAdmin || (user.unit?.name || '').toLowerCase().includes('workshop');
        
        let whereClause = {};
        if (type) whereClause.workshopType = type;
        if (status) whereClause.status = status;
        if (priority) whereClause.priority = priority;

        if (!isWorkshopAdmin) {
            // Jika user memilih filter myUnitOnly atau default untuk non-admin
            if (user.unitId) {
                whereClause.unitId = user.unitId;
            } else {
                whereClause.requestedById = user.id;
            }
        } else if (!isFullWorkshopAdmin) {
             whereClause.workshopUnitId = user.unitId;
        }

        const orders = await prisma.workshopOrder.findMany({
            where: whereClause,
            include: {
                requestedBy: { select: { name: true, username: true } },
                unit: { select: { name: true } },
                workshopUnit: { select: { name: true } },
                _count: { select: { items: true } },
                progress: {
                    select: { percentage: true, createdAt: true, message: true },
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const formattedOrders = orders.map(order => {
            const latest = order.progress && order.progress.length > 0 ? order.progress[0] : null;
            let currentPercentage = 0;
            if (latest && typeof latest.percentage === 'number') {
                currentPercentage = latest.percentage;
            } else if (order.status === 'COMPLETED') {
                currentPercentage = 100;
            } else if (order.status === 'QUALITY_CHECK') {
                currentPercentage = 90;
            } else if (order.status === 'IN_PROGRESS') {
                currentPercentage = 25;
            }

            return {
                ...order,
                currentPercentage
            };
        });

        res.json(formattedOrders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 3. Get Order by ID
exports.getOrderById = async (req, res) => {
    const { id } = req.params;
    try {
        const parsedId = parseInt(id, 10);
        const whereClause = !isNaN(parsedId)
            ? {
                OR: [
                    { id: parsedId },
                    { code: id }
                ]
            }
            : { code: id };

        const order = await prisma.workshopOrder.findFirst({
            where: whereClause,
            include: {
                items: true,
                progress: {
                    include: { user: { select: { id: true, name: true, username: true } } },
                    orderBy: { createdAt: 'desc' }
                },
                requestedBy: { select: { id: true, name: true, username: true, phone: true } },
                unit: { select: { id: true, name: true } },
                workshopUnit: { select: { id: true, name: true } },
                procurement: { select: { id: true, code: true, title: true } },
                officeDocument: { select: { id: true, number: true, status: true, uuid: true } }
            }
        });

        if (!order) return res.status(404).json({ error: 'Order not found' });

        const latest = order.progress && order.progress.length > 0 ? order.progress[0] : null;
        let currentPercentage = 0;
        if (latest && typeof latest.percentage === 'number') {
            currentPercentage = latest.percentage;
        } else if (order.status === 'COMPLETED') {
            currentPercentage = 100;
        } else if (order.status === 'QUALITY_CHECK') {
            currentPercentage = 90;
        } else if (order.status === 'IN_PROGRESS') {
            currentPercentage = 25;
        }

        res.json({ ...order, currentPercentage });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 4. Create Order
exports.createOrder = async (req, res) => {
    const { title, priority, deadline, notes, items, workshopUnitId, picName, workshopType, unitId, maintenanceId } = req.body;
    const user = req.user;

    try {
        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'Minimal harus ada 1 item pesanan.' });
        }

        const code = await generateCode(workshopType || null);
        
        let estimatedCost = 0;
        const itemData = items.map(it => {
            const price = parseFloat(it.estimatedPrice || 0);
            estimatedCost += price * parseInt(it.qty || 1);
            
            return {
                name: it.name,
                spec: it.spec,
                qty: parseInt(it.qty || 1),
                unit: it.unit || 'Unit',
                estimatedPrice: price
            };
        });

        const newOrder = await prisma.workshopOrder.create({
            data: {
                code,
                title,
                priority: priority || 'NORMAL',
                deadline: deadline ? new Date(deadline) : null,
                notes,
                picName,
                workshopType: workshopType || null,
                estimatedCost,
                status: 'PENDING',
                requestedById: user.id,
                unitId: unitId ? parseInt(unitId) : user.unitId,
                workshopUnitId: workshopUnitId ? parseInt(workshopUnitId) : null,
                maintenanceId: maintenanceId ? parseInt(maintenanceId) : null,
                items: {
                    create: itemData
                },
                progress: {
                    create: {
                        message: 'Pesanan workshop dibuat dan masuk ke antrean.',
                        percentage: 0,
                        createdById: user.id
                    }
                }
            },
            include: {
                items: true,
                requestedBy: true,
                unit: true
            }
        });

        try {
            await generateSuratPesanan(newOrder, user);
        } catch (eDocErr) {
            console.error('Failed to generate automatic Surat Pesanan:', eDocErr);
        }

        const recipients = await prisma.user.findMany({
            where: {
                OR: [
                    { unitId: 21 },
                    { role: { in: ['SUPER_ADMIN', 'ADMIN_ASET', 'KABID_SARPRAS'] } }
                ],
                phone: { not: null }
            },
            select: { phone: true, name: true }
        });

        if (recipients.length > 0) {
            const appUrl = process.env.CLIENT_URL || 'http://localhost:5173';
            const itemDetails = newOrder.items.map((it, idx) => `${idx + 1}. ${it.name} (${it.qty} ${it.unit})`).join('\n');
            const msg = `*Pesanan Baru Masuk ke Workshop*\n\n` +
                `Kode: *${newOrder.code}*\n` +
                `Judul: *${newOrder.title}*\n` +
                `Tipe: *${newOrder.workshopType || 'Umum'}*\n` +
                `Pemohon: *${user.name}* (${newOrder.unit?.name || '-'})\n` +
                `Target Selesai: *${newOrder.deadline ? new Date(newOrder.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}*\n\n` +
                `*Rincian Item*:\n${itemDetails}\n\n` +
                `🔗 Detail Pesanan:\n${appUrl}/workshop/orders/${newOrder.id}\n\n` +
                `Mohon dicek di sistem.`;

            recipients.forEach(recipient => {
                setTimeout(() => {
                    whatsappService.sendMessage(recipient.phone, msg).catch(console.error);
                }, 5000);
            });
        }

        res.json({ message: 'Order created successfully', data: newOrder });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 5. Update Status
exports.updateOrderStatus = async (req, res) => {
    const { id } = req.params;
    const { status, message, photoBase64, percentage } = req.body;
    const user = req.user;

    try {
        const order = await prisma.workshopOrder.findUnique({
            where: { id: parseInt(id) },
            include: {
                requestedBy: true,
                progress: { orderBy: { createdAt: 'desc' }, take: 1 }
            }
        });
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const updateData = { status };
        let progressMsg = `Status diperbarui menjadi: ${status}`;
        
        let parsedPercent = undefined;
        if (percentage !== undefined && percentage !== null && percentage !== '') {
            parsedPercent = Math.min(100, Math.max(0, parseInt(percentage, 10)));
            if (isNaN(parsedPercent)) parsedPercent = 0;
        } else {
            if (status === 'COMPLETED') {
                parsedPercent = 100;
            } else if (status === 'QUALITY_CHECK') {
                parsedPercent = 90;
            } else if (status === 'PENDING') {
                parsedPercent = 0;
            } else if (status === 'IN_PROGRESS') {
                const prev = order.progress?.[0]?.percentage;
                parsedPercent = typeof prev === 'number' && prev > 0 ? prev : 25;
            }
        }

        if (status === 'IN_PROGRESS' && order.status === 'PENDING') {
            updateData.startDate = new Date();
            progressMsg = `Pekerjaan dimulai (Progres: ${parsedPercent ?? 25}%).`;
        } else if (status === 'COMPLETED') {
            updateData.completionDate = new Date();
            progressMsg = 'Pekerjaan selesai 100%.';
            
            if (order.officeDocumentId) {
                const doc = await prisma.officeDocument.findUnique({ where: { id: order.officeDocumentId } });
                if (doc) {
                    try {
                        const content = JSON.parse(doc.content || '{}');
                        content.orderStatus = 'COMPLETED';
                        await prisma.officeDocument.update({
                            where: { id: doc.id },
                            data: { content: JSON.stringify(content) }
                        });
                    } catch(e) {}
                }
            }
        } else if (message) {
            progressMsg = message;
        }

        let photoUrl = null;
        if (photoBase64 && photoBase64.startsWith('data:')) {
            const matches = photoBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                const type = matches[1];
                const buffer = Buffer.from(matches[2], 'base64');
                const extension = type.split('/')[1] || 'jpg';
                photoUrl = await uploadFile(buffer, `ws_progress_${Date.now()}.${extension}`, type, 'workshop');
            }
        }

        const updatedOrder = await prisma.$transaction(async (prisma) => {
            const updated = await prisma.workshopOrder.update({
                where: { id: parseInt(id) },
                data: updateData
            });

            await prisma.workshopProgress.create({
                data: {
                    orderId: parseInt(id),
                    message: progressMsg,
                    percentage: parsedPercent !== undefined ? parsedPercent : 0,
                    photo: photoUrl,
                    createdById: user.id
                }
            });

            if (order.procurementId) {
                const percentText = parsedPercent !== undefined ? ` (${parsedPercent}%)` : '';
                await prisma.procurementProgress.create({
                    data: {
                        procurementId: order.procurementId,
                        message: `[Workshop Update] ${progressMsg}${percentText}`,
                        type: 'SYSTEM'
                    }
                });
            }

            return updated;
        });

        if (order.requestedBy?.phone) {
            const percentWa = parsedPercent !== undefined ? `\nProgres Pengerjaan: *${parsedPercent}%*` : '';
            const waMsg = `Bismillah.\n*Update Order Workshop*\n\n` +
                `Order Anda: *${order.title}*\n` +
                `Status saat ini: *${status}*${percentWa}\n\n` +
                (message ? `Catatan: ${message}` : `Silakan cek di sistem.`);
                
            setTimeout(() => {
                whatsappService.sendMessage(order.requestedBy.phone, waMsg).catch(console.error);
            }, 3000);
        }

        res.json({ ...updatedOrder, currentPercentage: parsedPercent ?? 0 });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 6. Add Progress
exports.addProgress = async (req, res) => {
    const { id } = req.params;
    const { message, percentage, photoBase64 } = req.body;
    const user = req.user;

    try {
        let photoUrl = null;
        if (photoBase64 && photoBase64.startsWith('data:')) {
            const matches = photoBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                const type = matches[1];
                const buffer = Buffer.from(matches[2], 'base64');
                const extension = type.split('/')[1] || 'jpg';
                photoUrl = await uploadFile(buffer, `ws_progress_${Date.now()}.${extension}`, type, 'workshop');
            }
        }

        const parsedPercent = percentage !== undefined && percentage !== null && percentage !== ''
            ? Math.min(100, Math.max(0, parseInt(percentage, 10)))
            : 0;

        const finalMsg = message || `Update progres fisik pengerjaan: ${parsedPercent}%`;

        const progress = await prisma.workshopProgress.create({
            data: {
                orderId: parseInt(id),
                message: finalMsg,
                percentage: parsedPercent,
                photo: photoUrl,
                createdById: user.id
            }
        });

        const order = await prisma.workshopOrder.findUnique({ where: { id: parseInt(id) } });
        if (order && order.status === 'PENDING' && parsedPercent > 0) {
            await prisma.workshopOrder.update({
                where: { id: parseInt(id) },
                data: { status: 'IN_PROGRESS', startDate: new Date() }
            });
        }

        if (order && order.procurementId) {
            await prisma.procurementProgress.create({
                data: {
                    procurementId: order.procurementId,
                    message: `[Workshop Progress] ${message} (${percentage || 0}%)`,
                    type: 'SYSTEM'
                }
            });
        }

        res.json(progress);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 7. Create from Procurement
exports.createFromProcurement = async (req, res) => {
    const { procurementId, workshopType, priority, deadline, notes, itemsIds } = req.body;
    const user = req.user;

    try {
        const procurement = await prisma.procurement.findUnique({
            where: { id: parseInt(procurementId) },
            include: { items: true }
        });

        if (!procurement) return res.status(404).json({ error: 'Procurement not found' });
        if (procurement.status !== 'APPROVED' && procurement.status !== 'COMPLETED') {
             return res.status(400).json({ error: 'Procurement belum di-approve.' });
        }

        // Filter items
        const selectedItems = itemsIds 
            ? procurement.items.filter(it => itemsIds.includes(it.id))
            : procurement.items;

        if (selectedItems.length === 0) return res.status(400).json({ error: 'Tidak ada item yang dipilih' });

        const code = await generateCode(null);
        
        const itemData = selectedItems.map(it => ({
            name: it.name,
            spec: it.spec,
            qty: it.qty,
            unit: it.unit,
            estimatedPrice: it.estPrice || 0, // Using est price from procurement
        }));

        let estimatedCost = itemData.reduce((acc, curr) => acc + (curr.estimatedPrice * curr.qty), 0);

        const newOrder = await prisma.workshopOrder.create({
            data: {
                code,
                title: `[PROC] ${procurement.title || procurement.code}`,
                priority: priority || 'NORMAL',
                deadline: deadline ? new Date(deadline) : null,
                notes,
                requestedById: procurement.userId,
                unitId: procurement.unitId,
                procurementId: procurement.id,
                estimatedCost,
                status: 'PENDING',
                items: {
                    create: itemData
                }
            },
            include: {
                items: true,
                requestedBy: true
            }
        });

        // Notify Sarpras Unit (Hardcoded to unitId 21 as requested)
        const recipients = await prisma.user.findMany({
            where: {
                position: { in: ['Sarpras Unit', 'Kepala Unit'] },
                unitId: 21,
                phone: { not: null, not: '' }
            }
        });

        if (recipients.length > 0) {
            let unitName = '-';
            if (newOrder.unitId) {
                const ut = await prisma.unit.findUnique({ where: { id: newOrder.unitId } });
                if (ut) unitName = ut.name;
            }

            const senderName = newOrder.requestedBy ? (newOrder.requestedBy.name || newOrder.requestedBy.username) : 'Pemohon';

            let itemDetails = '';
            if (newOrder.items && newOrder.items.length > 0) {
                itemDetails = newOrder.items.map(it => `- ${it.name} (${it.qty} ${it.unit})`).join('\n');
            }

            const appUrl = process.env.VITE_API_URL ? process.env.VITE_API_URL.replace('/api', '') : 'https://sarpras.dareliman.or.id';

            const msg = `Bismillah.\n*Request Workshop Baru* \u{1F6E0}\n\n` +
                `Kode: *${newOrder.code}*\n` +
                `Dari: *${senderName}* (${unitName})\n` +
                `Order: *${newOrder.title}*\n` +
                `Prioritas: *${newOrder.priority}*\n` +
                `Target Selesai: *${newOrder.deadline ? new Date(newOrder.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}*\n\n` +
                `*Rincian Item*:\n${itemDetails}\n\n` +
                `🔗 Detail Pesanan:\n${appUrl}/workshop/orders/${newOrder.id}\n\n` +
                `Mohon dicek di sistem.`;

            recipients.forEach(recipient => {
                setTimeout(() => {
                    whatsappService.sendMessage(recipient.phone, msg).catch(console.error);
                }, 5000);
            });
        }

        res.json({ message: 'Order created from procurement', data: newOrder });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 8. Update Order Details (WorkshopType & Estimated Prices)
exports.updateOrderDetails = async (req, res) => {
    const { id } = req.params;
    const { workshopType, items, deadline } = req.body;

    try {
        const order = await prisma.workshopOrder.findUnique({ 
            where: { id: parseInt(id) },
            include: { requestedBy: true, unit: true, items: true }
        });
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const typeChanged = workshopType && workshopType !== order.workshopType;

        await prisma.$transaction(async (prisma) => {
            let totalEstimatedCost = order.estimatedCost;

            if (workshopType) {
                // Ambil setting global untuk cari tahu nama PIC default tipe tersebut
                const settings = await prisma.setting.findUnique({ where: { id: 1 } });
                const picName = workshopType === 'KAYU' ? settings?.workshopPicKayu : settings?.workshopPicBesi;

                await prisma.workshopOrder.update({
                    where: { id: parseInt(id) },
                    data: { workshopType, picName }
                });
            }

            if (deadline !== undefined) {
                await prisma.workshopOrder.update({
                    where: { id: parseInt(id) },
                    data: { deadline: deadline ? new Date(deadline) : null }
                });
            }

            if (items && Array.isArray(items)) {
                totalEstimatedCost = 0;
                for (const item of items) {
                    await prisma.workshopOrderItem.update({
                        where: { id: item.id },
                        data: { estimatedPrice: parseFloat(item.estimatedPrice) }
                    });
                }
                
                // Recalculate total
                const dbItems = await prisma.workshopOrderItem.findMany({ where: { orderId: parseInt(id) } });
                totalEstimatedCost = dbItems.reduce((acc, it) => acc + (it.estimatedPrice * it.qty), 0);

                await prisma.workshopOrder.update({
                    where: { id: parseInt(id) },
                    data: { estimatedCost: totalEstimatedCost }
                });
            }
        });

        // Kirim Notifikasi WA ke PIC yang terpilih
        if (typeChanged && workshopType) {
            const settings = await prisma.setting.findUnique({ where: { id: 1 } });
            const picName = workshopType === 'KAYU' ? settings?.workshopPicKayu : settings?.workshopPicBesi;

            if (picName) {
                // Cari User berdasarkan nama di database untuk mendapatkan nomor HP-nya
                const picUser = await prisma.user.findFirst({
                    where: { name: picName, phone: { not: null, not: '' } }
                });

                if (picUser) {
                    const senderName = order.requestedBy ? (order.requestedBy.name || order.requestedBy.username) : 'Pemohon';
                    const unitName = order.unit ? order.unit.name : '-';
                    const appUrl = process.env.VITE_API_URL ? process.env.VITE_API_URL.replace('/api', '') : 'https://sarpras.dareliman.or.id';
                    
                    let itemDetails = '';
                    if (order.items && order.items.length > 0) {
                        itemDetails = order.items.map(it => `- ${it.name} (${it.qty} ${it.unit})`).join('\n');
                    }

                    const msg = `Bismillah.\n*Pemesanan Workshop Baru* \u{1F6E0}\n\n` +
                        `Halo *${picUser.name}*,\n` +
                        `Anda diminta sebagai PIC untuk pesanan workshop berikut:\n\n` +
                        `Kode: *${order.code}*\n` +
                        `Tipe: *Workshop ${workshopType}*\n` +
                        `Dari: *${senderName}* (${unitName})\n` +
                        `Order: *${order.title}*\n` +
                        `Prioritas: *${order.priority}*\n` +
                        `Target Selesai: *${deadline ? new Date(deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : (order.deadline ? new Date(order.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-')}*\n\n` +
                        `*Rincian Item*:\n${itemDetails}\n\n` +
                        `🔗 Detail Pesanan:\n${appUrl}/workshop/orders/${order.id}\n\n` +
                        `Mohon segera diproses. Syukron.`;

                    // Kirim pesan WhatsApp
                    whatsappService.sendMessage(picUser.phone, msg).catch(console.error);
                }
            }
        }

        res.json({ message: 'Order details updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Helper to get or auto-create internal Workshop Vendor in Vendor master
const getOrCreateWorkshopVendor = async () => {
    let vendor = await prisma.vendor.findFirst({
        where: {
            OR: [
                { name: { contains: 'Workshop' } },
                { category: 'Workshop & Fabrikasi' },
                { category: 'Workshop' }
            ]
        }
    });

    if (!vendor) {
        vendor = await prisma.vendor.create({
            data: {
                name: 'Workshop Unit 21 (Fabrikasi Sarana)',
                category: 'Workshop & Fabrikasi',
                phone: '08116600021',
                email: 'workshop@dareliman.or.id',
                address: 'Jl. Gunuang Juaro, Surau Gadang, Nanggalo, Padang (Unit Workshop 21)',
                description: 'Unit Pelaksana Teknis Fabrikasi Mebel, Perkayuan, Pengelasan Besi, dan Konstruksi Internal Yayasan Dar El-Iman Padang.',
                isVerified: true
            }
        });
    }

    return vendor;
};

// GET /api/workshop/catalog
exports.getWorkshopCatalog = async (req, res) => {
    try {
        const vendor = await getOrCreateWorkshopVendor();
        const products = await prisma.vendorProduct.findMany({
            where: { vendorId: vendor.id },
            include: {
                priceHistory: {
                    orderBy: { date: 'desc' }
                },
                vendor: {
                    select: { id: true, name: true, category: true, isVerified: true }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        res.json({
            vendor,
            products
        });
    } catch (error) {
        console.error('Get Workshop Catalog Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// POST /api/workshop/catalog
exports.addWorkshopProduct = async (req, res) => {
    try {
        const { name, price, specification, unit } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Nama produk wajib diisi' });
        }

        const vendor = await getOrCreateWorkshopVendor();
        const numPrice = price ? parseFloat(price) : 0;
        
        let specString = specification || '';
        if (unit && !specString.includes(`Satuan:`)) {
            specString = `[Satuan: ${unit}] ${specString}`.trim();
        }

        const product = await prisma.vendorProduct.create({
            data: {
                vendorId: vendor.id,
                name: name.trim(),
                price: numPrice,
                specification: specString,
                image: req.fileUrl || req.body.image || null
            }
        });

        if (numPrice > 0) {
            await prisma.vendorPriceHistory.create({
                data: {
                    productId: product.id,
                    price: numPrice
                }
            });
        }

        res.json(product);
    } catch (error) {
        console.error('Add Workshop Product Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// PUT /api/workshop/catalog/:id
exports.updateWorkshopProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, specification, unit, image } = req.body;
        const productId = parseInt(id);

        const oldProduct = await prisma.vendorProduct.findUnique({
            where: { id: productId }
        });
        if (!oldProduct) return res.status(404).json({ error: 'Produk tidak ditemukan' });

        const numPrice = price !== undefined && price !== '' ? parseFloat(price) : oldProduct.price;
        const priceChanged = numPrice !== oldProduct.price;

        let specString = specification !== undefined ? specification : oldProduct.specification;
        if (unit && specString && !specString.includes(`Satuan:`)) {
            specString = `[Satuan: ${unit}] ${specString}`.trim();
        }

        const updatedProduct = await prisma.vendorProduct.update({
            where: { id: productId },
            data: {
                name: name ? name.trim() : oldProduct.name,
                price: numPrice,
                specification: specString,
                image: req.fileUrl || (image !== undefined ? image : oldProduct.image)
            }
        });

        if (priceChanged && numPrice > 0) {
            await prisma.vendorPriceHistory.create({
                data: {
                    productId: productId,
                    price: numPrice
                }
            });
        }

        res.json(updatedProduct);
    } catch (error) {
        console.error('Update Workshop Product Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// DELETE /api/workshop/catalog/:id
exports.deleteWorkshopProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const productId = parseInt(id);

        const oldProduct = await prisma.vendorProduct.findUnique({ where: { id: productId } });
        if (oldProduct?.image) {
            deleteFile(oldProduct.image).catch(() => {});
        }

        await prisma.vendorProduct.delete({ where: { id: productId } });
        res.json({ message: 'Produk berhasil dihapus' });
    } catch (error) {
        console.error('Delete Workshop Product Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// GET /api/workshop/settings-unit
exports.getWorkshopSettingsAndUnit = async (req, res) => {
    try {
        const [settings, unit21, unit21Users] = await Promise.all([
            prisma.setting.findUnique({ where: { id: 1 } }),
            prisma.unit.findFirst({
                where: {
                    OR: [
                        { id: 21 },
                        { name: { contains: 'Workshop' } }
                    ]
                }
            }),
            prisma.user.findMany({
                where: {
                    OR: [
                        { unitId: 21 },
                        { unit: { name: { contains: 'Workshop' } } },
                        { position: { contains: 'Workshop' } }
                    ]
                },
                select: {
                    id: true,
                    name: true,
                    username: true,
                    nip: true,
                    phone: true,
                    position: true,
                    role: true,
                    unitId: true,
                    unit: { select: { id: true, name: true } }
                }
            })
        ]);

        // Cari Kepala Unit jika data di tabel unit belum lengkap
        let headUser = null;
        if (unit21?.headName) {
            headUser = unit21Users.find(u => u.name && u.name.trim().toLowerCase() === unit21.headName.trim().toLowerCase());
        }
        if (!headUser && unit21?.headNip && unit21.headNip !== '-') {
            headUser = unit21Users.find(u => 
                (u.nip && u.nip.trim() === unit21.headNip.trim()) ||
                (u.username && u.username.trim() === unit21.headNip.trim())
            );
        }
        if (!headUser && unit21Users.length > 0) {
            headUser = unit21Users.find(u => (u.position || '').toLowerCase().includes('kepala unit')) ||
                       unit21Users.find(u => (u.position || '').toLowerCase().includes('kepala')) ||
                       unit21Users.find(u => (u.position || '').toLowerCase().includes('sarpras unit')) ||
                       unit21Users.find(u => u.role === 'ADMIN_UNIT') ||
                       unit21Users[0] || null;
        }

        const headName = unit21?.headName || headUser?.name || '';
        const headNip = (unit21?.headNip && unit21.headNip !== '-' && unit21.headNip.trim() !== '') 
            ? unit21.headNip 
            : (headUser?.nip || headUser?.username || '');
        const phone = (unit21?.phone && unit21.phone !== '-' && unit21.phone.trim() !== '')
            ? unit21.phone 
            : (headUser?.phone || '');

        res.json({
            settings: settings || {},
            unit21: {
                ...(unit21 || {}),
                headName,
                headNip,
                phone
            },
            unit21Users: unit21Users || []
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// PUT /api/workshop/settings-unit
exports.updateWorkshopSettingsAndUnit = async (req, res) => {
    try {
        const { workshopPicKayu, workshopPicBesi, headName, headNip, phone, description } = req.body;

        const targetUnit = await prisma.unit.findFirst({
            where: {
                OR: [
                    { id: 21 },
                    { name: { contains: 'Workshop' } }
                ]
            }
        });

        const targetUnitId = targetUnit ? targetUnit.id : 21;

        const [settings, unit21] = await Promise.all([
            prisma.setting.upsert({
                where: { id: 1 },
                update: { workshopPicKayu, workshopPicBesi },
                create: { id: 1, workshopPicKayu, workshopPicBesi }
            }),
            prisma.unit.upsert({
                where: { id: targetUnitId },
                update: {
                    headName: headName !== undefined ? headName : undefined,
                    headNip: headNip !== undefined ? headNip : undefined,
                    phone: phone !== undefined ? phone : undefined,
                    description: description !== undefined ? description : undefined
                },
                create: {
                    id: targetUnitId,
                    name: 'Workshop',
                    headName: headName || 'Kepala Unit Workshop',
                    headNip: headNip || '',
                    phone: phone || '',
                    description: description || ''
                }
            }).catch(e => {
                console.warn('Unit 21 upsert warning:', e.message);
                return null;
            })
        ]);

        res.json({ settings, unit21, message: 'Pengaturan dan Aturan Kepala Unit berhasil diperbarui' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


