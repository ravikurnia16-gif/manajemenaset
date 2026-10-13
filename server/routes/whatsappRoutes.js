const express = require('express');
const router = express.Router();
const { 
    getWhatsAppStatus, 
    logoutWhatsApp, 
    reinitializeWhatsApp,
    flushOutboxBasket,
    getOutboxMessages,
    getOutboxStats,
    deleteOutboxMessage,
    clearOutbox
} = require('../services/whatsappService');
const { verifyToken } = require('../middleware/authMiddleware');

const { getRules, createRule, updateRule, deleteRule } = require('../controllers/whatsappRuleController');

// Custom middleware to check position
const authorizeKabidSarpras = (req, res, next) => {
    const pos = (req.user.position || '').toLowerCase();
    
    if (!pos.includes('kepala bidang sarana')) {
        return res.status(403).json({ error: 'Akses ditolak. Khusus Kepala Bidang Sarana.' });
    }
    next();
};

// --- OUTBOX / KERANJANG PESAN TERTUNDA ---
router.get('/outbox', verifyToken, authorizeKabidSarpras, (req, res) => {
    try {
        const stats = getOutboxStats();
        const limit = parseInt(req.query.limit) || 100;
        const messages = getOutboxMessages(limit);
        res.json({ stats, messages });
    } catch (error) {
        console.error('[WA Route] Get outbox error:', error);
        res.status(500).json({ error: 'Gagal mengambil data keranjang outbox' });
    }
});

router.post('/outbox/flush', verifyToken, authorizeKabidSarpras, async (req, res) => {
    try {
        const result = await flushOutboxBasket();
        res.json(result);
    } catch (error) {
        console.error('[WA Route] Flush outbox error:', error);
        res.status(500).json({ error: error.message || 'Gagal mengirim ulang pesan keranjang' });
    }
});

router.delete('/outbox/:id', verifyToken, authorizeKabidSarpras, (req, res) => {
    try {
        const success = deleteOutboxMessage(req.params.id);
        res.json({ success });
    } catch (error) {
        console.error('[WA Route] Delete outbox item error:', error);
        res.status(500).json({ error: 'Gagal menghapus pesan dari keranjang' });
    }
});

router.delete('/outbox', verifyToken, authorizeKabidSarpras, (req, res) => {
    try {
        const filter = req.query.filter || 'ALL';
        const success = clearOutbox(filter);
        res.json({ success });
    } catch (error) {
        console.error('[WA Route] Clear outbox error:', error);
        res.status(500).json({ error: 'Gagal membersihkan keranjang outbox' });
    }
});


// ... existing routes ...
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

// Notification Rule Engine Routes
router.get('/rules', verifyToken, authorizeKabidSarpras, getRules);
router.post('/rules', verifyToken, authorizeKabidSarpras, createRule);
router.put('/rules/:id', verifyToken, authorizeKabidSarpras, updateRule);
router.delete('/rules/:id', verifyToken, authorizeKabidSarpras, deleteRule);

module.exports = router;
