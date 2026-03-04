const express = require('express');
const router = express.Router();
const busBookingController = require('../controllers/busBookingController');
const { protect } = require('../controllers/authController');

router.use(protect);

router.post('/', busBookingController.createBusBooking);
router.get('/', busBookingController.getAllBusBookings);
router.delete('/:id', busBookingController.deleteBusBooking);

module.exports = router;
