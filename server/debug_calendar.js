const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);

    console.log('Checking events for:', tomorrow.toLocaleString());

    const regularEvents = await prisma.sarprasCalendarEvent.findMany({
        where: { isRecurring: false, date: { gte: tomorrow, lte: tomorrowEnd } },
        include: { pics: true }
    });

    console.log('Regular Events:', regularEvents.length);
    regularEvents.forEach(e => console.log(`- ${e.title} (PIC: ${e.pics.map(p => p.name).join(', ')})`));

    const recurringEvents = await prisma.sarprasCalendarEvent.findMany({
        where: {
            isRecurring: true,
            date: { lte: tomorrowEnd },
            OR: [{ recurringEndDate: null }, { recurringEndDate: { gte: tomorrow } }]
        },
        include: { pics: true }
    });

    console.log('Recurring Candidates:', recurringEvents.length);
    recurringEvents.forEach(e => {
        const eventDate = new Date(e.date);
        const d = tomorrow;
        let match = false;
        if (e.recurringType === 'DAILY') match = true;
        else if (e.recurringType === 'WEEKLY') match = d.getDay() === eventDate.getDay();
        else if (e.recurringType === 'MONTHLY') match = d.getDate() === eventDate.getDate();

        if (match) {
            console.log(`- [RECURRING] ${e.title} (PIC: ${e.pics.map(p => p.name).join(', ')})`);
        }
    });
}

checkTomorrow()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
