const express = require('express');
const router = express.Router();
const personnelController = require('../controllers/personnelController');
const { verifyToken } = require('../middleware/authMiddleware');

router.use(verifyToken); // All personnel routes require authentication

// Reports
router.post('/reports', personnelController.createReport);
router.get('/reports', personnelController.getReports);

// Assignments
router.post('/assignments', personnelController.createAssignment);
router.get('/assignments', personnelController.getAssignments);
router.put('/assignments/:id/status', personnelController.updateAssignmentStatus);

// Dashboard
router.get('/dashboard', verifyToken, personnelController.getPersonnelDashboard);

// Staff List (Sarpras)
router.get('/staff', personnelController.getStaffSarpras);

module.exports = router;
