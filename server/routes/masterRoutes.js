const express = require('express');
const {
    getAllUnits, getUnitById, createUnit, updateUnit, deleteUnit, deleteMultipleUnits,
    getAllRooms, createRoom, updateRoom, deleteRoom, deleteMultipleRooms, cleanupRooms, repairRoomConflicts,
    getAllCategories, createCategory, updateCategory, deleteCategory, deleteMultipleCategories,
    getAllVendors, createVendor, updateVendor, deleteVendor, deleteMultipleVendors, syncAssetCodes
} = require('../controllers/masterController');
const { verifyToken, authorizeRole } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/units/public', getAllUnits);
router.get('/units', verifyToken, getAllUnits);
router.get('/units/:id', verifyToken, getUnitById);
router.post('/units', verifyToken, authorizeRole(['SUPER_ADMIN']), createUnit);
router.delete('/units/bulk', verifyToken, authorizeRole(['SUPER_ADMIN']), deleteMultipleUnits);
router.put('/units/:id', verifyToken, authorizeRole(['SUPER_ADMIN']), updateUnit);
router.delete('/units/:id', verifyToken, authorizeRole(['SUPER_ADMIN']), deleteUnit);

router.get('/rooms', verifyToken, getAllRooms);
router.post('/rooms', verifyToken, createRoom);
router.delete('/rooms/bulk', verifyToken, deleteMultipleRooms);
router.put('/rooms/:id', verifyToken, updateRoom);
router.delete('/rooms/:id', verifyToken, deleteRoom);
router.post('/rooms/cleanup', verifyToken, authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), cleanupRooms);
router.post('/rooms/repair', verifyToken, authorizeRole(['SUPER_ADMIN']), repairRoomConflicts);
router.post('/assets/sync', verifyToken, authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), syncAssetCodes);

router.get('/categories', verifyToken, getAllCategories);
router.post('/categories', verifyToken, createCategory);
router.delete('/categories/bulk', verifyToken, deleteMultipleCategories);
router.put('/categories/:id', verifyToken, updateCategory);
router.delete('/categories/:id', verifyToken, deleteCategory);

router.get('/vendors', verifyToken, getAllVendors);
router.post('/vendors', verifyToken, createVendor);
router.delete('/vendors/bulk', verifyToken, deleteMultipleVendors);
router.put('/vendors/:id', verifyToken, updateVendor);
router.delete('/vendors/:id', verifyToken, deleteVendor);

module.exports = router;
