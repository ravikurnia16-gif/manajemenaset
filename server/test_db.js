const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Connecting to database...");
        const result = await prisma.$queryRaw`SELECT 1 as connected`;
        console.log("Connection successful:", result);
    } catch (error) {
        console.error("Connection failed:", error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
