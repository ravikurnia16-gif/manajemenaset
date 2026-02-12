const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/', verifyToken, vehicleController.getAllVehicles);
router.get('/:id', verifyToken, vehicleController.getVehicleById);
router.post('/', verifyToken, vehicleController.createVehicle);
router.put('/:id', verifyToken, vehicleController.updateVehicle);
router.delete('/:id', verifyToken, vehicleController.deleteVehicle);

// Maintenance Routes
const maintenanceCtrl = require('../controllers/vehicleMaintenanceController');
router.get('/maintenance/all', verifyToken, maintenanceCtrl.getAllMaintenanceLogs);
router.post('/maintenance', verifyToken, maintenanceCtrl.createMaintenanceLog);
router.put('/maintenance/:id', verifyToken, maintenanceCtrl.updateMaintenanceLog);
router.delete('/maintenance/:id', verifyToken, maintenanceCtrl.deleteMaintenanceLog);

module.exports = router;
