require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function isSarprasUnit(unitId) {
    if (!unitId) return false;
    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    return unit && unit.name.toLowerCase().includes('sarana dan prasarana');
}

const syncPlanToCalendar = async (report, user) => {
    try {
        const isPlan = report.metadata?.isPlan;
        if (!isPlan) {
            console.log("Not a plan");
            return;
        }

        if (!report.metadata?.title || !report.metadata?.startDate) {
            console.log("Missing title or start date");
            return;
        }

        const title = `[RENCANA: ${user.name || user.username}] ${report.metadata.title}`;
        
        let itemsDesc = '';
        if (report.metadata.items && Array.isArray(report.metadata.items)) {
            itemsDesc = report.metadata.items.map((it, idx) => `${idx + 1}. ${it.activity || it.text || it.name}`).join('\n');
        }
        const description = `Referensi Rencana ID: ${report.id}\n${report.content || ''}\n\nRincian:\n${itemsDesc}`;

        const calendarCategory = ['Pemeliharaan', 'Pengadaan', 'Kebersihan', 'Rapat', 'Deadline', 'Kerja'].includes(report.category)
            ? report.category
            : 'Kerja';

        const startDate = new Date(report.metadata.startDate);
        const endDate = report.metadata.endDate ? new Date(report.metadata.endDate) : startDate;

        if (report.metadata.calendarEventId) {
            await prisma.sarprasCalendarEvent.update({
                where: { id: parseInt(report.metadata.calendarEventId) },
                data: { title, description, category: calendarCategory, date: startDate, endDate: endDate }
            });
            console.log(`Updated event ${report.metadata.calendarEventId}`);
        } else {
            console.log("Creating new event for", user.id);
            const calEvent = await prisma.sarprasCalendarEvent.create({
                data: {
                    title, description, category: calendarCategory, date: startDate, endDate: endDate,
                    createdById: user.id,
                    pics: { connect: [{ id: user.id }] }
                }
            });

            const newMetadata = { ...report.metadata, calendarEventId: calEvent.id };
            await prisma.personnelReport.update({
                where: { id: report.id },
                data: { metadata: newMetadata }
            });
            console.log(`Created calendar event ${calEvent.id}`);
        }
    } catch (err) {
        console.error('Failed to sync:', err.message);
    }
};

async function main() {
  const user = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!user) return console.log('No user');

  const metadata = {
      isPlan: true,
      startDate: '2026-04-12',
      endDate: '2026-04-15',
      title: 'TEST RENCANA',
      items: [{ activity: 'Test Activity', status: 'PENDING', percentage: 0 }]
  };

  const report = await prisma.personnelReport.create({
      data: {
          userId: user.id,
          type: 'WEEKLY',
          category: 'UMUM',
          content: 'Testing from script',
          metadata: metadata,
          date: new Date('2026-04-12')
      }
  });

  console.log('Created report', report.id);
  await syncPlanToCalendar(report, user);

  const event = await prisma.sarprasCalendarEvent.findMany({ orderBy:{id:'desc'}, take:1 });
  console.log('Event created:', event);
}

main().catch(console.error).finally(() => prisma.$disconnect());
