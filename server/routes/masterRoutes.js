const express = require('express');
const { getAllUnits, getAllRooms } = require('../controllers/masterController');
const { verifyToken } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/units', verifyToken, getAllUnits);
router.get('/rooms', verifyToken, getAllRooms);

module.exports = router;
