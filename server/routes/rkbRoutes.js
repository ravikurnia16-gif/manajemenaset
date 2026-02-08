const express = require('express');
const router = express.Router();
const rkbController = require('../controllers/rkbController');
const { verifyToken, authorizeRole } = require('../middleware/authMiddleware');

router.get('/', verifyToken, rkbController.getAllRKBs);
router.get('/:id', verifyToken, rkbController.getRKBById);
router.post('/', verifyToken, authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET', 'ADMIN_UNIT']), rkbController.createRKB);
router.post('/:id/items', verifyToken, authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET', 'ADMIN_UNIT']), rkbController.addItem);
router.put('/:id/status', verifyToken, authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), rkbController.updateStatus);

module.exports = router;
