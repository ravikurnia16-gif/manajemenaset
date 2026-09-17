const express = require('express');
const router = express.Router();
const procurementController = require('../controllers/procurementController');
const { verifyToken, authorizeRole } = require('../middleware/authMiddleware');

const { handleUpload } = require('../middleware/uploadMiddleware');

// Public Approval Routes (No Token Required)
router.get('/public/head-unit-approval/:batchId', procurementController.getHeadUnitApprovalData);
router.post('/public/head-unit-approval/:batchId', procurementController.processHeadUnitApproval);
router.get('/public/assignment-orders/:orderId', procurementController.getPublicAssignmentOrder);
router.post('/public/assignment-orders/:orderId/sign', procurementController.signPublicAssignmentOrder);

router.get('/', verifyToken, procurementController.getAllProcurements);
router.get('/dashboard', verifyToken, procurementController.getDashboardStats);
router.get('/unit-letter-number', verifyToken, procurementController.getUnitLetterNumber);
router.get('/:id', verifyToken, procurementController.getProcurementById);
router.post('/', verifyToken, procurementController.createProcurement);
router.put('/:id/request-letter', verifyToken, procurementController.updateRequestLetter);

// Import
router.post('/import', verifyToken, procurementController.importProcurement);

// Status Workflow (Admin + Assigned users can change status)
router.put('/:id/status', verifyToken, procurementController.updateStatus);

// Item Level Update (Vendor, Brand, Specs - Admin + Assigned users)
router.put('/items/:itemId', verifyToken, procurementController.updateItemDetail);

// Vendor Offer (Legacy/Optional)
router.post('/:id/offers', verifyToken, procurementController.addVendorOffer);

// BAST & Completion (Admin + Assigned users can finalize)
router.post('/:id/bast', verifyToken, handleUpload('bastFile', 'procurement'), procurementController.processBAST);
router.put('/:id/bast-signatures', verifyToken, procurementController.updateBASTSignatures);
router.post('/:id/bast-document', verifyToken, procurementController.getOrCreateBASTDocument);
router.post('/:id/bast-tte', verifyToken, procurementController.signBastKabidTte);
router.delete('/:id/bast-tte', verifyToken, procurementController.cancelBastKabidTte);

// Notify Assignees
router.post('/:id/notify-assignees', verifyToken, procurementController.notifyAssignees);

// Progress Timeline
router.post('/:id/progress', verifyToken, procurementController.addProgress);
router.get('/:id/progress', verifyToken, procurementController.getProgress);

// Surat Perintah Pengadaan (Tahap 2 Assignment Order)
router.get('/:id/assignment-orders', verifyToken, procurementController.getAssignmentOrders);
router.post('/:id/assignment-orders', verifyToken, procurementController.createAssignmentOrder);
router.post('/:id/assignment-orders/sign', verifyToken, procurementController.signAssignmentOrder);
router.post('/:id/assignment-orders/:orderId/notify-print', verifyToken, procurementController.notifyPrintAssignmentOrder);

// Delete
router.delete('/:id', verifyToken, authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), procurementController.deleteProcurement);
router.post('/bulk-delete', verifyToken, authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), procurementController.bulkDeleteProcurements);

module.exports = router;
