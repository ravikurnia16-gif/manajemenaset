const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

const numberingService = require('../services/numberingService');
const pdfSignatureService = require('../services/pdfSignatureService');

// Helper for incoming mail code
const generateMailCode = async () => {
    const year = new Date().getFullYear();
    const count = await prisma.incomingMail.count({
        where: {
            createdAt: {
                gte: new Date(`${year}-01-01T00:00:00.000Z`),
                lt: new Date(`${year + 1}-01-01T00:00:00.000Z`)
            }
        }
    });
    const num = (count + 1).toString().padStart(3, '0');
    return `SM/${num}/SARPRAS/${year}`;
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

exports.getDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const doc = await prisma.document.findUnique({
            where: { id: parseInt(id) },
            include: {
                creator: { select: { id: true, name: true, nip: true, position: true, signatureImage: true } },
                approvals: {
                    include: { user: { select: { id: true, name: true, nip: true, position: true, signatureImage: true } } },
                    orderBy: { step: 'asc' }
                }
            }
        });
        if (!doc) return res.status(404).json({ error: "Dokumen tidak ditemukan" });
        res.json(doc);
    } catch (err) {
        console.error("Error fetching document:", err);
        res.status(500).json({ error: "Gagal mengambil detail dokumen" });
    }
};

exports.createDocument = async (req, res) => {
    try {
        const { type, title, content, urgency, approverIds, destination, isManualCode, manualCode, unitId, categoryId, version, reviewDate } = req.body;
        
        let finalCode = manualCode;
        let unitCode = 'PST';
        if (unitId) {
             const unit = await prisma.unit.findUnique({ where: { id: parseInt(unitId) } });
             if (unit) unitCode = unit.code;
        }

        if (!isManualCode) {
            // type acts as category code for simple setup
            finalCode = await numberingService.generateDocumentNumber(type, unitCode, version || 1);
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
                unitId: unitId ? parseInt(unitId) : null,
                categoryId: categoryId ? parseInt(categoryId) : null,
                version: version || 1,
                reviewDate: reviewDate ? new Date(reviewDate) : null,
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

exports.updateDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, type, urgency, destination } = req.body;

        const doc = await prisma.document.findUnique({ where: { id: parseInt(id) } });
        if (!doc) return res.status(404).json({ error: "Dokumen tidak ditemukan" });
        if (doc.status !== 'DRAFT') return res.status(400).json({ error: "Hanya Draf yang bisa diedit" });

        const updated = await prisma.document.update({
            where: { id: parseInt(id) },
            data: {
                ...(title && { title }),
                ...(content && { content }),
                ...(type && { type }),
                ...(urgency && { urgency }),
                ...(destination !== undefined && { destination }),
            }
        });
        res.json(updated);
    } catch (err) {
        console.error("Error updating document:", err);
        res.status(500).json({ error: "Gagal memperbarui dokumen" });
    }
};

exports.deleteDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const doc = await prisma.document.findUnique({ where: { id: parseInt(id) } });
        if (!doc) return res.status(404).json({ error: "Dokumen tidak ditemukan" });
        if (doc.status !== 'DRAFT') return res.status(400).json({ error: "Hanya Draf yang bisa dihapus" });

        await prisma.documentApproval.deleteMany({ where: { documentId: parseInt(id) } });
        await prisma.document.delete({ where: { id: parseInt(id) } });
        res.json({ message: "Dokumen berhasil dihapus" });
    } catch (err) {
        console.error("Error deleting document:", err);
        res.status(500).json({ error: "Gagal menghapus dokumen" });
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
        const { signature, pdfBase64 } = req.body; // Base64 signature image from canvas, pdfBase64 for signing

        const doc = await prisma.document.findUnique({
            where: { id: parseInt(id) },
            include: { approvals: { orderBy: { step: 'asc' } } }
        });

        if (!doc) return res.status(404).json({ error: "Dokumen tidak ditemukan" });

        // Cari step yang pending untuk user ini
        const pendingApproval = doc.approvals.find(a => a.userId === userId && a.status === 'PENDING');
        if (!pendingApproval) return res.status(400).json({ error: "Bukan giliran Anda atau sudah disetujui" });

        // If a signature is provided from the canvas, use it
        // Otherwise fall back to user's stored signature or timestamp
        let signatureData = signature || null;
        if (!signatureData) {
            const user = await prisma.user.findUnique({ where: { id: userId }, select: { signatureImage: true } });
            signatureData = user?.signatureImage || new Date().toISOString();
        }

        // Update step ini
        await prisma.documentApproval.update({
            where: { id: pendingApproval.id },
            data: { status: 'APPROVED', signature: signatureData }
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
            res.json({ message: "Berhasil diparaf, diteruskan ke pemeriksa selanjutnya" });
        } else {
            // Selesai - jika ini langkah terakhir (Tanda Tangan)
            if (pdfBase64) {
                 await pdfSignatureService.approveAndSignDocument(parseInt(id), userId, pdfBase64);
            } else {
                 // Fallback if no PDF provided from frontend
                 await prisma.document.update({
                    where: { id: parseInt(id) },
                    data: { status: 'SIGNED' }
                 });
            }
            res.json({ message: "Berhasil ditandatangani dan disahkan" });
        }
    } catch(err) {
        console.error("Error approving document:", err);
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

// =============================================
// SIGNATURE MANAGEMENT
// =============================================

exports.uploadSignature = async (req, res) => {
    try {
        const userId = req.user.id;
        const { signatureImage } = req.body;

        if (!signatureImage) {
            return res.status(400).json({ error: "Data tanda tangan tidak ditemukan" });
        }

        await prisma.user.update({
            where: { id: userId },
            data: { signatureImage }
        });

        res.json({ message: "Tanda tangan berhasil disimpan" });
    } catch (err) {
        console.error("Error uploading signature:", err);
        res.status(500).json({ error: "Gagal menyimpan tanda tangan" });
    }
};

exports.getMySignature = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { signatureImage: true }
        });
        res.json({ signatureImage: user?.signatureImage || null });
    } catch (err) {
        console.error("Error getting signature:", err);
        res.status(500).json({ error: "Gagal mengambil tanda tangan" });
    }
};

// =============================================
// INCOMING MAIL (SURAT MASUK)
// =============================================

exports.getAllIncomingMail = async (req, res) => {
    try {
        const mails = await prisma.incomingMail.findMany({
            include: {
                receivedBy: { select: { id: true, name: true, position: true } }
            },
            orderBy: { receivedDate: 'desc' }
        });
        res.json(mails);
    } catch (err) {
        console.error("Error fetching incoming mail:", err);
        res.status(500).json({ error: "Gagal mengambil data surat masuk" });
    }
};

exports.createIncomingMail = async (req, res) => {
    try {
        const {
            senderName, senderOrg, senderAddress, mailNumber,
            mailDate, subject, type, urgency, description,
            attachmentUrl, attachmentName, disposition
        } = req.body;

        const code = await generateMailCode();

        const mail = await prisma.incomingMail.create({
            data: {
                code,
                senderName,
                senderOrg: senderOrg || null,
                senderAddress: senderAddress || null,
                mailNumber: mailNumber || null,
                mailDate: new Date(mailDate),
                subject,
                type: type || 'UMUM',
                urgency: urgency || 'NORMAL',
                description: description || null,
                attachmentUrl: attachmentUrl || null,
                attachmentName: attachmentName || null,
                disposition: disposition || null,
                receivedById: req.user.id,
            },
            include: {
                receivedBy: { select: { id: true, name: true, position: true } }
            }
        });

        res.status(201).json(mail);
    } catch (err) {
        console.error("Error creating incoming mail:", err);
        res.status(500).json({ error: "Gagal menyimpan surat masuk" });
    }
};

exports.updateIncomingMail = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, disposition, ...rest } = req.body;

        const mail = await prisma.incomingMail.update({
            where: { id: parseInt(id) },
            data: {
                ...(status && { status }),
                ...(disposition !== undefined && { disposition }),
                ...rest
            },
            include: {
                receivedBy: { select: { id: true, name: true, position: true } }
            }
        });

        res.json(mail);
    } catch (err) {
        console.error("Error updating incoming mail:", err);
        res.status(500).json({ error: "Gagal memperbarui surat masuk" });
    }
};

exports.deleteIncomingMail = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.incomingMail.delete({ where: { id: parseInt(id) } });
        res.json({ message: "Surat masuk berhasil dihapus" });
    } catch (err) {
        console.error("Error deleting incoming mail:", err);
        res.status(500).json({ error: "Gagal menghapus surat masuk" });
    }
};
