const express = require('express');
const router = express.Router();
const securityController = require('../controllers/securityController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken); // Apply auth middleware to all security routes

// Dashboard
router.get('/dashboard', securityController.getDashboard);

// Posts
router.get('/posts', securityController.getPosts);
router.post('/posts', securityController.createPost);
router.put('/posts/:id', securityController.updatePost);
router.delete('/posts/:id', securityController.deletePost);

// Guards
router.get('/guards', securityController.getGuards);
router.post('/guards', securityController.createGuard);
router.put('/guards/:id', securityController.updateGuard);
router.delete('/guards/:id', securityController.deleteGuard);

// Schedules
router.get('/schedules', securityController.getSchedules);
router.post('/schedules', securityController.createSchedule);
router.post('/schedules/generate', securityController.generateSchedule);
router.put('/schedules/:id', securityController.updateSchedule);
router.put('/schedules/:id/attendance', securityController.updateAttendance);
router.delete('/schedules/:id', securityController.deleteSchedule);

module.exports = router;
