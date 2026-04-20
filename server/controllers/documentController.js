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

exports.updateDocumentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'WAITING_PARAF', 'SIGNED', etc

        const doc = await prisma.document.update({
            where: { id: parseInt(id) },
            data: { status }
        });

        res.json(doc);
    } catch (err) {
        console.error("Error updating document:", err);
        res.status(500).json({ error: "Gagal memperbarui status dokumen" });
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
