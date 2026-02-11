const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function upsertJeri() {
    try {
        console.log('Upserting user with NIP: 18121079...');
        // Try to update if exists, or create if not
        const nip = '18121079';

        // Cek dulu
        const existing = await prisma.user.findFirst({ where: { nip } });

        if (existing) {
            console.log('User found. Updating phone number...');
            await prisma.user.update({
                where: { id: existing.id },
                data: { phone: '081234567890' } // Placeholder phone, User should update this!
            });
            console.log('User phone updated to 081234567890.');
        } else {
            console.log('User NOT found. Creating new user...');
            // Need mandatory fields. Assuming defaults.
            await prisma.user.create({
                data: {
                    name: 'Jeri Saputra',
                    username: 'jeri123',
                    password: 'password123', // Default
                    email: 'jeri@example.com',
                    nip: nip,
                    phone: '081234567890',
                    role: 'USER', // Or ADMIN?
                    unitId: 1 // Default Unit ID 1
                }
            });
            console.log('User Jeri Saputra created with phone 081234567890.');
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

upsertJeri();
