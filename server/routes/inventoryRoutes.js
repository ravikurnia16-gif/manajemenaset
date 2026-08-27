const express = require('express');
const router = express.Router();
const invCtrl = require('../controllers/inventoryController');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
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
router.put('/categories/:id', isAdmin, invCtrl.updateCategory);
router.delete('/categories/:id', isAdmin, invCtrl.deleteCategory);

// ITEMS
router.get('/items', invCtrl.getItems);
router.post('/items', isAdmin, invCtrl.createItem);
router.put('/items/:id', isAdmin, invCtrl.updateItem);
router.delete('/items/:id', isSuperAdminOrIT, invCtrl.deleteItem);

// TRANSACTIONS
router.get('/transactions', invCtrl.getTransactions);
router.post('/transactions', isAdmin, invCtrl.createTransaction);
router.post('/transactions/import', isAdmin, upload.single('file'), invCtrl.importTransactions);

// ORDERS
router.get('/orders', invCtrl.getOrders);
router.post('/orders', invCtrl.createOrder); // Any user can create order? Maybe need a specific role or just verifyToken
router.put('/orders/:id/status', isAdmin, invCtrl.updateOrderStatus);


// VENDORS
router.get('/vendors', invCtrl.getVendors);
router.post('/vendors', isAdmin, invCtrl.createVendor);
router.put('/vendors/:id', isAdmin, invCtrl.updateVendor);
router.delete('/vendors/:id', isSuperAdminOrIT, invCtrl.deleteVendor);

// ==========================================
// PROYEK LOGISTIK / GUDANG
// ==========================================
const projectCtrl = require('../controllers/inventoryProjectController');

// PROJECTS
router.get('/projects', projectCtrl.getProjects);
router.post('/projects', isAdmin, projectCtrl.createProject);
router.put('/projects/:id', isAdmin, projectCtrl.updateProject);
router.delete('/projects/:id', isSuperAdminOrIT, projectCtrl.deleteProject);

// VENDOR SELECTIONS
router.get('/vendor-selections', projectCtrl.getVendorSelections);
router.post('/vendor-selections', isAdmin, projectCtrl.createVendorSelection);
router.put('/vendor-selections/:id', isAdmin, projectCtrl.updateVendorSelection);
router.delete('/vendor-selections/:id', isAdmin, projectCtrl.deleteVendorSelection);

// VENDOR MOUs
router.get('/vendor-mous', projectCtrl.getVendorMoUs);
router.post('/vendor-mous', isAdmin, projectCtrl.createVendorMoU);
router.put('/vendor-mous/:id', isAdmin, projectCtrl.updateVendorMoU);
router.delete('/vendor-mous/:id', isAdmin, projectCtrl.deleteVendorMoU);

// VENDOR EVALUATIONS
router.get('/vendor-evaluations', projectCtrl.getVendorEvaluations);
router.post('/vendor-evaluations', isAdmin, projectCtrl.createVendorEvaluation);
router.put('/vendor-evaluations/:id', isAdmin, projectCtrl.updateVendorEvaluation);
router.delete('/vendor-evaluations/:id', isAdmin, projectCtrl.deleteVendorEvaluation);

module.exports = router;

