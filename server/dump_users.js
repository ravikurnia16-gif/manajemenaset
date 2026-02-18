const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function dump() {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, name: true, nip: true, role: true }
        });
        console.log(JSON.stringify(users, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

dump();
