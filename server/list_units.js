const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listUnits() {
    console.log('--- Listing Units ---');
    try {
        const units = await prisma.unit.findMany();
        units.forEach(u => {
            console.log(`[${u.id}] ${u.name}`);
        });
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

listUnits();
