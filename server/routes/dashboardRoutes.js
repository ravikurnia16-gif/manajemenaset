const express = require('express');
const router = express.Router();
const { getDashboardStats, getWeeklyAssetReport, getDashboardAISummary } = require('../controllers/dashboardController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/stats', verifyToken, getDashboardStats);
router.get('/weekly-report', verifyToken, getWeeklyAssetReport);
router.get('/ai-summary', verifyToken, getDashboardAISummary);

module.exports = router;
