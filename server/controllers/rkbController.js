const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all RKBs (Filter by Unit if not Super Admin)
exports.getAllRKBs = async (req, res) => {
    const { fiscalYear, unitId } = req.query;
    const user = req.user;

    try {
        const whereClause = {};

        if (fiscalYear) whereClause.fiscalYear = parseInt(fiscalYear);

        // If user is Admin Unit or User, force filter by their unit
        if (user.role === 'ADMIN_UNIT' || user.role === 'USER') {
            whereClause.unitId = user.unitId;
        } else if (unitId) {
            whereClause.unitId = parseInt(unitId);
        }

        const rkbs = await prisma.rKB.findMany({
            where: whereClause,
            include: {
                unit: { select: { name: true, code: true } },
                items: true
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(rkbs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get single RKB detail
exports.getRKBById = async (req, res) => {
    const { id } = req.params;
    try {
        const rkb = await prisma.rKB.findUnique({
            where: { id: parseInt(id) },
            include: {
                unit: true,
                items: true
            }
        });
        if (!rkb) return res.status(404).json({ error: 'RKB not found' });
        res.json(rkb);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create new RKB Header
exports.createRKB = async (req, res) => {
    const { fiscalYear, unitId } = req.body;
    try {
        // Check if RKB for this unit & year already exists
        const existing = await prisma.rKB.findFirst({
            where: {
                fiscalYear: parseInt(fiscalYear),
                unitId: parseInt(unitId)
            }
        });

        if (existing) {
            return res.status(400).json({ error: `RKB untuk Unit ini di tahun ${fiscalYear} sudah ada.` });
        }

        const rkb = await prisma.rKB.create({
            data: {
                fiscalYear: parseInt(fiscalYear),
                unitId: parseInt(unitId),
                status: 'DRAFT'
            }
        });

        res.json({ message: 'RKB created', rkb });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Add Item to RKB
exports.addItem = async (req, res) => {
    const { id } = req.params; // RKB ID
    const { name, qty, estPrice, category, priority } = req.body;

    try {
        const item = await prisma.rKBItem.create({
            data: {
                rkbId: parseInt(id),
                name,
                qty: parseInt(qty),
                estPrice: parseFloat(estPrice),
                category,
                priority
            }
        });

        // Recalculate Total Budget
        const aggregations = await prisma.rKBItem.aggregate({
            _sum: { estPrice: true }, // Note: This sums price per item type, logically should be qty * price but schema usually stores unit price. 
            // Let's assume estPrice is Total for that item line or handle calculation.
            // For simplicity, let's assume estPrice in Item is Total Price for that line.
            where: { rkbId: parseInt(id) }
        });

        // Better: Fetch all items and sum (qty * estPrice) if estPrice is unit price. 
        // Let's assume estPrice is UNIT PRICE.
        const allItems = await prisma.rKBItem.findMany({ where: { rkbId: parseInt(id) } });
        const total = allItems.reduce((sum, item) => sum + (item.qty * item.estPrice), 0);

        await prisma.rKB.update({
            where: { id: parseInt(id) },
            data: { totalBudget: total }
        });

        res.json(item);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update Status (Submit / Approve)
exports.updateStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // SUBMITTED, APPROVED

    try {
        const rkb = await prisma.rKB.update({
            where: { id: parseInt(id) },
            data: { status }
        });
        res.json(rkb);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
