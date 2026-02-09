const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

exports.getAllUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                email: true,
                nip: true,
                phone: true,
                position: true,
                role: true,
                unitId: true,
                unit: { select: { name: true } },
                createdAt: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createUser = async (req, res) => {
    const { username, email, password, role, nip, unitId, phone, position } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                username,
                email: email || null,
                nip: nip || null,
                phone,
                position,
                password: hashedPassword,
                role: role || 'USER',
                unitId: unitId ? parseInt(unitId) : null
            }
        });
        res.json({ message: 'User created successfully', user: { id: user.id, username: user.username, role: user.role } });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Username, Email, atau NIP sudah terdaftar' });
        }
        res.status(500).json({ error: error.message });
    }
};


exports.updateUser = async (req, res) => {
    const { id } = req.params;
    const { username, email, password, role, nip, unitId, phone, position } = req.body;
    try {
        const data = {
            username,
            email: email || null,
            nip: nip || null,
            phone,
            position,
            role: role || 'USER',
            unitId: unitId ? parseInt(unitId) : null
        };

        if (password) {
            data.password = await bcrypt.hash(password, 10);
        }

        const user = await prisma.user.update({
            where: { id: parseInt(id) },
            data
        });
        res.json({ message: 'User updated successfully', user: { id: user.id, username: user.username, role: user.role } });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Username, Email, atau NIP sudah terdaftar' });
        }
        res.status(500).json({ error: error.message });
    }
};

exports.deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        // Prevent deleting self (optional but good)
        if (req.user && req.user.id === parseInt(id)) {
            return res.status(400).json({ error: 'Tidak bisa menghapus akun sendiri' });
        }

        await prisma.user.delete({
            where: { id: parseInt(id) }
        });
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
