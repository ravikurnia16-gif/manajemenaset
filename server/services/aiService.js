const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * AI Service for generating narrative summaries and chat responses using Gemini.
 */
class AIService {
    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
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

        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();

        const tools = [{
            functionDeclarations: [
                {
                    name: "cari_data_kendaraan",
                    description: "Membaca data ketersediaan, tipe, plat nomor, status BBM, & odometer kendaraan.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            keyword: { type: "STRING", description: "Pencarian nama kendaraan, plat, atau tipe." }
                        }
                    }
                },
                {
                    name: "cari_data_aset_barang",
                    description: "Membaca data inventaris/barang umum, lokasi ruangan, dan kondisinya.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            keyword: { type: "STRING", description: "Kata kunci nama barang atau kode." }
                        },
                        required: ["keyword"]
                    }
                },
                {
                    name: "cari_riwayat_perawatan",
                    description: "Membaca data servis, perawatan, atau kerusakan pada kendaraan dan aset.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            keyword: { type: "STRING", description: "Nama kendaraan atau plat nomor." }
                        },
                        required: ["keyword"]
                    }
                },
                {
                    name: "cari_status_peminjaman",
                    description: "Membaca jadwal peminjaman kendaraan (Vehicle Booking) untuk mengetahui siapa peminjamnya.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            keyword: { type: "STRING", description: "Nama kendaraan yang ingin dicek." }
                        },
                        required: ["keyword"]
                    }
                },
                {
                    name: "cari_data_personel",
                    description: "Membaca data staf/user (jabatan, unit kerja, kontak).",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            name: { type: "STRING", description: "Nama personel atau staf yang dicari." }
                        },
                        required: ["name"]
                    }
                }
            ]
        }];

        const chatModel = this.genAI.getGenerativeModel({
            model: "gemini-2.0-flash-lite",
            tools: tools,
            systemInstruction: `Anda adalah "Admin Sarpras", asisten AI untuk bidang Sarana Prasarana di Yayasan Dar El Iman.
Anda sedang membalas pesan di grup WhatsApp ${groupName ? `"${groupName}"` : ""}.
Jika pesan bertanya tentang data (kendaraan, barang, servis, peminjaman, personel), SELALU gunakan Tools (Fungsi) yang tersedia sebelum menjawab.
Jawaban Anda harus selalu singkat, padat, ramah dan jelas. 
Gunakan formatting WhatsApp (seperti *tebal* atau _miring_). Jangan gunakan markdown seperti # atau **.`
        });

        const chat = chatModel.startChat();

        try {
            let result = await chat.sendMessage(userMessage);
            const calls = result.response.functionCalls();
            
            if (calls && calls.length > 0) {
                const call = calls[0]; // Process first function call
                let apiResponse = { status: "success", data: null };
                console.log(`[AIService] Tool called: ${call.name} with args`, call.args);
                
                if (call.name === 'cari_data_kendaraan') {
                    const kw = call.args.keyword || "";
                    apiResponse.data = await prisma.vehicle.findMany({
                        where: { OR: [{ name: { contains: kw } }, { plateNumber: { contains: kw } }, { type: { contains: kw } }] },
                        select: { name: true, plateNumber: true, type: true, status: true, lastFuelCondition: true, odometer: true },
                        take: 15
                    });
                } 
                else if (call.name === 'cari_data_aset_barang') {
                    apiResponse.data = await prisma.asset.findMany({
                        where: { name: { contains: call.args.keyword || "" } },
                        select: { name: true, condition: true, room: { select: { name: true } }, category: { select: { name: true } } },
                        take: 15
                    });
                }
                else if (call.name === 'cari_riwayat_perawatan') {
                    apiResponse.data = await prisma.maintenance.findMany({
                        where: { OR: [ { notes: { contains: call.args.keyword || "" } }, { type: { contains: call.args.keyword || "" } } ] },
                        select: { type: true, date: true, cost: true, notes: true, status: true },
                        orderBy: { date: 'desc' },
                        take: 10
                    });
                }
                else if (call.name === 'cari_status_peminjaman') {
                    apiResponse.data = await prisma.vehicleBooking.findMany({
                        where: { vehicle: { name: { contains: call.args.keyword || "" } }, startDate: { gte: new Date() } },
                        select: { vehicle: { select: { name: true, plateNumber: true } }, user: { select: { name: true } }, startDate: true, endDate: true, status: true, destination: true },
                        orderBy: { startDate: 'asc' },
                        take: 5
                    });
                }
                else if (call.name === 'cari_data_personel') {
                    apiResponse.data = await prisma.user.findMany({
                        where: { name: { contains: call.args.name || "" } },
                        select: { name: true, position: true, phone: true, unit: { select: { name: true } } },
                        take: 5
                    });
                }

                // Send function response back to Gemini to get final text
                result = await chat.sendMessage([{
                    functionResponse: {
                        name: call.name,
                        response: { content: apiResponse }
                    }
                }]);
            }

            const responseText = result.response.text();
            await prisma.$disconnect();
            return responseText;

        } catch (err) {
            console.error("[AIService] Error generating chat response:", err.message);
            try { await prisma.$disconnect(); } catch (e) {}
            return "Maaf, Admin Sarpras sedang mengalami sedikit gangguan sistem saat ini 🙏";
        }
    }
}

module.exports = new AIService();
