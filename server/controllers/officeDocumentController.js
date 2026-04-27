const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { generateDocumentNumber, getCategoryCodes } = require('../services/documentNumberingService');
const { generateVerificationQR, generateSuratPDF, generateBASTMouPDF, generateSuratTugasPDF, generateSuratPesananPDF, generateInvoicePDF, generateSuratEdaranPDF, generateKeputusanPDF } = require('../services/officePdfService');
const crypto = require('crypto');

// ==================== SURAT MASUK ====================

/**
 * GET /api/office-documents/incoming
 * List all incoming mail (Surat Masuk)
 */
exports.getIncomingMail = async (req, res) => {
    try {
        const { search, page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = { type: 'SURAT_MASUK' };
        if (search) {
            where.OR = [
                { subject: { contains: search } },
                { senderName: { contains: search } },
                { referenceNumber: { contains: search } },
            ];
        }

        const [documents, total] = await Promise.all([
            prisma.officeDocument.findMany({
                where,
                include: { author: { select: { id: true, name: true, username: true } } },
                orderBy: { receivedDate: 'desc' },
                skip,
                take: parseInt(limit),
            }),
            prisma.officeDocument.count({ where }),
        ]);

        res.json({ documents, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (error) {
        console.error('getIncomingMail error:', error);
        res.status(500).json({ error: 'Failed to fetch incoming mail' });
    }
};

/**
 * POST /api/office-documents/incoming
 * Create a new incoming mail entry
 */
exports.createIncomingMail = async (req, res) => {
    try {
        const { subject, senderName, senderOrg, referenceNumber, receivedDate, category, priority, content } = req.body;
        const fileUrl = req.fileUrl || req.body.fileUrl; // From multer or body

        const doc = await prisma.officeDocument.create({
            data: {
                type: 'SURAT_MASUK',
                subject,
                senderName,
                senderOrg,
                referenceNumber,
                receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
                category,
                priority: priority || 'BIASA',
                content,
                fileUrl,
                authorId: req.user.id,
                status: 'APPROVED', // Surat masuk doesn't need approval
            },
            include: { author: { select: { id: true, name: true } } },
        });

        res.status(201).json(doc);
    } catch (error) {
        console.error('createIncomingMail error:', error);
        res.status(500).json({ error: 'Failed to create incoming mail' });
    }
};

// ==================== SURAT KELUAR ====================

/**
 * GET /api/office-documents/outgoing
 * List all outgoing documents (Surat Keluar, BAST, MOU)
 */
exports.getOutgoingDocuments = async (req, res) => {
    try {
        const { search, type, typeGroup, status, page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = { type: { not: 'SURAT_MASUK' } };
        
        if (typeGroup === 'OUTGOING_STANDARD') {
            where.type = { in: ['SURAT_KELUAR', 'BAST'] };
        }

        if (type) where.type = type;
        if (status) where.status = status;
        if (search) {
            where.OR = [
                { subject: { contains: search } },
                { number: { contains: search } },
                { category: { contains: search } },
            ];
        }

        const [documents, total] = await Promise.all([
            prisma.officeDocument.findMany({
                where,
                include: {
                    author: { select: { id: true, name: true, username: true } },
                    signedBy: { select: { id: true, name: true, nip: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit),
            }),
            prisma.officeDocument.count({ where }),
        ]);

        res.json({ documents, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (error) {
        console.error('getOutgoingDocuments error:', error);
        res.status(500).json({ error: 'Failed to fetch outgoing documents' });
    }
};

/**
 * POST /api/office-documents/outgoing
 * Create a new outgoing document (draft)
 */
exports.createOutgoingDocument = async (req, res) => {
    try {
        const {
            type = 'SURAT_KELUAR', subject, content, category, priority,
            party1Name, party1Title, party1Org, party1Address,
            party2Name, party2Title, party2Org, party2Address,
        } = req.body;

        const doc = await prisma.officeDocument.create({
            data: {
                type,
                subject,
                content,
                category: category || 'Lainnya',
                priority: priority || 'BIASA',
                authorId: req.user.id,
                status: 'DRAFT',
                party1Name,
                party1Title,
                party1Org,
                party1Address,
                party2Name,
                party2Title,
                party2Org,
                party2Address,
            },
            include: {
                author: { select: { id: true, name: true } },
            },
        });

        res.status(201).json(doc);
    } catch (error) {
        console.error('createOutgoingDocument error:', error);
        res.status(500).json({ error: 'Failed to create document' });
    }
};

// ==================== SINGLE DOCUMENT ====================

/**
 * GET /api/office-documents/:id
 * Get a single document by ID
 */
exports.getDocumentById = async (req, res) => {
    try {
        const doc = await prisma.officeDocument.findUnique({
            where: { id: parseInt(req.params.id) },
            include: {
                author: { select: { id: true, name: true, username: true, nip: true, position: true } },
                signedBy: { select: { id: true, name: true, nip: true, position: true } },
            },
        });

        if (!doc) return res.status(404).json({ error: 'Document not found' });
        res.json(doc);
    } catch (error) {
        console.error('getDocumentById error:', error);
        res.status(500).json({ error: 'Failed to fetch document' });
    }
};

/**
 * PUT /api/office-documents/:id
 * Update a document (only if DRAFT)
 */
exports.updateDocument = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existing = await prisma.officeDocument.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Document not found' });
        if (existing.status !== 'DRAFT' && existing.status !== 'REJECTED') {
            return res.status(400).json({ error: 'Dokumen hanya bisa diedit saat status DRAFT atau REJECTED' });
        }

        const {
            subject, content, category, priority, type,
            senderName, senderOrg, referenceNumber, receivedDate,
            party1Name, party1Title, party1Org, party1Address,
            party2Name, party2Title, party2Org, party2Address,
        } = req.body;
        const fileUrl = req.fileUrl || req.body.fileUrl;

        const updated = await prisma.officeDocument.update({
            where: { id },
            data: {
                subject, content, category, priority, type,
                senderName, senderOrg, referenceNumber,
                receivedDate: receivedDate ? new Date(receivedDate) : undefined,
                party1Name, party1Title, party1Org, party1Address,
                party2Name, party2Title, party2Org, party2Address,
                ...(fileUrl && { fileUrl }), // Only update fileUrl if a new one is provided
                status: existing.status === 'REJECTED' ? 'DRAFT' : undefined,
            },
            include: {
                author: { select: { id: true, name: true } },
                signedBy: { select: { id: true, name: true, nip: true } },
            },
        });

        res.json(updated);
    } catch (error) {
        console.error('updateDocument error:', error);
        res.status(500).json({ error: 'Failed to update document' });
    }
};

/**
 * DELETE /api/office-documents/:id
 * Delete a document (only if DRAFT)
 */
exports.deleteDocument = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existing = await prisma.officeDocument.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Document not found' });
        
        // As per request, deletion is now restricted via route to SUPER_ADMIN.
        // We allow SUPER_ADMIN to delete documents regardless of status.
        
        await prisma.officeDocument.delete({ where: { id } });
        res.json({ message: 'Document deleted' });
    } catch (error) {
        console.error('deleteDocument error:', error);
        res.status(500).json({ error: 'Failed to delete document' });
    }
};

// ==================== WORKFLOW ====================

/**
 * POST /api/office-documents/:id/submit
 * Submit document for approval (DRAFT -> PENDING_APPROVAL)
 */
exports.submitForApproval = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const doc = await prisma.officeDocument.findUnique({ where: { id } });
        if (!doc) return res.status(404).json({ error: 'Document not found' });
        if (doc.status !== 'DRAFT') {
            return res.status(400).json({ error: 'Dokumen harus berstatus DRAFT untuk diajukan' });
        }

        // Generate document number upon submission
        const number = await generateDocumentNumber(doc.category, doc.type);

        // Generate QR verification hash
        const qrHash = crypto.createHash('sha256')
            .update(`${doc.uuid}-${number}-${Date.now()}`)
            .digest('hex')
            .substring(0, 16);

        const updated = await prisma.officeDocument.update({
            where: { id },
            data: {
                status: 'PENDING_APPROVAL',
                number,
                qrCodeData: qrHash,
            },
            include: {
                author: { select: { id: true, name: true } },
            },
        });

        res.json(updated);
    } catch (error) {
        console.error('submitForApproval error:', error);
        res.status(500).json({ error: 'Failed to submit document' });
    }
};

/**
 * POST /api/office-documents/:id/approve
 * Approve and sign a document (PENDING_APPROVAL -> SIGNED)
 * Only Kabid Sarpras can do this
 */
exports.approveAndSign = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { signatureData, approvalNote } = req.body;

        const doc = await prisma.officeDocument.findUnique({ where: { id } });
        if (!doc) return res.status(404).json({ error: 'Document not found' });
        if (doc.status !== 'PENDING_APPROVAL') {
            return res.status(400).json({ error: 'Dokumen harus berstatus PENDING_APPROVAL' });
        }

        // Generate QR code for verification
        const qrCodeData = await generateVerificationQR(doc.uuid);

        // Build update data
        const updateData = {
            status: 'SIGNED',
            signedById: req.user.id,
            signedAt: new Date(),
            signatureData: signatureData || null,
            qrCodeData, // Save QR data to DB
            approvalNote,
        };

        // For BAST/Serah Terima: Kabid approval = Pihak Pertama signature (TTE)
        const isBAST = ['BAST', 'MOU'].includes(doc.type) || (doc.type === 'SURAT_KELUAR' && ['Berita Acara', 'Serah Terima Barang'].includes(doc.category));
        if (isBAST) {
            updateData.party1SignedAt = new Date();
        }

        const updated = await prisma.officeDocument.update({
            where: { id },
            data: updateData,
            include: {
                author: { select: { id: true, name: true } },
                signedBy: { select: { id: true, name: true, nip: true } },
            },
        });

        res.json(updated);
    } catch (error) {
        console.error('approveAndSign error:', error);
        res.status(500).json({ error: 'Failed to approve document' });
    }
};

/**
 * POST /api/office-documents/:id/reject
 * Reject a document
 */
exports.rejectDocument = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { rejectionReason } = req.body;

        const doc = await prisma.officeDocument.findUnique({ where: { id } });
        if (!doc) return res.status(404).json({ error: 'Document not found' });
        if (doc.status !== 'PENDING_APPROVAL') {
            return res.status(400).json({ error: 'Dokumen harus berstatus PENDING_APPROVAL' });
        }

        const updated = await prisma.officeDocument.update({
            where: { id },
            data: {
                status: 'REJECTED',
                rejectionReason,
            },
        });

        res.json(updated);
    } catch (error) {
        console.error('rejectDocument error:', error);
        res.status(500).json({ error: 'Failed to reject document' });
    }
};

// ==================== MULTI-PARTY SIGNATURE ====================

/**
 * POST /api/office-documents/:id/sign-party
 * Sign as Party 1 or Party 2 (for BAST/MOU)
 */
exports.signAsParty = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { party, signatureData, name, title, org, address } = req.body;

        if (!['party1', 'party2'].includes(party)) {
            return res.status(400).json({ error: 'Party must be "party1" or "party2"' });
        }

        const doc = await prisma.officeDocument.findUnique({ where: { id } });
        if (!doc) return res.status(404).json({ error: 'Document not found' });
        if (!['BAST', 'MOU'].includes(doc.type) && !(doc.type === 'SURAT_KELUAR' && ['Berita Acara', 'Serah Terima Barang', 'MOU'].includes(doc.category))) {
            return res.status(400).json({ error: 'Multi-party signature only for BAST/MOU or related Surat Keluar categories' });
        }

        const data = {};
        if (party === 'party1') {
            data.party1Signature = signatureData;
            data.party1SignedAt = new Date();
            if (name) data.party1Name = name;
            if (title) data.party1Title = title;
            if (org) data.party1Org = org;
            if (address) data.party1Address = address;
        } else {
            data.party2Signature = signatureData;
            data.party2SignedAt = new Date();
            if (name) data.party2Name = name;
            if (title) data.party2Title = title;
            if (org) data.party2Org = org;
            if (address) data.party2Address = address;
        }

        // If both parties have signed, mark as SIGNED
        const updated = await prisma.officeDocument.update({
            where: { id },
            data,
        });

        // Check if both signed now
        const refreshed = await prisma.officeDocument.findUnique({ where: { id } });
        // party1 can sign without signatureData (Electronic Sign), party2 must have signatureData (Pad)
        const p1Signed = refreshed.party1SignedAt || refreshed.party1Signature;
        const p2Signed = refreshed.party2SignedAt || refreshed.party2Signature;

        if (p1Signed && p2Signed && refreshed.status !== 'SIGNED') {
            await prisma.officeDocument.update({
                where: { id },
                data: { status: 'SIGNED', signedAt: new Date() },
            });
        }

        const result = await prisma.officeDocument.findUnique({
            where: { id },
            include: {
                author: { select: { id: true, name: true } },
                signedBy: { select: { id: true, name: true, nip: true } },
            },
        });

        res.json(result);
    } catch (error) {
        console.error('signAsParty error:', error);
        res.status(500).json({ error: 'Failed to sign document' });
    }
};

// ==================== PDF GENERATION ====================

/**
 * GET /api/office-documents/:id/pdf
 * Generate and download PDF for a document
 */
exports.generatePDF = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const doc = await prisma.officeDocument.findUnique({
            where: { id },
            include: {
                author: { select: { id: true, name: true, nip: true, position: true } },
                signedBy: { select: { id: true, name: true, nip: true, position: true } },
            },
        });

        if (!doc) return res.status(404).json({ error: 'Document not found' });

        // Get org settings
        const setting = await prisma.setting.findUnique({ where: { id: 1 } });

        let pdfBytes;
        if (['BAST', 'MOU'].includes(doc.type) || (doc.type === 'SURAT_KELUAR' && ['Berita Acara', 'Serah Terima Barang'].includes(doc.category))) {
            pdfBytes = await generateBASTMouPDF(doc, setting);
        } else if (doc.type === 'SURAT_PESANAN' || doc.category === 'Pesanan') {
            pdfBytes = await generateSuratPesananPDF(doc, setting);
        } else if (doc.type === 'INVOICE' || doc.category === 'Invoice') {
            pdfBytes = await generateInvoicePDF(doc, setting);
        } else if (doc.category === 'Edaran') {
            pdfBytes = await generateSuratEdaranPDF(doc, setting);
        } else if (doc.category === 'Keputusan') {
            pdfBytes = await generateKeputusanPDF(doc, setting);
        } else if (doc.type === 'SURAT_KELUAR' && doc.category === 'Tugas') {
            pdfBytes = await generateSuratTugasPDF(doc, setting);
        } else {
            pdfBytes = await generateSuratPDF(doc, setting);
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${doc.number || 'draft'}.pdf"`);
        res.send(Buffer.from(pdfBytes));
    } catch (error) {
        console.error('generatePDF error:', error);
        res.status(500).json({ error: 'Failed to generate PDF', details: error.message, stack: error.stack });
    }
};

// ==================== PUBLIC VERIFICATION ====================

/**
 * GET /api/office-documents/verify/:uuid
 * Public endpoint to verify document authenticity via QR code
 */
exports.verifyDocument = async (req, res) => {
    try {
        const doc = await prisma.officeDocument.findUnique({
            where: { uuid: req.params.uuid },
            select: {
                id: true,
                uuid: true,
                type: true,
                number: true,
                subject: true,
                date: true,
                status: true,
                category: true,
                signedAt: true,
                signedBy: { select: { name: true, nip: true, position: true } },
                party1Name: true,
                party1SignedAt: true,
                party2Name: true,
                party2SignedAt: true,
                qrCodeData: true,
            },
        });

        if (!doc) return res.status(404).json({ error: 'Dokumen tidak ditemukan', valid: false });

        res.json({
            valid: doc.status === 'SIGNED',
            document: doc,
        });
    } catch (error) {
        console.error('verifyDocument error:', error);
        res.status(500).json({ error: 'Verification failed', valid: false });
    }
};

// ==================== STATISTICS ====================

/**
 * GET /api/office-documents/stats
 * Get E-Office dashboard statistics
 */
exports.getStats = async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [
            totalIncoming,
            totalOutgoing,
            pendingApproval,
            signedThisMonth,
            recentDocuments,
        ] = await Promise.all([
            prisma.officeDocument.count({ where: { type: 'SURAT_MASUK' } }),
            prisma.officeDocument.count({ 
                where: { 
                    type: { not: 'SURAT_MASUK' } 
                } 
            }),
            prisma.officeDocument.count({ where: { status: 'PENDING_APPROVAL' } }),
            prisma.officeDocument.count({
                where: {
                    status: 'SIGNED',
                    signedAt: { gte: startOfMonth },
                },
            }),
            prisma.officeDocument.findMany({
                take: 5,
                orderBy: { updatedAt: 'desc' },
                include: {
                    author: { select: { id: true, name: true } },
                },
            }),
        ]);

        res.json({
            totalIncoming,
            totalOutgoing,
            pendingApproval,
            signedThisMonth,
            recentDocuments,
        });
    } catch (error) {
        console.error('getStats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
};

/**
 * Scheduler Task: Check for due invoices and send reminders
 */
exports.checkInvoiceDueDates = async () => {
    try {
        const setting = await prisma.setting.findUnique({ where: { id: 1 } });
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        
        // Find all invoices
        const invoices = await prisma.officeDocument.findMany({
            where: {
                type: 'INVOICE',
                status: 'SIGNED',
            }
        });

        for (const doc of invoices) {
            let content = {};
            try { content = JSON.parse(doc.content || '{}'); } catch (e) {}
            
            // Skip if already paid
            if (content.paymentStatus === 'PAID') continue;
            
            const dueDate = content.dueDate ? new Date(content.dueDate) : null;
            if (!dueDate) continue;
            dueDate.setHours(0, 0, 0, 0);

            const diffTime = dueDate.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            // Remind at: 3 days before, on due date, and 1 day after (overdue)
            if ([3, 0, -1].includes(diffDays)) {
                const phone = doc.party2Title;
                if (!phone) continue;

                const publicUrl = `https://sarpras.dareliman.or.id/verify/${doc.uuid}`;
                
                let title = "🔔 PENGINGAT TAGIHAN";
                if (diffDays === 0) title = "⚠️ JATUH TEMPO HARI INI";
                if (diffDays < 0) title = "❌ TAGIHAN MELEWATI JATUH TEMPO";

                const message = `*${title}*\n` +
                    `_Sistem Manajemen Aset & Dokumen_\n\n` +
                    `Halo *${doc.party2Name}*,\n` +
                    `Kami menginformasikan bahwa tagihan Anda belum terlunasi:\n\n` +
                    `▫️ *No:* ${doc.number || '-'}\n` +
                    `▫️ *Perihal:* ${doc.subject}\n` +
                    `▫️ *Jatuh Tempo:* ${dueDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}\n\n` +
                    `Silakan unduh invoice & lakukan pembayaran di:\n` +
                    `${publicUrl}\n\n` +
                    `Abaikan jika sudah membayar.\n` +
                    `Terima kasih.`;

                await require('../services/whatsappService').sendMessage(phone, message);
            }
        }
    } catch (error) {
        console.error('checkInvoiceDueDates error:', error);
    }
};

/**
 * PATCH /api/office-documents/:id/payment-status
 * Update payment status for INVOICE
 */
exports.updatePaymentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'PAID' or 'UNPAID'

        const doc = await prisma.officeDocument.findUnique({ where: { id: parseInt(id) } });
        if (!doc || doc.type !== 'INVOICE') {
            return res.status(404).json({ error: 'Invoice tidak ditemukan' });
        }

        let content = {};
        try {
            content = JSON.parse(doc.content || '{}');
        } catch (e) {}

        content.paymentStatus = status;

        const updated = await prisma.officeDocument.update({
            where: { id: parseInt(id) },
            data: { content: JSON.stringify(content) }
        });

        res.json({ message: 'Status pembayaran berhasil diperbarui', doc: updated });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * POST /api/office-documents/:id/send-wa
 * Manually send invoice notification via WhatsApp
 */
exports.sendInvoiceWA = async (req, res) => {
    try {
        const { id } = req.params;
        const { whatsappService } = require('../services/whatsappService');
        const setting = await prisma.setting.findUnique({ where: { id: 1 } });
        
        const doc = await prisma.officeDocument.findUnique({
            where: { id: parseInt(id) }
        });

        if (!doc) return res.status(404).json({ error: 'Invoice tidak ditemukan' });

        const phone = doc.party2Title; // We store phone in party2Title
        if (!phone) return res.status(400).json({ error: 'Nomor HP penerima tidak ditemukan' });

        let content = {};
        try { content = JSON.parse(doc.content || '{}'); } catch (e) {}

        const publicUrl = `https://sarpras.dareliman.or.id/verify/${doc.uuid}`;
        
        const message = `*INVOICE TAGIHAN - ${setting?.orgName || 'SARPRAS'}*\n\n` +
            `Halo Bapak/Ibu *${doc.party2Name}*,\n` +
            `Berikut adalah rincian tagihan Anda:\n\n` +
            `▫️ *No. Invoice:* ${doc.number || '-'}\n` +
            `▫️ *Perihal:* ${doc.subject}\n` +
            `▫️ *Jatuh Tempo:* ${content.dueDate ? new Date(content.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}\n\n` +
            `Silakan unduh dokumen invoice resmi pada link berikut:\n` +
            `${publicUrl}\n\n` +
            `Mohon segera melakukan pembayaran. Abaikan pesan ini jika Anda sudah melunasi tagihan.\n` +
            `Terima kasih.`;

        const result = await require('../services/whatsappService').sendMessage(phone, message);
        res.json({ message: 'Notifikasi WhatsApp sedang dikirim...', result });
    } catch (error) {
        console.error('sendInvoiceWA error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * GET /api/office-documents/verify/:uuid/pdf
 * Public PDF download
 */
exports.generatePublicPDF = async (req, res) => {
    try {
        const { uuid } = req.params;
        const doc = await prisma.officeDocument.findUnique({
            where: { uuid },
            include: {
                author: { select: { id: true, name: true, nip: true, position: true } },
                signedBy: { select: { id: true, name: true, nip: true, position: true } },
            },
        });

        if (!doc) return res.status(404).send('Document not found');
        
        const setting = await prisma.setting.findUnique({ where: { id: 1 } });

        let pdfBytes;
        if (['BAST', 'MOU'].includes(doc.type) || (doc.type === 'SURAT_KELUAR' && ['Berita Acara', 'Serah Terima Barang'].includes(doc.category))) {
            pdfBytes = await generateBASTMouPDF(doc, setting);
        } else if (doc.type === 'SURAT_PESANAN' || doc.category === 'Pesanan') {
            pdfBytes = await generateSuratPesananPDF(doc, setting);
        } else if (doc.type === 'INVOICE' || doc.category === 'Invoice') {
            pdfBytes = await generateInvoicePDF(doc, setting);
        } else if (doc.category === 'Edaran') {
            pdfBytes = await generateSuratEdaranPDF(doc, setting);
        } else if (doc.category === 'Keputusan') {
            pdfBytes = await generateKeputusanPDF(doc, setting);
        } else if (doc.type === 'SURAT_KELUAR' && doc.category === 'Tugas') {
            pdfBytes = await generateSuratTugasPDF(doc, setting);
        } else {
            pdfBytes = await generateSuratPDF(doc, setting);
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${doc.number || 'dokumen'}.pdf"`);
        res.send(Buffer.from(pdfBytes));
    } catch (error) {
        console.error('generatePublicPDF error:', error);
        res.status(500).send('Failed to generate PDF');
    }
};

// ==================== CATEGORY CODES ====================

/**
 * GET /api/office-documents/categories
 * Get available document categories with their codes
 */
exports.getCategories = async (req, res) => {
    try {
        res.json(getCategoryCodes());
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
};
