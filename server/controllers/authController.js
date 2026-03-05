const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const prisma = new PrismaClient();

exports.register = async (req, res) => {
    const { username, email, password, role, unitId, nip, phone, position } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                username,
                email,
                nip: nip || username,
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

// Helper to generate login response
const generateLoginResponse = async (user, res) => {
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
            details: 'User logged in via hybrid auth'
        }
    });

    return res.json({
        token,
        user: { ...user, password: '' }
    });
};

// Helper to sync user from external API (Option B)
const syncExternalUser = async (niy, externalData, password) => {
    const hashedPassword = await bcrypt.hash(password, 10);

    // Find existing user by NIY/NIP or username
    let user = await prisma.user.findFirst({
        where: {
            OR: [
                { nip: niy },
                { username: niy }
            ]
        },
        include: { unit: true }
    });

    // Mapping logic (Flexible based on common API patterns)
    const name = externalData.nama || externalData.name || externalData.fullName;
    const phone = externalData.hp || externalData.phone || externalData.no_hp;
    const email = externalData.email;
    const position = externalData.jabatan || externalData.position;

    // Unit mapping (Attempt to find unit by name if provided)
    let unitId = null;
    const unitName = externalData.unit || externalData.unit_name;
    if (unitName) {
        const unit = await prisma.unit.findFirst({
            where: { name: { contains: unitName } }
        });
        if (unit) unitId = unit.id;
    }

    if (!user) {
        // Scenario: First time login (Auto-Register)
        user = await prisma.user.create({
            data: {
                username: niy,
                nip: niy,
                name: name,
                phone: phone,
                email: email,
                position: position,
                password: hashedPassword,
                role: 'USER', // Default role for new syncs
                unitId: unitId
            },
            include: { unit: true }
        });
    } else {
        // Scenario: Subsequent login (Option B: Sync profile but keep local Role/Unit)
        user = await prisma.user.update({
            where: { id: user.id },
            data: {
                name: name || user.name,
                phone: phone || user.phone,
                password: hashedPassword, // Keep local password in sync for fallback
                // Note: We don't update role or unitId here to satisfy "Option B"
            },
            include: { unit: true }
        });
    }
    return user;
};

exports.login = async (req, res) => {
    const { username, password } = req.body;

    // 1. Check for Admin Seed (First time only)
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
        console.log('Default user admin created.');
    }

    // 2. Try External Login (SIMAK)
    try {
        const externalUrl = process.env.EXTERNAL_LOGIN_API_URL || 'https://simakpintarapi.dareliman.or.id/api/login-surau';
        const externalRes = await axios.post(externalUrl, { nip: username, password }, { timeout: 8000 });

        // If external API returns success (Usually check for status 200 or a specific success flag)
        if (externalRes.status === 200 && externalRes.data) {
            // Flexible extraction of user data
            const externalData = externalRes.data.user || externalRes.data.data || externalRes.data;
            const user = await syncExternalUser(username, externalData, password);
            return generateLoginResponse(user, res);
        }
    } catch (err) {
        console.log(`External login failed for ${username}: ${err.message}. Falling back to local auth.`);
    }

    // 3. Fallback to Local Login
    try {
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

        return generateLoginResponse(user, res);
    } catch (error) {
        console.error('Local Login error:', error);
        res.status(500).json({ error: 'Gagal melakukan login. Silakan coba lagi.' });
    }
};

exports.changePassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body;
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
        res.status(500).json({ error: error.message });
    }
};
