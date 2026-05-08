const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { generateDocumentNumber, getCategoryCodes } = require('../services/documentNumberingService');
const { generateVerificationQR, generateSuratPDF, generateBASTMouPDF, generateSuratTugasPDF, generateSuratPesananPDF, generateInvoicePDF, generateSuratEdaranPDF, generateKeputusanPDF, generatePemberitahuanPDF, generateSuratUmumPDF, generateBeritaAcaraKunjunganPDF, generateSuratLainnyaPDF } = require('../services/officePdfService');
const mammoth = require('mammoth');
const crypto = require('crypto');
const whatsappService = require('../services/whatsappService');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

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
        
        let newFileUrls = [];
        if (req.uploadedMedia && req.uploadedMedia.length > 0) newFileUrls = req.uploadedMedia.map(m => m.url);
        else if (req.fileUrl) newFileUrls = [req.fileUrl];
        
        let existingUrls = [];
        if (req.body.fileUrl && req.body.fileUrl !== 'null' && req.body.fileUrl !== '') {
            existingUrls = req.body.fileUrl.split(',').filter(u => u.trim() !== '');
        }
        
        const combined = [...existingUrls, ...newFileUrls];
        const fileUrl = combined.length > 0 ? combined.join(',') : null;

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
        const { search, type, typeGroup, status, category, categories, page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = { type: { not: 'SURAT_MASUK' } };
        
        if (typeGroup === 'OUTGOING_STANDARD') {
            where.type = { in: ['SURAT_KELUAR', 'SURAT_TUGAS', 'SURAT_EDARAN', 'SURAT_KEPUTUSAN', 'SURAT_PESANAN', 'BAST', 'MOU'] };
        }

        if (type) where.type = type;
        if (status) where.status = status;
        if (category) where.category = category;
        if (categories) {
            const catList = Array.isArray(categories) ? categories : categories.split(',');
            where.category = { in: catList };
        }
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

        let newFileUrls = [];
        if (req.uploadedMedia && req.uploadedMedia.length > 0) newFileUrls = req.uploadedMedia.map(m => m.url);
        else if (req.fileUrl) newFileUrls = [req.fileUrl];
        
        let existingUrls = [];
        if (req.body.fileUrl && req.body.fileUrl !== 'null' && req.body.fileUrl !== '') {
            existingUrls = req.body.fileUrl.split(',').filter(u => u.trim() !== '');
        }
        
        const combined = [...existingUrls, ...newFileUrls];

        // For Lainnya category, reserve document number immediately
        let reservedNumber = null;
        if (category === 'Lainnya') {
            reservedNumber = await generateDocumentNumber(category, type);
        }

        const doc = await prisma.officeDocument.create({
            data: {
                type,
                subject,
                content,
                category: category || 'Lainnya',
                priority: priority || 'BIASA',
                authorId: req.user.id,
                status: 'DRAFT',
                number: reservedNumber,
                fileUrl: combined.length > 0 ? combined.join(',') : null,
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
        if (existing.status !== 'DRAFT' && existing.status !== 'REJECTED' && existing.status !== 'PENDING_APPROVAL') {
            return res.status(400).json({ error: 'Dokumen hanya bisa diedit saat status DRAFT, REJECTED, atau PENDING_APPROVAL' });
        }

        const {
            subject, content, category, priority, type,
            senderName, senderOrg, referenceNumber, receivedDate,
            party1Name, party1Title, party1Org, party1Address,
            party2Name, party2Title, party2Org, party2Address,
        } = req.body;
        let finalFileUrl = undefined;
        if (req.uploadedMedia || req.fileUrl || req.body.fileUrl !== undefined) {
            let newFileUrls = [];
            if (req.uploadedMedia && req.uploadedMedia.length > 0) newFileUrls = req.uploadedMedia.map(m => m.url);
            else if (req.fileUrl) newFileUrls = [req.fileUrl];
            
            let existingUrls = [];
            if (req.body.fileUrl && req.body.fileUrl !== 'null' && req.body.fileUrl !== '') {
                existingUrls = req.body.fileUrl.split(',').filter(u => u.trim() !== '');
            }
            
            const combined = [...existingUrls, ...newFileUrls];
            if (combined.length > 0) {
                finalFileUrl = combined.join(',');
            } else if (req.body.fileUrl === '' || req.body.fileUrl === 'null' || req.body.fileUrl === null) {
                finalFileUrl = null;
            }
        }

        const updated = await prisma.officeDocument.update({
            where: { id },
            data: {
                subject, content, category, priority, type,
                senderName, senderOrg, referenceNumber,
                receivedDate: receivedDate ? new Date(receivedDate) : undefined,
                party1Name, party1Title, party1Org, party1Address,
                party2Name, party2Title, party2Org, party2Address,
                fileUrl: finalFileUrl,
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

        const updated = await prisma.officeDocument.update({
            where: { id },
            data: {
                status: 'PENDING_APPROVAL',
            },
            include: {
                author: { select: { id: true, name: true } },
            },
        });

        res.json(updated);

        // --- NOTIFIKASI WHATSAPP KE KABID SARPRAS ---
        (async () => {
            try {
                const kabid = await prisma.user.findFirst({
                    where: { position: { contains: 'Kepala Bidang Sarana dan Prasarana' } }
                });

                if (kabid && kabid.phone) {
                    const docTypeLabel = updated.type.replace(/_/g, ' ');
                    const waMessage = `*NOTIFIKASI E-OFFICE*\n\nHalo Pak ${kabid.name},\n\nAda dokumen baru yang diajukan untuk ditandatangani:\n\n- *Jenis*: ${docTypeLabel}\n- *Judul*: ${updated.subject}\n- *Pengaju*: ${updated.author.name}\n\nSilakan cek aplikasi untuk melakukan tanda tangan elektronik. Terima kasih.`;
                    
                    await whatsappService.sendMessage(kabid.phone, waMessage);
                }
            } catch (err) {
                console.error('[E-Office Notif Error]', err);
            }
        })();
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

        // Generate document number upon approval
        let number = doc.number;
        if (!number) {
            number = await generateDocumentNumber(doc.category, doc.type);
        }

        // Build update data
        const updateData = {
            status: 'SIGNED',
            number,
            signedById: req.user.id,
            signedAt: new Date(),
            signatureData: signatureData || null,
            qrCodeData, // Save QR data to DB
            approvalNote,
        };

        // For BAST/Serah Terima: Kabid approval = Pihak Pertama signature (TTE)
        const isBAST = ['BAST', 'MOU'].includes(doc.type) || (doc.type === 'SURAT_KELUAR' && ['Berita Acara', 'Serah Terima Barang', 'BAST', 'MOU'].includes(doc.category));
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
        if (!['BAST', 'MOU'].includes(doc.type) && !(doc.type === 'SURAT_KELUAR' && ['Berita Acara', 'Serah Terima Barang', 'BAST', 'MOU'].includes(doc.category))) {
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
            let number = refreshed.number;
            if (!number) {
                number = await generateDocumentNumber(refreshed.category, refreshed.type);
            }
            await prisma.officeDocument.update({
                where: { id },
                data: { 
                    status: 'SIGNED', 
                    signedAt: new Date(),
                    number
                },
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
        if (['BAST', 'MOU'].includes(doc.type) || (doc.type === 'SURAT_KELUAR' && ['Berita Acara', 'Serah Terima Barang', 'BAST'].includes(doc.category))) {
            pdfBytes = await generateBASTMouPDF(doc, setting);
        } else if (doc.type === 'SURAT_PESANAN' || doc.category === 'Pesanan') {
            pdfBytes = await generateSuratPesananPDF(doc, setting);
        } else if (doc.type === 'INVOICE' || doc.category === 'Invoice') {
            pdfBytes = await generateInvoicePDF(doc, setting);
        } else if (doc.category === 'Edaran') {
            pdfBytes = await generateSuratEdaranPDF(doc, setting);
        } else if (doc.category === 'Keputusan') {
            pdfBytes = await generateKeputusanPDF(doc, setting);
        } else if (doc.category === 'Pemberitahuan') {
            pdfBytes = await generatePemberitahuanPDF(doc, setting);
        } else if (doc.type === 'SURAT_KELUAR' && doc.category === 'Tugas') {
            pdfBytes = await generateSuratTugasPDF(doc, setting);
        } else if (doc.category === 'Umum') {
            pdfBytes = await generateSuratUmumPDF(doc, setting);
        } else if (doc.category === 'Berita Acara Kunjungan') {
            pdfBytes = await generateBeritaAcaraKunjunganPDF(doc, setting);
        } else if (doc.category === 'Lainnya' || doc.type === 'LAINNYA') {
            // Lainnya: serve the uploaded file directly instead of generating
            if (doc.fileUrl) {
                const fileUrls = doc.fileUrl.split(',').filter(u => u.trim());
                const pdfFile = fileUrls.find(u => u.toLowerCase().endsWith('.pdf'));
                const docFile = fileUrls[0]; // fallback to first file
                const targetUrl = pdfFile || docFile;
                if (targetUrl) {
                    try {
                        const fileRes = await axios.get(targetUrl, { responseType: 'arraybuffer' });
                        const contentType = pdfFile ? 'application/pdf' : 'application/octet-stream';
                        const ext = targetUrl.split('.').pop().toLowerCase();
                        res.setHeader('Content-Type', contentType);
                        res.setHeader('Content-Disposition', `inline; filename="${doc.number || 'dokumen'}.${ext}"`);
                        return res.send(Buffer.from(fileRes.data));
                    } catch (dlErr) {
                        console.error('Failed to download uploaded file:', dlErr.message);
                    }
                }
            }
            // Fallback: generate basic PDF if no file uploaded
            pdfBytes = await generateSuratLainnyaPDF(doc, setting);
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
            totalInvoices,
            totalOutgoing,
            pendingApproval,
            signedThisMonth,
            recentDocuments,
        ] = await Promise.all([
            prisma.officeDocument.count({ where: { type: 'SURAT_MASUK' } }),
            prisma.officeDocument.count({ where: { type: 'INVOICE' } }),
            prisma.officeDocument.count({ 
                where: { 
                    type: { notIn: ['SURAT_MASUK', 'INVOICE'] } 
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
                    signedBy: { select: { id: true, name: true } },
                },
            }),
        ]);

        res.json({
            totalIncoming,
            totalInvoices,
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

        const statusLabel = status === 'PAID' ? 'LUNAS' : 'BELUM LUNAS';
        res.json({ message: `Status pembayaran berhasil diperbarui menjadi ${statusLabel}`, doc: updated });
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

        const publicUrl = `https://sarpras.dareliman.or.id/api/office-documents/verify/${doc.uuid}/pdf`;
        
        let message = '';
        if (content.paymentStatus === 'PAID') {
            message = `*KONFIRMASI PELUNASAN - ${setting?.orgName || 'SARPRAS'}*\n\n` +
                `Halo Bapak/Ibu *${doc.party2Name}*,\n` +
                `Pembayaran Anda untuk tagihan berikut telah kami terima dan diverifikasi:\n\n` +
                `▫️ *No. Invoice:* ${doc.number || '-'}\n` +
                `▫️ *Perihal:* ${doc.subject}\n` +
                `▫️ *Status:* ✅ LUNAS\n\n` +
                `Terima kasih telah melakukan pembayaran tepat waktu. Anda dapat mengunduh bukti pelunasan resmi pada link berikut:\n` +
                `${publicUrl}\n\n` +
                `Salam,\n` +
                `${setting?.orgName || 'Bagian Sarana & Prasarana'}`;
        } else {
            message = `*INVOICE TAGIHAN - ${setting?.orgName || 'SARPRAS'}*\n\n` +
                `Halo Bapak/Ibu *${doc.party2Name}*,\n` +
                `Berikut adalah rincian tagihan Anda yang perlu segera diselesaikan:\n\n` +
                `▫️ *No. Invoice:* ${doc.number || '-'}\n` +
                `▫️ *Perihal:* ${doc.subject}\n` +
                `▫️ *Jatuh Tempo:* ${content.dueDate ? new Date(content.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}\n` +
                `▫️ *Status:* 🔴 BELUM LUNAS\n\n` +
                `Silakan unduh dokumen invoice resmi pada link berikut:\n` +
                `${publicUrl}\n\n` +
                `Mohon segera melakukan pembayaran. Abaikan pesan ini jika Anda sudah melunasi tagihan.\n` +
                `Terima kasih.`;
        }

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
        if (['BAST', 'MOU'].includes(doc.type) || (doc.type === 'SURAT_KELUAR' && ['Berita Acara', 'Serah Terima Barang', 'BAST'].includes(doc.category))) {
            pdfBytes = await generateBASTMouPDF(doc, setting);
        } else if (doc.type === 'SURAT_PESANAN' || doc.category === 'Pesanan') {
            pdfBytes = await generateSuratPesananPDF(doc, setting);
        } else if (doc.type === 'INVOICE' || doc.category === 'Invoice') {
            pdfBytes = await generateInvoicePDF(doc, setting);
        } else if (doc.category === 'Edaran') {
            pdfBytes = await generateSuratEdaranPDF(doc, setting);
        } else if (doc.category === 'Keputusan') {
            pdfBytes = await generateKeputusanPDF(doc, setting);
        } else if (doc.category === 'Pemberitahuan') {
            pdfBytes = await generatePemberitahuanPDF(doc, setting);
        } else if (doc.type === 'SURAT_KELUAR' && doc.category === 'Tugas') {
            pdfBytes = await generateSuratTugasPDF(doc, setting);
        } else if (doc.category === 'Lainnya' || doc.type === 'LAINNYA') {
            pdfBytes = await generateSuratLainnyaPDF(doc, setting);
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

// ==================== DOCX EXTRACTION ====================

/**
 * POST /api/office-documents/extract-docx
 * Extract text content from uploaded .doc/.docx file
 */
exports.extractDocx = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'Tidak ada file yang diunggah' });
        }

        const file = req.files[0];
        const ext = file.originalname.toLowerCase().split('.').pop();

        if (!['doc', 'docx'].includes(ext)) {
            return res.status(400).json({ error: 'Format file harus .doc atau .docx' });
        }

        const result = await mammoth.extractRawText({ buffer: file.buffer });
        const text = result.value || '';

        res.json({
            text: text.trim(),
            messages: result.messages || [],
        });
    } catch (error) {
        console.error('extractDocx error:', error);
        res.status(500).json({ error: 'Gagal mengekstrak dokumen: ' + error.message });
    }
};

// ==================== TTE ASSET DOWNLOAD ====================

/**
 * GET /api/office-documents/:id/tte-asset
 * Download TTE QR Code as PNG image for pasting into external documents
 */
exports.downloadTTEAsset = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const doc = await prisma.officeDocument.findUnique({
            where: { id },
            include: {
                signedBy: { select: { id: true, name: true, nip: true, position: true } },
            },
        });

        if (!doc) return res.status(404).json({ error: 'Document not found' });
        if (doc.status !== 'SIGNED') {
            return res.status(400).json({ error: 'Dokumen belum ditandatangani. TTE hanya tersedia setelah disetujui Kabid.' });
        }

        // Generate or use existing QR code
        const qrDataUrl = doc.qrCodeData || await generateVerificationQR(doc.uuid);
        const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
        const qrBuffer = Buffer.from(qrBase64, 'base64');

        // Composite logo onto the center of the QR code
        const logoPath = path.join(__dirname, '../assets/logo_yayasan.jpg');
        let finalBuffer = qrBuffer;
        
        if (fs.existsSync(logoPath)) {
            // Resize logo to fit in the center (e.g., 20% of the QR code size)
            // The QR code width is 300px based on generateVerificationQR. Let's make logo 60x60
            const resizedLogo = await sharp(logoPath)
                .resize(60, 60, { fit: 'inside' })
                .toBuffer();

            // Composite the logo over the QR code
            finalBuffer = await sharp(qrBuffer)
                .composite([
                    {
                        input: resizedLogo,
                        gravity: 'center'
                    }
                ])
                .png()
                .toBuffer();
        }

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="TTE_${doc.number || doc.id}.png"`);
        res.send(finalBuffer);
    } catch (error) {
        console.error('downloadTTEAsset error:', error);
        res.status(500).json({ error: 'Failed to download TTE asset' });
    }
};

/**
 * PUT /api/office-documents/:id/final-file
 * Upload final PDF file for a document that is already SIGNED (specifically used for Lainnya offline workflow)
 */
exports.uploadFinalFile = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const doc = await prisma.officeDocument.findUnique({ where: { id } });
        if (!doc) return res.status(404).json({ error: 'Document not found' });
        
        if (doc.status !== 'SIGNED') {
            return res.status(400).json({ error: 'Endpoint ini khusus untuk mengunggah file final dokumen yang sudah ditandatangani.' });
        }

        let newFileUrls = [];
        if (req.uploadedMedia && req.uploadedMedia.length > 0) {
            newFileUrls = req.uploadedMedia.map(m => m.url);
        }

        if (newFileUrls.length === 0) {
            return res.status(400).json({ error: 'Tidak ada file yang diunggah.' });
        }

        const updated = await prisma.officeDocument.update({
            where: { id },
            data: { fileUrl: newFileUrls.join(',') },
            include: {
                author: { select: { id: true, name: true } },
                signedBy: { select: { id: true, name: true, nip: true } },
            },
        });

        res.json(updated);
    } catch (error) {
        console.error('uploadFinalFile error:', error);
        res.status(500).json({ error: 'Gagal mengunggah file final' });
    }
};

// ==================== SEND DOCUMENT VIA WHATSAPP ====================

/**
 * POST /api/office-documents/:id/send-doc-wa
 * Send any document via WhatsApp to internal users or external contacts
 * Body: { targets: [{ type: 'internal', userId: 1 } | { type: 'external', name: string, phone: string }], customMessage?: string }
 */
exports.sendDocumentWA = async (req, res) => {
    try {
        const { id } = req.params;
        const { targets, customMessage } = req.body;

        if (!targets || targets.length === 0) {
            return res.status(400).json({ error: 'Minimal satu penerima harus dipilih.' });
        }

        const doc = await prisma.officeDocument.findUnique({
            where: { id: parseInt(id) },
            include: {
                author: { select: { id: true, name: true } },
                signedBy: { select: { id: true, name: true, nip: true, position: true } },
            },
        });

        if (!doc) return res.status(404).json({ error: 'Dokumen tidak ditemukan.' });

        const setting = await prisma.setting.findUnique({ where: { id: 1 } });
        const orgName = setting?.orgName || 'Manajemen Aset Sarpras';

        // Build verification/download link
        const publicUrl = `https://sarpras.dareliman.or.id/api/office-documents/verify/${doc.uuid}/pdf`;
        const verifyUrl = `https://sarpras.dareliman.or.id/verify/${doc.uuid}`;

        const docTypeLabels = {
            'SURAT_MASUK': 'Surat Masuk',
            'SURAT_KELUAR': 'Surat Keluar',
            'SURAT_PESANAN': 'Surat Pesanan',
            'INVOICE': 'Invoice',
            'BAST': 'Berita Acara',
            'MOU': 'MOU',
            'LAINNYA': 'Dokumen',
        };
        const typeLabel = docTypeLabels[doc.type] || doc.category || 'Dokumen';

        let sentCount = 0;
        const errors = [];

        for (const target of targets) {
            let phone = '';
            let recipientName = '';

            if (target.type === 'internal') {
                // Lookup user by ID
                const user = await prisma.user.findUnique({
                    where: { id: parseInt(target.userId) },
                    select: { name: true, phone: true },
                });
                if (!user || !user.phone) {
                    errors.push(`User ID ${target.userId}: nomor HP tidak ditemukan.`);
                    continue;
                }
                phone = user.phone;
                recipientName = user.name;
            } else if (target.type === 'external') {
                phone = target.phone;
                recipientName = target.name || 'Bapak/Ibu';
                if (!phone) {
                    errors.push(`Penerima eksternal "${recipientName}": nomor HP kosong.`);
                    continue;
                }
            }

            // Compose message
            let message = `*📄 ${typeLabel.toUpperCase()} - ${orgName}*\n\n`;
            message += `Halo *${recipientName}*,\n`;
            message += `Berikut kami sampaikan dokumen resmi dari ${orgName}:\n\n`;
            message += `▫️ *Jenis:* ${typeLabel}\n`;
            message += `▫️ *Perihal:* ${doc.subject}\n`;
            if (doc.number) message += `▫️ *Nomor:* ${doc.number}\n`;
            message += `▫️ *Status:* ${doc.status === 'SIGNED' ? '✅ Ditandatangani' : doc.status === 'DRAFT' ? '📝 Draft' : doc.status}\n`;
            if (doc.signedBy) message += `▫️ *Ditandatangani oleh:* ${doc.signedBy.name}\n`;

            if (customMessage) {
                message += `\n💬 *Pesan:*\n${customMessage}\n`;
            }

            if (doc.status === 'SIGNED') {
                message += `\n📥 *Unduh Dokumen:*\n${publicUrl}\n`;
                message += `\n🔍 *Verifikasi Keaslian:*\n${verifyUrl}\n`;
            }

            message += `\n_Dikirim melalui Sistem E-Office ${orgName}_`;

            try {
                await whatsappService.sendMessage(phone, message);
                sentCount++;
            } catch (err) {
                errors.push(`${recipientName} (${phone}): ${err.message}`);
            }
        }

        let responseMessage = `✅ Notifikasi berhasil dikirim ke ${sentCount} penerima.`;
        if (errors.length > 0) {
            responseMessage += ` ⚠️ ${errors.length} gagal: ${errors.join('; ')}`;
        }

        res.json({ message: responseMessage, sent: sentCount, errors });
    } catch (error) {
        console.error('sendDocumentWA error:', error);
        res.status(500).json({ error: 'Gagal mengirim dokumen via WhatsApp: ' + error.message });
    }
};

/**
 * GET /api/office-documents/internal-users
 * Get list of internal users with phone numbers for WA sending
 */
exports.getInternalUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            where: {
                phone: { not: null },
            },
            select: {
                id: true,
                name: true,
                phone: true,
                position: true,
                role: true,
            },
            orderBy: { name: 'asc' },
        });
        res.json(users);
    } catch (error) {
        console.error('getInternalUsers error:', error);
        res.status(500).json({ error: 'Gagal memuat daftar pengguna internal' });
    }
};
