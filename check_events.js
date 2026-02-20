const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const events = await prisma.sarprasCalendarEvent.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { pics: true }
    });
    console.log(JSON.stringify(events, null, 2));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
