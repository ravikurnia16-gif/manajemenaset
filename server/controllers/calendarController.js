const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const whatsappService = require('../services/whatsappService');

// ====== HELPERS ======

// Helper to check if a recurring event occurs on a specific date (Input d is a Date object, usually at local midnight)
function isEventOccurringOn(event, targetDate) {
    const eventDate = new Date(event.date);
    const recurEnd = event.recurringEndDate ? new Date(event.recurringEndDate) : null;
    const interval = event.recurringInterval || 1;
    const recurringDays = event.recurringDays ? event.recurringDays.split(',').map(Number) : [];

    // Use local date strings for comparison to avoid timezone shifts
    const dStr = targetDate.toISOString().split('T')[0];
    const sdStr = eventDate.toISOString().split('T')[0];

    // Normalize to midnight local for math
    const d = new Date(dStr + 'T00:00:00');
    const sd = new Date(sdStr + 'T00:00:00');

    if (d < sd) return false;
    if (recurEnd) {
        const edStr = recurEnd.toISOString().split('T')[0];
        const ed = new Date(edStr + 'T23:59:59');
        if (d > ed) return false;
    }

    if (event.recurringType === 'DAILY') {
        const daysDiff = Math.floor((d.getTime() - sd.getTime()) / (24 * 60 * 60 * 1000));
        return daysDiff % interval === 0;
    } else if (event.recurringType === 'WEEKLY') {
        if (recurringDays.length > 0) {
            if (!recurringDays.includes(d.getDay())) return false;
        } else {
            if (d.getDay() !== sd.getDay()) return false;
        }
        const weeksDiff = Math.floor((d.getTime() - sd.getTime()) / (7 * 24 * 60 * 60 * 1000));
        return weeksDiff % interval === 0;
    } else if (event.recurringType === 'MONTHLY') {
        if (d.getDate() !== sd.getDate()) return false;
        const monthsDiff = (d.getFullYear() - sd.getFullYear()) * 12 + (d.getMonth() - sd.getMonth());
        return monthsDiff % interval === 0;
    } else if (event.recurringType === 'YEARLY') {
        if (d.getDate() !== sd.getDate() || d.getMonth() !== sd.getMonth()) return false;
        const yearsDiff = d.getFullYear() - sd.getFullYear();
        return yearsDiff % interval === 0;
    }
    return false;
}

// Expand recurring events for a given month
function expandRecurringEvents(event, year, month) {
    const results = [];
    const monthEnd = new Date(year, month, 0).getDate();

    // Calculate duration if it's a range event
    const originalStart = new Date(event.date);
    const originalEnd = event.endDate ? new Date(event.endDate) : null;
    const duration = originalEnd ? (originalEnd.getTime() - originalStart.getTime()) : 0;

    for (let d = 1; d <= monthEnd; d++) {
        // Construct date at local midday to avoid DST shift bugs during comparison
        const targetDate = new Date(year, month - 1, d, 12, 0, 0);
        if (isEventOccurringOn(event, targetDate)) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const instanceStart = new Date(year, month - 1, d, 0, 0, 0);
            results.push({
                ...event,
                date: instanceStart.toISOString(),
                endDate: duration > 0 ? new Date(instanceStart.getTime() + duration).toISOString() : null,
                isRecurringInstance: true,
                instanceId: `${event.id}-${dateStr}` // Unique ID for React keys
            });
        }
    }
    return results;
}

// ====== CONTROLLERS ======

const getEvents = async (req, res) => {
    try {
        const month = parseInt(req.query.month) || new Date().getMonth() + 1;
        const year = parseInt(req.query.year) || new Date().getFullYear();

        // Use UTC boundaries to avoid timezone shift skips
        const monthStart = new Date(Date.UTC(year, month - 1, 1));
        const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

        // 1. Get non-recurring events in the month (including those that overlap)
        const regularEvents = await prisma.sarprasCalendarEvent.findMany({
            where: {
                isRecurring: false,
                OR: [
                    { date: { gte: monthStart, lte: monthEnd } },
                    { endDate: { gte: monthStart, lte: monthEnd } },
                    { AND: [{ date: { lte: monthStart } }, { endDate: { gte: monthEnd } }] }
                ]
            },
            include: {
                pics: { select: { id: true, name: true, phone: true } },
                createdBy: { select: { id: true, name: true } }
            },
            orderBy: { date: 'asc' }
        });

        // 2. Get all recurring events that could appear in this month
        const recurringEvents = await prisma.sarprasCalendarEvent.findMany({
            where: {
                isRecurring: true,
                date: { lte: monthEnd },
                OR: [
                    { recurringEndDate: null },
                    { recurringEndDate: { gte: monthStart } }
                ]
            },
            include: {
                pics: { select: { id: true, name: true, phone: true } },
                createdBy: { select: { id: true, name: true } }
            }
        });

        // 3. Expand recurring events
        let expandedRecurring = [];
        recurringEvents.forEach(ev => {
            const serialized = { ...ev, date: ev.date.toISOString(), endDate: ev.endDate?.toISOString(), recurringEndDate: ev.recurringEndDate?.toISOString() };
            expandedRecurring = expandedRecurring.concat(expandRecurringEvents(serialized, year, month));
        });

        const allEvents = [...regularEvents, ...expandedRecurring];
        allEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

        // 4. Try to enrich with assignment statuses (safe - won't crash if schema not migrated)
        try {
            const eventIds = allEvents.filter(e => e.id).map(e => e.id);
            const assignments = await prisma.personnelAssignment.findMany({
                where: { calendarEventId: { in: eventIds } },
                select: { id: true, status: true, assigneeId: true, calendarEventId: true }
            });
            allEvents.forEach(ev => {
                ev.assignments = assignments.filter(a => a.calendarEventId === ev.id);
            });
        } catch (e) {
            // Schema not yet migrated - assignments will be empty
            allEvents.forEach(ev => { ev.assignments = []; });
        }

        res.json(allEvents);
    } catch (error) {
        console.error('[Calendar] Error fetching events:', error);
        res.status(500).json({ error: 'Gagal memuat kalender' });
    }
};

// GET /api/calendar/pinned
const getPinnedEvents = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const pinned = await prisma.sarprasCalendarEvent.findMany({
            where: { isPinned: true, date: { gte: today } },
            include: { pics: { select: { id: true, name: true } } },
            orderBy: { date: 'asc' },
            take: 10
        });
        res.json(pinned);
    } catch (error) {
        res.status(500).json({ error: 'Gagal memuat pinned events' });
    }
};

// GET /api/calendar/summary?month=2&year=2026
const getSummary = async (req, res) => {
    try {
        const month = parseInt(req.query.month) || new Date().getMonth() + 1;
        const year = parseInt(req.query.year) || new Date().getFullYear();

        const monthStart = new Date(Date.UTC(year, month - 1, 1));
        const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

        const events = await prisma.sarprasCalendarEvent.findMany({
            where: {
                isRecurring: false,
                OR: [
                    { date: { gte: monthStart, lte: monthEnd } },
                    { endDate: { gte: monthStart, lte: monthEnd } },
                    { AND: [{ date: { lte: monthStart } }, { endDate: { gte: monthEnd } }] }
                ]
            }
        });

        const categories = {};
        events.forEach(e => {
            categories[e.category] = (categories[e.category] || 0) + 1;
        });

        const totalPinned = events.filter(e => e.isPinned).length;

        res.json({ month, year, totalEvents: events.length, totalPinned, byCategory: categories });
    } catch (error) {
        res.status(500).json({ error: 'Gagal memuat ringkasan' });
    }
};

// POST /api/calendar
const createEvent = async (req, res) => {
    try {
        const { title, description, category, date, endDate, isPinned, location, picIds, isRecurring, recurringType, recurringInterval, recurringDays, recurringEndDate } = req.body;

        if (!title || !date) return res.status(400).json({ error: 'Judul dan tanggal wajib diisi' });

        const event = await prisma.sarprasCalendarEvent.create({
            data: {
                title, description, category: category || 'Lainnya',
                date: new Date(date), endDate: endDate ? new Date(endDate) : null,
                isPinned: isPinned || false, location,
                pics: {
                    connect: (Array.isArray(picIds) ? picIds : []).map(id => ({ id: parseInt(id) }))
                },
                isRecurring: isRecurring || false,
                recurringType: isRecurring ? recurringType : null,
                recurringInterval: isRecurring ? (parseInt(recurringInterval) || 1) : 1,
                recurringDays: isRecurring ? (Array.isArray(recurringDays) ? recurringDays.join(',') : (recurringDays || null)) : null,
                recurringEndDate: isRecurring && recurringEndDate ? new Date(recurringEndDate) : null,
                createdById: req.user.id
            },
            include: { pics: { select: { id: true, name: true, phone: true } }, createdBy: { select: { id: true, name: true } } }
        });

        // AUTO-ASSIGNMENT SYNC & NOTIFICATION
        (async () => {
            try {
                // 1. Sync Assignments
                if (Array.isArray(picIds) && picIds.length > 0) {
                    await Promise.all(picIds.map(async (pId) => {
                        return prisma.personnelAssignment.create({
                            data: {
                                assignerId: req.user.id,
                                assigneeId: parseInt(pId),
                                title: `[KALENDER] ${title}`,
                                description: description || 'Tugas otomatis dari Kalender Kerja',
                                category: category || 'UMUM',
                                location: location || null,
                                dueDate: new Date(date),
                                calendarEventId: event.id,
                                status: 'PENDING'
                            }
                        });
                    }));
                }

                // 2. Send WhatsApp Notification to PICs
                if (event.pics && event.pics.length > 0) {
                    console.log(`[Calendar Create] Sending notifications to ${event.pics.length} PICs...`);

                    for (const pic of event.pics) {
                        if (!pic.phone) continue;

                        const dateStr = new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                        let msg = `Bismillah.\n📅 *Assalamu'alaykum Warahmatullahi Wabarakatuh*\n\n`;
                        msg += `Ustadz/Ustadzah ${pic.name}, ditunjuk sebagai PIC kegiatan berikut:\n\n`;
                        msg += `📌 *${title}*\n`;
                        msg += `📅 Tanggal: ${dateStr}\n`;
                        msg += `📂 Kategori: ${category || '-'}\n`;
                        if (location) msg += `📍 Lokasi: ${location}\n`;
                        if (description) msg += `📝 Detail: ${description}\n`;
                        msg += `\nMohon dicek di aplikasi Sarpras. Syukron Jazakumullahu Khairan.`;

                        // Jeda Random 5-15 detik (sesuai request)
                        const delay = 5000 + Math.random() * 10000;
                        await new Promise(resolve => setTimeout(resolve, delay));

                        try {
                            await whatsappService.sendMessage(pic.phone, msg);
                            console.log(`[Calendar Create] Sent WA to ${pic.name}`);
                        } catch (err) {
                            console.error(`[Calendar Create] Failed WA to ${pic.name}:`, err.message);
                        }
                    }
                }

            } catch (bgError) {
                console.error('[Calendar Create] Background Task Error:', bgError);
            }
        })();

        res.status(201).json(event);
    } catch (error) {
        console.error('[Calendar] Create error:', error);
        res.status(500).json({ error: 'Gagal membuat kegiatan' });
    }
};

// PUT /api/calendar/:id
const updateEvent = async (req, res) => {
    try {
        const { title, description, category, date, endDate, isPinned, location, picIds, isRecurring, recurringType, recurringInterval, recurringDays, recurringEndDate } = req.body;

        const event = await prisma.sarprasCalendarEvent.update({
            where: { id: parseInt(id) },
            data: {
                title, description, category,
                date: date ? new Date(date) : undefined,
                endDate: endDate ? new Date(endDate) : null,
                isPinned, location,
                pics: {
                    set: (Array.isArray(picIds) ? picIds : []).map(id => ({ id: parseInt(id) }))
                },
                isRecurring: isRecurring || false,
                recurringType: isRecurring ? recurringType : null,
                recurringInterval: isRecurring ? (parseInt(recurringInterval) || 1) : 1,
                recurringDays: isRecurring ? (Array.isArray(recurringDays) ? recurringDays.join(',') : (recurringDays || null)) : null,
                recurringEndDate: isRecurring && recurringEndDate ? new Date(recurringEndDate) : null
            },
            include: { pics: { select: { id: true, name: true, phone: true } }, createdBy: { select: { id: true, name: true } } }
        });

        // AUTO-ASSIGNMENT SYNC & NOTIFICATION FOR NEW PICS
        (async () => {
            try {
                // 1. Get existing assignments for this calendar event
                const existingAssignments = await prisma.personnelAssignment.findMany({
                    where: { calendarEventId: parseInt(id) }
                });
                const currentAssigneeIds = existingAssignments.map(a => a.assigneeId);
                const newAssigneeIds = (Array.isArray(picIds) ? picIds : []).map(pid => parseInt(pid));

                // 2. Remove assignments for PICs who are no longer selected
                const toDelete = existingAssignments.filter(a => !newAssigneeIds.includes(a.assigneeId));
                if (toDelete.length > 0) {
                    await prisma.personnelAssignment.deleteMany({
                        where: { id: { in: toDelete.map(a => a.id) } }
                    });
                }

                // 3. Add assignments for new PICs AND Notify them
                const toAddIds = newAssigneeIds.filter(pid => !currentAssigneeIds.includes(pid));

                if (toAddIds.length > 0) {
                    // Create Assignments
                    await Promise.all(toAddIds.map(pid => {
                        return prisma.personnelAssignment.create({
                            data: {
                                assignerId: req.user.id,
                                assigneeId: pid,
                                title: `[KALENDER] ${title}`,
                                description: description || 'Tugas otomatis dari Kalender Kerja',
                                category: category || 'UMUM',
                                location: location || null,
                                dueDate: new Date(date),
                                calendarEventId: parseInt(id),
                                status: 'PENDING'
                            }
                        });
                    }));

                    // Send Notifications to NEW PICs only
                    const newPics = await prisma.user.findMany({
                        where: { id: { in: toAddIds } },
                        select: { id: true, name: true, phone: true }
                    });

                    console.log(`[Calendar Update] Sending notifications to ${newPics.length} NEW PICs...`);

                    for (const pic of newPics) {
                        if (!pic.phone) continue;

                        const dateStr = new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                        let msg = `Bismillah.\n📅 *TUGAS BARU (KALENDER)*\n\n`;
                        msg += `Halo ${pic.name}, Anda baru saja ditambahkan sebagai PIC untuk kegiatan:\n\n`;
                        msg += `📌 *${title}*\n`;
                        msg += `📅 Tanggal: ${dateStr}\n`;
                        msg += `📂 Kategori: ${category || '-'}\n`;
                        if (location) msg += `📍 Lokasi: ${location}\n`;
                        msg += `\nMohon dicek di aplikasi. Terima kasih.`;

                        // Jeda Random 5-15 detik
                        const delay = 5000 + Math.random() * 10000;
                        await new Promise(resolve => setTimeout(resolve, delay));

                        try {
                            await whatsappService.sendMessage(pic.phone, msg);
                            console.log(`[Calendar Update] Sent WA to ${pic.name}`);
                        } catch (err) {
                            console.error(`[Calendar Update] Failed WA to ${pic.name}:`, err.message);
                        }
                    }
                }

                // 4. Update existing assignments (title/date/location change)
                const toUpdate = existingAssignments.filter(a => newAssigneeIds.includes(a.assigneeId));
                if (toUpdate.length > 0) {
                    await prisma.personnelAssignment.updateMany({
                        where: { id: { in: toUpdate.map(a => a.id) } },
                        data: {
                            title: `[KALENDER] ${title}`,
                            description: description || 'Tugas otomatis dari Kalender Kerja',
                            category: category || 'UMUM',
                            location: location || null,
                            dueDate: new Date(date)
                        }
                    });
                }
            } catch (bgError) {
                console.error('[Calendar Update] Background Task Error:', bgError);
            }
        })();

        res.json(event);
    } catch (error) {
        console.error('[Calendar] Update error:', error);
        res.status(500).json({ error: 'Gagal mengubah kegiatan' });
    }
};

// DELETE /api/calendar/:id
const deleteEvent = async (req, res) => {
    try {
        await prisma.sarprasCalendarEvent.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'Kegiatan berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: 'Gagal menghapus kegiatan' });
    }
};

// ====== WA H-1 REMINDER ======
const sendCalendarReminders = async (req = null, res = null) => {
    try {
        const isManual = !!req;

        // Spam prevention: Only send between 08:00 and 20:00 (unless manual)
        const now = new Date();
        const hour = now.getHours();
        if (!isManual && (hour < 8 || hour >= 20)) {
            console.log(`[Calendar Reminder] Outside working hours (${hour}:00). Skipping...`);
            return;
        }

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const tomorrowEnd = new Date(tomorrow);
        tomorrowEnd.setHours(23, 59, 59, 999);

        // 1. Regular events tomorrow
        const regularEvents = await prisma.sarprasCalendarEvent.findMany({
            where: { isRecurring: false, date: { gte: tomorrow, lte: tomorrowEnd } },
            include: { pics: { select: { id: true, name: true, phone: true } } }
        });

        // 2. Recurring events - check if tomorrow matches
        const recurringEvents = await prisma.sarprasCalendarEvent.findMany({
            where: {
                isRecurring: true,
                date: { lte: tomorrowEnd },
                OR: [{ recurringEndDate: null }, { recurringEndDate: { gte: tomorrow } }]
            },
            include: { pics: { select: { id: true, name: true, phone: true } } }
        });

        const allUpcoming = [...regularEvents];

        recurringEvents.forEach(ev => {
            if (isEventOccurringOn(ev, tomorrow)) {
                allUpcoming.push(ev);
            }
        });

        if (allUpcoming.length === 0) {
            console.log('[Calendar Reminder] No events for tomorrow.');
            if (isManual && res) return res.json({ message: 'No events found for tomorrow.' });
            return;
        }

        // Group events by PIC (handle multiple PICs per event)
        const groupedByPIC = {};
        allUpcoming.forEach(event => {
            if (!event.pics || event.pics.length === 0) return;

            event.pics.forEach(p => {
                if (!p.phone) return;
                if (!groupedByPIC[p.id]) {
                    groupedByPIC[p.id] = {
                        picName: p.name,
                        phone: p.phone,
                        events: []
                    };
                }
                groupedByPIC[p.id].events.push(event);
            });
        });

        const picCount = Object.keys(groupedByPIC).length;
        console.log(`[Calendar Reminder] Sending reminders to ${picCount} PICs...`);

        // If manual, respond immediately then process in background
        if (isManual && res) {
            res.json({ message: `Sending reminders to ${picCount} PICs (Background Process Started)`, recipientCount: picCount });
        }

        // Async Background Sending
        (async () => {
            for (const picId in groupedByPIC) {
                const data = groupedByPIC[picId];

                let msg = `Bismillah.\n📅 *REMINDER KEGIATAN BESOK*\n`;
                msg += `Halo ${data.picName}, berikut agenda Sarpras untuk besok:\n\n`;

                data.events.forEach((event, idx) => {
                    msg += `${idx + 1}. *${event.title}*\n`;
                    msg += `   📂 Kategori: ${event.category}\n`;
                    if (event.location) msg += `   📍 Lokasi: ${event.location}\n`;
                    if (event.description) msg += `   📝 Detail: ${event.description}\n`;
                    msg += `\n`;
                });

                msg += `Mohon dipersiapkan dengan baik. Terima kasih.`;

                // Random delay between 30-120 seconds per PIC to ensure staggered sending (10-11 range approx)
                const delay = 30000 + Math.random() * 90000;
                await new Promise(resolve => setTimeout(resolve, delay));

                try {
                    await whatsappService.sendMessage(data.phone, msg);
                    console.log(`[Calendar Reminder] Sent to ${data.picName} (${data.phone}) - ${data.events.length} events`);
                } catch (err) {
                    console.error(`[Calendar Reminder] Failed to send to ${data.picName}:`, err.message);
                }
            }
        })();

    } catch (error) {
        console.error('[Calendar Reminder] Error:', error);
        if (req && res && !res.headersSent) res.status(500).json({ error: error.message });
    }
};

const sendWeeklyCalendarSummary = async () => {
    try {
        console.log('[Weekly Summary] Starting summary generation...');

        // Find recipients: Kepala Bidang Sarana dan Prasarana
        const leads = await prisma.user.findMany({
            where: {
                position: 'Kepala Bidang Sarana dan Prasarana',
                phone: { not: null, not: '' }
            }
        });

        if (leads.length === 0) {
            console.error('[Weekly Summary] ERROR: No Kepala Bidang Sarana dan Prasarana found with phone number.');
            return;
        }

        console.log(`[Weekly Summary] Found ${leads.length} recipients.`);

        // 1. Calculate this week's range (Monday - Sunday)
        const today = new Date();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
        monday.setHours(0, 0, 0, 0);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        // 2. Fetch events
        const regularEvents = await prisma.sarprasCalendarEvent.findMany({
            where: { isRecurring: false, date: { gte: monday, lte: sunday } },
            include: { pics: { select: { name: true } } },
            orderBy: { date: 'asc' }
        });

        const recurringEvents = await prisma.sarprasCalendarEvent.findMany({
            where: {
                isRecurring: true,
                date: { lte: sunday },
                OR: [
                    { recurringEndDate: null },
                    { recurringEndDate: { gte: monday } }
                ]
            },
            include: { pics: { select: { name: true } } }
        });

        const allWeekly = [...regularEvents];

        recurringEvents.forEach(ev => {
            for (let d = new Date(monday); d <= sunday; d.setDate(d.getDate() + 1)) {
                const targetDate = new Date(d);
                if (isEventOccurringOn(ev, targetDate)) {
                    allWeekly.push({ ...ev, date: new Date(targetDate) });
                }
            }
        });

        allWeekly.sort((a, b) => new Date(a.date) - new Date(b.date));
        console.log(`[Weekly Summary] Found ${allWeekly.length} events for this week.`);

        if (allWeekly.length === 0) {
            console.log('[Weekly Summary] No events for this week. Sending empty report.');
            const emptyMsg = `Bismillah.\n📅 *LAPORAN KEGIATAN PEKAN INI*\nPeriode: ${monday.toLocaleDateString('id-ID')} - ${sunday.toLocaleDateString('id-ID')}\n\n*Tidak ada agenda kegiatan yang tercatat untuk pekan ini.*\n\nTerima kasih.`;
            for (const lead of leads) {
                await whatsappService.sendMessage(lead.phone, emptyMsg);
                console.log(`[Weekly Summary] Empty report sent to ${lead.name}`);
            }
            return;
        }

        // 4. Format Message
        let msg = `Bismillah.\n📅 *LAPORAN KEGIATAN PEKAN INI*\n`;
        msg += `Periode: ${monday.toLocaleDateString('id-ID')} - ${sunday.toLocaleDateString('id-ID')}\n\n`;

        let currentDayStr = '';
        allWeekly.forEach(ev => {
            const dayStr = new Date(ev.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
            if (dayStr !== currentDayStr) {
                msg += `📌 *${dayStr}*\n`;
                currentDayStr = dayStr;
            }
            const pics = ev.pics?.map(p => p.name).join(', ') || 'Semua Staf';
            msg += `• [${ev.category}] *${ev.title}*\n`;
            msg += `  👤 PIC: ${pics}\n`;
            if (ev.location) msg += `  📍 Lokasi: ${ev.location}\n`;
            msg += `\n`;
        });

        msg += `Terima kasih.`;

        for (const lead of leads) {
            await whatsappService.sendMessage(lead.phone, msg);
            console.log(`[Weekly Summary] SUCCESS: Message sent to ${lead.name}`);
        }
    } catch (error) {
        console.error('[Weekly Summary] CRITICAL ERROR:', error);
        if (error.stack) console.error(error.stack);
    }
};

module.exports = { getEvents, getPinnedEvents, getSummary, createEvent, updateEvent, deleteEvent, sendCalendarReminders, sendWeeklyCalendarSummary };
