const express = require('express');
const router = express.Router();
const wh = require('../controllers/warehouseController');
const { verifyToken } = require('../middleware/authMiddleware');
const { handleUpload } = require('../middleware/uploadMiddleware');

router.use(verifyToken);

// Dashboard
router.get('/dashboard', wh.getDashboard);

// Categories
router.get('/categories', wh.getCategories);
router.post('/categories', wh.createCategory);

// Stock Items
router.get('/items', wh.getAllItems);
router.get('/items/export', wh.exportItems);
router.get('/items/:id', wh.getItemById);
router.post('/items', handleUpload('image', 'warehouse'), wh.createItem);
router.post('/items/import', wh.importItems);
router.put('/items/:id', handleUpload('image', 'warehouse'), wh.updateItem);

router.delete('/items/:id', wh.deleteItem);

// Maintenance (Super Admin only)
router.get('/maintenance/fix-gender', wh.fixExistingGenderData);
router.get('/maintenance/fix-units', wh.fixUnitNames);

// Transactions
router.get('/transactions', wh.getAllTransactions);
router.post('/transactions', wh.createTransaction);
router.delete('/transactions/:id', wh.deleteTransaction);

module.exports = router;
