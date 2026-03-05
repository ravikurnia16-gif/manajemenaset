require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const whatsappService = require('./services/whatsappService');

async function debug() {
    console.log('--- Debugging Bus Notifications ---');
    try {
        // 1. Check Admin Users
        const recipients = await prisma.user.findMany({
            where: {
                OR: [
                    { name: { contains: 'Wegi' } },
                    { position: 'Kepala Bidang Sarana dan Prasarana' }
                ],
                phone: { not: null, not: '' }
            }
        });

        console.log(`Found ${recipients.length} eligible admin recipients:`);
        recipients.forEach(r => console.log(` - ${r.name} (${r.phone}) | Position: ${r.position}`));

        // 2. Check if a recent bus booking exists
        const latestBooking = await prisma.busBooking.findFirst({
            orderBy: { createdAt: 'desc' },
            include: { vehicle: true }
        });

        if (latestBooking) {
            console.log('Latest Bus Booking:', JSON.stringify({
                id: latestBooking.id,
                requester: latestBooking.requesterName,
                phone: latestBooking.requesterPhone,
                vehicle: latestBooking.vehicle.name,
                createdAt: latestBooking.createdAt
            }, null, 2));
        } else {
            console.log('No bus bookings found in DB.');
        }

    } catch (err) {
        console.error('DEBUG ERROR:', err);
    } finally {
        await prisma.$disconnect();
        console.log('--- Debug Finished ---');
    }
}

debug();
