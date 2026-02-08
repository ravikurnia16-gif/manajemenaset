const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

// Helper to generate Request Code
const generateCode = async () => {
    const year = new Date().getFullYear();
    const count = await prisma.procurement.count();
    const sequence = (count + 1).toString().padStart(3, '0');
    return `REQ/${year}/${sequence}`;
};

// Get all procurements
exports.getAllProcurements = async (req, res) => {
    const { status, type } = req.query;
    const user = req.user;

    try {
        const whereClause = {};
        if (status) whereClause.status = status;
        if (type) whereClause.type = type;

        // Filter by Unit for non-admins
        if (user.role === 'ADMIN_UNIT' || user.role === 'USER') {
            whereClause.unitId = user.unitId;
        }

        const procurements = await prisma.procurement.findMany({
            where: whereClause,
            include: {
                user: { select: { username: true } },
                unit: { select: { name: true } },
                _count: { select: { items: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(procurements);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get single procurement
exports.getProcurementById = async (req, res) => {
    const { id } = req.params;
    try {
        const procurement = await prisma.procurement.findUnique({
            where: { id: parseInt(id) },
            include: {
                items: true,
                offers: true,
                unit: true,
                user: { select: { username: true, email: true } }
            }
        });
        if (!procurement) return res.status(404).json({ error: 'Data not found' });
        res.json(procurement);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create Request
exports.createProcurement = async (req, res) => {
    const { type, items, rkbId } = req.body;
    const user = req.user;

    try {
        const code = await generateCode();

        const result = await prisma.$transaction(async (prisma) => {
            // Create Header
            const procurement = await prisma.procurement.create({
                data: {
                    code,
                    userId: user.id,
                    unitId: user.unitId, // Assumes user has unitId
                    type,
                    status: 'SUBMITTED', // Skip DRAFT for simplicity
                    rkbId: rkbId ? parseInt(rkbId) : null
                }
            });

            // Create Items
            if (items && items.length > 0) {
                await prisma.procurementItem.createMany({
                    data: items.map(item => ({
                        procurementId: procurement.id,
                        name: item.name,
                        spec: item.spec,
                        qty: parseInt(item.qty),
                        unit: item.unit,
                        estPrice: parseFloat(item.estPrice || 0)
                    }))
                });
            }

            return procurement;
        });

        res.json({ message: 'Request submitted', data: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update Status (Validate / Approve / Reject)
exports.updateStatus = async (req, res) => {
    const { id } = req.params;
    const { status, validationNote, rejectionReason } = req.body;

    try {
        const updateData = { status };
        if (validationNote) updateData.validationNote = validationNote;
        if (rejectionReason) updateData.rejectionReason = rejectionReason;

        const procurement = await prisma.procurement.update({
            where: { id: parseInt(id) },
            data: updateData
        });
        res.json(procurement);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Add Vendor Offer
exports.addVendorOffer = async (req, res) => {
    const { id } = req.params;
    const { vendorName, price, isWinner } = req.body;
    // Handle file upload if needed (later)

    try {
        if (isWinner) {
            // Unset other winners if this one is winner
            await prisma.vendorOffer.updateMany({
                where: { procurementId: parseInt(id) },
                data: { isWinner: false }
            });
        }

        const offer = await prisma.vendorOffer.create({
            data: {
                procurementId: parseInt(id),
                vendorName,
                price: parseFloat(price),
                isWinner: isWinner || false
            }
        });

        res.json(offer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Process BAST & Auto-Asset Creation
exports.processBAST = async (req, res) => {
    const { id } = req.params;
    const { bastDate } = req.body; // File handled separately or base64

    try {
        const procurement = await prisma.procurement.findUnique({
            where: { id: parseInt(id) },
            include: { items: true, unit: true }
        });

        if (!procurement) return res.status(404).json({ error: 'Request not found' });
        if (procurement.status === 'COMPLETED') return res.status(400).json({ error: 'Already completed' });

        await prisma.$transaction(async (prisma) => {
            // 1. Update Procurement Status
            await prisma.procurement.update({
                where: { id: parseInt(id) },
                data: {
                    status: 'COMPLETED',
                    bastDate: new Date(bastDate),
                }
            });

            // 2. If ASSET type, create Asset records
            if (procurement.type === 'ASSET') {
                const year = new Date().getFullYear();

                // Get general category (or default 'GENERAL')
                const category = await prisma.category.findFirst();
                const categoryId = category ? category.id : 1; // Fallback

                for (const item of procurement.items) {
                    // Generate Asset Code (Simplified logic, real app needs robust sequencer)
                    const count = await prisma.asset.count();
                    const seq = (count + 1).toString().padStart(4, '0');
                    const assetCode = `AST.${procurement.unit.code}.${year}.${seq}`;

                    await prisma.asset.create({
                        data: {
                            code: assetCode + (Math.random() * 1000).toFixed(0), // Temp uniqueness
                            name: item.name,
                            specification: item.spec,
                            quantity: item.qty,
                            price: item.estPrice,
                            purchaseDate: new Date(bastDate),
                            condition: 'BAIK',
                            sourceOfFunds: 'Pengadaan',
                            acquisitionStatus: 'Baru',
                            unitId: procurement.unitId,
                            categoryId: categoryId,
                            usefulLife: 4 // Default
                        }
                    });
                }
            }
        });

        res.json({ message: 'BAST processed and Assets created (if applicable)' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};
