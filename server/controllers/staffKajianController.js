const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { deleteFile } = require('../services/minioService');

let tableEnsured = false;
const ensureTableExists = async () => {
    if (tableEnsured) return;
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS \`KehadiranKajian\` (
              \`id\` INT NOT NULL AUTO_INCREMENT,
              \`userId\` INT NOT NULL,
              \`date\` DATETIME(3) NOT NULL,
              \`title\` VARCHAR(191) NOT NULL,
              \`speaker\` VARCHAR(191) NOT NULL,
              \`location\` VARCHAR(191) NOT NULL,
              \`summary\` TEXT NULL,
              \`photoUrl\` TEXT NULL,
              \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
              \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
              PRIMARY KEY (\`id\`),
              INDEX \`KehadiranKajian_userId_idx\` (\`userId\`),
              INDEX \`KehadiranKajian_date_idx\` (\`date\`),
              CONSTRAINT \`KehadiranKajian_userId_fkey\` FOREIGN KEY (\`userId\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        `);
        tableEnsured = true;
    } catch (e) {
        try {
            await prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS \`KehadiranKajian\` (
                  \`id\` INT NOT NULL AUTO_INCREMENT,
                  \`userId\` INT NOT NULL,
                  \`date\` DATETIME(3) NOT NULL,
                  \`title\` VARCHAR(191) NOT NULL,
                  \`speaker\` VARCHAR(191) NOT NULL,
                  \`location\` VARCHAR(191) NOT NULL,
                  \`summary\` TEXT NULL,
                  \`photoUrl\` TEXT NULL,
                  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                  \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
                  PRIMARY KEY (\`id\`),
                  INDEX \`KehadiranKajian_userId_idx\` (\`userId\`),
                  INDEX \`KehadiranKajian_date_idx\` (\`date\`)
                ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
            `);
            tableEnsured = true;
        } catch (innerErr) {
            console.warn('[KehadiranKajian] Ensure table warning:', innerErr.message);
        }
    }
};

const checkIsManager = (user) => {
    if (!user) return false;
    const role = user.role || '';
    const pos = (user.position || '').toLowerCase();
    return ['KABID_SARPRAS', 'SUPER_ADMIN', 'ADMIN_ASET'].includes(role) ||
        pos.includes('kepala bidang') ||
        pos.includes('kabid') ||
        pos.includes('admin aset') ||
        pos.includes('manajemen aset');
};

/**
 * Mengambil daftar kehadiran kajian staf
 */
exports.getKajianList = async (req, res) => {
    await ensureTableExists();
    try {
        const currentUser = req.user;
        const isManager = checkIsManager(currentUser);
        const { userId, search, startDate, endDate, page = 1, limit = 50 } = req.query;

        const where = {};

        if (!isManager) {
            where.userId = currentUser.id;
        } else if (userId && userId !== 'ALL') {
            where.userId = parseInt(userId);
        }

        if (search && search.trim()) {
            const q = search.trim();
            where.OR = [
                { title: { contains: q } },
                { speaker: { contains: q } },
                { location: { contains: q } },
                { summary: { contains: q } },
                { user: { name: { contains: q } } }
            ];
        }

        if (startDate && endDate) {
            where.date = {
                gte: new Date(startDate),
                lte: new Date(`${endDate}T23:59:59.999Z`)
            };
        } else if (startDate) {
            where.date = { gte: new Date(startDate) };
        } else if (endDate) {
            where.date = { lte: new Date(`${endDate}T23:59:59.999Z`) };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        const [kajianList, total] = await Promise.all([
            prisma.kehadiranKajian.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            username: true,
                            position: true,
                            unit: { select: { id: true, name: true } }
                        }
                    }
                },
                orderBy: { date: 'desc' },
                skip,
                take
            }),
            prisma.kehadiranKajian.count({ where })
        ]);

        res.json({
            success: true,
            data: kajianList,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / take)
            }
        });
    } catch (error) {
        console.error('[KehadiranKajian] getKajianList error:', error);
        res.status(500).json({ error: error.message || 'Gagal memuat data kehadiran kajian' });
    }
};

/**
 * Statistik kehadiran kajian staf
 */
exports.getKajianStats = async (req, res) => {
    await ensureTableExists();
    try {
        const currentUser = req.user;
        const isManager = checkIsManager(currentUser);
        const { userId } = req.query;

        const where = {};
        if (!isManager) {
            where.userId = currentUser.id;
        } else if (userId && userId !== 'ALL') {
            where.userId = parseInt(userId);
        }

        const allRecords = await prisma.kehadiranKajian.findMany({
            where,
            select: {
                id: true,
                userId: true,
                date: true,
                speaker: true,
                location: true,
                photoUrl: true
            }
        });

        const now = new Date();
        const curMonth = now.getMonth();
        const curYear = now.getFullYear();

        const totalKajian = allRecords.length;
        let thisMonthCount = 0;
        let thisYearCount = 0;
        let withPhotoCount = 0;

        const locationSet = new Set();
        const speakerSet = new Set();
        const participantSet = new Set();

        allRecords.forEach(r => {
            const d = new Date(r.date);
            if (d.getFullYear() === curYear) {
                thisYearCount++;
                if (d.getMonth() === curMonth) {
                    thisMonthCount++;
                }
            }
            if (r.photoUrl) withPhotoCount++;
            if (r.location && r.location.trim()) {
                locationSet.add(r.location.trim().toLowerCase());
            }
            if (r.speaker && r.speaker.trim()) {
                speakerSet.add(r.speaker.trim().toLowerCase());
            }
            if (r.userId) {
                participantSet.add(r.userId);
            }
        });

        res.json({
            success: true,
            stats: {
                totalKajian,
                thisMonthCount,
                thisYearCount,
                withPhotoCount,
                uniqueLocations: locationSet.size,
                uniqueSpeakers: speakerSet.size,
                uniqueParticipants: participantSet.size
            }
        });
    } catch (error) {
        console.error('[KehadiranKajian] getKajianStats error:', error);
        res.status(500).json({ error: error.message || 'Gagal menghitung statistik kajian' });
    }
};

/**
 * Catat kehadiran kajian baru
 */
exports.createKajian = async (req, res) => {
    await ensureTableExists();
    try {
        const currentUser = req.user;
        const isManager = checkIsManager(currentUser);
        const { date, title, speaker, location, summary, userId } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Judul kajian wajib diisi' });
        }
        if (!speaker || !speaker.trim()) {
            return res.status(400).json({ error: 'Penceramah / Ustadz wajib diisi' });
        }
        if (!location || !location.trim()) {
            return res.status(400).json({ error: 'Lokasi kajian (Nama Masjid) wajib diisi' });
        }

        let targetUserId = currentUser.id;
        if (isManager && userId) {
            targetUserId = parseInt(userId);
        }

        const kajianDate = date ? new Date(date) : new Date();
        const photoUrl = req.fileUrl || req.body.photoUrl || null;

        const newKajian = await prisma.kehadiranKajian.create({
            data: {
                userId: targetUserId,
                date: kajianDate,
                title: title.trim(),
                speaker: speaker.trim(),
                location: location.trim(),
                summary: summary ? summary.trim() : null,
                photoUrl: photoUrl || null
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        position: true,
                        unit: { select: { id: true, name: true } }
                    }
                }
            }
        });

        res.status(201).json({
            success: true,
            message: 'Kehadiran kajian berhasil dicatat',
            data: newKajian
        });
    } catch (error) {
        console.error('[KehadiranKajian] createKajian error:', error);
        res.status(500).json({ error: error.message || 'Gagal mencatat kehadiran kajian' });
    }
};

/**
 * Perbarui data kehadiran kajian
 */
exports.updateKajian = async (req, res) => {
    await ensureTableExists();
    try {
        const { id } = req.params;
        const currentUser = req.user;
        const isManager = checkIsManager(currentUser);
        const { date, title, speaker, location, summary, userId, removePhoto } = req.body;

        const existing = await prisma.kehadiranKajian.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Data kehadiran kajian tidak ditemukan' });
        }

        if (existing.userId !== currentUser.id && !isManager) {
            return res.status(403).json({ error: 'Akses ditolak. Anda tidak berhak mengubah data ini.' });
        }

        let photoUrl = existing.photoUrl;
        if (req.fileUrl) {
            if (existing.photoUrl) {
                deleteFile(existing.photoUrl).catch(e => console.warn('Failed to delete old photo:', e.message));
            }
            photoUrl = req.fileUrl;
        } else if (removePhoto === 'true' || removePhoto === true) {
            if (existing.photoUrl) {
                deleteFile(existing.photoUrl).catch(e => console.warn('Failed to delete photo:', e.message));
            }
            photoUrl = null;
        } else if (req.body.photoUrl !== undefined) {
            photoUrl = req.body.photoUrl || null;
        }

        let targetUserId = existing.userId;
        if (isManager && userId) {
            targetUserId = parseInt(userId);
        }

        const updateData = {};
        if (date) updateData.date = new Date(date);
        if (title !== undefined) updateData.title = title.trim();
        if (speaker !== undefined) updateData.speaker = speaker.trim();
        if (location !== undefined) updateData.location = location.trim();
        if (summary !== undefined) updateData.summary = summary ? summary.trim() : null;
        updateData.photoUrl = photoUrl;
        updateData.userId = targetUserId;

        const updated = await prisma.kehadiranKajian.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        position: true,
                        unit: { select: { id: true, name: true } }
                    }
                }
            }
        });

        res.json({
            success: true,
            message: 'Data kehadiran kajian berhasil diperbarui',
            data: updated
        });
    } catch (error) {
        console.error('[KehadiranKajian] updateKajian error:', error);
        res.status(500).json({ error: error.message || 'Gagal memperbarui data kehadiran kajian' });
    }
};

/**
 * Hapus data kehadiran kajian
 */
exports.deleteKajian = async (req, res) => {
    await ensureTableExists();
    try {
        const { id } = req.params;
        const currentUser = req.user;
        const isManager = checkIsManager(currentUser);

        const existing = await prisma.kehadiranKajian.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Data kehadiran kajian tidak ditemukan' });
        }

        if (existing.userId !== currentUser.id && !isManager) {
            return res.status(403).json({ error: 'Akses ditolak. Anda tidak berhak menghapus data ini.' });
        }

        if (existing.photoUrl) {
            deleteFile(existing.photoUrl).catch(e => console.warn('Failed to delete kajian photo:', e.message));
        }

        await prisma.kehadiranKajian.delete({
            where: { id: parseInt(id) }
        });

        res.json({
            success: true,
            message: 'Data kehadiran kajian berhasil dihapus'
        });
    } catch (error) {
        console.error('[KehadiranKajian] deleteKajian error:', error);
        res.status(500).json({ error: error.message || 'Gagal menghapus data kehadiran kajian' });
    }
};

