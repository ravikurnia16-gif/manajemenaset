const express = require('express');
const router = express.Router();
const c = require('../controllers/uniformController');

// Dashboard
router.get('/dashboard', c.getDashboardStats);
router.get('/finance-report', c.getFinanceReport);

// Warehouse (Gudang)
router.get('/warehouses', c.getWarehouses);
router.post('/warehouses', c.createWarehouse);
router.put('/warehouses/:id', c.updateWarehouse);
router.delete('/warehouses/:id', c.deleteWarehouse);

// Category (Kategori)
router.get('/categories', c.getCategories);
router.post('/categories', c.createCategory);
router.put('/categories/:id', c.updateCategory);
router.delete('/categories/:id', c.deleteCategory);

// Clothing Type (Jenis Pakaian)
router.get('/clothing-types', c.getClothingTypes);
router.post('/clothing-types', c.createClothingType);
router.put('/clothing-types/:id', c.updateClothingType);
router.delete('/clothing-types/:id', c.deleteClothingType);

// Unit (Jenjang Sekolah)
router.get('/units', c.getUnits);
router.post('/units', c.createUnit);
router.put('/units/:id', c.updateUnit);
router.delete('/units/:id', c.deleteUnit);

// Size (Ukuran)
router.get('/sizes', c.getSizes);
router.post('/sizes', c.createSize);
router.put('/sizes/:id', c.updateSize);
router.delete('/sizes/:id', c.deleteSize);

// Pricing Rules (Aturan Harga)
router.get('/pricing-rules', c.getPricingRules);
router.post('/pricing-rules', c.createPricingRule);
router.delete('/pricing-rules/:id', c.deletePricingRule);
router.post('/pricing-rules/apply', c.applyPricingRules);

// Items (Barang Induk) & Variants
router.get('/items', c.getItems);
router.get('/variants', c.getVariants);

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
// Stock (Multi-Warehouse)
router.get('/stocks', c.getStocks);
router.get('/stocks/template', c.downloadStockImportTemplate);
router.post('/stocks/import', upload.single('file'), c.importStocks);
router.post('/stocks/manual', c.addManualStock);

// Stock Transactions (IN/OUT/MUTATION/ADJUSTMENT)
router.get('/transactions', c.getStockTransactions);
router.post('/transactions', c.createStockTransaction);

// Packages (SPMB Bundle)
router.get('/packages', c.getPackages);
router.post('/packages', c.createPackage);
router.put('/packages/:id', c.updatePackage);
router.delete('/packages/:id', c.deletePackage);

// Vendors (Penjahit/Supplier)
router.get('/vendors/sync-ratings', c.syncAllVendorRatings);
router.get('/vendors', c.getVendors);
router.post('/vendors', c.createVendor);
router.put('/vendors/:id', c.updateVendor);
router.delete('/vendors/:id', c.deleteVendor);

// Vendor Projects & Selections
router.get('/projects', c.getProjects);
router.post('/projects', c.createProject);
router.put('/projects/:id', c.updateProject);
router.post('/projects/:id/receive', c.receiveProjectGoods);

router.post('/vendor-selections', upload.single('file'), c.createVendorSelection);
router.put('/vendor-selections/:id', upload.single('file'), c.updateVendorSelection);

router.post('/vendor-mous', upload.single('file'), c.createVendorMoU);
router.put('/vendor-mous/:id', upload.single('file'), c.updateVendorMoU);

router.post('/vendor-evaluations', c.createVendorEvaluation);
router.put('/vendor-evaluations/:id', c.updateVendorEvaluation);

// Sales (POS / SPMB / Unit Order)
router.get('/sales', c.getSales);
router.get('/sales/:id', c.getSaleById);
router.post('/sales', c.createSale);
router.put('/sales/:id/payment', c.updateSalePayment);

// Exchange (Tukar Ukuran)
router.get('/exchanges', c.getExchanges);
router.post('/exchanges', c.createExchange);

// Schedule (Jadwal Pengambilan)
router.get('/schedules', c.getSchedules);
router.post('/schedules', c.createSchedule);
router.put('/schedules/:id', c.updateSchedule);
router.delete('/schedules/:id', c.deleteSchedule);

module.exports = router;
