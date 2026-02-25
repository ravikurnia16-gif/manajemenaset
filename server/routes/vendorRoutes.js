const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const auth = require('../middleware/auth');

// All vendor routes require authentication
router.use(auth);

// Vendor CRUD
router.get('/', vendorController.getAllVendors);
router.get('/:id', vendorController.getVendorById);
router.post('/', vendorController.createVendor);
router.put('/:id', vendorController.updateVendor);
router.delete('/:id', vendorController.deleteVendor);

// Vendor Product CRUD
router.get('/:vendorId/products', vendorController.getVendorProducts);
router.post('/:vendorId/products', vendorController.addProduct);
router.put('/:vendorId/products/:productId', vendorController.updateProduct);
router.delete('/:vendorId/products/:productId', vendorController.deleteProduct);

module.exports = router;
