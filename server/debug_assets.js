const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const totalAll = await prisma.asset.count();
        console.log('Total Assets in DB:', totalAll);

        // Group by condition to see what we have
        const conditions = await prisma.asset.groupBy({
            by: ['condition'],
            _count: { _all: true }
        });
        console.log('Conditions in DB:', JSON.stringify(conditions, null, 2));

        const where = {
            condition: { not: 'DISPOSED' }
        };
        const totalFiltered = await prisma.asset.count({ where });
        console.log('Total Assets (NOT DISPOSED):', totalFiltered);

    } catch (e) {
        console.error('QUERY FAILED:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
