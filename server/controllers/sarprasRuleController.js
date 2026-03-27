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
            orderBy: { createdAt: 'desc' }
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
        const { title, description, category, folderId } = req.body;
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
