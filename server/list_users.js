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
        const units = await prisma.unit.findMany();
        console.log('--- UNITS ---');
        units.forEach(u => console.log(`ID: ${u.id}, Name: ${u.name}`));

        const users = await prisma.user.findMany({
            include: { unit: true },
        });
        console.log('\n--- USER LIST ---');
        users.forEach(u => {
            console.log(`ID: ${u.id}, Name: ${u.name}, Role: ${u.role}, UnitID: ${u.unitId}, UnitName: ${u.unit?.name || 'N/A'}`);
        });
        console.log('-----------------');
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

run();
