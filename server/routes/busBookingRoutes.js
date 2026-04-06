const express = require('express');
const router = express.Router();
const {
    getAllBusBookings,
    getPublicBusBookings,
    createBusBooking,
    deleteBusBooking,
    cancelByToken,
    assignDriver,
    completeBusBooking,
    markBusAsPaid
} = require('../controllers/busBookingController');
const { verifyToken } = require('../middleware/authMiddleware');

// Public Routes
router.get('/public', getPublicBusBookings);
router.post('/public', createBusBooking);
router.post('/cancel-by-token', cancelByToken);

// Protected Routes
router.get('/', verifyToken, getAllBusBookings);
router.post('/', verifyToken, createBusBooking);
router.delete('/:id', verifyToken, deleteBusBooking);
router.put('/:id/assign-driver', verifyToken, assignDriver);
router.put('/:id/complete', verifyToken, completeBusBooking);
router.put('/:id/pay', verifyToken, markBusAsPaid);

module.exports = router;
