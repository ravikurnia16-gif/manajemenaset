const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

exports.getAllUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                name: true, // Add name
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
    const { username, name, email, password, role, nip, unitId, phone, position } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                username,
                name,
                email: email || null,
                nip: username, // Sync with username (NIY)
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
    const { username, name, email, password, role, nip, unitId, phone, position } = req.body;
    try {
        const data = {
            username,
            name,
            email: email || null,
            nip: username, // Sync with username (NIY)
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

exports.getProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                name: true,
                email: true,
                phone: true,
                position: true,
                role: true,
                unitId: true,
                unit: { select: { name: true } }
            }
        });
        if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, email, phone } = req.body;

        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                name,
                email: email || null,
                phone
            },
            select: {
                id: true,
                username: true,
                name: true,
                email: true,
                phone: true,
                position: true,
                role: true,
                unitId: true,
                unit: { select: { name: true } }
            }
        });

        res.json({ message: 'Profil berhasil diperbarui', user });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Email sudah digunakan pengguna lain' });
        }
        res.status(500).json({ error: error.message });
    }
};

exports.getSarprasStaff = async (req, res) => {
    try {
        const staff = await prisma.user.findMany({
            where: {
                OR: [
                    { position: 'Staff Manajemen Aset' },
                    { position: 'Staff Keuangan dan Administrasi (Sarpras)' },
                    { position: 'Staff Gudang dan Logistik' },
                    { position: 'Staff Teknisi Aset' },
                    { position: 'Staff Kendaraan' }
                ]
            },
            select: { id: true, name: true, username: true, position: true }
        });
        res.json(staff);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
