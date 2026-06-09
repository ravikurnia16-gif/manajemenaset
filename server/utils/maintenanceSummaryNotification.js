const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const whatsappService = require('../services/whatsappService');

/**
 * Sends a summary of maintenance conditions to specific leads.
 * Scheduled to run every Monday and Thursday at 07:35 WIB.
 */
const sendMaintenanceConditionSummary = async () => {
    try {
        console.log("[Maintenance Summary] Starting maintenance condition summary task...");

        // Prepare target users (Kepala Bidang Sarana dan Prasarana)
        const leads = await prisma.user.findMany({
            where: {
                position: 'Kepala Bidang Sarana dan Prasarana',
                phone: { not: null, not: '' }
            }
        });

        if (leads.length === 0) {
            console.warn("[Maintenance Summary] Skip: No target users (Kepala Bidang Sarana dan Prasarana) found with phone numbers.");
            return;
        }

        // Fetch ongoing maintenance records
        const maintenances = await prisma.maintenance.findMany({
            where: {
                status: { notIn: ['COMPLETED', 'REJECTED'] }
            },
            select: {
                id: true,
                code: true,
                title: true,
                status: true,
                urgency: true,
                createdAt: true
            }
        });

        // 1. Initialize counters
        const stats = {
            SUBMITTED: { EMERGENCY: 0, URGENT: 0, NORMAL: 0 },
            APPROVED: { EMERGENCY: 0, URGENT: 0, NORMAL: 0 }, // Grouping APPROVED, VALIDATED, ASSIGNED
            IN_PROGRESS: { EMERGENCY: 0, URGENT: 0, NORMAL: 0 }
        };

        const unrespondedList = [];
        const now = new Date();

        maintenances.forEach(m => {
            const urg = m.urgency || 'NORMAL';
            
            if (m.status === 'SUBMITTED') {
                if (stats.SUBMITTED[urg] !== undefined) stats.SUBMITTED[urg]++;
                
                // Calculate waiting time
                const diffMs = now - new Date(m.createdAt);
                unrespondedList.push({ ...m, diffMs });
            } else if (['APPROVED', 'VALIDATED', 'ASSIGNED'].includes(m.status)) {
                if (stats.APPROVED[urg] !== undefined) stats.APPROVED[urg]++;
            } else if (m.status === 'IN_PROGRESS') {
                if (stats.IN_PROGRESS[urg] !== undefined) stats.IN_PROGRESS[urg]++;
            }
        });

        // Format duration helper
        const formatDuration = (ms) => {
            const days = Math.floor(ms / (1000 * 60 * 60 * 24));
            const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            if (days > 0) return `${days} Hari ${hours} Jam`;
            if (hours > 0) return `${hours} Jam`;
            return `Kurang dari 1 Jam`;
        };

        // Get Top 3 oldest unresponded
        unrespondedList.sort((a, b) => b.diffMs - a.diffMs);
        const topUnresponded = unrespondedList.slice(0, 3);

        const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        let msg = `Bismillah.\n📢 *LAPORAN KONDISI PEMELIHARAAN*\nPeriode: ${dateStr}\n\n`;
        msg += `Berikut rekapitulasi laporan pemeliharaan yang berjalan:\n\n`;

        msg += `📥 *1. MASIH DIAJUKAN (Belum Direspon)*\n`;
        msg += `- EMERGENCY: ${stats.SUBMITTED.EMERGENCY} tiket\n`;
        msg += `- URGENT: ${stats.SUBMITTED.URGENT} tiket\n`;
        msg += `- NORMAL: ${stats.SUBMITTED.NORMAL} tiket\n`;
        
        if (topUnresponded.length > 0) {
            msg += `⏳ *Daftar Antrean Terlama:*\n`;
            topUnresponded.forEach(u => {
                msg += `  • [${u.code}] ${u.title} (Menunggu: ${formatDuration(u.diffMs)})\n`;
            });
        }
        msg += `\n`;

        msg += `✅ *2. DISETUJUI & DITUGASKAN*\n`;
        msg += `- EMERGENCY: ${stats.APPROVED.EMERGENCY} tiket\n`;
        msg += `- URGENT: ${stats.APPROVED.URGENT} tiket\n`;
        msg += `- NORMAL: ${stats.APPROVED.NORMAL} tiket\n\n`;

        msg += `🔧 *3. SEDANG DIKERJAKAN (In Progress)*\n`;
        msg += `- EMERGENCY: ${stats.IN_PROGRESS.EMERGENCY} tiket\n`;
        msg += `- URGENT: ${stats.IN_PROGRESS.URGENT} tiket\n`;
        msg += `- NORMAL: ${stats.IN_PROGRESS.NORMAL} tiket\n\n`;

        msg += `Mohon pantauannya agar target waktu perbaikan tetap terjaga.\n`;
        msg += `_Pesan otomatis dari Sistem Manajemen Aset_`;

        // Send WhatsApp to all leads
        for (const lead of leads) {
            try {
                await whatsappService.sendMessage(lead.phone, msg);
                console.log(`[Maintenance Summary] Summary sent to ${lead.name} (${lead.phone})`);
            } catch (sendError) {
                console.error(`[Maintenance Summary] Failed to send message to ${lead.name}:`, sendError.message);
            }
        }

        console.log(`[Maintenance Summary] Task completed.`);

    } catch (error) {
        console.error("[Maintenance Summary Error]", error);
    }
};

module.exports = { sendMaintenanceConditionSummary };
