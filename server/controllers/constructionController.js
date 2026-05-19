const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper: Generate project code PRJ/2026/001
const generateProjectCode = async () => {
    const year = new Date().getFullYear();
    const prefix = 'PRJ';
    const lastRecord = await prisma.constructionProject.findFirst({
        where: { code: { startsWith: `${prefix}/${year}/` } },
        orderBy: { code: 'desc' }
    });

    let nextSeq = 1;
    if (lastRecord) {
        const parts = lastRecord.code.split('/');
        if (parts.length === 3) {
            const lastSeq = parseInt(parts[2]);
            if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
        }
    }
    return `${prefix}/${year}/${nextSeq.toString().padStart(3, '0')}`;
};

// GET /api/construction/stats
exports.getStats = async (req, res) => {
    try {
        const [total, planning, inProgress, completed, onHold, cancelled] = await Promise.all([
            prisma.constructionProject.count(),
            prisma.constructionProject.count({ where: { status: 'PLANNING' } }),
            prisma.constructionProject.count({ where: { status: 'IN_PROGRESS' } }),
            prisma.constructionProject.count({ where: { status: 'COMPLETED' } }),
            prisma.constructionProject.count({ where: { status: 'ON_HOLD' } }),
            prisma.constructionProject.count({ where: { status: 'CANCELLED' } }),
        ]);

        const allProjects = await prisma.constructionProject.findMany({
            select: { budgetAmount: true, actualCost: true }
        });
        const totalBudget = allProjects.reduce((sum, p) => sum + (p.budgetAmount || 0), 0);
        const totalActualCost = allProjects.reduce((sum, p) => sum + (p.actualCost || 0), 0);

        res.json({
            total, planning, inProgress, completed, onHold, cancelled,
            totalBudget, totalActualCost
        });
    } catch (error) {
        console.error('getStats error:', error);
        res.status(500).json({ error: error.message });
    }
};

// GET /api/construction/projects
exports.getAllProjects = async (req, res) => {
    try {
        const { search, status, priority, page = 1, limit = 20 } = req.query;
        const where = {};

        if (status) where.status = status;
        if (priority) where.priority = priority;
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { code: { contains: search } },
                { location: { contains: search } },
                { picName: { contains: search } },
            ];
        }

        const isAll = limit === 'all' || limit === '-1';
        const take = isAll ? undefined : parseInt(limit);
        const skip = isAll ? undefined : (parseInt(page) - 1) * take;

        const [projects, total] = await Promise.all([
            prisma.constructionProject.findMany({
                where,
                include: { contractor: { select: { id: true, name: true, phone: true, specialty: true } } },
                orderBy: { createdAt: 'desc' },
                take,
                skip
            }),
            prisma.constructionProject.count({ where })
        ]);

        res.json({
            data: projects,
            meta: {
                total,
                page: isAll ? 1 : parseInt(page),
                limit: isAll ? total : take,
                totalPages: isAll ? 1 : Math.ceil(total / take)
            }
        });
    } catch (error) {
        console.error('getAllProjects error:', error);
        res.status(500).json({ error: error.message });
    }
};

// GET /api/construction/projects/:id
exports.getProjectById = async (req, res) => {
    try {
        const project = await prisma.constructionProject.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { contractor: true }
        });
        if (!project) return res.status(404).json({ error: 'Proyek tidak ditemukan' });
        res.json(project);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// POST /api/construction/projects
exports.createProject = async (req, res) => {
    try {
        const { name, description, location, status, priority, startDate, endDate, budgetAmount, fundingSource, picName, contractorId } = req.body;
        const code = await generateProjectCode();

        // Handle media from upload middleware
        const media = req.uploadedMedia || [];
        const firstImage = media.find(m => m.type === 'IMAGE')?.url || null;

        const project = await prisma.constructionProject.create({
            data: {
                code,
                name,
                description: description || null,
                location: location || null,
                status: status || 'PLANNING',
                priority: priority || 'MEDIUM',
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                budgetAmount: budgetAmount ? parseFloat(budgetAmount) : 0,
                fundingSource: fundingSource || null,
                picName: picName || null,
                contractorId: contractorId ? parseInt(contractorId) : null,
                photo: firstImage,
                media: media.length > 0 ? media : undefined,
            },
            include: { contractor: true }
        });

        // Update contractor totalProjects count
        if (contractorId) {
            const count = await prisma.constructionProject.count({ where: { contractorId: parseInt(contractorId) } });
            await prisma.contractor.update({ where: { id: parseInt(contractorId) }, data: { totalProjects: count } });
        }

        res.status(201).json(project);
    } catch (error) {
        console.error('createProject error:', error);
        res.status(500).json({ error: error.message });
    }
};

// PUT /api/construction/projects/:id
exports.updateProject = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { name, description, location, status, priority, progress, startDate, endDate, budgetAmount, actualCost, fundingSource, picName, contractorId } = req.body;

        const existing = await prisma.constructionProject.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Proyek tidak ditemukan' });

        // Handle media
        const newMedia = req.uploadedMedia || [];
        let mergedMedia = [];
        if (Array.isArray(existing.media)) mergedMedia = [...existing.media];
        if (newMedia.length > 0) mergedMedia = [...mergedMedia, ...newMedia];

        const updateData = {
            name: name || existing.name,
            description: description !== undefined ? description : existing.description,
            location: location !== undefined ? location : existing.location,
            status: status || existing.status,
            priority: priority || existing.priority,
            progress: progress !== undefined ? parseFloat(progress) : existing.progress,
            startDate: startDate ? new Date(startDate) : existing.startDate,
            endDate: endDate ? new Date(endDate) : existing.endDate,
            budgetAmount: budgetAmount !== undefined ? parseFloat(budgetAmount) : existing.budgetAmount,
            actualCost: actualCost !== undefined ? parseFloat(actualCost) : existing.actualCost,
            fundingSource: fundingSource !== undefined ? fundingSource : existing.fundingSource,
            picName: picName !== undefined ? picName : existing.picName,
            contractorId: contractorId !== undefined ? (contractorId ? parseInt(contractorId) : null) : existing.contractorId,
        };

        if (mergedMedia.length > 0) updateData.media = mergedMedia;
        if (newMedia.length > 0 && !existing.photo) {
            updateData.photo = newMedia.find(m => m.type === 'IMAGE')?.url || existing.photo;
        }

        const project = await prisma.constructionProject.update({
            where: { id },
            data: updateData,
            include: { contractor: true }
        });

        // Recalculate contractor project counts if changed
        if (contractorId !== undefined && existing.contractorId !== (contractorId ? parseInt(contractorId) : null)) {
            if (existing.contractorId) {
                const oldCount = await prisma.constructionProject.count({ where: { contractorId: existing.contractorId } });
                await prisma.contractor.update({ where: { id: existing.contractorId }, data: { totalProjects: oldCount } });
            }
            if (contractorId) {
                const newCount = await prisma.constructionProject.count({ where: { contractorId: parseInt(contractorId) } });
                await prisma.contractor.update({ where: { id: parseInt(contractorId) }, data: { totalProjects: newCount } });
            }
        }

        res.json(project);
    } catch (error) {
        console.error('updateProject error:', error);
        res.status(500).json({ error: error.message });
    }
};

// DELETE /api/construction/projects/:id
exports.deleteProject = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const project = await prisma.constructionProject.findUnique({ where: { id } });
        if (!project) return res.status(404).json({ error: 'Proyek tidak ditemukan' });

        await prisma.constructionProject.delete({ where: { id } });

        // Recalculate contractor count
        if (project.contractorId) {
            const count = await prisma.constructionProject.count({ where: { contractorId: project.contractorId } });
            await prisma.contractor.update({ where: { id: project.contractorId }, data: { totalProjects: count } });
        }

        res.json({ message: 'Proyek berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
