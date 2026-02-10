const axios = require('axios');

const WHATSAPP_API_URL = 'https://bidang-sarana-wawebjs.ltdh6w.easypanel.host/api/send-message';

exports.sendMessage = async (phoneNumber, message) => {
    try {
        if (!phoneNumber) return;

        // 1. Format Phone Number (08xx -> 628xx, remove non-digits)
        // If it's a Group ID (contains @g.us), skip formatting
        let formattedPhone = phoneNumber;

        if (!phoneNumber.includes('@g.us')) {
            formattedPhone = phoneNumber.replace(/\D/g, '');
            if (formattedPhone.startsWith('0')) {
                formattedPhone = '62' + formattedPhone.substring(1);
            }
        }

        // 2. Send Request
        // API Requirement: Body JSON: {"number": "...", "message": "..."}
        const response = await axios.post(WHATSAPP_API_URL, {
            number: formattedPhone, // Key must be 'number'
            message: message
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log(`[WhatsApp] Sent to ${formattedPhone}: ${message.substring(0, 20)}...`);
        return response.data;
    } catch (error) {
        // Enhanced error logging
        const errorMsg = error.response?.data?.message || error.message;
        console.error(`[WhatsApp] Failed to send to ${phoneNumber}:`, errorMsg);
        return null;
    }
};