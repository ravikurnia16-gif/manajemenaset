const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const whatsappService = require('./whatsappService');

// Cache templates for 5 minutes to avoid constant DB hits
let templateCache = {};
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const loadTemplates = async () => {
    const now = Date.now();
    if (now - cacheTimestamp < CACHE_TTL && Object.keys(templateCache).length > 0) {
        return templateCache;
    }

    try {
        const templates = await prisma.waNotificationTemplate.findMany();
        templateCache = {};
        for (const t of templates) {
            templateCache[t.slug] = t;
        }
        cacheTimestamp = now;
    } catch (err) {
        console.error('[WA Template Service] Failed to load templates:', err.message);
    }
    return templateCache;
};

// Clear cache (called after template updates)
const clearCache = () => {
    templateCache = {};
    cacheTimestamp = 0;
};

// Replace {{variable}} placeholders with actual data
const formatContent = (content, vars = {}) => {
    return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : match;
    });
};

/**
 * Send a templated WhatsApp message.
 * 
 * @param {string} slug - Template slug identifier
 * @param {string} phone - Recipient phone number
 * @param {object} vars - Variables to replace in template
 * @param {string|null} fallbackMsg - Fallback message if template not found in DB
 * @returns {boolean} - Whether message was sent
 */
const send = async (slug, phone, vars = {}, fallbackMsg = null) => {
    if (!phone) return false;

    try {
        const templates = await loadTemplates();
        const template = templates[slug];

        // Template exists but is INACTIVE → skip sending
        if (template && !template.isActive) {
            console.log(`[WA Template] Skipped "${slug}" - template is inactive`);
            return false;
        }

        // Template exists and is ACTIVE → use template content
        if (template && template.isActive) {
            let expectsVars = false;
            try {
                const available = JSON.parse(template.availableVars || '[]');
                expectsVars = available.length > 0;
            } catch (e) {
                expectsVars = false;
            }

            // Failsafe: Jika template butuh variabel, tapi controller tidak mengirim variabel apapun {}.
            // Ini berarti controller belum di-update ke sistem baru. Kita gunakan `fallbackMsg`.
            if (expectsVars && Object.keys(vars).length === 0 && fallbackMsg) {
                await whatsappService.sendMessage(phone, fallbackMsg);
                return true;
            }

            const msg = formatContent(template.content, vars);
            await whatsappService.sendMessage(phone, msg);
            return true;
        }

        // Template not in DB → use fallback message (original hardcoded)
        if (fallbackMsg) {
            await whatsappService.sendMessage(phone, fallbackMsg);
            return true;
        }

        return false;
    } catch (err) {
        console.error(`[WA Template] Error sending "${slug}":`, err.message);
        // Attempt fallback on error
        if (fallbackMsg) {
            try {
                await whatsappService.sendMessage(phone, fallbackMsg);
                return true;
            } catch (e) {
                console.error(`[WA Template] Fallback also failed:`, e.message);
            }
        }
        return false;
    }
};

/**
 * Check if a specific notification slug is active.
 * Returns true if template doesn't exist (default = active).
 */
const isActive = async (slug) => {
    try {
        const templates = await loadTemplates();
        const template = templates[slug];
        if (!template) return true; // Not in DB = active by default
        return template.isActive;
    } catch {
        return true; // On error, default to active
    }
};

module.exports = {
    send,
    isActive,
    formatContent,
    clearCache
};
