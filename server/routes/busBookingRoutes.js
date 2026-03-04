const express = require('express');
const router = express.Router();
const {
    getAllBusBookings,
    getPublicBusBookings,
    createBusBooking,
    deleteBusBooking
} = require('../controllers/busBookingController');
const { verifyToken } = require('../middleware/authMiddleware');

// Public Routes
router.get('/public', getPublicBusBookings);
router.post('/public', createBusBooking); // createBusBooking now handles optional req.user

// Protected Routes
router.get('/', verifyToken, getAllBusBookings);
router.post('/', verifyToken, createBusBooking);
router.delete('/:id', verifyToken, deleteBusBooking);

module.exports = router;
