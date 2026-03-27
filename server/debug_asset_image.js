const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugAsset() {
    try {
        const asset = await prisma.asset.findUnique({
            where: { id: 16752 }
        });
        console.log('DEBUG ASSET 16752:');
        console.log('Name:', asset.name);
        console.log('Image Value:', asset.image);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

debugAsset();
