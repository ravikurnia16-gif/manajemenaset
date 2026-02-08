const express = require('express');
const router = express.Router();
const rkbController = require('../controllers/rkbController');
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, rkbController.getAllRKBs);
router.get('/:id', authenticateToken, rkbController.getRKBById);
router.post('/', authenticateToken, authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET', 'ADMIN_UNIT']), rkbController.createRKB);
router.post('/:id/items', authenticateToken, authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET', 'ADMIN_UNIT']), rkbController.addItem);
router.put('/:id/status', authenticateToken, authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), rkbController.updateStatus);

module.exports = router;
