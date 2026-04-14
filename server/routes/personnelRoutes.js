const express = require('express');
const router = express.Router();
const personnelController = require('../controllers/personnelController');
const { verifyToken } = require('../middleware/authMiddleware');

router.use(verifyToken); // All personnel routes require authentication

// Reports
router.post('/reports', personnelController.createReport);
router.get('/reports', personnelController.getReports);
router.put('/reports/:id', personnelController.updateReport);
router.post('/reports/:id/review', personnelController.reviewReport);
// AI Summary route removed

// Assignments
router.post('/assignments', personnelController.createAssignment);
router.get('/assignments', personnelController.getAssignments);
router.put('/assignments/:id/status', personnelController.updateAssignmentStatus);
router.post('/assignments/:id/request-extension', personnelController.requestExtension);
router.post('/assignments/:id/handle-extension', personnelController.handleExtension);

// Dashboard
router.get('/dashboard', verifyToken, personnelController.getPersonnelDashboard);
router.get('/kpi-leaderboard', personnelController.getKPILeaderboard);

// Routines
router.get('/routines', personnelController.getRoutines);
router.post('/routines', personnelController.createRoutine);
router.put('/routines/:id', personnelController.updateRoutine);
router.delete('/routines/:id', personnelController.deleteRoutine);

// Drivers
// Drivers
router.get('/drivers', personnelController.getDrivers);
router.post('/drivers/toggle', personnelController.toggleDriverDesignation);
router.put('/drivers/:id', personnelController.updateDriverInfo);
router.get('/drivers/:id/history', personnelController.getDriverHistory);

// Staff List (Sarpras)
router.get('/staff', personnelController.getStaffSarpras);

// All Users for Selection
router.get('/all-users', personnelController.getAllUsersForSelection);

module.exports = router;
