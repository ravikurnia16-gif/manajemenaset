const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { deleteFile } = require('../services/minioService');

// Get all rules
exports.getAllRules = async (req, res) => {
    try {
        const rules = await prisma.sarprasRule.findMany({
            include: {
                uploadedBy: {
                    select: { name: true, username: true }
                },
                folder: {
                    select: { id: true, name: true }
                }
            },
            orderBy: [
                { status: 'asc' }, // Berlaku first, then Arsip
                { createdAt: 'desc' }
            ]
        });
        res.json(rules);
    } catch (error) {
        console.error('Get Sarpras Rules Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Create new rule (Upload)
exports.createRule = async (req, res) => {
    try {
        const { title, description, category, folderId, documentNumber, status, expiryDate } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'File wajib diupload' });
        }

        let categoryName = category || "Umum";
        if (folderId) {
            const folder = await prisma.sarprasFolder.findUnique({ where: { id: parseInt(folderId) } });
            if (folder) categoryName = folder.name;
        }

        const rule = await prisma.sarprasRule.create({
            data: {
                title: title || file.originalname,
                category: categoryName,
                folderId: folderId ? parseInt(folderId) : null,
                description,
                documentNumber,
                status: status || "Berlaku",
                expiryDate: expiryDate ? new Date(expiryDate) : null,
                fileName: file.originalname,
                fileUrl: req.fileUrl,
                fileType: file.mimetype,
                fileSize: file.size,
                uploadedById: req.user.id
            }
        });

        res.status(201).json(rule);
    } catch (error) {
        console.error('Create Sarpras Rule Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Update rule
exports.updateRule = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, folderId, documentNumber, status, expiryDate } = req.body;

        const existing = await prisma.sarprasRule.findUnique({ where: { id: parseInt(id) } });
        if (!existing) return res.status(404).json({ error: 'Dokumen tidak ditemukan' });

        // Check permission
        if (!['SUPER_ADMIN', 'BIDANG_IT'].includes(req.user.role) && existing.uploadedById !== req.user.id) {
            return res.status(403).json({ error: 'Akses ditolak' });
        }

        const data = {
            title,
            description,
            documentNumber,
            status,
            expiryDate: expiryDate ? new Date(expiryDate) : null
        };

        if (folderId) {
            data.folderId = parseInt(folderId);
            const folder = await prisma.sarprasFolder.findUnique({ where: { id: data.folderId } });
            if (folder) data.category = folder.name;
        }

        const updated = await prisma.sarprasRule.update({
            where: { id: parseInt(id) },
            data
        });

        res.json(updated);
    } catch (error) {
        console.error('Update Sarpras Rule Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Delete rule
exports.deleteRule = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        // Only SUPER_ADMIN or uploader can delete
        const rule = await prisma.sarprasRule.findUnique({
            where: { id: parseInt(id) }
        });

        if (!rule) {
            return res.status(404).json({ error: 'Aturan tidak ditemukan' });
        }

        if (!['SUPER_ADMIN', 'BIDANG_IT'].includes(user.role) && rule.uploadedById !== user.id) {
            return res.status(403).json({ error: 'Akses ditolak' });
        }

        // Delete file from MinIO
        if (rule.fileUrl) {
            await deleteFile(rule.fileUrl);
        }

        // Delete from DB
        await prisma.sarprasRule.delete({
            where: { id: parseInt(id) }
        });

        res.json({ message: 'Aturan berhasil dihapus' });
    } catch (error) {
        console.error('Delete Sarpras Rule Error:', error);
        res.status(500).json({ error: error.message });
    }
};
