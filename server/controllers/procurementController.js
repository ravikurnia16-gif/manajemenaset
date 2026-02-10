const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');
const whatsappService = require('../services/whatsappService');

// Helper to generate Request Code
const generateCode = async () => {
    const year = new Date().getFullYear();
    const count = await prisma.procurement.count();
    const sequence = (count + 1).toString().padStart(3, '0');
    return `REQ/${year}/${sequence}`;
};

// Get all procurements
exports.getAllProcurements = async (req, res) => {
    const { status, type, unitId } = req.query;
    const user = req.user;

    try {
        const whereClause = {};
        if (status) whereClause.status = status;
        if (type) whereClause.type = type;
        if (unitId) whereClause.unitId = parseInt(unitId);

        // Filter by Unit for non-admins (Restrict to own unit)
        // Admin Unit also restricted to own unit? Usually yes.
        // Only Super Admin might see all. Assuming 'ADMIN_UNIT' sees own.
        // If user is basic USER, also sees own.
        // If user has role SUPER_ADMIN (if exists) or just check logic.
        // For now: If user.unitId exists, force it unless we have a specific 'ALL' role.
        // Let's assume ADMIN_UNIT is bound to unitId.
        if (['ADMIN_UNIT', 'USER'].includes(user.role)) {
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

// Delete single procurement
exports.deleteProcurement = async (req, res) => {
    const { id } = req.params;
    try {
        // Optional: Check status before delete? e.g. Can't delete COMPLETED?
        // For now allow delete but maybe restrict to ADMIN

        // Cascade delete Items, Offers, etc. is handled by Prisma Schema usually 
        // OR we must delete manually if relation is not set to onDelete: Cascade

        // Let's assume explicit delete for safety
        await prisma.procurementItem.deleteMany({ where: { procurementId: parseInt(id) } });
        await prisma.vendorOffer.deleteMany({ where: { procurementId: parseInt(id) } });

        await prisma.procurement.delete({
            where: { id: parseInt(id) }
        });

        res.json({ message: 'Request deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

// Bulk Delete
exports.bulkDeleteProcurements = async (req, res) => {
    const { ids } = req.body; // Expect array of IDs
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'Invalid IDs' });

    try {
        // Delete related items first
        await prisma.procurementItem.deleteMany({ where: { procurementId: { in: ids.map(id => parseInt(id)) } } });
        await prisma.vendorOffer.deleteMany({ where: { procurementId: { in: ids.map(id => parseInt(id)) } } });

        const result = await prisma.procurement.deleteMany({
            where: { id: { in: ids.map(id => parseInt(id)) } }
        });

        res.json({ message: `${result.count} requests deleted successfully` });
    } catch (error) {
        console.error(error);
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

        // --- WhatsApp Notification (Async) ---
        (async () => {
            try {
                // 1. Send Confirmation to Submitter
                const submitter = await prisma.user.findUnique({ where: { id: user.id } });
                if (submitter?.phone) {
                    const msgSubmitter = `*Info Pengadaan*\n\nPermintaan Anda dengan judul *"${title}"* berhasil dibuat.\nKode: ${code}\n\nMohon menunggu verifikasi.`;
                    await whatsappService.sendMessage(submitter.phone, msgSubmitter);
                }

                // 2. Send to Specific Staff (NIY: 25041676, 26021760)
                const targetNips = ['25041676', '26021760'];
                const staffUsers = await prisma.user.findMany({
                    where: { nip: { in: targetNips }, phone: { not: null } }
                });

                if (staffUsers.length > 0) {
                    const msgStaff = `*Notifikasi Pengadaan Baru*\n\n` +
                        `👤 User: *${user.username}* (${user.unit?.name || 'Unit ?'})\n` +
                        `📝 Judul: *${title}*\n` +
                        `🔖 Kode: ${code}\n\n` +
                        `Mohon segera dicek dan diverifikasi.`;

                    // Send with DELAY (30 seconds interval to prevent spam/blocking)
                    for (let i = 0; i < staffUsers.length; i++) {
                        const staff = staffUsers[i];
                        const delay = (i + 1) * 30000; // 30s, 60s, etc.

                        setTimeout(async () => {
                            try {
                                console.log(`Sending WA to Staff ${staff.username} (${staff.phone}) in ${delay / 1000}s...`);
                                await whatsappService.sendMessage(staff.phone, msgStaff);
                            } catch (e) {
                                console.error(`Failed sending to staff ${staff.username}:`, e);
                            }
                        }, delay);
                    }
                }

            } catch (err) {
                console.error("WA Notification Error:", err);
            }
        })();
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
        const { fundingSource, brand, usefulLife, vendorId, finalPrice, newVendorName, comparisonVendors, needComparison } = req.body;

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

            const updateData = {
                fundingSource,
                brand,
                usefulLife: usefulLife ? parseInt(usefulLife) : undefined,
                vendorId: finalVendorId ? parseInt(finalVendorId) : undefined,
                finalPrice: finalPrice ? parseFloat(finalPrice) : undefined,
            };

            // Explicitly handle comparisonVendors
            if (comparisonVendors !== undefined) {
                updateData.comparisonVendors = JSON.stringify(comparisonVendors);
            }

            // Explicitly handle needComparison
            if (needComparison !== undefined) {
                updateData.needComparison = needComparison;
            }

            const item = await prisma.procurementItem.update({
                where: { id: parseInt(itemId) },
                data: updateData
            });
            res.json(item);
        } catch (error) {
            console.error("Update Item Error:", error);
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
                    const year = new Date(bastDate).getFullYear();
                    const settings = await prisma.setting.findUnique({ where: { id: 1 } });
                    const prefix = settings?.assetCodePrefix || 'AST';

                    // Fetch a default category if none specified (TODO: Add Category to ProcurementItem)
                    const defaultCategory = await prisma.category.findFirst();
                    if (!defaultCategory) throw new Error('No Category found in Master Data. Please create one.');
                    const categoryCode = defaultCategory.code;

                    for (const item of procurement.items) {
                        const qty = item.qty;
                        const unitCode = procurement.unit.code;

                        // Generate Base Pattern: PREFIX.UNIT.CAT.YEAR.
                        const patternPrefix = `${prefix}.${unitCode}.${categoryCode}.${year}.`;

                        for (let i = 0; i < qty; i++) {
                            // Find current max sequence in DB
                            // OPTIMIZATION: We should ideally lock or use a separate counter, 
                            // but for now we fetch fresh lastAsset for each iteration to minimize collision risk in this transaction loops.
                            const lastAsset = await prisma.asset.findFirst({
                                where: { code: { startsWith: patternPrefix } },
                                orderBy: { code: 'desc' }
                            });

                            let currentSeq = 1;
                            if (lastAsset) {
                                const parts = lastAsset.code.split('.');
                                const lastSeqPart = parts[parts.length - 1];
                                currentSeq = (parseInt(lastSeqPart) || 0) + 1;
                            }

                            // Safety measure: Check if this seq already exists in current loop context if transaction isolation is weak
                            // But since we query inside the transaction, it should see changes if isolation level supports it.
                            // However, Prisma atomic transactions don't expose intermediate states to findFirst easily if simpler DBs.
                            // We'll trust the sequential execution here.

                            const seq = currentSeq.toString().padStart(4, '0');
                            const assetCode = `${patternPrefix}${seq}`;

                            const fundingSource = item.fundingSource || 'Yayasan'; // Default if null

                            await prisma.asset.create({
                                data: {
                                    code: assetCode,
                                    name: item.name,
                                    specification: item.spec,
                                    brand: item.brand,
                                    price: item.finalPrice || item.estPrice,
                                    purchaseDate: new Date(bastDate),
                                    condition: 'BAIK',
                                    sourceOfFunds: fundingSource,
                                    acquisitionStatus: 'Pembelian',
                                    unitId: procurement.unitId,
                                    categoryId: defaultCategory.id,
                                    usefulLife: item.usefulLife || 4,
                                    vendorId: item.vendorId, // Nullable
                                    quantity: 1
                                }
                            });
                        }
                    }
                }
            });

            res.json({ message: 'BAST processed and Assets created.' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    };
