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
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'Invalid IDs' });

    try {
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
                        fundingSource: item.fundingSource || 'Mandiri'
                    }))
                });
            }

            return procurement;
        });

        res.json({ message: 'Request submitted', data: result });

        // --- WhatsApp Notification (Async) ---
        (async () => {
            try {
                // 1. Fetch Submitter Details (Name, NIP, Unit)
                const submitter = await prisma.user.findUnique({
                    where: { id: user.id },
                    include: { unit: true }
                });

                if (!submitter) return;

                // Format Item List
                const itemList = (items || []).map((item, index) =>
                    `${index + 1}. ${item.name} (${item.qty} ${item.unit})`
                ).join('\n');

                // 2. Send Confirmation to Submitter
                if (submitter.phone) {
                    const msgSubmitter = `*Info Request Pengadaan*\n\n` +
                        `Ustadz/Ustadzah *${submitter.name || submitter.username}*, permintaan anda telah kami terima dengan rincian:\n\n` +
                        `${itemList}\n\n` +
                        `Pesanan Ustadz/Ustadzah akan segera kami proses.`;

                    await whatsappService.sendMessage(submitter.phone, msgSubmitter);
                }

                // 3. Send to Syafrian (NIY: 25041676) with 30s Delay
                const syafrian = await prisma.user.findFirst({
                    where: { nip: '25041676', phone: { not: null } }
                });

                if (syafrian && syafrian.phone) {
                    const msgSyafrian = `*Info Request Pengadaan*\n\n` +
                        `Pesanan telah masuk dari:\n` +
                        `\u{1F464} *Nama Lengkap* : ${submitter.name || submitter.username}\n` +
                        `\u{1F194} *NIY* : ${submitter.nip || '-'}\n` +
                        `\u{1F3E2} *Unit* : ${submitter.unit?.name || '-'}\n\n` +
                        `*Rincian Permintaan:*\n` +
                        `${itemList}\n\n` +
                        `Mohon segera di proses.`;

                    setTimeout(async () => {
                        try {
                            console.log(`Sending WA to Syafrian (${syafrian.phone}) in 30s...`);
                            await whatsappService.sendMessage(syafrian.phone, msgSyafrian);
                        } catch (e) {
                            console.error("Failed sending to Syafrian:", e);
                        }
                    }, 30000);
                }

            } catch (err) {
                console.error("WA Notification Error:", err);
            }
        })();

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

    try {
        if (isWinner) {
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

                const defaultCategory = await prisma.category.findFirst();
                if (!defaultCategory) throw new Error('No Category found in Master Data. Please create one.');
                const categoryCode = defaultCategory.code;

                for (const item of procurement.items) {
                    const qty = item.qty;
                    const unitCode = procurement.unit.code;

                    const patternPrefix = `${prefix}.${unitCode}.${categoryCode}.${year}.`;

                    for (let i = 0; i < qty; i++) {
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

                        const seq = currentSeq.toString().padStart(4, '0');
                        const assetCode = `${patternPrefix}${seq}`;

                        const fundingSource = item.fundingSource || 'Yayasan';

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
                                vendorId: item.vendorId,
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
