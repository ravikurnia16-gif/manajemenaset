const express = require('express');
const router = express.Router();
const multer = require('multer');
const laporanController = require('../controllers/laporanController');
const { verifyToken } = require('../middleware/authMiddleware');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB
});

router.use(verifyToken);

router.get('/', laporanController.getReports);
router.post('/my', laporanController.updateMyReport);
router.get('/status', laporanController.getReportStatus);
router.get('/kabid/summary', laporanController.getKabidSummary);

// Executive Dashboard & AI
router.get('/dashboard/analytics', laporanController.getDashboardAnalytics);
router.get('/weekly-summary', laporanController.getWeeklySummary);
router.post('/ai/analyze', laporanController.analyzeWithAI);
router.put('/:id/verify', laporanController.verifyReport);

// Staff Scorecard & MinIO Media
router.get('/my-stats', laporanController.getMyStats);
router.post('/upload-photo', upload.single('photo'), laporanController.uploadReportPhoto);

// Inactivity Alert for Kabid (2 working days)
router.post('/notify-inactive', laporanController.notifyKabidInactiveStaff);

module.exports = router;
