const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
dotenv.config();

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

/**
 * Analyze damage from photo and description using Gemini Vision
 * @param {string} base64Image - Base64 string of the image
 * @param {string} description - User's description of the damage
 * @returns {Promise<Object>} - Analysis result
 */
exports.analyzeDamage = async (base64Image, description) => {
    try {
        if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_AI_KEY) {
            console.error("AI Service: GEMINI_API_KEY is missing in .env");
            return null;
        }

        // Clean base64 if it has prefix
        const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

        const prompt = `
            Anda adalah pakar pemeliharaan aset dan teknisi profesional berpengalaman.
            Tugas Anda adalah menganalisis foto kerusakan aset dan membandingkannya dengan keluhan pengguna: "${description}".
            
            Berikan analisis mendalam dalam format JSON murni (tanpa markdown):
            {
                "analysis": "Analisis teknis singkat mengenai apa yang kemungkinan besar rusak serta penyebabnya.",
                "severity": 1-10 (1 aman/estetika saja, 10 sangat kritis/berbahaya/rusak total),
                "suggestedAction": "Langkah perbaikan konkret (misal: Ganti sparepart X, kalibrasi ulang, atau servis total).",
                "estimatedCost": "Estimasi rentang biaya perbaikan dalam Rupiah (misal: Rp 200rb - 500rb).",
                "isSafetyHazard": true/false (Apakah kerusakan ini membahayakan pengguna jika tetap digunakan?),
                "technicianType": "Internal" // atau "Eksternal/Vendor"
            }
        `;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: cleanBase64,
                    mimeType: "image/jpeg"
                }
            }
        ]);

        const responseText = result.response.text();
        
        // Remove markdown formatting if AI includes it
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        return JSON.parse(responseText);
    } catch (error) {
        console.error("AI Diagnosis Error:", error);
        return {
            analysis: "Gagal melakukan analisis otomatis. Silakan periksa koneksi API.",
            severity: 0,
            suggestedAction: "Periksa secara manual.",
            error: true
        };
    }
};
