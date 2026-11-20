const { PrismaClient } = require('@prisma/client');

const defaultPrisma = new PrismaClient();
const DEFAULT_TIMEOUT_MS = 15000;

let isSyncInProgress = false;
let runtimeLastSync = {
    lastSyncAt: null,
    lastSyncTrigger: null,
    lastSyncSummary: null,
    lastSyncError: null
};

/**
 * Normalize vehicle license plate for reliable comparison between Manajemen Aset and external DEIPED API.
 * Strips spaces, hyphens, and non-alphanumeric characters, converting to uppercase.
 */
function normalizePlateNumber(plate) {
    if (!plate || typeof plate !== 'string') return '';
    return plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Resolve host/base URL or full endpoint URL into the concrete `/ambulance/vehicles` GET endpoint.
 */
function resolveAmbulanceEndpoint(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
        return null;
    }

    const candidate = rawUrl.trim().replace(/\/+$/, '');
    let parsed;
    try {
        parsed = new URL(candidate);
    } catch {
        throw new Error('AMBULANCE_API_URL tidak valid. Gunakan format URL lengkap seperti https://domain.anda');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('AMBULANCE_API_URL harus menggunakan protokol http atau https.');
    }

    const cleanPath = parsed.pathname.replace(/\/+$/, '');
    if (!cleanPath.toLowerCase().endsWith('/ambulance/vehicles')) {
        parsed.pathname = `${cleanPath}/ambulance/vehicles`.replace(/\/{2,}/g, '/');
    } else {
        parsed.pathname = cleanPath;
    }

    return parsed.toString();
}

/**
 * Mask a Bearer token so raw credentials never leave the backend.
 */
function maskToken(token) {
    if (!token || typeof token !== 'string') return null;
    const trimmed = token.trim();
    if (!trimmed) return null;
    if (trimmed.length <= 8) return '********';
    return `****${trimmed.slice(-4)}`;
}

/**
 * Read DEIPED Ambulance API credentials exclusively from backend environment variables.
 */
function getEnvConfig(envSource = process.env) {
    const apiUrl = (envSource.AMBULANCE_API_URL || '').trim();
    const apiToken = (envSource.AMBULANCE_API_TOKEN || '').trim();
    return {
        apiUrl,
        apiToken,
        timeoutMs: parseInt(envSource.AMBULANCE_API_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS), 10) || DEFAULT_TIMEOUT_MS
    };
}

/**
 * Return safe status metadata for frontend without exposing any Bearer token.
 */
function getPublicSyncStatus(envSource = process.env) {
    const cfg = getEnvConfig(envSource);
    let resolvedEndpoint = null;
    try {
        resolvedEndpoint = cfg.apiUrl ? resolveAmbulanceEndpoint(cfg.apiUrl) : null;
    } catch {
        resolvedEndpoint = cfg.apiUrl || null;
    }

    return {
        configured: Boolean(cfg.apiUrl && cfg.apiToken),
        hasUrl: Boolean(cfg.apiUrl),
        hasToken: Boolean(cfg.apiToken),
        resolvedEndpoint,
        tokenMasked: maskToken(cfg.apiToken),
        isSyncInProgress,
        ...runtimeLastSync
    };
}

/**
 * Fetch ambulance list from external DEIPED API (`/ambulance/vehicles`) with server-side Bearer auth.
 */
async function fetchExternalAmbulances({
    apiUrl,
    apiToken,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl = globalThis.fetch
}) {
    if (!apiUrl || !apiToken) {
        const err = new Error('Variabel environment AMBULANCE_API_URL dan AMBULANCE_API_TOKEN belum diatur di server/.env.');
        err.statusCode = 400;
        throw err;
    }

    if (typeof fetchImpl !== 'function') {
        throw new Error('Runtime Node.js tidak menyediakan fetch API.');
    }

    const endpoint = resolveAmbulanceEndpoint(apiUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetchImpl(endpoint, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${apiToken}`,
                Accept: 'application/json'
            },
            signal: controller.signal
        });

        let payload = null;
        try {
            payload = await response.json();
        } catch {
            payload = null;
        }

        if (!response.ok) {
            const apiMsg = payload?.message || payload?.error || `HTTP ${response.status}`;
            let friendlyMsg = `Gagal mengambil data API Ambulance (${response.status}): ${apiMsg}`;
            if (response.status === 401) {
                friendlyMsg = `Autentikasi API DEIPED ditolak (401): ${apiMsg}. Periksa AMBULANCE_API_TOKEN di server/.env.`;
            } else if (response.status === 429) {
                friendlyMsg = `Batas permintaan API DEIPED tercapai (429): ${apiMsg}. Silakan tunggu beberapa saat.`;
            } else if (response.status === 500 || response.status === 503) {
                friendlyMsg = `Server API DEIPED belum siap atau gangguan (${response.status}): ${apiMsg}`;
            }
            const err = new Error(friendlyMsg);
            err.statusCode = response.status >= 400 && response.status < 600 ? 502 : 500;
            err.upstreamStatus = response.status;
            throw err;
        }

        if (!payload || payload.status !== 'success' || !Array.isArray(payload?.data?.vehicles)) {
            const err = new Error('Format respons API DEIPED tidak sesuai dokumentasi (status/data.vehicles tidak valid).');
            err.statusCode = 502;
            throw err;
        }

        return {
            endpoint,
            vehicles: payload.data.vehicles
        };
    } catch (error) {
        if (error.name === 'AbortError') {
            const err = new Error(`Koneksi ke API Ambulance DEIPED timeout setelah ${timeoutMs} ms.`);
            err.statusCode = 504;
            throw err;
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Deduplicate external vehicles by normalized plate number, keeping the highest valid `last_km`.
 */
function indexExternalVehiclesByPlate(apiVehicles) {
    const byPlate = new Map();
    const invalidEntries = [];

    for (const item of apiVehicles) {
        const normalizedPlate = normalizePlateNumber(item?.plate_number);
        const parsedKm = Number(item?.last_km);

        if (!normalizedPlate) {
            invalidEntries.push({
                externalId: item?.id ?? null,
                name: item?.name || '-',
                plateNumber: item?.plate_number || '',
                lastKm: item?.last_km ?? null,
                reason: 'Plat nomor kosong di data API'
            });
            continue;
        }

        if (!Number.isFinite(parsedKm) || parsedKm < 0) {
            invalidEntries.push({
                externalId: item?.id ?? null,
                name: item?.name || '-',
                plateNumber: item?.plate_number || '',
                lastKm: item?.last_km ?? null,
                reason: 'Nilai last_km tidak valid'
            });
            continue;
        }

        const cleanKm = Math.round(parsedKm);
        const existing = byPlate.get(normalizedPlate);
        if (!existing || cleanKm > existing.lastKm) {
            byPlate.set(normalizedPlate, {
                externalId: item.id,
                name: item.name || '-',
                plateNumber: item.plate_number,
                normalizedPlate,
                lastKm: cleanKm
            });
        }
    }

    return { byPlate, invalidEntries };
}

/**
 * Synchronize Ambulance last KM from external DEIPED `/ambulance/vehicles` API
 * into local Manajemen Aset `Vehicle.odometer` records, matching by normalized license plate.
 *
 * By default (`forceOverwrite = false`), odometer is only updated when API `last_km` is strictly greater
 * than Manajemen Aset's current odometer (`Math.max(vehicle.odometer, latestCompletedBooking.endKm)`),
 * respecting DEIPED's behavior where unverified trips can cause `last_km` to lag slightly behind actual KM.
 */
async function syncAmbulanceOdometers({
    dryRun = false,
    forceOverwrite = false,
    triggeredBy = 'manual',
    prismaClient = defaultPrisma,
    fetchImpl = globalThis.fetch,
    envSource = process.env
} = {}) {
    if (!dryRun && isSyncInProgress) {
        const err = new Error('Sinkronisasi KM Ambulance sedang berjalan. Tunggu beberapa detik lalu coba lagi.');
        err.statusCode = 409;
        throw err;
    }

    const cfg = getEnvConfig(envSource);
    if (!dryRun) isSyncInProgress = true;

    const startedAt = new Date().toISOString();

    try {
        const { endpoint, vehicles: apiVehicles } = await fetchExternalAmbulances({
            apiUrl: cfg.apiUrl,
            apiToken: cfg.apiToken,
            timeoutMs: cfg.timeoutMs,
            fetchImpl
        });

        const { byPlate: apiByPlate, invalidEntries } = indexExternalVehiclesByPlate(apiVehicles);

        const localVehicles = await prismaClient.vehicle.findMany({
            include: {
                bookings: {
                    where: { status: 'COMPLETED', endKm: { not: null } },
                    orderBy: { tripEndTime: 'desc' },
                    take: 1,
                    select: { endKm: true }
                }
            }
        });

        const localByPlate = new Map();
        for (const vehicle of localVehicles) {
            const norm = normalizePlateNumber(vehicle.plateNumber);
            if (!norm) continue;
            if (!localByPlate.has(norm)) localByPlate.set(norm, []);
            localByPlate.get(norm).push(vehicle);
        }

        const matchedResults = [];
        const unmatchedApiVehicles = [...invalidEntries];
        const matchedLocalIds = new Set();

        let updatedCount = 0;
        let upToDateCount = 0;
        let localAheadCount = 0;

        for (const [normPlate, apiItem] of apiByPlate.entries()) {
            const localMatches = localByPlate.get(normPlate);
            if (!localMatches || localMatches.length === 0) {
                unmatchedApiVehicles.push({
                    externalId: apiItem.externalId,
                    name: apiItem.name,
                    plateNumber: apiItem.plateNumber,
                    lastKm: apiItem.lastKm,
                    reason: 'Plat nomor belum terdaftar di Manajemen Aset'
                });
                continue;
            }

            for (const localVehicle of localMatches) {
                matchedLocalIds.add(localVehicle.id);
                const dbOdometer = localVehicle.odometer || 0;
                const bookingEndKm = localVehicle.bookings?.[0]?.endKm || 0;
                const currentOdometer = Math.max(dbOdometer, bookingEndKm);

                let action = 'up_to_date';
                let targetOdometer = currentOdometer;
                let willUpdate = false;

                if (apiItem.lastKm > currentOdometer) {
                    willUpdate = true;
                    targetOdometer = apiItem.lastKm;
                    action = dryRun ? 'will_update' : 'updated';
                    updatedCount += 1;
                } else if (forceOverwrite && apiItem.lastKm !== dbOdometer) {
                    willUpdate = true;
                    targetOdometer = apiItem.lastKm;
                    action = dryRun ? 'will_force_overwrite' : 'forced_overwrite';
                    updatedCount += 1;
                } else if (apiItem.lastKm === currentOdometer) {
                    action = 'up_to_date';
                    upToDateCount += 1;
                } else {
                    action = 'local_ahead';
                    localAheadCount += 1;
                }

                if (!dryRun && willUpdate) {
                    await prismaClient.vehicle.update({
                        where: { id: localVehicle.id },
                        data: { odometer: targetOdometer }
                    });
                }

                matchedResults.push({
                    vehicleId: localVehicle.id,
                    localName: localVehicle.name,
                    localType: localVehicle.type,
                    localPlateNumber: localVehicle.plateNumber,
                    externalId: apiItem.externalId,
                    externalName: apiItem.name,
                    externalPlateNumber: apiItem.plateNumber,
                    previousOdometer: currentOdometer,
                    apiLastKm: apiItem.lastKm,
                    newOdometer: willUpdate ? targetOdometer : currentOdometer,
                    deltaKm: apiItem.lastKm - currentOdometer,
                    action
                });
            }
        }

        const unmatchedLocalAmbulances = localVehicles
            .filter((v) => {
                const t = (v.type || '').toLowerCase();
                return (t.includes('ambulance') || t.includes('ambulans')) && !matchedLocalIds.has(v.id);
            })
            .map((v) => ({
                vehicleId: v.id,
                name: v.name,
                plateNumber: v.plateNumber,
                odometer: Math.max(v.odometer || 0, v.bookings?.[0]?.endKm || 0)
            }));

        const summary = {
            dryRun,
            forceOverwrite,
            endpoint,
            syncedAt: startedAt,
            triggeredBy,
            totalApiVehicles: apiVehicles.length,
            matchedCount: matchedResults.length,
            updatedCount,
            upToDateCount,
            localAheadCount,
            unmatchedApiCount: unmatchedApiVehicles.length,
            unmatchedLocalAmbulanceCount: unmatchedLocalAmbulances.length
        };

        if (!dryRun) {
            runtimeLastSync = {
                lastSyncAt: startedAt,
                lastSyncTrigger: triggeredBy,
                lastSyncSummary: summary,
                lastSyncError: null
            };
        }

        return {
            summary,
            matched: matchedResults,
            unmatchedApiVehicles,
            unmatchedLocalAmbulances
        };
    } catch (error) {
        if (!dryRun) {
            runtimeLastSync = {
                ...runtimeLastSync,
                lastSyncAt: startedAt,
                lastSyncTrigger: triggeredBy,
                lastSyncError: error.message
            };
        }
        throw error;
    } finally {
        if (!dryRun) isSyncInProgress = false;
    }
}

function isAmbulanceSyncConfigured(envSource = process.env) {
    const cfg = getEnvConfig(envSource);
    return Boolean(cfg.apiUrl && cfg.apiToken);
}

/**
 * Scheduled job entry point: silently skips when DEIPED credentials are not configured in `.env`.
 */
async function runScheduledAmbulanceSync() {
    if (!isAmbulanceSyncConfigured()) return null;
    try {
        const result = await syncAmbulanceOdometers({ triggeredBy: 'scheduler' });
        console.log(
            `[AmbulanceSync] Scheduled sync done: matched=${result.summary.matchedCount}, updated=${result.summary.updatedCount}, unmatchedApi=${result.summary.unmatchedApiCount}`
        );
        return result;
    } catch (error) {
        console.error('[AmbulanceSync] Scheduled sync error:', error.message);
        return null;
    }
}

module.exports = {
    normalizePlateNumber,
    resolveAmbulanceEndpoint,
    maskToken,
    getPublicSyncStatus,
    fetchExternalAmbulances,
    indexExternalVehiclesByPlate,
    syncAmbulanceOdometers,
    isAmbulanceSyncConfigured,
    runScheduledAmbulanceSync
};
