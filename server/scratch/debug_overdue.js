const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugOverdue() {
    process.env.TZ = 'Asia/Jakarta';
    const now = new Date();
    console.log('Current Time (Node):', now.toLocaleString('id-ID'));
    console.log('Current Hour:', now.getHours());
    
    // Check for qualifying bookings
    const bookings = await prisma.vehicleBooking.findMany({
        where: {
            status: 'APPROVED',
            startDate: { lt: now },
            tripStartTime: null
        },
        include: {
            user: { select: { id: true, name: true, phone: true } },
            vehicle: { select: { name: true, plateNumber: true } }
        }
    });

    console.log(`Found ${bookings.length} qualifying bookings:`);
    bookings.forEach(b => {
        console.log(`- ID: ${b.id} | User: ${b.user.name} | StartDate: ${b.startDate.toLocaleString('id-ID')} | Status: ${b.status}`);
    });

    // Also check for PENDING bookings close to now
    const pending = await prisma.vehicleBooking.findMany({
        where: {
            status: 'PENDING',
            startDate: { lt: now }
        }
    });
    console.log(`Found ${pending.length} PENDING bookings that are past their start date.`);

    await prisma.$disconnect();
}

debugOverdue();
