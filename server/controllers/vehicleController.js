const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all vehicles
exports.getAllVehicles = async (req, res) => {
    try {
        const vehicles = await prisma.vehicle.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(vehicles);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get vehicle by ID
exports.getVehicleById = async (req, res) => {
    try {
        const vehicle = await prisma.vehicle.findUnique({
            where: { id: parseInt(req.params.id) }
        });
        if (!vehicle) return res.status(404).json({ error: 'Kendaraan tidak ditemukan' });
        res.json(vehicle);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create vehicle
exports.createVehicle = async (req, res) => {
    try {
        const {
            name, brand, model, type, plateNumber,
            fuelType, capacity, color, odometer, photo, status,
            taxDueDate, stnkDueDate
        } = req.body;

        console.log('[DEBUG] Create Vehicle Payload:', { name, plateNumber, taxDueDate, stnkDueDate });

        const vehicle = await prisma.vehicle.create({
            data: {
                name,
                brand,
                model,
                type,
                plateNumber,
                fuelType,
                capacity,
                color,
                odometer: parseInt(odometer) || 0,
                photo,
                status: status || 'ACTIVE',
                taxDueDate: taxDueDate ? new Date(taxDueDate) : null,
                stnkDueDate: stnkDueDate ? new Date(stnkDueDate) : null
            }
        });
        res.status(201).json(vehicle);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Plat nomor sudah terdaftar' });
        }
        res.status(500).json({ error: error.message });
    }
};

// Update vehicle
exports.updateVehicle = async (req, res) => {
    try {
        const {
            name, brand, model, type, plateNumber,
            fuelType, capacity, color, odometer, photo, status,
            taxDueDate, stnkDueDate
        } = req.body;

        console.log('[DEBUG] Update Vehicle Payload:', { id: req.params.id, name, plateNumber, taxDueDate, stnkDueDate });

        const vehicle = await prisma.vehicle.update({
            where: { id: parseInt(req.params.id) },
            data: {
                name,
                brand,
                model,
                type,
                plateNumber,
                fuelType,
                capacity,
                color,
                odometer: parseInt(odometer) || 0,
                photo,
                status,
                taxDueDate: taxDueDate ? new Date(taxDueDate) : null,
                stnkDueDate: stnkDueDate ? new Date(stnkDueDate) : null
            }
        });
        res.json(vehicle);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Checker for Vehicle Tax Notifications (25 days before)
 */
const { sendMessage } = require('../services/whatsappService');

exports.checkTaxNotifications = async () => {
    try {
        console.log('Checking for vehicle tax notifications (25 days)...');

        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 25);

        const startOfTarget = new Date(targetDate.setHours(0, 0, 0, 0));
        const endOfTarget = new Date(targetDate.setHours(23, 59, 59, 999));

        const vehicles = await prisma.vehicle.findMany({
            where: {
                status: 'ACTIVE',
                OR: [
                    { taxDueDate: { gte: startOfTarget, lte: endOfTarget } },
                    { stnkDueDate: { gte: startOfTarget, lte: endOfTarget } }
                ]
            }
        });

        if (vehicles.length === 0) return;

        const kabid = await prisma.user.findFirst({
            where: { role: 'KEPALA_BIDANG' }
        });

        if (!kabid || !kabid.phone) {
            console.log('Kabid Sarpras not found or has no phone for tax notification.');
            return;
        }

        for (const vehicle of vehicles) {
            let taxType = "";
            let dueDate = null;

            if (vehicle.taxDueDate >= startOfTarget && vehicle.taxDueDate <= endOfTarget) {
                taxType = "Pajak Tahunan";
                dueDate = vehicle.taxDueDate;
            } else {
                taxType = "Pajak 5 Tahunan (STNK)";
                dueDate = vehicle.stnkDueDate;
            }

            const message = `📢 *PENGINGAT PAJAK KENDARAAN*\n\n` +
                `Kendaraan *${vehicle.name} (${vehicle.plateNumber})* akan jatuh tempo *${taxType}* dalam 25 hari.\n\n` +
                `Tanggal Jatuh Tempo: ${new Date(dueDate).toLocaleDateString('id-ID')}\n` +
                `Mohon segera diproses pembayarannya.`;

            await sendMessage(kabid.phone, message);
            console.log(`Tax notification sent for ${vehicle.name} to ${kabid.phone}`);
        }
    } catch (error) {
        console.error('Failed to check tax notifications:', error.message);
    }
};

// Manual trigger for testing notifications
exports.triggerTaxCheck = async (req, res) => {
    try {
        await exports.checkTaxNotifications();
        res.json({ message: 'Tax notification check triggered. Check server console for logs.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Send a direct test message to Kabid Sarpras
exports.sendTestWA = async (req, res) => {
    try {
        const kabid = await prisma.user.findFirst({
            where: { role: 'KEPALA_BIDANG' }
        });

        if (!kabid || !kabid.phone) {
            return res.status(404).json({ error: 'Kabid Sarpras tidak ditemukan atau tidak memiliki nomor HP.' });
        }

        const message = `🧪 *TEST NOTIFIKASI SISTEM*\n\nWhatsApp Service Aktif!\nTarget: ${kabid.name}\nNomor: ${kabid.phone}\nPesan ini dikirim untuk memverifikasi jalur komunikasi.`;

        await sendMessage(kabid.phone, message);
        res.json({ message: `Test message sent to ${kabid.phone}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Send a direct message without DB lookup (for local testing without DB)
exports.sendPureTestWA = async (req, res) => {
    try {
        const { phone } = req.query;
        if (!phone) return res.status(400).json({ error: 'Parameter ?phone=... wajib diisi' });

        const message = `🧪 *TEST PURE WA*\n\nWhatsApp Service successfully reached from local server!\nTarget: ${phone}\nPesan ini dikirim tanpa koneksi database.`;

        await sendMessage(phone, message);
        res.json({ message: `Pure test message sent to ${phone}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete vehicle
exports.deleteVehicle = async (req, res) => {
    try {
        await prisma.vehicle.delete({
            where: { id: parseInt(req.params.id) }
        });
        res.json({ message: 'Kendaraan berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
