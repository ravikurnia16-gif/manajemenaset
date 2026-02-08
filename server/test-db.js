const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Testing connection...');
        await prisma.$connect();
        console.log('Connection successful!');
        const result = await prisma.$queryRaw`SELECT 1`;
        console.log('Query result:', result);
    } catch (e) {
        console.error('Connection failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
