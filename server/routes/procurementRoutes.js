const express = require('express');
const router = express.Router();
const procurementController = require('../controllers/procurementController');
const { verifyToken, authorizeRole } = require('../middleware/authMiddleware');

router.get('/', verifyToken, procurementController.getAllProcurements);
router.get('/:id', verifyToken, procurementController.getProcurementById);
router.post('/', verifyToken, procurementController.createProcurement);

// Import
router.post('/import', verifyToken, procurementController.importProcurement);

// Status Workflow (Admin + Assigned users can change status)
router.put('/:id/status', verifyToken, procurementController.updateStatus);

// Item Level Update (Vendor, Brand, Specs - Admin + Assigned users)
router.put('/items/:itemId', verifyToken, procurementController.updateItemDetail);

// Vendor Offer (Legacy/Optional)
router.post('/:id/offers', verifyToken, procurementController.addVendorOffer);

// BAST & Completion (Admin + Assigned users can finalize)
router.post('/:id/bast', verifyToken, procurementController.processBAST);

// Delete
router.delete('/:id', verifyToken, authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), procurementController.deleteProcurement);
router.post('/bulk-delete', verifyToken, authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), procurementController.bulkDeleteProcurements);

module.exports = router;
