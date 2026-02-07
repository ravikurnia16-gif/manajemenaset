const express = require('express');
const { createAsset, getAllAssets, getAssetById, updateAsset, deleteAsset, batchImportAssets, deleteMultipleAssets } = require('../controllers/assetController');
const { verifyToken, authorizeRole } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/', verifyToken, createAsset);
router.get('/', verifyToken, getAllAssets);
router.get('/:id', verifyToken, getAssetById);
router.put('/:id', verifyToken, updateAsset);
router.delete('/bulk', verifyToken, authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), deleteMultipleAssets);
router.delete('/:id', verifyToken, authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), deleteAsset);
router.post('/import', verifyToken, batchImportAssets);

module.exports = router;
