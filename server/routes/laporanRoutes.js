const express = require('express');
const router = express.Router();
const laporanController = require('../controllers/laporanController');
const { verifyToken } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/', laporanController.getReports);
router.post('/my', laporanController.updateMyReport);

module.exports = router;
