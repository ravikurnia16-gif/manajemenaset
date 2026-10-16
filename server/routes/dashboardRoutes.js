const express = require('express');
const router = express.Router();
const { 
    getDashboardStats, 
    getWeeklyAssetReport, 
    getDashboardAISummary,
    getWeeklyReportAISummary,
    getDateRangeReport
} = require('../controllers/dashboardController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/stats', verifyToken, getDashboardStats);
router.get('/weekly-report', verifyToken, getWeeklyAssetReport);
router.get('/weekly-report/ai-summary', verifyToken, getWeeklyReportAISummary);
router.post('/weekly-report/ai-summary', verifyToken, getWeeklyReportAISummary);
router.get('/ai-summary', verifyToken, getDashboardAISummary);
router.get('/date-range-report', verifyToken, getDateRangeReport);

module.exports = router;

