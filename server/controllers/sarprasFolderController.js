const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all folders
exports.getAllFolders = async (req, res) => {
    try {
        const folders = await prisma.sarprasFolder.findMany({
            include: {
                _count: {
                    select: { rules: true }
                }
            },
            orderBy: { name: 'asc' }
        });
        res.json(folders);
    } catch (error) {
        console.error('Get Sarpras Folders Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Create new folder
exports.createFolder = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Nama folder wajib diisi' });

        const folder = await prisma.sarprasFolder.create({
            data: { name }
        });
        res.status(201).json(folder);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Nama folder sudah ada' });
        }
        console.error('Create Sarpras Folder Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Delete folder
exports.deleteFolder = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if folder has rules
        const folder = await prisma.sarprasFolder.findUnique({
            where: { id: parseInt(id) },
            include: { _count: { select: { rules: true } } }
        });

        if (!folder) return res.status(404).json({ error: 'Folder tidak ditemukan' });
        if (folder._count.rules > 0) {
            return res.status(400).json({ error: 'Folder tidak bisa dihapus karena masih berisi file' });
        }

        await prisma.sarprasFolder.delete({
            where: { id: parseInt(id) }
        });

        res.json({ message: 'Folder berhasil dihapus' });
    } catch (error) {
        console.error('Delete Sarpras Folder Error:', error);
        res.status(500).json({ error: error.message });
    }
};
