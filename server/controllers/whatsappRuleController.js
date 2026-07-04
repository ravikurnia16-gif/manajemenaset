const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getRules = async (req, res) => {
    try {
        const rules = await prisma.notificationRule.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(rules);
    } catch (error) {
        console.error('Error fetching notification rules:', error);
        res.status(500).json({ error: 'Gagal mengambil aturan notifikasi. Tabel mungkin belum siap.' });
    }
};

exports.createRule = async (req, res) => {
    try {
        const { eventName, messageTpl, targetGroup, cronTime, isActive } = req.body;
        const newRule = await prisma.notificationRule.create({
            data: {
                eventName,
                messageTpl,
                targetGroup,
                cronTime,
                isActive: isActive !== undefined ? isActive : true
            }
        });
        res.status(201).json(newRule);
    } catch (error) {
        console.error('Error creating notification rule:', error);
        res.status(500).json({ error: 'Gagal membuat aturan notifikasi.' });
    }
};

exports.updateRule = async (req, res) => {
    try {
        const { id } = req.params;
        const { eventName, messageTpl, targetGroup, cronTime, isActive } = req.body;
        const updatedRule = await prisma.notificationRule.update({
            where: { id: parseInt(id) },
            data: { eventName, messageTpl, targetGroup, cronTime, isActive }
        });
        res.json(updatedRule);
    } catch (error) {
        console.error('Error updating notification rule:', error);
        res.status(500).json({ error: 'Gagal memperbarui aturan notifikasi.' });
    }
};

exports.deleteRule = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.notificationRule.delete({
            where: { id: parseInt(id) }
        });
        res.json({ message: 'Aturan berhasil dihapus' });
    } catch (error) {
        console.error('Error deleting notification rule:', error);
        res.status(500).json({ error: 'Gagal menghapus aturan notifikasi.' });
    }
};
