const { minioClient, bucketName } = require('../services/minioService');

exports.getMedia = async (req, res) => {
    try {
        // Use req.params.path to get the full path after /api/media/
        const filename = req.params.path + (req.params[0] || '');
        
        if (!filename) {
            return res.status(400).json({ error: 'Filename is required' });
        }

        const dataStream = await minioClient.getObject(bucketName, filename);
        
        // Handle stream errors
        dataStream.on('error', (err) => {
            console.error('MinIO Stream Error:', err);
            if (!res.headersSent) {
                res.status(404).json({ error: 'File not found' });
            }
        });

        // Set content type if possible (MinIO statObject can give this)
        try {
            const stat = await minioClient.statObject(bucketName, filename);
            res.setHeader('Content-Type', stat.metaData['content-type'] || 'application/octet-stream');
            res.setHeader('Content-Length', stat.size);
            res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
        } catch (e) {
            // If stat fails, just stream it
        }

        dataStream.pipe(res);
    } catch (error) {
        console.error('Media Proxy Error:', error);
        res.status(404).json({ error: 'File not found' });
    }
};
