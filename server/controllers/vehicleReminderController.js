const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Routine maintenance items categorized by vehicle type
const ROUTINE_COMPONENTS_BY_TYPE = {
    // ===== MOTOR / SEPEDA MOTOR =====
    MOTOR: [
        { name: 'Oli Mesin', intervalKm: 2000, intervalMonths: 2, icon: '🛢️' },
        { name: 'Busi', intervalKm: 8000, intervalMonths: 6, icon: '⚡' },
        { name: 'Filter Udara', intervalKm: 8000, intervalMonths: 6, icon: '💨' },
        { name: 'Oli Gardan (Matic)', intervalKm: 8000, intervalMonths: 6, icon: '⚙️' },
        { name: 'V-Belt (Matic)', intervalKm: 20000, intervalMonths: 18, icon: '🔗' },
        { name: 'Roller (Matic)', intervalKm: 20000, intervalMonths: 18, icon: '🔘' },
        { name: 'Rantai & Gir (Manual)', intervalKm: 15000, intervalMonths: 12, icon: '⛓️' },
        { name: 'Kampas Rem', intervalKm: 15000, intervalMonths: 12, icon: '🛑' },
        { name: 'Minyak Rem', intervalKm: 20000, intervalMonths: 18, icon: '💧' },
        { name: 'Ban (Ganti)', intervalKm: 20000, intervalMonths: 18, icon: '🔘' },
        { name: 'Aki (Battery)', intervalKm: null, intervalMonths: 12, icon: '🔋' },
        { name: 'Air Radiator (Coolant)', intervalKm: 20000, intervalMonths: 24, icon: '🌡️' },
        { name: 'Tune Up / Servis Berkala', intervalKm: 4000, intervalMonths: 3, icon: '🔩' },
    ],

    // ===== BUS / MICROBUS =====
    BUS: [
        { name: 'Oli Mesin', intervalKm: 10000, intervalMonths: 3, icon: '🛢️' },
        { name: 'Filter Oli', intervalKm: 10000, intervalMonths: 3, icon: '🔧' },
        { name: 'Oli Transmisi', intervalKm: 40000, intervalMonths: 12, icon: '⚙️' },
        { name: 'Oli Gardan', intervalKm: 40000, intervalMonths: 12, icon: '⚙️' },
        { name: 'Filter Udara', intervalKm: 15000, intervalMonths: 6, icon: '💨' },
        { name: 'Filter AC', intervalKm: 15000, intervalMonths: 6, icon: '❄️' },
        { name: 'Kompresor AC', intervalKm: null, intervalMonths: 24, icon: '❄️' },
        { name: 'Filter BBM', intervalKm: 20000, intervalMonths: 6, icon: '⛽' },
        { name: 'Filter Solar / Water Separator', intervalKm: 10000, intervalMonths: 6, icon: '⛽' },
        { name: 'Kampas Rem', intervalKm: 30000, intervalMonths: 12, icon: '🛑' },
        { name: 'Minyak Rem', intervalKm: 40000, intervalMonths: 18, icon: '💧' },
        { name: 'Ban (Rotasi/Ganti)', intervalKm: 50000, intervalMonths: 18, icon: '🔘' },
        { name: 'Spooring & Balancing', intervalKm: 20000, intervalMonths: 12, icon: '🎯' },
        { name: 'Aki (Battery)', intervalKm: null, intervalMonths: 18, icon: '🔋' },
        { name: 'Air Radiator (Coolant)', intervalKm: 40000, intervalMonths: 12, icon: '🌡️' },
        { name: 'Greasing / Pelumasan', intervalKm: 5000, intervalMonths: 3, icon: '🧴' },
        { name: 'Sistem Pneumatik (Angin Rem)', intervalKm: 20000, intervalMonths: 12, icon: '🌬️' },
        { name: 'Busi / Nozzle Injector', intervalKm: 40000, intervalMonths: 12, icon: '⚡' },
        { name: 'Timing Belt/Chain', intervalKm: 100000, intervalMonths: 48, icon: '🔗' },
        { name: 'Tune Up / Servis Berkala', intervalKm: 10000, intervalMonths: 3, icon: '🔩' },
    ],

    // ===== GENERAL (Mobil, Pickup, Minibus, dll) =====
    GENERAL: [
        { name: 'Oli Mesin', intervalKm: 5000, intervalMonths: 6, icon: '🛢️' },
        { name: 'Filter Oli', intervalKm: 10000, intervalMonths: 6, icon: '🔧' },
        { name: 'Oli Transmisi', intervalKm: 20000, intervalMonths: 12, icon: '⚙️' },
        { name: 'Oli Gardan', intervalKm: 20000, intervalMonths: 12, icon: '⚙️' },
        { name: 'Filter Udara', intervalKm: 15000, intervalMonths: 12, icon: '💨' },
        { name: 'Filter AC', intervalKm: 15000, intervalMonths: 12, icon: '❄️' },
        { name: 'Filter BBM', intervalKm: 20000, intervalMonths: 12, icon: '⛽' },
        { name: 'Kampas Rem', intervalKm: 30000, intervalMonths: 18, icon: '🛑' },
        { name: 'Ban (Rotasi/Ganti)', intervalKm: 40000, intervalMonths: 24, icon: '🔘' },
        { name: 'Spooring & Balancing', intervalKm: 20000, intervalMonths: 12, icon: '🎯' },
        { name: 'Aki (Battery)', intervalKm: null, intervalMonths: 18, icon: '🔋' },
        { name: 'Air Radiator (Coolant)', intervalKm: 40000, intervalMonths: 24, icon: '🌡️' },
        { name: 'Minyak Rem', intervalKm: 40000, intervalMonths: 24, icon: '💧' },
        { name: 'Busi', intervalKm: 20000, intervalMonths: 12, icon: '⚡' },
        { name: 'Timing Belt/Chain', intervalKm: 80000, intervalMonths: 48, icon: '🔗' },
        { name: 'Tune Up / Servis Berkala', intervalKm: 10000, intervalMonths: 6, icon: '🔩' },
    ],
};

// Helper: resolve vehicle type string to component category
function resolveVehicleCategory(vehicleType) {
    if (!vehicleType) return 'GENERAL';
    const t = vehicleType.toLowerCase();
    if (t.includes('motor') || t.includes('sepeda')) return 'MOTOR';
    if (t.includes('bus') || t.includes('microbus')) return 'BUS';
    return 'GENERAL';
}

// Legacy flat list (for backward compat exports)
const ROUTINE_COMPONENTS = ROUTINE_COMPONENTS_BY_TYPE.GENERAL;

/**
 * Get the list of routine components (optionally filtered by vehicleType)
 * GET /api/vehicles/reminders/routine-components?vehicleType=Motor
 */
exports.getRoutineComponents = async (req, res) => {
    try {
        const { vehicleType } = req.query;
        const category = resolveVehicleCategory(vehicleType);
        res.json(ROUTINE_COMPONENTS_BY_TYPE[category]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get all reminders for all vehicles (Dashboard view)
 */
exports.getAllReminders = async (req, res) => {
    try {
        const vehicles = await prisma.vehicle.findMany({
            where: { status: 'ACTIVE' },
            select: {
                id: true,
                name: true,
                plateNumber: true,
                odometer: true,
                maintenanceReminders: {
                    orderBy: { componentName: 'asc' }
                }
            },
            orderBy: { name: 'asc' }
        });

        // Calculate status for each reminder
        const now = new Date();
        const result = vehicles.map(vehicle => {
            const reminders = vehicle.maintenanceReminders.map(r => {
                const status = calculateStatus(r, vehicle.odometer, now);
                return { ...r, calculatedStatus: status.status, detail: status.detail };
            });

            // Sort: OVERDUE first, then WARNING, then OK
            const statusOrder = { OVERDUE: 0, WARNING: 1, OK: 2 };
            reminders.sort((a, b) => statusOrder[a.calculatedStatus] - statusOrder[b.calculatedStatus]);

            const worstStatus = reminders.length > 0
                ? reminders[0].calculatedStatus
                : 'OK';

            return {
                ...vehicle,
                maintenanceReminders: reminders,
                overallStatus: worstStatus,
                totalReminders: reminders.length,
                overdueCount: reminders.filter(r => r.calculatedStatus === 'OVERDUE').length,
                warningCount: reminders.filter(r => r.calculatedStatus === 'WARNING').length,
            };
        });

        // Sort vehicles: those with issues first
        const vehicleStatusOrder = { OVERDUE: 0, WARNING: 1, OK: 2 };
        result.sort((a, b) => vehicleStatusOrder[a.overallStatus] - vehicleStatusOrder[b.overallStatus]);

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get reminders for a specific vehicle
 */
exports.getVehicleReminders = async (req, res) => {
    try {
        const vehicleId = parseInt(req.params.vehicleId);
        const vehicle = await prisma.vehicle.findUnique({
            where: { id: vehicleId },
            select: { id: true, name: true, plateNumber: true, odometer: true }
        });

        if (!vehicle) return res.status(404).json({ error: 'Kendaraan tidak ditemukan' });

        const reminders = await prisma.vehicleMaintenanceReminder.findMany({
            where: { vehicleId },
            orderBy: { componentName: 'asc' }
        });

        const now = new Date();
        const result = reminders.map(r => {
            const status = calculateStatus(r, vehicle.odometer, now);
            return { ...r, calculatedStatus: status.status, detail: status.detail };
        });

        res.json({ vehicle, reminders: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Upsert a reminder (create or update) for a vehicle component
 */
exports.upsertReminder = async (req, res) => {
    try {
        const { vehicleId, componentName, lastServicedKm, lastServicedDate,
            intervalKm, intervalMonths, lastCost } = req.body;

        // Calculate targets
        const targetKm = (lastServicedKm && intervalKm) ? lastServicedKm + intervalKm : null;
        let targetDate = null;
        if (lastServicedDate && intervalMonths) {
            targetDate = new Date(lastServicedDate);
            targetDate.setMonth(targetDate.getMonth() + intervalMonths);
        }

        const reminder = await prisma.vehicleMaintenanceReminder.upsert({
            where: {
                vehicleId_componentName: {
                    vehicleId: parseInt(vehicleId),
                    componentName
                }
            },
            create: {
                vehicleId: parseInt(vehicleId),
                componentName,
                lastServicedKm: lastServicedKm ? parseInt(lastServicedKm) : null,
                lastServicedDate: lastServicedDate ? new Date(lastServicedDate) : null,
                intervalKm: intervalKm ? parseInt(intervalKm) : null,
                intervalMonths: intervalMonths ? parseInt(intervalMonths) : null,
                targetKm,
                targetDate,
                lastCost: lastCost ? parseFloat(lastCost) : null,
                status: 'OK'
            },
            update: {
                lastServicedKm: lastServicedKm ? parseInt(lastServicedKm) : null,
                lastServicedDate: lastServicedDate ? new Date(lastServicedDate) : null,
                intervalKm: intervalKm ? parseInt(intervalKm) : null,
                intervalMonths: intervalMonths ? parseInt(intervalMonths) : null,
                targetKm,
                targetDate,
                lastCost: lastCost ? parseFloat(lastCost) : null,
            }
        });

        res.json(reminder);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Delete a reminder
 */
exports.deleteReminder = async (req, res) => {
    try {
        await prisma.vehicleMaintenanceReminder.delete({
            where: { id: parseInt(req.params.id) }
        });
        res.json({ message: 'Pengingat berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Calculate hybrid status based on KM and Date
 */
function calculateStatus(reminder, currentKm, now) {
    let kmStatus = 'OK';
    let dateStatus = 'OK';
    let detail = '';

    // KM-based check
    if (reminder.targetKm && currentKm) {
        const kmRemaining = reminder.targetKm - currentKm;
        if (kmRemaining <= 0) {
            kmStatus = 'OVERDUE';
            detail += `KM sudah lewat ${Math.abs(kmRemaining).toLocaleString()} km. `;
        } else if (kmRemaining <= 500) {
            kmStatus = 'WARNING';
            detail += `Sisa ${kmRemaining.toLocaleString()} km lagi. `;
        } else {
            detail += `Sisa ${kmRemaining.toLocaleString()} km. `;
        }
    }

    // Date-based check
    if (reminder.targetDate) {
        const targetDate = new Date(reminder.targetDate);
        const diffDays = Math.ceil((targetDate - now) / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) {
            dateStatus = 'OVERDUE';
            detail += `Sudah lewat ${Math.abs(diffDays)} hari.`;
        } else if (diffDays <= 14) {
            dateStatus = 'WARNING';
            detail += `Sisa ${diffDays} hari lagi.`;
        } else {
            detail += `Sisa ${diffDays} hari.`;
        }
    }

    // Hybrid: take the worst status
    const statusPriority = { OVERDUE: 0, WARNING: 1, OK: 2 };
    const finalStatus = statusPriority[kmStatus] < statusPriority[dateStatus] ? kmStatus : dateStatus;

    return { status: finalStatus, detail: detail.trim() };
}

exports.calculateStatus = calculateStatus;
exports.ROUTINE_COMPONENTS = ROUTINE_COMPONENTS;
exports.ROUTINE_COMPONENTS_BY_TYPE = ROUTINE_COMPONENTS_BY_TYPE;
exports.resolveVehicleCategory = resolveVehicleCategory;
