export const ODOMETER_DIGIT_OPTIONS = [
    { value: 4, label: '4 Digit — Ribuan (Maks. 9.999 km)' },
    { value: 5, label: '5 Digit — Puluhan Ribu / Motor (Maks. 99.999 km)' },
    { value: 6, label: '6 Digit — Ratusan Ribu / Mobil (Maks. 999.999 km)' },
    { value: 7, label: '7 Digit — Jutaan (Maks. 9.999.999 km)' }
];

export function resolveOdometerDigits(vehicleOrDigits, vehicleType = '') {
    let rawDigits = vehicleOrDigits;
    let resolvedType = vehicleType;

    if (vehicleOrDigits && typeof vehicleOrDigits === 'object') {
        rawDigits = vehicleOrDigits.odometerDigits;
        resolvedType = vehicleOrDigits.type || vehicleType || '';
    }

    const parsed = parseInt(rawDigits, 10);
    if (!Number.isNaN(parsed) && parsed >= 3 && parsed <= 8) {
        return parsed;
    }

    return String(resolvedType).toLowerCase().includes('motor') ? 5 : 6;
}

export function getOdometerModulus(digits = 6) {
    return Math.pow(10, resolveOdometerDigits(digits));
}

export function getOdometerMax(digits = 6) {
    return getOdometerModulus(digits) - 1;
}

export function sanitizeOdometerInput(rawValue, digits = 6) {
    const safeDigits = resolveOdometerDigits(digits);
    const cleaned = String(rawValue ?? '').replace(/\D/g, '');
    return cleaned.slice(0, safeDigits);
}

export function compareOdometerProgression(prevKm, nextKm, digits = 6) {
    const safeDigits = resolveOdometerDigits(digits);
    const mod = getOdometerModulus(safeDigits);
    const maxKm = mod - 1;
    const prev = Math.max(0, parseInt(prevKm, 10) || 0);
    const next = parseInt(nextKm, 10);

    if (Number.isNaN(next) || next < 0) {
        return { valid: false, isRollover: false, reason: 'INVALID', distance: 0, discrepancy: 0, digits: safeDigits, maxKm };
    }
    if (next > maxKm) {
        return {
            valid: false,
            isRollover: false,
            reason: 'EXCEEDS_DIGITS',
            distance: 0,
            discrepancy: 0,
            digits: safeDigits,
            maxKm,
            error: `Kilometer (${next.toLocaleString('id-ID')}) melebihi batas maksimal ${safeDigits} digit (${maxKm.toLocaleString('id-ID')} km).`
        };
    }

    if (next >= prev) {
        const diff = next - prev;
        return { valid: true, isRollover: false, reason: null, distance: diff, discrepancy: diff, digits: safeDigits, maxKm, error: null };
    }

    const rolloverDistance = (mod - prev) + next;
    const upperZoneThreshold = Math.floor(mod * 0.85);
    const maxRolloverDelta = Math.min(25000, Math.floor(mod * 0.25));

    if (prev >= upperZoneThreshold && rolloverDistance <= maxRolloverDelta) {
        const discrepancy = (prev === maxKm && next === 1) ? 1 : rolloverDistance;
        return { valid: true, isRollover: true, reason: 'ROLLOVER', distance: rolloverDistance, discrepancy, digits: safeDigits, maxKm, error: null };
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
