const express = require('express');
const router = express.Router();
const sarprasRuleController = require('../controllers/sarprasRuleController');
const { verifyToken, authorizeRole } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer for File Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/rules');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB Limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /pdf|doc|docx|jpg|jpeg|png/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Format file tidak didukung (Gunakan PDF, DOC, atau Gambar)'));
    }
});

router.get('/', verifyToken, sarprasRuleController.getAllRules);
router.post('/', verifyToken, authorizeRole(['SUPER_ADMIN']), upload.single('file'), sarprasRuleController.createRule);
router.delete('/:id', verifyToken, authorizeRole(['SUPER_ADMIN']), sarprasRuleController.deleteRule);

module.exports = router;
