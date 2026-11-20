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
const { deleteFile } = require('../services/minioService');
const {
    recordCctvAudit,
    buildAuditWhereClause,
    formatCsvCell
} = require('../utils/cctvAuditHelper');
const cctvAi = require('../services/cctvAiService');

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
        floorPlanId: camera.floorPlanId ?? null,
        posX: camera.posX ?? null,
        posY: camera.posY ?? null,
        fovAngle: camera.fovAngle ?? null,
        aiEnabled: Boolean(camera.aiEnabled),
        aiPreset: camera.aiPreset || 'CLASSROOM',
        aiCustomPrompt: camera.aiCustomPrompt || null,
        aiWatchEnabled: Boolean(camera.aiWatchEnabled),
        aiWatchStart: camera.aiWatchStart || '22:00',
        aiWatchEnd: camera.aiWatchEnd || '05:00',
        aiWatchIntervalSec: camera.aiWatchIntervalSec ?? 5,
        aiMotionThreshold: camera.aiMotionThreshold ?? 6.0,
        aiAlertCooldownSec: camera.aiAlertCooldownSec ?? 180,
        aiAlertRecipients: camera.aiAlertRecipients || null,
        aiRoiZones: cctvAi.parseRoiZones(camera.aiRoiZones),
        aiLastCheckedAt: camera.aiLastCheckedAt || null,
        aiLastAlertAt: camera.aiLastAlertAt || null,
        aiLastSummary: camera.aiLastSummary || null,
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
 * Menghasilkan streamPath unik untuk kamera agar tidak pernah bentrok di MediaMTX.
 */
const buildUniqueStreamPath = (baseName, unitCode, takenPathsSet) => {
    const candidate = slugifyStreamPath(baseName, unitCode);
    if (!takenPathsSet.has(candidate)) {
        takenPathsSet.add(candidate);
        return candidate;
    }
    let suffix = 2;
    let uniqueCandidate = `${candidate.slice(0, 54)}-${suffix}`;
    while (takenPathsSet.has(uniqueCandidate)) {
        suffix += 1;
        uniqueCandidate = `${candidate.slice(0, 54)}-${suffix}`;
    }
    takenPathsSet.add(uniqueCandidate);
    return uniqueCandidate;
};

/**
 * Normalisasi payload kamera untuk create / update agar konsisten.
 */
const normalizeCameraPayload = async (body, isUpdate = false, unitCodeOverride = null, takenPathsSet = null) => {
    const unitId = body.unitId ? parseInt(body.unitId, 10) : null;
    const deviceType = (body.deviceType || 'DVR_NVR').toUpperCase();
    const channelNo = deviceType === 'WIFI_CAMERA'
        ? 1
        : Math.max(1, parseInt(body.channelNo, 10) || 1);

    let streamPath = body.streamPath ? slugifyStreamPath(body.streamPath) : null;
    if (!streamPath && !isUpdate) {
        let unitCode = unitCodeOverride || '';
        if (!unitCode && unitId) {
            const unit = await prisma.unit.findUnique({ where: { id: unitId }, select: { code: true } });
            unitCode = unit?.code || '';
        }
        const baseName = deviceType === 'DVR_NVR' ? `${body.name || 'cam'}-ch${channelNo}` : (body.name || 'cam');
        if (takenPathsSet) {
            streamPath = buildUniqueStreamPath(baseName, unitCode, takenPathsSet);
        } else {
            const candidate = slugifyStreamPath(baseName, unitCode);
            const existing = await prisma.cctvCamera.findUnique({ where: { streamPath: candidate } });
            streamPath = existing ? `${candidate.slice(0, 54)}-${Date.now().toString().slice(-4)}` : candidate;
        }
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
        sortOrder: parseInt(body.sortOrder, 10) || 0,
        aiEnabled: body.aiEnabled !== undefined ? Boolean(body.aiEnabled) : false,
        aiPreset: ['CLASSROOM', 'SECURITY_NIGHT', 'CROWD', 'CUSTOM'].includes(String(body.aiPreset || '').toUpperCase())
            ? String(body.aiPreset).toUpperCase()
            : 'CLASSROOM',
        aiCustomPrompt: body.aiCustomPrompt ? String(body.aiCustomPrompt).trim() : null,
        aiWatchEnabled: body.aiWatchEnabled !== undefined ? Boolean(body.aiWatchEnabled) : false,
        aiWatchStart: body.aiWatchStart !== undefined ? (String(body.aiWatchStart || '').trim() || null) : '22:00',
        aiWatchEnd: body.aiWatchEnd !== undefined ? (String(body.aiWatchEnd || '').trim() || null) : '05:00',
        aiWatchIntervalSec: Math.min(300, Math.max(3, parseInt(body.aiWatchIntervalSec, 10) || 5)),
        aiMotionThreshold: Math.min(50, Math.max(1, parseFloat(body.aiMotionThreshold) || 6.0)),
        aiAlertCooldownSec: Math.max(30, parseInt(body.aiAlertCooldownSec, 10) || 180),
        aiAlertRecipients: body.aiAlertRecipients ? String(body.aiAlertRecipients).trim() : null,
        ...(body.aiRoiZones !== undefined ? { aiRoiZones: JSON.stringify(cctvAi.parseRoiZones(body.aiRoiZones)) } : {})
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
            aiRoiZones: cctvAi.parseRoiZones(cam.aiRoiZones),
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
        cctvAi.invalidateWatchedCamerasCache();

        await recordCctvAudit({
            prismaClient: prisma,
            req,
            camera: created,
            action: 'CAMERA_CREATE',
            category: 'CAMERA',
            details: `Menambahkan kamera "${created.name}" (${created.brand}, Ch.${created.channelNo})`,
            metadata: { brand: created.brand, deviceType: created.deviceType, channelNo: created.channelNo, unitId: created.unitId }
        });

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
 * POST /api/cctv/cameras/batch (Khusus Kepala Bidang Sarana)
 * Membuat banyak channel DVR/NVR sekaligus dalam 1 klik dengan jalur RTSP otomatis berurutan.
 */
exports.createBatchCameras = async (req, res) => {
    try {
        const body = req.body || {};
        const skipExisting = body.skipExisting !== false;
        const unitId = body.unitId ? parseInt(body.unitId, 10) : null;
        const ipAddress = body.ipAddress ? String(body.ipAddress).trim() : '';
        const rtspPort = Math.max(1, parseInt(body.rtspPort, 10) || 554);

        let rawChannels = Array.isArray(body.channels) ? body.channels : [];
        if (rawChannels.length === 0 && body.startChannel && body.endChannel) {
            const start = Math.max(1, parseInt(body.startChannel, 10) || 1);
            const end = Math.min(64, Math.max(start, parseInt(body.endChannel, 10) || start));
            const prefix = String(body.namePrefix || 'Kamera DVR').trim();
            for (let ch = start; ch <= end; ch += 1) {
                rawChannels.push({ channelNo: ch, name: `${prefix} Ch.${ch}`, location: body.location || '' });
            }
        }

        const uniqueChannelMap = new Map();
        for (const item of rawChannels) {
            const ch = parseInt(item?.channelNo, 10);
            if (Number.isNaN(ch) || ch < 1 || ch > 64 || uniqueChannelMap.has(ch)) continue;
            const name = String(item?.name || `${body.namePrefix || 'Kamera'} Ch.${ch}`).trim();
            if (!name) continue;
            uniqueChannelMap.set(ch, {
                channelNo: ch,
                name,
                location: item?.location !== undefined ? String(item.location).trim() : String(body.location || '').trim(),
                sortOrder: item?.sortOrder !== undefined ? parseInt(item.sortOrder, 10) : ch - 1
            });
        }

        const requestedChannels = Array.from(uniqueChannelMap.values());
        if (requestedChannels.length === 0) {
            return res.status(400).json({ error: 'Pilih minimal 1 channel DVR yang valid.' });
        }
        if (requestedChannels.length > 32) {
            return res.status(400).json({ error: 'Maksimal 32 channel dalam satu kali proses batch.' });
        }

        let existingChannelNos = new Set();
        if (skipExisting && ipAddress) {
            const existingOnDvr = await prisma.cctvCamera.findMany({
                where: {
                    deviceType: 'DVR_NVR',
                    ipAddress,
                    rtspPort,
                    ...(Number.isNaN(unitId) ? {} : { unitId })
                },
                select: { channelNo: true }
            });
            existingChannelNos = new Set(existingOnDvr.map((c) => c.channelNo));
        }

        const channelsToCreate = [];
        const skippedChannels = [];
        for (const chItem of requestedChannels) {
            if (existingChannelNos.has(chItem.channelNo)) {
                skippedChannels.push(chItem.channelNo);
            } else {
                channelsToCreate.push(chItem);
            }
        }

        if (channelsToCreate.length === 0) {
            return res.status(200).json({
                createdCount: 0,
                skippedChannels,
                cameras: [],
                syncedCount: 0,
                syncFailedCount: 0,
                message: 'Semua channel yang dipilih sudah terdaftar pada DVR/IP tersebut.'
            });
        }

        let unitCode = '';
        if (unitId && !Number.isNaN(unitId)) {
            const unit = await prisma.unit.findUnique({ where: { id: unitId }, select: { code: true } });
            unitCode = unit?.code || '';
        }

        const existingPaths = await prisma.cctvCamera.findMany({ select: { streamPath: true } });
        const takenPathsSet = new Set(existingPaths.map((c) => c.streamPath).filter(Boolean));

        const payloads = [];
        for (const chItem of channelsToCreate) {
            const payload = await normalizeCameraPayload(
                {
                    name: chItem.name,
                    unitId: Number.isNaN(unitId) ? null : unitId,
                    location: chItem.location,
                    brand: body.brand || 'G-LENZ',
                    deviceType: 'DVR_NVR',
                    channelNo: chItem.channelNo,
                    streamMode: body.streamMode || 'GATEWAY',
                    ipAddress,
                    rtspPort,
                    rtspUsername: body.rtspUsername || 'admin',
                    rtspPassword: body.rtspPassword,
                    rtspQuality: body.rtspQuality || 'SUB',
                    sortOrder: chItem.sortOrder,
                    isActive: body.isActive !== undefined ? Boolean(body.isActive) : true
                },
                false,
                unitCode,
                takenPathsSet
            );
            payload.createdById = req.user.id;
            payloads.push(payload);
        }

        const createdCameras = await prisma.$transaction(async (tx) => {
            const list = [];
            for (const data of payloads) {
                const row = await tx.cctvCamera.create({ data, include: CAMERA_INCLUDE_UNIT });
                list.push(row);
            }
            return list;
        });

        const gatewayCfg = await gateway.getGatewayConfig(prisma);
        const syncResults = gatewayCfg.apiUrl
            ? await gateway.syncAllCameras(gatewayCfg, createdCameras)
            : [];

        const syncedCount = syncResults.filter((r) => r.ok && !r.skipped).length;
        const syncFailedCount = syncResults.filter((r) => !r.ok && !r.skipped).length;

        await recordCctvAudit({
            prismaClient: prisma,
            req,
            action: 'CAMERA_BATCH_CREATE',
            category: 'CAMERA',
            details: `Menambahkan ${createdCameras.length} channel DVR/NVR secara batch (${body.brand || 'G-LENZ'}, IP ${ipAddress || '-'})`,
            metadata: { createdCount: createdCameras.length, skippedChannels, syncedCount, syncFailedCount, unitId }
        });

        res.status(201).json({
            createdCount: createdCameras.length,
            skippedChannels,
            syncedCount,
            syncFailedCount,
            cameras: createdCameras.map((cam) => ({
                ...cam,
                accessUserIds: [],
                accessCount: 0,
                rtspPreviewUrl: buildRtspUrl(cam)
            }))
        });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Sebagian Stream Path bentrok. Silakan coba lagi.' });
        }
        console.error('createBatchCameras error:', error);
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
        cctvAi.invalidateWatchedCamerasCache();

        await recordCctvAudit({
            prismaClient: prisma,
            req,
            camera: updated,
            action: 'CAMERA_UPDATE',
            category: 'CAMERA',
            details: `Memperbarui konfigurasi kamera "${updated.name}" (${updated.brand}, Ch.${updated.channelNo})`,
            metadata: { previousName: existing.name, brand: updated.brand, channelNo: updated.channelNo, isActive: updated.isActive }
        });

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
        cctvAi.invalidateWatchedCamerasCache();

        await recordCctvAudit({
            prismaClient: prisma,
            req,
            camera: updated,
            action: 'CAMERA_TOGGLE',
            category: 'CAMERA',
            details: `${updated.isActive ? 'Mengaktifkan' : 'Menonaktifkan'} kamera "${updated.name}"`,
            metadata: { isActive: updated.isActive }
        });

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
        cctvAi.invalidateWatchedCamerasCache();

        const gatewayCfg = await gateway.getGatewayConfig(prisma);
        if (gatewayCfg.apiUrl) {
            await gateway.deleteCameraPath(gatewayCfg, existing.streamPath).catch(() => null);
        }

        await recordCctvAudit({
            prismaClient: prisma,
            req,
            cameraName: existing.name,
            action: 'CAMERA_DELETE',
            category: 'CAMERA',
            details: `Menghapus kamera "${existing.name}" (ID #${cameraId}, path ${existing.streamPath || '-'})`,
            metadata: { deletedCameraId: cameraId, streamPath: existing.streamPath, brand: existing.brand }
        });

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

        await recordCctvAudit({
            prismaClient: prisma,
            req,
            action: 'USER_ACCESS_UPDATE',
            category: 'ACCESS',
            details: `Memperbarui hak akses CCTV untuk ${targetUser.name || targetUser.username} (${validCameraIds.length} kamera)`,
            metadata: { targetUserId, targetUserName: targetUser.name || targetUser.username, grantedCameraIds: validCameraIds }
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

        await recordCctvAudit({
            prismaClient: prisma,
            req,
            camera,
            action: 'CAMERA_ACCESS_UPDATE',
            category: 'ACCESS',
            details: `Memperbarui daftar pengguna kamera "${camera.name}" (${validUserIds.length} pengguna)`,
            metadata: { cameraId, grantedUserIds: validUserIds }
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

        await recordCctvAudit({
            prismaClient: prisma,
            req,
            action: 'GATEWAY_SAVE',
            category: 'GATEWAY',
            details: `Menyimpan pengaturan Gateway MediaMTX (WebRTC: ${cfg.webrtcUrl || '-'}, HLS: ${cfg.hlsUrl || '-'})`,
            metadata: { webrtcUrl: cfg.webrtcUrl, hlsUrl: cfg.hlsUrl, apiUrl: cfg.apiUrl, isUsingEmbedded: gateway.isEmbeddedGateway(cfg) }
        });

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

        await recordCctvAudit({
            prismaClient: prisma,
            req,
            action: 'GATEWAY_SAVE',
            category: 'GATEWAY',
            details: `Menyimpan pengaturan Gateway MediaMTX (WebRTC: ${cfg.webrtcUrl || '-'}, HLS: ${cfg.hlsUrl || '-'})`,
            metadata: { webrtcUrl: cfg.webrtcUrl, hlsUrl: cfg.hlsUrl, apiUrl: cfg.apiUrl, isUsingEmbedded: gateway.isEmbeddedGateway(cfg) }
        });

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

        await recordCctvAudit({
            prismaClient: prisma,
            req,
            action: 'GATEWAY_TEST',
            category: 'GATEWAY',
            status: report?.ok ? 'SUCCESS' : 'FAILED',
            details: `Menguji koneksi Gateway MediaMTX (${report?.ok ? 'berhasil' : 'gagal'})`,
            metadata: report
        });

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

        await recordCctvAudit({
            prismaClient: prisma,
            req,
            action: 'GATEWAY_SYNC',
            category: 'GATEWAY',
            status: failedCount > 0 && syncedCount === 0 ? 'FAILED' : 'SUCCESS',
            details: `Sinkronisasi Gateway MediaMTX: ${syncedCount} berhasil, ${failedCount} gagal, ${skippedCount} dilewati`,
            metadata: { total: cameras.length, syncedCount, skippedCount, failedCount }
        });

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

        await recordCctvAudit({
            prismaClient: prisma,
            req,
            camera,
            action: 'CAMERA_TEST',
            category: 'CAMERA',
            status: result?.ok ? 'SUCCESS' : 'FAILED',
            protocol: 'RTSP',
            details: `Uji stream kamera "${camera.name}": ${result?.message || (result?.ok ? 'Terhubung' : 'Gagal')}`,
            metadata: { ok: result?.ok, codec: result?.codec || null }
        });

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
        recordCctvAudit({
            prismaClient: prisma,
            req,
            camera,
            action: 'STREAM_DENIED',
            category: 'STREAM',
            status: 'DENIED',
            details: `Percobaan membuka stream kamera "${camera.name}" ditolak (kamera non-aktif)`,
            dedupeCooldownMs: 60000
        });
        return { errorStatus: 403, error: 'Kamera sedang dinonaktifkan / maintenance.' };
    }

    if (!isKabidSaranaPosition(req.user)) {
        const access = await prisma.cctvAccess.findUnique({
            where: {
                userId_cameraId: { userId: req.user.id, cameraId: camera.id }
            }
        });
        if (!access) {
            recordCctvAudit({
                prismaClient: prisma,
                req,
                camera,
                action: 'STREAM_DENIED',
                category: 'STREAM',
                status: 'DENIED',
                details: `Percobaan akses tanpa izin ke kamera "${camera.name}"`,
                dedupeCooldownMs: 60000
            });
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

        recordCctvAudit({
            prismaClient: prisma,
            req,
            camera,
            action: upstreamRes.ok ? 'STREAM_VIEW' : 'STREAM_FAILED',
            category: 'STREAM',
            status: upstreamRes.ok ? 'SUCCESS' : 'FAILED',
            protocol: 'WHEP',
            details: upstreamRes.ok
                ? `Membuka live stream WHEP kamera "${camera.name}"`
                : `Gagal membuka live stream WHEP kamera "${camera.name}" (HTTP ${upstreamRes.status})`,
            dedupeCooldownMs: upstreamRes.ok ? 5 * 60 * 1000 : 60 * 1000
        });

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
            if (subPath === '/index.m3u8' || subPath === '/') {
                recordCctvAudit({
                    prismaClient: prisma,
                    req,
                    camera,
                    action: 'STREAM_VIEW',
                    category: 'STREAM',
                    status: 'SUCCESS',
                    protocol: 'HLS',
                    details: `Membuka live stream HLS kamera "${camera.name}"`,
                    dedupeCooldownMs: 5 * 60 * 1000
                });
            }
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

// =========================================================================
// DENAH LOKASI & TITIK KAMERA CCTV
// =========================================================================

const clampPercent = (val) => {
    const num = Number(val);
    if (!Number.isFinite(num)) return null;
    return Math.round(Math.min(100, Math.max(0, num)) * 100) / 100;
};

const normalizeAngle = (val) => {
    if (val === undefined || val === null || val === '') return null;
    const num = Number(val);
    if (!Number.isFinite(num)) return null;
    return ((Math.round(num) % 360) + 360) % 360;
};

const parseNullableUnitId = (raw) => {
    if (raw === undefined || raw === null || raw === '' || raw === 'null') return null;
    const parsed = parseInt(raw, 10);
    return Number.isNaN(parsed) ? null : parsed;
};

const formatFloorPlanResponse = (fp, gatewayCfg) => ({
    ...fp,
    cameras: (fp.cameras || []).map((cam) => sanitizeCameraForViewer(cam, gatewayCfg))
});

/**
 * GET /api/cctv/floor-plans
 * Mengambil seluruh denah CCTV beserta titik kamera yang diizinkan untuk ditonton user.
 */
exports.getFloorPlans = async (req, res) => {
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

        const [floorPlans, gatewayCfg] = await Promise.all([
            prisma.cctvFloorPlan.findMany({
                include: {
                    unit: { select: { id: true, name: true, code: true } },
                    cameras: {
                        where: isManager
                            ? {}
                            : { accessList: { some: { userId: req.user.id } } },
                        include: CAMERA_INCLUDE_UNIT,
                        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
                    }
                },
                orderBy: [{ sortOrder: 'asc' }, { unitId: 'asc' }, { id: 'asc' }]
            }),
            gateway.getGatewayConfig(prisma)
        ]);

        const visiblePlans = isManager
            ? floorPlans
            : floorPlans.filter((fp) => (fp.cameras || []).length > 0);

        res.json({
            floorPlans: visiblePlans.map((fp) => formatFloorPlanResponse(fp, gatewayCfg))
        });
    } catch (error) {
        console.error('getFloorPlans error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * POST /api/cctv/floor-plans (Khusus Kepala Bidang Sarana)
 */
exports.createFloorPlan = async (req, res) => {
    try {
        const name = String(req.body?.name || '').trim();
        const imageUrl = req.fileUrl || (req.body?.imageUrl ? String(req.body.imageUrl).trim() : '');

        if (!name) {
            return res.status(400).json({ error: 'Nama denah wajib diisi.' });
        }
        if (!imageUrl) {
            return res.status(400).json({ error: 'Gambar denah wajib diunggah atau diisi URL gambarnya.' });
        }

        const created = await prisma.cctvFloorPlan.create({
            data: {
                name,
                unitId: parseNullableUnitId(req.body?.unitId),
                floorLabel: req.body?.floorLabel ? String(req.body.floorLabel).trim() : null,
                description: req.body?.description ? String(req.body.description).trim() : null,
                sortOrder: parseInt(req.body?.sortOrder, 10) || 0,
                imageUrl,
                createdById: req.user.id
            },
            include: {
                unit: { select: { id: true, name: true, code: true } },
                cameras: { include: CAMERA_INCLUDE_UNIT }
            }
        });

        const gatewayCfg = await gateway.getGatewayConfig(prisma);

        await recordCctvAudit({
            prismaClient: prisma,
            req,
            action: 'FLOORPLAN_CREATE',
            category: 'FLOORPLAN',
            details: `Membuat denah CCTV "${created.name}"${created.floorLabel ? ` (${created.floorLabel})` : ''}`,
            metadata: { floorPlanId: created.id, unitId: created.unitId }
        });

        res.status(201).json(formatFloorPlanResponse(created, gatewayCfg));
    } catch (error) {
        console.error('createFloorPlan error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * PUT /api/cctv/floor-plans/:id (Khusus Kepala Bidang Sarana)
 */
exports.updateFloorPlan = async (req, res) => {
    try {
        const floorPlanId = parseInt(req.params.id, 10);
        if (Number.isNaN(floorPlanId)) {
            return res.status(400).json({ error: 'ID denah tidak valid.' });
        }

        const existing = await prisma.cctvFloorPlan.findUnique({ where: { id: floorPlanId } });
        if (!existing) {
            return res.status(404).json({ error: 'Denah tidak ditemukan.' });
        }

        const name = req.body?.name !== undefined ? String(req.body.name || '').trim() : existing.name;
        if (!name) {
            return res.status(400).json({ error: 'Nama denah wajib diisi.' });
        }

        const nextImageUrl = req.fileUrl || (req.body?.imageUrl ? String(req.body.imageUrl).trim() : existing.imageUrl);
        if (req.fileUrl && existing.imageUrl && existing.imageUrl !== nextImageUrl && existing.imageUrl.startsWith('/api/media/')) {
            deleteFile(existing.imageUrl).catch(() => null);
        }

        const updated = await prisma.cctvFloorPlan.update({
            where: { id: floorPlanId },
            data: {
                name,
                unitId: req.body?.unitId !== undefined ? parseNullableUnitId(req.body.unitId) : existing.unitId,
                floorLabel: req.body?.floorLabel !== undefined ? (String(req.body.floorLabel || '').trim() || null) : existing.floorLabel,
                description: req.body?.description !== undefined ? (String(req.body.description || '').trim() || null) : existing.description,
                sortOrder: req.body?.sortOrder !== undefined ? (parseInt(req.body.sortOrder, 10) || 0) : existing.sortOrder,
                imageUrl: nextImageUrl
            },
            include: {
                unit: { select: { id: true, name: true, code: true } },
                cameras: {
                    include: CAMERA_INCLUDE_UNIT,
                    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
                }
            }
        });

        const gatewayCfg = await gateway.getGatewayConfig(prisma);

        await recordCctvAudit({
            prismaClient: prisma,
            req,
            action: 'FLOORPLAN_UPDATE',
            category: 'FLOORPLAN',
            details: `Memperbarui denah CCTV "${updated.name}"`,
            metadata: { floorPlanId: updated.id, previousName: existing.name }
        });

        res.json(formatFloorPlanResponse(updated, gatewayCfg));
    } catch (error) {
        console.error('updateFloorPlan error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * DELETE /api/cctv/floor-plans/:id (Khusus Kepala Bidang Sarana)
 */
exports.deleteFloorPlan = async (req, res) => {
    try {
        const floorPlanId = parseInt(req.params.id, 10);
        if (Number.isNaN(floorPlanId)) {
            return res.status(400).json({ error: 'ID denah tidak valid.' });
        }

        const existing = await prisma.cctvFloorPlan.findUnique({ where: { id: floorPlanId } });
        if (!existing) {
            return res.status(404).json({ error: 'Denah tidak ditemukan.' });
        }

        await prisma.$transaction(async (tx) => {
            await tx.cctvCamera.updateMany({
                where: { floorPlanId },
                data: { floorPlanId: null, posX: null, posY: null, fovAngle: null }
            });
            await tx.cctvFloorPlan.delete({ where: { id: floorPlanId } });
        });

        if (existing.imageUrl && existing.imageUrl.startsWith('/api/media/')) {
            deleteFile(existing.imageUrl).catch(() => null);
        }

        await recordCctvAudit({
            prismaClient: prisma,
            req,
            action: 'FLOORPLAN_DELETE',
            category: 'FLOORPLAN',
            details: `Menghapus denah CCTV "${existing.name}" (ID #${floorPlanId})`,
            metadata: { floorPlanId }
        });

        res.json({ message: 'Denah berhasil dihapus.' });
    } catch (error) {
        console.error('deleteFloorPlan error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * PUT /api/cctv/floor-plans/:id/positions (Khusus Kepala Bidang Sarana)
 * Menyimpan koordinat (posX, posY, fovAngle) seluruh titik kamera pada suatu denah.
 */
exports.saveFloorPlanPositions = async (req, res) => {
    try {
        const floorPlanId = parseInt(req.params.id, 10);
        if (Number.isNaN(floorPlanId)) {
            return res.status(400).json({ error: 'ID denah tidak valid.' });
        }

        const floorPlan = await prisma.cctvFloorPlan.findUnique({ where: { id: floorPlanId } });
        if (!floorPlan) {
            return res.status(404).json({ error: 'Denah tidak ditemukan.' });
        }

        const rawPlacements = Array.isArray(req.body?.placements) ? req.body.placements : [];
        const clearMissing = req.body?.clearMissing !== false;

        const placementMap = new Map();
        for (const item of rawPlacements) {
            const cameraId = parseInt(item?.cameraId, 10);
            const posX = clampPercent(item?.posX);
            const posY = clampPercent(item?.posY);
            if (Number.isNaN(cameraId) || posX === null || posY === null) continue;
            placementMap.set(cameraId, {
                cameraId,
                posX,
                posY,
                fovAngle: normalizeAngle(item?.fovAngle)
            });
        }

        const keepIds = Array.from(placementMap.keys());
        const existingCameras = keepIds.length > 0
            ? await prisma.cctvCamera.findMany({ where: { id: { in: keepIds } }, select: { id: true } })
            : [];
        const validIdSet = new Set(existingCameras.map((c) => c.id));

        await prisma.$transaction(async (tx) => {
            if (clearMissing) {
                await tx.cctvCamera.updateMany({
                    where: {
                        floorPlanId,
                        ...(keepIds.length > 0 ? { id: { notIn: keepIds } } : {})
                    },
                    data: { floorPlanId: null, posX: null, posY: null, fovAngle: null }
                });
            }

            for (const item of placementMap.values()) {
                if (!validIdSet.has(item.cameraId)) continue;
                await tx.cctvCamera.update({
                    where: { id: item.cameraId },
                    data: {
                        floorPlanId,
                        posX: item.posX,
                        posY: item.posY,
                        fovAngle: item.fovAngle
                    }
                });
            }
        });

        const [updatedPlan, gatewayCfg] = await Promise.all([
            prisma.cctvFloorPlan.findUnique({
                where: { id: floorPlanId },
                include: {
                    unit: { select: { id: true, name: true, code: true } },
                    cameras: {
                        include: CAMERA_INCLUDE_UNIT,
                        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
                    }
                }
            }),
            gateway.getGatewayConfig(prisma)
        ]);

        res.json({
            message: 'Posisi titik kamera pada denah berhasil disimpan.',
            floorPlan: formatFloorPlanResponse(updatedPlan, gatewayCfg)
        });

        recordCctvAudit({
            prismaClient: prisma,
            req,
            action: 'FLOORPLAN_POSITIONS_SAVE',
            category: 'FLOORPLAN',
            details: `Menyimpan posisi ${placementMap.size} titik kamera pada denah "${updatedPlan.name}"`,
            metadata: { floorPlanId, cameraCount: placementMap.size }
        });
    } catch (error) {
        console.error('saveFloorPlanPositions error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * POST /api/cctv/audit/view
 * Mencatat aktivitas menonton kamera non-gateway (IFRAME / MJPEG / VIDEO) dengan validasi hak akses & deduplikasi.
 */
exports.logStreamView = async (req, res) => {
    try {
        const cameraId = parseInt(req.body?.cameraId, 10);
        if (Number.isNaN(cameraId)) {
            return res.status(400).json({ error: 'ID kamera tidak valid.' });
        }

        const camera = await prisma.cctvCamera.findUnique({ where: { id: cameraId } });
        if (!camera || !camera.isActive) {
            return res.status(404).json({ error: 'Kamera tidak ditemukan atau non-aktif.' });
        }

        if (!isKabidSaranaPosition(req.user)) {
            const access = await prisma.cctvAccess.findUnique({
                where: { userId_cameraId: { userId: req.user.id, cameraId: camera.id } }
            });
            if (!access) {
                await recordCctvAudit({
                    prismaClient: prisma,
                    req,
                    camera,
                    action: 'STREAM_DENIED',
                    category: 'STREAM',
                    status: 'DENIED',
                    details: `Percobaan membuka stream kamera "${camera.name}" ditolak`,
                    dedupeCooldownMs: 60000
                });
                return res.status(403).json({ error: 'Anda tidak memiliki akses ke kamera ini.' });
            }
        }

        const protocol = String(req.body?.protocol || camera.streamMode || 'STREAM').toUpperCase().slice(0, 20);
        const entry = await recordCctvAudit({
            prismaClient: prisma,
            req,
            camera,
            action: 'STREAM_VIEW',
            category: 'STREAM',
            status: 'SUCCESS',
            protocol,
            details: `Membuka live stream ${protocol} kamera "${camera.name}"`,
            metadata: { context: req.body?.context || 'live' },
            dedupeCooldownMs: 5 * 60 * 1000
        });

        res.json({ recorded: Boolean(entry) });
    } catch (error) {
        console.error('logStreamView error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * GET /api/cctv/audit-logs (Khusus Kepala Bidang Sarana)
 * Daftar log audit CCTV berpaginasi, filter lengkap, serta ringkasan statistik hari ini.
 */
exports.getAuditLogs = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
        const skip = (page - 1) * limit;
        const where = buildAuditWhereClause(req.query);

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [
            logs,
            totalFiltered,
            totalAllLogs,
            todayStreamViews,
            deniedCount,
            failedCount,
            todayUniqueViewerRows,
            topCameraGroups,
            cameraOptions
        ] = await Promise.all([
            prisma.cctvAuditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.cctvAuditLog.count({ where }),
            prisma.cctvAuditLog.count(),
            prisma.cctvAuditLog.count({
                where: { category: 'STREAM', status: 'SUCCESS', createdAt: { gte: todayStart } }
            }),
            prisma.cctvAuditLog.count({ where: { status: 'DENIED' } }),
            prisma.cctvAuditLog.count({ where: { status: 'FAILED' } }),
            prisma.cctvAuditLog.findMany({
                where: {
                    category: 'STREAM',
                    status: 'SUCCESS',
                    userId: { not: null },
                    createdAt: { gte: todayStart }
                },
                distinct: ['userId'],
                select: { userId: true }
            }),
            prisma.cctvAuditLog.groupBy({
                by: ['cameraId', 'cameraName'],
                where: { category: 'STREAM', status: 'SUCCESS', cameraName: { not: null } },
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
                take: 5
            }),
            prisma.cctvCamera.findMany({
                select: { id: true, name: true },
                orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
            })
        ]);

        res.json({
            logs,
            pagination: {
                page,
                limit,
                total: totalFiltered,
                totalPages: Math.max(1, Math.ceil(totalFiltered / limit))
            },
            summary: {
                totalAllLogs,
                todayStreamViews,
                deniedCount,
                failedCount,
                uniqueViewersToday: todayUniqueViewerRows.length,
                topCameras: topCameraGroups.map((g) => ({
                    cameraId: g.cameraId,
                    cameraName: g.cameraName,
                    viewCount: g._count.id
                }))
            },
            filters: {
                cameras: cameraOptions
            }
        });
    } catch (error) {
        console.error('getAuditLogs error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * GET /api/cctv/audit-logs/export (Khusus Kepala Bidang Sarana)
 * Mengekspor hasil filter audit log CCTV ke file CSV (maks 5.000 baris).
 */
exports.exportAuditLogsCsv = async (req, res) => {
    try {
        const where = buildAuditWhereClause(req.query);
        const logs = await prisma.cctvAuditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 5000
        });

        const header = ['Waktu (WIB)', 'User', 'Jabatan/Role', 'Kategori', 'Aksi', 'Status', 'Kamera', 'Protokol', 'IP Address', 'Detail'];
        const rows = logs.map((log) => [
            new Date(log.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
            log.userName || '-',
            log.userRole || '-',
            log.category,
            log.action,
            log.status,
            log.cameraName || '-',
            log.protocol || '-',
            log.ipAddress || '-',
            log.details || '-'
        ]);

        const csvLines = [header, ...rows].map((row) => row.map(formatCsvCell).join(','));
        const csvContent = `\uFEFF${csvLines.join('\r\n')}`;

        await recordCctvAudit({
            prismaClient: prisma,
            req,
            action: 'AUDIT_EXPORT',
            category: 'SYSTEM',
            details: `Mengekspor ${logs.length} baris audit log CCTV ke CSV`,
            metadata: { rowCount: logs.length }
        });

        const filename = `cctv-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csvContent);
    } catch (error) {
        console.error('exportAuditLogsCsv error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * DELETE /api/cctv/audit-logs/prune (Khusus Kepala Bidang Sarana)
 * Menghapus log audit CCTV yang lebih lama dari X hari (default 90, minimal 7 hari).
 */
exports.pruneAuditLogs = async (req, res) => {
    try {
        const days = Math.max(7, parseInt(req.query.days || req.body?.days, 10) || 90);
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const deleted = await prisma.cctvAuditLog.deleteMany({
            where: { createdAt: { lt: cutoff } }
        });

        await recordCctvAudit({
            prismaClient: prisma,
            req,
            action: 'AUDIT_PRUNE',
            category: 'SYSTEM',
            details: `Membersihkan ${deleted.count} log audit CCTV yang lebih lama dari ${days} hari`,
            metadata: { days, deletedCount: deleted.count, cutoff: cutoff.toISOString() }
        });

        res.json({
            message: `${deleted.count} log audit lama (> ${days} hari) berhasil dihapus.`,
            deletedCount: deleted.count,
            days
        });
    } catch (error) {
        console.error('pruneAuditLogs error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * GET /api/cctv/ai/status (Khusus Kepala Bidang Sarana)
 * Mengembalikan kesiapan GEMINI_API_KEY, ffmpeg, serta jumlah kamera yang diaktifkan AI.
 */
exports.getAiStatus = async (req, res) => {
    try {
        const status = await cctvAi.getAiSystemStatus(prisma);
        res.json(status);
    } catch (error) {
        console.error('getAiStatus error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * PATCH /api/cctv/cameras/:id/ai-toggle (Khusus Kepala Bidang Sarana)
 * Mengaktifkan/menonaktifkan AI (atau mode jaga otomatis) pada kamera tertentu secara cepat.
 */
exports.toggleCameraAi = async (req, res) => {
    try {
        const cameraId = parseInt(req.params.id, 10);
        if (Number.isNaN(cameraId)) {
            return res.status(400).json({ error: 'ID kamera tidak valid.' });
        }

        const existing = await prisma.cctvCamera.findUnique({ where: { id: cameraId } });
        if (!existing) {
            return res.status(404).json({ error: 'Kamera tidak ditemukan.' });
        }

        const nextAiEnabled = req.body?.aiEnabled !== undefined
            ? Boolean(req.body.aiEnabled)
            : !existing.aiEnabled;
        const nextWatchEnabled = req.body?.aiWatchEnabled !== undefined
            ? Boolean(req.body.aiWatchEnabled)
            : (nextAiEnabled ? existing.aiWatchEnabled : false);

        const updated = await prisma.cctvCamera.update({
            where: { id: cameraId },
            data: {
                aiEnabled: nextAiEnabled,
                aiWatchEnabled: nextWatchEnabled
            }
        });

        cctvAi.invalidateWatchedCamerasCache();

        await recordCctvAudit({
            prismaClient: prisma,
            req,
            camera: updated,
            action: 'CAMERA_AI_TOGGLE',
            category: 'CAMERA',
            details: `${updated.aiEnabled ? 'Mengaktifkan' : 'Menonaktifkan'} Analisis AI pada kamera "${updated.name}"${updated.aiWatchEnabled ? ' (Jaga Otomatis Aktif)' : ''}`,
            metadata: { aiEnabled: updated.aiEnabled, aiWatchEnabled: updated.aiWatchEnabled, aiPreset: updated.aiPreset }
        });

        res.json(updated);
    } catch (error) {
        console.error('toggleCameraAi error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * POST /api/cctv/cameras/:id/ai-analyze
 * Menjalankan analisis Gemini Vision pada snapshot kamera yang sudah diaktifkan AI (`aiEnabled = true`).
 * Snapshot bisa dikirim langsung dari browser `<canvas>` (`imageBase64`) atau dicuplik backend lewat ffmpeg.
 */
exports.analyzeCameraSnapshot = async (req, res) => {
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

        const isManager = isKabidSaranaPosition(req.user);
        if (!isManager) {
            const access = await prisma.cctvAccess.findUnique({
                where: { userId_cameraId: { userId: req.user.id, cameraId: camera.id } }
            });
            if (!access) {
                return res.status(403).json({ error: 'Anda tidak memiliki akses ke kamera ini.' });
            }
        }

        if (!camera.aiEnabled) {
            return res.status(400).json({
                error: 'Analisis AI belum diaktifkan untuk kamera ini. Aktifkan terlebih dahulu pada menu Kelola Kamera.'
            });
        }

        let imageBase64 = req.body?.imageBase64 || null;
        let mimeType = req.body?.mimeType || 'image/jpeg';

        if (!imageBase64) {
            const gatewayCfg = await gateway.getGatewayConfig(prisma);
            const buf = await cctvAi.captureCameraFrame({ camera, gatewayCfg, timeoutMs: 12000 });
            imageBase64 = buf.toString('base64');
            mimeType = 'image/jpeg';
        }

        const analysis = await cctvAi.analyzeFrameWithGemini({
            imageBase64,
            mimeType,
            camera,
            presetOverride: req.body?.preset || null,
            customPromptOverride: req.body?.customPrompt !== undefined ? req.body.customPrompt : null
        });

        await prisma.cctvCamera.update({
            where: { id: camera.id },
            data: {
                aiLastCheckedAt: new Date(),
                aiLastSummary: analysis.summary || null
            }
        }).catch(() => null);

        let waResult = null;
        if (req.body?.sendAlert && (analysis.alertTriggered || req.body?.forceSendAlert)) {
            waResult = await cctvAi.dispatchCctvAiWaAlert({
                camera,
                analysis,
                imageBase64,
                mimeType,
                prismaClient: prisma
            });
            if (waResult?.sent) {
                await prisma.cctvCamera.update({
                    where: { id: camera.id },
                    data: { aiLastAlertAt: new Date() }
                }).catch(() => null);
            }
        }

        await recordCctvAudit({
            prismaClient: prisma,
            req,
            camera,
            action: waResult?.sent ? 'AI_ALERT' : 'AI_ANALYZE',
            category: 'CAMERA',
            protocol: req.body?.imageBase64 ? 'BROWSER_SNAP' : 'SERVER_FFMPEG',
            details: `Analisis AI (${analysis.preset}) kamera "${camera.name}": ${analysis.summary || '-'}`,
            metadata: { ...analysis, waResult }
        });

        res.json({
            cameraId: camera.id,
            cameraName: camera.name,
            analysis,
            waResult
        });
    } catch (error) {
        console.error('analyzeCameraSnapshot error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * POST /api/cctv/cameras/:id/ai-test-alert (Khusus Kepala Bidang Sarana)
 * Mengirim pesan uji coba WA Alert (beserta snapshot jika ffmpeg tersedia) untuk memastikan penerima aktif.
 */
exports.sendAiTestAlert = async (req, res) => {
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

        let imageBase64 = null;
        try {
            const gatewayCfg = await gateway.getGatewayConfig(prisma);
            const buf = await cctvAi.captureCameraFrame({ camera, gatewayCfg, timeoutMs: 8000 });
            imageBase64 = buf.toString('base64');
        } catch {
            imageBase64 = null;
        }

        const waResult = await cctvAi.dispatchCctvAiWaAlert({
            camera,
            analysis: {
                preset: camera.aiPreset || 'SECURITY_NIGHT',
                alertReason: 'Uji coba koneksi WA Alert dari Manajemen CCTV',
                summary: `Penerima WA Alert untuk kamera "${camera.name}" berhasil teruji.`
            },
            imageBase64,
            mimeType: 'image/jpeg',
            prismaClient: prisma,
            isTest: true
        });

        await recordCctvAudit({
            prismaClient: prisma,
            req,
            camera,
            action: 'AI_ALERT_TEST',
            category: 'CAMERA',
            status: waResult.sent ? 'SUCCESS' : 'FAILED',
            details: `Uji kirim WA Alert kamera "${camera.name}" (${waResult.recipientCount} penerima)`,
            metadata: waResult
        });

        if (!waResult.sent) {
            return res.status(400).json({ error: waResult.reason || 'Gagal mengirim WA Alert uji coba.' });
        }

        res.json({
            message: `WA Alert uji coba terkirim ke ${waResult.recipientCount} penerima${waResult.attachedPhoto ? ' (dengan snapshot kamera)' : ''}.`,
            ...waResult
        });
    } catch (error) {
        console.error('sendAiTestAlert error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * GET /api/cctv/cameras/:id/snapshot (Khusus Kepala Bidang Sarana)
 * Mengambil 1 frame JPEG dari kamera via ffmpeg sebagai gambar latar editor ROI kotak.
 */
exports.getCameraSnapshot = async (req, res) => {
    try {
        const cameraId = parseInt(req.params.id, 10);
        if (Number.isNaN(cameraId)) {
            return res.status(400).json({ error: 'ID kamera tidak valid.' });
        }

        const camera = await prisma.cctvCamera.findUnique({ where: { id: cameraId } });
        if (!camera) {
            return res.status(404).json({ error: 'Kamera tidak ditemukan.' });
        }

        const gatewayCfg = await gateway.getGatewayConfig(prisma);
        const buf = await cctvAi.captureCameraFrame({ camera, gatewayCfg, timeoutMs: 10000 });
        res.json({
            cameraId: camera.id,
            imageDataUrl: `data:image/jpeg;base64,${buf.toString('base64')}`
        });
    } catch (error) {
        res.status(502).json({ error: error.message || 'Gagal mengambil snapshot kamera dari server.' });
    }
};

/**
 * PUT /api/cctv/cameras/:id/ai-rois (Khusus Kepala Bidang Sarana)
 * Menyimpan daftar kotak ROI (`aiRoiZones`) beserta opsional threshold sensitivitas gerakan.
 */
exports.saveCameraRoiZones = async (req, res) => {
    try {
        const cameraId = parseInt(req.params.id, 10);
        if (Number.isNaN(cameraId)) {
            return res.status(400).json({ error: 'ID kamera tidak valid.' });
        }

        const existing = await prisma.cctvCamera.findUnique({ where: { id: cameraId } });
        if (!existing) {
            return res.status(404).json({ error: 'Kamera tidak ditemukan.' });
        }

        const cleanZones = cctvAi.parseRoiZones(req.body?.roiZones);
        const updateData = {
            aiRoiZones: JSON.stringify(cleanZones)
        };
        if (req.body?.aiMotionThreshold !== undefined) {
            updateData.aiMotionThreshold = Math.min(50, Math.max(1, parseFloat(req.body.aiMotionThreshold) || 6.0));
        }

        const updated = await prisma.cctvCamera.update({
            where: { id: cameraId },
            data: updateData
        });

        cctvAi.invalidateWatchedCamerasCache();

        await recordCctvAudit({
            prismaClient: prisma,
            req,
            camera: updated,
            action: 'CAMERA_ROI_UPDATE',
            category: 'CAMERA',
            details: `Menyimpan ${cleanZones.length} zona kotak ROI pada kamera "${updated.name}"`,
            metadata: { zoneCount: cleanZones.length, labels: cleanZones.map((z) => z.label) }
        });

        res.json({
            message: `${cleanZones.length} zona kotak ROI berhasil disimpan.`,
            cameraId: updated.id,
            aiRoiZones: cleanZones,
            aiMotionThreshold: updated.aiMotionThreshold
        });
    } catch (error) {
        console.error('saveCameraRoiZones error:', error);
        res.status(500).json({ error: error.message });
    }
};
