const { GoogleGenerativeAI } = require("@google/generative-ai");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Helper to parse colloquial Indonesian date & time strings
 */
function parseIndoDateTime(str, defaultHour = 8) {
    if (!str) return null;
    const now = dayjs().tz("Asia/Jakarta");
    const s = String(str).toLowerCase().trim();

    // Check ISO or standard formats (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const d = dayjs(s).tz("Asia/Jakarta");
        if (d.isValid()) return d.toDate();
    }

    // Check DD/MM/YYYY or DD-MM-YYYY
    let targetDate = now;
    const dmyMatch = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmyMatch) {
        const day = parseInt(dmyMatch[1], 10);
        const month = parseInt(dmyMatch[2], 10) - 1;
        const year = parseInt(dmyMatch[3], 10);
        targetDate = targetDate.year(year).month(month).date(day);
    } else if (s.includes('lusa')) {
        targetDate = targetDate.add(2, 'day');
    } else if (s.includes('besok')) {
        targetDate = targetDate.add(1, 'day');
    } else if (s.includes('hari ini')) {
        targetDate = now;
    }

    // Parse time / hour & minute
    let hour = defaultHour;
    let minute = 0;

    // Pattern: 08:00, 14.30
    const timeMatch = s.match(/(\d{1,2})[:.](\d{2})/);
    if (timeMatch) {
        hour = parseInt(timeMatch[1], 10);
        minute = parseInt(timeMatch[2], 10);
    } else {
        // Pattern: jam 8, jam 2 siang, jam 7 malam
        const jamMatch = s.match(/jam\s*(\d{1,2})/);
        if (jamMatch) {
            hour = parseInt(jamMatch[1], 10);
            if ((s.includes('siang') || s.includes('sore') || s.includes('malam')) && hour < 12) {
                hour += 12;
            }
        }
    }

    return targetDate.hour(hour).minute(minute).second(0).millisecond(0).toDate();
}

/**
 * AI Service for generating narrative summaries and chat responses using Gemini.
 */
class AIService {
    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        } else {
            console.warn("[AIService] GEMINI_API_KEY not found. AI features will be unavailable.");
        }
    }

    /**
     * Helper to try multiple models if quota exceeds
     */
    async generateContentWithFallback(prompt) {
        if (!this.genAI) throw new Error("AI Service is not configured (missing API Key)");
        const fallbackModels = [
            "gemini-2.5-flash", 
            "gemini-2.0-flash", 
            "gemini-1.5-flash", 
            "gemini-1.5-flash-8b", 
            "gemini-1.5-pro", 
            "gemini-1.0-pro",
            "gemini-pro",
            "gemini-3.5-flash",
            "gemini-3.1-flash",
            "gemini-3.1-flash-lite",
            "gemini-3.0-flash"
        ];
        let lastError = null;
        for (const modelName of fallbackModels) {
            try {
                const model = this.genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent(prompt);
                return result;
            } catch (err) {
                console.warn(`[AIService] Model ${modelName} gagal generateContent: ${err.message}`);
                lastError = err;
            }
        }
        throw new Error(`Semua model Gemini gagal generateContent. Error: ${lastError?.message}`);
    }

    /**
     * Generate a narrative summary of personnel activities.
     * @param {Object} data - Contains tasks, plans, routines, and dailyLogs.
     * @returns {Promise<string>} - Generated narrative summary.
     */
    async generatePersonnelSummary(data) {
        if (!this.genAI) {
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
            const result = await this.generateContentWithFallback(prompt);
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
     * @param {Array} chatHistory - Optional chat history array from WA.
     * @param {string} senderName - Optional name of the sender.
     * @returns {Promise<string|Object>}
     */
    async generateChatResponse(userMessage, groupName = null, senderPhone = null, chatHistory = [], senderName = null) {
        if (!this.model) {
            throw new Error("AI Service is not configured (missing API Key)");
        }

        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();

        // Format history context if provided
        let historyContext = "";
        if (Array.isArray(chatHistory) && chatHistory.length > 0) {
            const historyLines = chatHistory.map(h => {
                const timeTag = h.timestamp ? `[${h.timestamp}] ` : "";
                return `${timeTag}${h.sender}: ${h.body}`;
            });
            historyContext = `\nRIWAYAT CHAT TERAKHIR DI GRUP/PERCAKAPAN INI:\n${historyLines.join('\n')}\n--- (SANGAT PENTING: Gunakan riwayat chat di atas sebagai konteks percakapan sebelumnya. Pahami acuan/kata ganti dari percakapan sebelumnya, dan JANGAN mengulang-ulang informasi/jawaban yang sudah diberikan jika tidak diminta.)\n`;
        }

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
                    description: "Membuat draf pengajuan peminjaman mobil / kendaraan operasional (VehicleBooking) di sistem Manajemen Aset dengan status PENDING. Gunakan tool ini saat user di grup atau chat WhatsApp ingin meminjam kendaraan atau mengirimkan format #PINJAM / /pinjam.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            namaKendaraan: { type: "STRING", description: "Nama, tipe, atau plat nomor kendaraan yang ingin dipinjam (contoh: 'Avanza', 'Innova', 'Hiace', 'Bus', 'Hilux', 'BA 1234 XY')." },
                            vehicleId: { type: "NUMBER", description: "ID kendaraan di database (opsional jika namaKendaraan diisi)" },
                            tujuan: { type: "STRING", description: "Tujuan atau keperluan peminjaman kendaraan (contoh: 'Antar tamu ke Bandara BIM', 'Dinas ke Bukittinggi')" },
                            waktuMulai: { type: "STRING", description: "Waktu mulai peminjaman (contoh: '2026-09-04 08:00', 'besok jam 08:00', 'hari ini jam 13:00')" },
                            waktuSelesai: { type: "STRING", description: "Waktu selesai / pengembalian kendaraan (contoh: '2026-09-04 16:00', 'besok jam 16:00', atau jika tidak disebutkan tentukan jam perkiraan di hari yang sama)" },
                            namaPeminjam: { type: "STRING", description: "Nama peminjam / penanggung jawab (bisa diambil dari nama pengirim chat atau yang tertera di format)" }
                        },
                        required: ["tujuan", "waktuMulai"]
                    }
                },
                {
                    name: "buat_laporan_pemeliharaan",
                    description: "Membuat draf pengajuan perbaikan / pemeliharaan gedung, AC, barang, atau fasilitas baru (Maintenance) dengan status SUBMITTED.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            judul: { type: "STRING", description: "Judul singkat masalah/kerusakan (misal 'AC Rusak Ruang Rapat 2')" },
                            deskripsi: { type: "STRING", description: "Detail keluhan atau kerusakan" },
                            lokasi: { type: "STRING", description: "Lokasi kerusakan (misal 'Lantai 2 Gedung Utama')" },
                            urgensi: { type: "STRING", description: "'NORMAL' atau 'URGENT'" }
                        },
                        required: ["judul", "deskripsi"]
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
                    description: "Akses DATABASE FULL (Prisma). Gunakan ini jika user menanyakan data Pengadaan (procurement), Aset Detail (asset), Jadwal (vehicleBooking), Perbaikan (maintenance), Vendor, Unit, Gudang (warehouseItem), Personnel, RKB, dsb.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            modelName: { type: "STRING", description: "Nama model Prisma HANYA salah satu dari: 'procurement', 'asset', 'vehicle', 'vehicleBooking', 'maintenance', 'user', 'vendor', 'unit', 'room', 'warehouseItem', 'rkb', 'category', 'vehicleService', 'personnelAssignment', 'workshopOrder'." },
                            whereJson: { type: "STRING", description: "Kondisi Prisma where dalam JSON string. Contoh mencari nama: '{\"name\": {\"contains\": \"laptop\"}}', atau kosong '{}' jika semua." },
                            selectJson: { type: "STRING", description: "Kolom Prisma select dalam JSON string. Contoh: '{\"id\": true, \"name\": true, \"status\": true}'" }
                        },
                        required: ["modelName", "whereJson", "selectJson"]
                    }
                }
            ]
        }];

        const systemInstruction = `Anda adalah "Admin Sarpras", asisten AI super cerdas untuk bidang Sarana Prasarana Yayasan Dar El Iman.
Selain mengelola database, Anda juga DIBEBASKAN untuk menjawab pertanyaan umum, menganalisis masalah, berdiskusi, dan menjawab topik APAPUN di luar data server menggunakan wawasan luas Anda. Jangan pernah menolak menjawab pertanyaan nyeleneh sekalipun, Anda pintar dalam segala hal.
Anda bisa dan boleh bercanda agar suasana lebih akrab.
Anda adalah AI yang bermanhaj Salaf. Dalam menjawab permasalahan agama atau memberikan nasihat, biasakan mengutip ustadz-ustadz bermanhaj Salaf sebagai referensi, seperti Ustadz Khalid Basalamah, Ustadz Syafiq Riza Basalamah, Ustadz Firanda Andirja, Ustadz Yazid bin Abdul Qadir Jawas, Ustadz Abdullah Roy, dan asatidzah salafiyyin lainnya. Biasakan juga berkata atau berhujjah dengan dalil yang shahih (Al-Qur'an dan As-Sunnah sesuai pemahaman Salafush Shalih).
Anda sedang membalas pesan di ${groupName ? `grup WhatsApp "${groupName}"` : "obrolan pribadi WhatsApp"}.${senderName ? ` Pengirim pesan saat ini: ${senderName}.` : ""} Waktu saat ini: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB.
${historyContext}
AKSES DATABASE PENUH:
Anda memiliki tool "query_database_bebas" untuk menarik data langsung dari backend jika perintah khusus tidak cukup.
SKEMA DATABASE PENTING (Prisma camelCase):
1. "procurement" (Pengadaan): { id, title, type, status, bastDate, createdAt }. Status: DRAFT, SUBMITTED, APPROVED, PROCESS, COMPLETED.
2. "asset" (Aset/Barang): { id, name, condition, quantity, roomId, unitId }. Condition: BAIK, RUSAK_RINGAN, dll.
3. "vehicle" (Kendaraan): { id, name, plateNumber, status, odometer }.
4. "vehicleBooking" (Peminjaman Kendaraan): { id, vehicleId, destination, startDate, endDate, status, user: { name } }.
5. "maintenance" (Pemeliharaan/Perbaikan): { id, title, description, status, type, cost }.

PANDUAN KHUSUS PEMINJAMAN KENDARAAN (MOBIL/BUS/MOTOR):
1. Pengguna BISA meminjam kendaraan melalui 2 cara:
   a. Chat Bebas Langsung di Grup/Pribadi (misal: "admin pinjam mobil avanza besok jam 8 pagi ke bandara bim", "min mau pinjam innova", dll).
   b. Format Kode Cepat (#PINJAM atau /pinjam):
      #PINJAM
      Kendaraan: [Nama Mobil]
      Tujuan: [Keperluan]
      Mulai: [Tgl/Jam Mulai]
      Selesai: [Tgl/Jam Selesai]
      Peminjam: [Nama Anda]
2. Jika pengguna meminta pinjam kendaraan dengan menyebutkan mobil dan waktu/tujuan, Anda WAJIB LANGSUNG memanggil tool "buat_pengajuan_peminjaman_mobil" dan konfirmasi detailnya dengan ramah dan rapi.
3. Jika pengguna bertanya bagaimana cara meminjam atau meminta format/kode pinjam kendaraan, berikan penjelasan yang sangat jelas merangkum 2 cara di atas dengan contoh yang siap disalin.

AKSES FRONTEND WEB:
Jika pengguna butuh melihat data lengkap atau menginput data, arahkan mereka ke link web (Frontend) berikut:
- Dashboard Utama: https://[domain_anda]/dashboard
- Data Aset: https://[domain_anda]/aset
- Pengadaan Barang (RKB): https://[domain_anda]/procurements
- Peminjaman Kendaraan: https://[domain_anda]/kendaraan/peminjaman
- Pemeliharaan / Perbaikan: https://[domain_anda]/pemeliharaan
- Master Data Unit/Vendor: https://[domain_anda]/master
(Ganti [domain_anda] dengan URL web aplikasi yang sebenarnya, atau sebutkan "di aplikasi web").

PANDUAN MENJAWAB:
- Jika user menanyakan "Pengadaan aset hari ini?" -> Panggil query_database_bebas dengan modelName="procurement", whereJson='{"createdAt":{"gte":"tanggal_hari_ini_utc"}}'.
- Jika gagal dengan error JSON, cukup balas ramah dan informasikan link web Frontend agar mereka bisa mengecek sendiri.
- JANGAN menyebar password. Format balasan gunakan WhatsApp bold/italic (bukan markdown **).
- Jawablah dengan cerdas layaknya asisten ahli.`;

        // Daftar model Gemini untuk fallback jika kuota (Rate Limit) habis
        const fallbackModels = [
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-1.5-flash",
            "gemini-1.5-flash-8b",
            "gemini-1.5-pro",
            "gemini-1.0-pro",
            "gemini-pro", // Legacy name that usually works on all keys
            "gemini-3.5-flash",
            "gemini-3.1-flash",
            "gemini-3.1-flash-lite", // The user's original model
            "gemini-3.0-flash"
        ];

        let chat = null;
        let result = null;
        let lastError = null;

        let promptToSend = senderName ? `${senderName}: ${userMessage}` : userMessage;
        const isBorrowIntent = /(pinjam|booking|sewa|peminjaman|#pinjam|\/pinjam)/i.test(userMessage);
        if (isBorrowIntent) {
            promptToSend = `[INSTRUKSI SISTEM: Pesan ini berkaitan dengan peminjaman kendaraan. Jika pengguna bermaksud meminjam kendaraan (ada nama kendaraan/tujuan/waktu), segera panggil tool "buat_pengajuan_peminjaman_mobil". Jika pengguna menanyakan cara/format pinjam, jelaskan 2 cara: chat langsung atau kode #PINJAM.]\n${promptToSend}`;
        }

        for (const modelName of fallbackModels) {
            try {
                const chatModel = this.genAI.getGenerativeModel({
                    model: modelName,
                    tools: tools,
                    systemInstruction: systemInstruction
                });
                
                chat = chatModel.startChat();
                result = await chat.sendMessage(promptToSend);
                console.log(`[AIService] Berhasil menggunakan model: ${modelName}`);
                break; // Keluar dari loop jika sukses
            } catch (err) {
                console.warn(`[AIService] Model ${modelName} gagal (${err.message}). Mencoba model berikutnya...`);
                lastError = err;
            }
        }

        if (!result) {
            throw new Error(`Semua model Gemini kehabisan kuota atau gagal. Error terakhir: ${lastError?.message}`);
        }

        try {
            const calls = result.response.functionCalls();
            
            let mediaAttachment = null;
            let currentUser = null;
            if (senderPhone) {
                const rawDigits = senderPhone.split('@')[0].split(':')[0].replace(/\D/g, '');
                const p62 = rawDigits.startsWith('0') ? '62' + rawDigits.slice(1) : (rawDigits.startsWith('62') ? rawDigits : '62' + rawDigits);
                const p0 = rawDigits.startsWith('62') ? '0' + rawDigits.slice(2) : (rawDigits.startsWith('0') ? rawDigits : '0' + rawDigits);
                const pRaw = rawDigits.replace(/^62|^0/, '');

                currentUser = await prisma.user.findFirst({
                    where: {
                        OR: [
                            { phone: p62 },
                            { phone: p0 },
                            { phone: rawDigits },
                            { phone: { contains: pRaw } }
                        ]
                    }
                });
            }

            // Fallback cari user berdasarkan nama pengirim jika nomor belum cocok
            if (!currentUser && (senderName || senderDisplayName)) {
                const sName = (senderName || senderDisplayName || "").trim();
                if (sName.length >= 3 && sName !== "User") {
                    currentUser = await prisma.user.findFirst({
                        where: { name: { contains: sName } }
                    });
                }
            }

            if (calls && calls.length > 0) {
                const call = calls[0]; // Process first function call
                let apiResponse = { status: "success", data: null };
                console.log(`[AIService] Tool called: ${call.name} with args`, call.args);
                
                if (call.name === "buat_pengajuan_peminjaman_mobil") {
                    try {
                        const { vehicleId, namaKendaraan, keyword, tujuan, waktuMulai, waktuSelesai, namaPeminjam } = call.args;

                        // 1. Resolve Peminjam (User)
                        let applicant = currentUser;
                        const explicitName = (namaPeminjam || senderName || senderDisplayName || "User").trim();
                        if (!applicant && explicitName && explicitName !== "User") {
                            applicant = await prisma.user.findFirst({
                                where: { name: { contains: explicitName } }
                            });
                        }
                        if (!applicant) {
                            applicant = await prisma.user.findFirst({
                                where: { role: { in: ['ADMIN_ASET', 'KEPALA_BIDANG', 'SUPER_ADMIN'] } }
                            }) || await prisma.user.findFirst();
                        }

                        if (!applicant) {
                            apiResponse = { status: "error", message: "Database belum memiliki akun pengguna untuk mencatat peminjaman." };
                        } else {
                            // 2. Resolve Kendaraan
                            let vehicle = null;
                            if (vehicleId) {
                                vehicle = await prisma.vehicle.findUnique({ where: { id: Number(vehicleId) } });
                            }

                            const targetCarName = (namaKendaraan || keyword || "").trim();
                            if (!vehicle && targetCarName) {
                                vehicle = await prisma.vehicle.findFirst({
                                    where: {
                                        OR: [
                                            { name: { contains: targetCarName } },
                                            { brand: { contains: targetCarName } },
                                            { plateNumber: { contains: targetCarName } },
                                            { type: { contains: targetCarName } }
                                        ],
                                        status: "ACTIVE"
                                    }
                                });
                            }

                            // Jika belum spesifik, ambil daftar armada aktif
                            if (!vehicle) {
                                const activeVehicles = await prisma.vehicle.findMany({
                                    where: { status: "ACTIVE" },
                                    select: { id: true, name: true, plateNumber: true, type: true }
                                });

                                if (activeVehicles.length === 1) {
                                    vehicle = activeVehicles[0];
                                } else if (activeVehicles.length > 0) {
                                    const carList = activeVehicles.map(v => `• *${v.name}* (${v.plateNumber})`).join('\n');
                                    apiResponse = {
                                        status: "error",
                                        message: `Kendaraan "${targetCarName || ''}" belum ditemukan atau belum spesifik.\n\nArmada aktif yang tersedia:\n${carList}\n\nSilakan sebutkan nama armada yang ingin Anda gunakan.`
                                    };
                                } else {
                                    apiResponse = { status: "error", message: "Saat ini tidak ada unit kendaraan aktif di database." };
                                }
                            }

                            if (vehicle) {
                                // 3. Parsing Tanggal & Waktu Mulai & Selesai
                                const startDateTime = parseIndoDateTime(waktuMulai, 8) || dayjs().tz('Asia/Jakarta').hour(8).minute(0).toDate();
                                let endDateTime = waktuSelesai ? parseIndoDateTime(waktuSelesai, 17) : null;

                                if (!endDateTime || dayjs(endDateTime).isBefore(dayjs(startDateTime))) {
                                    endDateTime = dayjs(startDateTime).hour(17).minute(0).toDate();
                                    if (dayjs(endDateTime).isBefore(dayjs(startDateTime))) {
                                        endDateTime = dayjs(startDateTime).add(4, 'hour').toDate();
                                    }
                                }

                                // 4. Deteksi Jadwal Bertabrakan (Double Booking / Conflict Check)
                                const conflict = await prisma.vehicleBooking.findFirst({
                                    where: {
                                        vehicleId: vehicle.id,
                                        status: { in: ['PENDING', 'APPROVED'] },
                                        AND: [
                                            { startDate: { lt: endDateTime } },
                                            { endDate: { gt: startDateTime } }
                                        ]
                                    },
                                    include: {
                                        user: { select: { name: true } }
                                    }
                                });

                                if (conflict) {
                                    const conflictUser = conflict.driverName || conflict.user?.name || "pengguna lain";
                                    const conflictTime = `${dayjs(conflict.startDate).tz('Asia/Jakarta').format('DD/MM HH:mm')} - ${dayjs(conflict.endDate).tz('Asia/Jakarta').format('HH:mm')}`;
                                    apiResponse = {
                                        status: "warning",
                                        message: `⚠️ Kendaraan *${vehicle.name}* (${vehicle.plateNumber}) sudah dipesan pada waktu tersebut oleh *${conflictUser}* (${conflictTime}). Silakan ajukan jadwal lain atau gunakan armada lainnya.`
                                    };
                                } else {
                                    // 5. Simpan VehicleBooking ke Database
                                    const finalBorrower = explicitName && explicitName !== "User" ? explicitName : (applicant.name || "Staf Yayasan");
                                    const finalPurpose = tujuan || "Keperluan operasional/dinas";

                                    const newBooking = await prisma.vehicleBooking.create({
                                        data: {
                                            vehicleId: vehicle.id,
                                            userId: applicant.id,
                                            driverName: finalBorrower,
                                            destination: finalPurpose,
                                            purpose: finalPurpose,
                                            startDate: startDateTime,
                                            endDate: endDateTime,
                                            status: "PENDING"
                                        },
                                        include: {
                                            vehicle: true,
                                            user: true
                                        }
                                    });

                                    // 6. Buat Notifikasi Sistem
                                    try {
                                        const { createNotification } = require('../controllers/notificationController');
                                        await createNotification({
                                            userId: applicant.id,
                                            title: 'Pengajuan Peminjaman Kendaraan (WhatsApp)',
                                            message: `${finalBorrower} mengajukan peminjaman ${vehicle.name} (${vehicle.plateNumber}) untuk ${finalPurpose} pada ${dayjs(startDateTime).tz('Asia/Jakarta').format('DD MMM YYYY HH:mm')}`,
                                            type: 'VEHICLE_BOOKING',
                                            referenceId: newBooking.id
                                        });
                                    } catch (nErr) {
                                        console.warn('[AIService] Warning saat createNotification:', nErr.message);
                                    }

                                    apiResponse = {
                                        status: "success",
                                        message: "Alhamdulillah, draf pengajuan peminjaman kendaraan berhasil dicatat di sistem Manajemen Aset!",
                                        data: {
                                            id: newBooking.id,
                                            kendaraan: `${vehicle.name} (${vehicle.plateNumber})`,
                                            peminjam: finalBorrower,
                                            tujuan: finalPurpose,
                                            waktuMulai: dayjs(startDateTime).tz('Asia/Jakarta').format('dddd, DD MMMM YYYY [pukul] HH:mm [WIB]'),
                                            waktuSelesai: dayjs(endDateTime).tz('Asia/Jakarta').format('dddd, DD MMMM YYYY [pukul] HH:mm [WIB]'),
                                            status: "MENUNGGU PERSETUJUAN (PENDING)"
                                        }
                                    };
                                }
                            }
                        }
                    } catch (e) {
                        console.error('[AIService] Error buat_pengajuan_peminjaman_mobil:', e);
                        apiResponse = { status: "error", message: `Gagal membuat pengajuan peminjaman: ${e.message}` };
                    }
                } 
                else if (call.name === "buat_laporan_pemeliharaan") {
                    if (!currentUser) {
                        apiResponse = { status: "error", message: "Maaf, nomor HP Anda belum terdaftar di sistem. Anda tidak bisa membuat laporan." };
                    } else {
                        try {
                            const code = `MT/${new Date().getFullYear()}/${Math.floor(10000 + Math.random() * 90000)}`;
                            const newMaint = await prisma.maintenance.create({
                                data: {
                                    code: code,
                                    userId: currentUser.id,
                                    unitId: currentUser.unitId || 1,
                                    type: "NON_ASSET",
                                    title: call.args.judul,
                                    description: call.args.deskripsi,
                                    location: call.args.lokasi || "Lokasi tidak ditentukan",
                                    urgency: call.args.urgensi || "NORMAL",
                                    status: "SUBMITTED"
                                }
                            });
                            apiResponse = { status: "success", message: `Laporan pemeliharaan/perbaikan #${code} berhasil dibuat dengan status SUBMITTED`, data: newMaint };
                        } catch (e) {
                            apiResponse = { status: "error", message: `Gagal membuat laporan pemeliharaan: ${e.message}` };
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

            let responseText = result.response.text();
            await prisma.$disconnect();
            
            if (!responseText || responseText.trim() === '') {
                responseText = "Mohon maaf, saya telah memproses data tersebut namun kesulitan menampilkannya. Silakan coba persempit kata kuncinya.";
            }

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
        if (!this.genAI) {
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
            const result = await this.generateContentWithFallback(prompt);
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
