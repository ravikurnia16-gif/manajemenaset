const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendMessage } = require('../services/whatsappService');

/**
 * Request a new asset mutation (Status: PENDING)
 */
exports.requestMutation = async (req, res) => {
    try {
        const { assetId, toRoomId, reason } = req.body;
        const requesterId = req.user.id;

        // 1. Get Asset current location/room
        const asset = await prisma.asset.findUnique({
            where: { id: parseInt(assetId) },
            include: { room: true }
        });

        if (!asset) return res.status(404).json({ error: 'Asset not found' });

        // 2. Create Movement record
        const movement = await prisma.movement.create({
            data: {
                assetId: parseInt(assetId),
                fromLocation: asset.room ? asset.room.name : 'Unknown',
                toLocation: '', // To be filled or handled by toRoomId
                toRoomId: parseInt(toRoomId),
                reason,
                status: 'PENDING',
                requesterId
            },
            include: { asset: true, requester: true }
        });

        // 3. Get Room Info for "toLocation"
        const targetRoom = await prisma.room.findUnique({ where: { id: parseInt(toRoomId) } });
        if (targetRoom) {
            await prisma.movement.update({
                where: { id: movement.id },
                data: { toLocation: targetRoom.name }
            });
        }

        res.status(201).json(movement);

        // --- Delayed Notification (30-60s) ---
        setTimeout(async () => {
            try {
                // Find Kabid Sarpras and Eldo NIY (26021760)
                const recipients = await prisma.user.findMany({
                    where: {
                        OR: [
                            { role: 'KEPALA_BIDANG' },
                            { nip: '26021760' }
                        ],
                        phone: { not: null }
                    }
                });

                if (recipients.length === 0) return;

                const message = `🔄 *PENGAJUAN MUTASI ASET*\n\n` +
                    `Terdapat permintaan mutasi baru:\n` +
                    `📦 *Aset*: ${asset.name} (${asset.code})\n` +
                    `📍 *Dari*: ${asset.room ? asset.room.name : 'Unknown'}\n` +
                    `🎯 *Ke*: ${targetRoom ? targetRoom.name : 'Unknown'}\n` +
                    `📝 *Alasan*: ${reason || '-'}\n` +
                    `👤 *Oleh*: ${movement.requester.username}\n\n` +
                    `Mohon segera tinjau di dashboard untuk persetujuan.`;

                for (const user of recipients) {
                    await sendMessage(user.phone, message);
                }
                console.log(`[Mutation] Notifications sent to ${recipients.length} recipients.`);
            } catch (err) {
                console.error('[Mutation Notification Error]', err.message);
            }
        }, 45000); // 45 seconds average delay

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Approve a mutation (Updates Asset Location)
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
                await tx.asset.update({
                    where: { id: movement.assetId },
                    data: { roomId: movement.toRoomId }
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
