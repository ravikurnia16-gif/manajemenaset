const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const whatsappService = require('../services/whatsappService');

/**
 * Sends a weekly summary of new assets to specific leads.
 * Scheduled to run every Friday at 15:00 WIB.
 */
const sendWeeklyAssetSummary = async () => {
    try {
        console.log("[Weekly Summary] Starting weekly asset summary task...");

        // 1. Get Date Range for "This Week" (Last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // 2. Fetch all units and their asset counts
        const units = await prisma.unit.findMany({
            include: {
                _count: {
                    select: { assets: true }
                },
                assets: {
                    where: {
                        createdAt: { gte: sevenDaysAgo }
                    },
                    select: { id: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        // 3. Prepare target users (Kepala Bidang Sarana)
        const leads = await prisma.user.findMany({
            where: {
                position: 'Kepala Bidang Sarana',
                phone: { not: null, not: '' }
            }
        });

        if (leads.length === 0) {
            console.warn("[Weekly Summary] Skip: No target users (Kepala Bidang Sarana) found with phone numbers.");
            return;
        }

        // 4. Prepare Message Header
        const dateStr = new Date().toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        let message = `*[RINGKASAN ASET MINGGUAN]*\n`;
        message += `📅 _${dateStr}_\n\n`;
        message += `Berikut adalah rekapitulasi aset per unit:\n\n`;

        let totalNewAssets = 0;

        // 5. Build Unit Summary
        units.forEach((unit, index) => {
            const total = unit._count.assets;
            const newCount = unit.assets.length;
            totalNewAssets += newCount;

            message += `${index + 1}. *${unit.name}*\n`;
            message += `   📊 Total Aset: ${total}\n`;
            message += `   ✨ Baru (Pekan ini): +${newCount}\n\n`;
        });

        message += `----------------------------\n`;
        message += `📈 *Total Penambahan*: ${totalNewAssets} aset baru\n\n`;
        message += `_Silakan cek detail lengkap di dashboard aplikasi._\n`;
        message += `_Pesan otomatis dari Sistem Manajemen Aset_`;

        // 6. Send WhatsApp to all leads
        for (const lead of leads) {
            try {
                await whatsappService.sendMessage(lead.phone, message);
                console.log(`[Weekly Summary] Summary sent to ${lead.name} (${lead.phone})`);
            } catch (sendError) {
                console.error(`[Weekly Summary] Failed to send message to ${lead.name}:`, sendError.message);
            }
        }

        // 7. Mark as notified based on date range (Optional: if you still want to use notificationSent flag)
        await prisma.asset.updateMany({
            where: {
                createdAt: { gte: sevenDaysAgo },
                notificationSent: false
            },
            data: { notificationSent: true }
        });

        console.log(`[Weekly Summary] Task completed.`);

    } catch (error) {
        console.error("[Weekly Summary Error]", error);
    }
};

module.exports = { sendWeeklyAssetSummary };
