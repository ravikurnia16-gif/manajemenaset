/**
 * Utility to normalize Indonesian phone numbers for WhatsApp
 * Handles:
 * - 08... -> 628...
 * - +628... -> 628...
 * - 6208... -> 628... (Common mistake)
 * - 8... -> 628... (Missing prefix)
 */
const formatPhoneForWA = (phone) => {
    if (!phone) return '';

    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, '');

    // Case: 08... -> 628...
    if (cleaned.startsWith('0')) {
        cleaned = '62' + cleaned.substring(1);
    }

    // Case: 6208... -> 628...
    if (cleaned.startsWith('620')) {
        cleaned = '62' + cleaned.substring(3);
    }

    // Case: 8... -> 628... (Assume Indonesian 8xx if length is reasonable)
    if (cleaned.startsWith('8') && cleaned.length >= 9 && cleaned.length <= 13) {
        cleaned = '62' + cleaned;
    }

    return cleaned;
};

module.exports = { formatPhoneForWA };
