const express = require('express');
const router = express.Router();
const {
    getAllBusBookings,
    getPublicBusBookings,
    getPublicBusInvoice,
    getPublicBusInvoiceBatch,
    createBusBooking,
    deleteBusBooking,
    cancelByToken,
    assignDriver,
    completeBusBooking,
    markBusAsPaid,
    getBusExpenseSummary,
    getBusInitialFund,
    setBusInitialFund,
    getBusUnexpectedExpenses,
    createBusUnexpectedExpense,
    deleteBusUnexpectedExpense,
    createBusOtherIncome,
    deleteBusOtherIncome,
    publicConfirmBooking
} = require('../controllers/busBookingController');
const { verifyToken } = require('../middleware/authMiddleware');

// Public Routes
router.get('/public', getPublicBusBookings);
router.get('/public/invoice/batch', getPublicBusInvoiceBatch);
router.get('/public/invoice/:id', getPublicBusInvoice);
router.post('/public', createBusBooking);
router.post('/public/confirm-bus/:id/:token', publicConfirmBooking);
router.post('/cancel-by-token', cancelByToken);

// Protected Routes
router.get('/', verifyToken, getAllBusBookings);
router.get('/expense-summary', verifyToken, getBusExpenseSummary);
router.get('/initial-fund', verifyToken, getBusInitialFund);
router.put('/initial-fund', verifyToken, setBusInitialFund);
router.post('/', verifyToken, createBusBooking);
router.delete('/:id', verifyToken, deleteBusBooking);
router.put('/:id/assign-driver', verifyToken, assignDriver);
router.put('/:id/complete', verifyToken, completeBusBooking);
router.put('/:id/pay', verifyToken, markBusAsPaid);

// Unexpected Expenses Routes
router.get('/unexpected-expenses', verifyToken, getBusUnexpectedExpenses);
router.post('/unexpected-expenses', verifyToken, createBusUnexpectedExpense);
router.delete('/unexpected-expenses/:id', verifyToken, deleteBusUnexpectedExpense);

// Other Income Routes
router.post('/other-income', verifyToken, createBusOtherIncome);
router.delete('/other-income/:id', verifyToken, deleteBusOtherIncome);

module.exports = router;
