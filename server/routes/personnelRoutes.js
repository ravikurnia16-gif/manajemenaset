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
router.delete('/assignments/purge-routine', personnelController.purgeRoutineAssignments);
router.put('/assignments/:id/status', personnelController.updateAssignmentStatus);
router.post('/assignments/:id/request-extension', personnelController.requestExtension);
router.post('/assignments/:id/handle-extension', personnelController.handleExtension);

// AI Summary
router.get('/ai-summary', personnelController.getPersonnelAISummary);

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

// Driver Violations
const { handleUpload } = require('../middleware/uploadMiddleware');
router.get('/violations', personnelController.getDriverViolations);
router.post('/violations', handleUpload('photo', 'violations'), personnelController.createDriverViolation);
router.delete('/violations/:id', personnelController.deleteDriverViolation);

// Staff List (Sarpras)
router.get('/staff', personnelController.getStaffSarpras);

// All Users for Selection
router.get('/all-users', personnelController.getAllUsersForSelection);

// Sanctions
router.get('/sanctions', personnelController.getSanctionedUsers);
router.post('/sanctions/propose', personnelController.proposeSanctionLift);
router.post('/sanctions/review', personnelController.reviewSanctionLift);

module.exports = router;
