const axios = require('axios');

const WHATSAPP_API_URL = 'https://bidang-sarana-wawebjs.ltdh6w.easypanel.host/message/send';

exports.sendMessage = async (phoneNumber, message) => {
    try {
        if (!phoneNumber) return;

        // 1. Format Phone Number (08xx -> 628xx)
        let formattedPhone = phoneNumber.replace(/\D/g, ''); // Remove non-digits
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '62' + formattedPhone.substring(1);
        }

        // 2. Send Request
        const response = await axios.post(WHATSAPP_API_URL, {
            phoneNumber: formattedPhone,
            message: message
        });

        console.log(`[WhatsApp] Sent to ${formattedPhone}: ${message.substring(0, 20)}...`);
        return response.data;
    } catch (error) {
        console.error(`[WhatsApp] Failed to send to ${phoneNumber}:`, error.message);
        // We don't throw error to prevent blocking the main process
        return null;
    }
};
