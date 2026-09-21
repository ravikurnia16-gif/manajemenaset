const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');
const { deleteFile, uploadFile } = require('../services/minioService');
const whatsappService = require('../services/whatsappService');
const { createNotification } = require('./notificationController');
const { sendPushToUser } = require('../services/pushService');
const { generateDocumentNumber } = require('../services/documentNumberingService');
const { generateVerificationQR } = require('../services/officePdfService');

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

// Helper to generate Unit Letter Number: {seq}/PP/{unitCode}/{romanMonth}/{year}
const generateUnitLetterNumber = async (unitId) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const ROMAN_MONTHS = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X', 11: 'XI', 12: 'XII' };
    const romanMonth = ROMAN_MONTHS[month];

    const unit = unitId ? await prisma.unit.findUnique({ where: { id: parseInt(unitId) } }) : null;
    let unitCode = 'UNIT';
    if (unit?.code) {
        unitCode = unit.code.trim().toUpperCase();
    } else if (unit?.name) {
        unitCode = unit.name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 5).toUpperCase();
    }

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);

    // Find progress with [SURAT_PERMOHONAN] for this unit in this year
    let maxSeq = 0;
    try {
        const letterLogs = await prisma.procurementProgress.findMany({
            where: {
                type: 'LETTER',
                createdAt: { gte: yearStart, lt: yearEnd },
                message: { contains: `"/PP/${unitCode}/"` }
            },
            select: { message: true }
        });

        for (const log of letterLogs) {
            try {
                const data = JSON.parse(log.message.replace('[SURAT_PERMOHONAN]', '').trim());
                if (data.letterNumber) {
                    const parts = data.letterNumber.split('/');
                    const seq = parseInt(parts[0], 10);
                    if (!isNaN(seq) && seq > maxSeq) {
                        maxSeq = seq;
                    }
                }
            } catch (e) { }
        }
    } catch (e) {
        console.error('Error querying letter logs for seq:', e);
    }

    // Fallback: count procurements for this unit in this year if maxSeq is still 0
    if (maxSeq === 0 && unitId) {
        try {
            const count = await prisma.procurement.count({
                where: { unitId: parseInt(unitId), createdAt: { gte: yearStart, lt: yearEnd } }
            });
            maxSeq = count;
        } catch (e) { }
    }

    const nextSeq = maxSeq + 1;
    const sequenceStr = String(nextSeq).padStart(3, '0');
    return `${sequenceStr}/PP/${unitCode}/${romanMonth}/${year}`;
};

// GET /api/procurements/unit-letter-number?unitId=...
exports.getUnitLetterNumber = async (req, res) => {
    try {
        const unitId = req.query.unitId || req.user?.unitId;
        const letterNumber = await generateUnitLetterNumber(unitId);
        res.json({ letterNumber });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get all procurements
exports.getAllProcurements = async (req, res) => {
    const { status, type, unitId, categoryId, search } = req.query;
    const user = req.user;

    try {
        const whereClause = {};
        if (status) whereClause.status = status;
        if (type) whereClause.type = type;
        if (unitId) whereClause.unitId = parseInt(unitId);
        if (categoryId) {
            whereClause.items = { some: { categoryId: parseInt(categoryId) } };
        }

        const andConditions = [];

        if (search) {
            andConditions.push({
                OR: [
                    { title: { contains: search } },
                    { code: { contains: search } },
                    { items: { some: { name: { contains: search } } } }
                ]
            });
        }

        if (['ADMIN_UNIT', 'USER'].includes(user.role)) {
            andConditions.push({
                OR: [
                    { unitId: user.unitId },
                    { userId: user.id },
                    { items: { some: { assignedToId: user.id } } }
                ]
            });
        }

        if (andConditions.length > 0) {
            whereClause.AND = andConditions;
        }

        const procurements = await prisma.procurement.findMany({
            where: whereClause,
            include: {
                user: { select: { username: true, name: true } },
                unit: { select: { name: true } },
                items: {
                    include: {
                        assignedToUser: { select: { id: true, name: true, username: true } },
                        category: { select: { id: true, name: true } },
                        vendor: { select: { id: true, name: true } }
                    }
                },
                _count: { select: { items: true } },
                progress: {
                    where: { message: { contains: '[Catatan Pemohon untuk Admin Aset]' } },
                    take: 1,
                    select: { message: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const formatted = procurements.map(p => {
            const rawNote = p.progress?.[0]?.message;
            const notes = rawNote ? rawNote.replace('📝 [Catatan Pemohon untuk Admin Aset]:\n', '').trim() : null;
            const { progress, ...rest } = p;
            
            // Calculate total estimated price & distinct assignees
            const totalEstimatedPrice = (p.items || []).reduce((sum, item) => sum + ((item.qty || 1) * (item.estPrice || 0)), 0);
            const assignees = Array.from(new Set((p.items || []).filter(it => it.assignedTo).map(it => it.assignedTo)));

            return {
                ...rest,
                notes,
                totalEstimatedPrice,
                assignees
            };
        });
        res.json(formatted);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get Dashboard Stats
exports.getDashboardStats = async (req, res) => {
    const user = req.user;

    try {
        const whereClause = {};

        if (['ADMIN_UNIT', 'USER'].includes(user.role)) {
            whereClause.OR = [
                { unitId: user.unitId },
                { userId: user.id },
                { items: { some: { assignedToId: user.id } } }
            ];
        }

        const procurements = await prisma.procurement.findMany({
            where: whereClause,
            select: { status: true }
        });

        const stats = {
            total: procurements.length,
            submitted: procurements.filter(p => p.status === 'SUBMITTED').length,
            approved: procurements.filter(p => p.status === 'APPROVED').length,
            process: procurements.filter(p => p.status === 'PROCESS').length,
            completed: procurements.filter(p => p.status === 'COMPLETED').length,
            rejected: procurements.filter(p => p.status === 'REJECTED').length,
        };

        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteProcurement = async (req, res) => {
    const { id } = req.params;
    try {
        const procurement = await prisma.procurement.findUnique({ where: { id: parseInt(id) } });
        if (procurement && procurement.bastFile) {
            let fileToDelete = procurement.bastFile;
            if (typeof fileToDelete === 'string' && fileToDelete.startsWith('{')) {
                try {
                    const parsed = JSON.parse(fileToDelete);
                    fileToDelete = parsed.fileUrl;
                } catch (e) { fileToDelete = null; }
            }
            if (fileToDelete && !fileToDelete.startsWith('data:')) {
                await deleteFile(fileToDelete);
            }
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
                items: {
                    include: { category: true }
                },
                offers: true,
                unit: true,
                user: { select: { id: true, name: true, username: true, email: true } },
                progress: {
                    include: { user: { select: { id: true, name: true, username: true } } },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        if (!procurement) return res.status(404).json({ error: 'Data not found' });

        const formattedItems = (procurement.items || []).map(it => {
            let cleanSpec = it.spec || '';
            let itemNotes = null;
            if (cleanSpec) {
                const match = cleanSpec.match(/\[Catatan:\s*([\s\S]*?)\]$/);
                if (match) {
                    itemNotes = match[1].trim();
                    cleanSpec = cleanSpec.replace(/\[Catatan:\s*[\s\S]*?\]$/, '').trim();
                }
            }
            return {
                ...it,
                spec: cleanSpec,
                notes: itemNotes
            };
        });

        const noteProgress = procurement.progress?.find(p => p.message && p.message.includes('[Catatan Pemohon untuk Admin Aset]'));
        const topNotes = noteProgress
            ? noteProgress.message.replace('📝 [Catatan Pemohon untuk Admin Aset]:\n', '').trim()
            : (formattedItems[0]?.notes || null);

        let bastSignatures = null;
        if (procurement.bastFile && typeof procurement.bastFile === 'string' && procurement.bastFile.startsWith('{')) {
            try {
                bastSignatures = JSON.parse(procurement.bastFile);
            } catch (e) { }
        }

        const letterProgress = procurement.progress?.find(p => p.type === 'LETTER' || p.message?.startsWith('[SURAT_PERMOHONAN]'));
        let requestLetter = null;
        if (letterProgress) {
            try {
                requestLetter = JSON.parse(letterProgress.message.replace('[SURAT_PERMOHONAN]', '').trim());
                if (requestLetter && Array.isArray(requestLetter.items)) {
                    requestLetter.items = requestLetter.items.map((it, idx) => {
                        const match = formattedItems.find(fi => fi.name === it.name) || formattedItems[idx];
                        const price = parseFloat(it.estPrice ?? it.estimatedPrice ?? it.price ?? match?.estPrice ?? 0) || 0;
                        return {
                            ...it,
                            estPrice: price,
                            estimatedPrice: price,
                            price: price
                        };
                    });
                }
            } catch (e) { }
        }

        let bastDoc = await prisma.officeDocument.findFirst({
            where: {
                category: 'BAST',
                subject: { contains: procurement.code }
            },
            include: { signedBy: true }
        });

        // Reconcile/sync on read if signatures exist but document status or party 2 signature is out of sync
        if (bastDoc) {
            const hasP1 = Boolean(bastSignatures?.kabidTte || bastDoc.party1SignedAt);
            const hasP2 = Boolean(bastSignatures?.receiverSignature || bastDoc.party2Signature);
            const isCompleted = procurement.status === 'COMPLETED';
            const targetStatus = (hasP1 && hasP2) || isCompleted ? 'SIGNED' : ((hasP1 || hasP2) ? 'PENDING_APPROVAL' : 'DRAFT');

            if (bastDoc.status !== targetStatus || (bastSignatures?.receiverSignature && !bastDoc.party2Signature) || (bastSignatures?.kabidTte && !bastDoc.party1SignedAt)) {
                const synced = await syncBastToOfficeDocument(procurement.id);
                if (synced) bastDoc = synced;
            }
        }

        res.json({
            ...procurement,
            items: formattedItems,
            notes: topNotes,
            bastSignatures,
            requestLetter,
            bastDoc
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create Request
exports.createProcurement = async (req, res) => {
    const {
        title, type, items, rkbId, isDirectOrder, assignedStaffId, notes,
        requesterSignature, headUnitName, headUnitPhone, letterNumber: customLetterNumber,
        headUnitSignature, kabidName
    } = req.body;
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

        const isDirect = (isDirectOrder === true || isDirectOrder === 'true') && (user.role === 'SUPER_ADMIN' || user.position === 'Kepala Bidang Sarana');

        // Cek apakah Kepala Unit sudah menandatangani saat submit
        const isHeadUnitSigned = !!headUnitSignature;
        // Jika Direct Order atau sudah di-approve Kepala Unit -> langsung SUBMITTED/APPROVED
        // Jika belum ditandatangani Kepala Unit -> status DRAFT (menunggu TTD Kepala Unit)
        const initialStatus = isDirect ? 'APPROVED' : (isHeadUnitSigned ? 'SUBMITTED' : 'DRAFT');

        const targetUnitId = req.body.unitId ? parseInt(req.body.unitId) : user.unitId;
        const batchId = 'BATCH-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        const letterNumber = customLetterNumber || await generateUnitLetterNumber(targetUnitId);

        const results = [];
        const userUnit = targetUnitId ? await prisma.unit.findUnique({ where: { id: targetUnitId } }) : null;
        const unitCode = userUnit?.code ? userUnit.code.toUpperCase() : 'UNIT';

        const consolidatedItems = items.map(it => {
            const price = parseFloat(it.estPrice ?? it.estimatedPrice ?? it.price ?? 0) || 0;
            return {
                name: it.name,
                spec: it.spec || '',
                qty: parseInt(it.qty) || 1,
                unit: it.unit || 'unit',
                estPrice: price,
                estimatedPrice: price,
                price: price,
                fundingSource: it.fundingSource || 'Yayasan',
                notes: it.notes || ''
            };
        });

        const kabidUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { position: 'Kepala Bidang Sarana' },
                    { position: { contains: 'Kepala Bidang Sarana' } }
                ]
            }
        });
        const defaultKabidName = kabidUser ? (kabidUser.name || kabidUser.username) : 'Kepala Bidang Sarana';

        const letterMetadata = {
            batchId,
            letterNumber,
            title: title || (items[0] ? items[0].name : 'Pengadaan Barang'),
            unitId: targetUnitId,
            unitName: userUnit?.name || 'Unit Pemohon',
            unitCode,
            requesterId: user.id,
            requesterName: user.name || user.username,
            requesterSignature: requesterSignature || null,
            headUnitName: headUnitName || '',
            headUnitPhone: headUnitPhone || '',
            headUnitSignature: headUnitSignature || null,
            headUnitApprovedAt: headUnitSignature ? new Date().toISOString() : null,
            kabidName: kabidName || defaultKabidName,
            kabidTte: isDirect ? true : null,
            kabidTteAt: isDirect ? new Date().toISOString() : null,
            notes: notes || '',
            items: consolidatedItems,
            createdAt: new Date().toISOString()
        };

        for (const item of items) {
            const code = await generateCode();
            const result = await prisma.$transaction(async (prisma) => {
                // Combine spec with item.notes if present
                let finalSpec = item.spec ? item.spec.trim() : '';
                const itemNotes = item.notes ? item.notes.trim() : '';
                if (itemNotes) {
                    finalSpec = finalSpec ? `${finalSpec}\n[Catatan: ${itemNotes}]` : `[Catatan: ${itemNotes}]`;
                }

                // Create Header
                const procurement = await prisma.procurement.create({
                    data: {
                        code,
                        title: title ? (isDirect ? `[PERINTAH KABID] ${title} - ${item.name}` : `${title} - ${item.name}`) : `Permintaan: ${item.name}`,
                        userId: user.id,
                        unitId: targetUnitId,
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
                    spec: finalSpec || null,
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

                const createdItem = await prisma.procurementItem.create({
                    data: itemData
                });

                const effectiveNote = itemNotes || (notes && typeof notes === 'string' ? notes.trim() : '');
                if (effectiveNote) {
                    await prisma.procurementProgress.create({
                        data: {
                            procurementId: procurement.id,
                            userId: user.id,
                            message: `📝 [Catatan Pemohon untuk Admin Aset]:\n${effectiveNote}`,
                            type: 'MANUAL',
                            stage: 1
                        }
                    });
                }

                // Simpan log surat permohonan konsolidasi (LETTER)
                await prisma.procurementProgress.create({
                    data: {
                        procurementId: procurement.id,
                        userId: user.id,
                        message: `[SURAT_PERMOHONAN] ${JSON.stringify(letterMetadata)}`,
                        type: 'LETTER',
                        stage: 1
                    }
                });

                return {
                    ...procurement,
                    notes: effectiveNote || null,
                    assignedUser,
                    batchId,
                    letterNumber,
                    items: [{ ...createdItem, spec: item.spec || '', notes: itemNotes || null }]
                };
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

                const noteDirectMsg = (notes && typeof notes === 'string' && notes.trim()) ? `\n*Catatan Pemohon:*\n"${notes.trim()}"\n` : '';

                const msg = `Bismillah.\n\n` +
                    `*Info Penugasan Pengadaan (MANDAT KABID)*\n\n` +
                    `Halo *${assignedUser.name || assignedUser.username}*,\n\n` +
                    `Anda menerima perintah langsung pengadaan *"${title}"* dari Kepala Bidang.\n\n` +
                    `*Rincian Barang:*\n` +
                    `${itemListMsg}\n` +
                    noteDirectMsg + `\n` +
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

        res.json({
            message: `${results.length} Request(s) submitted`,
            batchId,
            letterNumber,
            data: results
        });

        // --- ASYNC NOTIFICATIONS & WA WORKFLOW ---
        (async () => {
            try {
                const submitter = await prisma.user.findUnique({
                    where: { id: user.id },
                    include: { unit: true }
                });
                if (!submitter) return;

                const clientUrl = process.env.CLIENT_URL || process.env.BASE_URL || 'https://sarpras.dareliman.or.id';
                const itemList = (items || []).map((item, index) =>
                    `${index + 1}. ${item.name} (${item.qty} ${item.unit})`
                ).join('\n');
                const noteMsgText = (notes && typeof notes === 'string' && notes.trim()) ? `\n*Catatan:* "${notes.trim()}"\n` : '';

                // KASUS 1: Belum ditandatangani Kepala Unit (Bukan Direct Order)
                // -> Kirim WA berisi link persetujuan HANYA kepada Kepala Unit!
                if (!isDirect && !isHeadUnitSigned) {
                    // 1. WhatsApp ke Pemohon: Konfirmasi telah diteruskan ke Kepala Unit
                    if (submitter.phone) {
                        const msgSubmitter = `Bismillah.\n*Info Permohonan Pengadaan*\n\n` +
                            `Ustadz/Ustadzah *${submitter.name || submitter.username}*,\n` +
                            `Permohonan pengadaan Anda (*${letterNumber}*) telah dibuat:\n\n` +
                            `${itemList}\n` +
                            noteMsgText + `\n` +
                            `⏳ *Status*: Menunggu tanda tangan persetujuan Kepala Unit.\n` +
                            `Tautan persetujuan telah dikirimkan kepada Kepala Unit Anda. Setelah disetujui, permohonan akan otomatis diteruskan ke Bagian Sarana & Prasarana.`;

                        await whatsappService.sendMessage(submitter.phone, msgSubmitter).catch(console.error);
                    }

                    // 2. Cari Akun Kepala Unit
                    let headUnitPhoneTarget = headUnitPhone || null;
                    let targetHeadName = headUnitName || 'Kepala Unit';

                    if (!headUnitPhoneTarget && targetUnitId) {
                        const headUser = await prisma.user.findFirst({
                            where: {
                                unitId: targetUnitId,
                                OR: [
                                    { position: { contains: 'Kepala Unit' } },
                                    { position: { contains: 'Kepala Sekolah' } },
                                    { position: { contains: 'Pimpinan' } }
                                ],
                                phone: { not: null, not: '' }
                            }
                        });
                        if (headUser) {
                            headUnitPhoneTarget = headUser.phone;
                            targetHeadName = headUser.name || headUser.username;
                        } else if (userUnit?.phone) {
                            headUnitPhoneTarget = userUnit.phone;
                        }
                    }

                    if (headUnitPhoneTarget) {
                        const approvalLink = `${clientUrl}/public/approval-pengadaan/${batchId}`;
                        const msgHead = `Bismillah.\n*Persetujuan Permohonan Pengadaan Unit* 📋\n\n` +
                            `Ustadz/Ustadzah *${targetHeadName}*,\n` +
                            `Staf Anda *${submitter.name || submitter.username}* (${submitter.unit?.name || 'Unit'}) telah mengajukan permohonan pengadaan:\n\n` +
                            `Nomor Surat: *${letterNumber}*\n` +
                            `Perihal: *${title || 'Permohonan Pengadaan'}*\n\n` +
                            `*Rincian Barang:*\n${itemList}\n` +
                            noteMsgText + `\n` +
                            `Mohon periksa dan bubuhkan tanda tangan persetujuan pada tautan berikut:\n` +
                            `👉 ${approvalLink}\n\n` +
                            `_Setelah Anda menandatangani, berkas akan otomatis diteruskan ke Kepala Bidang Sarana & Staff Manajemen Aset._`;

                        await whatsappService.sendMessage(headUnitPhoneTarget, msgHead).catch(console.error);
                        console.log(`[WA] Sent approval link to Kepala Unit (${headUnitPhoneTarget}) for batch ${batchId}`);
                    }
                }
                // KASUS 2: Sudah ditandatangani Kepala Unit atau Direct Order
                // -> Kirim notifikasi ke Kepala Bidang Sarana & Staff Manajemen Aset
                else if (isDirect || isHeadUnitSigned) {
                    if (submitter.phone) {
                        const msgSubmitter = `Bismillah.\n*Info Request Pengadaan*\n\n` +
                            `Ustadz/Ustadzah *${submitter.name || submitter.username}*,\n${results.length} permintaan anda telah kami terima dengan rincian:\n\n` +
                            `${itemList}\n` +
                            noteMsgText + `\n` +
                            `${isDirect ? `*Status* : Langsung Disetujui (Instruksi Kabid) ✅\n` : `Pesanan Ustadz/Ustadzah akan segera diproses oleh Bagian Sarpras.`}`;

                        await whatsappService.sendMessage(submitter.phone, msgSubmitter).catch(console.error);
                    }

                    const admins = await prisma.user.findMany({
                        where: {
                            OR: [
                                { position: 'Kepala Bidang Sarana' },
                                { position: 'Staff Manajemen Aset' },
                                { position: 'Staff Keuangan dan Administrasi' }
                            ],
                            phone: { not: null, not: '' }
                        }
                    });

                    if (admins.length > 0) {
                        const msgAdm = `Bismillah.\n*Info Request Pengadaan (Resmi)* 📦\n\n` +
                            `Ada permohonan pengadaan baru (Telah Disetujui Kepala Unit):\n` +
                            `📄 *No. Surat* : ${letterNumber}\n` +
                            `👤 *Pemohon* : ${submitter.name || submitter.username}\n` +
                            `🏢 *Unit* : ${submitter.unit?.name || '-'}\n` +
                            (headUnitName ? `✍️ *Kepala Unit* : ${headUnitName}\n` : '') +
                            noteMsgText + `\n` +
                            `*Rincian Barang:*\n` +
                            `${itemList}\n\n` +
                            `Mohon segera diproses.`;

                        for (const admin of admins) {
                            try {
                                await whatsappService.sendMessage(admin.phone, msgAdm);
                            } catch (e) {
                                console.error(`Failed sending to ${admin.username}:`, e);
                            }
                        }
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
                            { position: 'Kepala Bidang Sarana' },
                            { position: 'Staff Manajemen Aset' },
                            { position: 'Staff Keuangan dan Administrasi' }
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
                            { position: 'Kepala Bidang Sarana' },
                            { position: 'Staff Manajemen Aset' },
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

        // --- In-App & Push Notification ---
        const title = procurement.title || procurement.code;
        let notifType = 'INFO';
        let notifMsg = '';
        let notifSubject = 'Status Pengadaan Diperbarui';
        const targetAsetUrl = procurement.unitId ? `/aset?unitId=${procurement.unitId}` : '/aset';
        let notifLink = `/procurements/${id}`;

        if (status === 'VALIDATED' || status === 'APPROVED') {
            notifType = 'SUCCESS';
            notifMsg = `Permintaan pengadaan "${title}" telah disetujui.`;
        } else if (status === 'REJECTED') {
            notifType = 'WARNING';
            notifMsg = `Permintaan pengadaan "${title}" ditolak. Alasan: ${rejectionReason || '-'}`;
        } else if (status === 'COMPLETED') {
            notifType = 'SUCCESS';
            notifSubject = 'Pengadaan Selesai (BAST) — Silakan Pilih Ruangan Aset';
            notifMsg = `Pengadaan "${title}" telah selesai (BAST). Mohon segera pilih/tentukan ruangan penempatan aset yang dibeli di unit Anda.`;
            notifLink = targetAsetUrl;
        }

        if (notifMsg) {
            await createNotification(
                procurement.userId,
                notifSubject,
                notifMsg,
                notifType,
                notifLink
            );
            sendPushToUser(
                procurement.userId,
                notifSubject,
                notifMsg,
                notifLink
            ).catch(err => console.error('[Push Status Error]:', err.message));
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
                const appUrl = process.env.CLIENT_URL || process.env.BASE_URL || 'https://sarpras.dareliman.or.id';

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
                } else if (status === 'COMPLETED') {
                    msg = `Bismillah.\n*Info Request Pengadaan (SiMas)*\n\n` +
                        `Ustadz/Ustadzah *${submitter.name || submitter.username}*,\n\n` +
                        `Permintaan pengadaan Anda *"${title}"* telah *SELESAI (BAST)* \u2705\u2705\u2705\n\n` +
                        `*Rincian Barang:*\n${itemList}\n\n` +
                        `\uD83D\uDCCD *Tindakan Diperlukan:*\n` +
                        `Barang telah diserahterimakan dan tercatat sebagai aset unit Anda. *Mohon segera pilih/tentukan ruangan penempatan aset yang dibeli* melalui tautan sistem SiMas berikut:\n` +
                        `\uD83D\uDD17 ${appUrl}${targetAsetUrl}\n\n` +
                        `Syukron, Jazaakumullahu Khairan.`;
                }

                if (msg) {
                    setTimeout(async () => {
                        try {
                            await whatsappService.sendMessage(submitter.phone, msg);
                            console.log(`[WA] Stage notification sent to ${submitter.username} for status ${status}`);
                        } catch (e) {
                            console.error(`[WA] Failed stage notification:`, e);
                        }
                    }, status === 'COMPLETED' ? 3000 : 15000);
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
        let finalSpec = spec !== undefined ? spec : undefined;
        if (req.body.notes !== undefined && finalSpec !== undefined) {
            const trimmedNotes = (req.body.notes || '').trim();
            if (trimmedNotes) {
                finalSpec = finalSpec ? `${finalSpec}\n[Catatan: ${trimmedNotes}]` : `[Catatan: ${trimmedNotes}]`;
            }
        }

        const updateData = {
            fundingSource,
            brand,
            usefulLife: (usefulLife !== undefined && usefulLife !== null && usefulLife !== '') ? parseInt(usefulLife) : undefined,
            vendorId: vendorId ? parseInt(vendorId) : null,
            vendorName: vendorName || null,
            finalPrice: (finalPrice !== undefined && finalPrice !== null && finalPrice !== '') ? parseFloat(finalPrice) : undefined,
            assignedTo,
            assignedToId: assignedToId ? parseInt(assignedToId) : null,
            assignmentNote: assignmentNote || undefined,
            spec: finalSpec,
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

        let cleanSpec = item.spec || '';
        let itemNotes = null;
        if (cleanSpec) {
            const match = cleanSpec.match(/\[Catatan:\s*([\s\S]*?)\]$/);
            if (match) {
                itemNotes = match[1].trim();
                cleanSpec = cleanSpec.replace(/\[Catatan:\s*[\s\S]*?\]$/, '').trim();
            }
        }

        res.json({
            ...item,
            spec: cleanSpec,
            notes: itemNotes
        });

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

// Bulk Assign Staff to Multiple Items in a Procurement
exports.bulkAssignStaff = async (req, res) => {
    const { id } = req.params;
    const { itemIds, assignedToId, assignmentNote } = req.body;

    try {
        if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
            return res.status(400).json({ error: 'Pilih minimal satu item untuk ditugaskan' });
        }

        let staffName = null;
        let staffUser = null;
        if (assignedToId) {
            staffUser = await prisma.user.findUnique({
                where: { id: parseInt(assignedToId) },
                select: { id: true, name: true, username: true, phone: true }
            });
            staffName = staffUser?.name || staffUser?.username;
        }

        await prisma.procurementItem.updateMany({
            where: {
                id: { in: itemIds.map(i => parseInt(i)) },
                procurementId: parseInt(id)
            },
            data: {
                assignedToId: assignedToId ? parseInt(assignedToId) : null,
                assignedTo: staffName,
                assignmentNote: assignmentNote || undefined
            }
        });

        // Record progress
        await prisma.procurementProgress.create({
            data: {
                procurementId: parseInt(id),
                userId: req.user.id,
                type: 'SYSTEM',
                stage: 2,
                message: `👤 [Penugasan Staf Massal] ${itemIds.length} item pekerjaan ditugaskan kepada ${staffName || 'Belum Ditugaskan'}.`
            }
        });

        // Return updated items
        const updatedItems = await prisma.procurementItem.findMany({
            where: { procurementId: parseInt(id) },
            include: {
                assignedToUser: { select: { id: true, name: true, username: true } },
                category: true,
                vendor: true
            }
        });

        res.json({
            message: `Berhasil menugaskan ${itemIds.length} item kepada ${staffName || 'Petugas'}`,
            items: updatedItems
        });
    } catch (error) {
        console.error("Bulk Assign Staff Error:", error);
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

// Helper to synchronize Procurement BAST state with E-Office OfficeDocument
const syncBastToOfficeDocument = async (procurementId, options = {}) => {
    try {
        const procurement = await prisma.procurement.findUnique({
            where: { id: parseInt(procurementId) },
            include: { unit: true, items: true, user: true }
        });
        if (!procurement) return null;

        // Parse bastFile signatures
        let parsedSigs = {};
        if (procurement.bastFile && typeof procurement.bastFile === 'string' && procurement.bastFile.startsWith('{')) {
            try { parsedSigs = JSON.parse(procurement.bastFile); } catch (e) { }
        } else if (procurement.bastFile) {
            parsedSigs.fileUrl = procurement.bastFile;
        }

        if (options.bastSignatures) {
            parsedSigs = { ...parsedSigs, ...options.bastSignatures };
        }
        if (options.receiverSignature !== undefined) parsedSigs.receiverSignature = options.receiverSignature;
        if (options.receiverName !== undefined) parsedSigs.receiverName = options.receiverName;
        if (options.staffSignature !== undefined) parsedSigs.staffSignature = options.staffSignature;
        if (options.staffName !== undefined) parsedSigs.staffName = options.staffName;
        if (options.kabidTte !== undefined) parsedSigs.kabidTte = options.kabidTte;
        if (options.kabidSignedAt !== undefined) parsedSigs.kabidSignedAt = options.kabidSignedAt;
        if (options.kabidName !== undefined) parsedSigs.kabidName = options.kabidName;
        if (options.kabidPosition !== undefined) parsedSigs.kabidPosition = options.kabidPosition;

        // Find Kepala Bidang Sarana
        let kabidUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { position: 'Kepala Bidang Sarana' },
                    { position: { contains: 'Kepala Bidang Sarana' } },
                    { position: { contains: 'Sarana' } },
                    { position: { contains: 'Kabid' } },
                    { role: 'KEPALA_BIDANG' },
                    { role: 'KABID_SARPRAS' }
                ]
            }
        }) || { id: 1, name: 'Ravi Kurnia, S.T.', position: 'Kepala Bidang Sarana', nip: '-' };

        const isKabidSigned = Boolean(parsedSigs.kabidTte);
        const receiverSig = parsedSigs.receiverSignature || null;
        const receiverName = parsedSigs.receiverName || procurement.receiverName || procurement.user?.name || procurement.user?.username || 'Penerima Barang';

        const effectiveDate = options.bastDate ? new Date(options.bastDate) : (procurement.bastDate || (parsedSigs.bastDate ? new Date(parsedSigs.bastDate) : new Date()));
        const receiverSignedAt = parsedSigs.receiverSignedAt ? new Date(parsedSigs.receiverSignedAt) : (receiverSig ? effectiveDate : null);
        const kabidSignedAt = parsedSigs.kabidSignedAt ? new Date(parsedSigs.kabidSignedAt) : (isKabidSigned ? effectiveDate : null);

        const hasP1 = Boolean(isKabidSigned);
        const hasP2 = Boolean(receiverSig);
        const isCompleted = procurement.status === 'COMPLETED';

        // Document Status: SIGNED if both parties have signed or procurement is COMPLETED
        const docStatus = (hasP1 && hasP2) || isCompleted ? 'SIGNED' : ((hasP1 || hasP2) ? 'PENDING_APPROVAL' : 'DRAFT');

        // Prepare item details for content JSON
        const itemsList = (procurement.items || []).map(it => ({
            name: it.name,
            spec: it.spec || '-',
            brand: it.brand || '',
            qty: it.qty,
            unit: it.unit || 'Unit',
            condition: 'Baik'
        }));

        const contentObj = {
            procurementId: procurement.id,
            procurementCode: procurement.code,
            procurementTitle: procurement.title,
            unitName: procurement.unit?.name || 'Unit Pemohon',
            kabidName: parsedSigs.kabidName || kabidUser.name,
            kabidPosition: parsedSigs.kabidPosition || kabidUser.position || 'Kepala Bidang Sarana',
            unitKerja: 'Bidang Sarana',
            receiverName: receiverName,
            receiverUnit: procurement.unit?.name || 'Unit Pemohon',
            date: effectiveDate.toISOString(),
            warranty: parsedSigs.warranty || null,
            items: itemsList
        };

        // Check if BAST OfficeDocument already exists
        let bastDoc = await prisma.officeDocument.findFirst({
            where: {
                category: 'BAST',
                subject: { contains: procurement.code }
            },
            include: { signedBy: true }
        });

        if (!bastDoc) {
            const docUuid = crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9));
            const docNumber = await generateDocumentNumber('BAST', 'BAST');
            const qrCodeData = await generateVerificationQR(docUuid);

            bastDoc = await prisma.officeDocument.create({
                data: {
                    uuid: docUuid,
                    type: 'BAST',
                    category: 'BAST',
                    number: docNumber,
                    subject: `Berita Acara Serah Terima (BAST): ${procurement.title || procurement.code} (${procurement.code})`,
                    content: JSON.stringify(contentObj),
                    priority: 'BIASA',
                    authorId: kabidUser.id,
                    status: docStatus,
                    signedById: hasP1 ? (options.signerId || kabidUser.id) : null,
                    signedAt: hasP1 ? kabidSignedAt : null,
                    party1Name: parsedSigs.kabidName || kabidUser.name,
                    party1Title: parsedSigs.kabidPosition || kabidUser.position || 'Kepala Bidang Sarana',
                    party1Org: 'Bidang Sarana',
                    party1SignedAt: hasP1 ? kabidSignedAt : null,
                    party2Name: receiverName,
                    party2Title: 'Penerima / Pemohon Barang',
                    party2Org: procurement.unit?.name || 'Unit Pemohon',
                    party2Signature: receiverSig,
                    party2SignedAt: receiverSignedAt,
                    date: effectiveDate,
                    qrCodeData
                },
                include: { signedBy: true }
            });
        } else {
            let existingContent = {};
            try { existingContent = JSON.parse(bastDoc.content || '{}'); } catch (e) { }
            const mergedContent = {
                ...existingContent,
                ...contentObj,
                items: itemsList.length > 0 ? itemsList : (existingContent.items || [])
            };

            const party1SignedAtVal = hasP1 ? (bastDoc.party1SignedAt || kabidSignedAt || effectiveDate) : null;
            const party1SignerId = hasP1 ? (bastDoc.signedById || options.signerId || kabidUser.id) : null;
            const party1SignedAtFinal = hasP1 ? (bastDoc.signedAt || kabidSignedAt || effectiveDate) : null;

            bastDoc = await prisma.officeDocument.update({
                where: { id: bastDoc.id },
                data: {
                    content: JSON.stringify(mergedContent),
                    party1Name: parsedSigs.kabidName || kabidUser.name,
                    party1Title: parsedSigs.kabidPosition || kabidUser.position || 'Kepala Bidang Sarana',
                    party1Org: 'Bidang Sarana',
                    party1SignedAt: party1SignedAtVal,
                    signedById: party1SignerId,
                    signedAt: party1SignedAtFinal,
                    party2Name: receiverName,
                    party2Title: 'Penerima / Pemohon Barang',
                    party2Org: procurement.unit?.name || 'Unit Pemohon',
                    party2Signature: receiverSig || bastDoc.party2Signature || null,
                    party2SignedAt: receiverSignedAt || bastDoc.party2SignedAt || (receiverSig ? effectiveDate : null),
                    status: docStatus,
                    date: effectiveDate
                },
                include: { signedBy: true }
            });
        }

        return bastDoc;
    } catch (err) {
        console.error('syncBastToOfficeDocument error:', err);
        return null;
    }
};
exports.syncBastToOfficeDocument = syncBastToOfficeDocument;

// Update BAST Signatures & Metadata (supports updating anytime or after COMPLETED)
exports.updateBASTSignatures = async (req, res) => {
    const { id } = req.params;
    const { receiverName, staffName, receiverSignature, staffSignature, bastNotes, bastWarranty, warranty, bastDate, photoUrl } = req.body;
    try {
        const procurement = await prisma.procurement.findUnique({
            where: { id: parseInt(id) }
        });
        if (!procurement) return res.status(404).json({ error: 'Pengadaan tidak ditemukan' });

        let existing = {};
        if (procurement.bastFile && typeof procurement.bastFile === 'string' && procurement.bastFile.startsWith('{')) {
            try { existing = JSON.parse(procurement.bastFile); } catch (e) { }
        } else if (procurement.bastFile) {
            existing.fileUrl = procurement.bastFile;
        }

        const effectiveWarranty = bastWarranty !== undefined ? bastWarranty : (warranty !== undefined ? warranty : existing.warranty);

        const updated = {
            ...existing,
            fileUrl: photoUrl !== undefined ? photoUrl : (existing.fileUrl || null),
            receiverName: receiverName !== undefined ? receiverName : (existing.receiverName || null),
            staffName: staffName !== undefined ? staffName : (existing.staffName || null),
            receiverSignature: receiverSignature !== undefined ? receiverSignature : (existing.receiverSignature || null),
            staffSignature: staffSignature !== undefined ? staffSignature : (existing.staffSignature || null),
            notes: bastNotes !== undefined ? bastNotes : (existing.notes || null),
            warranty: effectiveWarranty || null,
            bastDate: bastDate || existing.bastDate || (procurement.bastDate ? procurement.bastDate.toISOString() : null)
        };

        const updateData = {
            bastFile: JSON.stringify(updated)
        };
        if (bastDate) {
            updateData.bastDate = new Date(bastDate);
        }

        await prisma.procurement.update({
            where: { id: parseInt(id) },
            data: updateData
        });

        // Synchronize directly with E-Office OfficeDocument
        const bastDoc = await syncBastToOfficeDocument(id, {
            receiverName: updated.receiverName,
            receiverSignature: updated.receiverSignature,
            staffName: updated.staffName,
            staffSignature: updated.staffSignature,
            bastDate: updated.bastDate
        });

        res.json({ message: 'Tanda tangan BAST berhasil disimpan', bastSignatures: updated, bastDoc });
    } catch (e) {
        console.error('Update BAST Signatures Error:', e);
        res.status(500).json({ error: e.message });
    }
};

// Get or Create BAST Document in E-Office
exports.getOrCreateBASTDocument = async (req, res) => {
    const { id } = req.params;
    const { bastDate, receiverName } = req.body || {};
    try {
        const bastDoc = await syncBastToOfficeDocument(id, { bastDate, receiverName });
        if (!bastDoc) return res.status(404).json({ error: 'Pengadaan tidak ditemukan atau gagal sinkronisasi dokumen' });

        res.json({
            bastDoc,
            verifyUrl: `https://sarpras.dareliman.or.id/verify/${bastDoc.uuid}`
        });
    } catch (e) {
        console.error('getOrCreateBASTDocument Error:', e);
        res.status(500).json({ error: e.message });
    }
};

// Sign BAST by Kepala Bidang Sarana with TTE (Strict Role Access)
exports.signBastKabidTte = async (req, res) => {
    const { id } = req.params;
    const currentUser = req.user;

    const pos = (currentUser?.position || '').toLowerCase();
    const role = (currentUser?.role || '').toUpperCase();
    const isKabid = pos.includes('kepala bidang sarana') || pos.includes('kabid') || role === 'SUPER_ADMIN' || role === 'KEPALA_BIDANG' || role === 'KABID_SARPRAS';

    if (!isKabid) {
        return res.status(403).json({ error: 'Akses ditolak: Hanya Kepala Bidang Sarana yang berwenang membubuhkan TTE Berita Acara (BAST).' });
    }

    try {
        const procurement = await prisma.procurement.findUnique({
            where: { id: parseInt(id) },
            include: { unit: true, items: true, user: true }
        });
        if (!procurement) return res.status(404).json({ error: 'Pengadaan tidak ditemukan' });

        // Identify official Kabid account or current user
        let kabidUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { position: 'Kepala Bidang Sarana' },
                    { position: { contains: 'Kepala Bidang Sarana' } },
                    { role: 'KEPALA_BIDANG' },
                    { role: 'KABID_SARPRAS' }
                ]
            }
        });
        if (!kabidUser || (pos.includes('kepala bidang sarana') || pos.includes('kabid'))) {
            kabidUser = await prisma.user.findUnique({ where: { id: currentUser.id } }) || kabidUser;
        }

        const kabidName = kabidUser?.name || currentUser.name || currentUser.username || 'Ravi Kurnia, S.T.';
        const kabidPosition = kabidUser?.position || 'Kepala Bidang Sarana';
        const now = new Date();

        // Update bastFile in procurement
        let existingSigs = {};
        if (procurement.bastFile && typeof procurement.bastFile === 'string' && procurement.bastFile.startsWith('{')) {
            try { existingSigs = JSON.parse(procurement.bastFile); } catch (e) { }
        } else if (procurement.bastFile) {
            existingSigs.fileUrl = procurement.bastFile;
        }

        const updatedSigs = {
            ...existingSigs,
            kabidTte: true,
            kabidSignedAt: now.toISOString(),
            kabidName,
            kabidPosition,
            kabidOrg: 'Bidang Sarana dan Prasarana',
            kabidNip: kabidUser?.nip || '-'
        };

        await prisma.procurement.update({
            where: { id: parseInt(id) },
            data: {
                bastFile: JSON.stringify(updatedSigs)
            }
        });

        // Check and sync BAST OfficeDocument
        const bastDoc = await syncBastToOfficeDocument(id, {
            signerId: kabidUser?.id || currentUser.id,
            kabidTte: true,
            kabidSignedAt: now.toISOString(),
            kabidName,
            kabidPosition
        });

        // Timeline Progress Log
        await prisma.procurementProgress.create({
            data: {
                procurementId: procurement.id,
                userId: currentUser.id,
                message: `🛡️ Kepala Bidang Sarana (*${kabidName}*) telah membubuhkan Tanda Tangan Elektronik (TTE) sah pada Berita Acara Serah Terima (BAST)`,
                type: 'SYSTEM',
                stage: 5
            }
        });

        res.json({
            message: 'TTE Kepala Bidang Sarana berhasil dibubuhkan pada BAST.',
            bastSignatures: updatedSigs,
            bastDoc
        });
    } catch (error) {
        console.error('signBastKabidTte error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Cancel / Revoke BAST TTE by Kepala Bidang Sarana
exports.cancelBastKabidTte = async (req, res) => {
    const { id } = req.params;
    const currentUser = req.user;

    const pos = (currentUser?.position || '').toLowerCase();
    const role = (currentUser?.role || '').toUpperCase();
    const isKabid = pos.includes('kepala bidang sarana') || pos.includes('kabid') || role === 'SUPER_ADMIN' || role === 'KEPALA_BIDANG' || role === 'KABID_SARPRAS';

    if (!isKabid) {
        return res.status(403).json({ error: 'Akses ditolak: Hanya Kepala Bidang Sarana yang berwenang membatalkan TTE BAST.' });
    }

    try {
        const procurement = await prisma.procurement.findUnique({
            where: { id: parseInt(id) }
        });
        if (!procurement) return res.status(404).json({ error: 'Pengadaan tidak ditemukan' });

        let existingSigs = {};
        if (procurement.bastFile && typeof procurement.bastFile === 'string' && procurement.bastFile.startsWith('{')) {
            try { existingSigs = JSON.parse(procurement.bastFile); } catch (e) { }
        }

        const updatedSigs = {
            ...existingSigs,
            kabidTte: false,
            kabidSignedAt: null
        };

        await prisma.procurement.update({
            where: { id: parseInt(id) },
            data: {
                bastFile: JSON.stringify(updatedSigs)
            }
        });

        const bastDoc = await syncBastToOfficeDocument(id, {
            kabidTte: false,
            kabidSignedAt: null
        });

        // Timeline Progress Log
        await prisma.procurementProgress.create({
            data: {
                procurementId: procurement.id,
                userId: currentUser.id,
                message: `⚠️ TTE Kepala Bidang Sarana pada Dokumen BAST telah dibatalkan oleh *${currentUser.name || currentUser.username}*`,
                type: 'SYSTEM',
                stage: 5
            }
        });

        res.json({
            message: 'TTE BAST berhasil dibatalkan.',
            bastSignatures: updatedSigs,
            bastDoc
        });
    } catch (error) {
        console.error('cancelBastKabidTte error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Process BAST & Auto-Asset Creation
exports.processBAST = async (req, res) => {
    const { id } = req.params;
    let { bastDate, bastFile, assetDetails, warehouseFulfillments, receiverName, staffName, receiverSignature, staffSignature, bastSignatures, bastPhotoUrl, bastNotes, bastWarranty, warranty } = req.body;

    if (typeof assetDetails === 'string') {
        try { assetDetails = JSON.parse(assetDetails); } catch (e) { }
    }
    // warehouseFulfillments: [{ procurementItemId, invItemId, warehouseId, quantity }]
    if (typeof warehouseFulfillments === 'string') {
        try { warehouseFulfillments = JSON.parse(warehouseFulfillments); } catch (e) { warehouseFulfillments = []; }
    }
    if (!Array.isArray(warehouseFulfillments)) warehouseFulfillments = [];

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

        let parsedSigs = {};
        if (procurement.bastFile && typeof procurement.bastFile === 'string' && procurement.bastFile.startsWith('{')) {
            try { parsedSigs = JSON.parse(procurement.bastFile); } catch (e) { }
        }
        if (typeof bastSignatures === 'string') {
            try { parsedSigs = { ...parsedSigs, ...JSON.parse(bastSignatures) }; } catch (e) { }
        } else if (typeof bastSignatures === 'object' && bastSignatures !== null) {
            parsedSigs = { ...parsedSigs, ...bastSignatures };
        }

        const finalReceiverName = receiverName || parsedSigs.receiverName || null;
        const finalStaffName = staffName || parsedSigs.staffName || null;
        const finalReceiverSignature = receiverSignature || parsedSigs.receiverSignature || null;
        const finalStaffSignature = staffSignature || parsedSigs.staffSignature || null;
        const finalNotes = bastNotes || parsedSigs.notes || null;
        const finalWarranty = bastWarranty || warranty || parsedSigs.warranty || null;
        const finalPhotoUrl = req.fileUrl || bastPhotoUrl || (typeof bastFile === 'string' && !bastFile.startsWith('{') && !bastFile.startsWith('data:') ? bastFile : null);

        let bastPayload = null;
        if (finalReceiverName || finalStaffName || finalReceiverSignature || finalStaffSignature || finalNotes || finalWarranty || parsedSigs.kabidTte) {
            bastPayload = JSON.stringify({
                ...parsedSigs,
                fileUrl: finalPhotoUrl || parsedSigs.fileUrl || null,
                receiverName: finalReceiverName,
                staffName: finalStaffName,
                receiverSignature: finalReceiverSignature,
                staffSignature: finalStaffSignature,
                notes: finalNotes,
                warranty: finalWarranty,
                bastDate: bastDate
            });
        } else {
            bastPayload = finalPhotoUrl || bastFile || null;
        }

        await prisma.$transaction(async (prisma) => {
            // 1. Update Procurement Status
            await prisma.procurement.update({
                where: { id: parseInt(id) },
                data: {
                    status: 'COMPLETED',
                    bastDate: new Date(bastDate),
                    bastFile: bastPayload
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
                                specification: finalWarranty ? `${item.spec || ''} [Garansi: ${finalWarranty}]`.trim() : item.spec,
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

            // 3. Process Warehouse Fulfillments (create OUT stock transactions)
            for (const fulfillment of warehouseFulfillments) {
                const { invItemId, warehouseId, quantity } = fulfillment;
                if (!invItemId || !warehouseId || !quantity) continue;

                // Check stock availability
                const stock = await prisma.invStock.findUnique({
                    where: { itemId_warehouseId: { itemId: parseInt(invItemId), warehouseId: parseInt(warehouseId) } }
                });
                if (!stock || stock.quantity < parseInt(quantity)) {
                    throw new Error(`Stok gudang tidak mencukupi untuk item ID ${invItemId}. Tersedia: ${stock?.quantity || 0}, diminta: ${quantity}`);
                }

                // Generate unique transaction code
                const trxYear = new Date().getFullYear();
                const lastTrx = await prisma.invStockTransaction.findFirst({
                    where: { code: { startsWith: `OUT/${trxYear}/` } },
                    orderBy: { code: 'desc' }
                });
                let nextSeq = 1;
                if (lastTrx) {
                    const parts = lastTrx.code.split('/');
                    nextSeq = (parseInt(parts[2]) || 0) + 1;
                }
                const trxCode = `OUT/${trxYear}/${nextSeq.toString().padStart(4, '0')}`;

                // Deduct stock
                await prisma.invStock.update({
                    where: { itemId_warehouseId: { itemId: parseInt(invItemId), warehouseId: parseInt(warehouseId) } },
                    data: { quantity: { decrement: parseInt(quantity) } }
                });

                // Create OUT transaction record
                await prisma.invStockTransaction.create({
                    data: {
                        code: trxCode,
                        type: 'OUT',
                        date: new Date(bastDate),
                        itemId: parseInt(invItemId),
                        warehouseId: parseInt(warehouseId),
                        quantity: parseInt(quantity),
                        note: `Pemenuhan Pengadaan: ${procurement.code} — ${procurement.title || ''}`,
                        createdById: req.user.id
                    }
                });
            }
        });

        // Synchronize BAST OfficeDocument to SIGNED state
        await syncBastToOfficeDocument(id, { bastDate });

        const appUrl = process.env.CLIENT_URL || process.env.BASE_URL || 'https://sarpras.dareliman.or.id';
        const targetAsetUrl = procurement.unitId ? `/aset?unitId=${procurement.unitId}` : '/aset';

        // --- In-App Notification: Minta pemesan memilih ruangan aset ---
        await createNotification(
            procurement.userId,
            'Pengadaan Selesai (BAST) — Silakan Pilih Ruangan Aset',
            `Proses serah terima (BAST) untuk pengadaan "${procurement.title || procurement.code}" telah selesai dan aset telah tercatat. Mohon segera tentukan/pilih ruangan penempatan aset di unit Anda.`,
            'SUCCESS',
            targetAsetUrl
        );

        // --- Web Push Notification ---
        sendPushToUser(
            procurement.userId,
            'Pengadaan Selesai (BAST) — Pilih Ruangan Aset',
            `Pengadaan "${procurement.title || procurement.code}" telah selesai BAST. Silakan tentukan ruangan penempatan aset yang dibeli.`,
            targetAsetUrl
        ).catch(err => console.error('[Push BAST Error]:', err.message));

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

                const appAsetUrl = `${appUrl}${targetAsetUrl}`;

                const msg = `Bismillah.\n*Info Request Pengadaan (SiMas)*\n\n` +
                    `Ustadz/Ustadzah *${submitter.name || submitter.username}*,\n` +
                    `Pengadaan barang Anda *"${procurement.title || procurement.code}"* telah melewati tahap *SERAH TERIMA (BAST)* \u2705\u2705\u2705\n\n` +
                    `*Rincian Barang:*\n${itemList}\n\n` +
                    `\uD83D\uDCCD *Tindakan Diperlukan:*\n` +
                    `Barang telah resmi diterima dan terdaftar sebagai aset unit Anda. *Mohon segera pilih/tentukan ruangan penempatan aset yang dibeli* melalui tautan sistem SiMas berikut:\n` +
                    `\uD83D\uDD17 ${appAsetUrl}\n\n` +
                    `Syukron, Jazaakumullahu Khairan.`;

                setTimeout(async () => {
                    try {
                        await whatsappService.sendMessage(submitter.phone, msg);
                        console.log(`[WA] BAST room assignment notification sent to ${submitter.username}`);
                    } catch (e) {
                        console.error('[WA] Failed BAST notification:', e);
                    }
                }, 3000);
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
    const { message, stage, type } = req.body;
    const user = req.user;

    try {
        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Pesan progress tidak boleh kosong.' });
        }

        const procurement = await prisma.procurement.findUnique({
            where: { id: parseInt(id) },
            include: {
                items: true,
                user: { select: { id: true, name: true, username: true, phone: true } }
            }
        });
        if (!procurement) return res.status(404).json({ error: 'Pengadaan tidak ditemukan.' });

        const progressType = type || 'MANUAL';
        const progress = await prisma.procurementProgress.create({
            data: {
                procurementId: parseInt(id),
                userId: user.id,
                message: message.trim(),
                type: progressType,
                stage: stage ? parseInt(stage) : null
            },
            include: {
                user: { select: { id: true, name: true, username: true, role: true } }
            }
        });

        // --- Notifikasi Pintar (Smart Notifications) ---
        (async () => {
            try {
                const isUserReporter = procurement.userId === user.id;
                const senderName = progress.user?.name || progress.user?.username || 'Seseorang';
                const isStageUpdate = progressType === 'STAGE_PROGRESS';
                const notifMsg = isStageUpdate
                    ? `[Update ${stage ? 'Tahap ' + stage : 'Progres'}] ${senderName} mencatat: "${message}"`
                    : `[Chat Baru] ${senderName} membalas di pengadaan "${procurement.title || procurement.code}": "${message}"`;
                const baseUrl = process.env.BASE_URL || 'https://sarpras.dareliman.or.id';
                const procurementUrl = `${baseUrl}/procurements/${id}`;

                // --- MENTION LOGIC ---
                const mentionedTags = [...new Set(message.match(/@([a-zA-Z0-9_.-]+)/g)?.map(m => m.slice(1)) || [])];
                let mentionedUsers = [];
                if (mentionedTags.length > 0) {
                    const allUsers = await prisma.user.findMany();
                    mentionedUsers = allUsers.filter(u => {
                        const uMention = (u.name || u.username || '').replace(/\s+/g, '_').toLowerCase();
                        const uUsername = (u.username || '').toLowerCase();
                        return mentionedTags.some(tag => {
                            const t = tag.toLowerCase();
                            return t === uMention || t === uUsername;
                        });
                    });
                }
                const mentionedUserIds = mentionedUsers.map(u => u.id);

                for (const mUser of mentionedUsers) {
                    if (mUser.id === user.id) continue; // Don't notify self
                    await createNotification(mUser.id, 'Anda Di-mention (Pengadaan)', notifMsg, 'INFO', `/procurements/${id}`);
                    if (mUser.phone) {
                        const waMsg = `Bismillah.\n💬 *ANDA DI-MENTION (PENGADAAN)*\n\n` +
                            `*${senderName}* menyebut Anda pada pengadaan *${procurement.code}*:\n` +
                            `"${message}"\n\n` +
                            `Cek selengkapnya: ${procurementUrl}`;
                        whatsappService.sendMessage(mUser.phone, waMsg).catch(e => console.error(e));
                    }
                }

                if (isUserReporter) {
                    const lastAdminMessage = await prisma.procurementProgress.findFirst({
                        where: {
                            procurementId: parseInt(id),
                            userId: { not: user.id }
                        },
                        orderBy: { createdAt: 'desc' },
                        include: { user: true }
                    });

                    let notifRecipients = [];

                    if (lastAdminMessage && lastAdminMessage.user) {
                        notifRecipients.push(lastAdminMessage.user);
                    } else {
                        const waRoles = [
                            { position: { contains: 'Kepala Bidang Sarana' } },
                            { position: { contains: 'Staff Manajemen Aset' } }
                        ];
                        notifRecipients = await prisma.user.findMany({
                            where: { OR: waRoles }
                        });
                    }

                    for (const admin of notifRecipients) {
                        if (mentionedUserIds.includes(admin.id)) continue;
                        await createNotification(admin.id, 'Pesan Baru Pengadaan', notifMsg, 'INFO', `/procurements/${id}`);
                        if (admin.phone) {
                            const waMsg = `Bismillah.\n💬 *PESAN BARU (PENGADAAN)*\n\n` +
                                `Pemohon *${senderName}* membalas pada pengadaan *${procurement.code}*:\n` +
                                `"${message}"\n\n` +
                                `Cek selengkapnya: ${procurementUrl}`;
                            whatsappService.sendMessage(admin.phone, waMsg).catch(e => console.error(e));
                        }
                    }

                    const assigneeIds = [...new Set(procurement.items.map(it => it.assignedToId).filter(id => id))];
                    for (const assigneeId of assigneeIds) {
                        if (mentionedUserIds.includes(assigneeId)) continue;
                        const isAlreadyNotified = notifRecipients.some(r => r.id === assigneeId);
                        if (!isAlreadyNotified) {
                            const assigneeUser = await prisma.user.findUnique({ where: { id: assigneeId } });
                            if (assigneeUser && assigneeUser.phone) {
                                await createNotification(assigneeUser.id, 'Pesan Baru Pengadaan', notifMsg, 'INFO', `/procurements/${id}`);
                                const waMsg = `Bismillah.\n💬 *PESAN BARU (PENGADAAN)*\n\n` +
                                    `Pemohon *${senderName}* membalas pada pengadaan *${procurement.code}* (Anda ditugaskan pada item pengadaan ini):\n` +
                                    `"${message}"\n\n` +
                                    `Cek selengkapnya: ${procurementUrl}`;
                                whatsappService.sendMessage(assigneeUser.phone, waMsg).catch(e => console.error(e));
                            }
                        }
                    }

                } else {
                    if (!mentionedUserIds.includes(procurement.userId)) {
                        await createNotification(procurement.userId, 'Pesan Baru Pengadaan', notifMsg, 'INFO', `/procurements/${id}`);

                        if (procurement.user?.phone) {
                            const waMsg = `Bismillah.\n💬 *PESAN BARU (PENGADAAN)*\n\n` +
                                `Admin/Petugas *${senderName}* membalas pengajuan pengadaan Anda *${procurement.code}*:\n` +
                                `"${message}"\n\n` +
                                `Cek selengkapnya: ${procurementUrl}`;
                            whatsappService.sendMessage(procurement.user.phone, waMsg).catch(e => console.error(e));
                        }
                    }
                }
            } catch (err) {
                console.error('Progress WA Error:', err);
            }
        })();

        res.status(201).json(progress);
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

/**
 * GET /api/procurements/public/head-unit-approval/:batchId
 * Public endpoint to fetch letter and all items under batchId for Kepala Unit approval
 */
exports.getHeadUnitApprovalData = async (req, res) => {
    const { batchId } = req.params;
    const cleanBatchId = (batchId || '').trim();
    try {
        const letterProgress = await prisma.procurementProgress.findFirst({
            where: {
                message: { contains: cleanBatchId }
            },
            include: {
                procurement: {
                    include: {
                        unit: true,
                        user: { select: { id: true, name: true, username: true, phone: true } }
                    }
                }
            }
        });

        if (!letterProgress) {
            return res.status(404).json({ error: 'Permohonan pengadaan tidak ditemukan atau tautan tidak valid.' });
        }

        let letterData = {};
        try {
            letterData = JSON.parse(letterProgress.message.replace('[SURAT_PERMOHONAN]', '').trim());
        } catch (e) { }

        res.json({
            batchId,
            letterData,
            unit: letterProgress.procurement?.unit,
            requester: letterProgress.procurement?.user,
            isApproved: !!letterData.headUnitSignature,
            approvedAt: letterData.headUnitApprovedAt || null
        });
    } catch (error) {
        console.error('getHeadUnitApprovalData error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * POST /api/procurements/public/head-unit-approval/:batchId
 * Public endpoint for Kepala Unit to sign and approve the batch of procurements
 */
exports.processHeadUnitApproval = async (req, res) => {
    const { batchId } = req.params;
    const cleanBatchId = (req.body.batchId || req.body.letterNumber || batchId || '').trim();
    const { signature, headUnitName, procurementId, letterNumber } = req.body;

    if (!signature) {
        return res.status(400).json({ error: 'Tanda tangan Kepala Unit wajib dibubuhkan.' });
    }

    try {
        let orConditions = [];
        if (cleanBatchId && cleanBatchId !== 'approval') {
            orConditions.push({ message: { contains: cleanBatchId } });
        }
        if (letterNumber && letterNumber.trim() && letterNumber.trim() !== cleanBatchId) {
            orConditions.push({ message: { contains: letterNumber.trim() } });
        }
        if (req.body.batchId && req.body.batchId.trim() && req.body.batchId.trim() !== cleanBatchId) {
            orConditions.push({ message: { contains: req.body.batchId.trim() } });
        }
        if (procurementId) {
            orConditions.push({ procurementId: parseInt(procurementId), type: 'LETTER' });
            orConditions.push({ procurementId: parseInt(procurementId), message: { startsWith: '[SURAT_PERMOHONAN]' } });
        }

        const progressEntries = await prisma.procurementProgress.findMany({
            where: orConditions.length > 0 ? { OR: orConditions } : { message: { contains: cleanBatchId } },
            include: {
                procurement: {
                    include: {
                        user: true,
                        unit: true,
                        items: true
                    }
                }
            }
        });

        if (progressEntries.length === 0) {
            return res.status(404).json({ error: 'Permohonan pengadaan tidak ditemukan.' });
        }

        const approvedAt = new Date().toISOString();
        let commonLetterData = null;
        const procurementIds = [];

        for (const entry of progressEntries) {
            procurementIds.push(entry.procurementId);
            let letterData = {};
            try {
                letterData = JSON.parse(entry.message.replace('[SURAT_PERMOHONAN]', '').trim());
            } catch (e) { }

            letterData.headUnitSignature = signature;
            letterData.headUnitApprovedAt = approvedAt;
            if (headUnitName) letterData.headUnitName = headUnitName;
            commonLetterData = letterData;

            // Update Progress record
            await prisma.procurementProgress.update({
                where: { id: entry.id },
                data: {
                    message: `[SURAT_PERMOHONAN] ${JSON.stringify(letterData)}`
                }
            });

            // Update Procurement Status to SUBMITTED if in initial/pending stages
            if (['PENDING_HEAD_UNIT', 'DRAFT', 'PENDING'].includes(entry.procurement?.status)) {
                await prisma.procurement.update({
                    where: { id: entry.procurementId },
                    data: { status: 'SUBMITTED' }
                });
            }
        }

        // --- Send Consolidated WhatsApp Notification to Kabid Sarpras & Staff Aset ---
        (async () => {
            try {
                const firstProc = progressEntries[0]?.procurement;
                const submitterName = firstProc?.user?.name || firstProc?.user?.username || 'Pemohon';
                const unitName = firstProc?.unit?.name || 'Unit Pemohon';
                const clientUrl = process.env.CLIENT_URL || process.env.BASE_URL || 'https://sarpras.dareliman.or.id';

                const itemsList = (commonLetterData?.items || []).map((it, idx) =>
                    `${idx + 1}. *${it.name}* (${it.qty} ${it.unit})` + (it.spec && it.spec !== '-' ? ` - ${it.spec}` : '')
                ).join('\n');

                const admins = await prisma.user.findMany({
                    where: {
                        OR: [
                            { position: 'Kepala Bidang Sarana' },
                            { position: 'Staff Manajemen Aset' },
                            { position: 'Staff Keuangan dan Administrasi' }
                        ],
                        phone: { not: null, not: '' }
                    }
                });

                if (admins.length > 0) {
                    const msgAdm = `Bismillah.\n*Info Permohonan Pengadaan Baru (Disetujui Kepala Unit)* ✅\n\n` +
                        `Pengajuan telah ditandatangani oleh Kepala Unit *${headUnitName || commonLetterData?.headUnitName || 'Kepala Unit'}*:\n` +
                        `📄 *No. Surat* : ${commonLetterData?.letterNumber || '-'}\n` +
                        `👤 *Pemohon* : ${submitterName}\n` +
                        `🏢 *Unit* : ${unitName}\n` +
                        `📋 *Perihal* : ${commonLetterData?.title || 'Pengadaan Barang'}\n\n` +
                        `*Rincian Barang:*\n` +
                        `${itemsList}\n\n` +
                        `🔗 Detail: ${clientUrl}/procurements/${firstProc?.id || ''}\n\n` +
                        `Mohon segera diproses oleh Bagian Sarpras. Syukron.`;

                    for (const admin of admins) {
                        try {
                            await whatsappService.sendMessage(admin.phone, msgAdm);
                        } catch (e) {
                            console.error(`Failed sending to admin ${admin.username}:`, e);
                        }
                    }
                }
            } catch (err) {
                console.error('Error sending WA after head unit approval:', err);
            }
        })();

        res.json({
            message: 'Permohonan berhasil disetujui dan tanda tangan berhasil disimpan.',
            batchId: cleanBatchId,
            approvedAt,
            procurementIds,
            letterData: commonLetterData
        });
    } catch (error) {
        console.error('processHeadUnitApproval error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * PUT /api/procurements/:id/request-letter
 * Authenticated endpoint to update request letter metadata (e.g. TTE Kabid, signatures, etc.)
 */
exports.updateRequestLetter = async (req, res) => {
    const { id } = req.params;
    const { kabidTte, kabidName, headUnitSignature, headUnitName, requesterSignature } = req.body;

    try {
        const letterProgress = await prisma.procurementProgress.findFirst({
            where: {
                procurementId: parseInt(id),
                type: 'LETTER'
            }
        });

        if (!letterProgress) {
            return res.status(404).json({ error: 'Data surat permohonan tidak ditemukan.' });
        }

        let letterData = {};
        try {
            letterData = JSON.parse(letterProgress.message.replace('[SURAT_PERMOHONAN]', '').trim());
        } catch (e) { }

        if (kabidTte !== undefined) {
            letterData.kabidTte = !!kabidTte;
            letterData.kabidTteAt = kabidTte ? new Date().toISOString() : null;
        }
        if (kabidName) letterData.kabidName = kabidName;
        if (headUnitSignature !== undefined) letterData.headUnitSignature = headUnitSignature;
        if (headUnitName) letterData.headUnitName = headUnitName;
        if (requesterSignature !== undefined) letterData.requesterSignature = requesterSignature;

        // If part of batch, update all progress in batch
        if (letterData.batchId) {
            const batchEntries = await prisma.procurementProgress.findMany({
                where: {
                    type: 'LETTER',
                    message: { contains: `"${letterData.batchId}"` }
                }
            });
            for (const bEntry of batchEntries) {
                await prisma.procurementProgress.update({
                    where: { id: bEntry.id },
                    data: {
                        message: `[SURAT_PERMOHONAN] ${JSON.stringify(letterData)}`
                    }
                });
            }
        } else {
            await prisma.procurementProgress.update({
                where: { id: letterProgress.id },
                data: {
                    message: `[SURAT_PERMOHONAN] ${JSON.stringify(letterData)}`
                }
            });
        }

        res.json({
            message: 'Surat permohonan berhasil diperbarui.',
            requestLetter: letterData
        });
    } catch (error) {
        console.error('updateRequestLetter error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ==================== SURAT PERINTAH PENGADAAN (ASSIGNMENT ORDERS) ====================

/**
 * Helper to identify the assigner based on authorization rules:
 * - Only Kepala Bidang Sarana or Staff Manajemen Aset can give assignment.
 * - If Staff Manajemen Aset assigns themselves, assigner is automatically Kepala Bidang Sarana.
 */
const resolveAssigner = async (currentUser, assigneeId) => {
    const pos = (currentUser?.position || '').toLowerCase();
    const role = (currentUser?.role || '').toUpperCase();
    const isKabid = pos.includes('kepala bidang sarana') || role === 'SUPER_ADMIN' || role === 'KEPALA_BIDANG' || role === 'KABID_SARPRAS';
    const isStaffAset = pos.includes('staff manajemen aset') || role === 'ADMIN_ASET';

    if (!isKabid && !isStaffAset) {
        throw new Error('Hanya Kepala Bidang Sarana atau Staff Manajemen Aset yang berwenang memberikan surat perintah penugasan.');
    }

    // Selalu prioritaskan akun resmi Kepala Bidang Sarana dari database
    let kabidUser = await prisma.user.findFirst({
        where: {
            OR: [
                { position: 'Kepala Bidang Sarana' },
                { position: { contains: 'Kepala Bidang Sarana' } }
            ]
        }
    });

    // Jika currentUser memang Kepala Bidang Sarana, ambil data lengkapnya dari DB
    if (currentUser?.id) {
        const fullCurrent = await prisma.user.findUnique({ where: { id: currentUser.id } });
        const curPos = (fullCurrent?.position || '').toLowerCase();
        if (curPos.includes('kepala bidang sarana')) {
            kabidUser = fullCurrent;
        }
    }

    if (kabidUser) {
        return {
            id: kabidUser.id,
            name: kabidUser.name || kabidUser.username || '',
            nip: kabidUser.nip || '-',
            position: 'Kepala Bidang Sarana'
        };
    }

    // Fallback jika belum ada record akun Kepala Bidang Sarana di DB
    let fallbackUser = null;
    if (currentUser?.id) {
        fallbackUser = await prisma.user.findUnique({ where: { id: currentUser.id } });
    }

    return {
        id: fallbackUser?.id || currentUser?.id || null,
        name: fallbackUser?.name || fallbackUser?.username || currentUser?.name || currentUser?.username || '',
        nip: fallbackUser?.nip || currentUser?.nip || '-',
        position: 'Kepala Bidang Sarana'
    };
};

/**
 * GET /api/procurements/:id/assignment-orders
 * Get assignment orders for a procurement
 */
exports.getAssignmentOrders = async (req, res) => {
    const { id } = req.params;
    try {
        const procurement = await prisma.procurement.findUnique({
            where: { id: parseInt(id) },
            include: {
                items: true,
                unit: true,
                user: true,
                progress: {
                    where: { type: 'ASSIGNMENT_ORDER' },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!procurement) return res.status(404).json({ error: 'Pengadaan tidak ditemukan.' });

        // Parse existing assignment orders
        const orders = [];
        let defaultKabid = null;
        for (const p of procurement.progress) {
            try {
                const data = JSON.parse(p.message.replace('[SURAT_PERINTAH]', '').trim());
                // Pastikan nama dan NIY pemberi tugas diambil dari User yang berposisi Kepala Bidang Sarana
                if (!data.assigner?.name || data.assigner.name === 'Pemberi Tugas' || data.assigner.name === 'Kepala Bidang Sarana' || !data.assigner.nip) {
                    if (!defaultKabid) {
                        defaultKabid = await prisma.user.findFirst({
                            where: {
                                OR: [
                                    { position: 'Kepala Bidang Sarana' },
                                    { position: { contains: 'Kepala Bidang Sarana' } }
                                ]
                            }
                        });
                    }
                    if (defaultKabid) {
                        data.assigner = {
                            ...(data.assigner || {}),
                            id: defaultKabid.id,
                            name: defaultKabid.name || defaultKabid.username || '',
                            nip: defaultKabid.nip || '-',
                            position: 'Kepala Bidang Sarana'
                        };
                    } else {
                        data.assigner = {
                            ...(data.assigner || {}),
                            name: data.assigner?.name || '',
                            nip: data.assigner?.nip || '-',
                            position: 'Kepala Bidang Sarana'
                        };
                    }
                }

                // Pastikan verifyUrl dan qrCodeData selalu tersedia untuk scan verifikasi
                if (!data.verifyUrl && data.uuid) {
                    data.verifyUrl = `https://sarpras.dareliman.or.id/verify/${data.uuid}`;
                }

                if (!data.qrCodeData && (data.verifyUrl || data.uuid)) {
                    if (data.officeDocumentId) {
                        try {
                            const offDoc = await prisma.officeDocument.findUnique({
                                where: { id: data.officeDocumentId },
                                select: { qrCodeData: true }
                            });
                            if (offDoc?.qrCodeData) {
                                data.qrCodeData = offDoc.qrCodeData;
                            }
                        } catch (docErr) { }
                    }
                    if (!data.qrCodeData) {
                        try {
                            const vUrl = data.verifyUrl || `https://sarpras.dareliman.or.id/verify/${data.uuid}`;
                            data.qrCodeData = await generateVerificationQR(vUrl);
                        } catch (qrErr) { }
                    }
                }

                orders.push({
                    ...data,
                    progressId: p.id,
                    createdAt: p.createdAt
                });
            } catch (e) { }
        }

        res.json(orders);
    } catch (error) {
        console.error('getAssignmentOrders error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * POST /api/procurements/:id/assignment-orders
 * Create and issue Surat Perintah Pengadaan with E-Office integration
 */
exports.createAssignmentOrder = async (req, res) => {
    const { id } = req.params;
    const { assigneeId, itemIds, instructions, notes } = req.body;
    const currentUser = req.user;

    try {
        if (!assigneeId) {
            return res.status(400).json({ error: 'Petugas yang ditugaskan (assigneeId) wajib dipilih.' });
        }

        const procurement = await prisma.procurement.findUnique({
            where: { id: parseInt(id) },
            include: {
                items: true,
                unit: true,
                user: true,
                progress: {
                    where: { type: 'LETTER' },
                    take: 1
                }
            }
        });

        if (!procurement) return res.status(404).json({ error: 'Pengadaan tidak ditemukan.' });

        const assignee = await prisma.user.findUnique({
            where: { id: parseInt(assigneeId) },
            include: { unit: true }
        });
        if (!assignee) return res.status(404).json({ error: 'Petugas tidak ditemukan.' });

        // Identify assigner based on strict authorization rules
        const assigner = await resolveAssigner(currentUser, assignee.id);

        // Filter items for this order
        let assignedItems = procurement.items.filter(it => it.assignedToId === assignee.id);
        if (itemIds && Array.isArray(itemIds) && itemIds.length > 0) {
            const idSet = new Set(itemIds.map(i => parseInt(i)));
            assignedItems = procurement.items.filter(it => idSet.has(it.id));
        }

        if (assignedItems.length === 0) {
            if (itemIds && Array.isArray(itemIds) && itemIds.length > 0) {
                const idSet = new Set(itemIds.map(i => parseInt(i)));
                assignedItems = procurement.items.filter(it => idSet.has(it.id));
            } else {
                assignedItems = procurement.items;
            }
        }

        // Get Letter reference if available
        let requestLetterNumber = '-';
        if (procurement.progress && procurement.progress.length > 0) {
            try {
                const lData = JSON.parse(procurement.progress[0].message.replace('[SURAT_PERMOHONAN]', '').trim());
                if (lData.letterNumber) requestLetterNumber = lData.letterNumber;
            } catch (e) { }
        }

        // Generate E-Office Document Number for Category 'Perintah'
        const docNumber = await generateDocumentNumber('Perintah', 'SURAT_KELUAR');
        const docUuid = crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9));
        const qrCodeData = await generateVerificationQR(docUuid);
        const baseUrl = process.env.BASE_URL || 'https://sarpras.dareliman.or.id';
        const verifyUrl = `${baseUrl}/verify/${docUuid}`;

        const defaultInstructions = [
            'Melaksanakan survei pasar, pemilihan vendor pembanding, dan negosiasi harga terbaik.',
            'Memastikan mutu, spesifikasi teknis, dan waktu pengiriman sesuai kebutuhan unit pemohon.',
            'Mengunggah bukti transaksi/penawaran serta menyelesaikan proses Berita Acara Serah Terima (BAST).'
        ];

        const orderId = 'SPO-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

        const orderData = {
            orderId,
            uuid: docUuid,
            orderNumber: docNumber,
            procurementId: procurement.id,
            procurementCode: procurement.code,
            procurementTitle: procurement.title,
            unitName: procurement.unit?.name || 'Unit Pemohon',
            requestLetterNumber,
            createdAt: new Date().toISOString(),
            assigner: {
                id: assigner.id,
                name: assigner.name || assigner.username || '',
                nip: assigner.nip || '-',
                position: 'Kepala Bidang Sarana'
            },
            assignee: {
                id: assignee.id,
                name: assignee.name || assignee.username,
                nip: assignee.nip || assignee.username || '-',
                position: assignee.position || 'Staff Pelaksana',
                unitName: assignee.unit?.name || 'Bidang Sarana dan Prasarana'
            },
            items: assignedItems.map(it => ({
                id: it.id,
                name: it.name,
                spec: it.spec || '-',
                qty: it.qty,
                unit: it.unit,
                estPrice: it.estPrice,
                notes: it.notes || ''
            })),
            instructions: (instructions && Array.isArray(instructions) && instructions.length > 0) ? instructions : defaultInstructions,
            notes: notes || '',
            assignerTte: true,
            assignerTteAt: new Date().toISOString(),
            qrCodeData,
            verifyUrl,
            assigneeSignature: null,
            assigneeSignedAt: null
        };

        // 1. Create OfficeDocument in E-Office (Surat Keluar)
        const officeDoc = await prisma.officeDocument.create({
            data: {
                uuid: docUuid,
                type: 'SURAT_KELUAR',
                category: 'Perintah',
                number: docNumber,
                subject: `Surat Perintah Pengadaan: ${procurement.title || procurement.code} (${assignee.name || assignee.username})`,
                content: JSON.stringify(orderData),
                priority: 'BIASA',
                authorId: assigner.id,
                status: 'SIGNED',
                signedById: assigner.id,
                signedAt: new Date(),
                qrCodeData
            }
        });

        orderData.officeDocumentId = officeDoc.id;
        try {
            await prisma.officeDocument.update({
                where: { id: officeDoc.id },
                data: { content: JSON.stringify(orderData) }
            });
        } catch (e) {
            console.error('Failed to update officeDoc content with id:', e);
        }

        // 2. Save in ProcurementProgress
        await prisma.procurementProgress.create({
            data: {
                procurementId: procurement.id,
                userId: currentUser.id,
                message: `[SURAT_PERINTAH] ${JSON.stringify(orderData)}`,
                type: 'ASSIGNMENT_ORDER',
                stage: 2
            }
        });

        // 3. Make sure the items are assigned to this staff in DB
        for (const item of assignedItems) {
            await prisma.procurementItem.update({
                where: { id: item.id },
                data: {
                    assignedToId: assignee.id,
                    assignedTo: assignee.name || assignee.username
                }
            });
        }

        // 4. Send WhatsApp Notification to the Assigned Staff
        if (assignee.phone) {
            (async () => {
                try {
                    const clientUrl = process.env.CLIENT_URL || process.env.BASE_URL || 'https://sarpras.dareliman.or.id';
                    const signUrl = `${clientUrl}/public/perintah-pengadaan/${orderId}`;
                    const itemsText = assignedItems.map((it, idx) => `${idx + 1}. *${it.name}* (${it.qty} ${it.unit})`).join('\n');
                    const msg = `Bismillah.\n*Surat Perintah Pengadaan Resmi (SPP)* 📋\n\n` +
                        `Halo *${assignee.name || assignee.username}*,\n` +
                        `Anda menerima Surat Perintah Pengadaan dari *${assigner.name || assigner.username}* (${assigner.position}):\n\n` +
                        `📄 *No. Surat Perintah* : ${docNumber}\n` +
                        `🔖 *No. Pengadaan* : ${procurement.code}\n` +
                        `🏢 *Unit Pemohon* : ${procurement.unit?.name || 'Unit'}\n` +
                        `📋 *Perihal* : ${procurement.title || 'Pengadaan Barang'}\n\n` +
                        `*Daftar Barang yang Ditugaskan:*\n${itemsText}\n\n` +
                        `🔗 Silakan akses link berikut untuk memeriksa dan menandatangani Surat Perintah Pengadaan:\n${signUrl}\n\n` +
                        `Syukron wa barakallahu fiik.`;
                    await whatsappService.sendMessage(assignee.phone, msg);
                } catch (err) {
                    console.error('Error sending WA to assignee:', err);
                }
            })();
        }

        res.status(201).json({
            message: 'Surat Perintah Pengadaan berhasil diterbitkan dan dicatat di E-Office Surat Keluar.',
            order: orderData
        });
    } catch (error) {
        console.error('createAssignmentOrder error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Helper to synchronize assignment order signing with OfficeDocument
 */
const syncAssignmentOrderToOfficeDoc = async (orderData, signature, signedAt) => {
    try {
        let targetOfficeDoc = null;
        if (orderData.officeDocumentId) {
            try {
                targetOfficeDoc = await prisma.officeDocument.findUnique({
                    where: { id: parseInt(orderData.officeDocumentId) }
                });
            } catch (e) {}
        }
        if (!targetOfficeDoc && orderData.uuid) {
            try {
                targetOfficeDoc = await prisma.officeDocument.findUnique({
                    where: { uuid: orderData.uuid }
                });
            } catch (e) {}
        }
        if (!targetOfficeDoc && orderData.orderNumber && orderData.orderNumber !== '-') {
            try {
                targetOfficeDoc = await prisma.officeDocument.findFirst({
                    where: { number: orderData.orderNumber }
                });
            } catch (e) {}
        }
        if (!targetOfficeDoc && orderData.orderId) {
            try {
                targetOfficeDoc = await prisma.officeDocument.findFirst({
                    where: {
                        OR: [
                            { subject: { contains: orderData.orderId } },
                            { content: { contains: `"${orderData.orderId}"` } }
                        ]
                    }
                });
            } catch (e) {}
        }

        if (targetOfficeDoc) {
            let existingDocContent = {};
            try {
                existingDocContent = typeof targetOfficeDoc.content === 'string'
                    ? JSON.parse(targetOfficeDoc.content)
                    : (targetOfficeDoc.content || {});
            } catch (e) {}

            const updatedDocContent = {
                ...existingDocContent,
                ...orderData,
                officeDocumentId: targetOfficeDoc.id,
                assigneeSignature: signature,
                assigneeSignedAt: signedAt
            };
            const { qrCodeData: _qrD, ...cleanDocContent } = updatedDocContent;

            await prisma.officeDocument.update({
                where: { id: targetOfficeDoc.id },
                data: {
                    party2Signature: signature,
                    party2SignedAt: new Date(signedAt),
                    party2Name: orderData.assignee?.name || targetOfficeDoc.party2Name,
                    party2Title: orderData.assignee?.position || targetOfficeDoc.party2Title,
                    content: JSON.stringify(cleanDocContent)
                }
            });
            orderData.officeDocumentId = targetOfficeDoc.id;
        }
    } catch (err) {
        console.error('syncAssignmentOrderToOfficeDoc error:', err);
    }
};

/**
 * POST /api/procurements/:id/assignment-orders/sign
 * Assigned staff signs the Surat Perintah Pengadaan
 */
exports.signAssignmentOrder = async (req, res) => {
    const { id } = req.params;
    const { orderId, signature } = req.body;
    const currentUser = req.user;

    if (!orderId || !signature) {
        return res.status(400).json({ error: 'ID Surat Perintah dan Tanda Tangan wajib disertakan.' });
    }

    try {
        const progressEntry = await prisma.procurementProgress.findFirst({
            where: {
                procurementId: parseInt(id),
                type: 'ASSIGNMENT_ORDER',
                message: { contains: `"${orderId}"` }
            }
        });

        if (!progressEntry) {
            return res.status(404).json({ error: 'Surat Perintah Pengadaan tidak ditemukan.' });
        }

        let orderData = {};
        try {
            orderData = JSON.parse(progressEntry.message.replace('[SURAT_PERINTAH]', '').trim());
        } catch (e) { }

        const signedAt = new Date().toISOString();
        orderData.assigneeSignature = signature;
        orderData.assigneeSignedAt = signedAt;

        // Update progress entry (exclude bulky base64 qrCodeData)
        const { qrCodeData: _qr, ...progressOrderData } = orderData;
        await prisma.procurementProgress.update({
            where: { id: progressEntry.id },
            data: {
                message: `[SURAT_PERINTAH] ${JSON.stringify(progressOrderData)}`
            }
        });

        // Also update OfficeDocument if exists (both party2Signature and content JSON)
        await syncAssignmentOrderToOfficeDoc(orderData, signature, signedAt);

        // Add timeline note
        await prisma.procurementProgress.create({
            data: {
                procurementId: parseInt(id),
                userId: currentUser.id,
                message: `✍️ Petugas *${orderData.assignee?.name || currentUser.username}* telah menandatangani Surat Perintah Tugas Pengadaan No. ${orderData.orderNumber || '-'}`,
                type: 'SYSTEM',
                stage: 2
            }
        });

        res.json({
            message: 'Surat Perintah Pengadaan berhasil ditandatangani.',
            order: orderData
        });
    } catch (error) {
        console.error('signAssignmentOrder error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * POST /api/procurements/:id/assignment-orders/:orderId/notify-print
 * Triggered when "Cetak SPP" is clicked.
 * Sends WhatsApp notification to the assigned staff reminding them to review/sign the order if not signed yet.
 */
exports.notifyPrintAssignmentOrder = async (req, res) => {
    const { id, orderId } = req.params;
    const currentUser = req.user;

    try {
        const procurement = await prisma.procurement.findUnique({
            where: { id: parseInt(id) },
            include: { unit: true }
        });

        if (!procurement) {
            return res.status(404).json({ error: 'Pengadaan tidak ditemukan.' });
        }

        const progressEntry = await prisma.procurementProgress.findFirst({
            where: {
                procurementId: parseInt(id),
                type: 'ASSIGNMENT_ORDER',
                message: { contains: `"${orderId}"` }
            }
        });

        if (!progressEntry) {
            return res.status(404).json({ error: 'Surat Perintah Pengadaan tidak ditemukan.' });
        }

        let orderData = {};
        try {
            orderData = JSON.parse(progressEntry.message.replace('[SURAT_PERINTAH]', '').trim());
        } catch (e) {}

        const assigneeId = orderData.assignee?.id;
        if (!assigneeId) {
            return res.json({ message: 'Petugas belum ditentukan.' });
        }

        const assignee = await prisma.user.findUnique({
            where: { id: parseInt(assigneeId) }
        });

        if (!assignee) {
            return res.json({ message: 'Data petugas tidak ditemukan.' });
        }

        // Kirim WhatsApp jika nomor telepon tersedia
        if (assignee.phone) {
            const clientUrl = process.env.CLIENT_URL || process.env.BASE_URL || 'https://sarpras.dareliman.or.id';
            const signUrl = `${clientUrl}/public/perintah-pengadaan/${orderId}`;
            const isSigned = !!orderData.assigneeSignature;

            let msg = `Bismillah.\n*Pemberitahuan Surat Perintah Pengadaan (SPP)* 🖨️📋\n\n` +
                `Halo *${assignee.name || assignee.username}*,\n` +
                `Surat Perintah Tugas Pengadaan Anda telah dicetak oleh *${currentUser?.name || currentUser?.username || 'Admin'}* untuk ditindaklanjuti:\n\n` +
                `📄 *No. Surat* : ${orderData.orderNumber || '-'}\n` +
                `🔖 *No. Pengadaan* : ${procurement.code}\n` +
                `🏢 *Unit Pemohon* : ${procurement.unit?.name || 'Unit'}\n` +
                `📋 *Perihal* : ${procurement.title || 'Pengadaan Barang'}\n\n`;

            if (!isSigned) {
                msg += `⚠️ *Status Tanda Tangan: Belum Ditandatangani*\n` +
                    `Mohon untuk segera memeriksa dan menandatangani lembar Surat Perintah Pengadaan melalui tautan resmi berikut:\n` +
                    `🔗 ${signUrl}\n\n`;
            } else {
                msg += `✅ *Status: Sudah Ditandatangani.*\n` +
                    `🔗 Anda dapat melihat arsip Surat Perintah di:\n${signUrl}\n\n`;
            }

            msg += `Syukron wa barakallahu fiik.`;

            await whatsappService.sendMessage(assignee.phone, msg);
        }

        // Kirim juga notifikasi internal ke web app
        try {
            await createNotification(
                assignee.id,
                'Surat Perintah Pengadaan Dicetak',
                `Surat Perintah No. ${orderData.orderNumber || '-'} (${procurement.code}) telah dicetak untuk diproses.`,
                'PROCUREMENT',
                `/procurements/${procurement.id}`
            );
        } catch (notifErr) {
            console.error('Error creating internal notification:', notifErr);
        }

        res.json({
            success: true,
            message: `Pemberitahuan telah dikirim ke WhatsApp petugas ${assignee.name || assignee.username}.`
        });
    } catch (error) {
        console.error('notifyPrintAssignmentOrder error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * GET /api/procurements/public/assignment-orders/:orderId
 * Fetch order data for public signing page
 */
exports.getPublicAssignmentOrder = async (req, res) => {
    const { orderId } = req.params;
    const cleanOrderId = decodeURIComponent(orderId || '').trim();
    try {
        const progressEntry = await prisma.procurementProgress.findFirst({
            where: {
                type: 'ASSIGNMENT_ORDER',
                message: { contains: cleanOrderId }
            },
            include: {
                procurement: {
                    include: {
                        unit: true,
                        items: true
                    }
                }
            }
        });

        if (!progressEntry) {
            return res.status(404).json({ error: 'Surat Perintah Pengadaan tidak ditemukan.' });
        }

        let orderData = {};
        try {
            orderData = JSON.parse(progressEntry.message.replace('[SURAT_PERINTAH]', '').trim());
            if (!orderData.assigner?.name || orderData.assigner.name === 'Pemberi Tugas' || orderData.assigner.name === 'Kepala Bidang Sarana' || !orderData.assigner.nip) {
                const kabidUser = await prisma.user.findFirst({
                    where: {
                        OR: [
                            { position: 'Kepala Bidang Sarana' },
                            { position: { contains: 'Kepala Bidang Sarana' } }
                        ]
                    }
                });
                if (kabidUser) {
                    orderData.assigner = {
                        ...(orderData.assigner || {}),
                        id: kabidUser.id,
                        name: kabidUser.name || kabidUser.username || '',
                        nip: kabidUser.nip || '-',
                        position: 'Kepala Bidang Sarana'
                    };
                } else {
                    orderData.assigner = {
                        ...(orderData.assigner || {}),
                        name: orderData.assigner?.name || '',
                        nip: orderData.assigner?.nip || '-',
                        position: 'Kepala Bidang Sarana'
                    };
                }
            }
        } catch (e) { }

        // Pastikan verifyUrl dan qrCodeData selalu tersedia untuk verifikasi publik
        if (!orderData.verifyUrl && orderData.uuid) {
            orderData.verifyUrl = `https://sarpras.dareliman.or.id/verify/${orderData.uuid}`;
        }

        if (!orderData.qrCodeData && (orderData.verifyUrl || orderData.uuid)) {
            if (orderData.officeDocumentId) {
                try {
                    const offDoc = await prisma.officeDocument.findUnique({
                        where: { id: orderData.officeDocumentId },
                        select: { qrCodeData: true }
                    });
                    if (offDoc?.qrCodeData) {
                        orderData.qrCodeData = offDoc.qrCodeData;
                    }
                } catch (docErr) { }
            }
            if (!orderData.qrCodeData) {
                try {
                    const vUrl = orderData.verifyUrl || `https://sarpras.dareliman.or.id/verify/${orderData.uuid}`;
                    orderData.qrCodeData = await generateVerificationQR(vUrl);
                } catch (qrErr) { }
            }
        }

        res.json({
            order: orderData,
            procurement: {
                id: progressEntry.procurement.id,
                code: progressEntry.procurement.code,
                title: progressEntry.procurement.title,
                unit: progressEntry.procurement.unit
            }
        });
    } catch (error) {
        console.error('getPublicAssignmentOrder error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * POST /api/procurements/public/assignment-orders/:orderId/sign
 * Public endpoint to sign Surat Perintah Pengadaan
 */
exports.signPublicAssignmentOrder = async (req, res) => {
    const { orderId } = req.params;
    const { signature } = req.body;
    const cleanOrderId = decodeURIComponent(orderId || '').trim();

    if (!signature) {
        return res.status(400).json({ error: 'Tanda tangan wajib dibubuhkan.' });
    }

    try {
        const progressEntry = await prisma.procurementProgress.findFirst({
            where: {
                type: 'ASSIGNMENT_ORDER',
                message: { contains: cleanOrderId }
            },
            include: {
                procurement: true
            }
        });

        if (!progressEntry) {
            return res.status(404).json({ error: 'Surat Perintah Pengadaan tidak ditemukan.' });
        }

        let orderData = {};
        try {
            orderData = JSON.parse(progressEntry.message.replace('[SURAT_PERINTAH]', '').trim());
        } catch (e) { }

        const signedAt = new Date().toISOString();
        orderData.assigneeSignature = signature;
        orderData.assigneeSignedAt = signedAt;

        // Update progress entry (exclude bulky base64 qrCodeData)
        const { qrCodeData: _qr, ...progressOrderData } = orderData;
        await prisma.procurementProgress.update({
            where: { id: progressEntry.id },
            data: {
                message: `[SURAT_PERINTAH] ${JSON.stringify(progressOrderData)}`
            }
        });

        // Also update OfficeDocument if exists (both party2Signature and content JSON)
        await syncAssignmentOrderToOfficeDoc(orderData, signature, signedAt);

        // Add timeline note
        await prisma.procurementProgress.create({
            data: {
                procurementId: progressEntry.procurementId,
                userId: progressEntry.userId,
                message: `✍️ Petugas *${orderData.assignee?.name || 'Penerima Tugas'}* telah menandatangani Surat Perintah Tugas Pengadaan No. ${orderData.orderNumber || '-'} secara digital`,
                type: 'SYSTEM',
                stage: 2
            }
        });

        res.json({
            message: 'Surat Perintah Pengadaan berhasil ditandatangani.',
            order: orderData
        });
    } catch (error) {
        console.error('signPublicAssignmentOrder error:', error);
        res.status(500).json({ error: error.message });
    }
};
