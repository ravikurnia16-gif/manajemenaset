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

// All routes are protected
router.get('/', verifyToken, getAllTemplates);
router.get('/:slug', verifyToken, getTemplateBySlug);
router.put('/:id', verifyToken, updateTemplate);
router.post('/seed', verifyToken, seedTemplates);
router.post('/reset/:slug', verifyToken, resetTemplate);

module.exports = router;
