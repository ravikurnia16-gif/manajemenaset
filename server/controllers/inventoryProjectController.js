const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==========================================
// PROYEK LOGISTIK / GUDANG
// ==========================================

exports.getProjects = async (req, res) => {
    try {
        const projects = await prisma.invProject.findMany({
            include: {
                vendorSelections: {
                    include: { vendor: true }
                },
                mous: {
                    include: { vendor: true }
                },
                evaluations: {
                    include: { vendor: true }
                },
                projectItems: {
                    include: { item: { include: { category: true } } }
                }
            },
            orderBy: [{ year: 'desc' }, { createdAt: 'desc' }]
        });

        // Format and map fields for frontend compatibility
        const mapped = projects.map(p => ({
            ...p,
            title: p.title || p.name,
            name: p.name || p.title,
            selections: p.vendorSelections || []
        }));

        res.json(mapped);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
};

exports.createProject = async (req, res) => {
    try {
        const { name, title, year, type, projectType, budget, status, note, items, directVendorId, targetQuantity } = req.body;
        const projTitle = (title || name || 'Proyek Pengadaan Barang').toString().trim();
        const parsedYear = parseInt(year, 10) || new Date().getFullYear();
        const selectedType = projectType || type || 'SELEKSI';

        // Process project items
        const itemMap = new Map();
        if (Array.isArray(items)) {
            items.forEach(i => {
                const itId = parseInt(i.itemId || i.id, 10);
                const qty = parseInt(i.quantity, 10);
                if (itId && qty > 0) {
                    itemMap.set(itId, (itemMap.get(itId) || 0) + qty);
                }
            });
        }

        const projectItemsData = Array.from(itemMap.entries()).map(([itemId, quantity]) => ({
            itemId,
            quantity
        }));

        const totalQty = projectItemsData.reduce((acc, curr) => acc + curr.quantity, 0) || parseInt(targetQuantity || 0, 10);

        const project = await prisma.$transaction(async (tx) => {
            const newProj = await tx.invProject.create({
                data: {
                    title: projTitle,
                    name: projTitle,
                    year: parsedYear,
                    type: selectedType,
                    budget: parseFloat(budget) || 0,
                    targetQuantity: totalQty,
                    status: status || 'PERENCANAAN',
                    note: note || '',
                    projectItems: {
                        create: projectItemsData
                    }
                },
                include: {
                    projectItems: {
                        include: { item: true }
                    }
                }
            });

            if (selectedType === 'PENUNJUKAN_LANGSUNG' && directVendorId) {
                await tx.invVendorSelection.create({
                    data: {
                        projectId: newProj.id,
                        vendorId: parseInt(directVendorId, 10),
                        status: 'DIPILIH',
                        reason: 'Penunjukan Langsung'
                    }
                });
            }

            return newProj;
        });

        res.status(201).json(project);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Failed to create project' });
    }
};

exports.updateProject = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, title, year, type, projectType, budget, status, note, items, directVendorId, targetQuantity } = req.body;
        const projectId = parseInt(id, 10);
        const projTitle = (title || name || '').toString().trim();
        const parsedYear = year ? parseInt(year, 10) : undefined;
        const selectedType = projectType || type;

        const updated = await prisma.$transaction(async (tx) => {
            // Update items if provided
            if (Array.isArray(items)) {
                await tx.invProjectItem.deleteMany({ where: { projectId } });

                const itemMap = new Map();
                items.forEach(i => {
                    const itId = parseInt(i.itemId || i.id, 10);
                    const qty = parseInt(i.quantity, 10);
                    if (itId && qty > 0) {
                        itemMap.set(itId, (itemMap.get(itId) || 0) + qty);
                    }
                });

                const projectItemsData = Array.from(itemMap.entries()).map(([itemId, quantity]) => ({
                    projectId,
                    itemId,
                    quantity
                }));

                if (projectItemsData.length > 0) {
                    await tx.invProjectItem.createMany({
                        data: projectItemsData
                    });
                }
            }

            const dataToUpdate = {};
            if (projTitle) {
                dataToUpdate.title = projTitle;
                dataToUpdate.name = projTitle;
            }
            if (parsedYear) dataToUpdate.year = parsedYear;
            if (selectedType) dataToUpdate.type = selectedType;
            if (budget !== undefined) dataToUpdate.budget = parseFloat(budget);
            if (targetQuantity !== undefined) dataToUpdate.targetQuantity = parseInt(targetQuantity, 10);
            if (status) dataToUpdate.status = status;
            if (note !== undefined) dataToUpdate.note = note;

            const proj = await tx.invProject.update({
                where: { id: projectId },
                data: dataToUpdate,
                include: {
                    projectItems: {
                        include: { item: true }
                    }
                }
            });

            if (selectedType === 'PENUNJUKAN_LANGSUNG' && directVendorId) {
                await tx.invVendorSelection.upsert({
                    where: {
                        projectId_vendorId: {
                            projectId,
                            vendorId: parseInt(directVendorId, 10)
                        }
                    },
                    create: {
                        projectId,
                        vendorId: parseInt(directVendorId, 10),
                        status: 'DIPILIH',
                        reason: 'Penunjukan Langsung'
                    },
                    update: {
                        status: 'DIPILIH',
                        reason: 'Penunjukan Langsung'
                    }
                });
            }

            return proj;
        });

        res.json(updated);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Failed to update project' });
    }
};

exports.deleteProject = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.invProject.delete({ where: { id: parseInt(id, 10) } });
        res.json({ message: 'Project deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
};

exports.receiveProjectGoods = async (req, res) => {
    try {
        const projectId = parseInt(req.params.id, 10);
        const { warehouseId, items, isFinal } = req.body;

        if (!warehouseId) {
            return res.status(400).json({ error: 'Gudang penyimpanan wajib dipilih' });
        }

        const result = await prisma.$transaction(async (tx) => {
            const project = await tx.invProject.findUnique({
                where: { id: projectId },
                include: { projectItems: true }
            });

            if (!project) throw new Error('Proyek tidak ditemukan');

            const year = new Date().getFullYear();
            const prefix = `TRX/INV/${year}/`;
            const existingTxs = await tx.invStockTransaction.findMany({
                where: { code: { startsWith: prefix } },
                select: { code: true }
            });
            let maxSeq = 0;
            for (const t of existingTxs) {
                const parts = t.code.split('/');
                if (parts.length === 4) {
                    const seq = parseInt(parts[3], 10);
                    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
                }
            }

            if (Array.isArray(items)) {
                for (const it of items) {
                    const itemId = parseInt(it.itemId, 10);
                    const quantity = parseInt(it.quantity, 10);

                    if (itemId && quantity > 0) {
                        // 1. Update receivedQuantity di InvProjectItem
                        const pi = await tx.invProjectItem.findUnique({
                            where: {
                                projectId_itemId: { projectId, itemId }
                            }
                        });

                        if (pi) {
                            await tx.invProjectItem.update({
                                where: { id: pi.id },
                                data: { receivedQuantity: { increment: quantity } }
                            });
                        }

                        // 2. Increment stock di Gudang Logistik
                        await tx.invStock.upsert({
                            where: {
                                itemId_warehouseId: {
                                    itemId,
                                    warehouseId: parseInt(warehouseId, 10)
                                }
                            },
                            create: {
                                itemId,
                                warehouseId: parseInt(warehouseId, 10),
                                quantity
                            },
                            update: {
                                quantity: { increment: quantity }
                            }
                        });

                        // 3. Catat Riwayat Transaksi Stok Masuk (IN)
                        maxSeq++;
                        const txCode = `${prefix}${maxSeq.toString().padStart(4, '0')}`;
                        await tx.invStockTransaction.create({
                            data: {
                                code: txCode,
                                type: 'IN',
                                date: new Date(),
                                itemId,
                                warehouseId: parseInt(warehouseId, 10),
                                quantity,
                                note: `Penerimaan Barang Proyek: ${project.title || project.name}`,
                                createdById: req.user?.id || 1
                            }
                        });
                    }
                }
            }

            // 4. Update status project jika semua barang selesai diterima atau ditutup final
            const updatedItems = await tx.invProjectItem.findMany({ where: { projectId } });
            const allReceived = updatedItems.length > 0 && updatedItems.every(i => i.receivedQuantity >= i.quantity);

            if (isFinal || allReceived) {
                await tx.invProject.update({
                    where: { id: projectId },
                    data: { status: 'SELESAI' }
                });
            } else if (project.status === 'PERENCANAAN' || project.status === 'SELEKSI') {
                await tx.invProject.update({
                    where: { id: projectId },
                    data: { status: 'BERJALAN' }
                });
            }

            return { message: 'Barang proyek logistik berhasil diterima dan stok gudang telah diupdate' };
        });

        res.json(result);
    } catch (error) {
        console.error('Receive Project Goods Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ==========================================
// VENDOR SELECTIONS, MOUs, EVALUATIONS
// ==========================================

// --- SELEKSI VENDOR ---
exports.getVendorSelections = async (req, res) => {
    try {
        const { projectId, vendorId } = req.query;
        let whereClause = {};
        if (projectId) whereClause.projectId = parseInt(projectId);
        if (vendorId) whereClause.vendorId = parseInt(vendorId);

        const selections = await prisma.invVendorSelection.findMany({
            where: whereClause,
            include: { project: true, vendor: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(selections);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch vendor selections' });
    }
};

exports.createVendorSelection = async (req, res) => {
    try {
        const { projectId, vendorId, proposedPrice, status, reason, proposalFileUrl } = req.body;
        const selection = await prisma.invVendorSelection.create({
            data: {
                projectId: parseInt(projectId),
                vendorId: parseInt(vendorId),
                proposedPrice: parseFloat(proposedPrice) || 0,
                status: status || 'MENUNGGU',
                reason,
                proposalFileUrl
            }
        });
        res.status(201).json(selection);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create vendor selection' });
    }
};

exports.updateVendorSelection = async (req, res) => {
    try {
        const { id } = req.params;
        const { proposedPrice, status, reason, proposalFileUrl } = req.body;
        const selection = await prisma.invVendorSelection.update({
            where: { id: parseInt(id) },
            data: {
                proposedPrice: proposedPrice ? parseFloat(proposedPrice) : undefined,
                status,
                reason,
                proposalFileUrl
            }
        });
        res.json(selection);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update vendor selection' });
    }
};

exports.deleteVendorSelection = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.invVendorSelection.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete' });
    }
};

// --- MoU VENDOR ---
exports.getVendorMoUs = async (req, res) => {
    try {
        const { projectId, vendorId } = req.query;
        let whereClause = {};
        if (projectId) whereClause.projectId = parseInt(projectId);
        if (vendorId) whereClause.vendorId = parseInt(vendorId);

        const mous = await prisma.invVendorMoU.findMany({
            where: whereClause,
            include: { project: true, vendor: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(mous);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch MoUs' });
    }
};

exports.createVendorMoU = async (req, res) => {
    try {
        const { projectId, vendorId, mouNumber, startDate, endDate, status, fileUrl } = req.body;
        const mou = await prisma.invVendorMoU.create({
            data: {
                projectId: parseInt(projectId),
                vendorId: parseInt(vendorId),
                mouNumber,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                status: status || 'DRAFT',
                fileUrl
            }
        });
        res.status(201).json(mou);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create MoU' });
    }
};

exports.updateVendorMoU = async (req, res) => {
    try {
        const { id } = req.params;
        const { mouNumber, startDate, endDate, status, fileUrl } = req.body;
        const data = {};
        if (mouNumber) data.mouNumber = mouNumber;
        if (startDate) data.startDate = new Date(startDate);
        if (endDate) data.endDate = new Date(endDate);
        if (status) data.status = status;
        if (fileUrl !== undefined) data.fileUrl = fileUrl;

        const mou = await prisma.invVendorMoU.update({
            where: { id: parseInt(id) },
            data
        });
        res.json(mou);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update MoU' });
    }
};

exports.deleteVendorMoU = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.invVendorMoU.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete MoU' });
    }
};

// --- EVALUASI VENDOR ---
exports.getVendorEvaluations = async (req, res) => {
    try {
        const { projectId, vendorId } = req.query;
        let whereClause = {};
        if (projectId) whereClause.projectId = parseInt(projectId);
        if (vendorId) whereClause.vendorId = parseInt(vendorId);

        const evals = await prisma.invVendorEvaluation.findMany({
            where: whereClause,
            include: { project: true, vendor: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(evals);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch evaluations' });
    }
};

exports.createVendorEvaluation = async (req, res) => {
    try {
        const { projectId, vendorId, rating, onTimeRate, rejectRate, notes } = req.body;
        const evalRecord = await prisma.invVendorEvaluation.create({
            data: {
                projectId: parseInt(projectId),
                vendorId: parseInt(vendorId),
                rating: parseFloat(rating) || 0,
                onTimeRate: parseFloat(onTimeRate) || 0,
                rejectRate: parseFloat(rejectRate) || 0,
                notes
            }
        });
        
        // Auto-update average rating vendor
        await updateVendorAverages(vendorId);

        res.status(201).json(evalRecord);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create evaluation' });
    }
};

exports.updateVendorEvaluation = async (req, res) => {
    try {
        const { id } = req.params;
        const { rating, onTimeRate, rejectRate, notes } = req.body;
        
        const evalRecord = await prisma.invVendorEvaluation.update({
            where: { id: parseInt(id) },
            data: {
                rating: parseFloat(rating),
                onTimeRate: parseFloat(onTimeRate),
                rejectRate: parseFloat(rejectRate),
                notes
            }
        });

        await updateVendorAverages(evalRecord.vendorId);

        res.json(evalRecord);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update evaluation' });
    }
};

exports.deleteVendorEvaluation = async (req, res) => {
    try {
        const { id } = req.params;
        const evalRecord = await prisma.invVendorEvaluation.findUnique({ where: { id: parseInt(id) } });
        await prisma.invVendorEvaluation.delete({ where: { id: parseInt(id) } });
        
        if (evalRecord) {
            await updateVendorAverages(evalRecord.vendorId);
        }

        res.json({ message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete evaluation' });
    }
};

async function updateVendorAverages(vendorId) {
    const evals = await prisma.invVendorEvaluation.findMany({ where: { vendorId: parseInt(vendorId) } });
    if (evals.length === 0) {
        await prisma.invVendor.update({
            where: { id: parseInt(vendorId) },
            data: { rating: 0, onTimeRate: 0, rejectRate: 0, totalOrders: 0 }
        });
        return;
    }

    const avgRating = evals.reduce((sum, e) => sum + e.rating, 0) / evals.length;
    const avgOnTime = evals.reduce((sum, e) => sum + e.onTimeRate, 0) / evals.length;
    const avgReject = evals.reduce((sum, e) => sum + e.rejectRate, 0) / evals.length;

    await prisma.invVendor.update({
        where: { id: parseInt(vendorId) },
        data: {
            rating: avgRating,
            onTimeRate: avgOnTime,
            rejectRate: avgReject,
            totalOrders: evals.length // Assumption: each project eval = 1 order
        }
    });
}
