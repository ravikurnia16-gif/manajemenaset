const express = require('express');
const router = express.Router();
const workshopController = require('../controllers/workshopController');
const { requireAuth } = require('../middleware/authMiddleware');

router.use(requireAuth);

router.get('/dashboard', workshopController.getDashboardStats);
router.get('/orders', workshopController.getAllOrders);
router.post('/orders', workshopController.createOrder);
router.post('/orders/from-procurement', workshopController.createFromProcurement);
router.get('/orders/:id', workshopController.getOrderById);
router.put('/orders/:id/status', workshopController.updateOrderStatus);
router.post('/orders/:id/progress', workshopController.addProgress);

module.exports = router;
