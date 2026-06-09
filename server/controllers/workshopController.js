const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { uploadFile } = require('../services/minioService');
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
        destination: "Workshop di Tempat",
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
                _count: { select: { items: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 3. Get Order by ID
exports.getOrderById = async (req, res) => {
    const { id } = req.params;
    try {
        const order = await prisma.workshopOrder.findUnique({
            where: { id: parseInt(id) },
            include: {
                items: true,
                progress: {
                    include: { user: { select: { id: true, name: true, username: true } } },
                    orderBy: { createdAt: 'desc' }
                },
                requestedBy: { select: { name: true, username: true, phone: true } },
                unit: { select: { name: true } },
                workshopUnit: { select: { name: true } },
                procurement: { select: { code: true, title: true } },
                officeDocument: { select: { id: true, number: true, status: true, uuid: true } }
            }
        });

        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json(order);
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
                requestedById: user.id,
                unitId: unitId ? parseInt(unitId) : user.unitId,
                workshopType: workshopType || null,
                workshopUnitId: workshopUnitId ? parseInt(workshopUnitId) : null,
                picName,
                estimatedCost,
                status: 'PENDING',
                maintenanceId: maintenanceId ? parseInt(maintenanceId) : null,
                items: {
                    create: itemData
                }
            },
            include: {
                items: true,
                requestedBy: true
            }
        });

        // Auto-generate E-Office Document
        await generateSuratPesanan(newOrder, user);

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

        res.json({ message: 'Order created successfully', data: newOrder });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 5. Update Status
exports.updateOrderStatus = async (req, res) => {
    const { id } = req.params;
    const { status, message, photoBase64 } = req.body;
    const user = req.user;

    try {
        const order = await prisma.workshopOrder.findUnique({ where: { id: parseInt(id) }, include: { requestedBy: true } });
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const updateData = { status };
        let progressMsg = `Status diperbarui menjadi: ${status}`;
        
        if (status === 'IN_PROGRESS' && order.status === 'PENDING') {
            updateData.startDate = new Date();
            progressMsg = 'Pekerjaan dimulai.';
        } else if (status === 'COMPLETED') {
            updateData.completionDate = new Date();
            progressMsg = 'Pekerjaan selesai.';
            
            // Sync status E-Office Document if exists
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

        // Upload photo if any
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
                    photo: photoUrl,
                    createdById: user.id
                }
            });

            // Sync to Procurement if linked
            if (order.procurementId) {
                await prisma.procurementProgress.create({
                    data: {
                        procurementId: order.procurementId,
                        message: `[Workshop Update] ${progressMsg}`,
                        type: 'SYSTEM'
                    }
                });
            }

            return updated;
        });

        // Notif to requestor
        if (order.requestedBy?.phone) {
            const waMsg = `Bismillah.\n*Update Order Workshop*\n\n` +
                `Order Anda: *${order.title}*\n` +
                `Status saat ini: *${status}*\n\n` +
                (message ? `Catatan: ${message}` : `Silakan cek di sistem.`);
                
            setTimeout(() => {
                whatsappService.sendMessage(order.requestedBy.phone, waMsg).catch(console.error);
            }, 3000);
        }

        res.json(updatedOrder);

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

        const progress = await prisma.workshopProgress.create({
            data: {
                orderId: parseInt(id),
                message,
                percentage: percentage ? parseInt(percentage) : 0,
                photo: photoUrl,
                createdById: user.id
            }
        });

        // Get the order to check if it has procurementId
        const order = await prisma.workshopOrder.findUnique({ where: { id: parseInt(id) } });
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

        // Auto-generate Surat Pesanan
        await generateSuratPesanan(newOrder, user);

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
        const order = await prisma.workshopOrder.findUnique({ where: { id: parseInt(id) } });
        if (!order) return res.status(404).json({ error: 'Order not found' });

        await prisma.$transaction(async (prisma) => {
            let totalEstimatedCost = order.estimatedCost;

            if (workshopType) {
                await prisma.workshopOrder.update({
                    where: { id: parseInt(id) },
                    data: { workshopType }
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

        res.json({ message: 'Order details updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

