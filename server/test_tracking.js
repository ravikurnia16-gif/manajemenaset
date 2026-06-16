const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const bookings = await prisma.vehicleBooking.findMany({
        where: { status: 'BERLANGSUNG' },
        include: {
            vehicle: {
                select: { id: true, name: true, plateNumber: true, currentLat: true, currentLng: true, lastLocationUpdate: true }
            },
            user: { select: { name: true } },
            driver: { select: { name: true } }
        }
    });
    console.log(JSON.stringify(bookings, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
