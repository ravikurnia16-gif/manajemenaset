const QRCode = require('qrcode');

exports.generateQRCode = async (text) => {
    try {
        // Returns Data URL (Base64 image)
        const url = await QRCode.toDataURL(text);
        return url;
    } catch (err) {
        console.error('QR Generation Error:', err);
        throw err;
    }
};
