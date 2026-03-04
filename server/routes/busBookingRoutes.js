const express = require('express');
const router = express.Router();
const busBookingController = require('../controllers/busBookingController');
const { verifyToken } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.post('/', busBookingController.createBusBooking);
router.get('/', busBookingController.getAllBusBookings);
router.delete('/:id', busBookingController.deleteBusBooking);

module.exports = router;
