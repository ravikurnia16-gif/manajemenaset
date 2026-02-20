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

    // Helper to format an event instance
    const formatEventInstance = (originalEvent, instanceDate) => ({
        ...originalEvent,
        date: instanceDate.toISOString(),
        isRecurringInstance: true,
        originalId: originalEvent.id
    });

    let current = new Date(eventDate);

    // Normalize to 00:00 for comparison
    const normMonthStart = new Date(year, month - 1, 1);
    normMonthStart.setHours(0, 0, 0, 0); // Ensure start of day
    const normMonthEnd = new Date(year, month, 0, 23, 59, 59);
    normMonthEnd.setHours(23, 59, 59, 999); // Ensure end of day

    // Adjust 'current' to the first possible occurrence within or after normMonthStart
    if (event.recurringType === 'DAILY') {
        if (current < normMonthStart) {
            current = new Date(normMonthStart);
        }
    } else if (event.recurringType === 'WEEKLY') {
        if (current < normMonthStart) {
            current = new Date(normMonthStart);
        }
        const targetDay = eventDate.getDay(); // Day of the week (0-6)
        // Find the first occurrence of targetDay on or after 'current'
        while (current.getDay() !== targetDay) {
            current.setDate(current.getDate() + 1);
        }
    } else if (event.recurringType === 'MONTHLY') {
        // For monthly, we need to find the first occurrence in the target month
        // If eventDate.getDate() is 31 and target month only has 30 days, it will roll over to next month.
        // So we need to be careful.
        let tempDate = new Date(year, month - 1, eventDate.getDate());
        if (tempDate.getMonth() !== (month - 1 + 12) % 12) { // Check if day overflowed to next month
            tempDate = new Date(year, month - 1, 0); // Set to last day of current month
        }
        current = tempDate;
    } else if (event.recurringType === 'YEARLY') {
        // For yearly, we need to find the first occurrence in the target year/month
        let tempDate = new Date(year, eventDate.getMonth(), eventDate.getDate());
        if (tempDate.getMonth() !== eventDate.getMonth() || tempDate.getDate() !== eventDate.getDate()) {
            // Day overflowed (e.g., Feb 29 on non-leap year), skip this year
            return results;
        }
        current = tempDate;
    }

    // Ensure 'current' is not before the original event's start date
    if (current < eventDate) {
        current = new Date(eventDate);
    }

    while (current <= normMonthEnd && (!recurEnd || current <= recurEnd)) {
        // Ensure we only add if it's within the requested month range
        // and not before the original event's start date
        if (current >= normMonthStart && current >= eventDate) {
            results.push(formatEventInstance(event, current));
        }

        // Advance 'current' to the next occurrence
        if (event.recurringType === 'DAILY') {
            current.setDate(current.getDate() + 1);
        } else if (event.recurringType === 'WEEKLY') {
            current.setDate(current.getDate() + 7);
        } else if (event.recurringType === 'MONTHLY') {
            // For monthly, we only want one instance per month for the current view
            // The initial 'current' calculation already set it to the correct day in the target month.
            // If we are iterating through a month, we only want one instance.
            // If the event date is 25th, and we are looking at Feb, we want Feb 25.
            // If we are looking at March, we want March 25.
            // The loop structure here is for iterating *days*, not months.
            // So, for MONTHLY, we should just add the one instance for the month and break.
            // The initial 'current' calculation already handles finding the correct day in the target month.
            break; // Only one monthly event per month view
        } else if (event.recurringType === 'YEARLY') {
            // For yearly, we only want one instance per year for the current view
            break; // Only one yearly event per month view
        }
    }
    return results;
}

// ====== CONTROLLERS ======

// GET /api/calendar?month=2&year=2026
const getEvents = async (req, res) => {
    try {
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
                    const { sendMessage } = whatsappService;
                    console.log(`[Calendar Create] Sending notifications to ${event.pics.length} PICs...`);

                    for (const pic of event.pics) {
                        if (!pic.phone) continue;

                        const dateStr = new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                        let msg = `📅 *Assalamu'alaykum Warahmatullahi Wabarakatuh*\n\n`;
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
                            await sendMessage(pic.phone, msg);
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
                    const { sendMessage } = whatsappService;
                    const newPics = await prisma.user.findMany({
                        where: { id: { in: toAddIds } },
                        select: { id: true, name: true, phone: true }
                    });

                    console.log(`[Calendar Update] Sending notifications to ${newPics.length} NEW PICs...`);

                    for (const pic of newPics) {
                        if (!pic.phone) continue;

                        const dateStr = new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                        let msg = `📅 *TUGAS BARU (KALENDER)*\n\n`;
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
                            await sendMessage(pic.phone, msg);
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

        const { sendMessage } = whatsappService;

        // Async Background Sending
        (async () => {
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

                // Random delay between 30-120 seconds per PIC to ensure staggered sending (10-11 range approx)
                const delay = 30000 + Math.random() * 90000;
                await new Promise(resolve => setTimeout(resolve, delay));

                try {
                    await sendMessage(data.phone, msg);
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
        console.log(`[Weekly Summary] Found ${allWeekly.length} events for this week.`);

        if (allWeekly.length === 0) {
            console.log('[Weekly Summary] No events for this week. Sending empty report.');
            const emptyMsg = `📅 *LAPORAN KEGIATAN PEKAN INI*\nPeriode: ${monday.toLocaleDateString('id-ID')} - ${sunday.toLocaleDateString('id-ID')}\n\n*Tidak ada agenda kegiatan yang tercatat untuk pekan ini.*\n\nTerima kasih.`;
            for (const lead of leads) {
                await whatsappService.sendMessage(lead.phone, emptyMsg);
                console.log(`[Weekly Summary] Empty report sent to ${lead.name}`);
            }
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
