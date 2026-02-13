const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const whatsappService = require('../services/whatsappService');

// Helper to check if user belongs to 'Sarana dan Prasarana' unit
const isSarprasUnit = async (unitId) => {
    if (!unitId) return false;
    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    return unit && unit.name.toLowerCase().includes('sarana dan prasarana');
};

// --- REPORTS ---

exports.createReport = async (req, res) => {
    const { type, category, content, date, details } = req.body;
    const user = req.user;

    try {
        if (!['SUPER_ADMIN', 'ADMIN_ASET'].includes(user.role) && !await isSarprasUnit(user.unitId)) {
            return res.status(403).json({ error: 'Akses ditolak. Hanya unit Sarana dan Prasarana yang dapat mengisi laporan.' });
        }

        const report = await prisma.personnelReport.create({
            data: {
                userId: user.id,
                type,
                category: category || 'UMUM',
                content,
                date: date ? new Date(date) : new Date()
            }
        });

        res.json({ message: 'Laporan berhasil disimpan', data: report });

        // --- WhatsApp Notification to Ravi Kurnia (Async) ---
        (async () => {
            try {
                const ravi = await prisma.user.findUnique({
                    where: { nip: '24071613' }
                });

                if (ravi?.phone) {
                    const typeLabel = type === 'DAILY' ? 'Harian' : 'Mingguan';
                    const catLabel = {
                        'KEUANGAN': '💰 Keuangan',
                        'ASET': '📦 Manajemen Aset',
                        'GUDANG': '🏠 Gudang & Logistik',
                        'KENDARAAN': '🚗 Kendaraan',
                        'UMUM': '📝 Umum'
                    }[category] || '📝 Umum';

                    let msg = `📋 *LAPORAN PERSONALIA BARU*\n\n` +
                        `👤 *Staf* : ${user.name || user.username}\n` +
                        `📅 *Tanggal* : ${new Date(date || new Date()).toLocaleDateString('id-ID')}\n` +
                        `📑 *Tipe* : ${typeLabel}\n` +
                        `📂 *Kategori* : ${catLabel}\n\n`;

                    if (details) {
                        msg += `📊 *Detail Aktivitas*:\n${details}\n\n`;
                    }

                    msg += `📝 *Isi Laporan*:\n${content}`;

                    await whatsappService.sendMessage(ravi.phone, msg);
                }
            } catch (err) {
                console.error('WA Personnel Report Error:', err);
            }
        })();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getReports = async (req, res) => {
    const { type, category, startDate, endDate, userId } = req.query;
    const user = req.user;

    try {
        if (!['SUPER_ADMIN', 'ADMIN_ASET'].includes(user.role) && !await isSarprasUnit(user.unitId)) {
            return res.status(403).json({ error: 'Akses ditolak.' });
        }

        const where = {};
        if (type) where.type = type;
        if (category) where.category = category;
        if (startDate && endDate) {
            where.date = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }

        // Access Control: 
        // - KEPALA_BIDANG or ADMIN_UNIT can see all reports in their unit.
        // - Regular USER/Staff sees only their own.
        if (['KEPALA_BIDANG', 'ADMIN_UNIT', 'SUPER_ADMIN'].includes(user.role)) {
            if (userId) where.userId = parseInt(userId);
            // Additionally ensure they only see Sarpras unit reports if not SUPER_ADMIN
            if (user.role !== 'SUPER_ADMIN') {
                where.user = { unitId: user.unitId };
            }
        } else {
            where.userId = user.id;
        }

        const reports = await prisma.personnelReport.findMany({
            where,
            include: {
                user: { select: { name: true, username: true, position: true } }
            },
            orderBy: { date: 'desc' }
        });

        res.json(reports);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- ASSIGNMENTS ---

exports.createAssignment = async (req, res) => {
    const { assigneeId, title, description, dueDate } = req.body;
    const user = req.user;

    try {
        // Only Head or Admin can assign
        if (!['KEPALA_BIDANG', 'ADMIN_UNIT', 'SUPER_ADMIN'].includes(user.role)) {
            return res.status(403).json({ error: 'Anda tidak memiliki wewenang untuk memberikan tugas.' });
        }

        if (!['SUPER_ADMIN', 'ADMIN_ASET'].includes(user.role) && !await isSarprasUnit(user.unitId)) {
            return res.status(403).json({ error: 'Akses ditolak.' });
        }

        const assignment = await prisma.personnelAssignment.create({
            data: {
                assignerId: user.id,
                assigneeId: parseInt(assigneeId),
                title,
                description,
                dueDate: dueDate ? new Date(dueDate) : null,
                status: 'PENDING'
            }
        });

        res.json({ message: 'Tugas berhasil diberikan', data: assignment });

        // --- WhatsApp Notification to Assignee (Async) ---
        (async () => {
            try {
                const assignee = await prisma.user.findUnique({
                    where: { id: parseInt(assigneeId) }
                });

                if (assignee?.phone) {
                    const msg = `👷‍♂️ *PENUGASAN BARU*\n\n` +
                        `📌 *Judul* : ${title}\n` +
                        `📅 *Deadline* : ${dueDate ? new Date(dueDate).toLocaleDateString('id-ID') : '-'}\n` +
                        `👤 *Pemberi Tugas* : ${user.name || user.username}\n\n` +
                        `📝 *Deskripsi*:\n${description}`;

                    await whatsappService.sendMessage(assignee.phone, msg);
                }
            } catch (err) {
                console.error('WA Personnel Assignment Error:', err);
            }
        })();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAssignments = async (req, res) => {
    const user = req.user;

    try {
        if (!['SUPER_ADMIN', 'ADMIN_ASET'].includes(user.role) && !await isSarprasUnit(user.unitId)) {
            return res.status(403).json({ error: 'Akses ditolak.' });
        }

        const where = {};
        if (['KEPALA_BIDANG', 'ADMIN_UNIT', 'SUPER_ADMIN'].includes(user.role)) {
            if (!['SUPER_ADMIN', 'ADMIN_ASET'].includes(user.role)) {
                where.OR = [
                    { assignerId: user.id },
                    { assigneeId: user.id },
                    { assignee: { unitId: user.unitId } }
                ];
            }
        } else {
            where.assigneeId = user.id;
        }

        const assignments = await prisma.personnelAssignment.findMany({
            where,
            include: {
                assigner: { select: { name: true } },
                assignee: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(assignments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateAssignmentStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const user = req.user;

    try {
        const assignment = await prisma.personnelAssignment.findUnique({
            where: { id: parseInt(id) }
        });

        if (!assignment) return res.status(404).json({ error: 'Tugas tidak ditemukan' });

        // Only assignee or assigner can update
        if (assignment.assigneeId !== user.id && assignment.assignerId !== user.id && user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Akses ditolak.' });
        }

        const updated = await prisma.personnelAssignment.update({
            where: { id: parseInt(id) },
            data: { status }
        });

        res.json(updated);

        // --- WhatsApp Notification to Ravi Kurnia if COMPLETED (Async) ---
        if (status === 'COMPLETED') {
            (async () => {
                try {
                    const ravi = await prisma.user.findUnique({
                        where: { nip: '24071613' }
                    });

                    if (ravi?.phone) {
                        const assignee = await prisma.user.findUnique({
                            where: { id: assignment.assigneeId }
                        });
                        const msg = `✅ *PENUGASAN SELESAI*\n\n` +
                            `📌 *Judul* : ${assignment.title}\n` +
                            `👤 *Dikerjakan Oleh* : ${assignee?.name || 'Staf'}\n` +
                            `📅 *Selesai Pada* : ${new Date().toLocaleString('id-ID')}`;

                        await whatsappService.sendMessage(ravi.phone, msg);
                    }
                } catch (err) {
                    console.error('WA Personnel Completion Error:', err);
                }
            })();
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Help to get staff list for assignment dropdown
exports.getStaffSarpras = async (req, res) => {
    const user = req.user;
    try {
        if (!['SUPER_ADMIN', 'ADMIN_ASET'].includes(user.role) && !await isSarprasUnit(user.unitId)) {
            return res.status(403).json({ error: 'Akses ditolak.' });
        }

        const staff = await prisma.user.findMany({
            where: {
                unit: { name: { contains: 'Sarana dan Prasarana' } }
            },
            select: { id: true, name: true, position: true }
        });

        res.json(staff);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
