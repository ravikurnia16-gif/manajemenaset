const express = require('express');
const router = express.Router();
const wh = require('../controllers/warehouseController');
const { verifyToken, authorizeRole } = require('../middleware/authMiddleware');
const { handleUpload } = require('../middleware/uploadMiddleware');

router.use(verifyToken);

// Dashboard
router.get('/dashboard', wh.getDashboard);

// Categories
router.get('/categories', wh.getCategories);
router.post('/categories', authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), wh.createCategory);

// Stock Items
router.get('/items', wh.getAllItems);
router.get('/items/export', authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), wh.exportItems);
router.get('/items/:id', wh.getItemById);
router.post('/items', authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), handleUpload('image', 'warehouse'), wh.createItem);
router.post('/items/import', authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), wh.importItems);
router.post('/items/rollback-import', authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), wh.rollbackImportItems);
router.put('/items/:id', authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), handleUpload('image', 'warehouse'), wh.updateItem);
router.delete('/items/:id', authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), wh.deleteItem);

// Maintenance (Super Admin only)
router.get('/maintenance/fix-gender', wh.fixExistingGenderData);
router.get('/maintenance/fix-units', wh.fixUnitNames);

// Transactions
router.get('/transactions', authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), wh.getAllTransactions);
router.post('/transactions', authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), wh.createTransaction);
router.delete('/transactions/:id', authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), wh.deleteTransaction);

module.exports = router;
