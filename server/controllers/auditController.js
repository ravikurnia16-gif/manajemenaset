const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all audit sessions
exports.getAllSessions = async (req, res) => {
    try {
        const sessions = await prisma.auditSession.findMany({
            include: { 
                creator: { select: { name: true } },
                _count: { select: { items: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(sessions);
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

// Verify/Scan item
exports.verifyItem = async (req, res) => {
    const { sessionId, assetCode, status, condition, note, foundLocationId } = req.body;
    try {
        // Find the asset first
        const asset = await prisma.asset.findUnique({ where: { code: assetCode } });
        if (!asset) return res.status(404).json({ error: 'Aset tidak ditemukan' });

        // Find the audit item in this session
        const auditItem = await prisma.auditItem.findFirst({
            where: { sessionId: parseInt(sessionId), assetId: asset.id }
        });

        if (!auditItem) {
            // If item not in session (Unexpected item found in room), we can still record it
            // For now, let's just return error or handle it as "Unexpected"
            return res.status(400).json({ error: 'Aset ini tidak termasuk dalam cakupan audit sesi ini' });
        }

        const updatedItem = await prisma.auditItem.update({
            where: { id: auditItem.id },
            data: {
                status: status || 'FOUND',
                foundCondition: condition,
                foundLocationId: foundLocationId ? parseInt(foundLocationId) : undefined,
                notes: note,
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

// Finalize/Reconcile Session
exports.finalizeSession = async (req, res) => {
    const sessionId = parseInt(req.params.id);
    try {
        const session = await prisma.auditSession.findUnique({
            where: { id: sessionId },
            include: { items: true }
        });

        if (!session || session.status !== 'OPEN') {
            return res.status(400).json({ error: 'Sesi audit tidak valid atau sudah ditutup' });
        }

        // Perform Reconciliation
        // Update all FOUND assets with new condition and location
        const foundItems = session.items.filter(item => item.status === 'FOUND');
        
        await prisma.$transaction(async (tx) => {
            for (const item of foundItems) {
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

        res.json({ message: 'Audit berhasil difinalisasi. Data aset telah diperbarui.' });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// Delete session
exports.deleteSession = async (req, res) => {
    try {
        await prisma.auditSession.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'Sesi audit dihapus' });
    } catch (e) { res.status(500).json({ error: e.message }); }
};
