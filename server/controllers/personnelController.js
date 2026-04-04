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

                    const isPlan = metadata?.isPlan;
                    const typeLabel = isPlan ? 'Rencana Kerja' : (type === 'DAILY' ? 'Harian' : 'Mingguan');
                    const emoji = isPlan ? '📅' : '📋';
                    const catLabel = {
                        'KEUANGAN': '💰 Keuangan',
                        'ASET': '📦 Manajemen Aset',
                        'GUDANG': '🏠 Gudang & Logistik',
                        'KENDARAAN': '🚗 Kendaraan',
                        'UMUM': '📝 Umum'
                    }[category] || '📝 Umum';

                    let msg = `${emoji} *${isPlan ? 'RENCANA KERJA MINGGUAN' : 'LAPORAN PERSONALIA'} BARU*\n\n` +
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
    const { assigneeId, title, description, startDate, dueDate, category, location, items, addToCalendar, priority } = req.body;
    const user = req.user;

    try {
        const assignment = await prisma.personnelAssignment.create({
            data: {
                assignerId: user.id,
                assigneeId: parseInt(assigneeId),
                title,
                description,
                category: category || 'UMUM',
                priority: priority || 'MEDIUM',
                location: location || null,
                startDate: startDate ? new Date(startDate) : null,
                dueDate: dueDate ? new Date(dueDate) : null,
                status: 'PENDING',
                items: items || []
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
                    const checklist = Array.isArray(items)
                        ? items.map((it, idx) => `${idx + 1}. ${it.text}`).join('\n')
                        : '';

                    const msg = `*Bismillah*\n\n` +
                        `Telah masuk permintaan dari Kepala Bidang Sarana dan Prasarana Dengan Rinciannya:\n\n` +
                        `📌 *Judul* : ${title}\n` +
                        `📅 *Deadline* : ${dueDate ? new Date(dueDate).toLocaleDateString('id-ID') : '-'}\n` +
                        `👤 *Pemberi Tugas* : ${assigner?.name || assigner?.username || 'Admin'}\n\n` +
                        `*Deskripsi* :\n${checklist || description}\n\n` +
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
    const { status, progressPercentage, notes, items } = req.body;
    const user = req.user;

    try {
        const assignment = await prisma.personnelAssignment.findUnique({
            where: { id: parseInt(id) }
        });

        if (!assignment) return res.status(404).json({ error: 'Penugasan tidak ditemukan.' });

        if (assignment.assigneeId !== user.id &&
            assignment.assignerId !== user.id &&
            !['SUPER_ADMIN', 'BIDANG_IT', 'ADMIN_ASET', 'ADMIN_UNIT', 'KEPALA_BIDANG'].includes(user.role)) {
            return res.status(403).json({ error: 'Akses ditolak.' });
        }

        const data = {};

        // Handle logical items/checklist update
        if (items) {
            data.items = items;
            // Calculate progress based on items
            if (Array.isArray(items) && items.length > 0) {
                const completedItems = items.filter(it => it.status === 'COMPLETED').length;
                const percentage = Math.round((completedItems / items.length) * 100);
                data.progressPercentage = percentage;

                if (percentage === 100) {
                    if (assignment.status !== 'COMPLETED') {
                        data.status = 'COMPLETED';
                        data.actualCompletionDate = new Date();
                    }
                } else if (percentage > 0) {
                    if (assignment.status === 'PENDING') {
                        data.status = 'IN_PROGRESS';
                        data.actualStartDate = new Date();
                    } else if (assignment.status === 'COMPLETED') {
                        data.status = 'IN_PROGRESS';
                        data.actualCompletionDate = null;
                    }
                } else if (percentage === 0 && assignment.status !== 'PENDING') {
                    data.status = 'PENDING';
                    data.actualStartDate = null;
                }
            }
        }

        if (status) {
            data.status = status;
            if (status === 'IN_PROGRESS' && !assignment.actualStartDate) {
                data.actualStartDate = new Date();
            }
            if (status === 'COMPLETED') {
                data.actualCompletionDate = new Date();
                data.progressPercentage = 100;
            }
        }

        if (progressPercentage !== undefined) {
            const newPercentage = parseInt(progressPercentage);
            data.progressPercentage = newPercentage;

            if (newPercentage === 100) {
                data.status = 'COMPLETED';
                data.actualCompletionDate = new Date();
            } else if (newPercentage > 0) {
                if (assignment.status === 'PENDING') {
                    data.status = 'IN_PROGRESS';
                    data.actualStartDate = new Date();
                } else if (assignment.status === 'COMPLETED') {
                    data.status = 'IN_PROGRESS';
                    data.actualCompletionDate = null;
                }
            } else if (newPercentage === 0 && assignment.status !== 'PENDING') {
                data.status = 'PENDING';
                data.actualStartDate = null;
            }
        }

        if (notes !== undefined) data.notes = notes;

        const updated = await prisma.personnelAssignment.update({
            where: { id: parseInt(id) },
            data
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
                    { position: { contains: 'Sarana dan Prasarana' } },
                    { position: { contains: 'Manajemen Aset' } },
                    { position: { contains: 'Gudang dan Logistik' } },
                    { position: { contains: 'Teknisi' } },
                    { position: { contains: 'Keuangan dan Administrasi' } }
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
        const targetMonth = now.getMonth() + 1;
        const targetYear = now.getFullYear();

        const [activeAssignments, todayAgenda, pendingReports, totalRoutines] = await Promise.all([
            prisma.personnelAssignment.count({ where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
            prisma.sarprasCalendarEvent.count({ where: { date: { gte: startOfToday, lt: new Date(new Date().setDate(now.getDate() + 1)) } } }),
            prisma.personnelReport.count({ where: { date: { gte: new Date(new Date().setDate(now.getDate() - 7)) } } }),
            prisma.personnelRoutine.count({ where: { isActive: true } })
        ]);

        // Get Top Performer for current month (Mock logic or actual calc)
        // For simplicity, we'll fetch the leaderboard and take the top 1
        // (In production, this could be cached)
        let topPerformer = null;
        try {
            // Simplified leaderboard logic for dash
            const staff = await prisma.user.findMany({
                where: {
                    OR: [
                        { position: { contains: 'Sarana dan Prasarana' } },
                        { position: { contains: 'Manajemen Aset' } },
                        { position: { contains: 'Gudang dan Logistik' } },
                        { position: { contains: 'Teknisi' } },
                        { position: { contains: 'Keuangan dan Administrasi' } }
                    ]
                },
                take: 20
            });
            let maxScore = -1;
            for (const s of staff) {
                const count = await prisma.personnelAssignment.count({
                    where: { assigneeId: s.id, status: 'COMPLETED', actualCompletionDate: { gte: new Date(targetYear, targetMonth - 1, 1) } }
                });
                if (count > maxScore) {
                    maxScore = count;
                    topPerformer = { name: s.name, score: count > 0 ? 95 : 0 }; // Mock score for UI
                }
            }
        } catch (e) { }

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
            stats: {
                activeAssignments,
                todayAgenda,
                pendingReports,
                totalRoutines,
                topPerformer
            },
            assignmentStatus: statusGroups.map(s => ({ name: s.status, value: s._count._all })),
            reportTrends
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- AUTOMATED REMINDERS ---

exports.checkAssignmentDeadlines = async () => {
    console.log(`[${new Date().toLocaleString('id-ID')}] [Personnel Assignment] Checking deadlines...`);
    const now = new Date();
    // Zero out time for current day comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    try {
        const assignments = await prisma.personnelAssignment.findMany({
            where: {
                status: { in: ['PENDING', 'IN_PROGRESS'] },
                dueDate: { not: null },
                OR: [
                    { lastReminderSent: null },
                    { lastReminderSent: { lt: today } }
                ]
            },
            include: {
                assignee: true,
                assigner: true
            }
        });

        if (assignments.length === 0) {
            console.log('[Personnel Assignment] No pending assignments requiring reminders at this time.');
            return;
        }

        console.log(`[Personnel Assignment] Found ${assignments.length} assignments to analyze.`);

        for (const a of assignments) {
            // Standardize dueDate to zeroed-time Date object for comparison
            const d = new Date(a.dueDate);
            const dueOnlyDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const dueTimestamp = dueOnlyDate.getTime();
            const todayTimestamp = today.getTime();
            const tomorrowTimestamp = tomorrow.getTime();

            let type = null;
            let urgencyMsg = "";

            if (dueTimestamp < todayTimestamp) {
                type = 'OVERDUE';
                urgencyMsg = "⚠️ *PERINGATAN: TUGAS TERLAMBAT* ⚠️";
            } else if (dueTimestamp === todayTimestamp) {
                type = 'TODAY';
                urgencyMsg = "🔔 *PENGINGAT: DEADLINE HARI INI* 🔔";
            } else if (dueTimestamp === tomorrowTimestamp) {
                type = 'UPCOMING';
                urgencyMsg = "🗓️ *PENGINGAT: DEADLINE BESOK* 🗓️";
            }

            if (type && a.assignee?.phone) {
                const msg = `${urgencyMsg}\n\n` +
                    `Assalamu'alaikum Ustadz ${a.assignee.name || ''},\n\n` +
                    `Mohon izin mengingatkan kembali untuk tugas berikut:\n\n` +
                    `📌 *Judul* : ${a.title}\n` +
                    `📅 *Deadline* : ${new Date(a.dueDate).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}\n` +
                    `📊 *Progres* : ${a.progressPercentage}%\n` +
                    `👤 *Pemberi Tugas* : ${a.assigner?.name || 'Admin'}\n\n` +
                    `Mohon kesediaannya untuk segera diselesaikan atau diupdate progresnya di aplikasi Sarpras ya Ustadz. Syukron Jazakumullahu Khairan.`;

                try {
                    await whatsappService.sendMessage(a.assignee.phone, msg);

                    // Update last reminder sent to now (preventing duplicate sends today)
                    await prisma.personnelAssignment.update({
                        where: { id: a.id },
                        data: { lastReminderSent: now }
                    });
                    console.log(`[Personnel Assignment] SUCCESS: Reminder (${type}) sent to ${a.assignee.name} for: ${a.title}`);
                } catch (waErr) {
                    console.error(`[Personnel Assignment] ERROR: Failed to send ${type} reminder to ${a.assignee.name}:`, waErr.message);
                }
            } else if (!type) {
                // Task is in the future (more than H-1), so we skip it silently or log for debug
                // console.log(`[Personnel Assignment] SKIP: Assignment "${a.title}" is still in the future.`);
            }
        }
    } catch (err) {
        console.error('[Personnel Assignment] CRITICAL ERROR in Check Deadlines:', err);
    }
};

// --- EXTENSION REQUESTS ---

exports.requestExtension = async (req, res) => {
    try {
        const { id } = req.params;
        const { id: userId } = req.user;
        const { requestedDate, reason } = req.body;

        if (!requestedDate || !reason) {
            return res.status(400).json({ error: 'Tanggal baru dan alasan wajib diisi.' });
        }

        const assignment = await prisma.personnelAssignment.findUnique({
            where: { id: parseInt(id) },
            include: { assignee: true, assigner: true }
        });

        if (!assignment) return res.status(404).json({ error: 'Penugasan tidak ditemukan' });
        if (assignment.assigneeId !== userId) return res.status(403).json({ error: 'Hanya pelaksana yang dapat mengajukan penundaan.' });

        const updated = await prisma.personnelAssignment.update({
            where: { id: parseInt(id) },
            data: {
                requestedExtensionDate: new Date(requestedDate),
                extensionReason: reason,
                extensionStatus: 'PENDING'
            }
        });

        // Notify Assigner
        if (assignment.assigner?.phone) {
            const msg = `🔔 *PENGAJUAN PENUNDAAN TUGAS* 🔔\n\n` +
                `Assalamu'alaikum Ustadz ${assignment.assigner.name || ''},\n\n` +
                `Pelaksana *${assignment.assignee.name}* mengajukan penundaan untuk tugas:\n\n` +
                `📌 *Tugas*: ${assignment.title}\n` +
                `📅 *Deadline Awal*: ${new Date(assignment.dueDate).toLocaleDateString('id-ID')}\n` +
                `⏳ *Usulan Baru*: ${new Date(requestedDate).toLocaleDateString('id-ID')}\n` +
                `📝 *Alasan*: ${reason}\n\n` +
                `Mohon segera tinjau pengajuan ini di aplikasi Manajemen Aset. Syukron.`;

            try { await whatsappService.sendMessage(assignment.assigner.phone, msg); } catch (e) { }
        }

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.handleExtension = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // APPROVED or REJECTED
        const { role, id: userId } = req.user;

        const assignment = await prisma.personnelAssignment.findUnique({
            where: { id: parseInt(id) },
            include: { assignee: true, assigner: true }
        });

        if (!assignment) return res.status(404).json({ error: 'Penugasan tidak ditemukan' });

        // Permission: Assigner or Admin
        if (assignment.assignerId !== userId && !['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT'].includes(role)) {
            return res.status(403).json({ error: 'Anda tidak memiliki hak untuk memproses pengajuan ini.' });
        }

        const isApproved = status === 'APPROVED';
        const updatedData = { extensionStatus: status };

        if (isApproved && assignment.requestedExtensionDate) {
            updatedData.dueDate = assignment.requestedExtensionDate;
        }

        const updated = await prisma.personnelAssignment.update({
            where: { id: parseInt(id) },
            data: updatedData
        });

        // Notify Assignee
        if (assignment.assignee?.phone) {
            const statusIcon = isApproved ? '✅' : '❌';
            const statusText = isApproved ? 'DISETUJUI' : 'DITOLAK';
            const msg = `${statusIcon} *STATUS PENUNDAAN TUGAS* ${statusIcon}\n\n` +
                `Assalamu'alaikum Ustadz ${assignment.assignee.name},\n\n` +
                `Pengajuan penundaan untuk tugas *${assignment.title}* telah *${statusText}*.\n\n` +
                (isApproved
                    ? `📅 *Deadline Baru*: ${new Date(assignment.requestedExtensionDate).toLocaleDateString('id-ID')}\n`
                    : `⚠️ Mohon tetap selesaikan sesuai deadline awal: ${new Date(assignment.dueDate).toLocaleDateString('id-ID')}\n`) +
                `\nMohon dicek kembali di aplikasi Manajemen Aset. Syukron.`;

            try { await whatsappService.sendMessage(assignment.assignee.phone, msg); } catch (e) { }
        }

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- RECURRING / ROUTINE TASKS ---

exports.getRoutines = async (req, res) => {
    try {
        const routines = await prisma.personnelRoutine.findMany({
            include: {
                assignee: { select: { name: true } },
                assigner: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(routines);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createRoutine = async (req, res) => {
    const { title, description, assigneeId, category, priority, location, items, frequency, dayOfWeek, dayOfMonth } = req.body;
    const user = req.user;

    try {
        const routine = await prisma.personnelRoutine.create({
            data: {
                assignerId: user.id,
                assigneeId: parseInt(assigneeId),
                title,
                description,
                category: category || 'UMUM',
                priority: priority || 'MEDIUM',
                location: location || null,
                items: items || [],
                frequency,
                dayOfWeek: dayOfWeek !== undefined ? parseInt(dayOfWeek) : null,
                dayOfMonth: dayOfMonth !== undefined ? parseInt(dayOfMonth) : null
            }
        });
        res.json(routine);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateRoutine = async (req, res) => {
    const { id } = req.params;
    const { title, description, assigneeId, category, priority, location, items, frequency, dayOfWeek, dayOfMonth, isActive } = req.body;

    try {
        const updated = await prisma.personnelRoutine.update({
            where: { id: parseInt(id) },
            data: {
                title,
                description,
                assigneeId: assigneeId ? parseInt(assigneeId) : undefined,
                category,
                priority,
                location,
                items,
                frequency,
                dayOfWeek: dayOfWeek !== undefined ? parseInt(dayOfWeek) : undefined,
                dayOfMonth: dayOfMonth !== undefined ? parseInt(dayOfMonth) : undefined,
                isActive
            }
        });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteRoutine = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.personnelRoutine.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Jadwal rutin berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Internal Logic to Generate Assignments from Routines
 * Called by scheduler.js
 */
exports.generateRoutineTasks = async () => {
    console.log('[Routine Task] Generating daily tasks...');
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0-6 (Sun-Sat)
    const dayOfMonth = today.getDate(); // 1-31

    try {
        const routines = await prisma.personnelRoutine.findMany({
            where: { isActive: true }
        });

        for (const routine of routines) {
            let shouldGenerate = false;

            if (routine.frequency === 'DAILY') {
                shouldGenerate = true;
            } else if (routine.frequency === 'WEEKLY' && routine.dayOfWeek === dayOfWeek) {
                shouldGenerate = true;
            } else if (routine.frequency === 'MONTHLY' && routine.dayOfMonth === dayOfMonth) {
                shouldGenerate = true;
            }

            if (shouldGenerate) {
                // Check if already generated today
                if (routine.lastGenerated && new Date(routine.lastGenerated).toDateString() === today.toDateString()) {
                    continue;
                }

                const assignment = await prisma.personnelAssignment.create({
                    data: {
                        assignerId: routine.assignerId,
                        assigneeId: routine.assigneeId,
                        title: `[RUTIN] ${routine.title}`,
                        description: routine.description,
                        category: routine.category,
                        priority: routine.priority,
                        location: routine.location,
                        items: routine.items || [],
                        routineId: routine.id,
                        startDate: today,
                        dueDate: new Date(new Date().setHours(23, 59, 59)),
                        status: 'PENDING'
                    },
                    include: { assignee: true, assigner: true }
                });

                await prisma.personnelRoutine.update({
                    where: { id: routine.id },
                    data: { lastGenerated: today }
                });

                // Notify WA
                if (assignment.assignee?.phone) {
                    const checklist = Array.isArray(routine.items)
                        ? routine.items.map((it, idx) => `${idx + 1}. ${it.text}`).join('\n')
                        : '';

                    const msg = `*Bismillah*\n\n` +
                        `Telah masuk *TUGAS RUTIN* otomatis Dengan Rinciannya:\n\n` +
                        `📌 *Judul* : ${routine.title}\n` +
                        `📅 *Deadline* : Hari ini (23:59)\n` +
                        `👤 *Pemberi Tugas* : ${assignment.assigner?.name || 'Sistem'}\n\n` +
                        `*Deskripsi* :\n${checklist || routine.description}\n\n` +
                        `Mohon bantuan untuk segera dilaksanakan ya Ustadz. Semangat!`;

                    try { await whatsappService.sendMessage(assignment.assignee.phone, msg); } catch (e) { }
                }
            }
        }
    } catch (err) {
        console.error('[Routine Task] Sync Error:', err.message);
    }
};

// --- KPI & PERFORMANCE ---

exports.getKPILeaderboard = async (req, res) => {
    try {
        const { month, year } = req.query;
        const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
        const targetYear = year ? parseInt(year) : new Date().getFullYear();

        // [SEC] Authorization Check: Only Kabid Sarpras or Tech Admins
        const userId = req.user.id;
        const currentUser = await prisma.user.findUnique({ where: { id: userId } });

        const isKabidSarpras = currentUser?.position?.toLowerCase().includes('kepala bidang') &&
            currentUser?.position?.toLowerCase().includes('sarana dan prasarana');
        const isTechAdmin = ['SUPER_ADMIN', 'BIDANG_IT'].includes(currentUser?.role);

        if (!isKabidSarpras && !isTechAdmin) {
            return res.status(403).json({ error: 'Akses ditolak. Fitur ini hanya untuk Kepala Bidang Sarana dan Prasarana.' });
        }

        // Start and end of specified month
        const startDate = new Date(targetYear, targetMonth - 1, 1);
        const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

        // Get all staff from Sarpras (Exact 5 Categories)
        const staff = await prisma.user.findMany({
            where: {
                OR: [
                    { position: { contains: 'Sarana dan Prasarana' } },
                    { position: { contains: 'Manajemen Aset' } },
                    { position: { contains: 'Gudang dan Logistik' } },
                    { position: { contains: 'Teknisi' } },
                    { position: { contains: 'Keuangan dan Administrasi' } }
                ]
            },
            select: { id: true, name: true, position: true, unitId: true }
        });

        const leaderboard = [];

        for (const s of staff) {
            const assignments = await prisma.personnelAssignment.findMany({
                where: {
                    assigneeId: s.id,
                    createdAt: { gte: startDate, lte: endDate }
                }
            });

            const total = assignments.length;
            const completed = assignments.filter(a => a.status === 'COMPLETED').length;
            const punctual = assignments.filter(a => a.status === 'COMPLETED' && a.actualCompletionDate <= a.dueDate).length;

            // Report Count (Daily Reports)
            const reports = await prisma.personnelReport.findMany({
                where: {
                    userId: s.id,
                    type: 'DAILY',
                    date: { gte: startDate, lte: endDate }
                }
            });
            const reportCount = reports.length;

            // Scoring Logic
            // 1. Completion Rate (0-100)
            const completionRate = total > 0 ? (completed / total) * 100 : 0;
            // 2. Punctuality Rate (0-100)
            const punctualityRate = completed > 0 ? (punctual / completed) * 100 : 0;
            // 3. Report Rate (Target 20 reports/month)
            const reportRate = Math.min((reportCount / 20) * 100, 100);

            const averageScore = (completionRate * 0.4) + (punctualityRate * 0.4) + (reportRate * 0.2);

            let grade = 'D';
            if (averageScore >= 85) grade = 'A';
            else if (averageScore >= 70) grade = 'B';
            else if (averageScore >= 50) grade = 'C';

            leaderboard.push({
                userId: s.id,
                name: s.name,
                position: s.position,
                stats: { total, completed, punctual, reports: reportCount },
                scores: {
                    completion: Math.round(completionRate),
                    punctuality: Math.round(punctualityRate),
                    report: Math.round(reportRate)
                },
                averageScore: Math.round(averageScore * 10) / 10,
                grade
            });
        }

        // Sort by score
        leaderboard.sort((a, b) => b.averageScore - a.averageScore);

        res.json({
            period: { month: targetMonth, year: targetYear },
            leaderboard
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
