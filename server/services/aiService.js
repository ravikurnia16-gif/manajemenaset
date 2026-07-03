const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * AI Service for generating narrative summaries and chat responses using Gemini.
 */
class AIService {
    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
        } else {
            console.warn("[AIService] GEMINI_API_KEY not found. AI features will be unavailable.");
        }
    }

    /**
     * Generate a narrative summary of personnel activities.
     * @param {Object} data - Contains tasks, plans, routines, and dailyLogs.
     * @returns {Promise<string>} - Generated narrative summary.
     */
    async generatePersonnelSummary(data) {
        if (!this.model) {
            throw new Error("AI Service is not configured (missing API Key)");
        }

        const { tasks, plans, routines, dailyLogs } = data;

        const prompt = `
            Anda adalah asisten AI eksekutif untuk Kepala Bidang Sarana.
            Tugas Anda adalah membuat ringkasan naratif (Executive Summary) yang profesional dan informatif berdasarkan data aktivitas tim staf berikut ini.

            DATA AKTIVITAS:
            1. TUGAS (Assignments):
               ${tasks.map(t => `- [${t.status}] ${t.title} (Staf: ${t.assignee?.name || '—'}, Progres: ${t.progressPercentage || 0}%)`).join('\n')}

            2. RENCANA KERJA (Plans):
               ${plans.map(p => `- ${p.metadata?.title || 'Rencana'} (Staf: ${p.user?.name || '—'}, Progres: ${p.metadata?.progressPercentage || 0}%)`).join('\n')}

            3. RUTINITAS (Routines):
               ${routines.map(r => `- ${r.title?.replace('[RUTIN] ', '')} (Staf: ${r.assignee?.name || '—'}, Lokasi: ${r.location || '—'})`).join('\n')}

            4. LAPORAN HARIAN (Daily Logs):
               ${dailyLogs.map(l => `- Staf: ${l.user?.name || '—'}, Kegiatan: ${l.content || 'Laporan rutin'}`).join('\n')}

            TUGAS ANDA:
            Rangkumlah data di atas ke dalam paragraf naratif yang mencakup:
            - Apa saja tugas penting yang sedang dikerjakan tim.
            - Bagaimana progres rencana kerja saat ini.
            - Keberjalanan rutinitas tim.
            - Ringkasan dari laporan harian yang telah dibuat.

            FORMAT:
            Gunakan bahasa Indonesia yang profesional, ringkas, dan jelas. Hindari hanya mengulang list di atas, melainkan buatlah sebuah sintesis yang enak dibaca untuk pimpinan. Maksimal 3 paragraf.
        `;

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (err) {
            console.error("[AIService] Error generating summary:", err.message);
            throw err;
        }
    }

    /**
     * Generate a chat response for WhatsApp Group Bot.
     * @param {string} userMessage - The message from the user.
     * @param {string} groupName - Optional group name for context.
     * @returns {Promise<string>}
     */
    async generateChatResponse(userMessage, groupName = "") {
        if (!this.model) {
            throw new Error("AI Service is not configured (missing API Key)");
        }

        const prompt = `
            Anda adalah "Admin Sarpras", asisten AI untuk bidang Sarana Prasarana (Sarpras) di Yayasan Dar El Iman.
            Anda sedang membalas pertanyaan di sebuah grup WhatsApp ${groupName ? `bernama "${groupName}"` : ""}.
            
            Karakteristik Anda:
            - Anda ramah, responsif, sopan, dan sangat membantu.
            - Jawaban Anda harus selalu singkat, padat, dan jelas karena ini adalah pesan WhatsApp (jangan bertele-tele).
            - Jika ditanya hal di luar Sarpras, jawab dengan ramah tapi beri tahu bahwa fokus Anda adalah administrasi dan sarana prasarana.
            - Gunakan formatting WhatsApp (seperti *tebal* atau _miring_) bila perlu, tapi jangan berlebihan.
            - Jangan memunculkan format markdown yang tidak didukung WhatsApp seperti # atau **. (Untuk tebal gunakan bintang tunggal *teks*).
            
            Pertanyaan / Pesan dari User:
            "${userMessage}"
            
            Balasan Anda:
        `;

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (err) {
            console.error("[AIService] Error generating chat response:", err.message);
            return "Maaf, Admin Sarpras sedang mengalami sedikit gangguan sistem saat ini 🙏";
        }
    }
}

module.exports = new AIService();
