require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const events = await prisma.sarprasCalendarEvent.findMany({
    orderBy: { id: 'desc' },
    take: 5,
    include: { pics: true }
  });
  console.log('Events:', JSON.stringify(events, null, 2));

  const reports = await prisma.personnelReport.findMany({
    where: { type: 'WEEKLY' }, // isPlan typically maps to WEEKLY
    orderBy: { id: 'desc' },
    take: 2
  });
  console.log('Reports:', JSON.stringify(reports, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
