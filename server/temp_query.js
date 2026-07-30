const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Testing getStocks query...");
        const data = await prisma.uniformStock.findMany({
            include: {
                vendor: true,
                variant: {
                    include: {
                        item: { include: { category: true, clothingType: true, vendor: true } },
                        size: true
                    }
                },
                warehouse: true
            },
            orderBy: { variant: { item: { name: 'asc' } } }
        });
        console.log("Success! Returned", data.length, "rows.");
    } catch (e) {
        console.error("Query failed:", e);
    }
}
main().finally(() => prisma.$disconnect());
