const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// --- HELPER: Generate MOU Number ---
const generateMOUNumber = async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-11
    
    const monthToRoman = (m) => {
        const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
        return roman[m];
    };

    const prefix = `MOU/`;
    const suffix = `/SRN/${monthToRoman(month)}/${year}`;

    // Find all MOUs for the current year
    const lastRecord = await prisma.officialResidenceMOU.findFirst({
        where: {
            mouNumber: {
                startsWith: prefix,
                endsWith: `/${year}`
            }
        },
        orderBy: {
            mouNumber: 'desc'
        }
    });

    let nextSequence = 1;
    if (lastRecord) {
        // Example: MOU/001/SRN/IV/2026 -> parts: ["MOU", "001", "SRN", "IV", "2026"]
        const parts = lastRecord.mouNumber.split('/');
        if (parts.length >= 3) {
            const lastSeq = parseInt(parts[1]);
            if (!isNaN(lastSeq)) {
                nextSequence = lastSeq + 1;
            }
        }
    }

    const sequence = nextSequence.toString().padStart(3, '0');
    return `${prefix}${sequence}${suffix}`;
};

// --- DASHBOARD ---
exports.getDashboardStats = async (req, res) => {
    try {
        const totalUnits = await prisma.officialResidenceUnit.count();
        const occupiedUnits = await prisma.officialResidenceUnit.count({ where: { status: 'DITEMPATI' } });
        const vacantUnits = await prisma.officialResidenceUnit.count({ where: { status: 'KOSONG' } });
        const maintenanceUnits = await prisma.officialResidenceUnit.count({ where: { status: 'MAINTENANCE' } });
        const totalResidents = await prisma.officialResidenceResident.count({ where: { status: 'AKTIF' } });
        
        const now = new Date();
        const plus90Days = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000));
        
        const activeMOUs = await prisma.officialResidenceMOU.count({ 
            where: { status: { in: ['AKTIF', 'DIPERPANJANG'] } } 
        });
        const expiringMOUs = await prisma.officialResidenceMOU.count({
            where: {
                endDate: { lte: plus90Days, gte: now },
                status: { not: 'KADALUARSA' }
            }
        });
        const expiredMOUs = await prisma.officialResidenceMOU.count({
            where: { status: 'KADALUARSA' }
        });

        const activeMaintenance = await prisma.officialResidenceMaintenance.findMany({
            where: { status: { not: 'SELESAI' } },
            include: { unit: { select: { code: true } } },
            orderBy: { reportedDate: 'desc' }
        });

        res.json({
            totalUnits,
            occupiedUnits,
            vacantUnits,
            maintenanceUnits,
            totalResidents,
            activeMOUs,
            expiringMOUs,
            expiredMOUs,
            activeMaintenance
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- UNITS ---
exports.getAllUnits = async (req, res) => {
    try {
        const units = await prisma.officialResidenceUnit.findMany({
            include: {
                residents: { where: { status: 'AKTIF' }, take: 1 }
            },
            orderBy: { code: 'asc' }
        });
        res.json(units);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createUnit = async (req, res) => {
    try {
        const { code, blok, name, luas, lantai, status, facilities } = req.body;
        const unit = await prisma.officialResidenceUnit.create({
            data: {
                code,
                blok,
                name,
                luas: parseFloat(luas),
                lantai: parseInt(lantai) || 1,
                status: status || 'KOSONG',
                facilities: Array.isArray(facilities) ? facilities.join(',') : facilities
            }
        });
        res.json(unit);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateUnit = async (req, res) => {
    try {
        const { code, blok, name, luas, lantai, status, facilities } = req.body;
        const unit = await prisma.officialResidenceUnit.update({
            where: { id: parseInt(req.params.id) },
            data: {
                code,
                blok,
                name,
                luas: parseFloat(luas),
                lantai: parseInt(lantai) || 1,
                status: status || 'KOSONG',
                facilities: Array.isArray(facilities) ? facilities.join(',') : facilities
            }
        });
        res.json(unit);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteUnit = async (req, res) => {
    try {
        await prisma.officialResidenceUnit.delete({
            where: { id: parseInt(req.params.id) }
        });
        res.json({ message: 'Unit berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- HELPER: Sync Unit Status Based on Active Residents ---
const syncUnitStatus = async (unitId) => {
    if (!unitId) return;
    const id = parseInt(unitId);
    const activeCount = await prisma.officialResidenceResident.count({
        where: { unitId: id, status: 'AKTIF' }
    });
    const unit = await prisma.officialResidenceUnit.findUnique({ where: { id } });
    if (!unit) return;

    let newStatus;
    if (activeCount > 0) {
        newStatus = 'DITEMPATI';
    } else {
        // Only change to KOSONG if currently DITEMPATI; leave MAINTENANCE alone
        newStatus = unit.status === 'DITEMPATI' ? 'KOSONG' : unit.status;
    }

    if (newStatus !== unit.status) {
        await prisma.officialResidenceUnit.update({
            where: { id },
            data: { status: newStatus }
        });
    }
};

// --- RESIDENTS ---
exports.getAllResidents = async (req, res) => {
    try {
        const residents = await prisma.officialResidenceResident.findMany({
            include: { unit: { select: { code: true } } },
            orderBy: { name: 'asc' }
        });
        res.json(residents);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createResident = async (req, res) => {
    try {
        const { nik, name, position, unitId, startDate, phone, status } = req.body;
        const resident = await prisma.officialResidenceResident.create({
            data: {
                nik,
                name,
                position,
                unitId: parseInt(unitId),
                startDate: startDate ? new Date(startDate) : null,
                phone,
                status: status || 'AKTIF'
            }
        });

        // Auto-sync unit status based on active residents
        await syncUnitStatus(unitId);

        res.json(resident);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateResident = async (req, res) => {
    try {
        const { nik, name, position, unitId, startDate, phone, status } = req.body;

        // Get old unit before update (in case unit changed)
        const oldResident = await prisma.officialResidenceResident.findUnique({
            where: { id: parseInt(req.params.id) }
        });
        const oldUnitId = oldResident?.unitId;

        const resident = await prisma.officialResidenceResident.update({
            where: { id: parseInt(req.params.id) },
            data: {
                nik,
                name,
                position,
                unitId: parseInt(unitId),
                startDate: startDate ? new Date(startDate) : null,
                phone,
                status: status || 'AKTIF'
            }
        });

        // Sync status for both old and new units
        await syncUnitStatus(unitId);
        if (oldUnitId && oldUnitId !== parseInt(unitId)) {
            await syncUnitStatus(oldUnitId);
        }

        res.json(resident);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteResident = async (req, res) => {
    try {
        // Get unit before deleting
        const resident = await prisma.officialResidenceResident.findUnique({
            where: { id: parseInt(req.params.id) }
        });
        const unitId = resident?.unitId;

        await prisma.officialResidenceResident.delete({
            where: { id: parseInt(req.params.id) }
        });

        // Sync unit status after deletion
        await syncUnitStatus(unitId);

        res.json({ message: 'Penghuni berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- MAINTENANCE ---
exports.getAllMaintenance = async (req, res) => {
    try {
        const maintenance = await prisma.officialResidenceMaintenance.findMany({
            include: { unit: { select: { code: true } } },
            orderBy: { reportedDate: 'desc' }
        });
        res.json(maintenance);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.reportMaintenance = async (req, res) => {
    try {
        const { unitId, title, description, priority, status, technician, resolvedDate } = req.body;
        const maintenance = await prisma.officialResidenceMaintenance.create({
            data: {
                unitId: parseInt(unitId),
                title,
                description,
                priority: priority || 'SEDANG',
                status: status || 'MENUNGGU',
                technician,
                resolvedDate: resolvedDate ? new Date(resolvedDate) : null
            }
        });
        res.json(maintenance);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateMaintenance = async (req, res) => {
    try {
        const { unitId, title, description, priority, status, technician, resolvedDate } = req.body;
        const maintenance = await prisma.officialResidenceMaintenance.update({
            where: { id: parseInt(req.params.id) },
            data: {
                unitId: parseInt(unitId),
                title,
                description,
                priority,
                status,
                technician,
                resolvedDate: resolvedDate ? new Date(resolvedDate) : null
            }
        });
        res.json(maintenance);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteMaintenance = async (req, res) => {
    try {
        await prisma.officialResidenceMaintenance.delete({
            where: { id: parseInt(req.params.id) }
        });
        res.json({ message: 'Laporan perbaikan berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- MOU ---
exports.getAllMOUs = async (req, res) => {
    try {
        const mous = await prisma.officialResidenceMOU.findMany({
            include: { unit: { select: { code: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json(mous);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createMOU = async (req, res) => {
    try {
        let { 
            mouNumber, unitId, residentName, residentPosition, 
            startDate, endDate, durationYears, status, 
            rights, obligations, notes, signedDate,
            signatureParty1, signatureParty2
        } = req.body;
        
        // Auto-generate MOU Number if not provided
        if (!mouNumber || mouNumber === "(Otomatis)") {
            mouNumber = await generateMOUNumber();
        }
        
        const mou = await prisma.officialResidenceMOU.create({
            data: {
                mouNumber,
                unitId: parseInt(unitId),
                residentName,
                residentPosition,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                durationYears: parseInt(durationYears),
                status: status || 'AKTIF',
                rights,
                obligations,
                notes,
                signedDate: signedDate ? new Date(signedDate) : null,
                signatureParty1,
                signatureParty2
            }
        });
        res.json(mou);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateMOU = async (req, res) => {
    try {
        const { 
            mouNumber, unitId, residentName, residentPosition, 
            startDate, endDate, durationYears, status, 
            rights, obligations, notes, signedDate,
            signatureParty1, signatureParty2
        } = req.body;
        
        const mou = await prisma.officialResidenceMOU.update({
            where: { id: parseInt(req.params.id) },
            data: {
                mouNumber,
                unitId: parseInt(unitId),
                residentName,
                residentPosition,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                durationYears: parseInt(durationYears),
                status: status || 'AKTIF',
                rights,
                obligations,
                notes,
                signedDate: signedDate ? new Date(signedDate) : null,
                signatureParty1,
                signatureParty2
            }
        });
        res.json(mou);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteMOU = async (req, res) => {
    try {
        await prisma.officialResidenceMOU.delete({
            where: { id: parseInt(req.params.id) }
        });
        res.json({ message: 'MOU berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
