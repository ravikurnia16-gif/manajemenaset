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

/**
 * Upload file to MinIO
 * @param {Buffer} fileBuffer 
 * @param {string} fileName 
 * @param {string} mimeType 
 * @returns {Promise<string>} URL of the uploaded file
 */
exports.uploadFile = async (fileBuffer, fileName, mimeType) => {
    try {
        const uniqueFileName = `${Date.now()}-${fileName.replace(/\s/g, '_')}`;
        
        await minioClient.putObject(
            bucketName,
            uniqueFileName,
            fileBuffer,
            fileBuffer.length,
            { 'Content-Type': mimeType }
        );

        // Construct the proxy URL instead of a direct public URL
        // This ensures private buckets work through the backend proxy
        return `/api/media/${uniqueFileName}`;
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
        
        // Extract fileName from URL: http://host/bucket/filename OR /api/media/filename
        const parts = fileUrl.split('/');
        const fileName = parts[parts.length - 1];
        
        await minioClient.removeObject(bucketName, fileName);
    } catch (error) {
        console.error('MinIO Delete Error:', error);
        // We don't throw here to avoid blocking deletions in DB if MinIO fails
    }
};
