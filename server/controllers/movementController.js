const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendMessage } = require('../services/whatsappService');

/**
 * Request a new asset mutation (Status: PENDING)
 */
exports.requestMutation = async (req, res) => {
    try {
        const { assetId, assetIds, toRoomId, reason, type, toUnitId } = req.body; // assetIds is an array
        const requesterId = req.user.id;

        const idsToProcess = assetIds && Array.isArray(assetIds) ? assetIds : [assetId];
        const processedMovements = [];

        // 1. Fetch auxiliary data
        const targetRoom = await prisma.room.findUnique({ where: { id: parseInt(toRoomId) } });
        if (!targetRoom) return res.status(400).json({ error: 'Ruangan tujuan tidak valid' });

        const finalToUnitId = type === 'EXTERNAL' ? parseInt(toUnitId) : null;
        const targetUnit = finalToUnitId ? await prisma.unit.findUnique({ where: { id: finalToUnitId } }) : null;

        if (type === 'EXTERNAL' && !finalToUnitId) {
            return res.status(400).json({ error: 'Unit Tujuan wajib diisi untuk Mutasi Antar Unit' });
        }

        // 2. Process each Asset
        for (const id of idsToProcess) {
            const asset = await prisma.asset.findUnique({
                where: { id: parseInt(id) },
                include: { room: true, unit: true }
            });

            if (!asset) continue;

            const unitIdForThisAsset = finalToUnitId || asset.unitId;
            const actualTargetUnit = targetUnit || await prisma.unit.findUnique({ where: { id: unitIdForThisAsset } });

            const toLocationText = `${targetRoom.name} ${actualTargetUnit ? '(' + actualTargetUnit.name + ')' : ''}`;

            const movement = await prisma.movement.create({
                data: {
                    assetId: parseInt(id),
                    fromLocation: asset.room ? `${asset.room.name} (${asset.unit?.name || 'Unknown'})` : 'Unknown',
                    toLocation: toLocationText,
                    toRoomId: parseInt(toRoomId),
                    toUnitId: unitIdForThisAsset,
                    reason,
                    status: 'PENDING',
                    type: type || 'INTERNAL',
                    requesterId
                },
                include: { asset: true, requester: true }
            });
            processedMovements.push(movement);
        }

        if (processedMovements.length === 0) {
            return res.status(400).json({ error: 'Tidak ada aset valid yang diproses' });
        }

        res.status(201).json({ message: `${processedMovements.length} permintaan mutasi berhasil dikirim`, data: processedMovements });

        // --- Delayed Notification (30-60s) ---
        setTimeout(async () => {
            try {
                const recipients = await prisma.user.findMany({
                    where: {
                        OR: [{ nip: '24071613' }, { nip: '26021760' }],
                        phone: { not: null, not: '' }
                    }
                });

                if (recipients.length === 0) return;

                const assetNames = processedMovements.map(m => m.asset.name).join(', ');
                const displayNames = processedMovements.length > 3
                    ? `${processedMovements[0].asset.name} dan ${processedMovements.length - 1} aset lainnya`
                    : assetNames;

                const message = `🔄 *PENGAJUAN MUTASI MASAL (${type || 'INTERNAL'})*\n\n` +
                    `Terdapat ${processedMovements.length} permintaan mutasi baru:\n` +
                    `📦 *Aset*: ${displayNames}\n` +
                    `🎯 *Tujuan*: ${processedMovements[0].toLocation}\n` +
                    `📝 *Alasan*: ${reason || '-'}\n` +
                    `👤 *Oleh*: ${processedMovements[0].requester.username}\n\n` +
                    `Mohon segera tinjau di dashboard untuk persetujuan.`;

                let cumulativeDelay = 0;
                for (const user of recipients) {
                    const randomGap = Math.floor(Math.random() * (15000 - 5000 + 1)) + 5000;
                    cumulativeDelay += randomGap;
                    setTimeout(async () => {
                        try {
                            await sendMessage(user.phone, message);
                        } catch (err) {
                            console.error(`[Mutation] Notification failed for ${user.username}`);
                        }
                    }, cumulativeDelay);
                }
            } catch (err) {
                console.error('[Mutation Notification Error]', err.message);
            }
        }, 45000);

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

            // Update Asset's Room ID and Code
            if (movement.toRoomId) {
                const asset = await tx.asset.findUnique({
                    where: { id: movement.assetId },
                    include: { category: true }
                });

                if (!asset) throw new Error('Aset tidak ditemukan');

                const updateData = {
                    roomId: movement.toRoomId,
                    unitId: movement.toUnitId || asset.unitId
                };

                // Logic: NEW CODE if Unit changes
                if (movement.toUnitId && movement.toUnitId !== asset.unitId) {
                    const targetUnit = await tx.unit.findUnique({ where: { id: movement.toUnitId } });
                    const category = asset.category;
                    const settings = await tx.setting.findUnique({ where: { id: 1 } });

                    if (targetUnit && category) {
                        const prefix = settings?.assetCodePrefix || 'AST';
                        const purchaseDate = asset.purchaseDate || asset.createdAt;
                        const year = purchaseDate ? new Date(purchaseDate).getFullYear() : 'YYYY';
                        const patternPrefix = `${prefix}.${targetUnit.code}.${category.code}.${year}.`;

                        // Find current max sequence in the TARGET unit for this category/year
                        const lastAsset = await tx.asset.findFirst({
                            where: { code: { startsWith: patternPrefix } },
                            orderBy: { code: 'desc' }
                        });

                        let currentSeq = 1;
                        if (lastAsset) {
                            const parts = lastAsset.code.split('.');
                            const lastSeqPart = parts[parts.length - 1];
                            currentSeq = (parseInt(lastSeqPart) || 0) + 1;
                        }

                        updateData.code = `${patternPrefix}${currentSeq.toString().padStart(4, '0')}`;
                    }
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

exports.deleteMultipleMovements = async (req, res) => {
    try {
        const { ids } = req.body; // Array of IDs
        if (!ids || !Array.isArray(ids)) {
            return res.status(400).json({ error: 'IDs must be an array' });
        }

        await prisma.movement.deleteMany({
            where: { id: { in: ids.map(id => parseInt(id)) } }
        });

        res.json({ message: `${ids.length} mutations deleted` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
