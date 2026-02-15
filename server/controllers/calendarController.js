const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const whatsappService = require('../services/whatsappService');

// ====== HELPERS ======

// Expand recurring events for a given month
function expandRecurringEvents(event, year, month) {
    const results = [];
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);
    const eventDate = new Date(event.date);
    const recurEnd = event.recurringEndDate ? new Date(event.recurringEndDate) : null;

    if (recurEnd && recurEnd < monthStart) return results;
    if (eventDate > monthEnd) return results;

    const type = event.recurringType;

    for (let day = new Date(monthStart); day <= monthEnd; day.setDate(day.getDate() + 1)) {
        const d = new Date(day);
        if (d < eventDate) continue;
        if (recurEnd && d > recurEnd) break;

        let match = false;
        if (type === 'DAILY') {
            match = true;
        } else if (type === 'WEEKLY') {
            match = d.getDay() === eventDate.getDay();
        } else if (type === 'MONTHLY') {
            match = d.getDate() === eventDate.getDate();
        } else if (type === 'YEARLY') {
            match = d.getDate() === eventDate.getDate() && d.getMonth() === eventDate.getMonth();
        }

        if (match) {
            results.push({
                ...event,
                date: d.toISOString(),
                isRecurringInstance: true,
                originalId: event.id
            });
        }
    }
    return results;
}

// ====== CONTROLLERS ======

// GET /api/calendar?month=2&year=2026
const getEvents = async (req, res) => {
    try {
        const month = parseInt(req.query.month) || new Date().getMonth() + 1;
        const year = parseInt(req.query.year) || new Date().getFullYear();

        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0, 23, 59, 59);

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
                createdBy: { select: { id: true, name: true } },
                assignments: { select: { id: true, status: true, assigneeId: true } }
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
                createdBy: { select: { id: true, name: true } },
                assignments: { select: { id: true, status: true, assigneeId: true } }
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
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0, 23, 59, 59);

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
        const { title, description, category, date, endDate, isPinned, location, picIds, isRecurring, recurringType, recurringEndDate } = req.body;

        if (!title || !date) return res.status(400).json({ error: 'Judul dan tanggal wajib diisi' });

        const event = await prisma.sarprasCalendarEvent.create({
            data: {
                title, description, category: category || 'Lainnya',
                date: new Date(date), endDate: endDate ? new Date(endDate) : null,
                isPinned: isPinned || false, location,
                pics: {
                    connect: (Array.isArray(picIds) ? picIds : []).map(id => ({ id: parseInt(id) }))
                },
                isRecurring: isRecurring || false, recurringType: recurringType || null,
                recurringEndDate: recurringEndDate ? new Date(recurringEndDate) : null,
                createdById: req.user.id
            },
            include: { pics: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } } }
        });

        // AUTO-ASSIGNMENT SYNC: Create assignments for each PIC
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

        res.status(201).json(event);
    } catch (error) {
        console.error('[Calendar] Create error:', error);
        res.status(500).json({ error: 'Gagal membuat kegiatan' });
    }
};

// PUT /api/calendar/:id
const updateEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, category, date, endDate, isPinned, location, picIds, isRecurring, recurringType, recurringEndDate } = req.body;

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
                isRecurring: isRecurring || false, recurringType, recurringEndDate: recurringEndDate ? new Date(recurringEndDate) : null
            },
            include: { pics: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } } }
        });

        // AUTO-ASSIGNMENT SYNC:
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

        // 3. Add assignments for new PICs
        const toAdd = newAssigneeIds.filter(pid => !currentAssigneeIds.includes(pid));
        if (toAdd.length > 0) {
            await Promise.all(toAdd.map(pid => {
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
const sendCalendarReminders = async () => {
    try {
        // Spam prevention: Only send between 08:00 and 20:00
        const now = new Date();
        const hour = now.getHours();
        if (hour < 8 || hour >= 20) {
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
            const eventDate = new Date(ev.date);
            const d = tomorrow;
            let match = false;
            if (ev.recurringType === 'DAILY') match = true;
            else if (ev.recurringType === 'WEEKLY') match = d.getDay() === eventDate.getDay();
            else if (ev.recurringType === 'MONTHLY') match = d.getDate() === eventDate.getDate();
            else if (ev.recurringType === 'YEARLY') match = d.getDate() === eventDate.getDate() && d.getMonth() === eventDate.getMonth();
            if (match) allUpcoming.push(ev);
        });

        if (allUpcoming.length === 0) {
            console.log('[Calendar Reminder] No events for tomorrow.');
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

        console.log(`[Calendar Reminder] Sending reminders to ${Object.keys(groupedByPIC).length} PICs...`);

        const { sendMessage } = whatsappService;

        for (const picId in groupedByPIC) {
            const data = groupedByPIC[picId];

            let msg = `📅 *REMINDER KEGIATAN BESOK*\n`;
            msg += `Halo ${data.picName}, berikut agenda Sarpras untuk besok:\n\n`;

            data.events.forEach((event, idx) => {
                msg += `${idx + 1}. *${event.title}*\n`;
                msg += `   📂 Kategori: ${event.category}\n`;
                if (event.location) msg += `   📍 Lokasi: ${event.location}\n`;
                if (event.description) msg += `   📝 Detail: ${event.description}\n`;
                msg += `\n`;
            });

            msg += `Mohon dipersiapkan dengan baik. Terima kasih.`;

            // Random delay between 30-120 seconds per PIC to mimic human behavior
            const delay = 30000 + Math.random() * 90000;
            await new Promise(resolve => setTimeout(resolve, delay));

            try {
                await sendMessage(data.phone, msg);
                console.log(`[Calendar Reminder] Sent to ${data.picName} (${data.phone}) - ${data.events.length} events`);
            } catch (err) {
                console.error(`[Calendar Reminder] Failed to send to ${data.picName}:`, err.message);
            }
        }
    } catch (error) {
        console.error('[Calendar Reminder] Error:', error);
    }
};

const sendWeeklyCalendarSummary = async () => {
    try {
        const ravi = await prisma.user.findUnique({ where: { nip: '24071613' } });
        if (!ravi || !ravi.phone) {
            console.log('[Weekly Summary] Ravi Kurnia not found or has no phone.');
            return;
        }

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
                OR: [{ recurringEndDate: null }, { recurringEndDate: { gte: monday } }]
            },
            include: { pics: { select: { name: true } } }
        });

        // 3. Expand recurring
        let allWeekly = [...regularEvents];
        recurringEvents.forEach(ev => {
            const evDate = new Date(ev.date);
            for (let d = new Date(monday); d <= sunday; d.setDate(d.getDate() + 1)) {
                if (d < evDate) continue;
                let match = false;
                if (ev.recurringType === 'DAILY') match = true;
                else if (ev.recurringType === 'WEEKLY') match = d.getDay() === evDate.getDay();
                else if (ev.recurringType === 'MONTHLY') match = d.getDate() === evDate.getDate();
                if (match) {
                    allWeekly.push({ ...ev, date: new Date(d) });
                }
            }
        });

        allWeekly.sort((a, b) => new Date(a.date) - new Date(b.date));

        if (allWeekly.length === 0) {
            console.log('[Weekly Summary] No events for this week.');
            return;
        }

        // 4. Format Message
        let msg = `📅 *LAPORAN KEGIATAN PEKAN INI*\n`;
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

        await whatsappService.sendMessage(ravi.phone, msg);
        console.log(`[Weekly Summary] Sent to Ravi Kurnia (${allWeekly.length} events)`);
    } catch (error) {
        console.error('[Weekly Summary] Error:', error);
    }
};

module.exports = { getEvents, getPinnedEvents, getSummary, createEvent, updateEvent, deleteEvent, sendCalendarReminders, sendWeeklyCalendarSummary };
