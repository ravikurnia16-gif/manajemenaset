const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const waService = require('../services/whatsappService');

/**
 * Create a disposal proposal (Set status to PENDING)
 */
exports.createDisposal = async (req, res) => {
    const { assetId, reason, method, notes, disposalDate } = req.body;
    const userId = req.user.id;

    try {
        const result = await prisma.$transaction(async (tx) => {
            // Check if there is already a PENDING proposal for this asset
            const existingProposal = await tx.assetDisposal.findFirst({
                where: { assetId: parseInt(assetId), status: 'PENDING' }
            });

            if (existingProposal) {
                throw new Error('Aset ini sudah memiliki usulan penghapusan yang sedang diproses');
            }

            // Create Disposal Record as PENDING
            const disposal = await tx.assetDisposal.create({
                data: {
                    assetId: parseInt(assetId),
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

            return disposal;
        });

        // Send WA Notification to Ravi Kurnia (24071613)
        try {
            const ravi = await prisma.user.findFirst({
                where: { nip: '24071613' }
            });

            if (ravi?.phone) {
                const waMessage = `*USULAN PENGHAPUSAN BARU*\n\n` +
                    `Aset: ${result.asset.name}\n` +
                    `Kode: ${result.asset.code}\n` +
                    `Alasan: ${reason}\n` +
                    `Metode: ${method || '-'}\n` +
                    `Diajukan oleh: ${result.proposedBy.name || result.proposedBy.username}\n\n` +
                    `_Mohon segera tinjau di dashboard Sistem Manajemen Aset._`;

                await waService.sendMessage(ravi.phone, waMessage);
            }
        } catch (waError) {
            console.error('[WA Error] Failed to send notification for disposal proposal:', waError.message);
        }

        res.json({ message: 'Usulan penghapusan berhasil diajukan', data: result });
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
                where: { id: parseInt(id) }
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
