const multer = require('multer');
const { uploadFile } = require('../services/minioService');

// Configure Multer for In-Memory Storage
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB Limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /pdf|doc|docx|jpg|jpeg|png/;
        const isMimeMatch = allowedTypes.test(file.mimetype);
        if (isMimeMatch) {
            return cb(null, true);
        }
        cb(new Error('Format file tidak didukung (Gunakan PDF, DOC, atau Gambar)'));
    }
});

/**
 * Middleware to handle file upload and send it to MinIO
 */
exports.handleUpload = (fieldName, folder = '') => {
    return [
        upload.single(fieldName),
        async (req, res, next) => {
            try {
                if (!req.file) return next();

                const fileUrl = await uploadFile(
                    req.file.buffer,
                    req.file.originalname,
                    req.file.mimetype,
                    folder
                );

                // Add the URL to the request object so the controller can save it to DB
                req.fileUrl = fileUrl;
                next();
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        }
    ];
};

/**
 * Middleware to handle multiple file uploads and send them to MinIO
 */
exports.handleMultipleUploads = (fields, folder = '') => {
    return [
        upload.fields(fields.map(f => ({ name: f, maxCount: 1 }))),
        async (req, res, next) => {
            try {
                if (!req.files) return next();

                req.fileUrls = {};
                for (const field of fields) {
                    if (req.files[field] && req.files[field][0]) {
                        const file = req.files[field][0];
                        const url = await uploadFile(
                            file.buffer,
                            file.originalname,
                            file.mimetype,
                            folder
                        );
                        req.fileUrls[field] = url;
                    }
                }
                next();
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        }
    ];
};
