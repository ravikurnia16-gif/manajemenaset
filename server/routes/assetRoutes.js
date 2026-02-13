const express = require('express');
const {
    createAsset, getAllAssets, getAssetById, updateAsset, deleteAsset,
    batchImportAssets, deleteMultipleAssets, getFundingSources,
    validateAsset, validateMultipleAssets, getAssetPublic
} = require('../controllers/assetController');
const {
    requestMutation, approveMutation, rejectMutation,
    getAllMovements, getMovementById, deleteMultipleMovements
} = require('../controllers/movementController');
const { verifyToken, authorizeRole } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/public/:id', getAssetPublic);
router.get('/funding-sources', verifyToken, getFundingSources);
router.post('/', verifyToken, createAsset);
router.get('/', verifyToken, getAllAssets);

// Mutation Routes
router.get('/movements/all', verifyToken, getAllMovements);
router.post('/movements/request', verifyToken, requestMutation);
router.post('/movements/approve', verifyToken, authorizeRole(['SUPER_ADMIN', 'KEPALA_BIDANG']), approveMutation);
router.post('/movements/reject', verifyToken, authorizeRole(['SUPER_ADMIN', 'KEPALA_BIDANG']), rejectMutation);
router.delete('/movements/bulk', verifyToken, authorizeRole(['SUPER_ADMIN', 'KEPALA_BIDANG']), deleteMultipleMovements);
router.get('/movements/:id', verifyToken, getMovementById);
router.post('/movements/:id/approve', verifyToken, authorizeRole(['SUPER_ADMIN', 'KEPALA_BIDANG']), approveMutation);
router.post('/movements/:id/reject', verifyToken, authorizeRole(['SUPER_ADMIN', 'KEPALA_BIDANG']), rejectMutation);

router.get('/:id', verifyToken, getAssetById);
router.post('/:id/validate', verifyToken, validateAsset);
router.post('/validate/bulk', verifyToken, validateMultipleAssets);
router.put('/:id', verifyToken, updateAsset);
router.delete('/bulk', verifyToken, authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), deleteMultipleAssets);
router.delete('/:id', verifyToken, authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), deleteAsset);
router.post('/import', verifyToken, batchImportAssets);

module.exports = router;
