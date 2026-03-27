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

        // Construct the public URL
        const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
        const host = process.env.MINIO_ENDPOINT;
        // In Easypanel, usually the API port is mapped to 80/443 externally.
        // If MINIO_PORT is 443/80, we don't need to specify it.
        const portPart = (process.env.MINIO_PORT && !['80', '443'].includes(process.env.MINIO_PORT)) 
            ? `:${process.env.MINIO_PORT}` 
            : '';
            
        return `${protocol}://${host}${portPart}/${bucketName}/${uniqueFileName}`;
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
        
        // Extract fileName from URL: http://host/bucket/filename
        const parts = fileUrl.split('/');
        const fileName = parts[parts.length - 1];
        
        await minioClient.removeObject(bucketName, fileName);
    } catch (error) {
        console.error('MinIO Delete Error:', error);
        // We don't throw here to avoid blocking deletions in DB if MinIO fails
    }
};
