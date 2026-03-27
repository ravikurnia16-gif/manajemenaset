const express = require('express');
const router = express.Router();
const inspectionCtrl = require('../controllers/vehicleInspectionController');
const { verifyToken } = require('../middleware/authMiddleware');
const { handleMultipleUploads } = require('../middleware/uploadMiddleware');

// Protected Routes
router.get('/vehicle/:id', verifyToken, inspectionCtrl.getVehicleInspections);
router.get('/:id', verifyToken, inspectionCtrl.getInspectionById);
router.post('/', 
    verifyToken, 
    handleMultipleUploads(['frontPhoto', 'rightPhoto', 'leftPhoto', 'backPhoto'], 'inspections'), 
    inspectionCtrl.createInspection
);

module.exports = router;
