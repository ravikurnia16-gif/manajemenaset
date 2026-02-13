const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const users = await prisma.user.findMany({
            include: { unit: true },
        });
        console.log('--- USER LIST ---');
        users.forEach(u => {
            console.log(`ID: ${u.id}, Name: ${u.name}, Role: ${u.role}, Unit: ${u.unit?.name || 'N/A'}`);
        });
        console.log('-----------------');
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

run();
