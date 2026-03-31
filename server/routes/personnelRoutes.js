const express = require('express');
const router = express.Router();
const personnelController = require('../controllers/personnelController');
const { verifyToken } = require('../middleware/authMiddleware');

router.use(verifyToken); // All personnel routes require authentication

// Reports
router.post('/reports', personnelController.createReport);
router.get('/reports', personnelController.getReports);
router.get('/reports/ai-summary', personnelController.getAiSummaryReports);

// Assignments
router.post('/assignments', personnelController.createAssignment);
router.get('/assignments', personnelController.getAssignments);
router.put('/assignments/:id/status', personnelController.updateAssignmentStatus);

// Dashboard
router.get('/dashboard', verifyToken, personnelController.getPersonnelDashboard);

// Drivers
router.get('/drivers', personnelController.getDrivers);
router.post('/drivers/toggle', personnelController.toggleDriverDesignation);

// Staff List (Sarpras)
router.get('/staff', personnelController.getStaffSarpras);

// All Users for Selection
router.get('/all-users', personnelController.getAllUsersForSelection);

module.exports = router;
