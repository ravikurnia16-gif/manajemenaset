const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { createNotification } = require('./notificationController');
const whatsappService = require('../services/whatsappService');
const { v4: uuidv4 } = require('uuid');

exports.requestLoan = async (req, res) => {
    try {
        const { assetIds, expectedReturnDate, purpose, targetUnitId } = req.body;
        const borrowerId = req.user.id;
        const requestId = uuidv4();

        if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
            return res.status(400).json({ error: 'Pilih setidaknya satu aset' });
        }

        const assets = await prisma.asset.findMany({
            where: { id: { in: assetIds.map(id => parseInt(id)) } },
            include: { unit: true }
        });

        if (assets.length !== assetIds.length) {
            return res.status(404).json({ error: 'Beberapa aset tidak ditemukan' });
        }

        const loans = await Promise.all(assets.map(async (asset) => {
            if (asset.condition === 'DISPOSED') {
                throw new Error(`Aset ${asset.name} sudah dihapus/disposed`);
            }
            if (!asset.isLendable) {
                throw new Error(`Aset ${asset.name} tidak diizinkan untuk dipinjam`);
            }

            return prisma.assetLoan.create({
                data: {
                    assetId: asset.id,
                    borrowerId,
                    unitId: asset.unitId,
                    targetUnitId: targetUnitId ? parseInt(targetUnitId) : null,
                    expectedReturnDate: new Date(expectedReturnDate),
                    purpose,
                    status: 'PENDING',
                    requestId
                },
                include: {
                    borrower: true,
                    asset: { include: { unit: true } }
                }
            });
        }));

        // Notify Sarpras Units (Group by unitId to avoid spam)
        const unitIds = [...new Set(assets.map(a => a.unitId))];
        for (const unitId of unitIds) {
            try {
                const sarprasUnit = await prisma.user.findFirst({
                    where: { unitId, role: 'ADMIN_UNIT' }
                });

                const unitAssets = assets.filter(a => a.unitId === unitId);
                const isYayasan = unitAssets[0]?.unit?.name?.toLowerCase().includes('kantor yayasan');

                if (isYayasan) {
                    // Notify Ravi Kurnia & Eldo specifically for Yayasan assets
                    const specialAdmins = await prisma.user.findMany({
                        where: {
                            OR: [
                                { position: 'Kepala Bidang Sarana dan Prasarana' },
                                { position: 'Staff Manajemen Aset' }
                            ]
                        }
                    });

                    for (const admin of specialAdmins) {
                        try {
                            await createNotification(
                                admin.id,
                                'Permohonan Peminjaman (Yayasan)',
                                `User ${req.user.name} mengajukan peminjaman ${unitAssets.length} aset Yayasan.`,
                                'INFO',
                                '/peminjaman'
                            );

                            if (admin.phone) {
                                const assetListStr = unitAssets.map(a => `- ${a.name} (${a.code})`).join('\n');
                                const message = `Halo Mas/Bapak,\nAda permohonan peminjaman aset Yayasan baru dari ${req.user.name}:\n\n${assetListStr}\n\nKeperluan: ${purpose}\nKembali: ${expectedReturnDate}\n\nMohon tinjau di sistem.`;
                                await whatsappService.sendDirectMessage(admin.phone, message);
                            }
                        } catch (e) { console.error(e); }
                    }
                } else if (sarprasUnit) {
                    await createNotification(
                        sarprasUnit.id,
                        'Permohonan Peminjaman Baru',
                        `User ${req.user.name} mengajukan peminjaman ${unitAssets.length} aset.`,
                        'INFO',
                        '/peminjaman'
                    );

                    if (sarprasUnit.phone) {
                        const assetListStr = unitAssets.map(a => `- ${a.name} (${a.code})`).join('\n');
                        const message = `Halo Sarpras,\nAda permohonan peminjaman baru dari ${req.user.name}:\n\n${assetListStr}\n\nKeperluan: ${purpose}\nKembali: ${expectedReturnDate}\n\nMohon tinjau di sistem.`;
                        await whatsappService.sendDirectMessage(sarprasUnit.phone, message);
                    }
                }
            } catch (notifErr) {
                console.error('Failed to send loan notification for unit:', unitId, notifErr);
            }
        }

        res.status(201).json({ message: 'Permohonan berhasil dikirim', requestId, count: loans.length });
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
        const isSuperAdmin = ['SUPER_ADMIN', 'BIDANG_IT'].includes(reviewer.role);

        if (!isSarpras && !isSuperAdmin) {
            return res.status(403).json({ error: 'Hanya Sarpras Unit (Admin Unit) atau Super Admin yang dapat menyetujui/menolak peminjaman ini' });
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
                asset: { include: { unit: true } },
                borrower: { select: { name: true, nip: true } },
                reviewedBy: { select: { name: true } },
                targetUnit: true
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
                asset: { include: { unit: true } },
                borrower: true,
                reviewedBy: true,
                targetUnit: true
            }
        });
        res.json(loan);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
