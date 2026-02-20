const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const events = await prisma.sarprasCalendarEvent.findMany({
        include: { pics: true }
    });

    console.log('Total events:', events.length);

    const marchEvents = events.filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === 2026 && d.getMonth() === 2; // March is index 2
    });

    console.log('March 2026 events:', JSON.stringify(marchEvents, null, 2));

    await prisma.$disconnect();
}

check();
