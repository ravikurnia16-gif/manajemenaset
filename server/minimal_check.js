require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        console.log('Connecting to DB...');
        await prisma.$connect();
        console.log('Connected!');

        console.log('Searching for admins...');
        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { name: { contains: 'Wegi' } },
                    { position: 'Kepala Bidang Sarana' }
                ]
            }
        });
        console.log('Found:', users.length);
        users.forEach(u => console.log(`- ${u.name} | ${u.phone} | ${u.position}`));

    } catch (err) {
        console.error('ERROR:', err);
    } finally {
        await prisma.$disconnect();
    }
}

check();
