const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const { verifyToken } = require('../middleware/authMiddleware');
const { handleUpload } = require('../middleware/uploadMiddleware');

// All vendor routes require authentication
router.use(verifyToken);

// Vendor CRUD
router.get('/', vendorController.getAllVendors);
router.get('/:id', vendorController.getVendorById);
router.post('/', handleUpload('photo', 'vendors/profile'), vendorController.createVendor);
router.put('/:id', handleUpload('photo', 'vendors/profile'), vendorController.updateVendor);
router.delete('/:id', vendorController.deleteVendor);

// Vendor Product CRUD
router.get('/all/products', vendorController.getAllProducts);
router.get('/:vendorId/products', vendorController.getVendorProducts);
router.post('/:vendorId/products', handleUpload('image', 'vendors/products'), vendorController.addProduct);
router.put('/:vendorId/products/:productId', handleUpload('image', 'vendors/products'), vendorController.updateProduct);
router.delete('/:vendorId/products/:productId', vendorController.deleteProduct);

module.exports = router;
