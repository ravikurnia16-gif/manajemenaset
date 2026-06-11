const webpush = require('web-push');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Configure VAPID
webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:sarpras@dareliman.or.id',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

/**
 * Send push notification to a specific user (all their devices)
 */
const sendPushToUser = async (userId, title, body, link = null, icon = '/Sarpras.jpeg') => {
    try {
        const subscriptions = await prisma.pushSubscription.findMany({
            where: { userId }
        });

        if (subscriptions.length === 0) return;

        const payload = JSON.stringify({
            title,
            body,
            icon,
            badge: '/Sarpras.jpeg',
            tag: `sarpras-${Date.now()}`,
            data: { url: link || '/' }
        });

        const results = await Promise.allSettled(
            subscriptions.map(sub =>
                webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: sub.keys },
                    payload
                ).catch(async (err) => {
                    // If subscription expired/invalid, remove it
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
                        console.log(`[Push] Removed expired subscription for user ${userId}`);
                    }
                    throw err;
                })
            )
        );

        const success = results.filter(r => r.status === 'fulfilled').length;
        console.log(`[Push] Sent to user ${userId}: ${success}/${subscriptions.length} devices`);
    } catch (err) {
        console.error(`[Push] Error sending to user ${userId}:`, err.message);
    }
};

/**
 * Send push notification to users by position
 */
const sendPushToPosition = async (position, title, body, link = null) => {
    try {
        const users = await prisma.user.findMany({
            where: { position },
            select: { id: true }
        });

        for (const user of users) {
            await sendPushToUser(user.id, title, body, link);
        }
    } catch (err) {
        console.error(`[Push] Error sending to position ${position}:`, err.message);
    }
};

/**
 * Send push to Kepala Bidang Sarpras
 */
const sendPushToKabid = async (title, body, link = null) => {
    return sendPushToPosition('Kepala Bidang Sarana', title, body, link);
};

module.exports = {
    sendPushToUser,
    sendPushToPosition,
    sendPushToKabid,
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY
};
