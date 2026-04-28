const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixInconsistentRooms() {
    console.log("Memulai pengecekan data ruangan yang tidak konsisten...");
    
    // Ambil semua aset yang memiliki ruangan
    const assets = await prisma.asset.findMany({
        where: {
            roomId: { not: null }
        },
        include: {
            room: true
        }
    });

    let inconsistentCount = 0;
    let fixedCount = 0;

    for (const asset of assets) {
        // Cek apakah unitId aset berbeda dengan unitId ruangannya
        if (asset.room && asset.unitId !== asset.room.unitId) {
            inconsistentCount++;
            const roomName = asset.room.name;
            const targetUnitId = asset.unitId;

            console.log(`Menemukan inkonsistensi: Aset ${asset.code} (${asset.name}) berada di Unit ${asset.unitId}, tapi ruangannya "${roomName}" milik Unit ${asset.room.unitId}`);

            // Cari ruangan dengan nama yang sama di unit yang benar
            let correctRoom = await prisma.room.findFirst({
                where: {
                    name: { equals: roomName },
                    unitId: targetUnitId
                }
            });

            // Jika tidak ada, buatkan ruangan baru untuk unit tersebut
            if (!correctRoom) {
                console.log(`Ruangan "${roomName}" belum ada di Unit ${targetUnitId}. Membuat ruangan baru...`);
                
                // Ambil kode unit untuk generate room code
                const unit = await prisma.unit.findUnique({ where: { id: targetUnitId } });
                const count = await prisma.room.count({ where: { unitId: targetUnitId } });
                const seq = (count + 1).toString().padStart(2, '0');
                const newRoomCode = `${unit.code}-${seq}`;

                correctRoom = await prisma.room.create({
                    data: {
                        name: roomName,
                        code: newRoomCode,
                        floor: '1',
                        building: '-',
                        unitId: targetUnitId
                    }
                });
            }

            // Update aset agar merujuk ke ruangan yang benar
            await prisma.asset.update({
                where: { id: asset.id },
                data: { roomId: correctRoom.id }
            });

            fixedCount++;
        }
    }

    console.log(`-----------------------------------`);
    console.log(`Total aset bermasalah ditemukan: ${inconsistentCount}`);
    console.log(`Total aset berhasil diperbaiki: ${fixedCount}`);
    
    await prisma.$disconnect();
}

fixInconsistentRooms().catch(err => {
    console.error("Terjadi kesalahan:", err);
    process.exit(1);
});
