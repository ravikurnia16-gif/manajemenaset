const express = require('express');
const { getAllUnits, getAllRooms, getAllCategories } = require('../controllers/masterController');
const { verifyToken } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/units', verifyToken, getAllUnits);
router.get('/rooms', verifyToken, getAllRooms);
router.get('/categories', verifyToken, getAllCategories);

module.exports = router;
