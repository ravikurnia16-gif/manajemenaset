const express = require('express');
const {
    getAllUnits, createUnit, deleteUnit,
    getAllRooms, createRoom, deleteRoom,
    getAllCategories, createCategory, deleteCategory,
    getAllVendors, createVendor, deleteVendor
} = require('../controllers/masterController');
const { verifyToken, authorizeRole } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/units', verifyToken, getAllUnits);
router.post('/units', verifyToken, authorizeRole(['SUPER_ADMIN']), createUnit);
router.delete('/units/:id', verifyToken, authorizeRole(['SUPER_ADMIN']), deleteUnit);

router.get('/rooms', verifyToken, getAllRooms);
router.post('/rooms', verifyToken, createRoom);
router.delete('/rooms/:id', verifyToken, deleteRoom);

router.get('/categories', verifyToken, getAllCategories);
router.post('/categories', verifyToken, createCategory);
router.delete('/categories/:id', verifyToken, deleteCategory);

router.get('/vendors', verifyToken, getAllVendors);
router.post('/vendors', verifyToken, createVendor);
router.delete('/vendors/:id', verifyToken, deleteVendor);

module.exports = router;
