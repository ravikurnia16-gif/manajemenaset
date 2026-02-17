const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { createNotification } = require('./notificationController');
const whatsappService = require('../services/whatsappService');

exports.requestLoan = async (req, res) => {
    try {
        const { assetId, expectedReturnDate, purpose } = req.body;
        const borrowerId = req.user.id;

        const asset = await prisma.asset.findUnique({
            where: { id: parseInt(assetId) },
            include: { unit: true }
        });

        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }

        if (asset.condition === 'DISPOSED') {
            return res.status(400).json({ error: 'Asset is already disposed' });
        }

        if (!asset.isLendable) {
            return res.status(400).json({ error: 'Aset ini tidak diizinkan untuk dipinjam oleh unit pemilik' });
        }

        // Create loan request
        const loan = await prisma.assetLoan.create({
            data: {
                assetId: parseInt(assetId),
                borrowerId,
                unitId: asset.unitId,
                expectedReturnDate: new Date(expectedReturnDate),
                purpose,
                status: 'PENDING'
            },
            include: {
                borrower: true,
                asset: true
            }
        });

        // Notify Sarpras Unit (ADMIN_UNIT)
        try {
            const sarprasUnit = await prisma.user.findFirst({
                where: {
                    unitId: asset.unitId,
                    role: 'ADMIN_UNIT'
                }
            });

            if (sarprasUnit) {
                await createNotification(
                    sarprasUnit.id,
                    'Permohonan Peminjaman Aset',
                    `User ${loan.borrower.name} mengajukan peminjaman aset "${loan.asset.name}".`,
                    'INFO',
                    '/loans'
                );

                // Optional: WhatsApp notification
                if (sarprasUnit.phone) {
                    const message = `Halo Sarpras ${asset.unit.name},\nAda permohonan peminjaman aset baru:\n\nAset: ${loan.asset.name}\nPeminjam: ${loan.borrower.name}\nKeperluan: ${purpose}\nKembali: ${expectedReturnDate}\n\nMohon tinjau di sistem.`;
                    await whatsappService.sendDirectMessage(sarprasUnit.phone, message);
                }
            }
        } catch (notifErr) {
            console.error('Failed to send loan notification:', notifErr);
        }

        res.status(201).json(loan);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.reviewLoan = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rejectionReason } = req.body; // APPROVED or REJECTED
        const reviewerId = req.user.id;

        const loan = await prisma.assetLoan.findUnique({
            where: { id: parseInt(id) },
            include: {
                asset: { include: { unit: true } },
                borrower: true
            }
        });

        if (!loan) {
            return res.status(404).json({ error: 'Loan request not found' });
        }

        // Permission check: Must be Sarpras Unit (ADMIN_UNIT) of the asset's unit OR Super Admin
        const reviewer = await prisma.user.findUnique({ where: { id: reviewerId } });
        const isSarpras = reviewer.unitId === loan.asset.unitId && reviewer.role === 'ADMIN_UNIT';
        const isSuperAdmin = reviewer.role === 'SUPER_ADMIN';

        if (!isSarpras && !isSuperAdmin) {
            return res.status(403).json({ error: 'Hanya Sarpras Unit (Admin Unit) yang dapat menyetujui/menolak peminjaman ini' });
        }

        const updatedLoan = await prisma.assetLoan.update({
            where: { id: parseInt(id) },
            data: {
                status,
                rejectionReason: status === 'REJECTED' ? rejectionReason : null,
                reviewedById: reviewerId,
                reviewedAt: new Date(),
                borrowDate: status === 'APPROVED' ? new Date() : null,
                status: status === 'APPROVED' ? 'BORROWED' : 'REJECTED'
            }
        });

        // Notify Borrower
        await createNotification(
            loan.borrowerId,
            `Permohonan Peminjaman ${status === 'APPROVED' ? 'Disetujui' : 'Ditolak'}`,
            `Permohonan peminjaman aset "${loan.asset.name}" Anda telah ${status === 'APPROVED' ? 'disetujui' : 'ditolak'}.`,
            status === 'APPROVED' ? 'SUCCESS' : 'WARNING',
            '/loans'
        );

        res.json(updatedLoan);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.returnLoan = async (req, res) => {
    try {
        const { id } = req.params;

        const updatedLoan = await prisma.assetLoan.update({
            where: { id: parseInt(id) },
            data: {
                status: 'RETURNED',
                actualReturnDate: new Date()
            },
            include: { asset: true, borrower: true }
        });

        res.json(updatedLoan);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAllLoans = async (req, res) => {
    try {
        const { unitId, status, borrowerId } = req.query;
        const where = {};

        if (unitId) where.unitId = parseInt(unitId);
        if (status) where.status = status;
        if (borrowerId) where.borrowerId = parseInt(borrowerId);

        // Security: Non-admins can only see their own loans
        if (req.user.role === 'USER') {
            where.borrowerId = req.user.id;
        }

        const loans = await prisma.assetLoan.findMany({
            where,
            include: {
                asset: true,
                borrower: { select: { name: true, nip: true } },
                reviewedBy: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(loans);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getLoanDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const loan = await prisma.assetLoan.findUnique({
            where: { id: parseInt(id) },
            include: {
                asset: true,
                borrower: true,
                reviewedBy: true
            }
        });
        res.json(loan);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
