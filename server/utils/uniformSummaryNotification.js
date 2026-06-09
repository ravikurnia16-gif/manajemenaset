const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const whatsappService = require('../services/whatsappService');

/**
 * Sends a summary of Uniform Orders (Warid) to specific leads.
 * Scheduled to run every Monday and Thursday at 07:40 WIB.
 */
const sendUniformOrderSummary = async () => {
    try {
        console.log("[Uniform Summary] Starting uniform order summary task...");

        // Prepare target users (Kepala Bidang Sarana dan Prasarana)
        const leads = await prisma.user.findMany({
            where: {
                position: 'Kepala Bidang Sarana dan Prasarana',
                phone: { not: null, not: '' }
            }
        });

        if (leads.length === 0) {
            console.warn("[Uniform Summary] Skip: No target users (Kepala Bidang Sarana dan Prasarana) found with phone numbers.");
            return;
        }

        const now = new Date();
        
        // This week calculation for Picked Up / Completed orders
        const monday = new Date(now);
        monday.setDate(monday.getDate() - (monday.getDay() === 0 ? 6 : monday.getDay() - 1));
        monday.setHours(0, 0, 0, 0);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        // Fetch orders
        const orders = await prisma.uniformOrder.findMany({
            where: {
                OR: [
                    { status: { in: ['PENDING', 'CONFIRMED', 'READY'] } },
                    { status: 'PICKED_UP', updatedAt: { gte: monday, lte: sunday } }
                ]
            }
        });

        let stats = {
            PENDING: 0,
            CONFIRMED: 0,
            READY: 0,
            PICKED_UP: 0
        };

        let unitPendingStats = {};
        let latePending = [];
        let completedAmount = 0;

        orders.forEach(o => {
            if (o.status === 'PENDING') {
                stats.PENDING++;
                
                // Unit stats
                const unit = o.customerUnit || 'Umum';
                unitPendingStats[unit] = (unitPendingStats[unit] || 0) + 1;

                // Check wait time
                const diffMs = now - new Date(o.createdAt);
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                if (diffDays >= 3) {
                    latePending.push({ ...o, diffDays });
                }
            } else if (o.status === 'CONFIRMED') {
                stats.CONFIRMED++;
            } else if (o.status === 'READY') {
                stats.READY++;
            } else if (o.status === 'PICKED_UP') {
                stats.PICKED_UP++;
                completedAmount += (o.totalAmount || 0);
            }
        });

        // Sort late pending by oldest
        latePending.sort((a, b) => b.diffDays - a.diffDays);
        
        const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        let msg = `Bismillah.\n📢 *LAPORAN REKAP PEMESANAN SERAGAM*\nPeriode: ${dateStr}\n\n`;
        msg += `Berikut adalah status terkini pemesanan seragam siswa:\n\n`;

        msg += `📊 *1. STATUS PESANAN AKTIF:*\n`;
        msg += `- ⏳ *PENDING* (Pesanan Baru): ${stats.PENDING} Pesanan\n`;
        msg += `- 🔄 *CONFIRMED* (Sedang Disiapkan): ${stats.CONFIRMED} Pesanan\n`;
        msg += `- 📦 *READY* (Siap Diambil): ${stats.READY} Pesanan\n\n`;

        msg += `🏫 *2. RINCIAN PESANAN BARU (PENDING) PER UNIT:*\n`;
        if (Object.keys(unitPendingStats).length > 0) {
            for (const [unit, count] of Object.entries(unitPendingStats)) {
                msg += `- Unit ${unit}: ${count} Pesanan\n`;
            }
        } else {
            msg += `- (Tidak ada antrean pesanan baru)\n`;
        }
        msg += `\n`;

        if (latePending.length > 0) {
            msg += `⚠️ *3. PESANAN MENUNGGU LAMA (Pending >= 3 Hari):*\n`;
            latePending.slice(0, 5).forEach((p, index) => {
                const name = p.studentName || p.customerName || 'Anonim';
                const unit = p.customerUnit || '-';
                msg += `${index + 1}. [${p.code}] ${name} (${unit}) - Menunggu ${p.diffDays} Hari\n`;
            });
            if (latePending.length > 5) {
                msg += `... dan ${latePending.length - 5} pesanan lainnya.\n`;
            }
            msg += `\n`;
        }

        msg += `✅ *4. PESANAN SELESAI (Pekan Ini):*\n`;
        msg += `- Sudah Diambil (PICKED_UP): ${stats.PICKED_UP} Pesanan\n`;
        msg += `- Total Nilai Pesanan Selesai: Rp ${completedAmount.toLocaleString('id-ID')}\n\n`;

        msg += `Mohon agar pesanan yang berstatus PENDING segera diproses oleh petugas gudang.\n`;
        msg += `_Pesan otomatis dari Sistem Manajemen Aset_`;

        // Send WhatsApp to all leads
        for (const lead of leads) {
            try {
                await whatsappService.sendMessage(lead.phone, msg);
                console.log(`[Uniform Summary] Summary sent to ${lead.name} (${lead.phone})`);
            } catch (sendError) {
                console.error(`[Uniform Summary] Failed to send message to ${lead.name}:`, sendError.message);
            }
        }

        console.log(`[Uniform Summary] Task completed.`);

    } catch (error) {
        console.error("[Uniform Summary Error]", error);
    }
};

module.exports = { sendUniformOrderSummary };
