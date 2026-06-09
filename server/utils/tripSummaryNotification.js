const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const whatsappService = require('../services/whatsappService');

/**
 * Sends a weekly summary of bus bookings for the current week to specific leads.
 * Scheduled to run every Monday at 07:35 WIB.
 */
const sendWeeklyBusTripSummary = async () => {
    try {
        console.log("[Weekly Trip Summary] Starting weekly bus trip summary task...");

        // 1. Calculate this week's range (Monday - Sunday)
        const today = new Date();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
        monday.setHours(0, 0, 0, 0);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        // 2. Prepare target users (Kepala Bidang Sarana dan Prasarana)
        const leads = await prisma.user.findMany({
            where: {
                position: 'Kepala Bidang Sarana dan Prasarana',
                phone: { not: null, not: '' }
            }
        });

        if (leads.length === 0) {
            console.warn("[Weekly Trip Summary] Skip: No target users (Kepala Bidang Sarana dan Prasarana) found with phone numbers.");
            return;
        }

        // 3. Fetch BusBookings for this week
        const busBookings = await prisma.busBooking.findMany({
            where: {
                startDate: { gte: monday, lte: sunday },
                status: { notIn: ['CANCELLED'] }
            },
            include: {
                vehicle: true,
                driver: true
            },
            orderBy: { startDate: 'asc' }
        });

        if (busBookings.length === 0) {
            console.log('[Weekly Trip Summary] No bus bookings for this week. Sending empty report.');
            const emptyMsg = `Bismillah.\n📢 *LAPORAN JADWAL OPERASIONAL BUS PEKAN INI* 🚌\nPeriode: ${monday.toLocaleDateString('id-ID')} s/d ${sunday.toLocaleDateString('id-ID')}\n\n*Tidak ada agenda perjalanan bus yang tercatat untuk pekan ini.*\n\nTerima kasih.`;
            for (const lead of leads) {
                try {
                    await whatsappService.sendMessage(lead.phone, emptyMsg);
                } catch (e) {
                    console.error(`[Weekly Trip Summary] Failed to send empty report to ${lead.name}:`, e.message);
                }
            }
            return;
        }

        // 4. Format Message
        let msg = `Bismillah.\n📢 *LAPORAN JADWAL OPERASIONAL BUS PEKAN INI* 🚌\n`;
        msg += `Periode: ${monday.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })} s/d ${sunday.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}\n\n`;
        msg += `Berikut adalah daftar pemesanan bus untuk pekan ini:\n\n`;

        let currentDayStr = '';
        busBookings.forEach(booking => {
            const startDate = new Date(booking.startDate);
            const dayStr = startDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
            
            if (dayStr !== currentDayStr) {
                msg += `📌 *${dayStr}*\n`;
                currentDayStr = dayStr;
            }
            
            const driverInfo = booking.driver ? `${booking.driver.name} (${booking.driver.phone || '-'})` : '(Belum ditentukan)';
            const timeStr = startDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
            
            msg += `• *${booking.vehicle?.name || 'Bus'} (${booking.vehicle?.plateNumber || '-'})*\n`;
            msg += `  👤 Pemesan: ${booking.requesterName || '-'} (Unit: ${booking.unit || '-'}) \n`;
            msg += `  📍 Tujuan: ${booking.destination || '-'}\n`;
            msg += `  📝 Keperluan: ${booking.purpose || '-'}\n`;
            msg += `  👤 Driver: ${driverInfo}\n`;
            msg += `  ⏱️ Waktu: ${timeStr}\n\n`;
        });

        msg += `--------------------------------------------\n`;
        msg += `📈 *Total Perjalanan Bus Pekan Ini:* ${busBookings.length} Perjalanan\n\n`;
        msg += `_Pesan otomatis dari Sistem Manajemen Aset_`;

        for (const lead of leads) {
            try {
                await whatsappService.sendMessage(lead.phone, msg);
                console.log(`[Weekly Trip Summary] SUCCESS: Message sent to ${lead.name}`);
            } catch (err) {
                console.error(`[Weekly Trip Summary] ERROR sending to ${lead.name}:`, err.message);
            }
        }

        console.log(`[Weekly Trip Summary] Task completed.`);

    } catch (error) {
        console.error("[Weekly Trip Summary] Error:", error);
    }
};

module.exports = { sendWeeklyBusTripSummary };
