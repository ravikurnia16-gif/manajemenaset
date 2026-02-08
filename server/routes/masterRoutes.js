const express = require('express');
const {
    getAllUnits, createUnit, updateUnit, deleteUnit,
    getAllRooms, createRoom, updateRoom, deleteRoom,
    getAllCategories, createCategory, updateCategory, deleteCategory,
    getAllVendors, createVendor, updateVendor, deleteVendor
} = require('../controllers/masterController');
const { verifyToken, authorizeRole } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/units', verifyToken, getAllUnits);
router.post('/units', verifyToken, authorizeRole(['SUPER_ADMIN']), createUnit);
router.put('/units/:id', verifyToken, authorizeRole(['SUPER_ADMIN']), updateUnit);
router.delete('/units/:id', verifyToken, authorizeRole(['SUPER_ADMIN']), deleteUnit);

router.get('/rooms', verifyToken, getAllRooms);
router.post('/rooms', verifyToken, createRoom);
router.put('/rooms/:id', verifyToken, updateRoom);
router.delete('/rooms/:id', verifyToken, deleteRoom);

router.get('/categories', verifyToken, getAllCategories);
router.post('/categories', verifyToken, createCategory);
router.put('/categories/:id', verifyToken, updateCategory);
router.delete('/categories/:id', verifyToken, deleteCategory);

router.get('/vendors', verifyToken, getAllVendors);
router.post('/vendors', verifyToken, createVendor);
router.put('/vendors/:id', verifyToken, updateVendor);
router.delete('/vendors/:id', verifyToken, deleteVendor);

module.exports = router;
