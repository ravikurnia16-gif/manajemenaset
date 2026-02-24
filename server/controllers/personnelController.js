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
    const { type, category, content, date, details, metadata } = req.body;
    const user = req.user;

    try {
        if (!['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT'].includes(user.role) && !await isSarprasUnit(user.unitId)) {
            return res.status(403).json({ error: 'Akses ditolak. Hanya unit Sarana dan Prasarana atau Admin Global yang dapat mengisi laporan.' });
        }

        const report = await prisma.personnelReport.create({
            data: {
                userId: user.id,
                type,
                category: category || 'UMUM',
                content,
                metadata: metadata || null,
                date: date ? new Date(date) : new Date()
            }
        });

        res.json({ message: 'Laporan berhasil disimpan', data: report });

        // --- WhatsApp Notification to Leads (Async) ---
        (async () => {
            try {
                // Find recipients: Kepala Bidang Sarana dan Prasarana
                const leads = await prisma.user.findMany({
                    where: {
                        position: 'Kepala Bidang Sarana dan Prasarana',
                        phone: { not: null, not: '' }
                    }
                });

                if (leads.length > 0) {
                    const reporter = await prisma.user.findUnique({
                        where: { id: user.id }
                    });

                    const typeLabel = type === 'DAILY' ? 'Harian' : 'Mingguan';
                    const catLabel = {
                        'KEUANGAN': '💰 Keuangan',
                        'ASET': '📦 Manajemen Aset',
                        'GUDANG': '🏠 Gudang & Logistik',
                        'KENDARAAN': '🚗 Kendaraan',
                        'UMUM': '📝 Umum'
                    }[category] || '📝 Umum';

                    let msg = `📋 *LAPORAN PERSONALIA BARU*\n\n` +
                        `👤 *Staf* : ${reporter?.name || reporter?.username || 'Staf'}\n` +
                        `📅 *Tanggal* : ${new Date(date || new Date()).toLocaleDateString('id-ID')}\n` +
                        `📑 *Tipe* : ${typeLabel}\n` +
                        `📂 *Kategori* : ${catLabel}\n\n`;

                    if (details) {
                        msg += `📊 *Detail Aktivitas*:\n${details}\n\n`;
                    }

                    if (content && content.trim()) {
                        msg += `📝 *Isi Laporan*:\n${content}`;
                    }

                    for (const lead of leads) {
                        try {
                            await whatsappService.sendMessage(lead.phone, msg);
                            console.log(`[Personnel Report] Notification sent to ${lead.name}`);
                        } catch (waError) {
                            console.error(`[Personnel Report] Failed to send WA to ${lead.name}:`, waError);
                        }
                    }
                }
            } catch (err) {
                console.error('WA Personnel Report Error:', err);
            }
        })();
    } catch (error) {
        console.error("Create Report Error:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.getReports = async (req, res) => {
    const { type, category, startDate, endDate, userId, limit } = req.query;
    const user = req.user;

    try {
        if (!['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT'].includes(user.role) && !await isSarprasUnit(user.unitId)) {
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
        // - SUPER_ADMIN can see all reports or filter by staff (userId).
        // - All other roles (ADMIN_ASET, BIDANG_IT, etc.) see ONLY their own.
        if (user.role === 'SUPER_ADMIN') {
            if (userId && userId !== 'all') {
                where.userId = parseInt(userId);
            }
        } else {
            where.userId = user.id;
        }

        const queryOptions = {
            where,
            include: {
                user: { select: { name: true, username: true, position: true } }
            },
            orderBy: [
                { date: 'desc' },
                { createdAt: 'desc' }
            ]
        };

        if (limit && limit !== 'all') {
            queryOptions.take = parseInt(limit);
        }

        const reports = await prisma.personnelReport.findMany(queryOptions);

        res.json(reports);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- ASSIGNMENTS ---

exports.createAssignment = async (req, res) => {
    const { assigneeId, title, description, startDate, dueDate, category, location, addToCalendar } = req.body;
    const user = req.user;

    try {
        // Only Head or Admin can assign
        if (!['KEPALA_BIDANG', 'ADMIN_UNIT', 'SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT'].includes(user.role)) {
            return res.status(403).json({ error: 'Anda tidak memiliki wewenang untuk memberikan tugas.' });
        }

        if (!['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT'].includes(user.role) && !await isSarprasUnit(user.unitId)) {
            return res.status(403).json({ error: 'Akses ditolak.' });
        }

        const assignment = await prisma.personnelAssignment.create({
            data: {
                assignerId: user.id,
                assigneeId: parseInt(assigneeId),
                title,
                description,
                category: category || 'UMUM',
                location: location || null,
                startDate: startDate ? new Date(startDate) : null,
                dueDate: dueDate ? new Date(dueDate) : null,
                status: 'PENDING'
            }
        });

        // AUTO-SYNC TO CALENDAR: Create a calendar event for this assignment (ONLY IF REQUESTED)
        if (addToCalendar) {
            try {
                // Map category to match Calendar categories if possible
                const calendarCategory = ['Pemeliharaan', 'Pengadaan', 'Kebersihan', 'Rapat', 'Deadline', 'Kerja'].includes(category)
                    ? category
                    : (category === 'Servis' || category === 'Perbaikan' ? 'Pemeliharaan' : 'Lainnya');

                const calEvent = await prisma.sarprasCalendarEvent.create({
                    data: {
                        title: `[KERJA] ${title}`,
                        description: `[PENUGASAN] ${description || ''}`,
                        category: calendarCategory,
                        // If startDate exists, use it as the main date. If only dueDate exists, use that.
                        date: startDate ? new Date(startDate) : (dueDate ? new Date(dueDate) : new Date()),
                        // End date is always dueDate if it exists
                        endDate: dueDate ? new Date(dueDate) : null,
                        location: location || null,
                        createdById: user.id,
                        pics: {
                            connect: [{ id: parseInt(assigneeId) }]
                        }
                    }
                });

                // Link the assignment back to the calendar event
                await prisma.personnelAssignment.update({
                    where: { id: assignment.id },
                    data: { calendarEventId: calEvent.id }
                });
            } catch (calErr) {
                console.error('[Personnel -> Calendar Sync] Failed:', calErr.message);
            }
        }

        res.json({ message: 'Tugas berhasil diberikan', data: assignment });

        // --- WhatsApp Notification to Assignee (Async) ---
        (async () => {
            try {
                const assignee = await prisma.user.findUnique({
                    where: { id: parseInt(assigneeId) }
                });

                const assigner = await prisma.user.findUnique({
                    where: { id: user.id }
                });

                if (assignee?.phone) {
                    const msg = `*Bismillah*\n\n` +
                        `Telah masuk permintaan dari Kepala Bidang Sarana dan Prasarana Dengan Rinciannya:\n\n` +
                        `📌 *Judul* : ${title}\n` +
                        `📅 *Deadline* : ${dueDate ? new Date(dueDate).toLocaleDateString('id-ID') : '-'}\n` +
                        `👤 *Pemberi Tugas* : ${assigner?.name || assigner?.username || 'Admin'}\n\n` +
                        `*Deskripsi* :\n${description}\n\n` +
                        `Mohon bantuan untuk segera dilaksanakan ya Ustadz`;

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
    const { limit } = req.query;
    const user = req.user;

    try {
        if (!['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT'].includes(user.role) && !await isSarprasUnit(user.unitId)) {
            return res.status(403).json({ error: 'Akses ditolak.' });
        }

        const where = {};
        if (!['SUPER_ADMIN', 'BIDANG_IT'].includes(user.role)) {
            where.OR = [
                { assigneeId: user.id },
                { assignerId: user.id }
            ];
        }

        const queryOptions = {
            where,
            include: {
                assigner: { select: { name: true } },
                assignee: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        };

        if (limit && limit !== 'all') {
            queryOptions.take = parseInt(limit);
        }

        const assignments = await prisma.personnelAssignment.findMany(queryOptions);

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

        if (!assignment) return res.status(404).json({ error: 'Penugasan tidak ditemukan.' });

        if (assignment.assigneeId !== user.id && assignment.assignerId !== user.id && !['SUPER_ADMIN', 'BIDANG_IT'].includes(user.role)) {
            return res.status(403).json({ error: 'Akses ditolak.' });
        }

        const updated = await prisma.personnelAssignment.update({
            where: { id: parseInt(id) },
            data: { status }
        });

        res.json(updated);

        // --- WhatsApp Notification to Leads if COMPLETED (Async) ---
        if (status === 'COMPLETED') {
            (async () => {
                try {
                    // Find recipients: Kepala Bidang Sarana dan Prasarana
                    const leads = await prisma.user.findMany({
                        where: {
                            position: 'Kepala Bidang Sarana dan Prasarana',
                            phone: { not: null, not: '' }
                        }
                    });

                    if (leads.length > 0) {
                        const assignee = await prisma.user.findUnique({
                            where: { id: assignment.assigneeId }
                        });
                        const msg = `✅ *PENUGASAN SELESAI*\n\n` +
                            `📌 *Judul* : ${assignment.title}\n` +
                            `👤 *Dikerjakan Oleh* : ${assignee?.name || 'Staf'}\n` +
                            `📅 *Selesai Pada* : ${new Date().toLocaleString('id-ID')}`;

                        for (const lead of leads) {
                            try {
                                await whatsappService.sendMessage(lead.phone, msg);
                                console.log(`[Assignment Completion] Notification sent to ${lead.name}`);
                            } catch (waError) {
                                console.error(`[Assignment Completion] Failed to send WA to ${lead.name}:`, waError);
                            }
                        }
                    }
                } catch (err) {
                    console.error('WA Personnel Completion Error:', err);
                }
            })();
        }
    } catch (error) {
        console.error("Update Assignment Status Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// Help to get staff list for assignment dropdown
exports.getStaffSarpras = async (req, res) => {
    try {
        // No strict role check here, because all users need to see staff list 
        // to pick a driver for vehicle booking.

        const staff = await prisma.user.findMany({
            where: {
                OR: [
                    { position: { contains: 'Kepala Bidang Sarana dan Prasarana' } },
                    { position: { contains: 'Keuangan dan Administrasi' } },
                    { position: { contains: 'Manajemen Aset' } },
                    { position: { contains: 'Gudang dan Logistik' } },
                    { position: { contains: 'Staff Kendaraan' } },
                    { position: { contains: 'Staf Kendaraan' } },
                    { position: { contains: 'Sopir' } }, // Usually Driver/Staff Kendaraan
                    { position: { contains: 'Driver' } }
                ]
            },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, position: true }
        });

        res.json(staff);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- DRIVER MANAGEMENT ---

exports.getDrivers = async (req, res) => {
    try {
        const drivers = await prisma.user.findMany({
            where: {
                OR: [
                    { position: { contains: 'Sopir' } },
                    { position: { contains: 'Driver' } }
                ]
            },
            include: {
                unit: { select: { name: true } }
            },
            orderBy: { name: 'asc' }
        });
        res.json(drivers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.toggleDriverDesignation = async (req, res) => {
    const { userId, isDriver } = req.body;
    const userRole = req.user.role;

    try {
        // Only Super Admin or Admin Aset can toggle designation
        if (!['SUPER_ADMIN', 'BIDANG_IT', 'ADMIN_ASET'].includes(userRole)) {
            return res.status(403).json({ error: 'Akses ditolak. Anda tidak memiliki izin untuk mengelola daftar sopir.' });
        }

        const targetUser = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
        if (!targetUser) return res.status(400).json({ error: 'User tidak ditemukan.' });

        let currentPosition = targetUser.position || '';
        let newPosition = currentPosition;

        if (isDriver) {
            if (!currentPosition.toLowerCase().includes('sopir') && !currentPosition.toLowerCase().includes('driver')) {
                newPosition = currentPosition ? `${currentPosition} / Sopir` : 'Sopir';
            }
        } else {
            // Remove 'Sopir' or 'Driver' with various separators
            newPosition = currentPosition
                .replace(/\s*\/\s*Sopir/gi, '')
                .replace(/Sopir\s*\/\s*/gi, '')
                .replace(/\s*\/\s*Driver/gi, '')
                .replace(/Driver\s*\/\s*/gi, '')
                .replace(/^Sopir$/gi, '')
                .replace(/^Driver$/gi, '')
                .trim();
        }

        const updated = await prisma.user.update({
            where: { id: parseInt(userId) },
            data: { position: newPosition || null }
        });

        res.json({ message: 'Status Driver berhasil diperbarui', data: updated });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAllUsersForSelection = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                username: true,
                position: true,
                role: true,
                unit: { select: { name: true } }
            }
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getPersonnelDashboard = async (req, res) => {
    try {
        const user = req.user;
        // Strict Access Control: Permintaan User (Hanya Super Admin & Admin Aset)
        if (!['SUPER_ADMIN', 'ADMIN_ASET'].includes(user.role)) {
            return res.status(403).json({ error: 'Akses ditolak. Dashboard Personalia hanya dapat diakses oleh Admin.' });
        }

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const [activeAssignments, todayAgenda, pendingReports] = await Promise.all([
            prisma.personnelAssignment.count({ where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
            prisma.sarprasCalendarEvent.count({ where: { date: { gte: startOfToday, lt: new Date(new Date().setDate(now.getDate() + 1)) } } }),
            prisma.personnelReport.count({ where: { date: { gte: new Date(new Date().setDate(now.getDate() - 7)) } } }) // Example: Recent reports
        ]);

        // Assignment Status Distribution
        const statusGroups = await prisma.personnelAssignment.groupBy({
            by: ['status'],
            _count: { _all: true }
        });

        // Weekly Report Trends
        const reportTrends = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const dEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

            const count = await prisma.personnelReport.count({
                where: { createdAt: { gte: dStart, lte: dEnd } }
            });
            reportTrends.push({
                name: d.toLocaleString('id-ID', { weekday: 'short' }),
                value: count
            });
        }

        res.json({
            stats: { activeAssignments, todayAgenda, pendingReports },
            assignmentStatus: statusGroups.map(s => ({ name: s.status, value: s._count._all })),
            reportTrends
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
