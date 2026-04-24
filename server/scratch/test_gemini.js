const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const testGemini = async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("GEMINI_API_KEY not found in .env");
        return;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = "Berikan satu kalimat salam pendek dalam bahasa Indonesia.";
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        console.log("Gemini Response:", text);
    } catch (err) {
        console.error("Gemini Error:", err.message);
    }
};

testGemini();
