const axios = require('axios');

const WHATSAPP_API_URL = 'https://bidang-sarana-wawebjs.ltdh6w.easypanel.host/api/send-message';
const { formatPhoneForWA } = require('../utils/phoneFormatter');

// --- STAGGERED QUEUE SYSTEM ---
let messageQueue = [];
let isProcessing = false;
let lastSentTime = 0;
const MIN_INTERVAL = 30000; // Minimum 30 seconds global interval

/**
 * Worker that processes the queue one by one with mandatory delays
 */
const processQueue = async () => {
    if (isProcessing || messageQueue.length === 0) return;

    isProcessing = true;
    console.log(`[WhatsApp Queue] Starting output worker. ${messageQueue.length} message(s) pending.`);

    while (messageQueue.length > 0) {
        // Enforce Global Minimum Interval
        const now = Date.now();
        const timeSinceLast = now - lastSentTime;
        if (timeSinceLast < MIN_INTERVAL) {
            const waitTime = MIN_INTERVAL - timeSinceLast;
            console.log(`[WhatsApp Queue] Global cooldown active. Waiting ${Math.round(waitTime / 1000)}s...`);
            await new Promise(r => setTimeout(r, waitTime));
        }

        const { phoneNumber, message, resolve, reject } = messageQueue.shift();

        try {
            // 1. Format Phone Number
            let formattedPhone = phoneNumber;
            if (!phoneNumber.includes('@g.us')) {
                formattedPhone = formatPhoneForWA(phoneNumber);
            }

            // 2. Send Request
            const response = await axios.post(WHATSAPP_API_URL, {
                number: formattedPhone,
                message: message
            }, {
                headers: { 'Content-Type': 'application/json' }
            });

            console.log(`[WhatsApp] Sent success to ${formattedPhone}: ${message.substring(0, 30)}...`);
            lastSentTime = Date.now(); // Update last success time
            resolve(response.data);
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message;
            console.error(`[WhatsApp Error] Target: ${phoneNumber} | Msg: ${errorMsg}`);
            lastSentTime = Date.now(); // Also update on failure to avoid spamming the API
            resolve(null);
        }

        // 3. Stagger: Add a random delay (15s to 60s) if more items exist
        if (messageQueue.length > 0) {
            const staggerMs = Math.floor(Math.random() * (60000 - 15000 + 1)) + 15000;
            console.log(`[WhatsApp Queue] Randomized stagger: ${Math.round(staggerMs / 1000)}s...`);
            await new Promise(r => setTimeout(r, staggerMs));
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