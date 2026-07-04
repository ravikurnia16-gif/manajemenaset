const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * AI Service for generating narrative summaries and chat responses using Gemini.
 */
class AIService {
    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
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
     * @param {string} senderPhone - Optional phone number of sender.
     * @returns {Promise<string>}
     */
    async generateChatResponse(userMessage, groupName = null, senderPhone = null) {
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
                            keyword: { type: "STRING", description: "Pencarian nama kendaraan, plat, atau tipe. Isi dengan string kosong '' jika mencari semua kendaraan." }
                        }
                    }
                },
                {
                    name: "cari_data_aset_barang",
                    description: "Membaca data inventaris/barang umum, lokasi ruangan, dan kondisinya.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            keyword: { type: "STRING", description: "Kata kunci nama barang atau kode. Isi dengan string kosong '' jika mencari semua barang." }
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
                            keyword: { type: "STRING", description: "Nama kendaraan atau plat nomor. Isi dengan string kosong '' jika mencari semua." }
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
                            keyword: { type: "STRING", description: "Nama kendaraan. Isi dengan string kosong '' jika mencari jadwal semua kendaraan." }
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
                },
                {
                    name: "cari_data_pemeliharaan",
                    description: "Membaca data laporan pemeliharaan/maintenance umum (gedung, AC, aset).",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            status: { type: "STRING", description: "Status: PENDING, IN_PROGRESS, COMPLETED. Isi string kosong '' jika semua status." }
                        },
                        required: ["status"]
                    }
                },
                {
                    name: "buat_pengajuan_peminjaman_mobil",
                    description: "Membuat draf pengajuan peminjaman mobil (VehicleBooking) dengan status PENDING.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            vehicleId: { type: "NUMBER", description: "ID kendaraan di database" },
                            tujuan: { type: "STRING", description: "Tujuan peminjaman" },
                            waktuMulai: { type: "STRING", description: "Waktu mulai format YYYY-MM-DDTHH:mm:ssZ" },
                            waktuSelesai: { type: "STRING", description: "Waktu selesai format YYYY-MM-DDTHH:mm:ssZ" }
                        },
                        required: ["vehicleId", "tujuan", "waktuMulai", "waktuSelesai"]
                    }
                },
                {
                    name: "kirim_file_excel",
                    description: "Men-generate data JSON menjadi file Excel (.xlsx) dan mengirimkannya sebagai lampiran WhatsApp.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            dataJsonString: { type: "STRING", description: "Stringify JSON array dari data yang akan direkap (misal hasil dari query_database_bebas)." },
                            namaFile: { type: "STRING", description: "Nama file Excel, misal 'Rekap_Peminjaman.xlsx'" }
                        },
                        required: ["dataJsonString", "namaFile"]
                    }
                },
                {
                    name: "approve_reject_request",
                    description: "Menyetujui atau menolak pengajuan. WAJIB mengecek role pengirim. HANYA ROLE TINGGI YANG BISA MEMANGGIL INI.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            tabel: { type: "STRING", description: "Nama tabel: 'VehicleBooking' atau 'Maintenance'" },
                            idPengajuan: { type: "NUMBER", description: "ID pengajuan di database" },
                            statusBaru: { type: "STRING", description: "'APPROVED' atau 'REJECTED' atau 'COMPLETED'" }
                        },
                        required: ["tabel", "idPengajuan", "statusBaru"]
                    }
                },
                {
                    name: "query_database_bebas",
                    description: "Membaca data dari SELURUH tabel di database secara dinamis menggunakan Prisma ORM. Gunakan HANYA jika pertanyaan user TIDAK BISA dijawab oleh tool-tool spesifik di atas.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            modelName: { type: "STRING", description: "Nama tabel/model di Prisma (misal: 'user', 'asset', 'vehicle', 'procurement', 'unit', dll). Gunakan camelCase standar Prisma." },
                            whereJson: { type: "STRING", description: "Kondisi filter (Prisma where object) dalam format JSON string. Contoh: '{\"name\": {\"contains\": \"laptop\"}}' atau '{}' jika ambil semua." },
                            selectJson: { type: "STRING", description: "Kolom yang diambil (Prisma select object) dalam format JSON string. Contoh: '{\"name\": true, \"status\": true}'. Jangan ambil semua kolom." }
                        },
                        required: ["modelName", "whereJson", "selectJson"]
                    }
                }
            ]
        }];

        const chatModel = this.genAI.getGenerativeModel({
            model: "gemini-3.1-flash-lite",
            tools: tools,
            systemInstruction: `Anda adalah "Admin Sarpras", asisten AI untuk bidang Sarana Prasarana di Yayasan Dar El Iman.
Anda sedang membalas pesan di grup WhatsApp ${groupName ? `"${groupName}"` : ""}.
Waktu saat ini: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB.
PENTING: Tanggal dari database (JSON) menggunakan format UTC (lebih lambat 7 jam dari WIB). Harap konversi otomatis ke WIB di pikiran Anda.

PERINTAH KHUSUS (WAJIB DIPATUHI JIKA USER MENGETIK INI):
- "/cek_kendaraan [nama]" -> WAJIB panggil tool "cari_data_kendaraan".
- "/cek_jadwal [nama]" -> WAJIB panggil tool "cari_status_peminjaman".
- "/cek_servis [nama]" -> WAJIB panggil tool "cari_riwayat_perawatan".
- "/cek_barang [nama]" -> WAJIB panggil tool "cari_data_aset_barang".
- "/cek_staf [nama]" -> WAJIB panggil tool "cari_data_personel".
- "/cek_pemeliharaan [status]" -> WAJIB panggil tool "cari_data_pemeliharaan".
Jika [nama] dikosongkan (contoh hanya mengetik "/cek_jadwal"), set parameter keyword dengan string kosong "" agar menarik semua data.
Pemetaan status database: diajukan=SUBMITTED, disetujui=APPROVED, diproses=IN_PROGRESS, selesai=COMPLETED, ditolak=REJECTED.

KEAMANAN PRIVASI: JANGAN PERNAH menyebarkan Password, NIP, atau Email pengguna kecuali benar-benar relevan atau diminta dengan tujuan jelas.

AKSES GLOBAL DATABASE: Anda memiliki akses ke SELURUH database. Jika pesan berupa pertanyaan biasa tentang data (tanpa garis miring), tetap gunakan Tools yang relevan.
Jika pesan berupa sapaan, obrolan santai, atau pertanyaan pengetahuan umum yang TIDAK memerlukan data dari database, Anda BEBAS menjawabnya secara langsung dengan natural dan ramah layaknya ChatGPT, tanpa memanggil tool. Jika user menanyakan data spesifik yang tidak bisa dijawab oleh "Perintah Khusus" di atas (misalnya data Vendor, Unit, Ruangan, Pengadaan, dll), Anda WAJIB menggunakan tool "query_database_bebas".

Jawaban Anda harus ramah, sopan, dan jelas. Jika data kosong/tidak ada, sampaikan dengan baik.
Gunakan formatting WhatsApp (seperti *tebal* atau _miring_). Jangan gunakan markdown seperti # atau **.`
        });

        const chat = chatModel.startChat();

        try {
            let result = await chat.sendMessage(userMessage);
            const calls = result.response.functionCalls();
            
            let mediaAttachment = null;
            let currentUser = null;
            if (senderPhone) {
                const p1 = senderPhone.split('@')[0];
                const p2 = p1.replace(/^62/, '0');
                currentUser = await prisma.user.findFirst({ where: { OR: [{ phone: p1 }, { phone: p2 }] } });
            }

            if (calls && calls.length > 0) {
                const call = calls[0]; // Process first function call
                let apiResponse = { status: "success", data: null };
                console.log(`[AIService] Tool called: ${call.name} with args`, call.args);
                
                if (call.name === "buat_pengajuan_peminjaman_mobil") {
                    if (!currentUser) {
                        apiResponse = { status: "error", message: "Maaf, nomor HP Anda belum terdaftar di sistem. Anda tidak bisa mengajukan form." };
                    } else {
                        try {
                            const newBooking = await prisma.vehicleBooking.create({
                                data: {
                                    vehicleId: call.args.vehicleId,
                                    userId: currentUser.id,
                                    startDate: new Date(call.args.waktuMulai),
                                    endDate: new Date(call.args.waktuSelesai),
                                    destination: call.args.tujuan,
                                    purpose: call.args.tujuan,
                                    status: "PENDING"
                                }
                            });
                            apiResponse = { status: "success", message: "Pengajuan berhasil dibuat", data: newBooking };
                        } catch (e) {
                            apiResponse = { status: "error", message: `Gagal membuat pengajuan: ${e.message}` };
                        }
                    }
                } 
                else if (call.name === "kirim_file_excel") {
                    try {
                        const parsedData = JSON.parse(call.args.dataJsonString);
                        if (!Array.isArray(parsedData) || parsedData.length === 0) {
                            apiResponse = { status: "error", message: "Data kosong atau format JSON salah." };
                        } else {
                            const XLSX = require('xlsx');
                            const ws = XLSX.utils.json_to_sheet(parsedData);
                            const wb = XLSX.utils.book_new();
                            XLSX.utils.book_append_sheet(wb, ws, "Rekap");
                            const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
                            
                            mediaAttachment = {
                                buffer: buffer.toString('base64'),
                                filename: call.args.namaFile.endsWith('.xlsx') ? call.args.namaFile : `${call.args.namaFile}.xlsx`,
                                mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                            };
                            apiResponse = { status: "success", message: `File ${mediaAttachment.filename} berhasil di-generate dan siap dikirim.` };
                        }
                    } catch (e) {
                        apiResponse = { status: "error", message: `Gagal parse JSON atau generate Excel: ${e.message}` };
                    }
                }
                else if (call.name === "approve_reject_request") {
                    if (!currentUser) {
                        apiResponse = { status: "error", message: "Akses ditolak: Anda tidak terdaftar." };
                    } else if (!["ADMIN_ASET", "SUPER_ADMIN", "KABID_SARPRAS", "KEPALA_BIDANG"].includes(currentUser.role)) {
                        apiResponse = { status: "error", message: `Akses ditolak: Jabatan Anda (${currentUser.role}) tidak memiliki wewenang untuk menyetujui pengajuan.` };
                    } else {
                        try {
                            const { tabel, idPengajuan, statusBaru } = call.args;
                            if (tabel === 'VehicleBooking') {
                                const res = await prisma.vehicleBooking.update({ where: { id: idPengajuan }, data: { status: statusBaru } });
                                apiResponse = { status: "success", message: `VehicleBooking ID ${idPengajuan} berhasil diupdate jadi ${statusBaru}.`, data: res };
                            } else if (tabel === 'Maintenance') {
                                const res = await prisma.maintenance.update({ where: { id: idPengajuan }, data: { status: statusBaru } });
                                apiResponse = { status: "success", message: `Maintenance ID ${idPengajuan} berhasil diupdate jadi ${statusBaru}.`, data: res };
                            } else {
                                apiResponse = { status: "error", message: `Tabel ${tabel} tidak dikenal.` };
                            }
                        } catch (e) {
                            apiResponse = { status: "error", message: `Gagal update data: ${e.message}` };
                        }
                    }
                }
                else if (call.name === 'cari_data_kendaraan') {
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
                    const kw = call.args.keyword || "";
                    apiResponse.data = await prisma.vehicleService.findMany({
                        where: { OR: [ { vehicle: { name: { contains: kw } } }, { vehicle: { plateNumber: { contains: kw } } } ] },
                        select: { vehicle: { select: { name: true, plateNumber: true } }, type: true, date: true, cost: true, description: true },
                        orderBy: { date: 'desc' },
                        take: 10
                    });
                }
                else if (call.name === 'cari_status_peminjaman') {
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    apiResponse.data = await prisma.vehicleBooking.findMany({
                        where: { vehicle: { name: { contains: call.args.keyword || "" } }, endDate: { gte: today } },
                        select: { vehicle: { select: { name: true, plateNumber: true } }, user: { select: { name: true } }, startDate: true, endDate: true, status: true, destination: true },
                        orderBy: { startDate: 'asc' },
                        take: 10
                    });
                }
                else if (call.name === 'cari_data_personel') {
                    apiResponse.data = await prisma.user.findMany({
                        where: { name: { contains: call.args.name || "" } },
                        select: { name: true, position: true, phone: true, unit: { select: { name: true } } },
                        take: 5
                    });
                }
                else if (call.name === 'cari_data_pemeliharaan') {
                    const kw = call.args.keyword || "";
                    const st = call.args.status || "";
                    
                    let whereCondition = { OR: [ { title: { contains: kw } }, { description: { contains: kw } } ] };
                    if (st) {
                        whereCondition.status = st;
                    }
                    
                    apiResponse.data = await prisma.maintenance.findMany({
                        where: whereCondition,
                        select: { code: true, title: true, description: true, status: true, type: true, user: { select: { name: true } } },
                        orderBy: { id: 'desc' },
                        take: 10
                    });
                }
                else if (call.name === 'query_database_bebas') {
                    try {
                        const modelName = call.args.modelName;
                        const where = call.args.whereJson ? JSON.parse(call.args.whereJson) : {};
                        const select = call.args.selectJson ? JSON.parse(call.args.selectJson) : {};
                        
                        if (prisma[modelName]) {
                            const queryArgs = {
                                where: Object.keys(where).length > 0 ? where : undefined,
                                take: 20
                            };
                            if (Object.keys(select).length > 0) {
                                queryArgs.select = select;
                            }
                            
                            apiResponse.data = await prisma[modelName].findMany(queryArgs);
                        } else {
                            apiResponse.status = "error";
                            apiResponse.message = `Tabel '${modelName}' tidak ditemukan di Prisma. Gunakan camelCase.`;
                        }
                    } catch (e) {
                        apiResponse.status = "error";
                        apiResponse.message = `Error saat mengeksekusi query dinamis: ${e.message}`;
                        console.error("[AIService] Dynamic Query Error:", e);
                    }
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
            
            if (mediaAttachment) {
                return {
                    text: responseText,
                    media: mediaAttachment
                };
            }
            
            return responseText;

        } catch (err) {
            console.error("[AIService] Error generating chat response:", err.message);
            try { await prisma.$disconnect(); } catch (e) {}
            return "Maaf, Admin Sarpras sedang mengalami sedikit gangguan sistem saat ini 🙏";
        }
    }
    /**
     * Parse natural language into structured JSON filters for Semantic Asset Search.
     * @param {string} userQuery - The natural language query
     * @returns {Promise<Object>} - The parsed filters { keywords, categoryName, roomName, condition }
     */
    async parseSemanticAssetSearch(userQuery) {
        if (!this.model) {
            throw new Error("AI Service is not configured (missing API Key)");
        }

        const prompt = `
            Anda adalah AI parser untuk sistem inventaris/manajemen aset.
            Tugas Anda adalah mengubah kueri pencarian bahasa alami menjadi JSON terstruktur murni tanpa markdown.
            Kueri: "${userQuery}"

            Ekstrak ke format JSON berikut:
            {
                "keywords": ["array", "kata benda", "merk", "atau", "spesifikasi", "yang", "dicari"],
                "categoryName": "Kategori barang jika disebutkan eksplisit (misal 'Elektronik', 'Kendaraan', 'Mebel'), atau biarkan kosong",
                "roomName": "Nama ruangan atau gedung jika disebutkan (misal 'IT', 'Rapat', 'Gudang'), atau biarkan kosong",
                "condition": "Salah satu dari: 'BAIK', 'RUSAK_RINGAN', 'RUSAK_BERAT', 'HILANG', 'DISPOSED' jika disebutkan, atau kosong"
            }

            Panduan:
            - "keywords" harus berisi kata kunci penting yang mungkin cocok dengan nama barang, merek, atau spesifikasi. (Contoh: "laptop tipis asus" -> ["laptop", "tipis", "asus"]).
            - Abaikan kata sambung seperti "yang", "ada", "di".
            - Hanya berikan JSON murni. Jangan tambahkan \`\`\`json.
        `;

        try {
            const result = await this.model.generateContent(prompt);
            const responseText = result.response.text().trim();
            // Membersihkan backticks jika masih ada
            const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '');
            return JSON.parse(cleanJson);
        } catch (err) {
            console.error("[AIService] Error parsing semantic search:", err.message);
            // Fallback: return standard keyword extraction
            return {
                keywords: userQuery.split(" ").filter(w => w.length > 2),
                categoryName: "",
                roomName: "",
                condition: ""
            };
        }
    }
}

module.exports = new AIService();
