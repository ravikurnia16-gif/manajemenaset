require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugUsers() {
    console.log('--- Debugging Staff Manajemen Aset Users ---');

    // 1. Check for the specific positions used in the code
    const targetPositions = ['Kepala Bidang Sarana', 'Staff Manajemen Aset'];
    const users = await prisma.user.findMany({
        where: {
            position: { in: targetPositions }
        },
        select: {
            id: true,
            username: true,
            name: true,
            position: true,
            phone: true,
            role: true
        }
    });

    console.log(`Found ${users.length} users with target positions.`);
    users.forEach(u => {
        console.log(`- ID: ${u.id}, Name: ${u.name}, Position: '${u.position}', Phone: '${u.phone}', Role: ${u.role}`);
    });

    // 2. Check for potential typos (all users with 'Staff' or 'Manajemen' in position)
    const similarUsers = await prisma.user.findMany({
        where: {
            OR: [
                { position: { contains: 'Staff' } },
                { position: { contains: 'Manajemen' } },
                { position: { contains: 'Aset' } }
            ]
        },
        select: { position: true }
    });

    const uniquePositions = [...new Set(similarUsers.map(u => u.position))];
    console.log('\nUnique positions found in DB containing Staff/Manajemen/Aset:');
    uniquePositions.forEach(p => console.log(`- '${p}'`));

    // 3. Check for "Kantor Yayasan" unit
    const yayasanUnit = await prisma.unit.findFirst({
        where: { name: { contains: 'Kantor Yayasan' } }
    });

    if (yayasanUnit) {
        console.log(`\nYayasan Unit Found: ID ${yayasanUnit.id}, Name: '${yayasanUnit.name}'`);
    } else {
        console.log('\nWarning: No unit found containing "Kantor Yayasan"');
        const allUnits = await prisma.unit.findMany({ select: { name: true } });
        console.log('Available Units:');
        allUnits.forEach(un => console.log(`- '${un.name}'`));
    }
}

debugUsers().then(() => prisma.$disconnect());
