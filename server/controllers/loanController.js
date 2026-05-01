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

        // Fetch requester details for the message
        const requester = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: { unit: true }
        });
        const requesterName = requester?.name || requester?.username || 'Peminjam';

        // Notify Sarpras Units (Group by unitId to avoid spam)
        const unitIds = [...new Set(assets.map(a => a.unitId))];
        for (const unitId of unitIds) {
            try {
                const unitAssets = assets.filter(a => a.unitId === unitId);
                const isYayasan = unitAssets[0]?.unit?.name?.toLowerCase().includes('yayasan');

                if (isYayasan) {
                    console.log(`[Loan Notif] Yayasan asset detected. Searching for strategic admins...`);
                    // Notify strategic roles specifically for Yayasan assets
                    const specialAdmins = await prisma.user.findMany({
                        where: {
                            OR: [
                                { position: { contains: 'Sarana dan Prasarana' } },
                                { position: { contains: 'Manajemen Aset' } },
                                { position: { contains: 'Manajemen Asset' } }
                            ],
                            phone: { not: null, not: '' }
                        }
                    });

                    console.log(`[Loan Notif] Found ${specialAdmins.length} special admins to notify.`);

                    for (const admin of specialAdmins) {
                        try {
                            await createNotification(
                                admin.id,
                                'Permohonan Peminjaman Aset Yayasan',
                                `User ${requesterName} meminjam ${unitAssets.length} aset Yayasan.`,
                                'URGENT',
                                '/peminjaman'
                            );

                            if (admin.phone) {
                                const assetListStr = unitAssets.map(a => `- ${a.name} (${a.code})`).join('\n');
                                const message = `Bismillah.\n📢 *PERMOHONAN PINJAM ASET YAYASAN*\n\nUser *${requesterName}* mengajukan peminjaman aset Yayasan:\n\n${assetListStr}\n\nKeperluan: ${purpose}\nKembali: ${expectedReturnDate}\n\nMohon tinjau di sistem.`;
                                await whatsappService.sendMessage(admin.phone, message);
                                console.log(`[Loan Notif] WA sent to ${admin.position}: ${admin.name}`);
                            }
                        } catch (e) {
                            console.error(`[Loan Notif] Failed to notify special admin ${admin.name}:`, e.message);
                        }
                    }
                } else {
                    // Notify all ADMIN_UNIT in the owner unit
                    const unitAdmins = await prisma.user.findMany({
                        where: { unitId, role: 'ADMIN_UNIT', phone: { not: null, not: '' } }
                    });

                    for (const admin of unitAdmins) {
                        try {
                            await createNotification(
                                admin.id,
                                'Permohonan Peminjaman Baru',
                                `User ${requesterName} meminjam ${unitAssets.length} aset dari unit Anda.`,
                                'INFO',
                                '/peminjaman'
                            );

                            if (admin.phone) {
                                const assetListStr = unitAssets.map(a => `- ${a.name} (${a.code})`).join('\n');
                                const message = `Bismillah.\n📦 *PERMOHONAN PINJAM ASET*\n\nUser *${requesterName}* mengajukan peminjaman aset dari unit Anda:\n\n${assetListStr}\n\nKeperluan: ${purpose}\nKembali: ${expectedReturnDate}\n\nMohon tinjau di sistem.`;
                                await whatsappService.sendMessage(admin.phone, message);
                            }
                        } catch (e) {
                            console.error(`[Loan Notif] Failed to notify admin ${admin.name}:`, e.message);
                        }
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
}

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
            return res.status(403).json({ error: 'Akses ditolak. Hanya Admin Unit dari unit pemilik aset (Pemberi Pinjaman) atau Super Admin yang dapat memberikan persetujuan.' });
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
        } else if (req.user.role === 'ADMIN_UNIT') {
            // Admin Unit sees:
            // 1. Loans where they are the borrower
            // 2. Loans where the asset belongs to their unit (Owner)
            // 3. Loans where their unit is the target unit (Borrower Unit)
            where.OR = [
                { borrowerId: req.user.id },
                { unitId: req.user.unitId },
                { targetUnitId: req.user.unitId }
            ];
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

/**
 * Automatically checks for overdue loans and sends reminders to borrowers.
 * Called daily by the system scheduler.
 */
exports.checkOverdueLoans = async () => {
    console.log(`[${new Date().toLocaleString()}] [Job] Checking for overdue asset loans...`);
    try {
        const now = new Date();

        // Find all loans currently BORROWED that have passed their expectedReturnDate
        const overdueLoans = await prisma.assetLoan.findMany({
            where: {
                status: 'BORROWED',
                expectedReturnDate: { lt: now }
            },
            include: {
                borrower: true,
                asset: true
            }
        });

        if (overdueLoans.length === 0) {
            console.log('[Job] No overdue loans found.');
            return;
        }

        console.log(`[Job] Found ${overdueLoans.length} overdue loans. Sending reminders...`);

        // Group by borrower to send a single WhatsApp if they have multiple overdue items
        const borrowerGroups = {};
        overdueLoans.forEach(loan => {
            if (!borrowerGroups[loan.borrowerId]) {
                borrowerGroups[loan.borrowerId] = {
                    user: loan.borrower,
                    loans: []
                };
            }
            borrowerGroups[loan.borrowerId].loans.push(loan);
        });

        for (const borrowerId in borrowerGroups) {
            const group = borrowerGroups[borrowerId];
            const borrower = group.user;
            const loans = group.loans;

            // 1. System Notification
            try {
                await createNotification(
                    borrower.id,
                    'Peringatan: Pengembalian Aset Terlambat',
                    `Anda memiliki ${loans.length} peminjaman aset yang telah melewati batas waktu pengembalian.`,
                    'URGENT',
                    '/peminjaman'
                );
            } catch (e) {
                console.error(`[Job Error] Failed to create system notif for ${borrower.name}:`, e.message);
            }

            // 2. WhatsApp Notification
            if (borrower.phone) {
                try {
                    const assetListStr = loans.map(l => `- ${l.asset.name} (Batas: ${new Date(l.expectedReturnDate).toLocaleDateString('id-ID')})`).join('\n');
                    const message = `Bismillah.\n⚠️ *PERINGATAN: PENGEMBALIAN ASET TERLAMBAT*\n\nHalo *${borrower.name}*,\n\nMohon segera mengembalikan aset berikut yang telah melewati batas waktu pengembalian:\n\n${assetListStr}\n\nMohon segera lakukan pengembalian dan konfirmasi di sistem Manajemen Aset. Terima kasih.`;

                    await whatsappService.sendMessage(borrower.phone, message);
                } catch (e) {
                    console.error(`[Job Error] Failed to send WA to ${borrower.name}:`, e.message);
                }
            }
        }

        console.log('[Job] Overdue loan checks completed.');
    } catch (error) {
        console.error('[Job Error] checkOverdueLoans failed:', error);
    }
};
