/**
 * Utility to resolve media URLs, handling MinIO proxying and Base64
 * @param {string} url The URL or Base64 string from the database
 * @returns {string} The resolved URL for use in img src
 */
export const getMediaUrl = (url) => {
    if (!url || url === 'undefined' || url === 'null') return null;

    // 1. Handle Base64 (legacy data)
    if (url.startsWith('data:image')) {
        return url;
    }

    // 2. Handle Blob URLs (for previews in forms)
    if (url.startsWith('blob:')) {
        return url;
    }

    // 3. Handle external URLs
    if (url.startsWith('http')) {
        return url;
    }

    // 4. Handle paths (e.g., /api/media/filename or vehicles/filename)
    const baseUrl = import.meta.env.VITE_API_URL || '';
    
    // If it already has the proxy prefix
    if (url.startsWith('/api/media/')) {
        return `${baseUrl}${url}`;
    }

    // If it's a relative path (MinIO path like 'vehicles/abc.jpg')
    const cleanPath = url.startsWith('/') ? url : `/api/media/${url}`;
    return `${baseUrl}${cleanPath}`;
};
