const streamCooldownCache = new Map();
const MAX_CACHE_SIZE = 5000;
const SENSITIVE_META_KEYS = new Set(['password', 'rtspPassword', 'token', 'authorization']);

/**
 * Extract client IP address and truncated User-Agent from Express request.
 */
function extractRequestMeta(req) {
    if (!req) return { ipAddress: null, userAgent: null };

    const forwarded = req.headers?.['x-forwarded-for'];
    let ipAddress = null;
    if (typeof forwarded === 'string' && forwarded.trim()) {
        ipAddress = forwarded.split(',')[0].trim().slice(0, 64);
    } else if (req.ip || req.socket?.remoteAddress) {
        ipAddress = String(req.ip || req.socket.remoteAddress).replace(/^::ffff:/, '').slice(0, 64);
    }

    const ua = req.headers?.['user-agent'];
    const userAgent = typeof ua === 'string' && ua.trim() ? ua.trim().slice(0, 300) : null;

    return { ipAddress, userAgent };
}

/**
 * Strip sensitive credential fields before persisting JSON metadata.
 */
function sanitizeMetadata(meta) {
    if (!meta || typeof meta !== 'object') return null;
    const clean = {};
    for (const [key, value] of Object.entries(meta)) {
        if (SENSITIVE_META_KEYS.has(key)) continue;
        clean[key] = value;
    }
    return JSON.stringify(clean);
}

/**
 * Deduplicate repetitive events (such as HLS playlist polling) within a cooldown window.
 */
function shouldSkipDuplicateAudit({ userId, cameraId, action, status, protocol, cooldownMs = 0, nowMs = Date.now() }) {
    if (!cooldownMs || cooldownMs <= 0) return false;

    const key = `${userId || 'anon'}:${cameraId || 0}:${action}:${status || 'SUCCESS'}:${protocol || ''}`;
    const lastLoggedAt = streamCooldownCache.get(key);

    if (lastLoggedAt && nowMs - lastLoggedAt < cooldownMs) {
        return true;
    }

    if (streamCooldownCache.size >= MAX_CACHE_SIZE) {
        for (const [cachedKey, ts] of streamCooldownCache.entries()) {
            if (nowMs - ts > 10 * 60 * 1000) {
                streamCooldownCache.delete(cachedKey);
            }
        }
        if (streamCooldownCache.size >= MAX_CACHE_SIZE) {
            streamCooldownCache.clear();
        }
    }

    streamCooldownCache.set(key, nowMs);
    return false;
}

/**
 * Persist a CCTV audit event without interrupting the main API response on transient failures.
 */
async function recordCctvAudit({
    prismaClient,
    req = null,
    user = null,
    camera = null,
    cameraId = null,
    cameraName = null,
    action,
    category = 'SYSTEM',
    status = 'SUCCESS',
    protocol = null,
    details = null,
    metadata = null,
    dedupeCooldownMs = 0
}) {
    try {
        if (!prismaClient?.cctvAuditLog) return null;

        const actor = user || req?.user || null;
        const resolvedUserId = actor?.id ? parseInt(actor.id, 10) : null;
        const resolvedCameraId = camera?.id ?? (cameraId ? parseInt(cameraId, 10) : null);

        if (shouldSkipDuplicateAudit({
            userId: resolvedUserId,
            cameraId: resolvedCameraId,
            action,
            status,
            protocol,
            cooldownMs: dedupeCooldownMs
        })) {
            return null;
        }

        const { ipAddress, userAgent } = extractRequestMeta(req);
        const actorName = actor?.name || actor?.username || (resolvedUserId ? `User #${resolvedUserId}` : 'Sistem');
        const actorRole = actor?.position || actor?.role || null;
        const resolvedCameraName = camera?.name || cameraName || null;

        return await prismaClient.cctvAuditLog.create({
            data: {
                userId: Number.isNaN(resolvedUserId) ? null : resolvedUserId,
                userName: actorName,
                userRole: actorRole ? String(actorRole).slice(0, 100) : null,
                cameraId: Number.isNaN(resolvedCameraId) ? null : resolvedCameraId,
                cameraName: resolvedCameraName ? String(resolvedCameraName).slice(0, 190) : null,
                action,
                category,
                status,
                protocol: protocol || null,
                ipAddress,
                userAgent,
                details: details ? String(details) : null,
                metadata: sanitizeMetadata(metadata)
            }
        });
    } catch (error) {
        console.error('[CctvAudit] Gagal mencatat log audit CCTV:', error.message);
        return null;
    }
}

/**
 * Build Prisma `where` clause for filtering CCTV audit logs.
 */
function buildAuditWhereClause(query = {}) {
    const where = {};

    if (query.category && query.category !== 'ALL') {
        where.category = String(query.category).toUpperCase();
    }
    if (query.status && query.status !== 'ALL') {
        where.status = String(query.status).toUpperCase();
    }
    if (query.action && query.action !== 'ALL') {
        where.action = String(query.action).toUpperCase();
    }

    const userId = parseInt(query.userId, 10);
    if (!Number.isNaN(userId)) {
        where.userId = userId;
    }

    const cameraId = parseInt(query.cameraId, 10);
    if (!Number.isNaN(cameraId)) {
        where.cameraId = cameraId;
    }

    if (query.startDate || query.endDate) {
        where.createdAt = {};
        if (query.startDate) {
            const start = new Date(`${String(query.startDate).slice(0, 10)}T00:00:00.000+07:00`);
            if (!Number.isNaN(start.getTime())) where.createdAt.gte = start;
        }
        if (query.endDate) {
            const end = new Date(`${String(query.endDate).slice(0, 10)}T23:59:59.999+07:00`);
            if (!Number.isNaN(end.getTime())) where.createdAt.lte = end;
        }
        if (Object.keys(where.createdAt).length === 0) delete where.createdAt;
    }

    const search = typeof query.search === 'string' ? query.search.trim() : '';
    if (search) {
        where.OR = [
            { userName: { contains: search } },
            { cameraName: { contains: search } },
            { action: { contains: search } },
            { details: { contains: search } },
            { ipAddress: { contains: search } }
        ];
    }

    return where;
}

/**
 * Escape CSV cell and neutralize spreadsheet formula prefixes.
 */
function formatCsvCell(value) {
    let str = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
    }
    if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

/**
 * Automatically prune CCTV audit logs older than `retentionDays` (default 90 days).
 */
async function pruneOldCctvAuditLogs(retentionDays = 90, prismaClient = null) {
    const prisma = prismaClient || require('@prisma/client').PrismaClient && new (require('@prisma/client').PrismaClient)();
    if (!prisma?.cctvAuditLog) return { deletedCount: 0 };

    const days = Math.max(7, parseInt(retentionDays, 10) || 90);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const deleted = await prisma.cctvAuditLog.deleteMany({
        where: { createdAt: { lt: cutoff } }
    });

    if (deleted.count > 0) {
        await recordCctvAudit({
            prismaClient: prisma,
            action: 'AUDIT_AUTO_PRUNE',
            category: 'SYSTEM',
            details: `Pembersihan otomatis ${deleted.count} log audit CCTV (> ${days} hari)`,
            metadata: { days, deletedCount: deleted.count, cutoff: cutoff.toISOString() }
        });
    }

    return { deletedCount: deleted.count, days };
}

module.exports = {
    extractRequestMeta,
    sanitizeMetadata,
    shouldSkipDuplicateAudit,
    recordCctvAudit,
    buildAuditWhereClause,
    formatCsvCell,
    pruneOldCctvAuditLogs,
    _clearCooldownCache: () => streamCooldownCache.clear()
};
