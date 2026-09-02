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
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 5; // Auto-restart after this many failures

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
        dumpio: false, // Diset false agar log Chromium (seperti dbus error) tidak memenuhi terminal
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--no-first-run',
            '--disable-extensions',
            '--disable-features=dbus',
            '--disable-breakpad',
            '--disable-crash-reporter',
            '--disable-background-networking',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-ipc-flooding-protection',
            '--disable-renderer-backgrounding',
            '--no-zygote',
            '--disable-accelerated-2d-canvas'
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
        puppeteer: puppeteerConfig,
        webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
        }
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
                    try {
                        const chat = await msg.getChat();
                        await msg.reply(`ID Grup "${chat.name}" adalah:\n*${msg.from}*\n\nMasukkan ID ini ke dalam pengaturan AI_ALLOWED_GROUPS (dipisahkan dengan koma jika lebih dari satu) agar Bot aktif di grup ini.`);
                    } catch (chatErr) {
                        console.warn('[WhatsApp Local] getChat() gagal untuk /idgrup:', chatErr.message || chatErr);
                        await msg.reply(`ID Grup ini adalah:\n*${msg.from}*`);
                    }
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
                    // Safely get group name with fallback
                    try {
                        const chat = await msg.getChat();
                        groupName = chat.name || "Grup";
                    } catch (chatErr) {
                        console.warn('[WhatsApp Local] getChat() gagal saat ambil nama grup:', chatErr.message || chatErr);
                        groupName = "Grup"; // Fallback name
                    }
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
                
                // Safely send typing indicator (non-critical)
                try {
                    const chat = await msg.getChat();
                    await chat.sendStateTyping();
                } catch (typingErr) {
                    console.warn('[WhatsApp Local] sendStateTyping gagal (non-critical):', typingErr.message || typingErr);
                }

                // Fetch recent chat history from WhatsApp Chat
                let chatHistory = [];
                let senderDisplayName = "User";
                try {
                    const chat = await msg.getChat();
                    const fetchedMsgs = await chat.fetchMessages({ limit: 15 });
                    
                    if (fetchedMsgs && fetchedMsgs.length > 0) {
                        chatHistory = await Promise.all(fetchedMsgs.map(async (m) => {
                            let sName = "User";
                            if (m.fromMe) {
                                sName = "Admin Sarpras (Bot)";
                            } else {
                                sName = m._data?.notifyName || m.pushname || "";
                                if (!sName) {
                                    try {
                                        const c = await m.getContact();
                                        sName = c.name || c.pushname || c.shortName || c.number || "User";
                                    } catch (e) {
                                        sName = "User";
                                    }
                                }
                            }
                            
                            const timeStr = m.timestamp 
                                ? new Date(m.timestamp * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                                : "";

                            return {
                                id: m.id?._serialized || null,
                                sender: sName,
                                body: m.body ? m.body.trim() : "",
                                isBot: m.fromMe,
                                timestamp: timeStr
                            };
                        }));

                        // Filter out empty messages, commands like /idgrup
                        chatHistory = chatHistory.filter(h => h.body && h.body !== '/idgrup');
                    }
                } catch (histErr) {
                    console.warn('[WhatsApp Local] Warning fetching chat history:', histErr.message || histErr);
                }

                // Get sender name for current message
                try {
                    const contact = await msg.getContact();
                    senderDisplayName = contact.name || contact.pushname || contact.shortName || msg._data?.notifyName || msg.pushname || "User";
                } catch (cErr) {
                    senderDisplayName = msg._data?.notifyName || msg.pushname || "User";
                }

                const senderJid = msg.author || msg.from;
                const aiService = require('./aiService');
                const response = await aiService.generateChatResponse(
                    cleanMessage || msg.body, 
                    isPrivate ? null : groupName, 
                    senderJid,
                    chatHistory,
                    senderDisplayName
                );

                if (response && typeof response === 'object' && response.media) {
                    const { MessageMedia } = require('whatsapp-web.js');
                    const media = new MessageMedia(response.media.mimetype, response.media.buffer, response.media.filename);
                    exports.sendMessage(msg.from, response.text, { media: media, quotedMessageId: msg.id._serialized });
                    console.log(`[WhatsApp Local AI] Queued AI reply (with Document) to ${msg.from}`);
                } else {
                    exports.sendMessage(msg.from, response, { quotedMessageId: msg.id._serialized });
                    console.log(`[WhatsApp Local AI] Queued AI reply to ${msg.from}`);
                }
                
                // Reset error counter on success
                consecutiveErrors = 0;
            }
        } catch (error) {
            consecutiveErrors++;
            console.error(`[WhatsApp Local AI] Error handling message (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, error.message || error);
            
            // Auto-restart WhatsApp client if too many consecutive errors
            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                console.warn('[WhatsApp Local] Terlalu banyak error berturut-turut. Auto-restart dalam 10 detik...');
                consecutiveErrors = 0;
                setTimeout(() => {
                    console.log('[WhatsApp Local] Menjalankan auto-restart...');
                    initializeWhatsApp();
                }, 10000);
            }
        }
    });

    waClient.on('disconnected', (reason) => {
        console.log('[WhatsApp Local] Client was disconnected', reason);
        connectionStatus = 'DISCONNECTED';
        qrCodeData = null;
    });

    console.log('[WhatsApp Local] Initializing client...');
    waClient.initialize().catch(err => {
        console.error('[WhatsApp Local] Failed to initialize:', err.message || err);
        connectionStatus = 'DISCONNECTED';
        
        // If it's a Target closed error or similar severe protocol error, it might be corrupted session
        if (err.message && err.message.includes('Target closed')) {
            console.warn('[WhatsApp Local] Target closed error detected. Auth session might be corrupted. Deleting .wwebjs_auth...');
            try {
                fs.rmSync(path.join(process.cwd(), '.wwebjs_auth'), { recursive: true, force: true });
                console.log('[WhatsApp Local] .wwebjs_auth folder deleted. Will try to reinitialize in 10 seconds...');
                setTimeout(initializeWhatsApp, 10000);
            } catch (rmErr) {
                console.error('[WhatsApp Local] Failed to delete .wwebjs_auth:', rmErr.message);
            }
        }
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
        let groups = [];
        try {
            const chats = await waClient.getChats();
            groups = chats
                .filter(c => c.isGroup)
                .map(g => ({ id: g.id._serialized, name: g.name }));
        } catch (err) {
            console.warn('[WhatsApp Local] getChats() failed, falling back to getContacts():', err.message || err);
            try {
                const contacts = await waClient.getContacts();
                groups = contacts
                    .filter(c => c.isGroup || (c.id && c.id.server === 'g.us'))
                    .map(g => ({ id: g.id._serialized, name: g.name || g.pushname || g.number || 'Unnamed Group' }));
            } catch (contactErr) {
                console.warn('[WhatsApp Local] getContacts() juga gagal:', contactErr.message || contactErr);
                // Return empty rather than crash
            }
        }
        return groups;
    } catch (error) {
        console.error('[WhatsApp Local] Error getting groups:', error.message || error);
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
const MIN_INTERVAL = 1500; // Minimum 1.5 seconds global interval

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
                    let waWebJsPhone = formattedPhone.includes('@') ? formattedPhone : `${formattedPhone}@c.us`;
                    
                    // Jika pesan ke nomor pribadi (bukan grup), validasi dan ambil ID WhatsApp resmi (LID / JID)
                    if (!waWebJsPhone.includes('@g.us')) {
                        try {
                            const numberId = await waClient.getNumberId(formattedPhone);
                            if (numberId && numberId._serialized) {
                                waWebJsPhone = numberId._serialized;
                            } else {
                                console.warn(`[WhatsApp Local] Nomor ${formattedPhone} tidak ditemukan di database WhatsApp.`);
                            }
                        } catch (nidErr) {
                            console.warn(`[WhatsApp Local] Gagal getNumberId untuk ${formattedPhone}:`, nidErr.message);
                        }
                    }

                    // JIKA pesan kosong dari AI, ganti dengan fallback
                    const finalMessage = (!message || message.trim() === '') 
                        ? "Maaf, tidak ada data spesifik yang bisa dirangkum atau AI mengembalikan respon kosong."
                        : message;

                    await waClient.sendMessage(waWebJsPhone, finalMessage, options || {});
                    console.log(`[WhatsApp Local] Sent success to ${waWebJsPhone}`);
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
                    message: message || "Data kosong."
                }, {
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            lastSentTime = Date.now(); // Update last success time
            resolve({ status: 'sent', lane: sentLocally ? 'local' : 'backup' });
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message;
            console.error(`[WhatsApp Error] Target: ${phoneNumber} | Msg: ${errorMsg}`);
            lastSentTime = Date.now(); // Also update on failure to avoid spamming the API
            resolve(null);
        }

        // 3. Stagger: Add a small delay (2s to 4s) if more items exist
        if (messageQueue.length > 0) {
            const staggerMs = Math.floor(Math.random() * (4000 - 2000 + 1)) + 2000;
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
