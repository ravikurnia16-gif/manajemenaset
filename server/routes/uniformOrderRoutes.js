const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/uniformOrderController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Public routes (no auth required)
router.get('/items', ctrl.getAvailableUniforms);
router.post('/', ctrl.createOrder);
router.get('/check/:code', ctrl.checkOrder);

// Admin routes (auth required)
router.get('/admin/orders', authMiddleware, ctrl.getAllOrders);
router.put('/admin/:id', authMiddleware, ctrl.updateOrderStatus);
router.delete('/admin/:id', authMiddleware, ctrl.deleteOrder);

module.exports = router;
