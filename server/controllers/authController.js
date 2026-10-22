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
        { id: user.id, role: user.role, unitId: user.unitId, position: user.position, name: user.name },
        process.env.JWT_SECRET || 'secret_fallback',
        { expiresIn: '365d' }
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
    const phone = externalData.hp || externalData.phone || externalData.no_hp || externalData.noHp;
    const rawEmail = externalData.email;
    const position = externalData.jabatan || externalData.position;

    // Normalize and validate email to avoid unique constraint crashes (e.g., empty string or duplicate)
    let validEmail = (typeof rawEmail === 'string' && rawEmail.trim() !== '') ? rawEmail.trim().toLowerCase() : null;
    if (validEmail) {
        const existingEmailUser = await prisma.user.findFirst({
            where: {
                email: validEmail,
                ...(user ? { NOT: { id: user.id } } : {})
            }
        });
        if (existingEmailUser) {
            console.warn(`[SIMAK Sync] Email '${validEmail}' sudah digunakan oleh user '${existingEmailUser.username}' (id: ${existingEmailUser.id}). Melewati sinkronisasi email untuk ${niy}.`);
            validEmail = user ? user.email : null;
        }
    } else {
        validEmail = user ? user.email : null;
    }

    // Unit mapping (Attempt to find unit by name if provided)
    let unitId = null;
    let unitName = externalData.unit || externalData.unit_name;

    // Normalize unit name if mapping exists (Based on Screenshots)
    const unitMap = {
        'Unit TKIT-1': 'TKIT 1 Dar el-Iman',
        'Unit TKIT-2': 'TKIT 2 Dar el-Iman',
        'Unit TKIT-3': 'TKIT 3 Dar el-Iman',
        'Unit MIT': 'MIT SAQU Dar el-Iman',
        'Unit SDIT-1': 'SDIT 1 Dar el-Iman',
        'Unit SDIT-2': 'SDIT 2 Dar el-Iman',
        'Unit SDIT-3': 'SDIT 3 Dar el-Iman',
        'Unit SMPIT': 'SMP IT Dar el-Iman Padang',
        'Unit SMAIT': 'SMA IT Dar el-Iman',
        'Bidang SDM': 'Kantor Yayasan - Bidang SDM',
        'Bidang Keuangan': 'Kantor Yayasan - Bidang Keuangan',
        'Bidang Pembangunan': 'Kantor Yayasan - Bidang Pembangunan',
        'Deiped': 'Dar el-Iman Peduli',
        'Unit Taud-Saqu': 'TAUD SaQu Dar el-Iman',
        'Unit Pondok Pesantren Putra': 'Pondok Pesantren Putra Dar el-Iman',
        'Yayasan': 'Kantor Yayasan',
        'Unit Pondok Pesantren Putri': 'Pondok Pesantren Putri Dar el-Iman',
        'Divisi Pendidikan': 'Kantor Yayasan',
        'SMPIT 50 Kota': 'SMP IT Dar el Iman 50 Kota',
        'K3': 'Kantor Yayasan - K3',
        'Bidang IT': 'Kantor Yayasan - Bidang IT',
        'Bidang Sarana': 'Kantor Yayasan - Bidang Sarana',
    };

    if (unitName) {
        if (unitMap[unitName]) {
            unitName = unitMap[unitName];
        } else if (unitMap[`Unit ${unitName}`]) {
            unitName = unitMap[`Unit ${unitName}`];
        } else {
            // Remove "Unit " prefix if it exists but no mapping found
            unitName = unitName.replace(/^Unit\s+/i, '').replace(/-/g, ' ');
        }
    }

    if (unitName) {
        const unit = await prisma.unit.findFirst({
            where: { name: { contains: unitName } }
        });
        if (unit) unitId = unit.id;
    }

    if (!unitId) {
        const yayasanUnit = await prisma.unit.findFirst({
            where: { name: { contains: 'Kantor Yayasan' } }
        });
        if (yayasanUnit) unitId = yayasanUnit.id;
    }

    if (!user) {
        // Scenario: First time login (Auto-Register)
        const createData = {
            username: niy,
            nip: niy,
            name: name,
            phone: phone,
            email: validEmail,
            position: position,
            password: hashedPassword,
            role: 'USER', // Default role for new syncs
            unitId: unitId
        };
        try {
            user = await prisma.user.create({
                data: createData,
                include: { unit: true }
            });
        } catch (createErr) {
            if (createErr.code === 'P2002' && (createErr.meta?.target?.includes('email') || createErr.message?.includes('User_email_key'))) {
                console.warn(`[SIMAK Sync] Duplicate email collision saat pendaftaran ${niy}, mendaftar tanpa email.`);
                createData.email = null;
                user = await prisma.user.create({
                    data: createData,
                    include: { unit: true }
                });
            } else {
                throw createErr;
            }
        }
    } else {
        // Scenario: Subsequent login (Option B: Sync profile)
        const updateData = {
            name: name || user.name,
            phone: phone || user.phone,
            password: hashedPassword, // Keep local password in sync for fallback
        };

        if (validEmail && validEmail !== user.email) {
            updateData.email = validEmail;
        }

        // NEW: Auto-sync unit ONLY for 'USER' role & Semesterly (26 Jan & 26 Jun)
        if (user.role === 'USER' && unitId && user.unitId !== unitId) {
            const now = new Date();
            const year = now.getFullYear();

            // Define Rotation Candidates
            const jan26 = new Date(year, 0, 26); // January 26
            const jun26 = new Date(year, 5, 26); // June 26
            const lastYearJun26 = new Date(year - 1, 5, 26);

            // Find Most Recent Rotation Start Date (MRSD)
            let mrsd;
            if (now >= jun26) {
                mrsd = jun26;
            } else if (now >= jan26) {
                mrsd = jan26;
            } else {
                mrsd = lastYearJun26;
            }

            // Check if already synced in this semester rotation
            const lastSync = await prisma.log.findFirst({
                where: {
                    userId: user.id,
                    action: 'SYNC',
                    timestamp: { gte: mrsd }
                }
            });

            if (!lastSync) {
                console.log(`[SIMAK Sync] User ${user.username} unit changed from ${user.unitId} to ${unitId} (MRSD: ${mrsd.toLocaleDateString()})`);
                updateData.unitId = unitId;

                // Log the change
                await prisma.log.create({
                    data: {
                        userId: user.id,
                        action: 'SYNC',
                        details: `Unit otomatis diperbarui dari SIMAK (Jan/Jun Rotation - Unit ID: ${user.unitId} -> ${unitId})`
                    }
                });
            } else {
                console.log(`[SIMAK Sync] Skip update for ${user.username}. Already synced in this semester rotation.`);
            }
        }

        try {
            user = await prisma.user.update({
                where: { id: user.id },
                data: updateData,
                include: { unit: true }
            });
        } catch (updateErr) {
            if (updateErr.code === 'P2002' && (updateErr.meta?.target?.includes('email') || updateErr.message?.includes('User_email_key'))) {
                console.warn(`[SIMAK Sync] Email constraint error saat update ${user.username}, retrying tanpa update email.`);
                delete updateData.email;
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: updateData,
                    include: { unit: true }
                });
            } else {
                throw updateErr;
            }
        }
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
        if ((externalRes.status === 200 || externalRes.status === 201) && externalRes.data) {
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

// DEV ONLY: Mendapatkan pilihan role & akun untuk kemudahan testing di localhost
exports.getDevRoles = async (req, res) => {
    try {
        let users = [];
        try {
            users = await prisma.user.findMany({
                where: {
                    OR: [
                        { role: 'KABID_SARPRAS' },
                        { role: 'SUPER_ADMIN' },
                        { role: 'ADMIN_ASET' },
                        { role: 'ADMIN_UNIT' },
                        { position: { contains: 'Sarana' } },
                        { position: { contains: 'Teknisi' } },
                        { position: { contains: 'Gudang' } }
                    ]
                },
                select: {
                    id: true,
                    username: true,
                    name: true,
                    role: true,
                    position: true,
                    nip: true,
                    unitId: true,
                    unit: { select: { id: true, name: true } }
                },
                orderBy: { id: 'asc' },
                take: 30
            });
        } catch (dbErr) {
            console.warn('[getDevRoles] DB lookup failed, will return default presets:', dbErr.message);
        }

        const presets = [
            {
                key: 'KABID',
                label: 'Kepala Bidang Sarana',
                role: 'KABID_SARPRAS',
                position: 'Kepala Bidang Sarana',
                defaultName: 'Ravi Kurnia (Kabid Sarana)',
                icon: '👑',
                color: 'violet',
                description: 'Approval, Penugasan, Rencana Kerja, Review PPP'
            },
            {
                key: 'TEKNISI',
                label: 'Staff Teknisi Lapangan',
                role: 'USER',
                position: 'Staff Teknisi',
                defaultName: 'Staff Teknisi (Listrik/AC)',
                icon: '🛠️',
                color: 'amber',
                description: 'Laporan Harian (PPP), Service AC & Listrik, Pengerjaan SPK'
            },
            {
                key: 'ADMIN_ASET',
                label: 'Staff Aset / Admin Aset',
                role: 'ADMIN_ASET',
                position: 'Staff Manajemen Aset',
                defaultName: 'Admin Sarana & Aset',
                icon: '📦',
                color: 'blue',
                description: 'Inventaris Aset, Mutasi, Penghapusan & Logistik'
            },
            {
                key: 'SUPER_ADMIN',
                label: 'Super Admin (IT)',
                role: 'SUPER_ADMIN',
                position: 'Kepala Bidang IT',
                defaultName: 'Super Administrator',
                icon: '⚡',
                color: 'rose',
                description: 'Akses Penuh Semua Modul, User & Pengaturan Sistem'
            },
            {
                key: 'ADMIN_UNIT',
                label: 'Admin Unit (Sekolah/Unit)',
                role: 'ADMIN_UNIT',
                position: 'Tata Usaha Unit',
                defaultName: 'Admin Unit Pemohon',
                icon: '🏫',
                color: 'emerald',
                description: 'Pengadaan Unit, Pinjam Aset, Permohonan Service'
            },
            {
                key: 'GUDANG',
                label: 'Staff Gudang & Logistik',
                role: 'USER',
                position: 'Staff Gudang dan Logistik',
                defaultName: 'Staff Gudang & Seragam',
                icon: '🏪',
                color: 'cyan',
                description: 'Stok Barang, Seragam, Penerimaan Barang'
            }
        ];

        // Enrich presets with matched users from DB
        const enrichedPresets = presets.map(p => {
            const matchedUser = users.find(u => {
                if (p.key === 'KABID') {
                    return u.role === 'KABID_SARPRAS' || (u.position || '').toLowerCase().includes('kepala bidang sarana');
                }
                if (p.key === 'TEKNISI') {
                    return (u.position || '').toLowerCase().includes('teknisi');
                }
                if (p.key === 'ADMIN_ASET') {
                    return u.role === 'ADMIN_ASET' || (u.position || '').toLowerCase().includes('manajemen aset');
                }
                if (p.key === 'SUPER_ADMIN') {
                    return u.role === 'SUPER_ADMIN';
                }
                if (p.key === 'ADMIN_UNIT') {
                    return u.role === 'ADMIN_UNIT';
                }
                if (p.key === 'GUDANG') {
                    return (u.position || '').toLowerCase().includes('gudang');
                }
                return false;
            });

            return {
                ...p,
                matchedUser: matchedUser || null
            };
        });

        res.json({
            success: true,
            presets: enrichedPresets,
            allUsers: users
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// DEV ONLY: Login instan untuk pengujian di localhost tanpa memerlukan password
exports.devLogin = async (req, res) => {
    try {
        const { userId, role, position, name, username } = req.body;
        let user = null;

        if (userId) {
            try {
                user = await prisma.user.findUnique({
                    where: { id: parseInt(userId, 10) },
                    include: { unit: true }
                });
            } catch (e) {
                console.warn('[devLogin] User lookup by ID failed:', e.message);
            }
        }

        if (!user && (role || position)) {
            try {
                user = await prisma.user.findFirst({
                    where: {
                        OR: [
                            ...(role ? [{ role: role }] : []),
                            ...(position ? [{ position: { contains: position } }] : [])
                        ]
                    },
                    include: { unit: true }
                });
            } catch (e) {
                console.warn('[devLogin] User lookup by role/pos failed:', e.message);
            }
        }

        // Fallback dummy user if not found in db or db offline
        if (!user) {
            user = {
                id: userId ? parseInt(userId, 10) : 999,
                username: username || (name || role || 'dev_user').toLowerCase().replace(/[^a-z0-9]/g, '_'),
                name: name || `Dev ${role || 'User'}`,
                role: role || 'SUPER_ADMIN',
                position: position || 'Developer Test',
                unitId: 1,
                unit: { id: 1, name: 'Unit Pengembangan Dev' }
            };
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, unitId: user.unitId, position: user.position, name: user.name },
            process.env.JWT_SECRET || 'secret_fallback',
            { expiresIn: '365d' }
        );

        return res.json({
            success: true,
            token,
            user: { ...user, password: '' }
        });
    } catch (error) {
        console.error('Dev login error:', error);
        res.status(500).json({ error: error.message });
    }
};

