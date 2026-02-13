const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

exports.register = async (req, res) => {
    const { username, email, password, role, unitId, nip, phone, position } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                username,
                email,
                nip: username, // Sync with username (NIY)
                phone,
                position,
                password: hashedPassword,
                role: role || 'USER',
                unitId: unitId ? parseInt(unitId) : null,
            },
        });
        res.json({ message: 'User registered', user: { id: user.id, username: user.username, role: user.role } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.login = async (req, res) => {
    const { username, password } = req.body;
    try {
        // Cek apakah ada user sama sekali (untuk auto-seed pertama kali)
        const userCount = await prisma.user.count();
        if (userCount === 0) {
            const hashedPassword = await bcrypt.hash('admin', 10);
            await prisma.user.create({
                data: {
                    username: 'admin',
                    password: hashedPassword,
                    role: 'SUPER_ADMIN'
                }
            });
            console.log('Default user admin:admin created.');
        }

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { username: username },
                    { email: username },
                    { nip: username }
                ]
            },
            include: { unit: true }
        });

        if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Password salah' });

        const token = jwt.sign(
            { id: user.id, role: user.role, unitId: user.unitId },
            process.env.JWT_SECRET || 'secret_fallback',
            { expiresIn: '1d' }
        );

        // Update log login
        await prisma.log.create({
            data: {
                userId: user.id,
                action: 'LOGIN',
                details: 'User logged in'
            }
        });

        res.json({
            token,
            user: { ...user, password: '' }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Gagal menghubungi database. Pastikan DATABASE_URL benar.' });
    }
};

exports.changePassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    // req.user from authMiddleware
    const userId = req.user.id;

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

        const validPassword = await bcrypt.compare(oldPassword, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Password lama salah' });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword }
        });

        res.json({ message: 'Password berhasil diubah' });
    } catch (error) {
        console.error('Change Password error:', error);
        res.status(500).json({ error: error.message });
    }
};
