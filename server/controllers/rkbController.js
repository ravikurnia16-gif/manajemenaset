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
    const { name, qty, estPrice, category, priority, month } = req.body;

    try {
        const item = await prisma.rKBItem.create({
            data: {
                rkbId: parseInt(id),
                name,
                qty: parseInt(qty),
                estPrice: parseFloat(estPrice),
                category,
                priority,
                month: parseInt(month) || 1
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
// Import RKB from Excel JSON
// Import RKB from Excel JSON
exports.importRKB = async (req, res) => {
    const { fiscalYear, unitId, items } = req.body;

    // 1. Validasi Payload Dasar
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Data items kosong atau format salah. Pastikan Anda mengupload file yang berisi data.' });
    }
    if (!fiscalYear || !unitId) {
        return res.status(400).json({ error: 'Tahun Anggaran dan Unit Tujuan wajib dipilih.' });
    }

    // 2. Validasi Tiap Baris Data
    const errors = [];
    const validItems = [];

    items.forEach((item, index) => {
        const rowNum = index + 1; // Baris Excel (asumsi header baris 1)
        const name = item.name?.toString().trim();
        const qty = parseInt(item.qty);
        const estPrice = parseFloat(item.estPrice);
        const month = parseInt(item.month);

        if (!name) {
            errors.push(`Baris ${rowNum}: Nama Barang wajib diisi.`);
        }
        if (isNaN(qty) || qty <= 0) {
            errors.push(`Baris ${rowNum}: Jumlah harus berupa angka lebih dari 0.`);
        }
        if (isNaN(estPrice) || estPrice < 0) {
            errors.push(`Baris ${rowNum}: Estimasi Harga tidak valid.`);
        }
        if (month < 1 || month > 12) { // Allow NaN (defaults to 1), but if present must be valid
            if (item.month && (isNaN(month) || month < 1 || month > 12)) {
                errors.push(`Baris ${rowNum}: Bulan harus angka 1-12.`);
            }
        }

        if (errors.length === 0) {
            validItems.push({
                ...item,
                name,
                qty,
                estPrice,
                month: (month >= 1 && month <= 12) ? month : 1,
                // Fix: Force String conversion for text fields
                spec: item.spec ? String(item.spec) : '-',
                unit: item.unit ? String(item.unit) : 'Unit',
                category: ['ASSET', 'NON_ASSET', 'JASA'].includes(item.category) ? item.category : 'NON_ASSET', // Default fallback
                priority: ['HIGH', 'MEDIUM', 'LOW'].includes(item.priority) ? item.priority : 'MEDIUM'
            });
        }
    });

    if (errors.length > 0) {
        // Return 400 dengan semua error (batasi 5 error pertama agar tidak flooding)
        const shownErrors = errors.slice(0, 5);
        if (errors.length > 5) shownErrors.push(`...dan ${errors.length - 5} kesalahan lainnya.`);

        return res.status(400).json({
            error: 'Terdapat kesalahan pada data Excel:',
            details: shownErrors
        });
    }

    try {
        // 3. Cek RKB Header
        let rkb = await prisma.rKB.findFirst({
            where: {
                fiscalYear: parseInt(fiscalYear),
                unitId: parseInt(unitId)
            }
        });

        // Jika belum ada, buat baru
        if (!rkb) {
            rkb = await prisma.rKB.create({
                data: {
                    fiscalYear: parseInt(fiscalYear),
                    unitId: parseInt(unitId),
                    status: 'DRAFT',
                    totalBudget: 0
                }
            });
        }

        // 4. Create Items Transaction
        const createItemPromises = validItems.map(item => {
            return prisma.rKBItem.create({
                data: {
                    rkbId: rkb.id,
                    name: item.name,
                    spec: item.spec, // Already casted above
                    qty: item.qty,
                    unit: item.unit, // Already casted above
                    estPrice: item.estPrice,
                    category: item.category,
                    priority: item.priority,
                    month: item.month
                }
            });
        });

        await prisma.$transaction(createItemPromises);

        // 5. Recalculate Total
        const allItems = await prisma.rKBItem.findMany({ where: { rkbId: rkb.id } });
        const total = allItems.reduce((sum, item) => sum + (item.qty * item.estPrice), 0);

        await prisma.rKB.update({
            where: { id: rkb.id },
            data: { totalBudget: total }
        });

        res.json({ message: `Berhasil mengimport ${validItems.length} item ke RKB Unit.` });

    } catch (error) {
        console.error("Import Error:", error);
        res.status(500).json({ error: 'Terjadi kesalahan sistem saat menyimpan data: ' + error.message });
    }
};
