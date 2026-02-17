const express = require('express');
const router = express.Router();
const { verifyToken, authorizeRole } = require('../middleware/authMiddleware');
const calendar = require('../controllers/calendarController');

// All routes require authentication
router.use(verifyToken);

// All calendar routes restricted to SUPER_ADMIN and ADMIN_ASET
router.use(authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']));

// GET events for a month
router.get('/', calendar.getEvents);

// GET pinned events
router.get('/pinned', calendar.getPinnedEvents);

// GET monthly summary
router.get('/summary', calendar.getSummary);

// POST create event
router.post('/', calendar.createEvent);

// PUT update event
router.put('/:id', calendar.updateEvent);

// DELETE event
router.delete('/:id', calendar.deleteEvent);

// POST manual trigger reminders
router.post('/reminders', calendar.sendCalendarReminders);

module.exports = router;
