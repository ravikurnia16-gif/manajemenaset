const express = require('express');
const router = express.Router();
const disposalController = require('../controllers/disposalController');
const { verifyToken, authorizeRole } = require('../middleware/authMiddleware');

router.get('/', verifyToken, disposalController.getAllDisposals);
router.get('/:id', verifyToken, disposalController.getDisposalDetail);
router.post('/', verifyToken, authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), disposalController.createDisposal);

module.exports = router;
