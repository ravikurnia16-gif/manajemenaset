require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    console.log('--- Database Check ---');
    try {
        // Test connection
        await prisma.$connect();
        console.log('✅ Database connected.\n');

        const ravi = await prisma.user.findUnique({
            where: { nip: '24071613' }
        });

        if (ravi) {
            console.log('✅ Ravi Kurnia found:');
            console.log(JSON.stringify(ravi, null, 2));
        } else {
            console.log('❌ Ravi Kurnia (NIP: 24071613) NOT found.');
        }

        console.log('\n--- Recent Events (This Week) ---');
        const today = new Date();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        const events = await prisma.sarprasCalendarEvent.findMany({
            where: { date: { gte: monday, lte: sunday } }
        });
        console.log(`Found ${events.length} regular events this week.`);
        events.forEach(e => console.log(` - ${e.title} (${e.date})`));

    } catch (err) {
        console.error('❌ Error during check:', err);
    } finally {
        await prisma.$disconnect();
    }
}

check();
