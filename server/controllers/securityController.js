const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getDashboard = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const totalPosts = await prisma.securityPost.count({ where: { isActive: true } });
        const totalGuards = await prisma.securityGuard.count({ where: { status: 'ACTIVE' } });
        
        const schedulesToday = await prisma.securitySchedule.findMany({
            where: {
                date: {
                    gte: today,
                    lt: tomorrow
                }
            },
            include: {
                post: true,
                guard: true
            }
        });

        const presentCount = schedulesToday.filter(s => s.status === 'HADIR').length;

        res.json({
            totalPosts,
            totalGuards,
            totalSchedulesToday: schedulesToday.length,
            presentToday: presentCount,
            schedulesToday
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- SECURITY POSTS ---
exports.getPosts = async (req, res) => {
    try {
        const posts = await prisma.securityPost.findMany();
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createPost = async (req, res) => {
    try {
        const post = await prisma.securityPost.create({
            data: req.body
        });
        res.status(201).json(post);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updatePost = async (req, res) => {
    try {
        const post = await prisma.securityPost.update({
            where: { id: parseInt(req.params.id) },
            data: req.body
        });
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deletePost = async (req, res) => {
    try {
        await prisma.securityPost.delete({
            where: { id: parseInt(req.params.id) }
        });
        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- SECURITY GUARDS ---
exports.getGuards = async (req, res) => {
    try {
        const guards = await prisma.securityGuard.findMany();
        res.json(guards);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createGuard = async (req, res) => {
    try {
        const { joinDate, ...rest } = req.body;
        const guard = await prisma.securityGuard.create({
            data: {
                ...rest,
                joinDate: joinDate ? new Date(joinDate) : null
            }
        });
        res.status(201).json(guard);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateGuard = async (req, res) => {
    try {
        const { joinDate, ...rest } = req.body;
        const guard = await prisma.securityGuard.update({
            where: { id: parseInt(req.params.id) },
            data: {
                ...rest,
                joinDate: joinDate ? new Date(joinDate) : undefined
            }
        });
        res.json(guard);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteGuard = async (req, res) => {
    try {
        await prisma.securityGuard.delete({
            where: { id: parseInt(req.params.id) }
        });
        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- SECURITY SCHEDULES ---
exports.getSchedules = async (req, res) => {
    try {
        const { start, end, guardId, postId } = req.query;
        let where = {};
        
        if (start && end) {
            where.date = {
                gte: new Date(start),
                lte: new Date(end)
            };
        }
        if (guardId) where.guardId = parseInt(guardId);
        if (postId) where.postId = parseInt(postId);

        const schedules = await prisma.securitySchedule.findMany({
            where,
            include: {
                post: true,
                guard: true
            },
            orderBy: [
                { date: 'asc' },
                { shift: 'asc' }
            ]
        });
        res.json(schedules);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createSchedule = async (req, res) => {
    try {
        const { date, shift, postId, guardId, isOvertime, overtimeHours } = req.body;
        
        const schedule = await prisma.securitySchedule.create({
            data: {
                date: new Date(date),
                shift,
                postId: parseInt(postId),
                guardId: parseInt(guardId),
                isOvertime: isOvertime || false,
                overtimeHours: overtimeHours ? parseFloat(overtimeHours) : null
            },
            include: {
                post: true,
                guard: true
            }
        });
        res.status(201).json(schedule);
    } catch (error) {
        // Handle unique constraint violation
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Jadwal untuk guard ini di pos dan shift tersebut sudah ada pada tanggal ini.' });
        }
        res.status(500).json({ error: error.message });
    }
};

exports.updateSchedule = async (req, res) => {
    try {
        const { date, shift, postId, guardId, status, note, isOvertime, overtimeHours } = req.body;
        
        const dataToUpdate = {};
        if (date) dataToUpdate.date = new Date(date);
        if (shift) dataToUpdate.shift = shift;
        if (postId) dataToUpdate.postId = parseInt(postId);
        if (guardId) dataToUpdate.guardId = parseInt(guardId);
        if (status) dataToUpdate.status = status;
        if (note !== undefined) dataToUpdate.note = note;
        if (isOvertime !== undefined) dataToUpdate.isOvertime = isOvertime;
        if (overtimeHours !== undefined) dataToUpdate.overtimeHours = overtimeHours ? parseFloat(overtimeHours) : null;

        const schedule = await prisma.securitySchedule.update({
            where: { id: parseInt(req.params.id) },
            data: dataToUpdate,
            include: {
                post: true,
                guard: true
            }
        });
        res.json(schedule);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Jadwal bentrok (sudah ada data yang sama).' });
        }
        res.status(500).json({ error: error.message });
    }
};

exports.deleteSchedule = async (req, res) => {
    try {
        await prisma.securitySchedule.delete({
            where: { id: parseInt(req.params.id) }
        });
        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateAttendance = async (req, res) => {
    try {
        const { status } = req.body; // HADIR, TIDAK_HADIR, IZIN
        const schedule = await prisma.securitySchedule.update({
            where: { id: parseInt(req.params.id) },
            data: { status }
        });
        res.json(schedule);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.generateSchedule = async (req, res) => {
    try {
        const { startDate, endDate } = req.body;
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (isNaN(start) || isNaN(end) || start > end) {
            return res.status(400).json({ error: 'Format tanggal tidak valid.' });
        }

        // Get active guards and active posts
        const guards = await prisma.securityGuard.findMany({ where: { status: 'ACTIVE' } });
        const posts = await prisma.securityPost.findMany({ where: { isActive: true } });

        if (guards.length === 0 || posts.length === 0) {
            return res.status(400).json({ error: 'Tidak ada data guard aktif atau pos aktif.' });
        }

        const generatedSchedules = [];
        let guardIndex = 0;

        // Simple round-robin generation
        // For each day, each shift, each post -> assign a guard
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            for (const post of posts) {
                // capacity determines how many guards per shift per post
                for (let i = 0; i < post.capacity; i++) {
                    // SIANG shift
                    let guardSiang = guards[guardIndex % guards.length];
                    guardIndex++;
                    generatedSchedules.push({
                        date: new Date(d),
                        shift: 'SIANG',
                        postId: post.id,
                        guardId: guardSiang.id,
                        status: 'SCHEDULED'
                    });

                    // MALAM shift
                    let guardMalam = guards[guardIndex % guards.length];
                    guardIndex++;
                    generatedSchedules.push({
                        date: new Date(d),
                        shift: 'MALAM',
                        postId: post.id,
                        guardId: guardMalam.id,
                        status: 'SCHEDULED'
                    });
                }
            }
        }

        // We use createMany with skipDuplicates to avoid crashing on already existing schedules
        const result = await prisma.securitySchedule.createMany({
            data: generatedSchedules,
            skipDuplicates: true
        });

        res.json({ message: `Berhasil men-generate ${result.count} jadwal.`, count: result.count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
