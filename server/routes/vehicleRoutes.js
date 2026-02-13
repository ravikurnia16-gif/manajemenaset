const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/', verifyToken, vehicleController.getAllVehicles);
router.get('/:id', verifyToken, vehicleController.getVehicleById);
router.post('/', verifyToken, vehicleController.createVehicle);
router.put('/:id', verifyToken, vehicleController.updateVehicle);
router.delete('/:id', verifyToken, vehicleController.deleteVehicle);

// Test Routes (Tanpa Token untuk kemudahan testing di browser)
router.get('/test/pajak', vehicleController.triggerTaxCheck);
router.get('/test/wa', vehicleController.sendTestWA);
router.get('/test/wa-pure', vehicleController.sendPureTestWA);

// Maintenance Routes
const maintenanceCtrl = require('../controllers/vehicleMaintenanceController');
router.get('/maintenance/all', verifyToken, maintenanceCtrl.getAllMaintenanceLogs);
router.post('/maintenance', verifyToken, maintenanceCtrl.createMaintenanceLog);
router.put('/maintenance/:id', verifyToken, maintenanceCtrl.updateMaintenanceLog);
router.delete('/maintenance/:id', verifyToken, maintenanceCtrl.deleteMaintenanceLog);

// Weekly Report Routes
const reportCtrl = require('../controllers/vehicleReportController');
router.post('/reports/weekly', verifyToken, reportCtrl.createWeeklyReport);
router.get('/:id/reports/weekly', verifyToken, reportCtrl.getVehicleReports);

module.exports = router;
