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
    const { title, type, items, rkbId } = req.body;
    const user = req.user;

    try {
        const code = await generateCode();

        const result = await prisma.$transaction(async (prisma) => {
            // Create Header
            const procurement = await prisma.procurement.create({
                data: {
                    code,
                    title: title || `Permintaan Pengadaan ${type} - ${new Date().toLocaleDateString('id-ID')}`,
                    userId: user.id,
                    unitId: user.unitId,
                    type,
                    status: 'SUBMITTED',
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
                        estPrice: parseFloat(item.estPrice || 0),
                        fundingSource: item.fundingSource || 'Mandiri' // Capture Funding Source
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

// Import Request from Excel
exports.importProcurement = async (req, res) => {
    const { title, type, items } = req.body;
    const user = req.user;

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Data items kosong.' });
    }

    try {
        const code = await generateCode();

        const result = await prisma.$transaction(async (prisma) => {
            // 1. Create Header
            const procurement = await prisma.procurement.create({
                data: {
                    code,
                    title: title || `Import Request ${type} - ${new Date().toLocaleDateString('id-ID')}`,
                    userId: user.id,
                    unitId: user.unitId,
                    type,
                    status: 'SUBMITTED'
                }
            });

            // 2. Create Items
            // Validation Logic (Simpler than RKB, assuming frontend validated)
            await prisma.procurementItem.createMany({
                data: items.map(item => ({
                    procurementId: procurement.id,
                    name: item.name,
                    spec: item.spec ? String(item.spec) : '-',
                    qty: parseInt(item.qty),
                    unit: item.unit ? String(item.unit) : 'Unit',
                    estPrice: parseFloat(item.estPrice || 0),
                    fundingSource: item.fundingSource || 'Mandiri'
                }))
            });

            return procurement;
        });

        res.json({ message: 'Import berhasil!', data: result });
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

// Update Item Detail (Vendor, Brand, Specs) - New Function
// Update Item Detail (Vendor, Brand, Specs)
exports.updateItemDetail = async (req, res) => {
    const { itemId } = req.params;
    const { fundingSource, brand, usefulLife, vendorId, finalPrice, newVendorName } = req.body;

    try {
        let finalVendorId = vendorId;

        // Create new vendor if requested
        if (newVendorName) {
            const existingVendor = await prisma.vendor.findFirst({
                where: { name: newVendorName }
            });

            if (existingVendor) {
                finalVendorId = existingVendor.id;
            } else {
                const newVendor = await prisma.vendor.create({
                    data: { name: newVendorName }
                });
                finalVendorId = newVendor.id;
            }
        }

        const item = await prisma.procurementItem.update({
            where: { id: parseInt(itemId) },
            data: {
                fundingSource,
                brand,
                usefulLife: usefulLife ? parseInt(usefulLife) : undefined,
                vendorId: finalVendorId ? parseInt(finalVendorId) : undefined,
                finalPrice: finalPrice ? parseFloat(finalPrice) : undefined
            }
        });
        res.json(item);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Add Vendor Offer (Legacy / For Comparison only)
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
    const { bastDate } = req.body;

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

                // Fetch default category (SHOULD BE IMPROVED TO MATCH ITEM TYPE/CATEGORY)
                // For now, we use a generic default or based on item name logic if needed.
                const category = await prisma.category.findFirst();
                const categoryId = category ? category.id : 1;

                for (const item of procurement.items) {
                    // Logic to handle Quantity loop (create N assets)
                    const qty = item.qty;

                    for (let i = 0; i < qty; i++) {
                        // Generate Asset Code Sequence
                        const count = await prisma.asset.count();
                        // Note: In high concurrency, this simple count is risky. 
                        // But for this level of app, it's acceptable or use a dedicated sequence table.
                        const seq = (count + 1 + i).toString().padStart(4, '0');
                        const assetCode = `AST.${procurement.unit.code}.${year}.${seq}`;

                        await prisma.asset.create({
                            data: {
                                code: assetCode + (Math.random() * 100).toFixed(0), // Temp uniqueness
                                name: item.name,
                                specification: item.spec, // Use detailed spec
                                brand: item.brand, // Use Item Brand
                                price: item.finalPrice || item.estPrice, // Use Final or Est Price
                                purchaseDate: new Date(bastDate),
                                condition: 'BAIK',
                                sourceOfFunds: item.fundingSource || 'Mandiri', // Use Item Funding
                                acquisitionStatus: 'Pembelian',
                                unitId: procurement.unitId,
                                categoryId: categoryId,
                                usefulLife: item.usefulLife || 4, // Use Item Useful Life
                                vendorId: item.vendorId, // Use Item Vendor
                                quantity: 1 // Individual tracking
                            }
                        });
                    }
                }
            }
        });

        res.json({ message: 'BAST processed and Assets created (if applicable)' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};
