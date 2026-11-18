const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { verifyToken, authorizeRole } = require('../middleware/authMiddleware');
const { handleUpload } = require('../middleware/uploadMiddleware');

// Restrict all audit routes to Super Admin and Admin Aset
router.use(verifyToken);
router.use(authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT']));

router.get('/', auditController.getAllSessions);
router.post('/', auditController.createSession);
router.get('/:id', auditController.getSessionById);
router.post('/upload-photo', handleUpload('photo', 'audit'), auditController.uploadPhoto);
router.post('/verify', auditController.verifyItem);
router.post('/bulk-verify', auditController.bulkVerify);
router.post('/approve-item', auditController.approveItem);
router.post('/bulk-approve-reconcile', auditController.bulkApproveReconcile);
router.post('/:id/unexpected', auditController.addUnexpectedItem);
router.post('/:id/finalize', auditController.finalizeSession);
router.delete('/:id', auditController.deleteSession);

module.exports = router;

