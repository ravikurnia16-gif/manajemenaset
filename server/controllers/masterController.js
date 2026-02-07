const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getAllUnits = async (req, res) => {
    try {
        const units = await prisma.unit.findMany();
        res.json(units);
    } catch (error) {
        console.error('GetUnits Error:', error);
        res.status(500).json({ error: 'Database Error (Unit): ' + error.message });
    }
};

exports.getAllRooms = async (req, res) => {
    try {
        const rooms = await prisma.room.findMany({
            include: { unit: true }
        });
        res.json(rooms);
    } catch (error) {
        console.error('GetRooms Error:', error);
        res.status(500).json({ error: 'Database Error (Ruangan): ' + error.message });
    }
};

exports.getAllCategories = async (req, res) => {
    try {
        const categories = await prisma.category.findMany();
        res.json(categories);
    } catch (error) {
        console.error('GetCategories Error:', error);
        res.status(500).json({ error: 'Database Error (Kategori): ' + error.message });
    }
};
