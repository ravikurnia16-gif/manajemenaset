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

const getWorkshopAccess = (user) => {
    const pos = (user?.position || '').toLowerCase();
    const isFullWorkshopAdmin =
        ['SUPER_ADMIN', 'ADMIN_ASET', 'KABID_SARPRAS'].includes(user?.role) ||
        pos.includes('kepala bidang sarana') ||
        pos.includes('kabid sarpras') ||
        user?.unitId === 21;
    const isWorkshopAdmin =
        isFullWorkshopAdmin ||
        (user?.unit?.name || '').toLowerCase().includes('workshop');
    return { isFullWorkshopAdmin, isWorkshopAdmin };
};

const resolveDefaultPic = (workshopType, settings) => {
    if (workshopType === 'KAYU') return settings?.workshopPicKayu || null;
    if (workshopType === 'BESI') return settings?.workshopPicBesi || null;
    return null;
};

const notifyAssignedPic = async (order, picName, deadlineOverride) => {
    const cleanPic = (picName || '').trim();
    if (!cleanPic) return;

    let picUser = await prisma.user.findFirst({
        where: { name: cleanPic },
        select: { id: true, name: true, phone: true }
    });
    if (!picUser) {
        const candidates = await prisma.user.findMany({
            where: {
                OR: [
                    { unitId: 21 },
                    { unit: { name: { contains: 'Workshop' } } },
                    { position: { contains: 'Workshop' } }
                ]
            },
            select: { id: true, name: true, phone: true }
        });
        picUser = candidates.find(
            (u) => (u.name || '').trim().toLowerCase() === cleanPic.toLowerCase()
        ) || null;
    }
    if (!picUser) return;

    const appUrl = process.env.CLIENT_URL || process.env.BASE_URL || 'https://sarpras.dareliman.or.id';
    const effectiveDeadline = deadlineOverride !== undefined ? deadlineOverride : order.deadline;
    const deadlineStr = effectiveDeadline
        ? new Date(effectiveDeadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        : '-';

    if (picUser.phone && picUser.phone.trim() !== '' && picUser.phone.trim() !== '-') {
        const senderName = order.requestedBy ? (order.requestedBy.name || order.requestedBy.username) : 'Pemohon';
        const unitName = order.unit ? order.unit.name : '-';
        const itemDetails = (order.items || []).map(it => `- ${it.name} (${it.qty} ${it.unit})`).join('\n');
        const msg = `Bismillah.\n*Penugasan PIC Workshop* \u{1F6E0}\n\n` +
            `Halo *${picUser.name}*,\n` +
            `Anda ditunjuk sebagai PIC untuk pesanan workshop berikut:\n\n` +
            `Kode: *${order.code}*\n` +
            `Tipe: *Workshop ${order.workshopType || 'Umum'}*\n` +
            `Dari: *${senderName}* (${unitName})\n` +
            `Order: *${order.title}*\n` +
            `Prioritas: *${order.priority}*\n` +
            `Target Selesai: *${deadlineStr}*\n\n` +
            (itemDetails ? `*Rincian Item*:\n${itemDetails}\n\n` : '') +
            `🔗 Detail Pesanan:\n${appUrl}/workshop-baru/orders/${order.id}\n\n` +
            `Mohon segera diproses. Syukron.`;

        whatsappService.sendMessage(picUser.phone.trim(), msg).catch(console.error);
    }

    try {
        await createNotification({
            userId: picUser.id,
            title: `Penugasan PIC Workshop (${order.code})`,
            message: `Anda ditunjuk sebagai PIC untuk pesanan "${order.title}".`,
            type: 'INFO',
            link: `/workshop-baru/orders/${order.id}`
        });
    } catch (err) {
        console.error('Failed to create PIC assignment notification:', err.message);
    }
};

// --- CONTROLLER FUNCTIONS ---

// 1. Dashboard Stats
exports.getDashboardStats = async (req, res) => {
    const user = req.user;
    try {
        const { isFullWorkshopAdmin, isWorkshopAdmin } = getWorkshopAccess(user);
        
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
    const { type, status, priority, unitId } = req.query;

    try {
        const { isFullWorkshopAdmin, isWorkshopAdmin } = getWorkshopAccess(user);
        
        let whereClause = {};
        if (type) whereClause.workshopType = type;
        if (status) whereClause.status = status;
        if (priority) whereClause.priority = priority;
        if (unitId) whereClause.unitId = parseInt(unitId);

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
    const user = req.user;
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

        const { isFullWorkshopAdmin, isWorkshopAdmin } = getWorkshopAccess(user);

        if (!isWorkshopAdmin) {
            const isOwner = (user.unitId && order.unitId === user.unitId) || order.requestedById === user.id;
            if (!isOwner) {
                return res.status(403).json({ error: 'Anda tidak memiliki akses untuk melihat pesanan workshop unit lain.' });
            }
        }

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

        let finalPicName = picName ? String(picName).trim() : null;
        if (!finalPicName && workshopType) {
            const settings = await prisma.setting.findUnique({ where: { id: 1 } });
            finalPicName = resolveDefaultPic(workshopType, settings);
        }
        
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
                picName: finalPicName,
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

        // Cari penerima: Admin Unit di Unit ID 21 (Workshop)
        let recipients = await prisma.user.findMany({
            where: {
                unitId: 21,
                role: 'ADMIN_UNIT',
                phone: { not: null, not: '' }
            },
            select: { phone: true, name: true }
        });

        // Fallback jika belum ada user dengan role ADMIN_UNIT di unit 21, cari berdasarkan posisi staf / kepala di Unit 21
        if (recipients.length === 0) {
            recipients = await prisma.user.findMany({
                where: {
                    unitId: 21,
                    position: { in: ['Sarpras Unit', 'Kepala Unit', 'Admin Unit', 'Kepala Workshop', 'Staff Workshop'] },
                    phone: { not: null, not: '' }
                },
                select: { phone: true, name: true }
            });
        }

        // Fallback jika belum ada yang spesifik, cari user manapun yang berada di Unit 21 yang memiliki nomor HP
        if (recipients.length === 0) {
            recipients = await prisma.user.findMany({
                where: {
                    unitId: 21,
                    phone: { not: null, not: '' }
                },
                select: { phone: true, name: true }
            });
        }

        // Fallback ke nomor HP unit Workshop (Unit ID 21) dari tabel Unit jika tidak ada no hp user
        if (recipients.length === 0) {
            const unit21 = await prisma.unit.findFirst({
                where: {
                    OR: [
                        { id: 21 },
                        { name: { contains: 'Workshop' } }
                    ]
                },
                select: { phone: true, headName: true }
            });
            if (unit21?.phone && unit21.phone.trim() !== '-' && unit21.phone.trim() !== '') {
                recipients.push({ phone: unit21.phone.trim(), name: unit21.headName || 'Admin Workshop' });
            }
        }

        // Deduplikasi dan validasi nomor HP
        const validRecipients = [];
        const seenPhones = new Set();
        for (const r of recipients) {
            const cleanPhone = (r.phone || '').trim();
            if (cleanPhone && cleanPhone !== '-' && !seenPhones.has(cleanPhone)) {
                seenPhones.add(cleanPhone);
                validRecipients.push({ ...r, phone: cleanPhone });
            }
        }

        if (validRecipients.length > 0) {
            const appUrl = process.env.CLIENT_URL || process.env.BASE_URL || 'https://sarpras.dareliman.or.id';
            const requesterName = newOrder.requestedBy ? (newOrder.requestedBy.name || newOrder.requestedBy.username) : (user.name || 'Pemohon');
            const unitName = newOrder.unit?.name || '-';
            const itemDetails = newOrder.items.map((it, idx) => `${idx + 1}. ${it.name} (${it.qty} ${it.unit})`).join('\n');
            const msg = `*Pesanan Baru Masuk ke Workshop*\n\n` +
                `Kode: *${newOrder.code}*\n` +
                `Judul: *${newOrder.title}*\n` +
                `Tipe: *${newOrder.workshopType || 'Umum'}*\n` +
                `Pemohon: *${requesterName}* (${unitName})\n` +
                `Target Selesai: *${newOrder.deadline ? new Date(newOrder.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}*\n\n` +
                `*Rincian Item*:\n${itemDetails}\n\n` +
                `🔗 Detail Pesanan:\n${appUrl}/workshop-baru/orders/${newOrder.id}\n\n` +
                `Mohon dicek di sistem.`;

            validRecipients.forEach(recipient => {
                setTimeout(() => {
                    whatsappService.sendMessage(recipient.phone, msg).catch(console.error);
                }, 3000);
            });
        }

        if (finalPicName) {
            setTimeout(() => {
                notifyAssignedPic(newOrder, finalPicName, newOrder.deadline).catch(console.error);
            }, 4000);
        }

        res.json({ message: 'Order created successfully', data: newOrder });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const syncOfficeDocumentCompleted = async (order) => {
    if (!order?.officeDocumentId) return;
    const doc = await prisma.officeDocument.findUnique({ where: { id: order.officeDocumentId } });
    if (!doc) return;
    try {
        const content = JSON.parse(doc.content || '{}');
        content.orderStatus = 'COMPLETED';
        await prisma.officeDocument.update({
            where: { id: doc.id },
            data: { content: JSON.stringify(content) }
        });
    } catch {
        // Ignore malformed JSON content
    }
};

// 5. Update Status
exports.updateOrderStatus = async (req, res) => {
    const { id } = req.params;
    const { status, message, photoBase64, percentage, estimatedCompletionDate } = req.body;
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

        // Jika progres diisi 100% (selain pembatalan), otomatis ubah status menjadi COMPLETED
        const effectiveStatus = (status !== 'CANCELLED' && parsedPercent === 100) ? 'COMPLETED' : status;
        const updateData = { status: effectiveStatus };
        let progressMsg = `Status diperbarui menjadi: ${effectiveStatus}`;

        if (effectiveStatus === 'IN_PROGRESS') {
            if (order.status === 'PENDING') {
                if (!estimatedCompletionDate) {
                    return res.status(400).json({ error: 'Estimasi selesai pekerjaan wajib diisi saat menerima pesanan.' });
                }
                const parsedEst = new Date(estimatedCompletionDate);
                if (isNaN(parsedEst.getTime())) {
                    return res.status(400).json({ error: 'Format tanggal estimasi selesai tidak valid.' });
                }
                updateData.startDate = new Date();
                updateData.estimatedCompletionDate = parsedEst;
                const estIndo = parsedEst.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                progressMsg = message || `Pesanan diterima workshop. Estimasi selesai pengerjaan: ${estIndo} (Progres: ${parsedPercent ?? 25}%).`;
            } else if (estimatedCompletionDate) {
                const parsedEst = new Date(estimatedCompletionDate);
                if (!isNaN(parsedEst.getTime())) {
                    updateData.estimatedCompletionDate = parsedEst;
                }
            }
        } else if (effectiveStatus === 'CANCELLED') {
            if (order.status === 'PENDING' && !message) {
                return res.status(400).json({ error: 'Alasan penolakan pesanan wajib diisi.' });
            }
            if (message) {
                progressMsg = `Pesanan Ditolak/Dibatalkan: ${message}`;
            }
        } else if (effectiveStatus === 'COMPLETED') {
            updateData.completionDate = new Date();
            if (!order.startDate) updateData.startDate = new Date();
            progressMsg = message || 'Pekerjaan selesai 100%.';
            await syncOfficeDocumentCompleted(order);
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
            let extraInfo = '';
            const finalEst = updateData.estimatedCompletionDate || order.estimatedCompletionDate;
            if (finalEst) {
                const estD = new Date(finalEst);
                extraInfo += `\nEstimasi Selesai: *${estD.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}*`;
            }
            const percentWa = parsedPercent !== undefined ? `\nProgres Pengerjaan: *${parsedPercent}%*` : '';
            
            let waMsg = '';
            if (effectiveStatus === 'CANCELLED') {
                waMsg = `Bismillah.\n*Pesanan Workshop Ditolak/Dibatalkan*\n\n` +
                    `Order Anda: *${order.title}*\n` +
                    `Status: *Ditolak/Dibatalkan*\n` +
                    `Alasan: *${message || 'Tidak dapat dikerjakan'}*\n\n` +
                    `Silakan koordinasi dengan pihak Workshop Unit 21 jika diperlukan.`;
            } else {
                waMsg = `Bismillah.\n*Update Order Workshop*\n\n` +
                    `Order Anda: *${order.title}*\n` +
                    `Status saat ini: *${effectiveStatus}*${extraInfo}${percentWa}\n\n` +
                    (message ? `Catatan: ${message}` : `Silakan cek di sistem.`);
            }
                
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

        const finalMsg = message || (parsedPercent >= 100
            ? 'Pekerjaan selesai 100%.'
            : `Update progres fisik pengerjaan: ${parsedPercent}%`);

        const order = await prisma.workshopOrder.findUnique({
            where: { id: parseInt(id) },
            include: { requestedBy: true }
        });
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const shouldAutoComplete = parsedPercent >= 100 && order.status !== 'CANCELLED';
        let nextStatus = order.status;

        const progress = await prisma.$transaction(async (tx) => {
            const createdProgress = await tx.workshopProgress.create({
                data: {
                    orderId: parseInt(id),
                    message: finalMsg,
                    percentage: parsedPercent,
                    photo: photoUrl,
                    createdById: user.id
                }
            });

            if (shouldAutoComplete) {
                nextStatus = 'COMPLETED';
                await tx.workshopOrder.update({
                    where: { id: parseInt(id) },
                    data: {
                        status: 'COMPLETED',
                        startDate: order.startDate || new Date(),
                        completionDate: order.completionDate || new Date()
                    }
                });
            } else if (order.status === 'PENDING' && parsedPercent > 0) {
                nextStatus = 'IN_PROGRESS';
                await tx.workshopOrder.update({
                    where: { id: parseInt(id) },
                    data: { status: 'IN_PROGRESS', startDate: new Date() }
                });
            }

            if (order.procurementId) {
                await tx.procurementProgress.create({
                    data: {
                        procurementId: order.procurementId,
                        message: `[Workshop Progress] ${finalMsg} (${parsedPercent}%)`,
                        type: 'SYSTEM'
                    }
                });
            }

            return createdProgress;
        });

        if (shouldAutoComplete) {
            await syncOfficeDocumentCompleted(order);

            if (order.status !== 'COMPLETED' && order.requestedBy?.phone) {
                const waMsg = `Bismillah.\n*Update Order Workshop*\n\n` +
                    `Order Anda: *${order.title}*\n` +
                    `Status saat ini: *COMPLETED* (Selesai)\n` +
                    `Progres Pengerjaan: *100%*\n\n` +
                    `Catatan: ${finalMsg}`;
                setTimeout(() => {
                    whatsappService.sendMessage(order.requestedBy.phone, waMsg).catch(console.error);
                }, 3000);
            }
        }

        res.json({
            ...progress,
            orderStatus: nextStatus,
            completedAutomatically: shouldAutoComplete
        });
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

        // Notify Admin Unit di Unit ID 21 (Workshop)
        let recipients = await prisma.user.findMany({
            where: {
                unitId: 21,
                role: 'ADMIN_UNIT',
                phone: { not: null, not: '' }
            }
        });

        if (recipients.length === 0) {
            recipients = await prisma.user.findMany({
                where: {
                    unitId: 21,
                    position: { in: ['Sarpras Unit', 'Kepala Unit', 'Admin Unit', 'Kepala Workshop', 'Staff Workshop'] },
                    phone: { not: null, not: '' }
                }
            });
        }

        if (recipients.length === 0) {
            recipients = await prisma.user.findMany({
                where: {
                    unitId: 21,
                    phone: { not: null, not: '' }
                }
            });
        }

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

            const appUrl = process.env.CLIENT_URL || process.env.BASE_URL || 'https://sarpras.dareliman.or.id';

            const msg = `Bismillah.\n*Request Workshop Baru* \u{1F6E0}\n\n` +
                `Kode: *${newOrder.code}*\n` +
                `Dari: *${senderName}* (${unitName})\n` +
                `Order: *${newOrder.title}*\n` +
                `Prioritas: *${newOrder.priority}*\n` +
                `Target Selesai: *${newOrder.deadline ? new Date(newOrder.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}*\n\n` +
                `*Rincian Item*:\n${itemDetails}\n\n` +
                `🔗 Detail Pesanan:\n${appUrl}/workshop-baru/orders/${newOrder.id}\n\n` +
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

// 8. Update Order Details (WorkshopType, PIC, Deadline & Estimated Prices)
exports.updateOrderDetails = async (req, res) => {
    const { id } = req.params;
    const { workshopType, items, deadline, picName } = req.body;

    try {
        const { isWorkshopAdmin } = getWorkshopAccess(req.user);
        if (!isWorkshopAdmin) {
            return res.status(403).json({ error: 'Hanya Admin/Tim Workshop yang dapat mengubah detail atau menugaskan PIC.' });
        }

        const orderId = parseInt(id, 10);
        const order = await prisma.workshopOrder.findUnique({
            where: { id: orderId },
            include: { requestedBy: true, unit: true, items: true }
        });
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const nextWorkshopType = workshopType !== undefined ? (workshopType || null) : order.workshopType;
        let nextPicName = order.picName || null;

        if (picName !== undefined) {
            nextPicName = String(picName || '').trim() || null;
        } else if (workshopType && workshopType !== order.workshopType) {
            const settings = await prisma.setting.findUnique({ where: { id: 1 } });
            nextPicName = resolveDefaultPic(workshopType, settings) || order.picName || null;
        }

        const picChanged = Boolean(nextPicName && nextPicName !== order.picName);

        const updatedOrder = await prisma.$transaction(async (tx) => {
            let totalEstimatedCost = order.estimatedCost;

            if (items && Array.isArray(items)) {
                for (const item of items) {
                    await tx.workshopOrderItem.update({
                        where: { id: item.id },
                        data: { estimatedPrice: parseFloat(item.estimatedPrice) || 0 }
                    });
                }

                const dbItems = await tx.workshopOrderItem.findMany({ where: { orderId } });
                totalEstimatedCost = dbItems.reduce((acc, it) => acc + (it.estimatedPrice * it.qty), 0);
            }

            const updateData = {
                workshopType: nextWorkshopType,
                picName: nextPicName,
                estimatedCost: totalEstimatedCost
            };
            if (deadline !== undefined) {
                updateData.deadline = deadline ? new Date(deadline) : null;
            }

            return tx.workshopOrder.update({
                where: { id: orderId },
                data: updateData,
                include: { requestedBy: true, unit: true, items: true }
            });
        });

        // Kirim Notifikasi WA & in-app ke PIC bila PIC baru ditunjuk atau diganti
        if (picChanged) {
            notifyAssignedPic(updatedOrder, nextPicName, updatedOrder.deadline).catch(console.error);
        }

        res.json({ message: 'Order details updated successfully', data: updatedOrder });
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

// --- BUSINESS DAYS HELPERS ---
/**
 * Menghitung batas waktu (deadline) N hari kerja sejak startDate.
 * Hari Sabtu (6) dan Ahad (0) dilewati.
 */
const getDeadlineAfterBusinessDays = (startDate, businessDays = 2) => {
    const d = new Date(startDate);
    // Jika dibuat hari Sabtu, geser ke Senin pagi
    if (d.getDay() === 6) {
        d.setDate(d.getDate() + 2);
    } else if (d.getDay() === 0) {
        d.setDate(d.getDate() + 1);
    }

    let addedDays = 0;
    while (addedDays < businessDays) {
        d.setDate(d.getDate() + 1);
        const day = d.getDay();
        if (day !== 0 && day !== 6) { // Bukan Sabtu & Ahad
            addedDays++;
        }
    }
    return d;
};

/**
 * Menghitung berapa hari kerja yang telah berlalu (Sabtu & Ahad tidak dihitung)
 */
const getElapsedBusinessDays = (fromDate, toDate = new Date()) => {
    const start = new Date(fromDate);
    const end = new Date(toDate);
    if (end <= start) return 0;
    
    let cur = new Date(start);
    if (cur.getDay() === 6) cur.setDate(cur.getDate() + 2);
    else if (cur.getDay() === 0) cur.setDate(cur.getDate() + 1);

    let count = 0;
    while (cur < end) {
        cur.setDate(cur.getDate() + 1);
        const day = cur.getDay();
        if (day !== 0 && day !== 6) {
            count++;
        }
    }
    return Math.max(1, count);
};

// Export helpers for use in other modules if needed
exports.getDeadlineAfterBusinessDays = getDeadlineAfterBusinessDays;
exports.getElapsedBusinessDays = getElapsedBusinessDays;

// 12. Cron Job / Scheduler: Pengingat Antrean Pesanan Workshop (>2 Hari Kerja)
// Dijalankan 1 kali sehari di hari kerja (Senin - Jumat)
exports.checkPendingWorkshopOrders = async () => {
    try {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Ahad, 6 = Sabtu

        // Jangan kirim pada hari Sabtu dan Ahad (Libur)
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            console.log('[Scheduler] Workshop Reminder skipped: weekend (Sabtu/Ahad).');
            return { skipped: true, reason: 'weekend' };
        }

        console.log('[Scheduler] Memeriksa antrean masuk workshop (>2 hari kerja)...');

        // Cari pesanan workshop yang masih PENDING
        const pendingOrders = await prisma.workshopOrder.findMany({
            where: {
                status: 'PENDING'
            },
            include: {
                requestedBy: { select: { id: true, name: true, username: true } },
                unit: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: 'asc' }
        });

        // Filter: hanya pesanan yang createdAt sudah melewati 2 hari kerja
        const overdueOrders = pendingOrders.filter(order => {
            const deadline = getDeadlineAfterBusinessDays(order.createdAt, 2);
            return now >= deadline;
        });

        if (overdueOrders.length === 0) {
            console.log('[Scheduler] Tidak ada pesanan workshop PENDING yang mengendap >2 hari kerja.');
            return { sent: false, count: 0 };
        }

        console.log(`[Scheduler] Ditemukan ${overdueOrders.length} pesanan workshop mengendap >2 hari kerja.`);

        // Cari penerima: posisi 'Sarpras Unit' di unitId 21 (Workshop)
        let recipients = await prisma.user.findMany({
            where: {
                unitId: 21,
                position: { contains: 'Sarpras Unit' },
                phone: { not: null, not: '' }
            }
        });

        // Fallback: Jika belum ada yang berposisi spesifik, cari admin unit di unit 21
        if (recipients.length === 0) {
            recipients = await prisma.user.findMany({
                where: {
                    unitId: 21,
                    role: 'ADMIN_UNIT',
                    phone: { not: null, not: '' }
                }
            });
        }

        if (recipients.length === 0) {
            console.warn('[Scheduler] Tidak ditemukan penerima Sarpras Unit (unitId: 21) dengan nomor telepon aktif.');
            return { sent: false, reason: 'no_recipients' };
        }

        const appUrl = process.env.CLIENT_URL || process.env.BASE_URL || 'https://sarpras.dareliman.or.id';

        // Format pesan pengingat WhatsApp (TANPA "Yth." sesuai instruksi USER)
        let msg = `Bismillah.\n` +
            `⚠️ *PENGINGAT ANTREAN PESANAN WORKSHOP (>2 HARI KERJA)*\n\n` +
            `Kepada Sarpras Unit (Workshop Unit 21),\n` +
            `Terdapat *${overdueOrders.length} pesanan* di Antrean Masuk yang belum direspon lebih dari 2 hari kerja:\n\n`;

        overdueOrders.slice(0, 10).forEach((o, idx) => {
            const elapsedDays = getElapsedBusinessDays(o.createdAt, now);
            const reqName = o.requestedBy?.name || o.requestedBy?.username || 'Pemohon';
            const unitName = o.unit?.name || 'Umum';
            const dateStr = new Date(o.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

            msg += `${idx + 1}. *${o.title}* (${o.code})\n`;
            msg += `   📍 Unit: ${unitName} | 👤 Pemohon: ${reqName}\n`;
            msg += `   📅 Masuk: ${dateStr} | ⏱️ Mengendap: *${elapsedDays} hari kerja*\n\n`;
        });

        if (overdueOrders.length > 10) {
            msg += `...dan *${overdueOrders.length - 10} pesanan lainnya*.\n\n`;
        }

        msg += `Mohon untuk segera ditindaklanjuti pada sistem:\n` +
            `👉 *TOLAK PESANAN* (bila tidak dapat dikerjakan beserta alasan), atau\n` +
            `👉 *TERIMA PEKERJAAN* dengan menginputkan *Estimasi Selesai Pekerjaan*.\n\n` +
            `🔗 *Papan Antrean Workshop*:\n` +
            `${appUrl}/workshop-baru/board\n\n` +
            `_Pesan otomatis Sistem Manajemen Aset_`;

        // Kirim notifikasi WhatsApp & In-App Notification
        for (const r of recipients) {
            try {
                await whatsappService.sendMessage(r.phone, msg);
                console.log(`[Scheduler] Workshop queue reminder sent to ${r.name || r.username} (${r.phone})`);
            } catch (err) {
                console.error(`[Scheduler] Gagal kirim WA pengingat workshop ke ${r.phone}:`, err.message);
            }

            try {
                await createNotification({
                    userId: r.id,
                    title: 'Peringatan Antrean Workshop (>2 Hari Kerja)',
                    message: `Terdapat ${overdueOrders.length} pesanan workshop di Antrean Masuk yang belum direspon >2 hari kerja. Segera tolak atau terima dengan estimasi selesai.`,
                    type: 'WARNING',
                    link: '/workshop-baru/board'
                });
            } catch (err) {
                console.error('[Scheduler] Gagal buat in-app notification:', err.message);
            }
        }

        return { sent: true, count: overdueOrders.length, recipientsCount: recipients.length };
    } catch (error) {
        console.error('[Scheduler] checkPendingWorkshopOrders Error:', error);
        return { error: error.message };
    }
};


