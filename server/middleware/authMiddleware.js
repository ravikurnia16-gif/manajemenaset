const jwt = require('jsonwebtoken');

exports.verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];
    
    // Fallback to query parameter (useful for opening PDFs in new tabs)
    if (!token && req.query.token) {
        token = req.query.token;
    }

    if (!token) return res.status(401).json({ error: 'Access denied' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};

exports.authorizeRole = (roles) => {
    return (req, res, next) => {
        // Automatically include BIDANG_IT if SUPER_ADMIN is allowed
        let allowedRoles = [...roles];
        if (roles.includes('SUPER_ADMIN') && !allowedRoles.includes('BIDANG_IT')) {
            allowedRoles.push('BIDANG_IT');
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        next();
    };
};
