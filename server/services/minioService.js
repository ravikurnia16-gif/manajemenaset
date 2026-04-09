const Minio = require('minio');
require('dotenv').config();

const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT) || 9000,
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY
});

const bucketName = process.env.MINIO_BUCKET || 'sarpras-media';

// Export for other services/controllers
exports.minioClient = minioClient;
exports.bucketName = bucketName;

const sharp = require('sharp');

/**
 * Upload file to MinIO
 * @param {Buffer} fileBuffer 
 * @param {string} fileName 
 * @param {string} mimeType 
 * @param {string} folder Optional folder path (e.g. 'assets')
 * @returns {Promise<string>} URL of the uploaded file
 */
exports.uploadFile = async (fileBuffer, fileName, mimeType, folder = '') => {
    try {
        let finalBuffer = fileBuffer;

        // Auto Image Compression & Optimization
        if (mimeType.startsWith('image/') && mimeType !== 'image/svg+xml') {
            try {
                finalBuffer = await sharp(fileBuffer)
                    .resize(1200, 1200, {
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    .rotate() // Auto-rotate based on EXIF
                    .jpeg({ quality: 80, progressive: true, force: false })
                    .png({ quality: 80, palette: true, force: false })
                    .webp({ quality: 80, force: false })
                    .toBuffer();
                
                console.log(`[OPTIMIZER] Image compressed: ${(fileBuffer.length / 1024).toFixed(1)}KB -> ${(finalBuffer.length / 1024).toFixed(1)}KB`);
            } catch (sharpError) {
                console.error('[OPTIMIZER] Sharp compression failed, using original:', sharpError);
            }
        }

        const uniqueFileName = `${Date.now()}-${fileName.replace(/\s/g, '_')}`;
        const objectName = folder ? `${folder}/${uniqueFileName}` : uniqueFileName;
        
        await minioClient.putObject(
            bucketName,
            objectName,
            finalBuffer,
            finalBuffer.length,
            { 'Content-Type': mimeType }
        );

        // Construct the proxy URL instead of a direct public URL
        return `/api/media/${objectName}`;
    } catch (error) {
        console.error('MinIO Upload Error:', error);
        throw new Error('Gagal mengunggah file ke Object Storage');
    }
};

/**
 * Delete file from MinIO
 * @param {string} fileUrl 
 */
exports.deleteFile = async (fileUrl) => {
    try {
        if (!fileUrl) return;
        
        // Extract path from proxy URL (/api/media/folder/filename -> folder/filename)
        let fileName = '';
        if (fileUrl.startsWith('/api/media/')) {
            fileName = fileUrl.replace('/api/media/', '');
        } else {
            // Legacy / fallback
            const parts = fileUrl.split('/');
            fileName = parts[parts.length - 1];
        }
        
        await minioClient.removeObject(bucketName, fileName);
    } catch (error) {
        console.error('MinIO Delete Error:', error);
    }
};
