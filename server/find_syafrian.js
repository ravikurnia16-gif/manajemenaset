const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    console.log('--- Searching for Syafrian ---');
    try {
        const users = await prisma.user.findMany({
            where: {
                name: {
                    contains: 'Syafrian'
                }
            }
        });

        if (users.length > 0) {
            users.forEach(u => {
                console.log('✅ User found:');
                console.log('   ID:', u.id);
                console.log('   Name:', u.name);
                console.log('   NIP:', u.nip);
                console.log('   Phone:', u.phone);
                console.log('   Role:', u.role);
            });
        } else {
            console.log('❌ User "Syafrian" NOT found.');
        }

    } catch (err) {
        console.error('❌ Database error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

check();
