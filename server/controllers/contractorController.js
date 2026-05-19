const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/contractors
exports.getAllContractors = async (req, res) => {
    try {
        const { search, specialty, isActive, page = 1, limit = 20 } = req.query;
        const where = {};

        if (isActive !== undefined && isActive !== '') {
            where.isActive = isActive === 'true';
        }
        if (specialty) where.specialty = { contains: specialty };
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { phone: { contains: search } },
                { specialty: { contains: search } },
                { address: { contains: search } },
            ];
        }

        const isAll = limit === 'all' || limit === '-1';
        const take = isAll ? undefined : parseInt(limit);
        const skip = isAll ? undefined : (parseInt(page) - 1) * take;

        const [contractors, total] = await Promise.all([
            prisma.contractor.findMany({
                where,
                include: { projects: { select: { id: true, code: true, name: true, status: true }, orderBy: { createdAt: 'desc' }, take: 5 } },
                orderBy: { createdAt: 'desc' },
                take,
                skip
            }),
            prisma.contractor.count({ where })
        ]);

        res.json({
            data: contractors,
            meta: {
                total,
                page: isAll ? 1 : parseInt(page),
                limit: isAll ? total : take,
                totalPages: isAll ? 1 : Math.ceil(total / take)
            }
        });
    } catch (error) {
        console.error('getAllContractors error:', error);
        res.status(500).json({ error: error.message });
    }
};

// GET /api/contractors/:id
exports.getContractorById = async (req, res) => {
    try {
        const contractor = await prisma.contractor.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { projects: { orderBy: { createdAt: 'desc' } } }
        });
        if (!contractor) return res.status(404).json({ error: 'Kontraktor tidak ditemukan' });
        res.json(contractor);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// POST /api/contractors
exports.createContractor = async (req, res) => {
    try {
        const { name, phone, address, specialty, notes } = req.body;

        // Handle photo upload
        const media = req.uploadedMedia || [];
        const photoUrl = media.find(m => m.type === 'IMAGE')?.url || null;

        const contractor = await prisma.contractor.create({
            data: {
                name,
                phone: phone || null,
                address: address || null,
                specialty: specialty || null,
                notes: notes || null,
                photo: photoUrl,
            }
        });

        res.status(201).json(contractor);
    } catch (error) {
        console.error('createContractor error:', error);
        res.status(500).json({ error: error.message });
    }
};

// PUT /api/contractors/:id
exports.updateContractor = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { name, phone, address, specialty, rating, notes, isActive } = req.body;

        const existing = await prisma.contractor.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Kontraktor tidak ditemukan' });

        // Handle photo upload
        const media = req.uploadedMedia || [];
        const newPhoto = media.find(m => m.type === 'IMAGE')?.url || null;

        const contractor = await prisma.contractor.update({
            where: { id },
            data: {
                name: name || existing.name,
                phone: phone !== undefined ? phone : existing.phone,
                address: address !== undefined ? address : existing.address,
                specialty: specialty !== undefined ? specialty : existing.specialty,
                rating: rating !== undefined ? parseFloat(rating) : existing.rating,
                notes: notes !== undefined ? notes : existing.notes,
                isActive: isActive !== undefined ? isActive : existing.isActive,
                photo: newPhoto || existing.photo,
            },
            include: { projects: { select: { id: true, code: true, name: true, status: true }, take: 5 } }
        });

        res.json(contractor);
    } catch (error) {
        console.error('updateContractor error:', error);
        res.status(500).json({ error: error.message });
    }
};

// DELETE /api/contractors/:id
exports.deleteContractor = async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        // Check if contractor is linked to any project
        const linkedProjects = await prisma.constructionProject.count({ where: { contractorId: id } });
        if (linkedProjects > 0) {
            return res.status(400).json({ error: `Kontraktor ini masih terhubung dengan ${linkedProjects} proyek. Lepaskan relasi terlebih dahulu.` });
        }

        await prisma.contractor.delete({ where: { id } });
        res.json({ message: 'Kontraktor berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
