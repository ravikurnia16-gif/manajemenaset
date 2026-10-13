const fs = require('fs');
const path = require('path');

const STORAGE_DIR = path.join(__dirname, '../storage');
const OUTBOX_FILE = path.join(STORAGE_DIR, 'wa_outbox.json');

// Ensure storage directory exists
const ensureStorageDir = () => {
    try {
        if (!fs.existsSync(STORAGE_DIR)) {
            fs.mkdirSync(STORAGE_DIR, { recursive: true });
        }
    } catch (err) {
        console.error('[WA Outbox] Error creating storage dir:', err.message);
    }
};

// Safe read from outbox file
const readOutbox = () => {
    ensureStorageDir();
    try {
        if (!fs.existsSync(OUTBOX_FILE)) {
            fs.writeFileSync(OUTBOX_FILE, JSON.stringify([], null, 2), 'utf-8');
            return [];
        }
        const raw = fs.readFileSync(OUTBOX_FILE, 'utf-8');
        if (!raw || !raw.trim()) return [];
        return JSON.parse(raw);
    } catch (err) {
        console.error('[WA Outbox] Error reading outbox file:', err.message);
        return [];
    }
};

// Safe write to outbox file
const writeOutbox = (data) => {
    ensureStorageDir();
    try {
        // Keep max 500 records to prevent file from growing indefinitely (auto purge sent > 7 days)
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const cleaned = data.filter(item => {
            if (item.status === 'SENT' && item.sentAt) {
                return new Date(item.sentAt).getTime() > sevenDaysAgo;
            }
            return true;
        }).slice(-500);

        fs.writeFileSync(OUTBOX_FILE, JSON.stringify(cleaned, null, 2), 'utf-8');
        return true;
    } catch (err) {
        console.error('[WA Outbox] Error writing outbox file:', err.message);
        return false;
    }
};

/**
 * Add a message to Outbox Basket
 */
const addToOutbox = (phoneNumber, message, options = {}, errorReason = 'WhatsApp Web tidak terhubung') => {
    const list = readOutbox();
    const newItem = {
        id: `wa_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        phoneNumber,
        message: message || '',
        options: options || {},
        status: 'PENDING', // PENDING, SENDING, SENT, FAILED
        attempts: 0,
        lastError: errorReason,
        queuedAt: new Date().toISOString(),
        sentAt: null,
        channel: null
    };

    list.push(newItem);
    writeOutbox(list);
    console.log(`[WA Outbox Basket] Pesan ke ${phoneNumber} disimpan ke Keranjang Outbox (ID: ${newItem.id}). Alasan: ${errorReason}`);
    return newItem;
};

/**
 * Get all pending messages from Outbox Basket
 */
const getPendingMessages = () => {
    const list = readOutbox();
    return list.filter(item => item.status === 'PENDING');
};

/**
 * Get all messages with stats
 */
const getAllMessages = (limit = 100) => {
    const list = readOutbox();
    // Sort by queuedAt descending (newest first)
    const sorted = [...list].sort((a, b) => new Date(b.queuedAt) - new Date(a.queuedAt));
    return sorted.slice(0, limit);
};

/**
 * Get statistics of outbox
 */
const getOutboxStats = () => {
    const list = readOutbox();
    const pending = list.filter(i => i.status === 'PENDING').length;
    const sent = list.filter(i => i.status === 'SENT').length;
    const failed = list.filter(i => i.status === 'FAILED').length;
    return {
        total: list.length,
        pending,
        sent,
        failed
    };
};

/**
 * Mark a message as SENDING
 */
const markAsSending = (id) => {
    const list = readOutbox();
    const item = list.find(i => i.id === id);
    if (item) {
        item.status = 'SENDING';
        item.attempts = (item.attempts || 0) + 1;
        writeOutbox(list);
    }
};

/**
 * Mark a message as SENT
 */
const markAsSent = (id, channel = 'LOCAL') => {
    const list = readOutbox();
    const item = list.find(i => i.id === id);
    if (item) {
        item.status = 'SENT';
        item.sentAt = new Date().toISOString();
        item.channel = channel;
        item.lastError = null;
        writeOutbox(list);
    }
};

/**
 * Mark a message as FAILED (will revert to PENDING if attempts < 5)
 */
const markAsFailed = (id, errorMsg) => {
    const list = readOutbox();
    const item = list.find(i => i.id === id);
    if (item) {
        item.lastError = errorMsg;
        if ((item.attempts || 0) >= 5) {
            item.status = 'FAILED';
        } else {
            item.status = 'PENDING'; // Can be retried
        }
        writeOutbox(list);
    }
};

/**
 * Delete a message from outbox
 */
const deleteFromOutbox = (id) => {
    const list = readOutbox();
    const filtered = list.filter(i => i.id !== id);
    writeOutbox(filtered);
    return true;
};

/**
 * Clear outbox
 */
const clearOutbox = (filter = 'ALL') => {
    if (filter === 'ALL') {
        writeOutbox([]);
        return true;
    }
    const list = readOutbox();
    if (filter === 'SENT') {
        const filtered = list.filter(i => i.status !== 'SENT');
        writeOutbox(filtered);
    } else if (filter === 'PENDING') {
        const filtered = list.filter(i => i.status !== 'PENDING');
        writeOutbox(filtered);
    }
    return true;
};

module.exports = {
    addToOutbox,
    getPendingMessages,
    getAllMessages,
    getOutboxStats,
    markAsSending,
    markAsSent,
    markAsFailed,
    deleteFromOutbox,
    clearOutbox
};
