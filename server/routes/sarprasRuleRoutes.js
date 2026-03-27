const express = require('express');
const router = express.Router();
const sarprasRuleController = require('../controllers/sarprasRuleController');
const { verifyToken, authorizeRole } = require('../middleware/authMiddleware');
const { handleUpload } = require('../middleware/uploadMiddleware');

router.get('/', verifyToken, sarprasRuleController.getAllRules);
router.post('/', verifyToken, authorizeRole(['SUPER_ADMIN']), handleUpload('file'), sarprasRuleController.createRule);
router.delete('/:id', verifyToken, authorizeRole(['SUPER_ADMIN']), sarprasRuleController.deleteRule);

module.exports = router;
