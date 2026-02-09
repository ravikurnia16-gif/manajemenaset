const express = require('express');
const router = express.Router();
const procurementController = require('../controllers/procurementController');
const { verifyToken, authorizeRole } = require('../middleware/authMiddleware');

router.get('/', verifyToken, procurementController.getAllProcurements);
router.get('/:id', verifyToken, procurementController.getProcurementById);
router.post('/', verifyToken, procurementController.createProcurement);

// Import
router.post('/import', verifyToken, procurementController.importProcurement);

// Status Workflow
router.put('/:id/status', verifyToken, authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), procurementController.updateStatus);

// Vendor Offer
router.post('/:id/offers', verifyToken, authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), procurementController.addVendorOffer);

// BAST & Completion
router.post('/:id/bast', verifyToken, authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), procurementController.processBAST);

module.exports = router;
