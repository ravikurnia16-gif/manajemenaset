const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const events = await prisma.sarprasCalendarEvent.findMany({
            include: { pics: true, assignments: true },
            orderBy: { date: 'desc' },
            take: 20
        });

        console.log('--- RECENT EVENTS ---');
        events.forEach(e => {
            console.log(`ID: ${e.id} | Title: ${e.title} | Date: ${e.date.toISOString()} | End: ${e.endDate ? e.endDate.toISOString() : 'N/A'}`);
        });

        // Check for March specifically
        const march = await prisma.sarprasCalendarEvent.findMany({
            where: {
                date: {
                    gte: new Date('2026-03-01T00:00:00Z'),
                    lt: new Date('2026-04-01T00:00:00Z')
                }
            }
        });
        console.log('\n--- MARCH 2026 EVENTS ---');
        console.log('Count:', march.length);
        march.forEach(e => console.log(`- ${e.title} (${e.date.toISOString()})`));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

check();
