const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const vehicles = await prisma.vehicle.findMany({
    where: { currentLat: { not: null }, currentLng: { not: null } },
    include: {
      bookings: {
        where: { status: 'BERLANGSUNG' },
        take: 1,
        include: {
          user: { select: { name: true, phone: true } },
          driver: { select: { name: true, phone: true } }
        }
      }
    }
  });

  const activeTrackingData = vehicles.map(v => {
    const activeBooking = v.bookings[0] || null;
    return {
      id: activeBooking ? activeBooking.id : 'v-'+v.id,
      status: activeBooking ? 'BERLANGSUNG' : 'IDLE',
      destination: activeBooking ? activeBooking.destination : 'Parkir/Standby',
      user: activeBooking ? activeBooking.user : null,
      driver: activeBooking ? activeBooking.driver : null,
      vehicle: {
        id: v.id,
        name: v.name,
        plateNumber: v.plateNumber,
        type: v.type,
        currentLat: v.currentLat,
        currentLng: v.currentLng,
        lastLocationUpdate: v.lastLocationUpdate
      }
    };
  });

  console.log(JSON.stringify(activeTrackingData, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
