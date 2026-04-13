const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const contentAdmin = `🚗 *BOOKING KENDARAAN BARU*\n\n👤 *Pemesan*: {{nama_pemesan}}\n📅 *Waktu*: {{waktu}}\n🚗 *Armada*: {{nama_kendaraan}}\n👤 *Driver*: {{nama_supir}}\n📍 *Tujuan*: {{tujuan}}\n📌 *Keperluan*: {{keperluan}}\n👨‍💼 *PIC Armada*: {{nama_pic}}\n\n*Status*: {{status}}\n\nMohon ditinjau di sistem.`;
        const varsAdmin = `["nama_pemesan","waktu","nama_kendaraan","nama_supir","tujuan","keperluan","nama_pic","status"]`;

        await prisma.waNotificationTemplate.update({
            where: { slug: 'VEHICLE_BOOKING_CREATED_ADMIN' },
            data: { content: contentAdmin, availableVars: varsAdmin }
        });

        console.log("Template VEHICLE_BOOKING_CREATED_ADMIN updated.");
    } catch(err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

run();
