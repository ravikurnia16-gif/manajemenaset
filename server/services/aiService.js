const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || "AIzaSyB5yIYc_N_1KyW6DNWNzshFBQUrupvjszY");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

/**
 * Analyze damage from photo, title, and description using Gemini
 * @param {string|null} base64Image - Base64 string of the image OR a URL OR null
 * @param {string} title - User's report title
 * @param {string} description - User's description of the damage
 * @returns {Promise<Object>} - Analysis result
 */
exports.analyzeDamage = async (base64Image, title, description) => {
    try {
        // API Key is pre-configured with fallback at line 7

        let cleanBase64 = null;

        if (base64Image) {
            let finalBase64 = base64Image;

            // If it's a URL (starts with http), fetch the image and convert to Base64
            if (base64Image.startsWith('http')) {
                try {
                    const response = await axios.get(base64Image, { responseType: 'arraybuffer' });
                    finalBase64 = Buffer.from(response.data, 'binary').toString('base64');
                } catch (fetchErr) {
                    console.error("AI Service: Failed to fetch image from URL:", fetchErr.message);
                    // Continue with text-only if image fetch fails
                }
            }

            if (finalBase64 && finalBase64.length > 50) {
                cleanBase64 = finalBase64.replace(/^data:image\/\w+;base64,/, "");
            }
        }

        const prompt = `
            Anda adalah pakar pemeliharaan aset dan teknisi profesional berpengalaman.
            Tugas Anda adalah menganalisis laporan kerusakan aset berikut:
            - Judul: "${title}"
            - Keluhan Pengguna/Deskripsi: "${description}"
            ${cleanBase64 ? "- [Foto Kerusakan Tersedia]" : "- [Tidak ada foto, analisis berdasarkan teks saja]"}
            
            Berikan analisis mendalam dalam format JSON murni:
            {
                "analysis": "Analisis teknis singkat mengenai apa yang kemungkinan besar rusak serta penyebabnya berdasarkan konteks judul dan deskripsi${cleanBase64 ? " dan penampakan visual pada foto" : ""}.",
                "severity": 1-10 (1 aman/estetika saja, 10 sangat kritis/berbahaya/rusak total),
                "suggestedAction": "Langkah perbaikan konkret.",
                "estimatedCost": "Estimasi rentang biaya perbaikan dalam Rupiah.",
                "isSafetyHazard": true/false (Apakah ini membahayakan?),
                "technicianType": "Internal" // atau "Eksternal/Vendor"
            }
        `;

        const contentParts = [prompt];
        if (cleanBase64) {
            contentParts.push({
                inlineData: {
                    data: cleanBase64,
                    mimeType: "image/jpeg"
                }
            });
        }

        const result = await model.generateContent(contentParts);

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
