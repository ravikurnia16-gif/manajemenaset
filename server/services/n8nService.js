const axios = require('axios');

/**
 * Service to handle communications with n8n webhooks.
 * This decouples the notification logic from the main application flow.
 */
class N8nService {
    constructor() {
        this.webhookUrl = process.env.N8N_PERSONNEL_WEBHOOK_URL;
    }

    /**
     * Sends a notification payload to the n8n webhook.
     * @param {string} event - The type of event (e.g., 'TASK_ASSIGNED')
     * @param {string} to - The recipient's phone number or identifier
     * @param {object} data - The raw data associated with the event
     * @param {string} fallbackMsg - The pre-formatted message (optional)
     */
    async sendNotification(event, to, data, fallbackMsg = '') {
        if (!this.webhookUrl || this.webhookUrl.includes('your-domain.com')) {
            console.warn(`[n8nService] Webhook URL is not configured. Skipping notification for event: ${event}`);
            return false;
        }

        try {
            const payload = {
                module: 'PERSONNEL',
                event,
                to,
                data,
                fallback_message: fallbackMsg,
                timestamp: new Date().toISOString()
            };

            console.log(`[n8nService] Sending '${event}' notification to n8n...`);
            
            // We use a timeout to ensure the server doesn't hang if n8n is slow
            const response = await axios.post(this.webhookUrl, payload, { timeout: 5000 });
            
            console.log(`[n8nService] Successfully sent to n8n. Status: ${response.status}`);
            return true;
        } catch (error) {
            console.error(`[n8nService] Failed to send to n8n (${event}):`, error.message);
            // We don't throw the error back to the controller to prevent the main process from failing
            return false;
        }
    }
}

module.exports = new N8nService();
