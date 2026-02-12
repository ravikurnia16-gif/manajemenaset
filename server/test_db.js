const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Testing DB connection...');
        const count = await prisma.user.count();
        console.log('User count:', count);

        console.log('Testing Maintenance query...');
        const maintenance = await prisma.maintenance.findMany({
            include: { assets: true }
        });
        console.log('Maintenance count:', maintenance.length);
    } catch (e) {
        console.error('DB Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
