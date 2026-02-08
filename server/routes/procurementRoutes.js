const express = require('express');
const router = express.Router();
const procurementController = require('../controllers/procurementController');
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, procurementController.getAllProcurements);
router.get('/:id', authenticateToken, procurementController.getProcurementById);
router.post('/', authenticateToken, procurementController.createProcurement);

// Status Workflow
router.put('/:id/status', authenticateToken, authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), procurementController.updateStatus);

// Vendor Offer
router.post('/:id/offers', authenticateToken, authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), procurementController.addVendorOffer);

// BAST & Completion
router.post('/:id/bast', authenticateToken, authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), procurementController.processBAST);

module.exports = router;
