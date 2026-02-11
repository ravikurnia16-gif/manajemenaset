const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenanceController');
const { verifyToken, authorizeRole } = require('../middleware/authMiddleware');

router.get('/', verifyToken, maintenanceController.getAllReports);
router.get('/:id', verifyToken, maintenanceController.getReportById);
router.post('/', verifyToken, maintenanceController.createReport);
router.put('/:id/status', verifyToken, maintenanceController.updateStatus);
router.delete('/:id', verifyToken, authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), maintenanceController.deleteReport);

module.exports = router;
