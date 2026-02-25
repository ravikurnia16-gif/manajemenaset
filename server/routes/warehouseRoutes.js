const express = require('express');
const router = express.Router();
const wh = require('../controllers/warehouseController');
const { verifyToken, authorizeRole } = require('../middleware/authMiddleware');

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
router.post('/items', wh.createItem);
router.post('/items/import', wh.importItems);
router.put('/items/:id', wh.updateItem);

router.delete('/items/:id', wh.deleteItem);

// Transactions
router.get('/transactions', wh.getAllTransactions);
router.post('/transactions', wh.createTransaction);
router.delete('/transactions/:id', wh.deleteTransaction);

module.exports = router;
