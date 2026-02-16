const axios = require('axios');

const WHATSAPP_API_URL = 'https://bidang-sarana-wawebjs.ltdh6w.easypanel.host/api/send-message';

// --- STAGGERED QUEUE SYSTEM ---
let messageQueue = [];
let isProcessing = false;

/**
 * Worker that processes the queue one by one with delays
 */
const processQueue = async () => {
    if (isProcessing || messageQueue.length === 0) return;

    isProcessing = true;
    console.log(`[WhatsApp Queue] Starting output worker. ${messageQueue.length} message(s) pending.`);

    while (messageQueue.length > 0) {
        const { phoneNumber, message, resolve, reject } = messageQueue.shift();

        try {
            // 1. Format Phone Number
            let formattedPhone = phoneNumber;
            if (!phoneNumber.includes('@g.us')) {
                formattedPhone = phoneNumber.replace(/\D/g, '');
                if (formattedPhone.startsWith('0')) {
                    formattedPhone = '62' + formattedPhone.substring(1);
                }
            }

            // 2. Send Request
            const response = await axios.post(WHATSAPP_API_URL, {
                number: formattedPhone,
                message: message
            }, {
                headers: { 'Content-Type': 'application/json' }
            });

            console.log(`[WhatsApp] Sent success to ${formattedPhone}: ${message.substring(0, 30)}...`);
            resolve(response.data);
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message;
            console.error(`[WhatsApp Error] Target: ${phoneNumber} | Msg: ${errorMsg}`);
            resolve(null); // Resolve with null to avoid breaking the queue
        }

        // 3. Stagger: Wait 30-60 seconds before next message if queue not empty
        if (messageQueue.length > 0) {
            const delay = Math.floor(Math.random() * (60000 - 30000 + 1)) + 30000;
            console.log(`[WhatsApp Queue] Waiting ${Math.round(delay / 1000)}s before next message...`);
            await new Promise(r => setTimeout(r, delay));
        }
    }

    isProcessing = false;
    console.log('[WhatsApp Queue] Worker finished. Queue empty.');
};

/**
 * Public sendMessage function (now queues messages)
 */
exports.sendMessage = (phoneNumber, message) => {
    if (!phoneNumber) return Promise.resolve(null);

    return new Promise((resolve, reject) => {
        // Add to queue
        messageQueue.push({ phoneNumber, message, resolve, reject });

        // Start processing if not already
        processQueue();
    });
};