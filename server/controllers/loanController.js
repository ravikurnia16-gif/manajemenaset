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

        // Notify Approvers (Group by unitId)
        const unitIds = [...new Set(assets.map(a => a.unitId))];

        // Hardcoded NIPs
        const RAVI_NIP = '24071613';
        const SYAFRIAN_NIP = '25041676';

        for (const unitId of unitIds) {
            try {
                const unitAssets = assets.filter(a => a.unitId === unitId);
                const unit = unitAssets[0].unit;
                const isYayasan = unit?.name?.toLowerCase().includes('yayasan');

                let recipients = [];

                if (isYayasan) {
                    // Rule: Notifikasi ke Syafrian dan Ravi Kurnia
                    const admins = await prisma.user.findMany({
                        where: { nip: { in: [RAVI_NIP, SYAFRIAN_NIP] } }
                    });
                    recipients = admins;
                } else {
                    // Rule: Notifikasi ke Ravi Kurnia, Sarpras Unit dan Kepala Unit

                    // 1. Sarpras Unit (Admin Unit)
                    const sarpras = await prisma.user.findFirst({
                        where: { unitId, role: 'ADMIN_UNIT' }
                    });
                    if (sarpras) recipients.push(sarpras);

                    // 2. Kepala Unit (Head NIP)
                    if (unit.headNip) {
                        const head = await prisma.user.findUnique({
                            where: { nip: unit.headNip }
                        });
                        if (head) recipients.push(head);
                    }

                    // 3. Ravi Kurnia
                    const ravi = await prisma.user.findUnique({
                        where: { nip: RAVI_NIP }
                    });
                    if (ravi) recipients.push(ravi);
                }

                // Remove duplicates
                recipients = [...new Map(recipients.map(item => [item['id'], item])).values()];

                // Send Notifications
                for (const recipient of recipients) {
                    try {
                        await createNotification(
                            recipient.id,
                            `Permohonan Peminjaman (${isYayasan ? 'Yayasan' : unit.name})`,
                            `User ${req.user.name} mengajukan peminjaman ${unitAssets.length} aset.`,
                            'INFO',
                            '/peminjaman' // Adjusted to likely frontend route
                        );

                        if (recipient.phone) {
                            const assetListStr = unitAssets.map(a => `- ${a.name}`).join('\n');
                            const message = `Halo ${recipient.name},\nAda permohonan peminjaman aset dari ${req.user.name}:\n\n${assetListStr}\n\nKeperluan: ${purpose}\nKembali: ${expectedReturnDate}\n\nMohon tinjau di sistem.`;
                            await whatsappService.sendDirectMessage(recipient.phone, message);
                        }
                    } catch (e) { console.error(`Failed to notify ${recipient.name}:`, e); }
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

        const reviewer = await prisma.user.findUnique({ where: { id: reviewerId } });
        const RAVI_NIP = '24071613';

        const isYayasan = loan.asset.unit.name.toLowerCase().includes('yayasan');
        let isAuthorized = false;

        if (isYayasan) {
            // Khusus Yayasan: Hanya Ravi Kurnia
            if (reviewer.nip === RAVI_NIP) {
                isAuthorized = true;
            }
        } else {
            // Umum: Sarpras Unit ATAU Kepala Unit
            const isSarpras = reviewer.unitId === loan.asset.unitId && reviewer.role === 'ADMIN_UNIT';
            const isHead = reviewer.nip === loan.asset.unit.headNip;
            // Ravi/SuperAdmin as fallback/override? User said "Persetujuan oleh Sarpras Unit atau Kepala Unit". 
            // Typically SuperAdmin can do anything, but adhering strictly to request:
            if (isSarpras || isHead || reviewer.role === 'SUPER_ADMIN') {
                isAuthorized = true;
            }
        }

        if (!isAuthorized) {
            return res.status(403).json({ error: 'Anda tidak memiliki hak akses untuk memproses peminjaman ini.' });
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
            '/peminjaman'
        );

        // Also whatsapp borrower if possible
        const borrower = await prisma.user.findUnique({ where: { id: loan.borrowerId } });
        if (borrower && borrower.phone) {
            const message = `Halo ${borrower.name},\nPermohonan peminjaman aset "${loan.asset.name}" telah ${status === 'APPROVED' ? 'DISETUJUI' : 'DITOLAK'}.\n\nCek aplikasi untuk detail.`;
            await whatsappService.sendDirectMessage(borrower.phone, message);
        }

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
