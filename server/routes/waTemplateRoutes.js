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

// Temporary public auto-seed endpoint (visit in browser to seed)
router.get('/auto-seed', async (req, res) => {
    try {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        const { DEFAULT_TEMPLATES } = require('../controllers/waTemplateController');
        let created = 0;
        for (const tpl of DEFAULT_TEMPLATES) {
            const exists = await prisma.waNotificationTemplate.findUnique({ where: { slug: tpl.slug } });
            if (!exists) {
                await prisma.waNotificationTemplate.create({ data: tpl });
                created++;
            }
        }
        await prisma.$disconnect();
        res.json({ message: `${created} template baru berhasil ditambahkan dari total ${DEFAULT_TEMPLATES.length}.`, created, total: DEFAULT_TEMPLATES.length });
    } catch (e) {
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
