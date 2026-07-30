const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function mergeStocks() {
    try {
        console.log("Checking for duplicate stocks to merge...");
        // Get all stocks
        const allStocks = await prisma.uniformStock.findMany();
        
        // Group by variantId_warehouseId
        const groups = {};
        for (const stock of allStocks) {
            const key = `${stock.variantId}_${stock.warehouseId}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(stock);
        }

        for (const key of Object.keys(groups)) {
            const group = groups[key];
            if (group.length > 1) {
                console.log(`Found ${group.length} duplicates for ${key}. Merging...`);
                // Sort by ID to keep the oldest one
                group.sort((a, b) => a.id - b.id);
                const keep = group[0];
                const remove = group.slice(1);

                let totalQty = keep.quantity;
                let totalCostValue = keep.quantity * (keep.avgCost || 0);

                for (const r of remove) {
                    totalQty += r.quantity;
                    totalCostValue += (r.quantity * (r.avgCost || 0));
                }

                const newAvgCost = totalQty > 0 ? (totalCostValue / totalQty) : 0;

                // Update the kept one
                await prisma.uniformStock.update({
                    where: { id: keep.id },
                    data: {
                        quantity: totalQty,
                        avgCost: newAvgCost
                    }
                });

                // Delete the others
                for (const r of remove) {
                    await prisma.uniformStock.delete({ where: { id: r.id } });
                }
                console.log(`Merged ${key} successfully.`);
            }
        }
        
        console.log("Merging duplicates completed.");
    } catch (e) {
        console.error("Error merging stocks:", e);
    } finally {
        await prisma.$disconnect();
    }
}

mergeStocks();
