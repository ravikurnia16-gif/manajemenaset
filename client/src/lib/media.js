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

/**
 * Compresses an image file using the Canvas API.
 * @param {File} file The original image file.
 * @param {Object} options Compression options (maxWidth, maxHeight, quality).
 * @returns {Promise<File>} A promise that resolves to the compressed File object.
 */
export const compressImage = (file, options = {}) => {
    const { maxWidth = 1200, maxHeight = 1200, quality = 0.7 } = options;

    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            return resolve(file); // Not an image, skip
        }

        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Calculate dimensions while maintaining aspect ratio
            if (width > height) {
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        return reject(new Error('Canvas toBlob failed'));
                    }
                    const compressedFile = new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                    });
                    resolve(compressedFile);
                },
                'image/jpeg',
                quality
            );
        };
        img.onerror = (err) => {
            URL.revokeObjectURL(objectUrl);
            reject(err);
        };
        img.src = objectUrl;
    });
};
