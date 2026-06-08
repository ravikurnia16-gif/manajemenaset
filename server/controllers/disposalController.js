const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const waService = require('../services/whatsappService');
const { createNotification } = require('./notificationController');

/**
 * Create a disposal proposal (Set status to PENDING)
 */
exports.createDisposal = async (req, res) => {
    const { assetId, assetIds, reason, method, notes, disposalDate } = req.body;
    const userId = req.user.id;

    // Support both single assetId and bulk assetIds
    const idsToProcess = assetIds && Array.isArray(assetIds) ? assetIds : (assetId ? [assetId] : []);

    if (idsToProcess.length === 0) {
        return res.status(400).json({ error: 'Tidak ada aset yang dipilih' });
    }

    try {
        const results = await prisma.$transaction(async (tx) => {
            const processed = [];
            const skipped = [];

            for (const id of idsToProcess) {
                const numericId = parseInt(id);

                // Check if there is already a PENDING proposal for this asset
                const existingProposal = await tx.assetDisposal.findFirst({
                    where: { assetId: numericId, status: 'PENDING' }
                });

                if (existingProposal) {
                    skipped.push(numericId);
                    continue;
                }

                // Create Disposal Record as PENDING
                const disposal = await tx.assetDisposal.create({
                    data: {
                        assetId: numericId,
                        reason,
                        method,
                        notes,
                        disposalDate: disposalDate ? new Date(disposalDate) : null,
                        proposedById: userId,
                        status: 'PENDING'
                    },
                    include: {
                        asset: true,
                        proposedBy: { select: { name: true, username: true } }
                    }
                });
                processed.push(disposal);
            }

            return { processed, skipped };
        });

        if (results.processed.length === 0) {
            return res.status(400).json({ error: 'Semua aset terpilih sudah memiliki usulan aktif' });
        }

        // --- In-App Notification (Phase 3) ---
        try {
            const leads = await prisma.user.findMany({
                where: { position: 'Kepala Bidang Sarana dan Prasarana' }
            });

            if (leads.length > 0) {
                const notifTitle = 'Usulan Penghapusan Baru';
                const notifMsg = results.processed.length === 1
                    ? `Usulan penghapusan baru untuk aset "${results.processed[0].asset.name}" (${results.processed[0].asset.code}).`
                    : `Ada ${results.processed.length} usulan penghapusan aset baru yang perlu ditinjau.`;

                for (const lead of leads) {
                    await createNotification(
                        lead.id,
                        notifTitle,
                        notifMsg,
                        'URGENT',
                        '/disposals'
                    );
                }
            }
        } catch (notifErr) {
            console.error('Failed to send in-app notification for disposal:', notifErr);
        }

        // Send WA Notification to Kepala Bidang Sarana dan Prasarana
        try {
            const leads = await prisma.user.findMany({
                where: {
                    position: 'Kepala Bidang Sarana dan Prasarana',
                    phone: { not: null, not: '' }
                }
            });

            if (leads.length > 0) {
                let waMessage = `*USULAN PENGHAPUSAN BARU*\n\n`;

                if (results.processed.length === 1) {
                    const item = results.processed[0];
                    waMessage += `Aset: ${item.asset.name}\n` +
                        `Kode: ${item.asset.code}\n`;
                } else {
                    waMessage += `Jumlah Aset: ${results.processed.length} Item\n` +
                        `Daftar: ${results.processed.slice(0, 5).map(p => p.asset.name).join(', ')}${results.processed.length > 5 ? '...' : ''}\n`;
                }

                waMessage += `Alasan: ${reason}\n` +
                    `Metode: ${method || '-'}\n` +
                    `Diajukan oleh: ${results.processed[0].proposedBy.name || results.processed[0].proposedBy.username}\n\n` +
                    `_Mohon segera tinjau di dashboard Sistem Manajemen Aset._`;

                for (const lead of leads) {
                    await waService.sendMessage(lead.phone, waMessage);
                }
            }
        } catch (waError) {
            console.error('[WA Error] Failed to send notification for disposal proposal:', waError.message);
        }

        res.json({
            message: `Usulan penghapusan berhasil diajukan untuk ${results.processed.length} aset.`,
            data: results.processed,
            skippedCount: results.skipped.length
        });
    } catch (error) {
        console.error('Create Disposal Proposal Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Admin review: Approve or Reject
 */
exports.reviewDisposal = async (req, res) => {
    const { id } = req.params;
    const { status, rejectionReason, approvedAt } = req.body; // status: 'APPROVED' or 'REJECTED'
    const userId = req.user.id;

    try {
        const result = await prisma.$transaction(async (tx) => {
            const proposal = await tx.assetDisposal.findUnique({
                where: { id: parseInt(id) },
                include: { asset: true }
            });

            if (!proposal) throw new Error('Usulan tidak ditemukan');
            if (proposal.status !== 'PENDING') throw new Error('Usulan ini sudah diproses sebelumnya');

            const updatedDisposal = await tx.assetDisposal.update({
                where: { id: parseInt(id) },
                data: {
                    status,
                    rejectionReason: status === 'REJECTED' ? rejectionReason : null,
                    reviewedById: userId,
                    reviewedAt: new Date(),
                    disposalDate: status === 'APPROVED' ? (approvedAt ? new Date(approvedAt) : new Date()) : proposal.disposalDate
                }
            });

            // If APPROVED, update asset condition
            if (status === 'APPROVED') {
                await tx.asset.update({
                    where: { id: proposal.assetId },
                    data: { condition: 'DISPOSED' }
                });
            }

            // --- In-App Notification (Phase 3) ---
            const notifTitle = `Penghapusan Aset ${status === 'APPROVED' ? 'Disetujui' : 'Ditolak'}`;
            const notifMsg = `Usulan penghapusan aset "${proposal.asset.name}" Anda telah ${status === 'APPROVED' ? 'disetujui' : 'ditolak'}.${status === 'REJECTED' ? ` Alasan: ${rejectionReason || '-'}` : ''}`;
            const notifType = status === 'APPROVED' ? 'SUCCESS' : 'WARNING';

            await createNotification(
                proposal.proposedById,
                notifTitle,
                notifMsg,
                notifType,
                '/disposals' // Or detail page if exists
            );

            return updatedDisposal;
        });

        res.json({ message: `Usulan berhasil ${status === 'APPROVED' ? 'disetujui' : 'ditolak'}`, data: result });
    } catch (error) {
        console.error('Review Disposal Error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getAllDisposals = async (req, res) => {
    const { status } = req.query;
    try {
        const where = {};
        if (status) where.status = status;

        const disposals = await prisma.assetDisposal.findMany({
            where,
            include: {
                asset: {
                    include: {
                        category: { select: { name: true } },
                        unit: { select: { name: true } }
                    }
                },
                proposedBy: { select: { name: true, username: true } },
                reviewedBy: { select: { name: true, username: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(disposals);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getDisposalDetail = async (req, res) => {
    const { id } = req.params;
    try {
        const disposal = await prisma.assetDisposal.findUnique({
            where: { id: parseInt(id) },
            include: {
                asset: {
                    include: {
                        category: { select: { name: true } },
                        unit: { select: { name: true } },
                        room: { select: { name: true } }
                    }
                },
                proposedBy: { select: { name: true, username: true } },
                reviewedBy: { select: { name: true, username: true } }
            }
        });
        if (!disposal) return res.status(404).json({ error: 'Data usulan tidak ditemukan' });
        res.json(disposal);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get all assets listed for auction (method: DIJUAL / LELANG)
 */
exports.getAuctions = async (req, res) => {
    try {
        const auctions = await prisma.assetDisposal.findMany({
            where: {
                method: 'DIJUAL',
                status: 'APPROVED' // Only approved disposals are auctioned
            },
            include: {
                asset: {
                    include: {
                        category: { select: { name: true } },
                        unit: { select: { name: true } }
                    }
                },
                bids: {
                    include: {
                        user: { select: { name: true, username: true } }
                    },
                    orderBy: { bidPrice: 'desc' }
                },
                winner: { select: { name: true, username: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(auctions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Submit a bid for an auction item
 */
exports.submitBid = async (req, res) => {
    const { id } = req.params; // AssetDisposal ID
    const { bidPrice, notes } = req.body;
    const userId = req.user.id;

    if (!bidPrice || isNaN(bidPrice) || bidPrice <= 0) {
        return res.status(400).json({ error: 'Harga penawaran tidak valid' });
    }

    try {
        const disposal = await prisma.assetDisposal.findUnique({
            where: { id: parseInt(id) }
        });

        if (!disposal || disposal.method !== 'DIJUAL' || disposal.status !== 'APPROVED') {
            return res.status(400).json({ error: 'Item ini tidak tersedia untuk dilelang' });
        }

        if (disposal.winnerId) {
            return res.status(400).json({ error: 'Lelang untuk item ini sudah ditutup' });
        }

        // Check if user already bid
        const existingBid = await prisma.disposalBid.findFirst({
            where: { assetDisposalId: parseInt(id), userId }
        });

        if (existingBid) {
            // Update bid
            const updatedBid = await prisma.disposalBid.update({
                where: { id: existingBid.id },
                data: { bidPrice: parseFloat(bidPrice), notes }
            });
            return res.json({ message: 'Penawaran berhasil diperbarui', data: updatedBid });
        }

        const bid = await prisma.disposalBid.create({
            data: {
                assetDisposalId: parseInt(id),
                userId,
                bidPrice: parseFloat(bidPrice),
                notes
            }
        });

        res.json({ message: 'Penawaran berhasil diajukan', data: bid });
    } catch (error) {
        console.error('Submit Bid Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Admin chooses a winner for the auction
 */
exports.setWinner = async (req, res) => {
    const { bidId } = req.params;

    try {
        const result = await prisma.$transaction(async (tx) => {
            const bid = await tx.disposalBid.findUnique({
                where: { id: parseInt(bidId) },
                include: { assetDisposal: true }
            });

            if (!bid) throw new Error('Penawaran tidak ditemukan');
            if (bid.assetDisposal.winnerId) throw new Error('Lelang ini sudah memiliki pemenang');

            // Set this bid as WINNER
            await tx.disposalBid.update({
                where: { id: parseInt(bidId) },
                data: { status: 'WINNER' }
            });

            // Set other bids as REJECTED
            await tx.disposalBid.updateMany({
                where: {
                    assetDisposalId: bid.assetDisposalId,
                    id: { not: parseInt(bidId) }
                },
                data: { status: 'REJECTED' }
            });

            // Update AssetDisposal
            const updatedDisposal = await tx.assetDisposal.update({
                where: { id: bid.assetDisposalId },
                data: {
                    winnerId: bid.userId,
                    finalPrice: bid.bidPrice
                }
            });

            return updatedDisposal;
        });

        res.json({ message: 'Pemenang lelang berhasil ditetapkan', data: result });
    } catch (error) {
        console.error('Set Winner Error:', error);
        res.status(500).json({ error: error.message });
    }
};
