const express = require('express');
const router = express.Router();
const { getWhatsAppStatus, logoutWhatsApp, reinitializeWhatsApp } = require('../services/whatsappService');
const { verifyToken } = require('../middleware/authMiddleware');

// Custom middleware to check position
const authorizeKabidSarpras = (req, res, next) => {
    if (req.user.position !== 'Kepala Bidang Sarana') {
        return res.status(403).json({ error: 'Akses ditolak. Khusus Kepala Bidang Sarana.' });
    }
    next();
};

router.get('/status', verifyToken, authorizeKabidSarpras, (req, res) => {
    const status = getWhatsAppStatus();
    res.json(status);
});

router.post('/logout', verifyToken, authorizeKabidSarpras, async (req, res) => {
    try {
        const result = await logoutWhatsApp();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Gagal logout' });
    }
});

router.post('/init', verifyToken, authorizeKabidSarpras, (req, res) => {
    const result = reinitializeWhatsApp();
    res.json(result);
});

router.get('/groups', verifyToken, authorizeKabidSarpras, async (req, res) => {
    try {
        const { getWhatsAppGroups } = require('../services/whatsappService');
        const groups = await getWhatsAppGroups();
        res.json(groups);
    } catch (error) {
        res.status(500).json({ error: 'Gagal mengambil daftar grup' });
    }
});

module.exports = router;
