const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');
const { deleteFile, uploadFile } = require('../services/minioService');
const whatsappService = require('../services/whatsappService');
const { createNotification } = require('./notificationController');

// Debounce map for assignment notifications: { "userId-procId": Timer }
const assignmentTimers = new Map();

// Helper to generate Request Code
const generateCode = async () => {
    const year = new Date().getFullYear();

    const lastRecord = await prisma.procurement.findFirst({
        where: {
            code: {
                startsWith: `REQ/${year}/`
            }
        },
        orderBy: {
            code: 'desc'
        }
    });

    let nextSequence = 1;
    if (lastRecord) {
        const parts = lastRecord.code.split('/');
        if (parts.length === 3) {
            const lastSeq = parseInt(parts[2]);
            if (!isNaN(lastSeq)) {
                nextSequence = lastSeq + 1;
            }
        }
    }

    const sequence = nextSequence.toString().padStart(3, '0');
    return `REQ/${year}/${sequence}`;
};

// Get all procurements
exports.getAllProcurements = async (req, res) => {
    const { status, type, unitId } = req.query;
    const user = req.user;

    try {
        const whereClause = {};
        if (status) whereClause.status = status;
        if (type) whereClause.type = type;
        if (unitId) whereClause.unitId = parseInt(unitId);

        if (['ADMIN_UNIT', 'USER'].includes(user.role)) {
            whereClause.OR = [
                { unitId: user.unitId },
                { userId: user.id },
                { items: { some: { assignedToId: user.id } } }
            ];
        }

        const procurements = await prisma.procurement.findMany({
            where: whereClause,
            include: {
                user: { select: { username: true } },
                unit: { select: { name: true } },
                _count: { select: { items: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(procurements);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteProcurement = async (req, res) => {
    const { id } = req.params;
    try {
        const procurement = await prisma.procurement.findUnique({ where: { id: parseInt(id) } });
        if (procurement && procurement.bastFile) {
            await deleteFile(procurement.bastFile);
        }

        await prisma.procurementItem.deleteMany({ where: { procurementId: parseInt(id) } });
        await prisma.vendorOffer.deleteMany({ where: { procurementId: parseInt(id) } });

        await prisma.procurement.delete({
            where: { id: parseInt(id) }
        });

        res.json({ message: 'Request deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

// Bulk Delete
exports.bulkDeleteProcurements = async (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'Invalid IDs' });

    try {
        await prisma.procurementItem.deleteMany({ where: { procurementId: { in: ids.map(id => parseInt(id)) } } });
        await prisma.vendorOffer.deleteMany({ where: { procurementId: { in: ids.map(id => parseInt(id)) } } });

        const result = await prisma.procurement.deleteMany({
            where: { id: { in: ids.map(id => parseInt(id)) } }
        });

        res.json({ message: `${result.count} requests deleted successfully` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

// Get single procurement
exports.getProcurementById = async (req, res) => {
    const { id } = req.params;
    try {
        const procurement = await prisma.procurement.findUnique({
            where: { id: parseInt(id) },
            include: {
                items: true,
                offers: true,
                unit: true,
                user: { select: { username: true, email: true } },
                progress: {
                    include: { user: { select: { id: true, name: true, username: true } } },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        if (!procurement) return res.status(404).json({ error: 'Data not found' });
        res.json(procurement);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create Request
exports.createProcurement = async (req, res) => {
    const { title, type, items, rkbId, isDirectOrder, assignedStaffId } = req.body;
    const user = req.user;

    try {
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Daftar barang tidak boleh kosong.' });
        }

        for (const [idx, item] of items.entries()) {
            if (!item.name || !item.qty || !item.unit) {
                return res.status(400).json({ error: `Baris ${idx + 1}: Nama, Jumlah, dan Satuan wajib diisi.` });
            }
        }

        const isDirect = (isDirectOrder === true || isDirectOrder === 'true') && (user.role === 'SUPER_ADMIN' || user.position === 'Kepala Bidang Sarana dan Prasarana');
        const initialStatus = isDirect ? 'APPROVED' : 'SUBMITTED';

        const results = [];

        for (const item of items) {
            const code = await generateCode();
            const result = await prisma.$transaction(async (prisma) => {
                // Create Header
                const procurement = await prisma.procurement.create({
                    data: {
                        code,
                        title: title ? (isDirect ? `[PERINTAH KABID] ${title} - ${item.name}` : `${title} - ${item.name}`) : `Permintaan: ${item.name}`,
                        userId: user.id,
                        unitId: user.unitId,
                        type: item.type || type || 'ASSET',
                        status: initialStatus,
                        rkbId: rkbId ? parseInt(rkbId) : null,
                        isDirectOrder: isDirect
                    }
                });

                // Create Item (single)
                const itemData = {
                    procurementId: procurement.id,
                    name: item.name,
                    spec: item.spec,
                    qty: parseInt(item.qty),
                    unit: item.unit,
                    estPrice: parseFloat(item.estPrice || 0),
                    fundingSource: item.fundingSource || 'Yayasan',
                    categoryId: item.categoryId ? parseInt(item.categoryId) : null
                };

                let assignedUser = null;
                if (isDirect && assignedStaffId) {
                    itemData.assignedToId = parseInt(assignedStaffId);
                    assignedUser = await prisma.user.findUnique({ where: { id: parseInt(assignedStaffId) } });
                    itemData.assignedTo = assignedUser ? (assignedUser.name || assignedUser.username) : null;
                }

                await prisma.procurementItem.create({
                    data: itemData
                });

                return { ...procurement, assignedUser };
            });
            results.push(result);
        }

        // Notify chosen staff if Direct Order
        if (isDirect && assignedStaffId) {
            const assignedUser = await prisma.user.findUnique({ where: { id: parseInt(assignedStaffId) } });
            if (assignedUser && assignedUser.phone) {
                const itemListMsg = items.map((it, idx) =>
                    `${idx + 1}. *${it.name}*` + (it.spec && it.spec !== '-' ? ` (${it.spec})` : '')
                ).join('\n');

                const msg = `Bismillah.\n\n` +
                    `*Info Penugasan Pengadaan (MANDAT KABID)*\n\n` +
                    `Halo *${assignedUser.name || assignedUser.username}*,\n\n` +
                    `Anda menerima perintah langsung pengadaan *"${title}"* dari Kepala Bidang.\n\n` +
                    `*Rincian Barang:*\n` +
                    `${itemListMsg}\n\n` +
                    `Mohon segera diproses. Syukron.`;

                setTimeout(async () => {
                    try {
                        await whatsappService.sendMessage(assignedUser.phone, msg);
                        console.log(`[WA] Instant direct procurement mandate sent to ${assignedUser.username}`);
                    } catch (e) {
                        console.error('WA Mandate Notification Error:', e);
                    }
                }, 5000);
            }
        }

        res.json({ message: `${results.length} Request(s) submitted`, data: results });

        // --- In-App Notification (Phase 3) ---
        (async () => {
            try {
                const submitterInfo = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, username: true } });
                const submitterName = submitterInfo?.name || submitterInfo?.username || 'Seseorang';

                const admins = await prisma.user.findMany({
                    where: {
                        OR: [
                            { position: 'Kepala Bidang Sarana dan Prasarana' },
                            { position: 'Staff Manajemen Aset' },
                            { position: 'Staff Keuangan dan Administrasi (Sarpras)' }
                        ]
                    }
                });

                for (const admin of admins) {
                    await createNotification(
                        admin.id,
                        isDirect ? 'Perintah Pengadaan Auto-Approve' : 'Permintaan Pengadaan Baru',
                        `${submitterName} ${isDirect ? 'memerintahkan' : 'mengajukan'} ${results.length} permintaan pengadaan.`,
                        isDirect ? 'SUCCESS' : 'URGENT',
                        '/procurement'
                    );
                }
            } catch (err) {
                console.error('Failed to send in-app notification for procurement:', err);
            }
        })();

        // --- WhatsApp Notification (Async) ---
        (async () => {
            try {
                const submitter = await prisma.user.findUnique({
                    where: { id: user.id },
                    include: { unit: true }
                });

                if (!submitter) return;

                const itemList = (items || []).map((item, index) =>
                    `${index + 1}. ${item.name} (${item.qty} ${item.unit})`
                ).join('\n');

                if (submitter.phone) {
                    const msgSubmitter = `Bismillah.\n*Info Request Pengadaan*\n\n` +
                        `Ustadz/Ustadzah *${submitter.name || submitter.username}*,\n${results.length} permintaan anda telah kami terima dengan rincian:\n\n` +
                        `${itemList}\n\n` +
                        `${isDirect ? `*Status* : Langsung Disetujui (Instruksi Kabid) \u2705\n` : `Pesanan Ustadz/Ustadzah akan segera kami proses.`}`;

                    await whatsappService.sendMessage(submitter.phone, msgSubmitter);
                }

                if (!isDirect) {
                    // 3. Notify Admins (Only if NOT direct, since direct already notifies the chosen admin)
                    const admins = await prisma.user.findMany({
                        where: {
                            OR: [
                                { position: 'Kepala Bidang Sarana dan Prasarana' },
                                { position: 'Staff Manajemen Aset' },
                                { position: 'Staff Keuangan dan Administrasi (Sarpras)' }
                            ],
                            phone: { not: null, not: '' }
                        }
                    });

                    if (admins.length > 0) {
                        const msgAdm = `Bismillah.\n*Info Request Pengadaan (URGENT)*\n\n` +
                            `Ada ${results.length} pesanan baru dari:\n` +
                            `\u{1F464} *Nama Lengkap* : ${submitter.name || submitter.username}\n` +
                            `\u{1F194} *NIY* : ${submitter.username || '-'}\n` +
                            `\u{1F3E2} *Unit* : ${submitter.unit?.name || '-'}\n\n` +
                            `*Rincian Permintaan:*\n` +
                            `${itemList}\n\n` +
                            `Mohon segera di proses.`;

                        // Simple delay then staggering
                        setTimeout(async () => {
                            let cumulativeDelay = 0;
                            for (const admin of admins) {
                                const randomGap = Math.floor(Math.random() * (20000 - 5000 + 1)) + 5000;
                                cumulativeDelay += randomGap;

                                setTimeout(async () => {
                                    try {
                                        await whatsappService.sendMessage(admin.phone, msgAdm);
                                    } catch (e) {
                                        console.error(`Failed sending to ${admin.username}:`, e);
                                    }
                                }, cumulativeDelay);
                            }
                        }, 30000);
                    }
                }
            } catch (err) {
                console.error("WA Notification Error:", err);
            }
        })();

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Import Request from Excel
exports.importProcurement = async (req, res) => {
    const { title, type, items } = req.body;
    const user = req.user;

    try {
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Data items kosong.' });
        }

        for (const [idx, item] of items.entries()) {
            if (!item.name || !item.qty || !item.unit) {
                return res.status(400).json({ error: `Baris ${idx + 2}: Nama, Jumlah, dan Satuan wajib diisi (Header dihitung baris 1).` });
            }
        }

        const results = [];
        for (const item of items) {
            const code = await generateCode();
            const result = await prisma.$transaction(async (prisma) => {
                // 1. Create Header
                const procurement = await prisma.procurement.create({
                    data: {
                        code,
                        title: title ? `${title} - ${item.name}` : `Import: ${item.name}`,
                        userId: user.id,
                        unitId: user.unitId,
                        type: item.type || type || 'ASSET',
                        status: 'SUBMITTED'
                    }
                });

                // 2. Create Item (single)
                await prisma.procurementItem.create({
                    data: {
                        procurementId: procurement.id,
                        name: item.name,
                        spec: item.spec ? String(item.spec) : '-',
                        qty: parseInt(item.qty),
                        unit: item.unit ? String(item.unit) : 'Unit',
                        estPrice: parseFloat(item.estPrice || 0),
                        fundingSource: item.fundingSource || 'Yayasan',
                        categoryId: item.categoryId ? parseInt(item.categoryId) : null
                    }
                });

                return procurement;
            });
            results.push(result);
        }

        res.json({ message: `Import berhasil! ${results.length} Request(s) dibuat.`, data: results });

        // --- In-App Notification (Phase 3) ---
        (async () => {
            try {
                const submitterInfo = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, username: true } });
                const submitterName = submitterInfo?.name || submitterInfo?.username || 'Seseorang';

                const admins = await prisma.user.findMany({
                    where: {
                        OR: [
                            { position: 'Kepala Bidang Sarana dan Prasarana' },
                            { position: 'Staff Manajemen Aset' },
                            { position: 'Staff Keuangan dan Administrasi (Sarpras)' }
                        ]
                    }
                });

                for (const admin of admins) {
                    await createNotification(
                        admin.id,
                        'Import Pengadaan Baru',
                        `${submitterName} melakukan import ${results.length} permintaan pengadaan.`,
                        'INFO',
                        '/procurement'
                    );
                }
            } catch (err) {
                console.error('Failed to send in-app notification for procurement import:', err);
            }
        })();

        // --- WhatsApp Notification (Async) ---
        (async () => {
            try {
                // 1. Fetch Submitter Details
                const submitter = await prisma.user.findUnique({
                    where: { id: user.id },
                    include: { unit: true }
                });

                if (!submitter) return;

                // Format Item List
                const itemList = (items || []).map((item, index) =>
                    `${index + 1}. ${item.name} (${item.qty} ${item.unit})`
                ).join('\n');

                // 2. Notify Admins
                const admins = await prisma.user.findMany({
                    where: {
                        OR: [
                            { position: 'Kepala Bidang Sarana dan Prasarana' }, // Ravi Kurnia
                            { position: 'Staff Manajemen Aset' }, // Eldo
                            { position: 'Staff Keuangan' }  // Syafrian
                        ],
                        phone: { not: null, not: '' }
                    }
                });

                if (admins.length > 0) {
                    const msgAdm = `Bismillah.\n*[IMPORT REQUEST PENGADAAN]* 📥\n\n` +
                        `Ada ${results.length} pesanan baru di-import dari Excel oleh:\n` +
                        `\u{1F464} *Nama Lengkap* : ${submitter.name || submitter.username}\n` +
                        `\u{1F194} *NIY* : ${submitter.username || '-'}\n` +
                        `\u{1F3E2} *Unit* : ${submitter.unit?.name || '-'}\n\n` +
                        `*Rincian Permintaan:*\n` +
                        `${itemList}\n\n` +
                        `Mohon segera di proses.`;

                    // The global queue handles staggering (30-60s)
                    for (const admin of admins) {
                        try {
                            await whatsappService.sendMessage(admin.phone, msgAdm);
                        } catch (e) {
                            console.error(`[WA] Failed sending to ${admin.username}:`, e);
                        }
                    }
                }
            } catch (err) {
                console.error("WA Import Notification Error:", err);
            }
        })();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update Status (Validate / Approve / Reject)
exports.updateStatus = async (req, res) => {
    const { id } = req.params;
    const { status, validationNote, rejectionReason } = req.body;

    try {
        const updateData = { status };
        if (validationNote) updateData.validationNote = validationNote;
        if (rejectionReason) updateData.rejectionReason = rejectionReason;

        const procurement = await prisma.procurement.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: { user: true, items: true }
        });

        // --- In-App Notification (Phase 3) ---
        const title = procurement.title || procurement.code;
        let notifType = 'INFO';
        let notifMsg = '';

        if (status === 'VALIDATED' || status === 'APPROVED') {
            notifType = 'SUCCESS';
            notifMsg = `Permintaan pengadaan "${title}" telah disetujui.`;
        } else if (status === 'REJECTED') {
            notifType = 'WARNING';
            notifMsg = `Permintaan pengadaan "${title}" ditolak. Alasan: ${rejectionReason || '-'}`;
        }

        if (notifMsg) {
            await createNotification(
                procurement.userId,
                'Status Pengadaan Diperbarui',
                notifMsg,
                notifType,
                `/procurements/${id}`
            );
        }

        res.json(procurement);

        // --- WhatsApp Notification to Submitter (Async) ---
        (async () => {
            try {
                const submitter = await prisma.user.findUnique({
                    where: { id: procurement.userId },
                    include: { unit: true }
                });
                if (!submitter || !submitter.phone) return;

                const itemList = (procurement.items || []).map((item, i) =>
                    `${i + 1}. ${item.name} (${item.qty} ${item.unit})`
                ).join('\n');

                let msg = '';
                const title = procurement.title || procurement.code;

                if (status === 'VALIDATED' || status === 'APPROVED') {
                    msg = `Bismillah.\n*Info Request Pengadaan*\n\n` +
                        `Ustadz/Ustadzah *${submitter.name || submitter.username}*,\n\n` +
                        `Permintaan Anda *"${title}"* telah *Disetujui dan Divalidasi* \u2705\n\n` +
                        `*Rincian:*\n${itemList}\n\n` +
                        `Pesanan sedang dalam proses pengadaan. Mohon ditunggu.`;
                } else if (status === 'REJECTED') {
                    const reason = rejectionReason || 'Tidak ada keterangan';
                    msg = `Bismillah.\n*Info Request Pengadaan*\n\n` +
                        `Ustadz/Ustadzah *${submitter.name || submitter.username}*,\n\n` +
                        `Mohon maaf, permintaan Anda *"${title}"* *DITOLAK* \u274C\n\n` +
                        `*Alasan:* ${reason}\n\n` +
                        `Silakan hubungi Bidang Sarpras untuk informasi lebih lanjut.`;
                }

                if (msg) {
                    // Delay 30 seconds
                    setTimeout(async () => {
                        try {
                            await whatsappService.sendMessage(submitter.phone, msg);
                            console.log(`[WA] Stage notification sent to ${submitter.username} for status ${status}`);
                        } catch (e) {
                            console.error(`[WA] Failed stage notification:`, e);
                        }
                    }, 30000);
                }
            } catch (err) {
                console.error('WA Stage Notification Error:', err);
            }
        })();

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update Item Detail (Vendor, Brand, Specs)
exports.updateItemDetail = async (req, res) => {
    const { itemId } = req.params;
    const { fundingSource, brand, usefulLife, vendorId, vendorName, finalPrice, comparisonVendors, needComparison, assignedTo, assignedToId, assignmentNote, spec, categoryId } = req.body;

    try {
        const updateData = {
            fundingSource,
            brand,
            usefulLife: usefulLife ? parseInt(usefulLife) : undefined,
            vendorId: vendorId ? parseInt(vendorId) : null,
            vendorName: vendorName || null,
            finalPrice: finalPrice ? parseFloat(finalPrice) : undefined,
            assignedTo,
            assignedToId: assignedToId ? parseInt(assignedToId) : null,
            assignmentNote: assignmentNote || undefined,
            spec: spec !== undefined ? spec : undefined,
            categoryId: categoryId ? parseInt(categoryId) : undefined
        };

        // Explicitly handle comparisonVendors
        if (comparisonVendors !== undefined) {
            updateData.comparisonVendors = JSON.stringify(comparisonVendors);
        }

        // Explicitly handle needComparison
        if (needComparison !== undefined) {
            updateData.needComparison = needComparison;
        }

        const currentItem = await prisma.procurementItem.findUnique({
            where: { id: parseInt(itemId) }
        });

        const item = await prisma.procurementItem.update({
            where: { id: parseInt(itemId) },
            data: updateData
        });

        res.json(item);

        // --- WhatsApp Notification: Penugasan (Async & Debounced) ---
        // Only notify if assignment is NEW or CHANGED
        const isAssignmentChanged = assignedToId && (parseInt(assignedToId) !== currentItem.assignedToId);

        if (isAssignmentChanged) {
            const key = `${assignedToId}-${item.procurementId}`;

            // Clear existing timer if any
            if (assignmentTimers.has(key)) {
                clearTimeout(assignmentTimers.get(key));
            }

            // Set new timer (60 seconds debounce)
            const timer = setTimeout(async () => {
                try {
                    assignmentTimers.delete(key);

                    const assignedUser = await prisma.user.findUnique({
                        where: { id: parseInt(assignedToId) }
                    });

                    if (!assignedUser || !assignedUser.phone) return;

                    const procurement = await prisma.procurement.findUnique({
                        where: { id: item.procurementId },
                        include: {
                            items: {
                                where: { assignedToId: parseInt(assignedToId) }
                            }
                        }
                    });

                    if (!procurement || procurement.items.length === 0) return;

                    const itemListMsg = procurement.items.map((it, idx) =>
                        `${idx + 1}. *${it.name}*` +
                        (it.spec && it.spec !== '-' ? ` (${it.spec})` : '') +
                        (it.assignmentNote ? `\n   _Catatan: ${it.assignmentNote}_` : '')
                    ).join('\n');

                    const msg = `Bismillah.\n\n` +
                        `*Info Penugasan Pengadaan*\n\n` +
                        `Ustadz/Ustadzah *${assignedUser.name || assignedUser.username}*,\n\n` +
                        `Anda telah ditugaskan untuk mengelola item berikut pada pengajuan *"${procurement.title || procurement.code}"*:\n\n` +
                        `${itemListMsg}\n\n` +
                        `Mohon segera ditindaklanjuti. Syukron Jazakumullahu khairan.`;

                    await whatsappService.sendMessage(assignedUser.phone, msg);
                    console.log(`[WA] Consolidated assignment notification sent to ${assignedUser.username} for ${procurement.items.length} items`);
                } catch (err) {
                    console.error('WA Assignment Notification Error:', err);
                }
            }, 60000);

            assignmentTimers.set(key, timer);
        }

        // --- WhatsApp Notification: Vendor Terpilih (Async) ---
        // Only notify if vendor is NEW or CHANGED (compared to what was in DB)
        const isVendorChanged = vendorId && (parseInt(vendorId) !== currentItem.vendorId);

        if (isVendorChanged) {
            (async () => {
                try {
                    // Fetch procurement info via the item
                    const updatedItem = await prisma.procurementItem.findUnique({
                        where: { id: parseInt(itemId) },
                        include: {
                            procurement: {
                                include: {
                                    user: { include: { unit: true } },
                                    items: true
                                }
                            }
                        }
                    });

                    if (!updatedItem?.procurement) return;
                    const proc = updatedItem.procurement;
                    const submitter = proc.user;
                    if (!submitter || !submitter.phone) return;

                    // Get vendor name
                    const vendor = await prisma.vendor.findUnique({ where: { id: parseInt(vendorId) } });
                    const vendorName = vendor?.name || 'Vendor';

                    const msg = `Bismillah.\n\n` +
                        `Ustadz/Ustadzah *${submitter.name || submitter.username}*,\n\n` +
                        `Vendor telah terpilih untuk item *"${updatedItem.name}"* pada permintaan *"${proc.title || proc.code}"*:\n\n` +
                        `\u{1F3EA} *Vendor* : ${vendorName}\n` +
                        `\u{1F4B0} *Harga* : Rp ${(updatedItem.finalPrice || updatedItem.estPrice || 0).toLocaleString('id-ID')}\n\n` +
                        `Proses pengadaan sedang berjalan.`;

                    setTimeout(async () => {
                        try {
                            await whatsappService.sendMessage(submitter.phone, msg);
                            console.log(`[WA] Vendor notification sent to ${submitter.username}`);
                        } catch (e) {
                            console.error('[WA] Failed vendor notification:', e);
                        }
                    }, 30000);
                } catch (err) {
                    console.error('WA Vendor Notification Error:', err);
                }
            })();
        }

    } catch (error) {
        console.error("Update Item Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// Add Vendor Offer (Legacy / For Comparison only)
exports.addVendorOffer = async (req, res) => {
    const { id } = req.params;
    const { vendorName, price, isWinner } = req.body;

    try {
        if (isWinner) {
            await prisma.vendorOffer.updateMany({
                where: { procurementId: parseInt(id) },
                data: { isWinner: false }
            });
        }

        const offer = await prisma.vendorOffer.create({
            data: {
                procurementId: parseInt(id),
                vendorName,
                price: parseFloat(price),
                isWinner: isWinner || false
            }
        });

        res.json(offer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Process BAST & Auto-Asset Creation
exports.processBAST = async (req, res) => {
    const { id } = req.params;
    let { bastDate, bastFile, assetDetails } = req.body;

    if (typeof assetDetails === 'string') {
        try { assetDetails = JSON.parse(assetDetails); } catch (e) { }
    }

    try {
        const uploadBase64 = async (base64String, folder = 'assets') => {
            if (!base64String || !base64String.startsWith('data:')) return null;
            try {
                const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                if (!matches || matches.length !== 3) return null;
                const type = matches[1];
                const buffer = Buffer.from(matches[2], 'base64');
                const extension = type.split('/')[1] || 'jpg';
                const fileName = `proc_asset_${Date.now()}.${extension}`;
                return await uploadFile(buffer, fileName, type, folder);
            } catch (e) {
                console.error('Base64 Upload Error:', e);
                return null;
            }
        };

        const procurement = await prisma.procurement.findUnique({
            where: { id: parseInt(id) },
            include: {
                items: { include: { vendor: true } },
                unit: true
            }
        });

        if (!procurement) return res.status(404).json({ error: 'Request not found' });
        if (procurement.status === 'COMPLETED') return res.status(400).json({ error: 'Already completed' });

        await prisma.$transaction(async (prisma) => {
            // 1. Update Procurement Status
            await prisma.procurement.update({
                where: { id: parseInt(id) },
                data: {
                    status: 'COMPLETED',
                    bastDate: new Date(bastDate),
                    bastFile: req.fileUrl || bastFile || null
                }
            });

            // 2. If ASSET type, create Asset records
            if (procurement.type === 'ASSET') {
                const year = new Date(bastDate).getFullYear();
                const settings = await prisma.setting.findUnique({ where: { id: 1 } });
                const prefix = settings?.assetCodePrefix || 'AST';

                const defaultCategory = await prisma.category.findFirst();
                if (!defaultCategory) throw new Error('No Category found in Master Data. Please create one.');
                
                for (const item of procurement.items) {
                    const qty = item.qty;
                    const unitCode = procurement.unit.code;

                    const details = assetDetails?.[item.id] || {};

                    // Fetch actual category for code generation
                    const categoryIdToUse = details.categoryId || item.categoryId || defaultCategory.id;
                    const itemCategory = await prisma.category.findUnique({ where: { id: parseInt(categoryIdToUse) } }) || defaultCategory;
                    
                    const categoryCode = itemCategory.code;

                    const patternPrefix = `${prefix}.${unitCode}.${categoryCode}.${year}.`;

                    for (let i = 0; i < qty; i++) {
                        const lastAsset = await prisma.asset.findFirst({
                            where: { code: { startsWith: patternPrefix } },
                            orderBy: { code: 'desc' }
                        });

                        let currentSeq = 1;
                        if (lastAsset) {
                            const parts = lastAsset.code.split('.');
                            const lastSeqPart = parts[parts.length - 1];
                            currentSeq = (parseInt(lastSeqPart) || 0) + 1;
                        }

                        const seq = currentSeq.toString().padStart(4, '0');
                        const assetCode = `${patternPrefix}${seq}`;

                        const fundingSource = item.fundingSource || 'Yayasan';

                        // Determine Room ID and PIC ID for this item
                        let roomId = details.roomId ? parseInt(details.roomId) : null;
                        let picId = details.picId ? parseInt(details.picId) : null;
                        let itemImage = details.image || null; // Could be base64

                        // If individual allocation, override with specific unit data if available
                        if (details.allocationType === 'INDIVIDUAL' && details.units?.[i]) {
                            if (details.units[i].roomId) roomId = parseInt(details.units[i].roomId);
                            if (details.units[i].picId) picId = parseInt(details.units[i].picId);
                            if (details.units[i].image) itemImage = details.units[i].image;
                        }

                        // Upload image if it's base64
                        let finalImageUrl = null;
                        if (itemImage && itemImage.startsWith('data:')) {
                            finalImageUrl = await uploadBase64(itemImage);
                        } else if (itemImage) {
                            finalImageUrl = itemImage;
                        }

                        // Calculate maintenance interval in days
                        let maintenanceInterval = 0;
                        if (details.needsRoutineMaintenance) {
                            const val = parseInt(details.maintenanceInterval || 0);
                            maintenanceInterval = details.intervalUnit === 'MONTHS' ? val * 30 : val;
                        }

                        await prisma.asset.create({
                            data: {
                                code: assetCode,
                                name: item.name,
                                specification: item.spec,
                                brand: item.brand,
                                price: item.finalPrice || item.estPrice,
                                purchaseDate: new Date(bastDate),
                                condition: details.condition || 'BAIK',
                                sourceOfFunds: fundingSource,
                                acquisitionStatus: 'Pembelian',
                                unitId: procurement.unitId,
                                roomId: roomId,
                                categoryId: itemCategory.id,
                                usefulLife: item.usefulLife || itemCategory.usefulLife || 4,
                                vendorName: item.vendorName || null,
                                quantity: 1,
                                picId: picId,
                                image: finalImageUrl,
                                isLendable: details.isLendable || false,
                                needsRoutineMaintenance: details.needsRoutineMaintenance || false,
                                maintenanceInterval: maintenanceInterval
                            }
                        });
                    }
                }
            }
        });

        // --- In-App Notification (Phase 3) ---
        await createNotification(
            procurement.userId,
            'Aset Telah Diterima',
            `Proses BAST untuk "${procurement.title || procurement.code}" selesai. Aset telah masuk ke Daftar Aset.`,
            'SUCCESS',
            '/aset'
        );

        res.json({ message: 'BAST processed and Assets created.' });

        // --- WhatsApp Notification for BAST Completion (Async) ---
        (async () => {
            try {
                const submitter = await prisma.user.findUnique({
                    where: { id: procurement.userId },
                    include: { unit: true }
                });
                if (!submitter || !submitter.phone) return;

                const itemList = (procurement.items || []).map((item, i) =>
                    `${i + 1}. ${item.name} (${item.qty} ${item.unit})`
                ).join('\n');

                const msg = `Bismillah.\n*Info Request Pengadaan*\n\n` +
                    `Ustadz/Ustadzah *${submitter.name || submitter.username}*,\n` +
                    `Permintaan Anda *"${procurement.title || procurement.code}"* telah *SELESAI (BAST)* \u2705\u2705\u2705\n\n` +
                    `*Rincian:*\n${itemList}\n\n` +
                    `Barang sudah diterima dan tercatat sebagai aset. Syukron Jazakumullahu Khairan.`;

                setTimeout(async () => {
                    try {
                        await whatsappService.sendMessage(submitter.phone, msg);
                        console.log(`[WA] BAST notification sent to ${submitter.username}`);
                    } catch (e) {
                        console.error('[WA] Failed BAST notification:', e);
                    }
                }, 30000);
            } catch (err) {
                console.error('WA BAST Notification Error:', err);
            }
        })();

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

// Notify All Assignees manually
exports.notifyAssignees = async (req, res) => {
    const { id } = req.params;
    try {
        const procurement = await prisma.procurement.findUnique({
            where: { id: parseInt(id) },
            include: {
                items: {
                    include: { assignedToUser: true }
                }
            }
        });

        if (!procurement) return res.status(404).json({ error: 'Data tidak ditemukan' });

        // Group items by assigneeId
        const assignmentMap = {};
        procurement.items.forEach(item => {
            if (item.assignedToId && item.assignedToUser) {
                if (!assignmentMap[item.assignedToId]) {
                    assignmentMap[item.assignedToId] = {
                        user: item.assignedToUser,
                        items: []
                    };
                }
                assignmentMap[item.assignedToId].items.push(item);
            }
        });

        const assigneeIds = Object.keys(assignmentMap);
        if (assigneeIds.length === 0) {
            return res.status(400).json({ error: 'Belum ada petugas yang ditugaskan.' });
        }

        for (const userId of assigneeIds) {
            const { user, items } = assignmentMap[userId];
            if (!user.phone) continue;

            // CLEAR PENDING DEBOUNCE TIMER to avoid double notification
            const key = `${userId}-${id}`;
            if (assignmentTimers.has(key)) {
                clearTimeout(assignmentTimers.get(key));
                assignmentTimers.delete(key);
            }

            const itemListMsg = items.map((it, idx) =>
                `${idx + 1}. *${it.name}*` + (it.spec && it.spec !== '-' ? ` (${it.spec})` : '')
            ).join('\n');

            const msg = `Bismillah.\n\n` +
                `*Info Penugasan Pengadaan (Manual)*\n\n` +
                `Ustadz/Ustadzah *${user.name || user.username}*,\n\n` +
                `Anda telah ditugaskan untuk mengelola item berikut pada pengajuan *"${procurement.title || procurement.code}"*:\n\n` +
                `${itemListMsg}\n\n` +
                `Mohon segera ditindaklanjuti. Syukron Jazakumullahu khairan.`;

            await whatsappService.sendMessage(user.phone, msg);
        }

        res.json({ message: `Notifikasi telah dikirim ke ${assigneeIds.length} petugas.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

// ==================== PROGRESS TIMELINE ====================

/**
 * POST /api/procurements/:id/progress
 * Add a progress update to a procurement
 */
exports.addProgress = async (req, res) => {
    const { id } = req.params;
    const { message, stage } = req.body;
    const user = req.user;

    try {
        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Pesan progress tidak boleh kosong.' });
        }

        const procurement = await prisma.procurement.findUnique({
            where: { id: parseInt(id) },
            include: { items: true }
        });
        if (!procurement) return res.status(404).json({ error: 'Pengadaan tidak ditemukan.' });

        const progress = await prisma.procurementProgress.create({
            data: {
                procurementId: parseInt(id),
                userId: user.id,
                message: message.trim(),
                type: 'MANUAL',
                stage: stage ? parseInt(stage) : null
            },
            include: {
                user: { select: { id: true, name: true, username: true } }
            }
        });

        res.status(201).json(progress);

        // --- WhatsApp Notification to Submitter (Async) ---
        (async () => {
            try {
                if (procurement.userId === user.id) return; // Don't notify self
                const submitter = await prisma.user.findUnique({ where: { id: procurement.userId } });
                if (!submitter || !submitter.phone) return;

                const stageLabels = { 1: 'Verifikasi', 2: 'Penugasan', 3: 'Pemilihan Vendor', 4: 'Finalisasi', 5: 'Serah Terima' };
                const stageLabel = stage ? stageLabels[stage] || '' : '';

                const msg = `Bismillah.\n*Update Progress Pengadaan*\n\n` +
                    `Ustadz/Ustadzah *${submitter.name || submitter.username}*,\n\n` +
                    `Ada update terbaru untuk pengadaan *"${procurement.title || procurement.code}"*` +
                    (stageLabel ? ` (Tahap: ${stageLabel})` : '') + `:\n\n` +
                    `💬 _"${message.trim()}"_\n` +
                    `— ${progress.user.name || progress.user.username}\n\n` +
                    `Silakan cek aplikasi untuk detail lebih lanjut.`;

                setTimeout(async () => {
                    try {
                        await whatsappService.sendMessage(submitter.phone, msg);
                    } catch (e) {
                        console.error('[WA] Progress notification error:', e);
                    }
                }, 10000);
            } catch (err) {
                console.error('Progress WA Error:', err);
            }
        })();
    } catch (error) {
        console.error('addProgress error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * GET /api/procurements/:id/progress
 * Get all progress updates for a procurement
 */
exports.getProgress = async (req, res) => {
    const { id } = req.params;
    try {
        const progress = await prisma.procurementProgress.findMany({
            where: { procurementId: parseInt(id) },
            include: {
                user: { select: { id: true, name: true, username: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(progress);
    } catch (error) {
        console.error('getProgress error:', error);
        res.status(500).json({ error: error.message });
    }
};
