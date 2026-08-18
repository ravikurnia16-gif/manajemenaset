const express = require('express');
const router = express.Router();
const invCtrl = require('../controllers/inventoryController');
const { verifyToken, authorizeRole } = require('../middleware/authMiddleware');

const isAdmin = authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET', 'KABID_SARPRAS', 'KEPALA_BIDANG', 'ADMIN_UNIT']);
const isSuperAdminOrIT = authorizeRole(['SUPER_ADMIN', 'BIDANG_IT', 'KABID_SARPRAS']);

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


// VENDORS
router.get('/vendors', invCtrl.getVendors);
router.post('/vendors', isAdmin, invCtrl.createVendor);
router.put('/vendors/:id', isAdmin, invCtrl.updateVendor);
router.delete('/vendors/:id', isSuperAdminOrIT, invCtrl.deleteVendor);

module.exports = router;
