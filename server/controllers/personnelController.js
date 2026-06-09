const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const whatsappService = require('../services/whatsappService');
const { sendPushToUser, sendPushToKabid } = require('../services/pushService');
const { createNotification } = require('./notificationController');
const aiService = require('../services/aiService');

// Helper to check if user belongs to 'Sarana dan Prasarana' unit
const isSarprasUnit = async (unitId) => {
    if (!unitId) return false;
    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    return unit && unit.name.toLowerCase().includes('sarana dan prasarana');
};

// Helper to sync personnel plan to SarprasCalendarEvent
const syncPlanToCalendar = async (report, user) => {
    try {
        const isPlan = report.metadata?.isPlan;
        if (!isPlan) return;

        // Skip if no title or start dates
        if (!report.metadata?.title || !report.metadata?.startDate) return;

        const title = `[RENCANA: ${user.name || user.username}] ${report.metadata.title}`;

        let itemsDesc = '';
        if (report.metadata.items && Array.isArray(report.metadata.items)) {
            itemsDesc = report.metadata.items.map((it, idx) => `${idx + 1}. ${it.activity || it.text || it.name}`).join('\n');
        }
        const description = `Referensi Rencana ID: ${report.id}\n${report.content || ''}\n\nRincian:\n${itemsDesc}`;

        // Map Category (Ensure it fits common Calendar Categories or default to Kerja)
        const calendarCategory = ['Pemeliharaan', 'Pengadaan', 'Kebersihan', 'Rapat', 'Deadline', 'Kerja'].includes(report.category)
            ? report.category
            : 'Kerja';

        const startDate = new Date(report.metadata.startDate);
        const endDate = report.metadata.endDate ? new Date(report.metadata.endDate) : startDate;

        if (report.metadata.calendarEventId) {
            // Update existing calendar event
            await prisma.sarprasCalendarEvent.update({
                where: { id: parseInt(report.metadata.calendarEventId) },
                data: {
                    title,
                    description,
                    category: calendarCategory,
                    date: startDate,
                    endDate: endDate
                }
            });
            console.log(`[Sync] Updated calendar event ${report.metadata.calendarEventId} for plan ${report.id}`);
        } else {
            // Create new calendar event
            const calEvent = await prisma.sarprasCalendarEvent.create({
                data: {
                    title,
                    description,
                    category: calendarCategory,
                    date: startDate,
                    endDate: endDate,
                    createdById: user.id,
                    pics: {
                        connect: [{ id: user.id }]
                    }
                }
            });

            // Update report metadata with calendarEventId
            const newMetadata = { ...report.metadata, calendarEventId: calEvent.id };
            await prisma.personnelReport.update({
                where: { id: report.id },
                data: { metadata: newMetadata }
            });

            // Update local memory so returned data is consistent (if needed)
            report.metadata = newMetadata;
            console.log(`[Sync] Created calendar event ${calEvent.id} for plan ${report.id}`);
        }
    } catch (err) {
        console.error('[Sync Error] Failed to sync plan to calendar:', err.message);
    }
};

// Auto-log activity to daily report (called when updating plans/tasks/routines)
// Auto-log activity to daily report (called when updating plans/tasks/routines)
const autoLogActivity = async (userId, source, sourceId, sourceTitle, description, percentage) => {
    try {
        const now = new Date();
        const todayStart = new Date(now.setHours(0, 0, 0, 0));
        const todayEnd = new Date(now.setHours(23, 59, 59, 999));
        const currentTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

        // Check if an entry for this item already exists for today
        const existingLog = await prisma.personnelReport.findFirst({
            where: {
                userId: parseInt(userId),
                type: 'DAILY',
                category: 'UMUM',
                date: {
                    gte: todayStart,
                    lte: todayEnd
                },
                metadata: {
                    path: ['sourceId'],
                    equals: sourceId
                }
            }
        });

        if (existingLog) {
            // Update existing log
            await prisma.personnelReport.update({
                where: { id: existingLog.id },
                data: {
                    content: description,
                    metadata: {
                        ...existingLog.metadata,
                        progressPercentage: percentage,
                        endTime: currentTime,
                        timestamp: new Date().toISOString()
                    }
                }
            });
        } else {
            // Create new log
            await prisma.personnelReport.create({
                data: {
                    userId: parseInt(userId),
                    type: 'DAILY',
                    category: 'UMUM',
                    content: description,
                    date: new Date(),
                    metadata: {
                        autoLog: true,
                        source,
                        sourceId,
                        sourceTitle,
                        progressPercentage: percentage,
                        startTime: currentTime,
                        endTime: currentTime,
                        timestamp: new Date().toISOString()
                    }
                }
            });
        }
    } catch (err) {
        console.error('[AutoLog] Failed:', err.message);
    }
};

// --- REPORTS ---

exports.updateReport = async (req, res) => {
    const { id } = req.params;
    const { type, category, content, date, details, metadata } = req.body;
    const user = req.user;

    try {
        const report = await prisma.personnelReport.findUnique({ where: { id: parseInt(id) } });

        if (!report) {
            return res.status(404).json({ error: 'Data tidak ditemukan' });
        }

        if (report.userId !== user.id && !['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT'].includes(user.role)) {
            return res.status(403).json({ error: 'Akses ditolak. Anda hanya dapat mengedit rencana Anda sendiri.' });
        }

        const updated = await prisma.personnelReport.update({
            where: { id: parseInt(id) },
            data: {
                type,
                category: category || report.category,
                content,
                metadata: metadata || null,
                date: date ? new Date(date) : report.date,
                details
            }
        });

        // Sync to calendar
        await syncPlanToCalendar(updated, user);

        // Auto-log plan updates to daily report
        if (metadata?.isPlan && metadata?.items) {
            const planTitle = metadata.title || 'Rencana Kerja';
            const items = metadata.items || [];
            const avgPct = items.length > 0 ? Math.round(items.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / items.length) : 0;
            const done = items.filter(i => i.percentage === 100 || i.status === 'SELESAI').length;

            autoLogActivity(
                user.id,
                'RENCANA',
                parseInt(id),
                planTitle,
                `Update rencana: ${planTitle} - Progres ${avgPct}% (${done}/${items.length} item selesai)`,
                avgPct
            );
        }

        res.json({ message: 'Laporan berhasil diperbarui', data: updated });
    } catch (error) {
        console.error("Update Report Error:", error);
        res.status(500).json({ error: error.message });
    }
};

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

        // Sync to calendar
        await syncPlanToCalendar(report, user);

        // --- AUTOMATIC SYNC TO PLAN (IF APPLICABLE) ---
        if (metadata?.items && Array.isArray(metadata.items)) {
            for (const item of metadata.items) {
                if (item.planId && item.planItemIndex !== undefined) {
                    try {
                        const originalPlan = await prisma.personnelReport.findUnique({
                            where: { id: parseInt(item.planId) }
                        });

                        if (originalPlan && originalPlan.metadata) {
                            const updatedPlanMetadata = { ...originalPlan.metadata };
                            if (updatedPlanMetadata.items && Array.isArray(updatedPlanMetadata.items)) {
                                const idx = parseInt(item.planItemIndex);
                                if (updatedPlanMetadata.items[idx]) {
                                    // Update the item in the original plan
                                    updatedPlanMetadata.items[idx].status = item.status || 'PROSES';
                                    updatedPlanMetadata.items[idx].percentage = parseInt(item.percentage) || 0;

                                    await prisma.personnelReport.update({
                                        where: { id: originalPlan.id },
                                        data: { metadata: updatedPlanMetadata }
                                    });
                                    console.log(`[Sync] Updated plan ${originalPlan.id} item ${idx}`);
                                }
                            }
                        }
                    } catch (syncErr) {
                        console.error('[Sync Error] Failed to update plan:', syncErr.message);
                    }
                }
            }
        }

        res.json({ message: 'Laporan berhasil disimpan', data: report });
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
        // - SUPER_ADMIN, KEPALA_BIDANG, and ADMIN_ASET (within Sarpras) can see all reports or filter by staff.
        // - All other roles see ONLY their own.
        const canSeeAll = user.role === 'SUPER_ADMIN' ||
            user.role === 'KEPALA_BIDANG' ||
            (user.role === 'ADMIN_ASET' && await isSarprasUnit(user.unitId));

        if (canSeeAll) {
            if (userId && userId !== 'all' && userId !== 'ALL') {
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
            const take = parseInt(limit);
            const page = parseInt(req.query.page) || 1;
            queryOptions.take = take;
            queryOptions.skip = (page - 1) * take;
        }

        const [reports, total] = await Promise.all([
            prisma.personnelReport.findMany(queryOptions),
            prisma.personnelReport.count({ where })
        ]);

        res.json({
            data: reports,
            total,
            page: parseInt(req.query.page) || 1,
            limit: limit === 'all' ? total : parseInt(limit),
            totalPages: limit === 'all' ? 1 : Math.ceil(total / parseInt(limit))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};



// --- ASSIGNMENTS ---

exports.createAssignment = async (req, res) => {
    const { assigneeId, title, description, startDate, dueDate, category, location, items, addToCalendar, priority, photos } = req.body;
    const user = req.user;

    try {
        // Initialize notes with initial photos if provided
        let notes = null;
        if (photos && Array.isArray(photos) && photos.length > 0) {
            notes = JSON.stringify({
                text: description || '',
                history: [{
                    date: new Date().toISOString(),
                    percentage: 0,
                    note: 'Dokumentasi Awal Penugasan',
                    photos: photos
                }]
            });
        }

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
                items: items || [],
                notes: notes
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

                    const msg = `Bismillah.\n\n` +
                        `Telah masuk permintaan dari Kepala Bidang Sarana dan Prasarana Dengan Rinciannya:\n\n` +
                        `📌 *Judul* : ${title}\n` +
                        `📅 *Deadline* : ${dueDate ? new Date(dueDate).toLocaleDateString('id-ID') : '-'}\n` +
                        `👤 *Pemberi Tugas* : ${assigner?.name || assigner?.username || 'Admin'}\n\n` +
                        `*Deskripsi* :\n${checklist || description}\n\n` +
                        `Mohon bantuan untuk segera dilaksanakan ya Ustadz`;

                    await whatsappService.sendMessage(assignee.phone, msg);
                }

                // Push Notification to Assignee
                await sendPushToUser(
                    parseInt(assigneeId),
                    '📌 Tugas Baru Masuk',
                    `${title} — Deadline: ${dueDate ? new Date(dueDate).toLocaleDateString('id-ID') : 'Belum ditentukan'}`,
                    '/personalia'
                );

                // In-App Notification
                await createNotification(
                    parseInt(assigneeId),
                    'Penugasan Baru',
                    `${assigner?.name || 'Admin'} memberikan tugas: ${title}`,
                    'INFO',
                    '/personalia'
                );
            } catch (err) {
                console.error('WA Personnel Assignment Error:', err);
            }
        })();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAssignments = async (req, res) => {
    const { limit, status, userId, staffId } = req.query;
    const user = req.user;

    try {
        if (!['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT'].includes(user.role) && !await isSarprasUnit(user.unitId)) {
            return res.status(403).json({ error: 'Akses ditolak.' });
        }

        const where = {};

        // Role-based visibility
        const canSeeAllAssignments = ['SUPER_ADMIN', 'BIDANG_IT', 'KEPALA_BIDANG'].includes(user.role);

        if (!canSeeAllAssignments) {
            where.OR = [
                { assigneeId: user.id },
                { assignerId: user.id }
            ];
        }

        // Apply filters if provided
        if (status && status !== 'ALL') {
            where.status = status;
        }

        const targetUserId = userId || staffId;
        if (targetUserId && targetUserId !== 'ALL') {
            where.assigneeId = parseInt(targetUserId);
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
            const take = parseInt(limit);
            const page = parseInt(req.query.page) || 1;
            queryOptions.take = take;
            queryOptions.skip = (page - 1) * take;
        }

        const [assignments, total] = await Promise.all([
            prisma.personnelAssignment.findMany(queryOptions),
            prisma.personnelAssignment.count({ where })
        ]);

        res.json({
            data: assignments,
            total,
            page: parseInt(req.query.page) || 1,
            limit: limit === 'all' ? total : parseInt(limit),
            totalPages: limit === 'all' ? 1 : Math.ceil(total / (parseInt(limit) || 1))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateAssignmentStatus = async (req, res) => {
    const { id } = req.params;
    const { status, progressPercentage, notes, items, title, description, photos } = req.body;
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
        if (title) data.title = title;
        if (description !== undefined) data.description = description;

        // Handle logical items/checklist update
        if (items) {
            data.items = items;
            // Calculate progress based on sub-items
            if (Array.isArray(items) && items.length > 0) {
                const totalPct = items.reduce((acc, curr) => acc + (parseInt(curr.percentage) || (curr.status === 'COMPLETED' || curr.isDone ? 100 : 0)), 0);
                const percentage = Math.round(totalPct / items.length);
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

        if (photos && Array.isArray(photos) && photos.length > 0) {
            let currentNotes = { text: description || assignment.description || '', history: [] };
            if (assignment.notes) {
                try {
                    const p = JSON.parse(assignment.notes);
                    if (p && Array.isArray(p.history)) currentNotes = p;
                } catch (e) {
                    currentNotes.text = assignment.notes;
                }
            }
            currentNotes.history.push({
                date: new Date().toISOString(),
                percentage: data.progressPercentage !== undefined ? data.progressPercentage : (assignment.progressPercentage || 0),
                note: 'Dokumentasi Tambahan',
                photos
            });
            data.notes = JSON.stringify(currentNotes);
        } else if (notes !== undefined) {
            // Only update notes if it's explicitly provided and likely a JSON history 
            // (or if we trust the caller)
            data.notes = notes;
        }

        const updated = await prisma.personnelAssignment.update({
            where: { id: parseInt(id) },
            data
        });

        res.json(updated);

        // Auto-log to daily report
        const logSource = assignment.routineId ? 'RUTINITAS' : 'TUGAS';
        const pct = updated.progressPercentage || 0;
        const logDesc = pct === 100
            ? `Menyelesaikan ${logSource.toLowerCase()}: ${assignment.title.replace('[RUTIN] ', '')}`
            : `Update ${logSource.toLowerCase()}: ${assignment.title.replace('[RUTIN] ', '')} → ${pct}%`;
        autoLogActivity(user.id, logSource, assignment.id, assignment.title.replace('[RUTIN] ', ''), logDesc, pct);
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
                    { position: { contains: 'Keuangan dan Administrasi' } },
                    { position: { contains: 'Kendaraan' } }
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

        // Enrich with current trips and total trips
        const enrichedDrivers = await Promise.all(drivers.map(async (d) => {
            // Find active vehicle booking
            const activeVehicleTrip = await prisma.vehicleBooking.findFirst({
                where: { driverId: d.id, status: 'BERLANGSUNG' },
                include: { vehicle: true }
            });
            // Find active bus booking (assuming CONFIRMED and within dates)
            const now = new Date();
            const activeBusTrip = await prisma.busBooking.findFirst({
                where: {
                    driverId: d.id,
                    OR: [
                        { status: 'CONFIRMED', startDate: { lte: now }, endDate: { gte: now } },
                        { status: 'BERLANGSUNG' } // Just in case
                    ]
                },
                include: { vehicle: true }
            });

            // Count total completed trips
            const totalVehicleTrips = await prisma.vehicleBooking.count({ where: { driverId: d.id, status: 'COMPLETED' } });
            const totalBusTrips = await prisma.busBooking.count({ where: { driverId: d.id, status: 'COMPLETED' } });

            // Determine dynamic status
            let currentStatus = d.driverStatus || 'AVAILABLE';
            let currentTrip = null;

            if (activeVehicleTrip) {
                currentStatus = 'ON_TRIP';
                currentTrip = { type: 'VEHICLE', ...activeVehicleTrip };
            } else if (activeBusTrip) {
                currentStatus = 'ON_TRIP';
                currentTrip = { type: 'BUS', ...activeBusTrip };
            }

            // Sync dynamic status to db if needed, or just return dynamically
            return {
                ...d,
                dynamicStatus: currentStatus,
                currentTrip,
                totalTrips: totalVehicleTrips + totalBusTrips
            };
        }));

        res.json(enrichedDrivers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateDriverInfo = async (req, res) => {
    const { id } = req.params;
    const { licenseNumber, licenseType, licenseExpiry, driverStatus } = req.body;
    const userRole = req.user.role;

    try {
        if (!['SUPER_ADMIN', 'BIDANG_IT', 'ADMIN_ASET'].includes(userRole)) {
            return res.status(403).json({ error: 'Akses ditolak.' });
        }

        const data = {};
        if (licenseNumber !== undefined) data.licenseNumber = licenseNumber;
        if (licenseType !== undefined) data.licenseType = licenseType;
        if (licenseExpiry !== undefined) data.licenseExpiry = licenseExpiry ? new Date(licenseExpiry) : null;
        if (driverStatus !== undefined) data.driverStatus = driverStatus;

        const updated = await prisma.user.update({
            where: { id: parseInt(id) },
            data
        });

        res.json({ message: 'Informasi driver berhasil diperbarui', data: updated });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getDriverHistory = async (req, res) => {
    const { id } = req.params;
    const { month, year } = req.query; // optional pagination/filters

    try {
        let vehicleWhere = { driverId: parseInt(id) };
        let busWhere = { driverId: parseInt(id) };

        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);
            vehicleWhere.startDate = { gte: startDate, lte: endDate };
            busWhere.startDate = { gte: startDate, lte: endDate };
        }

        const vehicleTrips = await prisma.vehicleBooking.findMany({
            where: vehicleWhere,
            include: { vehicle: true },
            orderBy: { startDate: 'desc' }
        });

        const busTrips = await prisma.busBooking.findMany({
            where: busWhere,
            include: { vehicle: true },
            orderBy: { startDate: 'desc' }
        });

        // Combine and sort
        const combined = [
            ...vehicleTrips.map(t => ({ ...t, tripType: 'VEHICLE' })),
            ...busTrips.map(t => ({ ...t, tripType: 'BUS' }))
        ].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

        res.json(combined);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getDriverViolations = async (req, res) => {
    try {
        const violations = await prisma.driverViolation.findMany({
            include: { driver: { select: { name: true, nip: true } } },
            orderBy: { date: 'desc' }
        });
        res.json(violations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createDriverViolation = async (req, res) => {
    const { driverId, date, category, description, sanction } = req.body;
    try {
        // Hanya Admin / Super Admin
        if (!['SUPER_ADMIN', 'BIDANG_IT', 'ADMIN_ASET'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Akses ditolak.' });
        }

        const newViolation = await prisma.driverViolation.create({
            data: {
                driverId: parseInt(driverId),
                date: new Date(date),
                category,
                description,
                sanction
            }
        });
        res.json({ message: 'Pelanggaran berhasil ditambahkan', data: newViolation });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteDriverViolation = async (req, res) => {
    const { id } = req.params;
    try {
        if (!['SUPER_ADMIN', 'BIDANG_IT', 'ADMIN_ASET'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Akses ditolak.' });
        }
        await prisma.driverViolation.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Pelanggaran berhasil dihapus' });
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
                nip: true,
                phone: true,
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
                        { position: { contains: 'Keuangan dan Administrasi' } },
                        { position: { contains: 'Kendaraan' } }
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
                routineId: null,
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
                const msg = `Bismillah.\n` + `${urgencyMsg}\n\n` +
                    `Assalamu'alaikum Ustadz ${a.assignee.name || ''},\n\n` +
                    `Mohon izin mengingatkan kembali untuk tugas berikut:\n\n` +
                    `📌 *Judul* : ${a.title}\n` +
                    `📅 *Deadline* : ${new Date(a.dueDate).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}\n` +
                    `📊 *Progres* : ${a.progressPercentage}%\n` +
                    `👤 *Pemberi Tugas* : ${a.assigner?.name || 'Admin'}\n\n` +
                    `Mohon kesediaannya untuk segera diselesaikan atau diupdate progresnya di aplikasi Sarpras ya Ustadz. Syukron Jazakumullahu Khairan.`;

                try {
                    await whatsappService.sendMessage(a.assignee.phone, msg);

                    await prisma.personnelAssignment.update({
                        where: { id: a.id },
                        data: { lastReminderSent: now }
                    });
                    console.log(`[Personnel Assignment] SUCCESS: Reminder (${type}) sent to ${a.assignee.name} for: ${a.title}`);

                    // Push Notification
                    const pushTitle = type === 'OVERDUE' ? '⚠️ Tugas Terlambat' : type === 'TODAY' ? '🔔 Deadline Hari Ini' : '🗓️ Deadline Besok';
                    await sendPushToUser(a.assigneeId, pushTitle, `${a.title} — Progres: ${a.progressPercentage}%`, '/personalia');
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

            try {
                await waTemplateService.send('PERSONNEL_ASSIGNMENT_DONE', assignment.assigner.phone, {
                    nama_assigner: assignment.assigner.name || '',
                    nama_pelaksana: assignment.assignee.name || '',
                    judul_tugas: assignment.title,
                    deadline_awal: new Date(assignment.dueDate).toLocaleDateString('id-ID'),
                    usulan_baru: new Date(requestedDate).toLocaleDateString('id-ID'),
                    alasan: reason
                }, msg);
            } catch (e) { }
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

            try {
                await waTemplateService.send('PERSONNEL_ASSIGNMENT_REJECTED', assignment.assignee.phone, {
                    nama_pegawai: assignment.assignee.name,
                    judul_tugas: assignment.title,
                    status_text: statusText,
                    deadline_info: isApproved
                        ? `Deadline Baru: ${new Date(assignment.requestedExtensionDate).toLocaleDateString('id-ID')}`
                        : `Mohon tetap selesaikan sesuai deadline awal: ${new Date(assignment.dueDate).toLocaleDateString('id-ID')}`
                }, msg);
            } catch (e) { }
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
                assigneeId: assigneeId ? parseInt(assigneeId) : user.id,
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
                // Skip Saturday (6) and Sunday (0)
                shouldGenerate = (dayOfWeek !== 0 && dayOfWeek !== 6);
            } else if (routine.frequency === 'WEEKLY' && routine.dayOfWeek === dayOfWeek) {
                shouldGenerate = true;
            } else if (routine.frequency === 'MONTHLY' && routine.dayOfMonth === dayOfMonth) {
                // Skip Saturday (6) and Sunday (0)
                shouldGenerate = (dayOfWeek !== 0 && dayOfWeek !== 6);
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

                // WhatsApp notification for routine generation disabled per user request
                // (Only visible in app to reduce daily notification noise)
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

        // [SEC] Authorization Check: Refetch user to ensure fresh data
        const currentUser = await prisma.user.findUnique({ where: { id: req.user.id } });
        const userPosition = (currentUser?.position || '').toLowerCase();

        // Lenient matching: Must have "Kepala Bidang" AND ("Sarana dan Prasarana" OR "Sarpras")
        const isKabidTitle = userPosition.includes('kepala bidang');
        const isSarprasUnit = userPosition.includes('sarana dan prasarana') || userPosition.includes('sarpras');

        // TEMPORARY: Allow role-based access if position check fails but it's a known KEPALA_BIDANG
        const isAdminRole = currentUser?.role === 'SUPER_ADMIN';
        const isAuthorized = isAdminRole || (isKabidTitle && isSarprasUnit) || currentUser?.role === 'KEPALA_BIDANG';

        if (!isAuthorized) {
            console.warn(`[AUTH-KPI] Unauthorized: User=${currentUser?.username}, Role=${currentUser?.role}, Pos=[${currentUser?.position}]`);
            return res.status(403).json({
                error: `Akses ditolak. Jabatan Anda Terdeteksi: "${currentUser?.position || 'Kosong'}", Role: "${currentUser?.role}". Silakan hubungi admin untuk update jabatan.`
            });
        }

        // Start and end of specified month
        const startDate = new Date(targetYear, targetMonth - 1, 1);
        const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

        // Get staff: Strictly filter by Sarpras-specific positions to exclude other departments (SDM, K3, etc.)
        const staffWhere = {
            AND: [
                {
                    OR: [
                        { position: { contains: 'Staff Manajemen Aset' } },
                        { position: { contains: 'Staff Kendaraan' } },
                        { position: { contains: 'Staff Teknisi Aset' } },
                        { position: { contains: 'Staff Keuangan dan Administrasi' } },
                        { position: { contains: 'Staff Gudang dan Logistik' } },
                    ]
                },
                {
                    NOT: {
                        OR: [
                            { position: { contains: 'kepala bidang' } },
                            { role: 'SUPER_ADMIN' }
                        ]
                    }
                }
            ]
        };

        const staff = await prisma.user.findMany({
            where: staffWhere,
            select: { id: true, name: true, position: true, unitId: true }
        });

        console.log(`[KPI] Period: ${targetMonth}/${targetYear} | Staff found: ${staff.length} | By user: ${currentUser.username} (unitId: ${currentUser.unitId})`);
        if (staff.length > 0) {
            console.log(`[KPI] Staff list: ${staff.map(s => `${s.name}[${s.position}]`).join(', ')}`);
        }

        const leaderboard = [];

        for (const s of staff) {
            // Get assignments relevant to this period:
            // 1. Created in this month, OR
            // 2. Due in this month, OR
            // 3. Still active (IN_PROGRESS/PENDING) regardless of when created
            const assignments = await prisma.personnelAssignment.findMany({
                where: {
                    assigneeId: s.id,
                    OR: [
                        { dueDate: { gte: startDate, lte: endDate } },
                        { createdAt: { gte: startDate, lte: endDate } },
                        { status: { in: ['IN_PROGRESS', 'PENDING'] } }
                    ]
                }
            });

            // Get plans (Rencana)
            const planReports = await prisma.personnelReport.findMany({
                where: { userId: s.id, type: 'WEEKLY', date: { gte: startDate, lte: endDate } }
            });
            const plans = planReports.filter(r => r.metadata?.isPlan === true);
            let planItemsTotal = 0, planItemsCompleted = 0;
            plans.forEach(p => {
                const items = p.metadata?.items || [];
                planItemsTotal += items.length;
                planItemsCompleted += items.filter(i => i.percentage === 100 || i.status === 'SELESAI').length;
            });

            // Assignment stats: Exclude 'LIBUR' from the denominator so they aren't penalized
            const activeAssignments = assignments.filter(a => a.status !== 'LIBUR');
            const completedAssignments = activeAssignments.filter(a => a.status === 'COMPLETED').length;
            const punctualAssignments = activeAssignments.filter(a =>
                a.status === 'COMPLETED' && a.actualCompletionDate && a.dueDate &&
                new Date(a.actualCompletionDate) <= new Date(a.dueDate)
            ).length;

            // Combined scheduled work score
            const totalScheduled = activeAssignments.length + planItemsTotal;
            const completedScheduled = completedAssignments + planItemsCompleted;
            const scheduledScore = totalScheduled > 0 ? (completedScheduled / totalScheduled) * 100 : 0;
            const punctualityScore = completedAssignments > 0 ? (punctualAssignments / completedAssignments) * 100 : 0;

            // Insidental reports (non-auto, non-plan daily reports)
            // Note: 'AUTO_LOG' is not a valid enum, so filter via metadata in JS
            const dailyReports = await prisma.personnelReport.findMany({
                where: { userId: s.id, type: 'DAILY', date: { gte: startDate, lte: endDate } },
                select: { metadata: true }
            });
            const insidentalCount = dailyReports.filter(r => !r.metadata?.autoLog).length;
            const insidentalScore = Math.min((insidentalCount / 5) * 100, 100);

            // Final: 50% completion + 20% punctuality + 30% insidental
            const averageScore = (scheduledScore * 0.5) + (punctualityScore * 0.2) + (insidentalScore * 0.3);

            let grade = 'D';
            if (averageScore >= 85) grade = 'A';
            else if (averageScore >= 70) grade = 'B';
            else if (averageScore >= 50) grade = 'C';

            leaderboard.push({
                userId: s.id,
                name: s.name,
                position: s.position,
                stats: { total: totalScheduled, completed: completedScheduled, punctual: punctualAssignments, insidentalReports: insidentalCount, planItems: planItemsTotal },
                scores: { completion: Math.round(scheduledScore), punctuality: Math.round(punctualityScore), insidental: Math.round(insidentalScore) },
                averageScore: Math.round(averageScore * 10) / 10,
                grade
            });
        }

        console.log(`[KPI] Leaderboard built: ${leaderboard.length} entries, totalTasks: ${leaderboard.reduce((a, l) => a + l.stats.total, 0)}`);

        // Sort by score
        leaderboard.sort((a, b) => b.averageScore - a.averageScore);

        res.json({
            period: { month: targetMonth, year: targetYear },
            staffCount: staff.length,
            leaderboard
        });
    } catch (error) {
        console.error('[KPI] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
};

/**
 * DAILY SUMMARY OF REPORTS
 * Triggered daily at 20:00
 */
exports.sendDailyPersonnelSummary = async () => {
    console.log(`[${new Date().toLocaleString('id-ID')}] [Personnel] Sending Daily Summary...`);
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    try {
        const reports = await prisma.personnelReport.findMany({
            where: {
                type: 'DAILY',
                date: { gte: startOfToday, lte: endOfToday }
            },
            include: { user: true }
        });

        if (reports.length === 0) {
            console.log('[Personnel] No daily reports found for today.');
            return;
        }

        const kabid = await prisma.user.findFirst({
            where: {
                OR: [
                    { position: 'Kepala Bidang Sarana dan Prasarana' },
                    { role: 'KEPALA_BIDANG' },
                    { position: { contains: 'Kepala Bidang Sarana dan Prasarana' } }
                ]
            }
        });

        if (!kabid?.phone) return;

        // Group by user
        const summary = reports.reduce((acc, r) => {
            const name = r.user.name || r.user.username;
            if (!acc[name]) acc[name] = [];
            acc[name].push(r);
            return acc;
        }, {});

        let summaryText = '';
        for (const [name, userReports] of Object.entries(summary)) {
            summaryText += `👤 *${name}*:\n`;
            userReports.forEach(r => {
                const items = r.metadata?.items || [];
                const completed = items.filter(i => i.status === 'SELESAI').length;
                summaryText += `- ${r.category}: ${items.length} aktivitas (${completed} selesai)\n`;
            });
            summaryText += `\n`;
        }

        let msg = `📊 *RANGKUMAN LAPORAN HARIAN STAF*\n` +
            `📅 *Tanggal* : ${today.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}\n\n` +
            summaryText +
            `_Silakan cek detail lengkapnya di aplikasi Manajemen Aset._`;

        await whatsappService.sendMessage(kabid.phone, msg);
        console.log('[Personnel] Daily Summary sent to Kabid.');

        // Push Notification to Kabid
        await sendPushToKabid(
            '📊 Rangkuman Harian Staf',
            `${Object.keys(summary).length} staf mengirim laporan hari ini. Klik untuk melihat detail.`,
            '/personalia'
        );

        // In-App Notification
        if (kabid?.id) {
            await createNotification(
                kabid.id,
                'Rangkuman Harian',
                `${Object.keys(summary).length} staf mengirim ${reports.length} laporan hari ini`,
                'INFO',
                '/personalia'
            );
        }
    } catch (err) {
        console.error('[Personnel] Daily Summary Error:', err.message);
    }
};

/**
 * WORK PLAN REMINDER (H-0 & OVERDUE)
 * Triggered daily at 08:00
 */
exports.checkPlanDeadlines = async () => {
    console.log(`[${new Date().toLocaleString('id-ID')}] [Personnel Plan] Checking plan deadlines...`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
        const reports = await prisma.personnelReport.findMany({
            where: {
                type: 'WEEKLY'
            },
            include: { user: true }
        });

        // Filter for work plans (metadata.isPlan === true)
        const plans = reports.filter(r => {
            const meta = r.metadata || {};
            return meta.isPlan === true;
        });

        const kabid = await prisma.user.findFirst({
            where: { position: 'Kepala Bidang Sarana dan Prasarana' }
        });

        for (const p of plans) {
            const meta = p.metadata || {};
            if (!meta.startDate || !meta.endDate) continue;

            const start = new Date(meta.startDate);
            const end = new Date(meta.endDate);
            start.setHours(0, 0, 0, 0);
            end.setHours(0, 0, 0, 0);

            let msg = "";
            let type = "";

            // 1. Kick-off day
            if (start.getTime() === today.getTime()) {
                type = "KICKOFF";
                msg = `🗓️ *PENGINGAT: MULAI RENCANA KERJA* 🗓️\n\n` +
                    `Assalamu'alaikum Staf Sarpras,\n\n` +
                    `Bismillah, hari ini adalah jadwal dimulainya Rencana Kerja berikut:\n\n` +
                    `📌 *Judul* : ${meta.title || 'Rencana Kerja'}\n` +
                    `📅 *Periode* : ${new Date(meta.startDate).toLocaleDateString('id-ID')} s/d ${new Date(meta.endDate).toLocaleDateString('id-ID')}\n\n` +
                    `Selamat bertugas, semoga dimudahkan oleh Allah.`;
            } else {
                // 2. Overdue - weekly reminder if not 100%
                const daysPastDeadline = Math.floor((today.getTime() - end.getTime()) / (1000 * 60 * 60 * 24));
                if (daysPastDeadline > 0 && daysPastDeadline % 7 === 1) {
                    const items = meta.items || [];
                    const isAllDone = items.every(it => it.percentage === 100);
                    if (!isAllDone) {
                        type = "OVERDUE";
                        msg = `⚠️ *PERINGATAN: RENCANA KERJA MELEWATI BATAS* ⚠️\n\n` +
                            `Assalamu'alaikum Staf Sarpras,\n\n` +
                            `Mohon izin mengingatkan bahwa batas waktu pelaksanaan Rencana Kerja berikut telah terlewati:\n\n` +
                            `📌 *Judul* : ${meta.title || 'Rencana Kerja'}\n` +
                            `📅 *Deadline* : ${new Date(meta.endDate).toLocaleDateString('id-ID')}\n\n` +
                            `Mohon segera diselesaikan rincian kegiatannya di aplikasi ya. Syukron.`;
                    }
                }
            }

            if (msg) {
                // Send to Staff via WA
                if (p.user?.phone) {
                    try {
                        await waTemplateService.send('PERSONNEL_RATING_NEW', p.user.phone, {
                            nama_staf: p.user.name || p.user.username,
                            judul_rencana: meta.title || 'Rencana Kerja',
                            periode: `${new Date(meta.startDate).toLocaleDateString('id-ID')} s/d ${new Date(meta.endDate).toLocaleDateString('id-ID')}`,
                            deadline: new Date(meta.endDate).toLocaleDateString('id-ID'),
                            pesan_peringatan: msg
                        }, msg);
                    } catch (e) { }
                }
                // Send to Kabid via WA
                if (kabid?.phone) {
                    const kabidMsg = `*LAPORAN PENGINGAT RENCANA KERJA*\n\n` +
                        `*Kepada*: ${p.user.name || p.user.username}\n` +
                        msg;
                    try {
                        await waTemplateService.send('PERSONNEL_RATING_NEW_KABID', kabid.phone, {
                            nama_staf: p.user.name || p.user.username,
                            pesan_peringatan: msg
                        }, kabidMsg);
                    } catch (e) { }
                }

                // Push Notification to Staff
                const pushTitle = type === 'KICKOFF' ? '🗓️ Rencana Kerja Dimulai' : '⚠️ Rencana Kerja Terlambat';
                const pushBody = type === 'KICKOFF'
                    ? `Hari ini jadwal dimulainya: ${meta.title || 'Rencana Kerja'}`
                    : `Batas waktu ${meta.title || 'Rencana Kerja'} telah lewat!`;
                await sendPushToUser(p.userId, pushTitle, pushBody, '/personalia');

                // Push Notification to Kabid
                await sendPushToKabid(pushTitle, `${p.user.name}: ${pushBody}`, '/personalia');

                // In-App Notifications
                await createNotification(p.userId, pushTitle, pushBody, type === 'OVERDUE' ? 'WARNING' : 'INFO', '/personalia');
                if (kabid?.id) {
                    await createNotification(kabid.id, pushTitle, `${p.user.name}: ${pushBody}`, type === 'OVERDUE' ? 'WARNING' : 'INFO', '/personalia');
                }
            }
        }
    } catch (err) {
        console.error('[Personnel] Weekly Report Check Error:', err.message);
    }
};

/**
 * REVIEW A PERSONNEL REPORT (KABID ONLY)
 */
exports.reviewReport = async (req, res) => {
    const { id } = req.params;
    const { status, feedback, verifiedItemIndices } = req.body;
    const user = req.user;

    try {
        // Only SUPER_ADMIN and KABID position can review
        const isKabid = user.role === 'SUPER_ADMIN' || user.position === 'Kepala Bidang Sarana dan Prasarana';
        if (!isKabid) {
            return res.status(403).json({ error: 'Hanya Kepala Bidang yang dapat memberikan tinjauan.' });
        }

        const report = await prisma.personnelReport.findUnique({
            where: { id: parseInt(id) },
            include: { user: true }
        });

        if (!report) return res.status(404).json({ error: 'Laporan tidak ditemukan.' });

        // Update item-level verification in metadata
        let items = report.metadata?.items || [];
        if (Array.isArray(verifiedItemIndices)) {
            items = items.map((it, idx) => ({
                ...it,
                verified: verifiedItemIndices.includes(idx)
            }));
        }

        // Update metadata with review data
        const updatedMetadata = {
            ...(report.metadata || {}),
            items,
            review: {
                status: status || 'VERIFIED',
                feedback: feedback || '',
                reviewedAt: new Date().toISOString(),
                reviewedById: user.id,
                reviewedByName: user.name || user.username
            }
        };

        const updatedReport = await prisma.personnelReport.update({
            where: { id: report.id },
            data: { metadata: updatedMetadata },
            include: { user: { select: { name: true, phone: true } } }
        });

        // 1. IN-APP NOTIFICATION (Lonceng - Always)
        const statusLabelShort = status === 'VERIFIED' ? '✅ Disetujui' : '⚠️ Butuh Coaching';
        await createNotification(
            report.userId,
            `Tinjauan Laporan: ${statusLabelShort}`,
            `Laporan harian Anda (${new Date(report.date).toLocaleDateString('id-ID')}) telah diperiksa oleh Kabid.`,
            status === 'VERIFIED' ? 'SUCCESS' : 'WARNING',
            `/staff-performance?tab=${report.type === 'WEEKLY' ? 'RENCANA' : 'LAPORAN'}`
        );

        // 2. WHATSAPP NOTIFICATION (ONLY if NEEDS_COACHING)
        const staffPhone = updatedReport.user?.phone;
        if (staffPhone && status === 'NEEDS_COACHING') {
            const waMsg = `📢 *TINJAUAN LAPORAN ANDA*\n\n` +
                `Assalamu'alaikum ${updatedReport.user.name},\n\n` +
                `Laporan harian Anda tanggal *${new Date(updatedReport.date).toLocaleDateString('id-ID')}* telah diperiksa oleh Kabid.\n\n` +
                `📌 *Status*: ⚠️ BUTUH PERBAIKAN / COACHING\n` +
                `📝 *Feedback*: ${feedback || '-'}\n\n` +
                `Syukron atas dedikasinya. Silakan lakukan perbaikan sesuai arahan Kabid.`;

            try {
                await whatsappService.sendMessage(staffPhone, waMsg);
            } catch (waErr) {
                console.error('[Review Notification] WA Failed:', waErr.message);
            }
        }

        res.json({ message: 'Laporan berhasil diperiksa', data: updatedReport });
    } catch (error) {
        console.error("Review Report Error:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * WEEKLY MISSING REPORTS CHECK (FRIDAY at 15:00)
 * Check daily reports from Mon to Fri, identify specific missing days per staff,
 * send teguran to each staff and a recap to Kabid.
 */
exports.checkMissingReportsWeekly = async () => {
    console.log(`[${new Date().toLocaleString('id-ID')}] [Personnel] Checking Missing Weekly Reports (Mon-Fri)...`);

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 5=Fri

    // Calculate Monday of current week
    const mon = new Date(now);
    mon.setDate(now.getDate() - (dayOfWeek - 1)); // Go back to Monday
    mon.setHours(0, 0, 0, 0);

    // Build array of weekdays Mon-Fri
    const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
    const weekDays = [];
    for (let i = 0; i < 5; i++) {
        const d = new Date(mon);
        d.setDate(mon.getDate() + i);
        weekDays.push({
            label: HARI[i],
            start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0),
            end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
        });
    }

    try {
        // Get all Sarpras staff (excluding Kabid)
        const staff = await prisma.user.findMany({
            where: {
                position: { not: 'Kepala Bidang Sarana dan Prasarana' },
                OR: [
                    { position: { contains: 'Sarana dan Prasarana' } },
                    { position: { contains: 'Manajemen Aset' } },
                    { position: { contains: 'Gudang dan Logistik' } },
                    { position: { contains: 'Teknisi' } },
                    { position: { contains: 'Keuangan dan Administrasi' } },
                    { position: { contains: 'Kendaraan' } }
                ]
            }
        });

        const missingList = []; // { name, phone, missingDays: ['Senin','Rabu'] }

        for (const s of staff) {
            const missingDays = [];

            for (const wd of weekDays) {
                const count = await prisma.personnelReport.count({
                    where: {
                        userId: s.id,
                        type: 'DAILY',
                        date: { gte: wd.start, lte: wd.end }
                    }
                });
                if (count === 0) {
                    missingDays.push(wd.label);
                }
            }

            if (missingDays.length > 0) {
                missingList.push({
                    name: s.name || s.username,
                    phone: s.phone,
                    userId: s.id,
                    missingDays
                });
            }
        }

        if (missingList.length === 0) {
            console.log('[Personnel] All staff have complete daily reports this week. 🎉');
            return;
        }

        console.log(`[Personnel] ${missingList.length} staff with missing reports found.`);

        // --- 1. Send individual teguran to each staff ---
        let cumulativeDelay = 0;
        for (const entry of missingList) {
            if (entry.phone) {
                const staffMsg = `🚨 *PENGINGAT LAPORAN HARIAN* 🚨\n\n` +
                    `Assalamu'alaikum Ustadz ${entry.name},\n\n` +
                    `Mohon kesediaannya untuk segera melengkapi laporan harian yang belum terisi pada minggu ini:\n\n` +
                    `📅 *Hari yang Kosong*: ${entry.missingDays.join(', ')}\n\n` +
                    `Mohon segera diisi melalui aplikasi Manajemen Aset sebelum hari ini berakhir demi ketertiban administrasi unit. Syukron Jazakumullahu Khairan.`;

                const delay = cumulativeDelay;
                cumulativeDelay += Math.floor(Math.random() * (15000 - 5000 + 1)) + 5000;

                setTimeout(async () => {
                    try {
                        await waTemplateService.send('PERSONNEL_SUMMARY_WEEKLY_STAFF', entry.phone, {
                            nama_ustadz: entry.name,
                            hari_kosong: entry.missingDays.join(', ')
                        }, staffMsg);
                        console.log(`[Personnel] Teguran sent to ${entry.name} (missing: ${entry.missingDays.join(', ')})`);
                    } catch (e) {
                        console.error(`[Personnel] Failed to send teguran to ${entry.name}:`, e.message);
                    }
                }, delay);
            }

            // Push & In-App to staff
            try {
                await sendPushToUser(entry.userId, '🚨 Laporan Harian Belum Lengkap', `Hari kosong: ${entry.missingDays.join(', ')}`, '/personalia');
                await createNotification(entry.userId, 'Laporan Harian Belum Lengkap', `Hari yang belum diisi: ${entry.missingDays.join(', ')}`, 'WARNING', '/personalia');
            } catch (e) { }
        }

        // --- 2. Send recap to Kabid ---
        const kabid = await prisma.user.findFirst({
            where: { position: 'Kepala Bidang Sarana dan Prasarana' }
        });

        if (kabid?.phone) {
            // Wait for staff messages to finish first
            const kabidDelay = cumulativeDelay + 5000;

            setTimeout(async () => {
                try {
                    let msg = `⚠️ *AUDIT KEDISIPLINAN LAPORAN (SENIN-JUMAT)* ⚠️\n\n` +
                        `Berikut adalah daftar staf yang belum melengkapi laporan harian pada minggu ini:\n\n`;

                    missingList.forEach((entry, idx) => {
                        msg += `${idx + 1}. *${entry.name}* (${entry.missingDays.join(', ')})\n`;
                    });

                    msg += `\n_Mohon arahan kepada staf terkait agar melengkapi laporan sebelum jam kerja berakhir. Syukron._`;

                    await waTemplateService.send('PERSONNEL_SUMMARY_WEEKLY_KABID', kabid.phone, {
                        daftar_staf_kosong: missingList.map((entry, idx) => `${idx + 1}. ${entry.name} (${entry.missingDays.join(', ')})`).join('\n')
                    }, msg);
                    console.log('[Personnel] Missing report recap sent to Kabid.');
                } catch (e) {
                    console.error('[Personnel] Failed to send recap to Kabid:', e.message);
                }
            }, kabidDelay);

            // Push & In-App to Kabid
            await sendPushToKabid(
                '⚠️ Audit Laporan Mingguan',
                `${missingList.length} staf belum melengkapi laporan minggu ini.`,
                '/personalia'
            );

            if (kabid?.id) {
                await createNotification(
                    kabid.id,
                    'Audit Laporan Mingguan',
                    `${missingList.length} staf belum melengkapi laporan harian (Senin-Jumat)`,
                    'WARNING',
                    '/personalia'
                );
            }
        }
    } catch (err) {
        console.error('[Personnel] Missing Audit Error:', err.message);
    }
};

/**
 * WEEKLY REPORT REMINDER TO STAFF (FRIDAY 15:00)
 * Sends a reminder to all staff to ensure their Mon-Fri daily reports are complete
 */
exports.sendWeeklyReportReminder = async () => {
    console.log(`[${new Date().toLocaleString('id-ID')}] [Personnel] Sending Weekly Report Reminder to Staff...`);

    // Range: Mon-Fri
    const now = new Date();
    const fri = new Date(now);
    const mon = new Date(now);
    mon.setDate(now.getDate() - 4); // Mon

    mon.setHours(0, 0, 0, 0);
    fri.setHours(23, 59, 59, 999);

    try {
        const staff = await prisma.user.findMany({
            where: {
                OR: [
                    { position: { contains: 'Sarana dan Prasarana' } },
                    { position: { contains: 'Manajemen Aset' } },
                    { position: { contains: 'Manajamen Aset' } },
                    { position: { contains: 'Gudang dan Logistik' } },
                    { position: { contains: 'Teknisi' } },
                    { position: { contains: 'Keuangan dan Administrasi' } },
                    { position: { contains: 'Kendaraan' } }
                ],
                phone: { not: null, not: '' }
            }
        });

        for (const s of staff) {
            // Check if they skipped any day or just send a general "check your weekly work"
            const reportCount = await prisma.personnelReport.count({
                where: {
                    userId: s.id,
                    type: 'DAILY',
                    date: { gte: mon, lte: fri }
                }
            });

            // If missing reports (typically should have 5), or just remind everyone
            const msg = `*Bismillah, Pengingat Laporan Mingguan*\n\n` +
                `Assalamu'alaikum Ustadz *${s.name}*,\n\n` +
                `Mengingatkan kembali agar tidak lupa melengkapi *Laporan Harian* periode Senin s/d Jumat minggu ini di aplikasi Manajemen Aset.\n\n` +
                `Statistik Anda minggu ini: *${reportCount} Laporan*\n` +
                `_Mohon segera dilengkapi sebelum jam pulang kantor. Syukron Jazakumullahu Khairan._`;

            setTimeout(async () => {
                try {
                    await waTemplateService.send('PERSONNEL_PUNISHMENT_NEW', s.phone, {
                        nama_ustadz: s.name,
                        jumlah_laporan: reportCount
                    }, msg);
                } catch (e) {
                    console.error(`[Report Reminder] Failed to notify ${s.name}:`, e.message);
                }
            }, Math.random() * 30000); // Random delay to avoid spam detection
        }
    } catch (err) {
        console.error('[Personnel] Weekly Reminder Error:', err.message);
    }
};

/**
 * GENERATE NARRATIVE AI SUMMARY FOR KABID
 * Aggregates recent activities and uses AI to summarize them into a narrative.
 */
exports.getPersonnelAISummary = async (req, res) => {
    try {
        // [SEC] Authorization Check: Refetch user to ensure fresh data
        const currentUser = await prisma.user.findUnique({ where: { id: req.user.id } });
        const userPosition = (currentUser?.position || '').toLowerCase();

        // Lenient matching for AISummary
        const isKabidTitle = userPosition.includes('kepala bidang');
        const isSarprasUnit = userPosition.includes('sarana dan prasarana') || userPosition.includes('sarpras');
        const isAuthorized = currentUser?.role === 'SUPER_ADMIN' || (isKabidTitle && isSarprasUnit) || currentUser?.role === 'KEPALA_BIDANG';

        if (!isAuthorized) {
            console.warn(`[AUTH-AI] Unauthorized: User=${currentUser?.username}, Pos=[${currentUser?.position}]`);
            return res.status(403).json({
                error: `Akses ditolak. Jabatan Di database: "${currentUser?.position || 'Kosong'}".`
            });
        }

        // 1. Fetch Data for Context
        const last7Days = new Date();
        last7Days.setDate(last7Days.getDate() - 7);

        // A. Recent Assignments
        const assignments = await prisma.personnelAssignment.findMany({
            where: {
                createdAt: { gte: last7Days },
                routineId: null // Skip routines here, handle separately
            },
            include: { assignee: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 15
        });

        // B. Recent Plans (Weekly Reports with isPlan: true)
        const plans = await prisma.personnelReport.findMany({
            where: {
                type: 'WEEKLY',
                date: { gte: last7Days },
                metadata: { path: ['isPlan'], equals: true }
            },
            include: { user: { select: { name: true } } },
            orderBy: { date: 'desc' },
            take: 10
        });

        // C. Active Routines
        const routines = await prisma.personnelRoutine.findMany({
            where: { isActive: true },
            include: { assignee: { select: { name: true } } },
            take: 10
        });

        // D. Recent Daily Logs
        const dailyLogs = await prisma.personnelReport.findMany({
            where: {
                type: 'DAILY',
                date: { gte: last7Days }
            },
            include: { user: { select: { name: true } } },
            orderBy: { date: 'desc' },
            take: 15
        });

        // 2. Map data for AI
        const context = {
            tasks: assignments,
            plans,
            routines,
            dailyLogs: dailyLogs.map(l => ({
                user: l.user,
                content: l.content || (l.metadata?.items ? l.metadata.items.map(i => i.activity).join(', ') : 'Laporan rutin')
            }))
        };

        // 3. Generate Summary
        const summary = await aiService.generatePersonnelSummary(context);

        res.json({ summary });
    } catch (err) {
        console.error('[AI Summary Error]', err.message);
        res.status(500).json({ error: 'Gagal menghasilkan ringkasan AI: ' + err.message });
    }
};

// --- SANCTION LIFTING ---

exports.proposeSanctionLift = async (req, res) => {
    try {
        const userId = req.user.id;
        const { reason } = req.body;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user.isSanctioned) {
            return res.status(400).json({ error: 'Akun Anda tidak dalam masa sanksi.' });
        }
        if (user.sanctionProposedLift) {
            return res.status(400).json({ error: 'Anda sudah mengajukan pencabutan sanksi sebelumnya. Mohon tunggu proses review.' });
        }
        if (!reason) {
            return res.status(400).json({ error: 'Alasan pencabutan sanksi wajib diisi.' });
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                sanctionProposedLift: true,
                sanctionLiftReason: reason
            }
        });

        // Notify Admins
        const admins = await prisma.user.findMany({
            where: {
                OR: [
                    { role: 'SUPER_ADMIN' },
                    { role: 'ADMIN_ASET' }
                ]
            }
        });

        for (const admin of admins) {
            await createNotification(
                admin.id,
                'Pengajuan Pencabutan Sanksi',
                `${updatedUser.name} mengajukan pencabutan sanksi. Alasan: ${reason}`,
                'INFO',
                '/kendaraan'
            );
            if (admin.phone) {
                const msg = `📢 *PENGAJUAN PENCABUTAN SANKSI*\n\n` +
                    `User: ${updatedUser.name}\n` +
                    `Alasan: ${reason}\n\n` +
                    `Mohon untuk di-review di menu Pelanggaran User aplikasi SARPRAS.`;
                await whatsappService.sendMessage(admin.phone, msg);
            }
        }

        res.json({ message: 'Pengajuan pencabutan sanksi berhasil dikirim.' });
    } catch (err) {
        console.error('[Propose Sanction Lift Error]', err.message);
        res.status(500).json({ error: 'Gagal mengajukan pencabutan sanksi: ' + err.message });
    }
};

exports.reviewSanctionLift = async (req, res) => {
    try {
        const { userId, isApproved } = req.body;
        const adminId = req.user.id;

        const admin = await prisma.user.findUnique({ where: { id: adminId } });
        if (!admin.position?.toLowerCase().includes('Staff Kendaraan')) {
            return res.status(403).json({ error: 'Akses ditolak.' });
        }

        const user = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
        if (!user || !user.isSanctioned) {
            return res.status(404).json({ error: 'User tidak ditemukan atau tidak sedang disanksi.' });
        }

        if (isApproved) {
            // Un-sanction and reset warnings for bookings? Actually just reset user isSanctioned flag
            await prisma.user.update({
                where: { id: parseInt(userId) },
                data: {
                    isSanctioned: false,
                    sanctionProposedLift: false,
                    sanctionLiftReason: null
                }
            });

            // Also reset warning counts on any active/recent bookings to prevent immediate re-sanction if loop triggers again.
            // Wait, the late loops only trigger if tripStartTime is null or tripEndTime is null. 
            // If we completed or cancelled the trip, it won't be processed again by those loops.
            // So just un-sanctioning the user is enough.

            if (user.phone) {
                const msg = `✅ *PENCABUTAN SANKSI DISETUJUI*\n\n` +
                    `Bismillah Ustadz ${user.name},\n\n` +
                    `Pengajuan pencabutan sanksi Anda telah disetujui oleh ${admin.name}. Hak akses peminjaman kendaraan Anda telah dikembalikan.\n\n` +
                    `Mohon untuk tertib dalam memulai dan mengakhiri perjalanan ke depannya. Syukron.`;
                await whatsappService.sendMessage(user.phone, msg);
            }
            await createNotification(user.id, 'Sanksi Dicabut', 'Pengajuan pencabutan sanksi Anda telah disetujui. Anda dapat melakukan peminjaman kembali.', 'SUCCESS', '/kendaraan');

            res.json({ message: 'Sanksi berhasil dicabut.' });
        } else {
            // Reject lift
            await prisma.user.update({
                where: { id: parseInt(userId) },
                data: {
                    sanctionProposedLift: false
                }
            });

            if (user.phone) {
                const msg = `❌ *PENCABUTAN SANKSI DITOLAK*\n\n` +
                    `Bismillah Ustadz ${user.name},\n\n` +
                    `Maaf, pengajuan pencabutan sanksi Anda ditolak oleh ${admin.name}.`;
                await whatsappService.sendMessage(user.phone, msg);
            }
            await createNotification(user.id, 'Pencabutan Sanksi Ditolak', 'Pengajuan pencabutan sanksi Anda ditolak.', 'ERROR', '/kendaraan');

            res.json({ message: 'Pencabutan sanksi ditolak.' });
        }
    } catch (err) {
        console.error('[Review Sanction Lift Error]', err.message);
        res.status(500).json({ error: 'Gagal memproses review pencabutan sanksi: ' + err.message });
    }
};

exports.generateSummary = async (req, res) => {
    try {
        const currentUser = await prisma.user.findUnique({ where: { id: req.user.id } });
        const userPosition = (currentUser?.position || '').toLowerCase();

        // Lenient matching for AISummary
        const isKabidTitle = userPosition.includes('kepala bidang');
        const isSarprasUnit = userPosition.includes('sarana dan prasarana') || userPosition.includes('sarpras');
        const isAuthorized = currentUser?.role === 'SUPER_ADMIN' || (isKabidTitle && isSarprasUnit) || currentUser?.role === 'KEPALA_BIDANG';

        if (!isAuthorized) {
            console.warn(`[AUTH-AI] Unauthorized: User=${currentUser?.username}, Pos=[${currentUser?.position}]`);
            return res.status(403).json({
                error: `Akses ditolak. Jabatan Di database: "${currentUser?.position || 'Kosong'}".`
            });
        }

        // 1. Fetch Data for Context
        const last7Days = new Date();
        last7Days.setDate(last7Days.getDate() - 7);

        // A. Recent Assignments
        const assignments = await prisma.personnelAssignment.findMany({
            where: {
                createdAt: { gte: last7Days },
                routineId: null // Skip routines here, handle separately
            },
            include: { assignee: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 15
        });

        // B. Recent Plans (Weekly Reports with isPlan: true)
        const plans = await prisma.personnelReport.findMany({
            where: {
                type: 'WEEKLY',
                date: { gte: last7Days },
                metadata: { path: ['isPlan'], equals: true }
            },
            include: { user: { select: { name: true } } },
            orderBy: { date: 'desc' },
            take: 10
        });

        // C. Active Routines
        const routines = await prisma.personnelRoutine.findMany({
            where: { isActive: true },
            include: { assignee: { select: { name: true } } },
            take: 10
        });

        // D. Recent Daily Logs
        const dailyLogs = await prisma.personnelReport.findMany({
            where: {
                type: 'DAILY',
                date: { gte: last7Days }
            },
            include: { user: { select: { name: true } } },
            orderBy: { date: 'desc' },
            take: 15
        });

        // 2. Map data for AI
        const context = {
            tasks: assignments,
            plans,
            routines,
            dailyLogs: dailyLogs.map(l => ({
                user: l.user,
                content: l.content || (l.metadata?.items ? l.metadata.items.map(i => i.activity).join(', ') : 'Laporan rutin')
            }))
        };

        // 3. Generate Summary
        const summary = await aiService.generatePersonnelSummary(context);

        res.json({ summary });
    } catch (err) {
        console.error('[AI Summary Error]', err.message);
        res.status(500).json({ error: 'Gagal menghasilkan ringkasan AI: ' + err.message });
    }
};

// --- SANCTION LIFTING ---

exports.proposeSanctionLift = async (req, res) => {
    try {
        const userId = req.user.id;
        const { reason } = req.body;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user.isSanctioned) {
            return res.status(400).json({ error: 'Akun Anda tidak dalam masa sanksi.' });
        }
        if (user.sanctionProposedLift) {
            return res.status(400).json({ error: 'Anda sudah mengajukan pencabutan sanksi sebelumnya. Mohon tunggu proses review.' });
        }
        if (!reason) {
            return res.status(400).json({ error: 'Alasan pencabutan sanksi wajib diisi.' });
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                sanctionProposedLift: true,
                sanctionLiftReason: reason
            }
        });

        // Notify Admins
        const admins = await prisma.user.findMany({
            where: {
                OR: [
                    { position: 'Kepala Bidang Sarana dan Prasarana' },
                    { position: 'Staff Kendaraan' }
                ]
            }
        });

        for (const admin of admins) {
            await createNotification(
                admin.id,
                'Pengajuan Pencabutan Sanksi',
                `${updatedUser.name} mengajukan pencabutan sanksi. Alasan: ${reason}`,
                'INFO',
                '/kendaraan'
            );
            if (admin.phone) {
                const msg = `📢 *PENGAJUAN PENCABUTAN SANKSI*\n\n` +
                    `User: ${updatedUser.name}\n` +
                    `Alasan: ${reason}\n\n` +
                    `Mohon untuk di-review di menu Pelanggaran User aplikasi SARPRAS.`;
                await whatsappService.sendMessage(admin.phone, msg);
            }
        }

        res.json({ message: 'Pengajuan pencabutan sanksi berhasil dikirim.' });
    } catch (err) {
        console.error('[Propose Sanction Lift Error]', err.message);
        res.status(500).json({ error: 'Gagal mengajukan pencabutan sanksi: ' + err.message });
    }
};

exports.reviewSanctionLift = async (req, res) => {
    try {
        const { userId, isApproved, reviewNotes } = req.body;
        const adminId = req.user.id;

        const admin = await prisma.user.findUnique({ where: { id: adminId } });
        if (!['SUPER_ADMIN', 'ADMIN_ASET'].includes(admin.role) && !admin.position?.toLowerCase().includes('kepala bidang')) {
            return res.status(403).json({ error: 'Akses ditolak.' });
        }

        const user = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
        if (!user || !user.isSanctioned) {
            return res.status(404).json({ error: 'User tidak ditemukan atau tidak sedang disanksi.' });
        }

        if (isApproved) {
            // Un-sanction and reset warnings for bookings? Actually just reset user isSanctioned flag
            await prisma.user.update({
                where: { id: parseInt(userId) },
                data: {
                    isSanctioned: false,
                    sanctionProposedLift: false,
                    sanctionLiftReason: null
                }
            });

            const latestViolation = await prisma.driverViolation.findFirst({
                where: {
                    driverId: parseInt(userId),
                    category: "Sanksi Peminjaman",
                    sanction: "Akun Dibekukan"
                },
                orderBy: { date: 'desc' }
            });

            if (latestViolation) {
                await prisma.driverViolation.update({
                    where: { id: latestViolation.id },
                    data: {
                        sanction: "Sanksi Dicabut",
                        description: `${latestViolation.description}\n\n[SANKSI DICABUT] Di-review oleh ${admin.name} pada ${new Date().toLocaleString('id-ID')}.\nCatatan: ${reviewNotes || 'Tidak ada catatan.'}`
                    }
                });
            }

            if (user.phone) {
                const msg = `✅ *PENCABUTAN SANKSI DISETUJUI*\n\n` +
                    `Bismillah Ustadz ${user.name},\n\n` +
                    `Pengajuan pencabutan sanksi Anda telah disetujui oleh ${admin.name}. Hak akses peminjaman kendaraan Anda telah dikembalikan.\n\n` +
                    `Mohon untuk tertib dalam memulai dan mengakhiri perjalanan ke depannya. Syukron.`;
                await whatsappService.sendMessage(user.phone, msg);
            }
            await createNotification(user.id, 'Sanksi Dicabut', 'Pengajuan pencabutan sanksi Anda telah disetujui. Anda dapat melakukan peminjaman kembali.', 'SUCCESS', '/kendaraan');

            res.json({ message: 'Sanksi berhasil dicabut.' });
        } else {
            // Reject lift
            await prisma.user.update({
                where: { id: parseInt(userId) },
                data: {
                    sanctionProposedLift: false
                }
            });

            const latestViolation = await prisma.driverViolation.findFirst({
                where: {
                    driverId: parseInt(userId),
                    category: "Sanksi Peminjaman",
                    sanction: "Akun Dibekukan"
                },
                orderBy: { date: 'desc' }
            });

            if (latestViolation) {
                await prisma.driverViolation.update({
                    where: { id: latestViolation.id },
                    data: {
                        description: `${latestViolation.description}\n\n[PENCABUTAN SANKSI DITOLAK] Di-review oleh ${admin.name} pada ${new Date().toLocaleString('id-ID')}.\nCatatan: ${reviewNotes || 'Tidak ada catatan.'}`
                    }
                });
            }

            if (user.phone) {
                const msg = `❌ *PENCABUTAN SANKSI DITOLAK*\n\n` +
                    `Bismillah Ustadz ${user.name},\n\n` +
                    `Maaf, pengajuan pencabutan sanksi Anda ditolak oleh ${admin.name}.`;
                await whatsappService.sendMessage(user.phone, msg);
            }
            await createNotification(user.id, 'Pencabutan Sanksi Ditolak', 'Pengajuan pencabutan sanksi Anda ditolak.', 'WARNING', '/kendaraan');

            res.json({ message: 'Pengajuan pencabutan sanksi ditolak.' });
        }
    } catch (err) {
        console.error('[Review Sanction Lift Error]', err.message);
        res.status(500).json({ error: 'Gagal memproses pencabutan sanksi: ' + err.message });
    }
};

exports.getSanctionedUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            where: { isSanctioned: true },
            select: {
                id: true,
                name: true,
                phone: true,
                position: true,
                isSanctioned: true,
                sanctionProposedLift: true,
                sanctionLiftReason: true
            }
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
