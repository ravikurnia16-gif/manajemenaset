const express = require('express');
const router = express.Router();
const laporanController = require('../controllers/laporanController');
const { verifyToken } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/', laporanController.getReports);
router.post('/my', laporanController.updateMyReport);
router.get('/kabid/summary', laporanController.getKabidSummary);
router.get('/status', laporanController.getReportStatus);

module.exports = router;
