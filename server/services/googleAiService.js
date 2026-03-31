const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || "AIzaSyD8y8483tOOvxkgSNLb-5UP6PmYE2W6ZCQ");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

/**
 * Generate a professional summary of personnel reports using Google Gemini.
 * @param {Array} reports - List of personnel reports with user and metadata.
 * @param {Object} range - { start, end } date strings.
 * @returns {Promise<string>} - The AI generated summary.
 */
exports.generatePersonnelSummary = async (reports, range) => {
    if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_AI_KEY) {
        throw new Error("GEMINI_API_KEY is not configured in Server Environment Variables.");
    }

    if (!reports || reports.length === 0) {
        return "Tidak ada laporan ditemukan untuk periode ini.";
    }

    // Prepare data for AI context
    const reportData = reports.map(r => ({
        reporter: r.user?.name || r.user?.username || 'Staf',
        date: new Date(r.date).toLocaleDateString('id-ID'),
        activities: r.metadata?.items?.map(it => `${it.name} (${it.qty || it.percentage + '%'})`).join(', ') || r.content,
        category: r.category
    }));

    const prompt = `
        Anda adalah asisten AI profesional untuk Bidang Sarana dan Prasarana (Sarpras).
        Tugas Anda adalah merangkum laporan harian staf berikut menjadi sebuah laporan eksekutif yang matang, berwibawa, dan informatif untuk pimpinan.
        
        DATA LAPORAN (Periode: ${range.start} - ${range.end}):
        ${JSON.stringify(reportData, null, 2)}

        INSTRUKSI KHUSUS:
        1. Gunakan bahasa Indonesia yang formal, sopan, dan profesional.
        2. Berikan salam pembuka yang islami/sopan (Bismillah, Assalamu'alaikum).
        3. Kategorikan berdasarkan nama staf.
        4. Berikan sedikit analisa atau insight (misal: fokus tim minggu ini, kendala yang terlihat, atau pencapaian menonjol).
        5. Format menggunakan Markdown yang rapi (bold, bullet points).
        6. Hindari kesan robotik, buat seolah-olah ditulis oleh sekretaris eksekutif yang cerdas.
        7. Sertakan penutup yang profesional.
        
        RANGKUMAN:
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini AI Error:", error);
        throw new Error("Gagal memproses data melalui Google AI. Pastikan API Key valid.");
    }
};
