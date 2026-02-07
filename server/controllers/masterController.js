const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getAllUnits = async (req, res) => {
    try {
        const units = await prisma.unit.findMany();
        res.json(units);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAllRooms = async (req, res) => {
    try {
        const rooms = await prisma.room.findMany({
            include: { unit: true }
        });
        res.json(rooms);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
