require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const syncPlanToCalendar = async (report, user) => {
    try {
        const isPlan = report.metadata?.isPlan;
        if (!isPlan) return;

        // Skip if no title or start dates
        if (!report.metadata?.title || !report.metadata?.startDate) return;

        const title = `[RENCANA: ${user.name || user.username}] ${report.metadata.title}`;
        
        let itemsDesc = '';
        if (report.metadata.items && Array.isArray(report.metadata.items)) {
            itemsDesc = report.metadata.items.map((it, idx) => `${idx + 1}. ${it.activity || it.text || it.name}`).join('\n');
        }
        const description = `Referensi Rencana ID: ${report.id}\n${report.content || ''}\n\nRincian:\n${itemsDesc}`;

        // Map Category
        const calendarCategory = ['Pemeliharaan', 'Pengadaan', 'Kebersihan', 'Rapat', 'Deadline', 'Kerja'].includes(report.category)
            ? report.category
            : 'Kerja';

        const startDate = new Date(report.metadata.startDate);
        const endDate = report.metadata.endDate ? new Date(report.metadata.endDate) : startDate;

        if (report.metadata.calendarEventId) {
            await prisma.sarprasCalendarEvent.update({
                where: { id: parseInt(report.metadata.calendarEventId) },
                data: {
                    title,
                    description,
                    category: calendarCategory,
                    date: startDate,
                    endDate: endDate
                }
            });
            console.log(`[Sync] Updated calendar event ${report.metadata.calendarEventId} for plan ${report.id}`);
        } else {
            const calEvent = await prisma.sarprasCalendarEvent.create({
                data: {
                    title,
                    description,
                    category: calendarCategory,
                    date: startDate,
                    endDate: endDate,
                    createdById: user.id,
                    pics: {
                        connect: [{ id: user.id }]
                    }
                }
            });

            const newMetadata = { ...report.metadata, calendarEventId: calEvent.id };
            await prisma.personnelReport.update({
                where: { id: report.id },
                data: { metadata: newMetadata }
            });

            console.log(`[Sync] Created calendar event ${calEvent.id} for plan ${report.id}`);
        }
    } catch (err) {
        console.error('[Sync Error] Failed to sync plan to calendar:', err.message);
    }
};

async function main() {
    console.log("Starting backfill...");
    const reports = await prisma.personnelReport.findMany({
        where: { type: 'WEEKLY' },
        include: { user: true }
    });
    
    console.log(`Found ${reports.length} weekly reports. Syncing...`);
    let count = 0;
    for (const report of reports) {
        if (report.metadata && report.metadata.isPlan) {
            await syncPlanToCalendar(report, report.user);
            count++;
        }
    }
    console.log(`Backfilled ${count} plans to the calendar successfully!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
