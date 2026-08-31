const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const whatsappService = require('../services/whatsappService');

/**
 * Sends a daily summary of Uniform Orders (Sales/SPMB/Warid) to Kepala Bidang Sarana.
 * Scheduled to run every morning at 07:25 WIB.
 */
const sendUniformOrderSummary = async () => {
    try {
        console.log("[Uniform Summary] Starting daily uniform order summary task...");

        // Target users: Kepala Bidang Sarana
        const leads = await prisma.user.findMany({
            where: {
                position: { contains: 'Kepala Bidang Sarana' },
                phone: { not: null, not: '' }
            }
        });

        if (leads.length === 0) {
            console.warn("[Uniform Summary] Skip: No target users (Kepala Bidang Sarana) found with phone numbers.");
            return;
        }

        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

        // Fetch all active uniform sales & items
        const allSales = await prisma.uniformSale.findMany({
            include: {
                items: {
                    include: {
                        variant: { include: { item: true } }
                    }
                },
                warehouse: true
            },
            orderBy: { createdAt: 'desc' }
        });

        let stats = {
            TOTAL: allSales.length,
            PENDING: 0,
            PROSES: 0, // Ada item SEDIA
            INDENT: 0,
            SELESAI: 0,
            BATAL: 0
        };

        let unitStats = {};
        let lateReadySales = []; // Siap Ambil > 30 hari
        let totalRevenue = 0;
        let totalPaid = 0;

        allSales.forEach(s => {
            totalRevenue += (s.totalAmount || 0);
            totalPaid += (s.paidAmount || 0);

            const isDone = s.status === 'COMPLETED' || s.status === 'SELESAI';
            const isBatal = s.status === 'BATAL';
            const isPending = s.status === 'PENDING';
            const hasSedia = s.items.some(i => i.status === 'SEDIA');
            const hasIndent = s.items.some(i => ['INDENT', 'TIDAK_TERSEDIA', 'BACKORDER'].includes(i.status));

            if (isDone) {
                stats.SELESAI++;
            } else if (isBatal) {
                stats.BATAL++;
            } else if (hasSedia || s.status === 'PROSES') {
                stats.PROSES++;

                // Cek apakah sudah > 30 hari berstatus SEDIA
                const orderDate = new Date(s.updatedAt || s.createdAt);
                if (orderDate <= thirtyDaysAgo) {
                    const diffDays = Math.floor((now - orderDate) / (1000 * 60 * 60 * 24));
                    lateReadySales.push({
                        code: s.code,
                        customerName: s.customerName || s.studentName || 'Pemesan',
                        unit: s.targetUnit || '-',
                        phone: s.customerPhone || '-',
                        totalAmount: s.totalAmount || 0,
                        diffDays,
                        itemsSummary: s.items.filter(i => i.status === 'SEDIA').map(i => `${i.itemName} (${i.size}) x${i.qty}`).join(', ')
                    });
                }
            } else if (hasIndent || s.status === 'INDENT') {
                stats.INDENT++;
            } else if (isPending) {
                stats.PENDING++;
                const unit = s.targetUnit || 'Umum';
                unitStats[unit] = (unitStats[unit] || 0) + 1;
            }
        });

        const totalUnpaid = Math.max(0, totalRevenue - totalPaid);
        const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        let msg = `Bismillah.\n📢 *RANGKUMAN STATUS PESANAN SERAGAM*\nPeriode: ${dateStr} (Pagi)\n\n`;
        msg += `Assalamu'alaikum Warahmatullahi Wabarakatuh,\nBerikut adalah status terkini pemesanan seragam siswa:\n\n`;

        msg += `📊 *1. REKAP STATUS PESANAN AKTIF:*\n`;
        msg += `- ⏳ *Pending / Belum Siap:* ${stats.PENDING} Pesanan\n`;
        msg += `- 📦 *Siap Ambil (Sedia):* ${stats.PROSES} Pesanan\n`;
        msg += `- ⏳ *Indent (Menunggu Konveksi):* ${stats.INDENT} Pesanan\n`;
        msg += `- ✅ *Selesai (Sudah Diambil):* ${stats.SELESAI} Pesanan\n\n`;

        msg += `🏫 *2. ANTRIAN PESANAN BARU PER UNIT:*\n`;
        if (Object.keys(unitStats).length > 0) {
            for (const [unit, count] of Object.entries(unitStats)) {
                msg += `- Unit ${unit}: ${count} Pesanan\n`;
            }
        } else {
            msg += `- (Tidak ada antrean pesanan baru)\n`;
        }
        msg += `\n`;

        if (lateReadySales.length > 0) {
            msg += `🚨 *3. PERINGATAN: PESANAN SIAP AMBIL > 30 HARI (Perlu Dibatalkan/Ditindaklanjuti):*\n`;
            lateReadySales.slice(0, 5).forEach((p, idx) => {
                msg += `${idx + 1}. *${p.code}* - ${p.customerName} (${p.unit})\n`;
                msg += `   • Menunggu: *${p.diffDays} Hari*\n`;
                msg += `   • Tagihan: Rp ${p.totalAmount.toLocaleString('id-ID')}\n`;
                msg += `   • Item: ${p.itemsSummary}\n`;
            });
            if (lateReadySales.length > 5) {
                msg += `   ... dan ${lateReadySales.length - 5} pesanan lainnya.\n`;
            }
            msg += `\n`;
        }

        msg += `💰 *4. RINGKASAN KEUANGAN SERAGAM:*\n`;
        msg += `- Total Tagihan: Rp ${totalRevenue.toLocaleString('id-ID')}\n`;
        msg += `- Total Kas Masuk (Lunas): Rp ${totalPaid.toLocaleString('id-ID')}\n`;
        msg += `- Sisa Piutang: Rp ${totalUnpaid.toLocaleString('id-ID')}\n\n`;

        msg += `_Pesan otomatis harian Sistem Manajemen Aset & Sarpras Yayasan Dar el-Iman_`;

        // Send WhatsApp to all target leads
        for (const lead of leads) {
            try {
                await whatsappService.sendMessage(lead.phone, msg);
                console.log(`[Uniform Summary] Daily summary sent to ${lead.name} (${lead.phone})`);
            } catch (sendError) {
                console.error(`[Uniform Summary] Failed to send message to ${lead.name}:`, sendError.message);
            }
        }

        console.log(`[Uniform Summary] Task completed successfully.`);

    } catch (error) {
        console.error("[Uniform Summary Error]", error);
    }
};

module.exports = { sendUniformOrderSummary };
