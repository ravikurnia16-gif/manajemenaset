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
            fuelType, capacity, color, odometer, photo, status
        } = req.body;

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
                status: status || 'ACTIVE'
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
            fuelType, capacity, color, odometer, photo, status
        } = req.body;

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
                status
            }
        });
        res.json(vehicle);
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
