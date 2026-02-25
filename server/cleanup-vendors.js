const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupTestVendors() {
    try {
        // 1. Get all vendors
        const vendors = await prisma.vendor.findMany({
            include: { _count: { select: { assets: true, procurementItems: true, products: true } } }
        });

        console.log(`Found ${vendors.length} vendors:`);
        vendors.forEach(v => {
            console.log(`  [ID: ${v.id}] "${v.name}" - Assets: ${v._count.assets}, Products: ${v._count.products}`);
        });

        // 2. Disconnect assets from these vendors (set vendorId to null)
        const disconnected = await prisma.asset.updateMany({
            where: { vendorId: { not: null } },
            data: { vendorId: null }
        });
        console.log(`\nDisconnected ${disconnected.count} assets from vendors (assets NOT deleted, just vendor reference cleared)`);

        // 3. Disconnect procurement items
        const disconnectedItems = await prisma.procurementItem.updateMany({
            where: { vendorId: { not: null } },
            data: { vendorId: null }
        });
        console.log(`Disconnected ${disconnectedItems.count} procurement items from vendors`);

        // 4. Delete all vendor products (cascade should handle, but just in case)
        const deletedProducts = await prisma.vendorProduct.deleteMany({});
        console.log(`Deleted ${deletedProducts.count} vendor products`);

        // 5. Delete all vendors
        const deletedVendors = await prisma.vendor.deleteMany({});
        console.log(`Deleted ${deletedVendors.count} vendors`);

        console.log('\n✅ Cleanup selesai! Semua vendor test sudah dihapus.');
        console.log('   Aset-aset tetap aman, hanya referensi vendor-nya yang dikosongkan.');
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

cleanupTestVendors();
