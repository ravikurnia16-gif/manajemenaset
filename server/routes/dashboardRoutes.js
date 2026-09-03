const express = require('express');
const router = express.Router();
const { getDashboardStats, getWeeklyAssetReport } = require('../controllers/dashboardController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/stats', verifyToken, getDashboardStats);
router.get('/weekly-report', verifyToken, getWeeklyAssetReport);

module.exports = router;
