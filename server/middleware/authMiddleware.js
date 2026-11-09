const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

exports.verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];

    // Fallback to query parameter (useful for opening PDFs in new tabs)
    if (!token && req.query.token) {
        token = req.query.token;
    }

    if (!token) return res.status(401).json({ error: 'Access denied' });

    jwt.verify(token, process.env.JWT_SECRET || 'secret_fallback', async (err, decoded) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });

        try {
            // Selalu ambil data live dari database agar perubahan Role, Unit, dan Posisi langsung berlaku
            const liveUser = await prisma.user.findUnique({
                where: { id: decoded.id },
                select: {
                    id: true,
                    role: true,
                    unitId: true,
                    unit: { select: { id: true, name: true, code: true } },
                    position: true,
                    name: true,
                    username: true,
                    isSanctioned: true
                }
            });

            if (!liveUser) {
                return res.status(401).json({ error: 'Akun tidak ditemukan atau telah dinonaktifkan' });
            }

            req.user = {
                ...decoded,
                ...liveUser
            };
            next();
        } catch (dbErr) {
            console.error('Error fetching live user in verifyToken:', dbErr);
            // Fallback ke decoded token jika ada gangguan sementara koneksi DB
            req.user = decoded;
            next();
        }
    });
};

exports.authorizeRole = (roles) => {
    return (req, res, next) => {
        // Automatically include BIDANG_IT if SUPER_ADMIN is allowed
        let allowedRoles = [...roles];
        if (roles.includes('SUPER_ADMIN') && !allowedRoles.includes('BIDANG_IT')) {
            allowedRoles.push('BIDANG_IT');
        }

        // Global read-only access for Auditor
        if (req.user.role === 'AUDITOR' && req.method === 'GET') {
            return next();
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        next();
    };
};

exports.authorizeSarprasAdmin = () => {
    return (req, res, next) => {
        if (req.user.role === 'AUDITOR' && req.method === 'GET') return next();

        const role = req.user.role;
        const pos = req.user.position || '';

        const isAdmin = ['SUPER_ADMIN', 'KABID_SARPRAS', 'KEPALA_BIDANG'].includes(role);
        const isRelevantStaff = pos.includes('Sarpras') || pos.includes('Keuangan') || pos.includes('Administrasi');

        if (!isAdmin && !isRelevantStaff) {
            return res.status(403).json({ error: 'Forbidden: Khusus Staff Administrasi Sarpras' });
        }
        next();
    };
};

exports.authorizeEOfficeAccess = () => {
    return (req, res, next) => {
        if (req.user.role === 'AUDITOR' && req.method === 'GET') return next();

        const role = req.user.role;

        // Super Admin, IT, Admin Aset, and Kabids can access E-Office
        const isAllowed = ['SUPER_ADMIN', 'BIDANG_IT', 'ADMIN_ASET', 'KABID_SARPRAS', 'KEPALA_BIDANG'].includes(role);

        if (!isAllowed) {
            return res.status(403).json({ error: 'Akses E-Office terbatas hanya untuk Super Admin dan Admin Aset' });
        }
        next();
    };
};

exports.authorizePembangunanAccess = () => {
    return (req, res, next) => {
        if (req.user.role === 'AUDITOR' && req.method === 'GET') return next();

        const role = req.user.role;
        const pos = req.user.position || '';

        const isAllowedRole = ['SUPER_ADMIN', 'BIDANG_IT', 'ADMIN_ASET', 'KEPALA_BIDANG'].includes(role);
        const isPembangunanTeam = ['Kepala Bidang Pembangunan', 'Staff Pembangunan'].includes(pos);

        if (!isAllowedRole && !isPembangunanTeam) {
            return res.status(403).json({ error: 'Forbidden: Khusus Staff/Kepala Bidang Pembangunan' });
        }
        next();
    };
};

exports.optionalVerifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];
    if (!token && req.query.token) {
        token = req.query.token;
    }
    if (!token) return next();

    jwt.verify(token, process.env.JWT_SECRET || 'secret_fallback', async (err, decoded) => {
        if (!err && decoded) {
            try {
                const liveUser = await prisma.user.findUnique({
                    where: { id: decoded.id },
                    select: {
                        id: true,
                        role: true,
                        unitId: true,
                        unit: { select: { id: true, name: true, code: true } },
                        position: true,
                        name: true,
                        username: true,
                        isSanctioned: true
                    }
                });
                req.user = liveUser ? { ...decoded, ...liveUser } : decoded;
            } catch (dbErr) {
                req.user = decoded;
            }
        }
        next();
    });
};
