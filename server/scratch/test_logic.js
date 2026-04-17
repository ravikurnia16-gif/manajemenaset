const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Mock function to test logic
async function testReminderLogic() {
    process.env.TZ = 'Asia/Jakarta';
    const now = new Date();
    const thirtyMinsLater = new Date(now.getTime() + 30 * 60 * 1000);
    const sixtyMinsAgo = new Date(now.getTime() - 60 * 60 * 1000);

    console.log('--- MOCK LOGIC TEST ---');
    console.log('Now:', now.toLocaleString('id-ID'));
    console.log('Window Advance (up to):', thirtyMinsLater.toLocaleString('id-ID'));
    console.log('Window Late (past):', sixtyMinsAgo.toLocaleString('id-ID'));

    // 1. Check what would be picked up for ADVANCE
    const advance = await prisma.vehicleBooking.findMany({
        where: {
            status: 'APPROVED',
            startDate: { gte: now, lte: thirtyMinsLater },
            tripStartTime: null
        },
        select: { id: true, startDate: true, user: { select: { name: true } } }
    });
    console.log(`\nAdvance Reminders detected: ${advance.length}`);
    advance.forEach(b => console.log(`- ID: ${b.id} | User: ${b.user.name} | Starts At: ${b.startDate.toLocaleString('id-ID')}`));

    // 2. Check what would be picked up for LATE START
    const late = await prisma.vehicleBooking.findMany({
        where: {
            status: 'APPROVED',
            startDate: { lte: now, gte: sixtyMinsAgo },
            tripStartTime: null
        },
        select: { id: true, startDate: true, user: { select: { name: true } } }
    });
    console.log(`\nLate Start Reminders detected: ${late.length}`);
    late.forEach(b => console.log(`- ID: ${b.id} | User: ${b.user.name} | Should have started at: ${b.startDate.toLocaleString('id-ID')}`));

    await prisma.$disconnect();
}

testReminderLogic();
