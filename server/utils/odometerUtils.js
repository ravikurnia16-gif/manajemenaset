const MIN_ODOMETER_DIGITS = 3;
const MAX_ODOMETER_DIGITS = 8;

const ODOMETER_DIGIT_OPTIONS = [
    { value: 4, label: '4 Digit — Ribuan (Maks. 9.999 km)' },
    { value: 5, label: '5 Digit — Puluhan Ribu / Motor (Maks. 99.999 km)' },
    { value: 6, label: '6 Digit — Ratusan Ribu / Mobil (Maks. 999.999 km)' },
    { value: 7, label: '7 Digit — Jutaan (Maks. 9.999.999 km)' }
];

function resolveOdometerDigits(vehicleOrDigits, vehicleType = '') {
    let rawDigits = vehicleOrDigits;
    let resolvedType = vehicleType;

    if (vehicleOrDigits && typeof vehicleOrDigits === 'object') {
        rawDigits = vehicleOrDigits.odometerDigits;
        resolvedType = vehicleOrDigits.type || vehicleType || '';
    }

    const parsed = parseInt(rawDigits, 10);
    if (!Number.isNaN(parsed) && parsed >= MIN_ODOMETER_DIGITS && parsed <= MAX_ODOMETER_DIGITS) {
        return parsed;
    }

    return String(resolvedType).toLowerCase().includes('motor') ? 5 : 6;
}

function getOdometerModulus(digits = 6) {
    const safeDigits = resolveOdometerDigits(digits);
    return Math.pow(10, safeDigits);
}

function getOdometerMax(digits = 6) {
    return getOdometerModulus(digits) - 1;
}

function validateOdometerValue(rawValue, digits = 6, label = 'Kilometer') {
    const safeDigits = resolveOdometerDigits(digits);
    const maxKm = getOdometerMax(safeDigits);
    const parsed = parseInt(rawValue, 10);

    if (Number.isNaN(parsed) || parsed < 0) {
        return {
            valid: false,
            value: null,
            digits: safeDigits,
            maxKm,
            error: `${label} harus berupa angka 0 atau lebih.`
        };
    }

    if (parsed > maxKm) {
        return {
            valid: false,
            value: parsed,
            digits: safeDigits,
            maxKm,
            error: `${label} (${parsed.toLocaleString('id-ID')}) melebihi batas maksimal ${safeDigits} digit (${maxKm.toLocaleString('id-ID')} km).`
        };
    }

    return {
        valid: true,
        value: parsed,
        digits: safeDigits,
        maxKm,
        error: null
    };
}

/**
 * Compare two sequential odometer readings while allowing physical rollover
 * (e.g. a 5-digit motorcycle odometer wrapping 99.999 -> 1 without false anomaly).
 */
function compareOdometerProgression(prevKm, nextKm, digits = 6) {
    const safeDigits = resolveOdometerDigits(digits);
    const mod = getOdometerModulus(safeDigits);
    const maxKm = mod - 1;
    const prev = Math.max(0, parseInt(prevKm, 10) || 0);
    const nextCheck = validateOdometerValue(nextKm, safeDigits, 'Kilometer');

    if (!nextCheck.valid) {
        return {
            valid: false,
            isRollover: false,
            reason: 'EXCEEDS_DIGITS',
            distance: 0,
            discrepancy: 0,
            digits: safeDigits,
            maxKm,
            error: nextCheck.error
        };
    }

    const next = nextCheck.value;
    if (next >= prev) {
        const diff = next - prev;
        return {
            valid: true,
            isRollover: false,
            reason: null,
            distance: diff,
            discrepancy: diff,
            digits: safeDigits,
            maxKm,
            error: null
        };
    }

    const rolloverDistance = (mod - prev) + next;
    const upperZoneThreshold = Math.floor(mod * 0.85);
    const maxRolloverDelta = Math.min(25000, Math.floor(mod * 0.25));

    if (prev >= upperZoneThreshold && rolloverDistance <= maxRolloverDelta) {
        const discrepancy = (prev === maxKm && next === 1) ? 1 : rolloverDistance;
        return {
            valid: true,
            isRollover: true,
            reason: 'ROLLOVER',
            distance: rolloverDistance,
            discrepancy,
            digits: safeDigits,
            maxKm,
            error: null
        };
    }

    return {
        valid: false,
        isRollover: false,
        reason: 'LOWER_THAN_PREV',
        distance: next - prev,
        discrepancy: 0,
        digits: safeDigits,
        maxKm,
        error: `Kilometer (${next.toLocaleString('id-ID')}) tidak boleh lebih kecil dari pembacaan sebelumnya (${prev.toLocaleString('id-ID')}).`
    };
}

/**
 * Pick the more recent odometer between Vehicle.odometer and latestCompletedBooking.endKm,
 * avoiding snapping back to 99.9xx after a rollover to 0/1+.
 */
function pickLatestOdometer(vehicleOdometer, latestBookingEndKm, digits = 6) {
    const a = Math.max(0, parseInt(vehicleOdometer, 10) || 0);
    if (latestBookingEndKm === null || latestBookingEndKm === undefined || latestBookingEndKm === '') {
        return a;
    }
    const b = Math.max(0, parseInt(latestBookingEndKm, 10) || 0);
    if (a === b) return a;
    const aToB = compareOdometerProgression(a, b, digits);
    if (aToB.isRollover) return b;
    const bToA = compareOdometerProgression(b, a, digits);
    if (bToA.isRollover) return a;
    return Math.max(a, b);
}

/**
 * One-time automatic sync: Motor -> 5 digits, Mobil/non-Motor -> 6 digits.
 * Guarded by `Setting.vehicleOdometerDigitsSynced` so subsequent manual edits are preserved.
 */
async function syncDefaultVehicleOdometerDigitsOnce(prismaClient, { respectLocalStorage = true } = {}) {
    if (respectLocalStorage && process.env.USE_LOCAL_STORAGE === 'true') {
        return { skipped: true };
    }
    if (!prismaClient) {
        return { error: 'Prisma client is required' };
    }

    try {
        const setting = await prismaClient.setting.findUnique({
            where: { id: 1 },
            select: { vehicleOdometerDigitsSynced: true }
        });
        if (setting?.vehicleOdometerDigitsSynced) {
            return { alreadySynced: true };
        }

        const vehicles = await prismaClient.vehicle.findMany({
            select: { id: true, type: true, odometerDigits: true }
        });

        const motorIds = [];
        const otherIds = [];

        for (const v of vehicles) {
            const isMotor = String(v.type || '').toLowerCase().includes('motor');
            const targetDigits = isMotor ? 5 : 6;
            if (v.odometerDigits !== targetDigits) {
                if (isMotor) motorIds.push(v.id);
                else otherIds.push(v.id);
            }
        }

        let updatedMotors = 0;
        let updatedOthers = 0;

        if (motorIds.length > 0) {
            const resMotor = await prismaClient.vehicle.updateMany({
                where: { id: { in: motorIds } },
                data: { odometerDigits: 5 }
            });
            updatedMotors = resMotor.count || 0;
        }

        if (otherIds.length > 0) {
            const resOther = await prismaClient.vehicle.updateMany({
                where: { id: { in: otherIds } },
                data: { odometerDigits: 6 }
            });
            updatedOthers = resOther.count || 0;
        }

        await prismaClient.setting.upsert({
            where: { id: 1 },
            update: { vehicleOdometerDigitsSynced: true },
            create: { id: 1, vehicleOdometerDigitsSynced: true }
        });

        console.log(`[OdometerDigitsSync] Initialized once: ${updatedMotors} motor -> 5 digit, ${updatedOthers} non-motor -> 6 digit.`);
        return { synced: true, updatedMotors, updatedOthers };
    } catch (err) {
        console.error('[OdometerDigitsSync Error]:', err.message);
        return { error: err.message };
    }
}

module.exports = {
    MIN_ODOMETER_DIGITS,
    MAX_ODOMETER_DIGITS,
    ODOMETER_DIGIT_OPTIONS,
    resolveOdometerDigits,
    getOdometerModulus,
    getOdometerMax,
    validateOdometerValue,
    compareOdometerProgression,
    pickLatestOdometer,
    syncDefaultVehicleOdometerDigitsOnce
};
