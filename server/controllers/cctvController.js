const { PrismaClient } = require('@prisma/client');
const {
    isKabidSaranaPosition,
    getUserCctvAccessMeta,
    slugifyStreamPath,
    buildRtspUrl,
    generateMediamtxConfig
} = require('../utils/cctvAccessHelper');
const gateway = require('../utils/cctvGateway');
const embedded = require('../utils/cctvEmbedded');

const prisma = new PrismaClient();

const CAMERA_INCLUDE_UNIT = {
    unit: { select: { id: true, name: true, code: true } }
};

/**
 * Menghilangkan kredensial sensitif (IP, username, password RTSP) agar tidak terkirim ke browser viewer biasa.
 * playback.gateway = true berarti browser memutar video melalui /api/cctv/play/:id/... (proxy backend).
 */
const sanitizeCameraForViewer = (camera, gatewayCfg = null) => {
    const viaGateway = gateway.usesGatewayPlayback(camera);
    const gatewayReady = viaGateway && gateway.isPlaybackConfigured(gatewayCfg);
    const embeddedHlsFirst = gateway.isEmbeddedGateway(gatewayCfg) && process.env.MEDIAMTX_WEBRTC_PUBLIC !== 'true';
    return {
        id: camera.id,
        name: camera.name,
        unitId: camera.unitId,
        unit: camera.unit || null,
        location: camera.location || null,
        brand: camera.brand,
        deviceType: camera.deviceType,
        channelNo: camera.channelNo,
        streamMode: viaGateway ? 'GATEWAY' : camera.streamMode,
        streamUrl: camera.isActive && !viaGateway ? (camera.streamUrl || null) : null,
        streamPath: camera.streamPath || null,
        playback: {
            gateway: viaGateway,
            ready: viaGateway ? gatewayReady : Boolean(camera.streamUrl),
            whep: gatewayReady && !embeddedHlsFirst && Boolean(gatewayCfg.webrtcUrl),
            hls: gatewayReady && Boolean(gatewayCfg.hlsUrl),
            hasSource: viaGateway ? Boolean(buildRtspUrl(camera)) : true
        },
        notes: camera.notes || null,
        isActive: camera.isActive,
        sortOrder: camera.sortOrder
    };
};

/**
 * Normalisasi payload kamera untuk create / update agar konsisten.
 */
const normalizeCameraPayload = async (body, isUpdate = false) => {
    const unitId = body.unitId ? parseInt(body.unitId, 10) : null;
    const deviceType = (body.deviceType || 'DVR_NVR').toUpperCase();
    const channelNo = deviceType === 'WIFI_CAMERA'
        ? 1
        : Math.max(1, parseInt(body.channelNo, 10) || 1);

    let streamPath = body.streamPath ? slugifyStreamPath(body.streamPath) : null;
    if (!streamPath && !isUpdate) {
        let unitCode = '';
        if (unitId) {
            const unit = await prisma.unit.findUnique({ where: { id: unitId }, select: { code: true } });
            unitCode = unit?.code || '';
        }
        const baseName = deviceType === 'DVR_NVR' ? `${body.name || 'cam'}-ch${channelNo}` : (body.name || 'cam');
        const candidate = slugifyStreamPath(baseName, unitCode);
        const existing = await prisma.cctvCamera.findUnique({ where: { streamPath: candidate } });
        streamPath = existing ? `${candidate}-${Date.now().toString().slice(-4)}` : candidate;
    }

    const data = {
        name: String(body.name || '').trim(),
        unitId: Number.isNaN(unitId) ? null : unitId,
        location: body.location ? String(body.location).trim() : null,
        brand: (body.brand || 'HIKVISION').toUpperCase(),
        deviceType,
        channelNo,
        streamMode: (body.streamMode || 'GATEWAY').toUpperCase(),
        streamUrl: body.streamUrl ? String(body.streamUrl).trim() : null,
        streamPath,
        ipAddress: body.ipAddress ? String(body.ipAddress).trim() : null,
        rtspPort: Math.max(1, parseInt(body.rtspPort, 10) || 554),
        rtspUsername: body.rtspUsername ? String(body.rtspUsername).trim() : 'admin',
        rtspQuality: (body.rtspQuality || 'SUB').toUpperCase(),
        rtspCustomUrl: body.rtspCustomUrl ? String(body.rtspCustomUrl).trim() : null,
        notes: body.notes ? String(body.notes).trim() : null,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
        sortOrder: parseInt(body.sortOrder, 10) || 0
    };

    // Pada update, hanya ubah password RTSP jika dikirim secara eksplisit (tidak menimpa jika dikosongkan kecuali memang sengaja)
    if (body.rtspPassword !== undefined) {
        data.rtspPassword = body.rtspPassword ? String(body.rtspPassword) : null;
    }

    return data;
};

/**
 * Middleware: Memastikan hanya akun dengan position Kepala Bidang Sarana yang bisa mengelola CCTV & hak akses.
 */
exports.requireKabidSaranaPosition = (req, res, next) => {
    if (!isKabidSaranaPosition(req.user)) {
        return res.status(403).json({
            error: 'Akses ditolak. Fitur ini hanya dapat diakses oleh position Kepala Bidang Sarana.'
        });
    }
    next();
};

/**
 * GET /api/cctv/my-access
 * Mengecek apakah user saat ini berhak melihat Menu Management CCTV di Sidebar.
 */
exports.getMyAccess = async (req, res) => {
    try {
        const meta = await getUserCctvAccessMeta(req.user, prisma);
        res.json({
            isManager: meta.isCctvManager,
            hasAccess: meta.hasCctvAccess,
            cameraCount: meta.cctvAccessCount
        });
    } catch (error) {
        console.error('getMyAccess error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * GET /api/cctv/streams
 * Mengambil daftar kamera yang boleh ditonton oleh user yang sedang login.
 * Awalnya hanya Kepala Bidang Sarana yang memiliki akses; user lain hanya melihat kamera yang diberikan akses.
 */
exports.getAccessibleStreams = async (req, res) => {
    try {
        const isManager = isKabidSaranaPosition(req.user);

        if (!isManager) {
            const accessCount = await prisma.cctvAccess.count({
                where: { userId: req.user.id }
            });
            if (accessCount === 0) {
                return res.status(403).json({
                    error: 'Anda belum diberikan akses Management CCTV oleh Kepala Bidang Sarana.'
                });
            }
        }

        const cameras = await prisma.cctvCamera.findMany({
            where: isManager
                ? {}
                : { accessList: { some: { userId: req.user.id } } },
            include: CAMERA_INCLUDE_UNIT,
            orderBy: [
                { sortOrder: 'asc' },
                { unitId: 'asc' },
                { id: 'asc' }
            ]
        });

        let gatewayCfg = await gateway.getGatewayConfig(prisma);
        if (!gateway.isPlaybackConfigured(gatewayCfg)) {
            const boot = await embedded.ensureEmbeddedGateway(prisma).catch(() => null);
            if (boot?.started) {
                gatewayCfg = await gateway.getGatewayConfig(prisma);
            }
        }

        res.json({
            isManager,
            gatewayConfigured: gateway.isPlaybackConfigured(gatewayCfg),
            cameras: cameras.map((cam) => sanitizeCameraForViewer(cam, gatewayCfg))
        });
    } catch (error) {
        console.error('getAccessibleStreams error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * GET /api/cctv/cameras (Khusus Kepala Bidang Sarana)
 * Daftar lengkap seluruh kamera beserta detail koneksi dan daftar user yang diberi akses.
 */
exports.getAllCameras = async (req, res) => {
    try {
        const cameras = await prisma.cctvCamera.findMany({
            include: {
                ...CAMERA_INCLUDE_UNIT,
                accessList: { select: { userId: true } }
            },
            orderBy: [
                { sortOrder: 'asc' },
                { unitId: 'asc' },
                { id: 'asc' }
            ]
        });

        const formatted = cameras.map((cam) => ({
            ...cam,
            accessUserIds: cam.accessList.map((a) => a.userId),
            accessCount: cam.accessList.length,
            rtspPreviewUrl: buildRtspUrl(cam),
            usesGateway: gateway.usesGatewayPlayback(cam),
            accessList: undefined
        }));

        res.json(formatted);
    } catch (error) {
        console.error('getAllCameras error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * POST /api/cctv/cameras (Khusus Kepala Bidang Sarana)
 */
exports.createCamera = async (req, res) => {
    try {
        if (!req.body.name || !String(req.body.name).trim()) {
            return res.status(400).json({ error: 'Nama kamera wajib diisi.' });
        }

        const data = await normalizeCameraPayload(req.body, false);
        data.createdById = req.user.id;

        const created = await prisma.cctvCamera.create({
            data,
            include: CAMERA_INCLUDE_UNIT
        });

        const gatewayCfg = await gateway.getGatewayConfig(prisma);
        const gatewaySync = await gateway.syncCamera(gatewayCfg, created);

        res.status(201).json({
            ...created,
            accessUserIds: [],
            accessCount: 0,
            rtspPreviewUrl: buildRtspUrl(created),
            gatewaySync
        });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Stream Path sudah digunakan oleh kamera lain.' });
        }
        console.error('createCamera error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * PUT /api/cctv/cameras/:id (Khusus Kepala Bidang Sarana)
 */
exports.updateCamera = async (req, res) => {
    try {
        const cameraId = parseInt(req.params.id, 10);
        if (Number.isNaN(cameraId)) {
            return res.status(400).json({ error: 'ID kamera tidak valid.' });
        }

        if (!req.body.name || !String(req.body.name).trim()) {
            return res.status(400).json({ error: 'Nama kamera wajib diisi.' });
        }

        const existing = await prisma.cctvCamera.findUnique({ where: { id: cameraId } });
        if (!existing) {
            return res.status(404).json({ error: 'Kamera tidak ditemukan.' });
        }

        const data = await normalizeCameraPayload(req.body, true);
        if (!data.streamPath) {
            data.streamPath = existing.streamPath;
        }

        const updated = await prisma.cctvCamera.update({
            where: { id: cameraId },
            data,
            include: {
                ...CAMERA_INCLUDE_UNIT,
                accessList: { select: { userId: true } }
            }
        });

        const gatewayCfg = await gateway.getGatewayConfig(prisma);
        const gatewaySync = await gateway.syncCamera(gatewayCfg, updated, existing.streamPath);

        res.json({
            ...updated,
            accessUserIds: updated.accessList.map((a) => a.userId),
            accessCount: updated.accessList.length,
            rtspPreviewUrl: buildRtspUrl(updated),
            accessList: undefined,
            gatewaySync
        });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Stream Path sudah digunakan oleh kamera lain.' });
        }
        console.error('updateCamera error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * PATCH /api/cctv/cameras/:id/toggle (Khusus Kepala Bidang Sarana)
 */
exports.toggleCameraStatus = async (req, res) => {
    try {
        const cameraId = parseInt(req.params.id, 10);
        const existing = await prisma.cctvCamera.findUnique({ where: { id: cameraId } });
        if (!existing) {
            return res.status(404).json({ error: 'Kamera tidak ditemukan.' });
        }

        const updated = await prisma.cctvCamera.update({
            where: { id: cameraId },
            data: { isActive: !existing.isActive }
        });

        const gatewayCfg = await gateway.getGatewayConfig(prisma);
        const gatewaySync = await gateway.syncCamera(gatewayCfg, updated);

        res.json({ ...updated, gatewaySync });
    } catch (error) {
        console.error('toggleCameraStatus error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * DELETE /api/cctv/cameras/:id (Khusus Kepala Bidang Sarana)
 */
exports.deleteCamera = async (req, res) => {
    try {
        const cameraId = parseInt(req.params.id, 10);
        const existing = await prisma.cctvCamera.findUnique({ where: { id: cameraId } });
        if (!existing) {
            return res.status(404).json({ error: 'Kamera tidak ditemukan.' });
        }

        await prisma.cctvCamera.delete({ where: { id: cameraId } });

        const gatewayCfg = await gateway.getGatewayConfig(prisma);
        if (gatewayCfg.apiUrl) {
            await gateway.deleteCameraPath(gatewayCfg, existing.streamPath).catch(() => null);
        }

        res.json({ message: 'Kamera berhasil dihapus.' });
    } catch (error) {
        console.error('deleteCamera error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * GET /api/cctv/access/users (Khusus Kepala Bidang Sarana)
 * Daftar seluruh user beserta daftar cameraId yang sudah diizinkan untuk masing-masing user.
 */
exports.getUsersForAccess = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                name: true,
                nip: true,
                position: true,
                role: true,
                unitId: true,
                unit: { select: { id: true, name: true, code: true } },
                cctvAccesses: {
                    select: { cameraId: true }
                }
            },
            orderBy: [
                { name: 'asc' },
                { username: 'asc' }
            ]
        });

        const formatted = users.map((u) => {
            const grantedCameraIds = u.cctvAccesses.map((a) => a.cameraId);
            const isCctvManager = isKabidSaranaPosition(u);
            return {
                id: u.id,
                username: u.username,
                name: u.name,
                nip: u.nip,
                position: u.position,
                role: u.role,
                unitId: u.unitId,
                unit: u.unit,
                isCctvManager,
                grantedCameraIds,
                grantedCount: grantedCameraIds.length
            };
        });

        res.json(formatted);
    } catch (error) {
        console.error('getUsersForAccess error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * PUT /api/cctv/access/user/:userId (Khusus Kepala Bidang Sarana)
 * Menetapkan daftar kamera yang boleh diakses oleh 1 user spesifik.
 */
exports.updateUserAccess = async (req, res) => {
    try {
        const targetUserId = parseInt(req.params.userId, 10);
        if (Number.isNaN(targetUserId)) {
            return res.status(400).json({ error: 'ID user tidak valid.' });
        }

        const targetUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: { id: true, name: true, username: true, position: true }
        });
        if (!targetUser) {
            return res.status(404).json({ error: 'User tidak ditemukan.' });
        }

        const rawCameraIds = Array.isArray(req.body.cameraIds) ? req.body.cameraIds : [];
        const requestedIds = [...new Set(
            rawCameraIds.map((id) => parseInt(id, 10)).filter((id) => !Number.isNaN(id))
        )];

        // Pastikan hanya cameraId yang benar-benar ada di database yang disimpan
        const existingCameras = requestedIds.length > 0
            ? await prisma.cctvCamera.findMany({
                where: { id: { in: requestedIds } },
                select: { id: true }
            })
            : [];
        const validCameraIds = existingCameras.map((c) => c.id);

        await prisma.$transaction(async (tx) => {
            await tx.cctvAccess.deleteMany({
                where: { userId: targetUserId }
            });

            if (validCameraIds.length > 0) {
                await tx.cctvAccess.createMany({
                    data: validCameraIds.map((cameraId) => ({
                        userId: targetUserId,
                        cameraId,
                        grantedById: req.user.id
                    })),
                    skipDuplicates: true
                });
            }
        });

        res.json({
            message: `Hak akses CCTV untuk ${targetUser.name || targetUser.username} berhasil diperbarui (${validCameraIds.length} kamera).`,
            userId: targetUserId,
            grantedCameraIds: validCameraIds,
            grantedCount: validCameraIds.length
        });
    } catch (error) {
        console.error('updateUserAccess error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * PUT /api/cctv/access/camera/:cameraId (Khusus Kepala Bidang Sarana)
 * Menetapkan daftar user yang boleh mengakses 1 kamera tertentu.
 */
exports.updateCameraAccess = async (req, res) => {
    try {
        const cameraId = parseInt(req.params.cameraId, 10);
        if (Number.isNaN(cameraId)) {
            return res.status(400).json({ error: 'ID kamera tidak valid.' });
        }

        const camera = await prisma.cctvCamera.findUnique({
            where: { id: cameraId },
            select: { id: true, name: true }
        });
        if (!camera) {
            return res.status(404).json({ error: 'Kamera tidak ditemukan.' });
        }

        const rawUserIds = Array.isArray(req.body.userIds) ? req.body.userIds : [];
        const requestedIds = [...new Set(
            rawUserIds.map((id) => parseInt(id, 10)).filter((id) => !Number.isNaN(id))
        )];

        const existingUsers = requestedIds.length > 0
            ? await prisma.user.findMany({
                where: { id: { in: requestedIds } },
                select: { id: true }
            })
            : [];
        const validUserIds = existingUsers.map((u) => u.id);

        await prisma.$transaction(async (tx) => {
            await tx.cctvAccess.deleteMany({
                where: { cameraId }
            });

            if (validUserIds.length > 0) {
                await tx.cctvAccess.createMany({
                    data: validUserIds.map((userId) => ({
                        userId,
                        cameraId,
                        grantedById: req.user.id
                    })),
                    skipDuplicates: true
                });
            }
        });

        res.json({
            message: `Daftar pengguna untuk kamera "${camera.name}" berhasil diperbarui (${validUserIds.length} pengguna).`,
            cameraId,
            accessUserIds: validUserIds,
            accessCount: validUserIds.length
        });
    } catch (error) {
        console.error('updateCameraAccess error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * GET /api/cctv/mediamtx-config (Khusus Kepala Bidang Sarana)
 * Menghasilkan isi file mediamtx.yml siap pakai dari seluruh kamera aktif.
 */
exports.getMediamtxConfig = async (req, res) => {
    try {
        const [cameras, gatewayCfg] = await Promise.all([
            prisma.cctvCamera.findMany({
                include: CAMERA_INCLUDE_UNIT,
                orderBy: [
                    { sortOrder: 'asc' },
                    { unitId: 'asc' },
                    { id: 'asc' }
                ]
            }),
            gateway.getGatewayConfig(prisma)
        ]);

        const yamlConfig = generateMediamtxConfig(cameras, gatewayCfg);
        res.json({
            yaml: yamlConfig,
            totalCameras: cameras.length,
            configuredCount: cameras.filter((c) => c.isActive && buildRtspUrl(c)).length,
            hasGatewayCredentials: Boolean(gatewayCfg.username && gatewayCfg.password)
        });
    } catch (error) {
        console.error('getMediamtxConfig error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * GET /api/cctv/gateway (Khusus Kepala Bidang Sarana)
 */
exports.getGatewaySettings = async (req, res) => {
    try {
        await embedded.ensureEmbeddedGateway(prisma).catch(() => null);
        const cfg = await gateway.getGatewayConfig(prisma);
        res.json({
            webrtcUrl: cfg.webrtcUrl,
            hlsUrl: cfg.hlsUrl,
            apiUrl: cfg.apiUrl,
            username: cfg.username,
            hasPassword: Boolean(cfg.password),
            configured: gateway.isPlaybackConfigured(cfg),
            isUsingEmbedded: gateway.isEmbeddedGateway(cfg),
            embedded: embedded.getEmbeddedStatus(),
            updatedAt: cfg.updatedAt
        });
    } catch (error) {
        console.error('getGatewaySettings error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * PUT /api/cctv/gateway (Khusus Kepala Bidang Sarana)
 */
exports.saveGatewaySettings = async (req, res) => {
    try {
        const existing = await prisma.cctvGateway.findUnique({ where: { id: 1 } }).catch(() => null);
        const trimSlash = (v) => String(v || '').trim().replace(/\/+$/, '');

        const data = {
            webrtcUrl: trimSlash(req.body.webrtcUrl) || null,
            hlsUrl: trimSlash(req.body.hlsUrl) || null,
            apiUrl: trimSlash(req.body.apiUrl) || null,
            username: String(req.body.username || '').trim() || null,
            updatedById: req.user.id
        };

        if (req.body.clearPassword) {
            data.password = null;
        } else if (req.body.password !== undefined && String(req.body.password) !== '') {
            data.password = String(req.body.password);
        } else if (existing) {
            data.password = existing.password;
        }

        const saved = await prisma.cctvGateway.upsert({
            where: { id: 1 },
            update: data,
            create: { id: 1, ...data }
        });

        // Jika dikosongkan semua dan MediaMTX tertanam tersedia, hidupkan kembali mode bawaan
        if (!saved.apiUrl && !saved.hlsUrl && !saved.webrtcUrl) {
            await embedded.ensureEmbeddedGateway(prisma).catch(() => null);
        } else if (
            (saved.apiUrl && !saved.apiUrl.includes('127.0.0.1')) ||
            (saved.hlsUrl && !saved.hlsUrl.includes('127.0.0.1'))
        ) {
            embedded.stopEmbeddedMediamtx();
        } else {
            await embedded.ensureEmbeddedGateway(prisma).catch(() => null);
        }

        const cfg = await gateway.getGatewayConfig(prisma);
        res.json({
            message: 'Pengaturan Gateway MediaMTX berhasil disimpan.',
            gateway: {
                webrtcUrl: cfg.webrtcUrl,
                hlsUrl: cfg.hlsUrl,
                apiUrl: cfg.apiUrl,
                username: cfg.username,
                hasPassword: Boolean(cfg.password),
                configured: gateway.isPlaybackConfigured(cfg),
                isUsingEmbedded: gateway.isEmbeddedGateway(cfg),
                embedded: embedded.getEmbeddedStatus(),
                updatedAt: saved.updatedAt
            }
        });
    } catch (error) {
        console.error('saveGatewaySettings error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * POST /api/cctv/gateway/test (Khusus Kepala Bidang Sarana)
 */
exports.testGatewayConnection = async (req, res) => {
    try {
        const savedCfg = await gateway.getGatewayConfig(prisma);
        const trimSlash = (v) => String(v || '').trim().replace(/\/+$/, '');

        const testCfg = {
            webrtcUrl: req.body?.webrtcUrl !== undefined ? trimSlash(req.body.webrtcUrl) : savedCfg.webrtcUrl,
            hlsUrl: req.body?.hlsUrl !== undefined ? trimSlash(req.body.hlsUrl) : savedCfg.hlsUrl,
            apiUrl: req.body?.apiUrl !== undefined ? trimSlash(req.body.apiUrl) : savedCfg.apiUrl,
            username: req.body?.username !== undefined ? String(req.body.username || '').trim() : savedCfg.username,
            password: req.body?.password ? String(req.body.password) : savedCfg.password
        };

        const report = await gateway.testGateway(testCfg);
        res.json(report);
    } catch (error) {
        console.error('testGatewayConnection error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * POST /api/cctv/gateway/sync (Khusus Kepala Bidang Sarana)
 * Mendaftarkan/memperbarui seluruh path kamera aktif ke MediaMTX lewat Control API.
 */
exports.syncGatewayCameras = async (req, res) => {
    try {
        const cfg = await gateway.getGatewayConfig(prisma);
        if (!cfg.apiUrl) {
            return res.status(400).json({
                error: 'Alamat Control API MediaMTX (port 9997) belum diisi pada Pengaturan Gateway.'
            });
        }

        const cameras = await prisma.cctvCamera.findMany({
            include: CAMERA_INCLUDE_UNIT,
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
        });

        const results = await gateway.syncAllCameras(cfg, cameras);
        const syncedCount = results.filter((r) => r.ok && !r.skipped).length;
        const skippedCount = results.filter((r) => r.skipped).length;
        const failedCount = results.filter((r) => !r.ok && !r.skipped).length;

        res.json({
            total: cameras.length,
            syncedCount,
            skippedCount,
            failedCount,
            results
        });
    } catch (error) {
        console.error('syncGatewayCameras error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * POST /api/cctv/cameras/:id/test (Khusus Kepala Bidang Sarana)
 * Mengetes tarikan stream RTSP kamera lewat MediaMTX dan memeriksa codec (H.264 vs H.265).
 */
exports.testCameraStream = async (req, res) => {
    try {
        const cameraId = parseInt(req.params.id, 10);
        if (Number.isNaN(cameraId)) {
            return res.status(400).json({ error: 'ID kamera tidak valid.' });
        }

        const camera = await prisma.cctvCamera.findUnique({
            where: { id: cameraId },
            include: CAMERA_INCLUDE_UNIT
        });
        if (!camera) {
            return res.status(404).json({ error: 'Kamera tidak ditemukan.' });
        }

        const cfg = await gateway.getGatewayConfig(prisma);
        const result = await gateway.testCameraStream(cfg, camera);
        res.json({
            cameraId: camera.id,
            cameraName: camera.name,
            ...result
        });
    } catch (error) {
        console.error('testCameraStream error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Helper: memvalidasi hak akses user sebelum memproksi stream kamera.
 */
const assertCameraPlayAccess = async (req, cameraIdParam) => {
    const cameraId = parseInt(cameraIdParam, 10);
    if (Number.isNaN(cameraId)) {
        return { errorStatus: 400, error: 'ID kamera tidak valid.' };
    }

    const camera = await prisma.cctvCamera.findUnique({ where: { id: cameraId } });
    if (!camera) {
        return { errorStatus: 404, error: 'Kamera tidak ditemukan.' };
    }
    if (!camera.isActive) {
        return { errorStatus: 403, error: 'Kamera sedang dinonaktifkan / maintenance.' };
    }

    if (!isKabidSaranaPosition(req.user)) {
        const access = await prisma.cctvAccess.findUnique({
            where: {
                userId_cameraId: { userId: req.user.id, cameraId: camera.id }
            }
        });
        if (!access) {
            return { errorStatus: 403, error: 'Anda tidak memiliki akses ke kamera ini.' };
        }
    }

    if (!camera.streamPath) {
        return { errorStatus: 400, error: 'Kode path MediaMTX pada kamera ini belum diatur.' };
    }

    const gatewayCfg = await gateway.getGatewayConfig(prisma);
    return { camera, gatewayCfg };
};

/**
 * Helper: memanggil MediaMTX; bila MediaMTX membalas 404 (misal container MediaMTX baru restart),
 * daftarkan ulang path kamera lewat Control API lalu ulangi permintaan 1 kali.
 */
const fetchGatewayWithAutoSync = async (upstreamUrl, fetchOptions, timeoutMs, camera, gatewayCfg) => {
    let upstreamRes = await gateway.fetchWithTimeout(upstreamUrl, fetchOptions, timeoutMs);
    if (upstreamRes.status === 404 && gatewayCfg?.apiUrl && buildRtspUrl(camera)) {
        await upstreamRes.arrayBuffer().catch(() => null);
        const sync = await gateway.syncCamera(gatewayCfg, camera);
        if (sync.ok) {
            upstreamRes = await gateway.fetchWithTimeout(upstreamUrl, fetchOptions, timeoutMs);
        }
    }
    return upstreamRes;
};

/**
 * Sinkronisasi awal saat server boot agar MediaMTX tertanam langsung menyala dan seluruh kamera terdaftar.
 */
exports.syncAllOnBoot = async () => {
    try {
        const bootResult = await embedded.ensureEmbeddedGateway(prisma);
        if (bootResult?.started && !bootResult.alreadyRunning) {
            await new Promise((r) => setTimeout(r, 1200));
        }

        const cfg = await gateway.getGatewayConfig(prisma);
        if (!cfg.apiUrl) return;
        const cameras = await prisma.cctvCamera.findMany({
            where: { isActive: true },
            include: CAMERA_INCLUDE_UNIT,
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
        });
        if (cameras.length > 0) {
            await gateway.syncAllCameras(cfg, cameras);
        }
    } catch {
        // Abaikan error saat boot bila gateway belum menyala
    }
};

/**
 * POST /api/cctv/play/:id/whep
 * Proxy WebRTC WHEP handshake dari browser ke MediaMTX.
 */
exports.playWhep = async (req, res) => {
    try {
        const check = await assertCameraPlayAccess(req, req.params.id);
        if (check.errorStatus) {
            return res.status(check.errorStatus).json({ error: check.error });
        }
        const { camera, gatewayCfg } = check;
        if (!gatewayCfg.webrtcUrl) {
            return res.status(503).json({ error: 'Alamat WebRTC Gateway MediaMTX belum diatur.' });
        }

        const sdpOffer = typeof req.body === 'string' ? req.body : '';
        if (!sdpOffer.trim()) {
            return res.status(400).json({ error: 'SDP Offer tidak valid.' });
        }

        const upstreamUrl = `${gatewayCfg.webrtcUrl}/${encodeURIComponent(camera.streamPath)}/whep`;
        const upstreamRes = await fetchGatewayWithAutoSync(
            upstreamUrl,
            {
                method: 'POST',
                headers: {
                    ...gateway.buildAuthHeaders(gatewayCfg),
                    'Content-Type': 'application/sdp'
                },
                body: sdpOffer
            },
            15000,
            camera,
            gatewayCfg
        );

        const bodyText = await upstreamRes.text();
        const rawLocation = upstreamRes.headers.get('location');
        if (rawLocation) {
            let sessionPath = rawLocation;
            if (/^https?:\/\//i.test(rawLocation)) {
                try {
                    const parsed = new URL(rawLocation);
                    sessionPath = `${parsed.pathname}${parsed.search}`;
                } catch {
                    sessionPath = rawLocation;
                }
            }
            const proxyLoc = `/api/cctv/play/${camera.id}/whep-session?target=${encodeURIComponent(sessionPath)}`;
            res.set('Location', proxyLoc);
            res.set('Access-Control-Expose-Headers', 'Location, Link');
        }

        const linkHeader = upstreamRes.headers.get('link');
        if (linkHeader) res.set('Link', linkHeader);

        const contentType = upstreamRes.headers.get('content-type') || 'application/sdp';
        res.status(upstreamRes.status).type(contentType).send(bodyText);
    } catch (error) {
        console.error('playWhep error:', error);
        res.status(502).json({ error: gateway.describeFetchError(error) });
    }
};

/**
 * PATCH / DELETE /api/cctv/play/:id/whep-session?target=...
 * Proxy Trickle ICE & penutupan sesi WHEP.
 */
exports.playWhepSession = async (req, res) => {
    try {
        const check = await assertCameraPlayAccess(req, req.params.id);
        if (check.errorStatus) {
            return res.status(check.errorStatus).json({ error: check.error });
        }
        const { camera, gatewayCfg } = check;
        if (!gatewayCfg.webrtcUrl) {
            return res.status(503).json({ error: 'Alamat WebRTC Gateway MediaMTX belum diatur.' });
        }

        const target = String(req.query.target || '');
        const expectedPrefix = `/${camera.streamPath}/`;
        if (!target.startsWith(expectedPrefix) || target.includes('..')) {
            return res.status(400).json({ error: 'Target sesi WHEP tidak valid.' });
        }

        const upstreamUrl = `${gatewayCfg.webrtcUrl}${target}`;
        const headers = { ...gateway.buildAuthHeaders(gatewayCfg) };
        let body;
        if (req.method === 'PATCH') {
            headers['Content-Type'] = req.headers['content-type'] || 'application/trickle-ice-sdpfrag';
            body = typeof req.body === 'string' ? req.body : '';
        }

        const upstreamRes = await gateway.fetchWithTimeout(
            upstreamUrl,
            { method: req.method, headers, body },
            10000
        );
        const text = await upstreamRes.text();
        res.status(upstreamRes.status).send(text);
    } catch (error) {
        res.status(502).json({ error: gateway.describeFetchError(error) });
    }
};

/**
 * Menyisipkan query ?token=... pada baris URI di playlist m3u8 bila Safari native HLS mengirim token lewat query.
 */
const appendTokenToM3u8 = (m3u8Text, token) => {
    const encoded = encodeURIComponent(token);
    return m3u8Text
        .split('\n')
        .map((line) => {
            const trimmed = line.trim();
            if (!trimmed) return line;
            if (trimmed.startsWith('#EXT-X-MAP:') || trimmed.startsWith('#EXT-X-MEDIA:')) {
                return line.replace(/URI="([^"]+)"/g, (_, uri) => {
                    const sep = uri.includes('?') ? '&' : '?';
                    return `URI="${uri}${sep}token=${encoded}"`;
                });
            }
            if (trimmed.startsWith('#')) return line;
            const sep = trimmed.includes('?') ? '&' : '?';
            return `${trimmed}${sep}token=${encoded}`;
        })
        .join('\n');
};

/**
 * USE /api/cctv/play/:id/hls/*
 * Proxy HLS (.m3u8 & segmen fMP4/TS) dari MediaMTX dengan pengecekan JWT + hak akses kamera.
 */
exports.playHls = async (req, res) => {
    try {
        const check = await assertCameraPlayAccess(req, req.params.id);
        if (check.errorStatus) {
            return res.status(check.errorStatus).json({ error: check.error });
        }
        const { camera, gatewayCfg } = check;
        if (!gatewayCfg.hlsUrl) {
            return res.status(503).json({ error: 'Alamat HLS Gateway MediaMTX belum diatur.' });
        }

        const subPath = !req.path || req.path === '/' ? '/index.m3u8' : req.path;
        if (subPath.includes('..')) {
            return res.status(400).json({ error: 'Path stream tidak valid.' });
        }

        const forwardParams = new URLSearchParams();
        for (const [k, v] of Object.entries(req.query || {})) {
            if (k === 'token') continue;
            if (Array.isArray(v)) {
                v.forEach((item) => forwardParams.append(k, String(item)));
            } else if (v !== undefined) {
                forwardParams.append(k, String(v));
            }
        }
        const qs = forwardParams.toString();
        const upstreamUrl = `${gatewayCfg.hlsUrl}/${encodeURIComponent(camera.streamPath)}${subPath}${qs ? `?${qs}` : ''}`;

        const upstreamRes = await fetchGatewayWithAutoSync(
            upstreamUrl,
            { headers: gateway.buildAuthHeaders(gatewayCfg) },
            25000,
            camera,
            gatewayCfg
        );

        const contentType = upstreamRes.headers.get('content-type') || 'application/octet-stream';
        const isPlaylist = subPath.toLowerCase().endsWith('.m3u8') || contentType.includes('mpegurl');

        if (!upstreamRes.ok) {
            const errText = await upstreamRes.text().catch(() => '');
            return res.status(upstreamRes.status).type('text/plain').send(errText || `HTTP ${upstreamRes.status}`);
        }

        if (isPlaylist) {
            let text = await upstreamRes.text();
            if (req.query.token && !req.headers.authorization) {
                text = appendTokenToM3u8(text, req.query.token);
            }
            res.set('Content-Type', 'application/vnd.apple.mpegurl');
            res.set('Cache-Control', 'no-store');
            return res.status(200).send(text);
        }

        const buf = Buffer.from(await upstreamRes.arrayBuffer());
        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'no-cache');
        return res.status(200).send(buf);
    } catch (error) {
        console.error('playHls error:', error);
        res.status(502).json({ error: gateway.describeFetchError(error) });
    }
};
