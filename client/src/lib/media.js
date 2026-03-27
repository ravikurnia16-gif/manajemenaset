/**
 * Utility to resolve media URLs, handling MinIO proxying and Base64
 * @param {string} url The URL or Base64 string from the database
 * @returns {string} The resolved URL for use in img src
 */
export const getMediaUrl = (url) => {
    if (!url) return null;

    // 1. Handle Base64 (legacy data)
    if (url.startsWith('data:image')) {
        return url;
    }

    // 2. Handle Blob URLs (for previews in forms)
    if (url.startsWith('blob:')) {
        return url;
    }

    // 3. If it's already a proxy URL
    if (url.startsWith('/api/media/')) {
        const baseUrl = import.meta.env.VITE_API_URL || '';
        return `${baseUrl}${url}`;
    }

    // 4. Handle legacy full MinIO URLs by converting them to proxy URLs
    // Example: https://minio-host/bucket/filename -> /api/media/filename
    if (url.includes('/') && (url.startsWith('http') || url.includes('.host'))) {
        try {
            const parts = url.split('/');
            const filename = parts[parts.length - 1];
            const baseUrl = import.meta.env.VITE_API_URL || '';
            return `${baseUrl}/api/media/${filename}`;
        } catch (e) {
            return url;
        }
    }

    return url;
};
