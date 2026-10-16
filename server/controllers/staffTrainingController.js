const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { deleteFile } = require('../services/minioService');

let tableEnsured = false;
const ensureTableExists = async () => {
    if (tableEnsured) return;
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS \`StaffTraining\` (
              \`id\` INT NOT NULL AUTO_INCREMENT,
              \`userId\` INT NOT NULL,
              \`title\` VARCHAR(191) NOT NULL,
              \`scheduleDate\` DATETIME(3) NOT NULL,
              \`endDate\` DATETIME(3) NULL,
              \`organizer\` VARCHAR(191) NULL,
              \`location\` VARCHAR(191) NULL,
              \`method\` VARCHAR(191) NOT NULL DEFAULT 'OFFLINE',
              \`description\` TEXT NULL,
              \`certificateNo\` VARCHAR(191) NULL,
              \`fileUrl\` TEXT NOT NULL,
              \`fileName\` VARCHAR(191) NULL,
              \`fileSize\` INT NULL,
              \`moduleUrl\` TEXT NULL,
              \`moduleFileName\` VARCHAR(191) NULL,
              \`moduleFileSize\` INT NULL,
              \`status\` VARCHAR(191) NOT NULL DEFAULT 'COMPLETED',
              \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
              \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
              PRIMARY KEY (\`id\`),
              INDEX \`StaffTraining_userId_idx\` (\`userId\`),
              INDEX \`StaffTraining_scheduleDate_idx\` (\`scheduleDate\`),
              INDEX \`StaffTraining_method_idx\` (\`method\`)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        `);

        // Check and safely add new columns if table existed prior
        try {
            await prisma.$executeRawUnsafe(`ALTER TABLE \`StaffTraining\` ADD COLUMN \`method\` VARCHAR(191) NOT NULL DEFAULT 'OFFLINE' AFTER \`location\`;`);
        } catch (_) {}
        try {
            await prisma.$executeRawUnsafe(`ALTER TABLE \`StaffTraining\` ADD COLUMN \`moduleUrl\` TEXT NULL AFTER \`fileSize\`;`);
        } catch (_) {}
        try {
            await prisma.$executeRawUnsafe(`ALTER TABLE \`StaffTraining\` ADD COLUMN \`moduleFileName\` VARCHAR(191) NULL AFTER \`moduleUrl\`;`);
        } catch (_) {}
        try {
            await prisma.$executeRawUnsafe(`ALTER TABLE \`StaffTraining\` ADD COLUMN \`moduleFileSize\` INT NULL AFTER \`moduleFileName\`;`);
        } catch (_) {}

        tableEnsured = true;
    } catch (e) {
        console.warn('[StaffTraining] Ensure table warning:', e.message);
    }
};

// Helper: Check if user is manager / admin aset / kabid
const isPrivilegedUser = (user) => {
    if (!user) return false;
    const role = user.role || '';
    const pos = (user.position || '').toLowerCase();
    return role === 'KABID_SARPRAS' || 
           role === 'SUPER_ADMIN' || 
           role === 'ADMIN_ASET' || 
           pos.includes('kepala bidang') || 
           pos.includes('admin aset') || 
           pos.includes('manajemen aset') ||
           pos.includes('sarana dan prasarana') ||
           pos.includes('sarpras');
};

/**
 * Get all staff trainings (Filtered by role or specific user)
 */
exports.getTrainings = async (req, res) => {
    await ensureTableExists();
    try {
        const currentUser = req.user;
        const isKabid = isPrivilegedUser(currentUser);

        const { userId, search, method, startDate, endDate, page = 1, limit = 50 } = req.query;

        const where = {};

        // Restrict to current user if not Kabid/Admin
        if (!isKabid) {
            where.userId = currentUser.id;
        } else if (userId && userId !== 'ALL') {
            where.userId = parseInt(userId);
        }

        // Method filter (ONLINE / OFFLINE / HYBRID)
        if (method && method !== 'ALL') {
            where.method = method;
        }

        // Search by title, organizer, location, certificate, or staff name
        if (search && search.trim()) {
            where.OR = [
                { title: { contains: search.trim() } },
                { organizer: { contains: search.trim() } },
                { location: { contains: search.trim() } },
                { certificateNo: { contains: search.trim() } },
                { user: { name: { contains: search.trim() } } }
            ];
        }

        // Date range filter
        if (startDate && endDate) {
            where.scheduleDate = {
                gte: new Date(startDate),
                lte: new Date(`${endDate}T23:59:59.999Z`)
            };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        const [trainings, total] = await Promise.all([
            prisma.staffTraining.findMany({
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
                orderBy: { scheduleDate: 'desc' },
                skip,
                take
            }),
            prisma.staffTraining.count({ where })
        ]);

        res.json({
            success: true,
            data: trainings,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / take)
            }
        });
    } catch (error) {
        console.error('[StaffTraining] getTrainings error:', error);
        res.status(500).json({ error: error.message || 'Gagal memuat data pelatihan karyawan' });
    }
};

/**
 * Get summary stats for trainings
 */
exports.getTrainingStats = async (req, res) => {
    await ensureTableExists();
    try {
        const currentUser = req.user;
        const isKabid = isPrivilegedUser(currentUser);

        const where = isKabid ? {} : { userId: currentUser.id };

        const allRecords = await prisma.staffTraining.findMany({
            where,
            select: {
                id: true,
                userId: true,
                method: true,
                scheduleDate: true,
                fileSize: true,
                moduleUrl: true
            }
        });

        const totalTrainings = allRecords.length;
        const uniqueParticipants = new Set(allRecords.map(r => r.userId)).size;
        const onlineCount = allRecords.filter(r => r.method === 'ONLINE').length;
        const offlineCount = allRecords.filter(r => r.method === 'OFFLINE').length;
        const hybridCount = allRecords.filter(r => r.method === 'HYBRID').length;
        const withModuleCount = allRecords.filter(r => Boolean(r.moduleUrl)).length;

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const thisMonthCount = allRecords.filter(r => {
            const d = new Date(r.scheduleDate);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        }).length;

        const thisYearCount = allRecords.filter(r => {
            const d = new Date(r.scheduleDate);
            return d.getFullYear() === currentYear;
        }).length;

        res.json({
            success: true,
            stats: {
                totalTrainings,
                uniqueParticipants,
                thisMonthCount,
                thisYearCount,
                onlineCount,
                offlineCount,
                hybridCount,
                withModuleCount
            }
        });
    } catch (error) {
        console.error('[StaffTraining] getTrainingStats error:', error);
        res.status(500).json({ error: error.message || 'Gagal memuat statistik pelatihan' });
    }
};

/**
 * Create new staff training record
 */
exports.createTraining = async (req, res) => {
    await ensureTableExists();
    try {
        const { title, scheduleDate, endDate, organizer, location, method, description, certificateNo, userId } = req.body;
        const currentUser = req.user;

        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Judul pelatihan wajib diisi' });
        }
        if (!scheduleDate) {
            return res.status(400).json({ error: 'Jadwal pelatihan wajib diisi' });
        }

        // Resolving uploaded files
        const fileUrl = req.fileUrls?.file || req.fileUrl;
        const fileObj = req.files?.file?.[0] || req.file;

        const moduleUrl = req.fileUrls?.moduleFile || null;
        const moduleObj = req.files?.moduleFile?.[0] || null;

        if (!fileUrl) {
            return res.status(400).json({ error: 'Bukti dokumen pelatihan (PDF) wajib diunggah' });
        }

        const isKabid = isPrivilegedUser(currentUser);

        // Target user: default to current user (admin aset / staff who fills it), or selected staff
        let targetUserId = currentUser.id;
        if (userId) {
            targetUserId = parseInt(userId);
        }

        const training = await prisma.staffTraining.create({
            data: {
                userId: targetUserId,
                title: title.trim(),
                scheduleDate: new Date(scheduleDate),
                endDate: endDate ? new Date(endDate) : null,
                organizer: organizer ? organizer.trim() : null,
                location: location ? location.trim() : null,
                method: ['ONLINE', 'OFFLINE', 'HYBRID'].includes(method) ? method : 'OFFLINE',
                description: description ? description.trim() : null,
                certificateNo: certificateNo ? certificateNo.trim() : null,
                fileUrl,
                fileName: fileObj?.originalname || 'Dokumen_Pelatihan.pdf',
                fileSize: fileObj?.size || null,
                moduleUrl,
                moduleFileName: moduleObj?.originalname || null,
                moduleFileSize: moduleObj?.size || null,
                status: 'COMPLETED'
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
            message: 'Data pelatihan karyawan berhasil disimpan ke MinIO',
            data: training
        });
    } catch (error) {
        console.error('[StaffTraining] createTraining error:', error);
        res.status(500).json({ error: error.message || 'Gagal menyimpan data pelatihan' });
    }
};

/**
 * Update staff training record
 */
exports.updateTraining = async (req, res) => {
    await ensureTableExists();
    try {
        const { id } = req.params;
        const { title, scheduleDate, endDate, organizer, location, method, description, certificateNo, status, userId, removeModule } = req.body;
        const currentUser = req.user;

        const existing = await prisma.staffTraining.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Data pelatihan tidak ditemukan' });
        }

        const isKabid = isPrivilegedUser(currentUser);

        // Permission check
        if (!isKabid && existing.userId !== currentUser.id) {
            return res.status(403).json({ error: 'Anda tidak memiliki hak akses untuk mengubah data ini' });
        }

        const updateData = {};
        if (title !== undefined) updateData.title = title.trim();
        if (scheduleDate !== undefined) updateData.scheduleDate = new Date(scheduleDate);
        if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
        if (organizer !== undefined) updateData.organizer = organizer ? organizer.trim() : null;
        if (location !== undefined) updateData.location = location ? location.trim() : null;
        if (method !== undefined) updateData.method = ['ONLINE', 'OFFLINE', 'HYBRID'].includes(method) ? method : 'OFFLINE';
        if (description !== undefined) updateData.description = description ? description.trim() : null;
        if (certificateNo !== undefined) updateData.certificateNo = certificateNo ? certificateNo.trim() : null;
        if (status !== undefined) updateData.status = status;
        if (userId !== undefined) updateData.userId = parseInt(userId);

        // Resolving uploaded files
        const newFileUrl = req.fileUrls?.file || req.fileUrl;
        const newFileObj = req.files?.file?.[0] || req.file;

        const newModuleUrl = req.fileUrls?.moduleFile || null;
        const newModuleObj = req.files?.moduleFile?.[0] || null;

        // Replace Bukti file
        if (newFileUrl) {
            if (existing.fileUrl && existing.fileUrl.startsWith('/api/media/')) {
                const objectName = existing.fileUrl.replace('/api/media/', '');
                deleteFile(objectName).catch(e => console.warn('Failed to delete old proof file:', e.message));
            }
            updateData.fileUrl = newFileUrl;
            updateData.fileName = newFileObj?.originalname || 'Dokumen_Pelatihan.pdf';
            updateData.fileSize = newFileObj?.size || null;
        }

        // Replace or remove Module file
        if (newModuleUrl) {
            if (existing.moduleUrl && existing.moduleUrl.startsWith('/api/media/')) {
                const objectName = existing.moduleUrl.replace('/api/media/', '');
                deleteFile(objectName).catch(e => console.warn('Failed to delete old module file:', e.message));
            }
            updateData.moduleUrl = newModuleUrl;
            updateData.moduleFileName = newModuleObj?.originalname || 'Modul_Pelatihan.pdf';
            updateData.moduleFileSize = newModuleObj?.size || null;
        } else if (removeModule === 'true') {
            if (existing.moduleUrl && existing.moduleUrl.startsWith('/api/media/')) {
                const objectName = existing.moduleUrl.replace('/api/media/', '');
                deleteFile(objectName).catch(e => console.warn('Failed to delete module file:', e.message));
            }
            updateData.moduleUrl = null;
            updateData.moduleFileName = null;
            updateData.moduleFileSize = null;
        }

        const updated = await prisma.staffTraining.update({
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
            message: 'Data pelatihan berhasil diperbarui',
            data: updated
        });
    } catch (error) {
        console.error('[StaffTraining] updateTraining error:', error);
        res.status(500).json({ error: error.message || 'Gagal memperbarui data pelatihan' });
    }
};

/**
 * Delete staff training record
 */
exports.deleteTraining = async (req, res) => {
    await ensureTableExists();
    try {
        const { id } = req.params;
        const currentUser = req.user;

        const existing = await prisma.staffTraining.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Data pelatihan tidak ditemukan' });
        }

        const isKabid = isPrivilegedUser(currentUser);

        // Permission check
        if (!isKabid && existing.userId !== currentUser.id) {
            return res.status(403).json({ error: 'Anda tidak memiliki hak akses untuk menghapus data ini' });
        }

        // Delete proof file from MinIO
        if (existing.fileUrl && existing.fileUrl.startsWith('/api/media/')) {
            const objectName = existing.fileUrl.replace('/api/media/', '');
            deleteFile(objectName).catch(e => console.warn('Failed to delete training file from MinIO:', e.message));
        }

        // Delete module file from MinIO if exists
        if (existing.moduleUrl && existing.moduleUrl.startsWith('/api/media/')) {
            const objectName = existing.moduleUrl.replace('/api/media/', '');
            deleteFile(objectName).catch(e => console.warn('Failed to delete training module file from MinIO:', e.message));
        }

        await prisma.staffTraining.delete({
            where: { id: parseInt(id) }
        });

        res.json({
            success: true,
            message: 'Data pelatihan berhasil dihapus'
        });
    } catch (error) {
        console.error('[StaffTraining] deleteTraining error:', error);
        res.status(500).json({ error: error.message || 'Gagal menghapus data pelatihan' });
    }
};
