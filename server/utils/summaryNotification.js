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

        // 1. Fetch assets that haven't been notified yet
        const unsentAssets = await prisma.asset.findMany({
            where: { notificationSent: false },
            include: { unit: true, room: true },
            orderBy: { createdAt: 'asc' }
        });

        if (unsentAssets.length === 0) {
            console.log("[Weekly Summary] No new assets to notify. Task finished.");
            return;
        }

        // 2. Find target users (Kepala Bidang Sarana dan Prasarana)
        const leads = await prisma.user.findMany({
            where: {
                position: 'Kepala Bidang Sarana dan Prasarana',
                phone: { not: null, not: '' }
            }
        });

        if (leads.length === 0) {
            console.warn("[Weekly Summary] Skip: No target users (Kepala Bidang Sarana dan Prasarana) found with phone numbers.");
            return;
        }

        // 3. Prepare Message Header
        const dateStr = new Date().toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        let message = `*[RINGKASAN ASET MINGGUAN]*\n`;
        message += `📅 _${dateStr}_\n\n`;
        message += `Berikut adalah daftar aset baru yang ditambahkan minggu ini:\n\n`;

        // 4. List Assets (Max 15 items to avoid message length limits)
        const limit = 15;
        const displayAssets = unsentAssets.slice(0, limit);

        displayAssets.forEach((asset, index) => {
            const loc = asset.room?.name || asset.unit?.name || '-';
            message += `${index + 1}. *${asset.name}*\n`;
            message += `   🏷️ Kode: ${asset.code}\n`;
            message += `   📍 Lokasi: ${loc}\n\n`;
        });

        if (unsentAssets.length > limit) {
            message += `...dan ${unsentAssets.length - limit} aset lainnya.\n\n`;
        }

        message += `_Silakan cek detail lengkap di aplikasi._\n`;
        message += `_Pesan otomatis dari Sistem Manajemen Aset_`;

        // 5. Send WhatsApp to all leads
        for (const lead of leads) {
            try {
                await whatsappService.sendMessage(lead.phone, message);
                console.log(`[Weekly Summary] Summary sent to ${lead.name} (${lead.phone})`);
            } catch (sendError) {
                console.error(`[Weekly Summary] Failed to send message to ${lead.name}:`, sendError.message);
            }
        }

        // 6. Mark assets as notified
        const assetIds = displayAssets.map(a => a.id);
        await prisma.asset.updateMany({
            where: { id: { in: assetIds } },
            data: { notificationSent: true }
        });

        console.log(`[Weekly Summary] Task completed. ${assetIds.length} assets marked as notified.`);

    } catch (error) {
        console.error("[Weekly Summary Error]", error);
    }
};

module.exports = { sendWeeklyAssetSummary };
