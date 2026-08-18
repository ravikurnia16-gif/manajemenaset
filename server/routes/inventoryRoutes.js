const express = require('express');
const router = express.Router();
const invCtrl = require('../controllers/inventoryController');
const { verifyToken, isAdmin, isSuperAdminOrIT } = require('../middleware/authMiddleware');

router.use(verifyToken);

// WAREHOUSE
router.get('/warehouses', invCtrl.getWarehouses);
router.post('/warehouses', isAdmin, invCtrl.createWarehouse);
router.put('/warehouses/:id', isAdmin, invCtrl.updateWarehouse);
router.delete('/warehouses/:id', isSuperAdminOrIT, invCtrl.deleteWarehouse);

// CATEGORY
router.get('/categories', invCtrl.getCategories);
router.post('/categories', isAdmin, invCtrl.createCategory);

// ITEMS
router.get('/items', invCtrl.getItems);
router.post('/items', isAdmin, invCtrl.createItem);
router.put('/items/:id', isAdmin, invCtrl.updateItem);
router.delete('/items/:id', isSuperAdminOrIT, invCtrl.deleteItem);

// TRANSACTIONS
router.get('/transactions', invCtrl.getTransactions);
router.post('/transactions', isAdmin, invCtrl.createTransaction);

// ORDERS
router.get('/orders', invCtrl.getOrders);
router.post('/orders', invCtrl.createOrder); // Any user can create order? Maybe need a specific role or just verifyToken
router.put('/orders/:id/status', isAdmin, invCtrl.updateOrderStatus);

module.exports = router;
