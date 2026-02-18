const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findAdmins() {
    console.log('--- Searching for Admins ---');
    try {
        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { name: { contains: 'Ravi' } },
                    { name: { contains: 'Syafrian' } }
                ]
            }
        });

        if (users.length > 0) {
            users.forEach(u => {
                console.log(`✅ Found: [${u.id}] ${u.name} (${u.role}) - NIP: ${u.nip}`);
            });
        } else {
            console.log('❌ No users found.');
        }

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

findAdmins();
