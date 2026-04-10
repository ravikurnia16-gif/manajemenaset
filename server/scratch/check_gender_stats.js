const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const items = await prisma.warehouseItem.findMany({
        select: { gender: true }
    });

    const genderStats = items.reduce((acc, item) => {
        acc[item.gender] = (acc[item.gender] || 0) + 1;
        return acc;
    }, {});

    console.log('Gender Statistics in WarehouseItem:');
    console.log(JSON.stringify(genderStats, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
