const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendMessage } = require('../services/whatsappService');

/**
 * Request a new asset mutation (Status: PENDING)
 */
exports.requestMutation = async (req, res) => {
    try {
        const { assetId, toRoomId, reason, type, toUnitId } = req.body; // type: INTERNAL | EXTERNAL
        const requesterId = req.user.id;

        // 1. Get Asset current location/room
        const asset = await prisma.asset.findUnique({
            where: { id: parseInt(assetId) },
            include: { room: true, unit: true }
        });

        if (!asset) return res.status(404).json({ error: 'Asset not found' });

        // Logic check for Internal vs External
        let finalToUnitId = asset.unitId; // Default to current unit for INTERNAL
        let mutationType = type || 'INTERNAL';

        if (mutationType === 'EXTERNAL') {
            if (!toUnitId) return res.status(400).json({ error: 'Unit Tujuan wajib diisi untuk Mutasi Antar Unit' });
            finalToUnitId = parseInt(toUnitId);
        } else {
            // Internal Mutation
            // Ensure the room belongs to the same unit (optional strict check, skipping for flexibility now)
        }

        // 2. Create Movement record
        const movement = await prisma.movement.create({
            data: {
                assetId: parseInt(assetId),
                fromLocation: asset.room ? `${asset.room.name} (${asset.unit.name})` : 'Unknown', // Enhanced location info
                toLocation: '', // To be filled below
                toRoomId: parseInt(toRoomId),
                toUnitId: finalToUnitId, // Store target Unit
                reason,
                status: 'PENDING',
                type: mutationType,
                requesterId
            },
            include: { asset: true, requester: true }
        });

        // 3. Get Room & Unit Info for "toLocation" text
        const targetRoom = await prisma.room.findUnique({ where: { id: parseInt(toRoomId) } });
        const targetUnit = await prisma.unit.findUnique({ where: { id: finalToUnitId } });

        const toLocationText = targetRoom
            ? `${targetRoom.name} ${targetUnit ? '(' + targetUnit.name + ')' : ''}`
            : 'Unknown';

        await prisma.movement.update({
            where: { id: movement.id },
            data: { toLocation: toLocationText }
        });

        res.status(201).json(movement);

        // --- Delayed Notification (30-60s) ---
        setTimeout(async () => {
            try {
                // Find specific recipients: Ravi Kurnia (24071613) and Eldo (26021760) only
                const recipients = await prisma.user.findMany({
                    where: {
                        OR: [
                            { nip: '24071613' }, // Ravi Kurnia
                            { nip: '26021760' }  // Eldo
                        ],
                        phone: { not: null, not: '' } // Ensure phone is not empty
                    }
                });

                if (recipients.length === 0) {
                    console.log('[Mutation] No valid notification recipients found.');
                    return;
                }

                const message = `🔄 *PENGAJUAN MUTASI ASET (${mutationType})*\n\n` +
                    `Terdapat permintaan mutasi baru:\n` +
                    `📦 *Aset*: ${asset.name} (${asset.code})\n` +
                    `📍 *Dari*: ${asset.room ? asset.room.name : '-'} (${asset.unit?.name})\n` +
                    `🎯 *Ke*: ${targetRoom ? targetRoom.name : '-'} (${targetUnit?.name})\n` +
                    `📝 *Alasan*: ${reason || '-'}\n` +
                    `👤 *Oleh*: ${movement.requester.username}\n\n` +
                    `Mohon segera tinjau di dashboard untuk persetujuan.`;

                let cumulativeDelay = 0;
                for (const user of recipients) {
                    const randomGap = Math.floor(Math.random() * (20000 - 5000 + 1)) + 5000;
                    cumulativeDelay += randomGap;

                    setTimeout(async () => {
                        try {
                            await sendMessage(user.phone, message);
                            console.log(`[Mutation] Notification sent to ${user.username} (${user.phone}).`);
                        } catch (err) {
                            console.error(`[Mutation] Failed to notify ${user.username}:`, err.message);
                        }
                    }, cumulativeDelay);
                }
            } catch (err) {
                console.error('[Mutation Notification Error]', err.message);
            }
        }, 45000); // 45 seconds average delay

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Approve a mutation (Updates Asset Location & Unit)
 */
exports.approveMutation = async (req, res) => {
    try {
        const { id } = req.params;
        const { note } = req.body;
        const approverId = req.user.id;

        const movement = await prisma.movement.findUnique({
            where: { id: parseInt(id) },
            include: { asset: true }
        });

        if (!movement) return res.status(404).json({ error: 'Mutation record not found' });
        if (movement.status !== 'PENDING') return res.status(400).json({ error: 'Movement is already processed' });

        // Update Movement & Asset Location in Transaction
        const result = await prisma.$transaction(async (tx) => {
            const updatedMovement = await tx.movement.update({
                where: { id: parseInt(id) },
                data: {
                    status: 'APPROVED',
                    approverId,
                    approvalDate: new Date(),
                    approvalNote: note
                }
            });

            // Update Asset's Room ID
            if (movement.toRoomId) {
                const updateData = { roomId: movement.toRoomId };

                // Also update Unit ID if it's an External Mutation or toUnitId is present
                if (movement.toUnitId) {
                    updateData.unitId = movement.toUnitId;
                }

                await tx.asset.update({
                    where: { id: movement.assetId },
                    data: updateData
                });
            }

            return updatedMovement;
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Reject a mutation
 */
exports.rejectMutation = async (req, res) => {
    try {
        const { id } = req.params;
        const { note } = req.body;
        const approverId = req.user.id;

        const updatedMovement = await prisma.movement.update({
            where: { id: parseInt(id) },
            data: {
                status: 'REJECTED',
                approverId,
                approvalDate: new Date(),
                approvalNote: note
            }
        });

        res.json(updatedMovement);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAllMovements = async (req, res) => {
    try {
        const movements = await prisma.movement.findMany({
            include: {
                asset: { include: { category: true } },
                requester: { select: { username: true, name: true } },
                approver: { select: { username: true, name: true } }
            },
            orderBy: { date: 'desc' }
        });
        res.json(movements);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getMovementById = async (req, res) => {
    try {
        const movement = await prisma.movement.findUnique({
            where: { id: parseInt(req.params.id) },
            include: {
                asset: true,
                requester: { select: { username: true, name: true } },
                approver: { select: { username: true, name: true } }
            }
        });
        res.json(movement);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
