const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==========================================
// PROYEK LOGISTIK / GUDANG
// ==========================================

exports.getProjects = async (req, res) => {
    try {
        const projects = await prisma.invProject.findMany({
            include: {
                _count: {
                    select: { orders: true, vendorSelections: true, mous: true, evaluations: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(projects);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
};

exports.createProject = async (req, res) => {
    try {
        const { name, year, type, budget, status } = req.body;
        const project = await prisma.invProject.create({
            data: {
                name,
                year: parseInt(year),
                type: type || 'REGULAR',
                budget: parseFloat(budget) || 0,
                status: status || 'AKTIF'
            }
        });
        res.status(201).json(project);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create project' });
    }
};

exports.updateProject = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, year, type, budget, status } = req.body;
        const project = await prisma.invProject.update({
            where: { id: parseInt(id) },
            data: {
                name,
                year: parseInt(year),
                type,
                budget: parseFloat(budget),
                status
            }
        });
        res.json(project);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update project' });
    }
};

exports.deleteProject = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.invProject.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Project deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete project' });
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
