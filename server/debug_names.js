const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "mysql://mysql:cb7da2291e8a589a54ea@129.150.59.181:3306/database_simas"
        }
    }
});

async function run() {
    try {
        const names = ['Syafrian', 'Syafruan', 'Wegi', 'Ringgo', 'Eldo', 'Jeri'];
        console.log('Searching for names:', names);

        const users = await prisma.user.findMany({
            where: {
                OR: names.map(n => ({ name: { contains: n } }))
            },
            include: { unit: true }
        });

        console.log('\n--- MATCHING USERS ---');
        if (users.length === 0) {
            console.log('No users found with those names.');
        } else {
            users.forEach(u => {
                console.log(`ID: ${u.id}, Name: "${u.name}", Username: "${u.username}", Unit: "${u.unit?.name || 'N/A'}"`);
            });
        }

        // Also list all users in Sarana dan Prasarana unit
        const sarprasUsers = await prisma.user.findMany({
            where: { unit: { name: { contains: 'Sarana dan Prasarana' } } },
            include: { unit: true }
        });
        console.log('\n--- SARPRAS UNIT USERS ---');
        sarprasUsers.forEach(u => {
            console.log(`ID: ${u.id}, Name: "${u.name}", Unit: "${u.unit?.name}"`);
        });

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

run();
