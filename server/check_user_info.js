const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    console.log('--- Checking for Ravi Kurnia (NIP: 24071613) ---');
    try {
        const user = await prisma.user.findUnique({
            where: { nip: '24071613' }
        });
        if (user) {
            console.log('✅ User found:');
            console.log('   Name:', user.name);
            console.log('   NIP:', user.nip);
            console.log('   Phone:', user.phone);
            console.log('   Role:', user.role);
        } else {
            console.log('❌ User NOT found in database.');
        }

        // List all users to see if NIP might be different
        console.log('\n--- Listing all users to verify ---');
        const allUsers = await prisma.user.findMany({
            select: { id: true, name: true, nip: true, phone: true }
        });
        allUsers.forEach(u => console.log(`ID: ${u.id}, Name: ${u.name}, NIP: ${u.nip}, Phone: ${u.phone}`));

    } catch (err) {
        console.error('❌ Database error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

check();
