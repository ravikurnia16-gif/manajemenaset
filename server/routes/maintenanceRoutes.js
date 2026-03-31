const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenanceController');
const { verifyToken, authorizeRole } = require('../middleware/authMiddleware');
const { handleUpload } = require('../middleware/uploadMiddleware');

router.get('/', verifyToken, maintenanceController.getAllReports);
router.get('/:id', verifyToken, maintenanceController.getReportById);
router.post('/', verifyToken, handleUpload('photo', 'maintenance'), maintenanceController.createReport);
router.put('/:id/status', verifyToken, maintenanceController.updateStatus);
router.put('/quick-complete/:token', maintenanceController.quickComplete);
router.delete('/:id', verifyToken, authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET', 'KEPALA_BIDANG']), maintenanceController.deleteReport);

module.exports = router;
