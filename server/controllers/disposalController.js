const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.createDisposal = async (req, res) => {
    const { assetId, reason, method, notes, disposalDate } = req.body;
    const userId = req.user.id;

    try {
        // Use a transaction to ensure both asset status update and disposal record creation
        const result = await prisma.$transaction(async (tx) => {
            // 1. Update Asset Condition to DISPOSED
            const asset = await tx.asset.update({
                where: { id: parseInt(assetId) },
                data: { condition: 'DISPOSED' }
            });

            // 2. Create Disposal Record
            const disposal = await tx.assetDisposal.create({
                data: {
                    assetId: parseInt(assetId),
                    reason,
                    method,
                    notes,
                    disposalDate: disposalDate ? new Date(disposalDate) : new Date(),
                    authorizedById: userId
                }
            });

            return { asset, disposal };
        });

        res.json({ message: 'Aset berhasil dihapus dari inventaris aktif', data: result });
    } catch (error) {
        console.error('Create Disposal Error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getAllDisposals = async (req, res) => {
    try {
        const disposals = await prisma.assetDisposal.findMany({
            include: {
                asset: {
                    include: {
                        category: { select: { name: true } },
                        unit: { select: { name: true } }
                    }
                },
                authorizedBy: { select: { name: true, username: true } }
            },
            orderBy: { disposalDate: 'desc' }
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
                authorizedBy: { select: { name: true, username: true } }
            }
        });
        if (!disposal) return res.status(404).json({ error: 'Data penghapusan tidak ditemukan' });
        res.json(disposal);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
