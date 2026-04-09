const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendPushToUser, vapidPublicKey } = require('../services/pushService');
const { verifyToken } = require('../middleware/authMiddleware');

// Get VAPID public key (no auth needed for service worker registration)
router.get('/vapid-public-key', (req, res) => {
    res.json({ publicKey: vapidPublicKey });
});

// Subscribe to push notifications
router.post('/subscribe', verifyToken, async (req, res) => {
    try {
        const { subscription } = req.body;
        const userId = req.user.id;

        if (!subscription || !subscription.endpoint || !subscription.keys) {
            return res.status(400).json({ error: 'Invalid subscription object' });
        }

        // Upsert: create or update subscription
        await prisma.pushSubscription.upsert({
            where: {
                userId_endpoint: {
                    userId,
                    endpoint: subscription.endpoint
                }
            },
            update: {
                keys: subscription.keys
            },
            create: {
                userId,
                endpoint: subscription.endpoint,
                keys: subscription.keys
            }
        });

        res.json({ message: 'Subscribed to push notifications' });
    } catch (error) {
        console.error('[Push Subscribe] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Unsubscribe from push notifications
router.post('/unsubscribe', verifyToken, async (req, res) => {
    try {
        const { endpoint } = req.body;
        const userId = req.user.id;

        if (endpoint) {
            await prisma.pushSubscription.deleteMany({
                where: { userId, endpoint }
            });
        } else {
            // Delete all subscriptions for user
            await prisma.pushSubscription.deleteMany({
                where: { userId }
            });
        }

        res.json({ message: 'Unsubscribed from push notifications' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Test push notification (send to yourself)
router.post('/test', verifyToken, async (req, res) => {
    try {
        await sendPushToUser(
            req.user.id,
            '🔔 Test Notifikasi',
            'Bismillah. Push notification berhasil diaktifkan! Anda akan menerima pemberitahuan penting dari Sarpras.',
            '/personalia'
        );
        res.json({ message: 'Test notification sent' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
