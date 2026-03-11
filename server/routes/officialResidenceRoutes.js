const express = require('express');
const router = express.Router();
const officialResidenceController = require('../controllers/officialResidenceController');
const { protect } = require('../middlewares/authMiddleware');

// Middleware to protect all routes
router.use(protect);

// Dashboard
router.get('/dashboard', officialResidenceController.getDashboardStats);

// Units
router.get('/units', officialResidenceController.getAllUnits);
router.post('/units', officialResidenceController.createUnit);
router.put('/units/:id', officialResidenceController.updateUnit);
router.delete('/units/:id', officialResidenceController.deleteUnit);

// Residents
router.get('/residents', officialResidenceController.getAllResidents);
router.post('/residents', officialResidenceController.createResident);
router.put('/residents/:id', officialResidenceController.updateResident);
router.delete('/residents/:id', officialResidenceController.deleteResident);

// Maintenance
router.get('/maintenance', officialResidenceController.getAllMaintenance);
router.post('/maintenance', officialResidenceController.reportMaintenance);
router.put('/maintenance/:id', officialResidenceController.updateMaintenance);
router.delete('/maintenance/:id', officialResidenceController.deleteMaintenance);

// MOU
router.get('/mou', officialResidenceController.getAllMOUs);
router.post('/mou', officialResidenceController.createMOU);
router.put('/mou/:id', officialResidenceController.updateMOU);
router.delete('/mou/:id', officialResidenceController.deleteMOU);

module.exports = router;
