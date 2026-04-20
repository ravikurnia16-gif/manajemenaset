const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

// Helpers for automatic letter numbering
const generateLetterCode = async (type) => {
    const year = new Date().getFullYear();
    const count = await prisma.document.count({
        where: {
            createdAt: {
                gte: new Date(`${year}-01-01T00:00:00.000Z`),
                lt: new Date(`${year + 1}-01-01T00:00:00.000Z`)
            }
        }
    });
    
    // Example format: 800/001/SARPRAS/2026
    const prefix = type === 'SURAT_TUGAS' ? '800' : '000';
    const num = (count + 1).toString().padStart(3, '0');
    return `${prefix}/${num}/SARPRAS/${year}`;
};

exports.getAllDocuments = async (req, res) => {
    try {
        const userId = req.user.id;
        // Inbox includes documents waiting for this user's approval
        const documents = await prisma.document.findMany({
            include: {
                creator: true,
                approvals: {
                    include: { user: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        
        // Let frontend handle filtering by tabs (Inbox, Draft, Sent, Archive) using creatorId or approver steps.
        // In a real TNDE we'd map this perfectly, but returning all allows dynamic Client filtering for small systems.
        res.json(documents);
    } catch (err) {
        console.error("Error fetching documents:", err);
        res.status(500).json({ error: "Gagal mengambil data dokumen" });
    }
};

exports.createDocument = async (req, res) => {
    try {
        const { type, title, content, urgency, approverIds, destination, isManualCode, manualCode } = req.body;
        
        let finalCode = manualCode;
        if (!isManualCode) {
            finalCode = await generateLetterCode(type);
        }

        const docHash = crypto.randomBytes(16).toString('hex');

        // Note: approverIds is an array of user IDs taking part in approval hierarchy
        // [managerId, directorId] -> step 1, step 2

        const newDoc = await prisma.document.create({
            data: {
                code: finalCode || 'DRAFT-XXX',
                type: type || 'NOTA_DINAS',
                title,
                content,
                urgency: urgency || 'NORMAL',
                destination: destination || '',
                isManualCode: isManualCode || false,
                creatorId: req.user.id,
                senderName: req.user.name,
                hash: docHash,
                status: 'DRAFT',
            }
        });

        // Create approval chain if submitted directly, otherwise wait for explicitly clicking 'Kirim'
        if (approverIds && Array.isArray(approverIds) && approverIds.length > 0) {
            const approvalData = approverIds.map((uId, idx) => ({
                documentId: newDoc.id,
                userId: uId,
                step: idx + 1,
                // The last person is signing, others are parafing
                type: idx === approverIds.length - 1 ? 'SIGNATURE' : 'PARAF'  
            }));
            
            await prisma.documentApproval.createMany({ data: approvalData });
        }

        res.status(201).json(newDoc);
    } catch (err) {
        console.error("Error creating document:", err);
        res.status(500).json({ error: "Gagal membuat draf surat" });
    }
};

exports.submitDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const doc = await prisma.document.findUnique({
            where: { id: parseInt(id) },
            include: { approvals: { orderBy: { step: 'asc' } } }
        });

        if (!doc) return res.status(404).json({ error: "Dokumen tidak ditemukan" });
        if (doc.status !== 'DRAFT') return res.status(400).json({ error: "Hanya Draf yang bisa diajukan" });

        // Bypass: Jika tidak ada approver, langsung SIGNED.
        if (!doc.approvals || doc.approvals.length === 0) {
            const updated = await prisma.document.update({
                where: { id: parseInt(id) },
                data: { status: 'SIGNED' }
            });
            return res.json(updated);
        }

        // Jika ada approver
        const firstStep = doc.approvals[0];
        const initialStatus = firstStep.type === 'SIGNATURE' ? 'WAITING_SIGN' : 'WAITING_PARAF';
        
        const updated = await prisma.document.update({
            where: { id: parseInt(id) },
            data: { status: initialStatus }
        });
        res.json(updated);
    } catch(err) {
        res.status(500).json({ error: "Gagal mengajukan surat" });
    }
};

exports.approveDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const doc = await prisma.document.findUnique({
            where: { id: parseInt(id) },
            include: { approvals: { orderBy: { step: 'asc' } } }
        });

        if (!doc) return res.status(404).json({ error: "Dokumen tidak ditemukan" });

        // Cari step yang pending untuk user ini
        const pendingApproval = doc.approvals.find(a => a.userId === userId && a.status === 'PENDING');
        if (!pendingApproval) return res.status(400).json({ error: "Bukan giliran Anda atau sudah disetujui" });

        // Update step ini
        await prisma.documentApproval.update({
            where: { id: pendingApproval.id },
            data: { status: 'APPROVED', signature: new Date().toISOString() }
        });

        // Cek step berikutnya
        const currentStepIndex = doc.approvals.findIndex(a => a.id === pendingApproval.id);
        const nextStep = doc.approvals[currentStepIndex + 1];

        if (nextStep) {
            const nextStatus = nextStep.type === 'SIGNATURE' ? 'WAITING_SIGN' : 'WAITING_PARAF';
            await prisma.document.update({
                where: { id: parseInt(id) },
                data: { status: nextStatus }
            });
        } else {
            // Selesai
            await prisma.document.update({
                where: { id: parseInt(id) },
                data: { status: 'SIGNED' }
            });
        }

        res.json({ message: "Berhasil disetujui" });
    } catch(err) {
        res.status(500).json({ error: "Gagal menyetujui surat" });
    }
};

exports.rejectDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const pendingApproval = await prisma.documentApproval.findFirst({
            where: { documentId: parseInt(id), userId, status: 'PENDING' }
        });
        
        if (pendingApproval) {
            await prisma.documentApproval.update({
                where: { id: pendingApproval.id },
                data: { status: 'REJECTED' }
            });
        }

        await prisma.document.update({
            where: { id: parseInt(id) },
            data: { status: 'REJECTED' }
        });

        res.json({ message: "Dokumen ditolak" });
    } catch(err) {
        res.status(500).json({ error: "Gagal menolak surat" });
    }
};

exports.validateDocumentQR = async (req, res) => {
    try {
        const { hash } = req.params;
        const doc = await prisma.document.findUnique({
            where: { hash },
            include: {
                creator: { select: { name: true, nip: true, position: true } },
                approvals: {
                    include: { user: { select: { name: true, nip: true, position: true } } },
                    orderBy: { step: 'asc' }
                }
            }
        });

        if (!doc) {
            return res.status(404).json({ valid: false, error: "QR Code tidak valid atau dokumen tidak ditemukan." });
        }

        if (doc.status !== 'SIGNED') {
            return res.status(400).json({ valid: false, error: "Dokumen ini belum disahkan secara final." });
        }

        res.json({ valid: true, document: doc });
    } catch(err) {
        console.error("Error validating QR:", err);
        res.status(500).json({ error: "Terjadi kesalahan pada validasi" });
    }
};
