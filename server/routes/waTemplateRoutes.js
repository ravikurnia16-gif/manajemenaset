const express = require('express');
const router = express.Router();
const {
    getAllTemplates,
    getTemplateBySlug,
    updateTemplate,
    seedTemplates,
    resetTemplate
} = require('../controllers/waTemplateController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/debug', async (req, res) => {
    try {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        const templates = await prisma.waNotificationTemplate.findMany();
        res.json({ message: 'Debug info', count: templates.length, templates });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// All routes are protected
router.get('/', verifyToken, getAllTemplates);
router.get('/:slug', verifyToken, getTemplateBySlug);
router.put('/:id', verifyToken, updateTemplate);
router.post('/seed', verifyToken, seedTemplates);
router.post('/reset/:slug', verifyToken, resetTemplate);

module.exports = router;
