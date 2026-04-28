const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkInconsistentRooms() {
    const assets = await prisma.asset.findMany({
        include: {
            room: true
        }
    });

    let inconsistentCount = 0;
    const inconsistencies = [];

    for (const asset of assets) {
        if (asset.roomId && asset.room && asset.unitId !== asset.room.unitId) {
            inconsistentCount++;
            inconsistencies.push({
                assetId: asset.id,
                assetCode: asset.code,
                assetUnitId: asset.unitId,
                roomName: asset.room.name,
                roomUnitId: asset.room.unitId
            });
        }
    }

    console.log(`Total inconsistent assets: ${inconsistentCount}`);
    if (inconsistentCount > 0) {
        console.log('Sample inconsistencies:');
        console.log(JSON.stringify(inconsistencies.slice(0, 5), null, 2));
    }
    
    await prisma.$disconnect();
}

checkInconsistentRooms();
