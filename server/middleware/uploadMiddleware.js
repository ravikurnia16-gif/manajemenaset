const multer = require('multer');
const { uploadFile } = require('../services/minioService');

// Configure Multer for In-Memory Storage
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB Limit for Video
    fileFilter: (req, file, cb) => {
        const allowedTypes = /pdf|doc|docx|jpg|jpeg|png|webp|mp4|mov|m4v/;
        const isMimeMatch = allowedTypes.test(file.mimetype) || allowedTypes.test(file.originalname.toLowerCase());
        if (isMimeMatch) {
            return cb(null, true);
        }
        cb(new Error('Format file tidak didukung (Gunakan PDF, Gambar, atau Video MP4/MOV)'));
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
 * Middleware to handle multiple file uploads for multiple fields
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

/**
 * Middleware to handle an array of files for a single field (Batch Upload)
 */
exports.handleBulkUpload = (fieldName, maxCount = 10, folder = '') => {
    return [
        upload.array(fieldName, maxCount),
        async (req, res, next) => {
            try {
                if (!req.files || req.files.length === 0) return next();

                const uploadedFiles = [];
                for (const file of req.files) {
                    const url = await uploadFile(
                        file.buffer,
                        file.originalname,
                        file.mimetype,
                        folder
                    );
                    
                    uploadedFiles.push({
                        url,
                        type: file.mimetype.startsWith('video/') ? 'VIDEO' : 'IMAGE',
                        name: file.originalname,
                        size: file.size
                    });
                }

                // Add the array of file info to the request object
                req.uploadedMedia = uploadedFiles;
                next();
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        }
    ];
};
