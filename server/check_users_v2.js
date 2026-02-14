const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                name: true,
                role: true,
            },
            orderBy: { createdAt: 'desc' }
        });
        console.log('Total Users:', users.length);
        console.log('Roles found:', [...new Set(users.map(u => u.role))]);
        console.log('Users (Excluding SUPER_ADMIN):');
        const filtered = users.filter(u => u.role !== 'SUPER_ADMIN');
        filtered.forEach(u => {
            console.log(`- ID: ${u.id}, Name: "${u.name}", Username: "${u.username}", Role: "${u.role}"`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
