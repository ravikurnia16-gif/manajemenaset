const express = require('express');
const router = express.Router();
const workshopController = require('../controllers/workshopController');
const { verifyToken } = require('../middleware/authMiddleware');
const { handleUpload } = require('../middleware/uploadMiddleware');

router.use(verifyToken);

router.get('/dashboard', workshopController.getDashboardStats);
router.get('/orders', workshopController.getAllOrders);
router.post('/orders', workshopController.createOrder);
router.post('/orders/from-procurement', workshopController.createFromProcurement);
router.get('/orders/:id', workshopController.getOrderById);
router.put('/orders/:id/status', workshopController.updateOrderStatus);
router.put('/orders/:id/details', workshopController.updateOrderDetails);
router.post('/orders/:id/progress', workshopController.addProgress);

// Workshop Catalog (terhubung langsung ke Data Vendor)
router.get('/catalog', workshopController.getWorkshopCatalog);
router.post('/catalog', handleUpload('image', 'vendors/products'), workshopController.addWorkshopProduct);
router.put('/catalog/:id', handleUpload('image', 'vendors/products'), workshopController.updateWorkshopProduct);
router.delete('/catalog/:id', workshopController.deleteWorkshopProduct);

// Workshop Settings & Aturan Kepala Unit
router.get('/settings-unit', workshopController.getWorkshopSettingsAndUnit);
router.put('/settings-unit', workshopController.updateWorkshopSettingsAndUnit);

module.exports = router;

