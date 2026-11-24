const express = require('express');
const router = express.Router();
const multer = require('multer');
const { verifyToken } = require('../middleware/authMiddleware');
const aiOfficeController = require('../controllers/aiOfficeController');

const sopFormatUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

const handleSopFormatUpload = (req, res, next) => {
    sopFormatUpload.single('file')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'Ukuran file maksimal 10 MB.' });
            }
            return res.status(400).json({ error: err.message || 'Gagal mengunggah file format SOP.' });
        }
        next();
    });
};

const authorizeAiOffice = (req, res, next) => {
    const pos = (req.user?.position || '').toLowerCase();

    if (!pos.includes('kepala bidang sarana')) {
        return res.status(403).json({
            error: 'Akses ditolak. Menu Kantor AI hanya dapat diakses oleh Kepala Bidang Sarana.'
        });
    }

    next();
};

router.use(verifyToken, authorizeAiOffice);

router.get('/dashboard', aiOfficeController.getDashboard);
router.get('/config', aiOfficeController.getConfig);
router.put('/config', aiOfficeController.updateConfig);
router.post('/config/upload-sop-format', handleSopFormatUpload, aiOfficeController.uploadSopFormat);
router.delete('/config/sop-format-file', aiOfficeController.deleteSopFormatFile);

router.get('/items', aiOfficeController.listItems);
router.get('/items/:id', aiOfficeController.getItemById);
router.post('/items', aiOfficeController.createManualItem);
router.put('/items/:id', aiOfficeController.updateItem);
router.delete('/items/:id', aiOfficeController.deleteItem);

router.post('/items/:id/acc', aiOfficeController.accItem);
router.post('/items/:id/reject', aiOfficeController.rejectItem);
router.post('/items/:id/draft', aiOfficeController.draftItem);
router.post('/items/:id/revise', aiOfficeController.reviseItem);
router.get('/items/:id/pdf', aiOfficeController.downloadItemPdf);

router.post('/run/daily', aiOfficeController.runDailyShift);
router.post('/run/supervisor', aiOfficeController.runSupervisor);
router.post('/run/propose', aiOfficeController.runPropose);

module.exports = router;
