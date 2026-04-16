const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenanceController');
const { verifyToken, authorizeRole } = require('../middleware/authMiddleware');
const { handleUpload, handleBulkUpload } = require('../middleware/uploadMiddleware');

router.get('/', verifyToken, maintenanceController.getAllReports);
router.get('/:id', verifyToken, maintenanceController.getReportById);
router.post('/', verifyToken, handleBulkUpload('media', 10, 'maintenance'), maintenanceController.createReport);
router.post('/:id/media', verifyToken, handleBulkUpload('media', 5, 'maintenance'), maintenanceController.addMedia);
router.put('/:id/status', verifyToken, maintenanceController.updateStatus);
router.put('/quick-complete/:token', maintenanceController.quickComplete);
router.delete('/:id', verifyToken, authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET', 'KEPALA_BIDANG']), maintenanceController.deleteReport);

module.exports = router;
