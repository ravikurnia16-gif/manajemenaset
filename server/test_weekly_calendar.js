const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendWeeklyCalendarSummary } = require('./controllers/calendarController');

async function test() {
    console.log('🚀 Triggering Weekly Calendar Summary...');
    try {
        await sendWeeklyCalendarSummary();
        console.log('✅ Done. Please check WhatsApp logs or Ravi Kurnia\'s phone.');
    } catch (err) {
        console.error('❌ Failed:', err);
    } finally {
        await prisma.$disconnect();
    }
}

test();
