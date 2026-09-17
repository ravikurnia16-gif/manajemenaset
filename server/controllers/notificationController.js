const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const notifications = await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        const unreadCount = await prisma.notification.count({
            where: { userId, isRead: false }
        });

        res.json({ notifications, unreadCount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.notification.update({
            where: { id: parseInt(id) },
            data: { isRead: true }
        });
        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        await prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true }
        });
        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.notification.delete({
            where: { id: parseInt(id) }
        });
        res.json({ message: 'Notification deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Utility function to be used by other controllers
exports.createNotification = async (userId, title, message, type = 'INFO', link = null) => {
    try {
        let payload = { userId, title, message, type, link };
        if (typeof userId === 'object' && userId !== null) {
            payload = {
                userId: userId.userId,
                title: userId.title,
                message: userId.message,
                type: userId.type || 'INFO',
                link: userId.link || null
            };
        }

        if (!payload.userId || !payload.title || !payload.message) {
            console.warn('[Notification] Incomplete notification payload:', payload);
            return null;
        }

        return await prisma.notification.create({
            data: {
                userId: parseInt(payload.userId),
                title: String(payload.title),
                message: String(payload.message),
                type: payload.type || 'INFO',
                link: payload.link || null
            }
        });
    } catch (error) {
        console.error('Failed to create notification:', error);
    }
};
