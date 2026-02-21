const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const bookings = await prisma.vehicleBooking.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
                user: { select: { name: true } },
                vehicle: { select: { name: true } }
            }
        });
        console.log(JSON.stringify(bookings, null, 2));
    } catch (error) {
        console.error('Error fetching bookings:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
