const axios = require('axios');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { formatPhoneForWA } = require('../utils/phoneFormatter');
const qrcode = require('qrcode');

const WHATSAPP_API_URL = 'https://bidang-sarana-wawebjs.ltdh6w.easypanel.host/api/send-message';

// --- LOCAL WHATSAPP CLIENT STATE ---
let waClient = null;
let connectionStatus = 'DISCONNECTED'; // DISCONNECTED, SCAN_QR, CONNECTED
let qrCodeData = null;

// Initialize WhatsApp Client
const initializeWhatsApp = () => {
    if (waClient) {
        waClient.destroy().catch(console.error);
    }
    
    connectionStatus = 'INITIALIZING';
    qrCodeData = null;
    
    const puppeteerConfig = {
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    };

    if (process.env.CHROME_BIN) {
        puppeteerConfig.executablePath = process.env.CHROME_BIN;
    } else if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        puppeteerConfig.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    } else if (process.platform === 'linux') {
        // Fallback common paths for linux/docker (Debian/Ubuntu)
        puppeteerConfig.executablePath = '/usr/bin/chromium';
    }

    waClient = new Client({
        authStrategy: new LocalAuth({
            dataPath: './.wwebjs_auth'
        }),
        puppeteer: puppeteerConfig
    });

    waClient.on('qr', async (qr) => {
        console.log('[WhatsApp Local] Need to scan QR code');
        try {
            qrCodeData = await qrcode.toDataURL(qr); // Save base64 QR image
            connectionStatus = 'SCAN_QR';
        } catch (err) {
            console.error('Failed to generate QR data URL', err);
        }
    });

    waClient.on('ready', () => {
        console.log('[WhatsApp Local] Client is READY!');
        connectionStatus = 'CONNECTED';
        qrCodeData = null;
    });

    waClient.on('authenticated', () => {
        console.log('[WhatsApp Local] Authenticated');
    });

    waClient.on('auth_failure', msg => {
        console.error('[WhatsApp Local] Authentication failure', msg);
        connectionStatus = 'DISCONNECTED';
    });

    // AI BOT Message Listener
    waClient.on('message', async (msg) => {
        try {
            // Check if from allowed group
            if (!msg.from.endsWith('@g.us')) return; // Only process group messages

            const allowedGroupsRaw = process.env.AI_ALLOWED_GROUPS || "";
            const allowedGroups = allowedGroupsRaw.split(',').map(g => g.trim());
            if (!allowedGroups.includes(msg.from)) return; // Not an allowed group

            // Check trigger: starts with "admin", "min", or mentions "@admin"
            const triggerRegex = /^(admin|min|\@admin)\b/i;
            const isMentioned = msg.mentionedIds && msg.mentionedIds.includes(waClient.info.wid._serialized);
            
            if (triggerRegex.test(msg.body) || isMentioned) {
                console.log(`[WhatsApp Local AI] Trigger matched in group ${msg.from}. Generating response...`);
                
                // Remove the trigger word from the message to clean it up for the AI
                let cleanMessage = msg.body.replace(triggerRegex, '').trim();
                
                // Get chat info to fetch group name
                const chat = await msg.getChat();
                const groupName = chat.name || "Grup";

                // Generate response
                const aiService = require('./aiService');
                const response = await aiService.generateChatResponse(cleanMessage || msg.body, groupName);

                // Reply
                await msg.reply(response);
                console.log(`[WhatsApp Local AI] Replied to ${msg.from}`);
            }
        } catch (error) {
            console.error('[WhatsApp Local AI] Error handling message:', error);
        }
    });

    waClient.on('disconnected', (reason) => {
        console.log('[WhatsApp Local] Client was disconnected', reason);
        connectionStatus = 'DISCONNECTED';
        qrCodeData = null;
    });

    console.log('[WhatsApp Local] Initializing client...');
    waClient.initialize().catch(err => {
        console.error('[WhatsApp Local] Failed to initialize:', err);
        connectionStatus = 'DISCONNECTED';
    });
};

// Start initialization automatically
initializeWhatsApp();

// --- EXPOSED METHODS FOR API ---
exports.getWhatsAppStatus = () => {
    return {
        status: connectionStatus,
        qr: qrCodeData
    };
};

exports.logoutWhatsApp = async () => {
    if (waClient && connectionStatus === 'CONNECTED') {
        await waClient.logout();
        connectionStatus = 'DISCONNECTED';
        qrCodeData = null;
        // Re-initialize to get a new QR code after logging out
        setTimeout(initializeWhatsApp, 2000); 
    }
    return { status: 'DISCONNECTED' };
};

exports.reinitializeWhatsApp = () => {
    initializeWhatsApp();
    return { status: 'INITIALIZING' };
};


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
            let formattedPhone = phoneNumber;
            if (!phoneNumber.includes('@')) {
                formattedPhone = formatPhoneForWA(phoneNumber);
            }
            
            // MAIN LANE (Local whatsapp-web.js)
            let sentLocally = false;
            if (connectionStatus === 'CONNECTED' && waClient) {
                try {
                    // wa-web.js format uses @c.us for numbers
                    const waWebJsPhone = formattedPhone.includes('@') ? formattedPhone : `${formattedPhone}@c.us`;
                    await waClient.sendMessage(waWebJsPhone, message);
                    console.log(`[WhatsApp Local] Sent success to ${waWebJsPhone}: ${message.substring(0, 30)}...`);
                    sentLocally = true;
                } catch (localErr) {
                    console.error(`[WhatsApp Local Error] Failed to send to ${formattedPhone}, falling back to Backup Lane. Error:`, localErr.message);
                }
            }

            // BACKUP LANE (External API)
            if (!sentLocally) {
                console.log(`[WhatsApp Backup] Using external API for ${formattedPhone}...`);
                await axios.post(WHATSAPP_API_URL, {
                    number: formattedPhone,
                    message: message
                }, {
                    headers: { 'Content-Type': 'application/json' }
                });
                console.log(`[WhatsApp Backup] Sent success to ${formattedPhone}: ${message.substring(0, 30)}...`);
            }

            lastSentTime = Date.now(); // Update last success time
            resolve({ status: 'sent', lane: sentLocally ? 'local' : 'backup' });
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
 * Resolved immediately after queuing to avoid blocking API responses
 */
exports.sendMessage = (phoneNumber, message) => {
    if (!phoneNumber) return Promise.resolve(null);

    // Create a background promise for the queue item
    // but the function itself returns a resolved promise to the caller
    messageQueue.push({ 
        phoneNumber, 
        message, 
        resolve: (data) => { /* Background resolve */ }, 
        reject: (err) => { /* Background reject */ } 
    });

    // Fire and forget processing
    processQueue();
    
    // Resolve immediately for the caller so they don't wait for MIN_INTERVAL
    return Promise.resolve({ status: 'queued' });
};