const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { uploadFile } = require('../services/minioService');

// Get all audit sessions with status counts
exports.getAllSessions = async (req, res) => {
    try {
        const sessions = await prisma.auditSession.findMany({
            include: { 
                creator: { select: { name: true } },
                items: { select: { status: true } },
                _count: { select: { items: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Compute detailed status stats for each session
        const sessionsWithStats = sessions.map(s => {
            const total = s.items.length;
            const found = s.items.filter(i => i.status === 'FOUND').length;
            const missing = s.items.filter(i => i.status === 'MISSING').length;
            const pending = s.items.filter(i => i.status === 'PENDING').length;
            const { items, ...rest } = s;
            return {
                ...rest,
                stats: { total, found, missing, pending }
            };
        });

        res.json(sessionsWithStats);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// Create new audit session
exports.createSession = async (req, res) => {
    const { title, description, roomIds } = req.body;
    try {
        // Fetch all assets in the selected rooms
        const assets = await prisma.asset.findMany({
            where: { roomId: { in: roomIds.map(id => parseInt(id)) } },
            include: { room: true }
        });

        if (assets.length === 0) {
            return res.status(400).json({ error: 'Tidak ada aset ditemukan di ruangan yang dipilih' });
        }

        const session = await prisma.auditSession.create({
            data: {
                title,
                description,
                createdBy: req.user.id,
                items: {
                    create: assets.map(asset => ({
                        assetId: asset.id,
                        originalLocation: asset.room?.name || 'Unknown'
                    }))
                }
            },
            include: { _count: { select: { items: true } } }
        });

        res.status(201).json(session);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// Get session detail with items
exports.getSessionById = async (req, res) => {
    try {
        const session = await prisma.auditSession.findUnique({
            where: { id: parseInt(req.params.id) },
            include: {
                creator: { select: { name: true } },
                items: {
                    include: {
                        asset: { include: { room: true, category: true } },
                        auditor: { select: { name: true } }
                    }
                }
            }
        });
        if (!session) return res.status(404).json({ error: 'Sesi audit tidak ditemukan' });
        res.json(session);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// Dedicated Photo Upload for Audit (handled by handleUpload middleware & MinIO compression)
exports.uploadPhoto = async (req, res) => {
    try {
        if (!req.fileUrl) {
            return res.status(400).json({ error: 'Tidak ada foto yang diunggah' });
        }
        res.json({ url: req.fileUrl });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Verify/Scan item (supports saving photo to MinIO with Sharp compression)
exports.verifyItem = async (req, res) => {
    const { sessionId, assetCode, status, condition, note, foundLocationId, image } = req.body;
    try {
        // Find the asset first
        const asset = await prisma.asset.findUnique({ where: { code: assetCode } });
        if (!asset) return res.status(404).json({ error: 'Aset tidak ditemukan' });

        // Find the audit item in this session
        const auditItem = await prisma.auditItem.findFirst({
            where: { sessionId: parseInt(sessionId), assetId: asset.id }
        });

        if (!auditItem) {
            return res.status(400).json({ error: 'Aset ini tidak termasuk dalam cakupan audit sesi ini' });
        }

        // Handle Image: If base64 is sent directly, upload it to MinIO with Sharp compression
        let processedImageUrl = image || undefined;
        if (image && typeof image === 'string' && image.startsWith('data:image/')) {
            try {
                const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                if (matches && matches.length === 3) {
                    const mimeType = matches[1];
                    const buffer = Buffer.from(matches[2], 'base64');
                    processedImageUrl = await uploadFile(buffer, `audit-${asset.code}-${Date.now()}.jpg`, mimeType, 'audit');
                }
            } catch (err) {
                console.error('[AUDIT] Base64 upload to MinIO error:', err);
            }
        }

        const updatedItem = await prisma.auditItem.update({
            where: { id: auditItem.id },
            data: {
                status: status || 'FOUND',
                foundCondition: condition,
                foundLocationId: foundLocationId ? parseInt(foundLocationId) : undefined,
                notes: note,
                image: processedImageUrl,
                auditorId: req.user.id,
                verifiedAt: new Date()
            },
            include: { asset: true }
        });

        res.json(updatedItem);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// Bulk Verify Items
exports.bulkVerify = async (req, res) => {
    const { sessionId, itemIds, status, condition } = req.body;
    try {
        await prisma.auditItem.updateMany({
            where: { 
                id: { in: itemIds.map(id => parseInt(id)) },
                sessionId: parseInt(sessionId)
            },
            data: {
                status: status || 'FOUND',
                foundCondition: condition || 'BAIK',
                auditorId: req.user.id,
                verifiedAt: new Date()
            }
        });
        res.json({ message: 'Item berhasil diperbarui secara masal' });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// Approve item for reconciliation
exports.approveItem = async (req, res) => {
    const { id, approved } = req.body;
    try {
        const item = await prisma.auditItem.update({
            where: { id: parseInt(id) },
            data: { reconcileApproved: approved }
        });
        res.json(item);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// Bulk Approve Reconcile for all FOUND items or selected items
exports.bulkApproveReconcile = async (req, res) => {
    const { sessionId, approved = true, itemIds } = req.body;
    try {
        const whereClause = {
            sessionId: parseInt(sessionId),
            status: 'FOUND'
        };
        if (itemIds && Array.isArray(itemIds) && itemIds.length > 0) {
            whereClause.id = { in: itemIds.map(id => parseInt(id)) };
        }
        const result = await prisma.auditItem.updateMany({
            where: whereClause,
            data: { reconcileApproved: approved }
        });
        res.json({ 
            message: `Berhasil memperbarui persetujuan ${result.count} aset`, 
            count: result.count 
        });
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
};

// Finalize/Reconcile Session
exports.finalizeSession = async (req, res) => {
    const sessionId = parseInt(req.params.id);
    const { autoMarkMissing } = req.body;
    try {
        const session = await prisma.auditSession.findUnique({
            where: { id: sessionId },
            include: { items: true }
        });

        if (!session || session.status !== 'OPEN') {
            return res.status(400).json({ error: 'Sesi audit tidak valid atau sudah ditutup' });
        }

        // If autoMarkMissing is requested, update any remaining PENDING items to MISSING
        if (autoMarkMissing) {
            await prisma.auditItem.updateMany({
                where: { sessionId: sessionId, status: 'PENDING' },
                data: {
                    status: 'MISSING',
                    notes: 'Tidak ditemukan saat finalisasi stock opname',
                    auditorId: req.user.id,
                    verifiedAt: new Date()
                }
            });
        }

        // Re-fetch all items for reconciliation
        const allItems = await prisma.auditItem.findMany({
            where: { sessionId: sessionId }
        });

        // Perform Reconciliation ONLY for Approved FOUND Items
        const approvedItems = allItems.filter(item => item.status === 'FOUND' && item.reconcileApproved);
        
        await prisma.$transaction(async (tx) => {
            for (const item of approvedItems) {
                await tx.asset.update({
                    where: { id: item.assetId },
                    data: {
                        condition: item.foundCondition || undefined,
                        roomId: item.foundLocationId || undefined
                    }
                });
            }

            // Mark session as CLOSED
            await tx.auditSession.update({
                where: { id: sessionId },
                data: { status: 'CLOSED', endDate: new Date() }
            });
        });

        res.json({ 
            message: `Audit difinalisasi. ${approvedItems.length} aset telah disinkronkan ke database utama.`,
            updatedCount: approvedItems.length
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// Delete session
exports.deleteSession = async (req, res) => {
    try {
        await prisma.auditSession.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'Sesi audit dihapus' });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// Add unexpected finding
exports.addUnexpectedItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { itemName, note } = req.body;

        const session = await prisma.auditSession.findUnique({
            where: { id: parseInt(id) }
        });

        if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan' });

        // Get current unexpected items (parse JSON if needed)
        let currentUnexpected = [];
        if (session.unexpectedItems) {
            try {
                currentUnexpected = typeof session.unexpectedItems === 'string' 
                    ? JSON.parse(session.unexpectedItems) 
                    : session.unexpectedItems;
            } catch (e) {
                currentUnexpected = [];
            }
        }

        // Add new item
        currentUnexpected.push({
            name: itemName,
            note: note || '',
            date: new Date().toISOString()
        });

        // Update session
        const updatedSession = await prisma.auditSession.update({
            where: { id: parseInt(id) },
            data: { unexpectedItems: currentUnexpected }
        });

        res.json(updatedSession);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
