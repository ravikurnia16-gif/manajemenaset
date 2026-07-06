const axios = require('axios');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { formatPhoneForWA } = require('../utils/phoneFormatter');
const qrcode = require('qrcode');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

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
    
    // Hapus file lock sisa (jika browser sebelumnya crash)
    // Mencari secara rekursif karena SingletonLock mungkin ada di subfolder 'Default'
    const cleanLockFiles = (dir) => {
        try {
            if (!fs.existsSync(dir)) return;
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const fullPath = path.join(dir, item);
                try {
                    const stat = fs.lstatSync(fullPath);
                    if (stat.isDirectory()) {
                        cleanLockFiles(fullPath);
                    } else if (item.startsWith('Singleton') || item === 'lockfile') {
                        fs.unlinkSync(fullPath);
                        console.log(`[WhatsApp Local] Menghapus sisa lockfile: ${fullPath}`);
                    }
                } catch (err) {
                    if (item.startsWith('Singleton') || item === 'lockfile') {
                        try { fs.unlinkSync(fullPath); } catch (e) {}
                    }
                }
            }
        } catch (error) {
            console.error('[WhatsApp Local] Error membersihkan lock files:', error.message);
        }
    };

    cleanLockFiles(path.join(process.cwd(), '.wwebjs_auth'));

    connectionStatus = 'INITIALIZING';
    qrCodeData = null;
    
    const puppeteerConfig = {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--no-first-run',
            '--disable-extensions'
        ]
    };

    // Gunakan Chromium sistem di Linux/Docker (wajib untuk server ARM)
    // ENV PUPPETEER_EXECUTABLE_PATH sudah di-set di Dockerfile
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        puppeteerConfig.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    } else if (process.platform === 'linux') {
        puppeteerConfig.executablePath = '/usr/bin/chromium';
    }

    console.log(`[WhatsApp Local] Chromium path: ${puppeteerConfig.executablePath || 'bundled'}`);
    console.log(`[WhatsApp Local] Platform: ${process.platform}, Arch: ${process.arch}`);

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
            // Utility to get group ID easily
            if (msg.body.trim() === '/idgrup') {
                if (msg.from.endsWith('@g.us')) {
                    const chat = await msg.getChat();
                    await msg.reply(`ID Grup "${chat.name}" adalah:\n*${msg.from}*\n\nMasukkan ID ini ke dalam pengaturan AI_ALLOWED_GROUPS (dipisahkan dengan koma jika lebih dari satu) agar Bot aktif di grup ini.`);
                }
                return;
            }

            let isAllowed = false;
            let groupName = null;
            let isPrivate = false;

            if (msg.from.endsWith('@g.us')) {
                // Group logic
                const settings = await prisma.setting.findUnique({ where: { id: 1 } });
                const allowedGroupsRaw = settings?.aiAllowedGroups || process.env.AI_ALLOWED_GROUPS || "";
                const allowedGroups = allowedGroupsRaw.split(',').map(g => g.trim());
                if (allowedGroups.includes(msg.from)) {
                    isAllowed = true;
                    const chat = await msg.getChat();
                    groupName = chat.name || "Grup";
                }
            } else {
                // Private logic (Only check DB Phone)
                isPrivate = true;
                const allowedPrivateNames = ["Ravi Kurnia", "Ringgo Afriwansyah Putra", "Syafriyan", "Rian Yulianto", "Jeri Saputra", "Eldo Darjumeianto Putra"];
                
                const phone1 = msg.from.split('@')[0];
                const phone2 = phone1.replace(/^62/, '0');
                
                const dbUser = await prisma.user.findFirst({
                    where: { OR: [{ phone: phone1 }, { phone: phone2 }] }
                });
                
                if (dbUser && allowedPrivateNames.some(name => (dbUser.name || "").toLowerCase().includes(name.toLowerCase()))) {
                    isAllowed = true;
                }
            }

            if (!isAllowed) return; // Not an allowed group or person

            // Check trigger
            let shouldTrigger = false;
            let cleanMessage = msg.body;

            const triggerRegex = /\b(admin|min|\@admin)\b/i;
            const isMentioned = msg.mentionedIds && msg.mentionedIds.includes(waClient.info.wid._serialized);
            
            // Both Private and Group MUST use trigger word or slash command
            if (triggerRegex.test(msg.body) || isMentioned || msg.body.startsWith('/')) {
                shouldTrigger = true;
                if (!msg.body.startsWith('/')) {
                     cleanMessage = msg.body.replace(triggerRegex, '').trim();
                }
            }
            
            if (shouldTrigger) {
                console.log(`[WhatsApp Local AI] Trigger matched for ${msg.from}. Generating response...`);
                
                const chat = await msg.getChat();
                await chat.sendStateTyping();

                const aiService = require('./aiService');
                const response = await aiService.generateChatResponse(cleanMessage || msg.body, isPrivate ? null : groupName, msg.from);

                if (response && typeof response === 'object' && response.media) {
                    const { MessageMedia } = require('whatsapp-web.js');
                    const media = new MessageMedia(response.media.mimetype, response.media.buffer, response.media.filename);
                    exports.sendMessage(msg.from, response.text, { media: media, quotedMessageId: msg.id._serialized });
                    console.log(`[WhatsApp Local AI] Queued AI reply (with Document) to ${msg.from}`);
                } else {
                    exports.sendMessage(msg.from, response, { quotedMessageId: msg.id._serialized });
                    console.log(`[WhatsApp Local AI] Queued AI reply to ${msg.from}`);
                }
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
const getWhatsAppStatus = () => {
    return {
        status: connectionStatus,
        qr: qrCodeData
    };
};

const getWhatsAppGroups = async () => {
    if (!waClient || connectionStatus !== 'CONNECTED') return [];
    try {
        const chats = await waClient.getChats();
        const groups = chats
            .filter(c => c.isGroup)
            .map(g => ({ id: g.id._serialized, name: g.name }));
        return groups;
    } catch (error) {
        console.error('[WhatsApp Local] Error getting groups', error);
        return [];
    }
}

exports.getWhatsAppStatus = getWhatsAppStatus;
exports.getWhatsAppGroups = getWhatsAppGroups;

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

        const { phoneNumber, message, options, resolve, reject } = messageQueue.shift();

        try {
            let formattedPhone = phoneNumber;
            if (!phoneNumber.includes('@')) {
                formattedPhone = formatPhoneForWA(phoneNumber);
            }
            
            // MAIN LANE (Local whatsapp-web.js)
            let sentLocally = false;
            if (connectionStatus === 'CONNECTED' && waClient) {
                try {
                    // wa-web.js format uses @c.us for numbers, but group uses @g.us
                    const waWebJsPhone = formattedPhone.includes('@') ? formattedPhone : `${formattedPhone}@c.us`;
                    await waClient.sendMessage(waWebJsPhone, message, options || {});
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
exports.sendMessage = (phoneNumber, message, options = {}) => {
    if (!phoneNumber) return Promise.resolve(null);

    // Create a background promise for the queue item
    // but the function itself returns a resolved promise to the caller
    messageQueue.push({ 
        phoneNumber, 
        message, 
        options,
        resolve: (data) => { /* Background resolve */ }, 
        reject: (err) => { /* Background reject */ } 
    });

    // Fire and forget processing
    processQueue();
    
    // Resolve immediately for the caller so they don't wait for MIN_INTERVAL
    return Promise.resolve({ status: 'queued' });
};
/**
 * Trigger a dynamic WA Notification based on rules
 */
exports.triggerWaNotification = async (eventType, data = {}) => {
    try {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        
        // Cek tabel apakah ada
        const rules = await prisma.notificationRule.findMany({
            where: { eventName: eventType, isActive: true }
        });

        for (const rule of rules) {
            if (!rule.targetGroup) continue;

            let finalMessage = rule.messageTpl;
            // Replace templates, e.g. [NAMA] -> data.nama
            for (const key in data) {
                const regex = new RegExp(`\\[${key}\\]`, 'g');
                finalMessage = finalMessage.replace(regex, data[key] || '');
            }

            console.log(`[WA Rule Engine] Firing event ${eventType} to ${rule.targetGroup}`);
            // Menggunakan queue untuk menghindari spamming
            exports.sendMessage(rule.targetGroup, finalMessage);
        }
    } catch (error) {
        // Abaikan jika tabel belum ada (saat migrasi belum push)
        if (error.code === 'P2021' || error.message.includes('does not exist')) {
            console.log(`[WA Rule Engine] Tabel belum ada, abaikan event ${eventType}`);
        } else {
            console.error('[WA Rule Engine] Error:', error.message);
        }
    }
};
