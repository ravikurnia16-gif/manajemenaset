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
     * @param {Array} chatHistory - Optional chat history array from WA or DB.
     * @param {string} senderName - Optional name of the sender.
     * @param {Object} quotedInfo - Optional quoted/replied message details { messageId, senderName, body }.
     * @returns {Promise<string|Object>}
     */
    async generateChatResponse(userMessage, groupName = null, senderPhone = null, chatHistory = [], senderName = null, quotedInfo = null) {
        if (!this.model) {
            throw new Error("AI Service is not configured (missing API Key)");
        }

        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();

        // Format quoted / referenced message context if available
        let quotedContext = "";
        if (quotedInfo) {
            if (quotedInfo.isVoiceNote) {
                quotedContext = `
============================================================
PESAN YANG SEDANG DI-REPLY ADALAH PESAN SUARA / VOICE NOTE (VN):
Pengirim Voice Note: ${quotedInfo.senderName || "Seseorang di grup"}
Isi/Media: Rekaman Suara / Voice Note (Audio telah dilampirkan langsung ke sistem AI Anda)
============================================================
(PERHATIAN KHUSUS: Pengirim saat ini (${senderName || "User"}) sedang me-reply langsung rekaman suara di atas.
Audio suara tersebut telah dilampirkan langsung ke input Anda.
Dengarkan baik-baik rekaman suara tersebut, pahami apa yang disampaikan atau diminta oleh pembicara di VN tersebut.
Jalankan fungsi/tools jika pembicara meminta pengecekan data, peminjaman, pelaporan, atau penjadwalan.
Jawab dengan ramah, santun, dan langsung merespons substansi yang dibicarakan di Voice Note tersebut.)
`;
            } else if (quotedInfo.body) {
                quotedContext = `
============================================================
PESAN YANG SEDANG DI-REPLY / DIRUJUK LANGSUNG OLEH PENGIRIM:
Pengirim Pesan yang Dirujuk: ${quotedInfo.senderName || "Seseorang di grup"}
Isi Pesan yang Dirujuk: "${quotedInfo.body}"
============================================================
(PERHATIAN KHUSUS: Pengirim saat ini (${senderName || "User"}) sedang menanggapi / me-reply langsung pesan di atas.
Tanggapi dan kaitkan jawaban Anda secara langsung dan akurat dengan konteks isi pesan yang dirujuk tersebut.
Jika pesan yang dirujuk adalah pertanyaan, permohonan, atau keluhan fasilitas/aset, jadikan pesan itu sebagai subjek utama yang sedang dibicarakan.)
`;
            }
        }

        // Format history context if provided
        let historyContext = "";
        if (Array.isArray(chatHistory) && chatHistory.length > 0) {
            const historyLines = chatHistory.map(h => {
                const timeTag = h.timestamp ? `[${h.timestamp}] ` : "";
                const replyTag = h.quoted ? ` (me-reply ${h.quoted.sender}: "${h.quoted.body && h.quoted.body.length > 50 ? h.quoted.body.slice(0, 50) + '...' : h.quoted.body}")` : "";
                return `${timeTag}${h.sender}: ${h.body}${replyTag}`;
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
                    description: "Membuat draf pengajuan peminjaman mobil / kendaraan operasional (VehicleBooking) di sistem Manajemen Aset dengan status PENDING atas nama peminjam yang sedang chat. PERHATIAN: HANYA panggil tool ini jika 4 data sudah LENGKAP: (1) namaKendaraan, (2) tujuan, (3) waktuMulai, dan (4) waktuSelesai. Jika salah satu dari 4 data tersebut belum ada atau belum jelas, JANGAN panggil tool ini! Alih-alih memanggil tool, tanyakanlah kepada pengguna apa saja data yang masih kurang.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            namaKendaraan: { type: "STRING", description: "Nama, tipe, atau plat nomor kendaraan yang ingin dipinjam (contoh: 'Avanza', 'Innova', 'Hiace', 'Bus', 'Hilux', 'BA 1234 XY')." },
                            vehicleId: { type: "NUMBER", description: "ID kendaraan di database (opsional jika namaKendaraan diisi)" },
                            tujuan: { type: "STRING", description: "Tujuan atau keperluan peminjaman kendaraan (contoh: 'Antar tamu ke Bandara BIM', 'Dinas ke Bukittinggi')" },
                            waktuMulai: { type: "STRING", description: "Waktu mulai peminjaman (contoh: '2026-09-04 08:00', 'besok jam 08:00', 'hari ini jam 13:00')" },
                            waktuSelesai: { type: "STRING", description: "Waktu selesai / pengembalian kendaraan (contoh: '2026-09-04 16:00', 'besok jam 16:00')" },
                            namaPeminjam: { type: "STRING", description: "Nama peminjam / penanggung jawab (otomatis nama pengguna yang sedang chat)" }
                        },
                        required: ["namaKendaraan", "tujuan", "waktuMulai", "waktuSelesai"]
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
                    name: "cek_jadwal_dan_booking_bus",
                    description: "Membaca jadwal pemesanan / sewa bus pariwisata atau bus sekolah yayasan, rute tujuan, tanggal keberangkatan dan kepulangan, sopir (driver) yang bertugas, total tagihan sewa bus, dan status pelunasan.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            keyword: { type: "STRING", description: "Tujuan, nama pemohon, atau nama bus/plat nomor. Kosongkan '' jika mencari semua." },
                            status: { type: "STRING", description: "Status: 'APPROVED', 'COMPLETED', 'CANCELLED', atau '' jika semua." },
                            unpaidOnly: { type: "BOOLEAN", description: "Jika true, hanya menampilkan pemesanan bus yang belum lunas (isPaid = false)." }
                        }
                    }
                },
                {
                    name: "cek_pajak_dan_legalitas_kendaraan",
                    description: "Membaca status jatuh tempo pajak tahunan, pajak 5 tahunan (STNK), dan uji KIR seluruh armada kendaraan operasional (mobil, bus, motor). Dapat menyaring kendaraan yang pajaknya segera habis (< 60 hari) atau sudah kadaluarsa/lewat jatuh tempo.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            keyword: { type: "STRING", description: "Nama kendaraan atau plat nomor. Kosongkan '' jika mencari semua." },
                            filterPajak: { type: "STRING", description: "'EXPIRING_SOON' untuk jatuh tempo dalam 60 hari ke depan, 'EXPIRED' untuk yang sudah lewat jatuh tempo, 'ALL' untuk semua." }
                        }
                    }
                },
                {
                    name: "cek_pengadaan_aset_dan_rkb",
                    description: "Membaca data usulan pengadaan barang dan RKB (Rencana Kebutuhan Barang), rincian anggaran, daftar barang yang diajukan, unit pengaju, dan status persetujuan.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            keyword: { type: "STRING", description: "Kata kunci nama pengadaan atau nama barang. Kosongkan '' jika mencari semua." },
                            status: { type: "STRING", description: "Status: 'DRAFT', 'SUBMITTED', 'APPROVED', 'PROCESS', 'COMPLETED', atau '' jika semua." }
                        }
                    }
                },
                {
                    name: "cek_stok_dan_pesanan_gudang",
                    description: "Membaca data inventaris/logistik gudang (ATK, kertas, perlengkapan umum), cek stok barang menipis/kritis (di bawah batas minimum stok), atau memeriksa daftar dan status pesanan barang oleh unit kerja.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            keyword: { type: "STRING", description: "Nama barang logistik/ATK, kode barang, atau nama pemohon pesanan." },
                            lowStockOnly: { type: "BOOLEAN", description: "Jika true, hanya tampilkan barang yang stoknya menipis/kritis di bawah minimum." },
                            statusPesanan: { type: "STRING", description: "Jika ingin mengecek pesanan unit kerja: 'PENDING', 'APPROVED', 'PROCESS', 'COMPLETED', 'ALL', atau biarkan kosong '' jika hanya cek stok barang." }
                        }
                    }
                },
                {
                    name: "cek_stok_dan_penjualan_seragam",
                    description: "Membaca data manajemen seragam sekolah: ketersediaan stok per model dan ukuran (S, M, L, XL, XXL, dll), stok yang menipis/habis, atau riwayat transaksi penjualan & pesanan paket seragam SPMB vs retail.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            keyword: { type: "STRING", description: "Nama seragam, jenis pakaian, atau nama siswa/wali murid/pemesan." },
                            ukuran: { type: "STRING", description: "Ukuran tertentu: 'S', 'M', 'L', 'XL', 'XXL', atau kosong jika semua ukuran." },
                            lowStockOnly: { type: "BOOLEAN", description: "Jika true, hanya menampilkan seragam yang stoknya menipis/habis." },
                            tipePenjualan: { type: "STRING", description: "Jika ingin mengecek penjualan/pesanan: 'SPMB', 'RETAIL', 'UNIT_ORDER', 'ALL', atau kosong jika ingin cek stok barang." }
                        }
                    }
                },
                {
                    name: "cek_pesanan_dan_progres_workshop",
                    description: "Membaca data pesanan bengkel workshop kayu dan bengkel workshop besi (nomor SPK, judul pesanan, unit pemesan, PIC teknisi/tukang, deadline, persentase progres % pengerjaan terkini, dan estimasi biaya).",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            workshopType: { type: "STRING", description: "'WOOD' (bengkel kayu) atau 'IRON' (bengkel besi) atau kosong untuk semua." },
                            keyword: { type: "STRING", description: "Judul pesanan, nomor SPK, atau nama pemesan/tukang." },
                            status: { type: "STRING", description: "Status pesanan: 'DRAFT', 'SUBMITTED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', atau kosong jika semua." }
                        }
                    }
                },
                {
                    name: "cek_rekap_omset_dan_keuangan",
                    description: "Menghitung ringkasan dan rekapitulasi omset/pendapatan keuangan dari Penjualan Seragam, Sewa Bus, atau gabungan transaksi pada periode tertentu (hari ini, bulan ini, tahun ini, atau tanggal tertentu).",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            modul: { type: "STRING", description: "'SERAGAM', 'BUS', atau 'SEMUA'." },
                            periode: { type: "STRING", description: "'HARI_INI', 'BULAN_INI', 'TAHUN_INI', atau tanggal spesifik (format YYYY-MM-DD atau YYYY-MM)." }
                        }
                    }
                },
                {
                    name: "cek_agenda_dan_jadwal_sarpras",
                    description: "Membaca kalender agenda kegiatan sarpras (rapat, acara yayasan/sekolah, kunjungan tamu, sewa gedung/lapangan), rutinitas staf, dan penugasan kerja staf.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            periode: { type: "STRING", description: "'HARI_INI', 'BESOK', 'MINGGU_INI', 'BULAN_INI' atau kosong." },
                            keyword: { type: "STRING", description: "Kata kunci nama kegiatan, lokasi, atau nama staf." }
                        }
                    }
                },
                {
                    name: "cek_laporan_kinerja_staff",
                    description: "Membaca laporan kinerja harian staf sarpras (poin kegiatan pagi & sore, kendala lapangan), memantau siapa staf yang belum mengisi laporan hari ini (fitur monitoring Kepala Bidang), skor KPI staf, dan catatan setoran hafalan Quran staf.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            mode: { type: "STRING", description: "'LAPORAN_HARIAN' (rincian kegiatan kerja staf), 'BELUM_LAPOR' (rekap staf yang belum membuat laporan hari ini), 'SETORAN_HAFALAN' (riwayat setoran hafalan Quran staf), 'SKOR_KPI' (skor KPI bulanan staf)." },
                            namaStaff: { type: "STRING", description: "Nama staf spesifik yang ingin dicari (opsional)." },
                            tanggal: { type: "STRING", description: "Tanggal laporan (format YYYY-MM-DD, atau 'HARI_INI' / 'KEMARIN')." }
                        }
                    }
                },
                {
                    name: "query_database_bebas",
                    description: "Akses DATABASE PENUH (Prisma ORM). Gunakan ini jika membutuhkan kueri fleksibel atau model yang belum tercakup di tool lain (contoh: user, vendor, room, unit, category, assetLoan, assetDisposal, vehicleService, rkb, survey, securitySchedule, dll).",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            modelName: { type: "STRING", description: "Nama model Prisma (contoh: 'asset', 'user', 'procurement', 'maintenance', 'rKB', 'workshopOrder', 'busBooking', 'uniformSale', 'invItem', 'sarprasCalendarEvent', 'personnelReport', dll - case insensitive)." },
                            whereJson: { type: "STRING", description: "Kondisi Prisma where dalam format JSON string. Contoh: '{\"name\": {\"contains\": \"laptop\"}}', atau kosong '{}' jika tanpa filter." },
                            selectJson: { type: "STRING", description: "Kolom Prisma select dalam JSON string. Contoh: '{\"id\": true, \"name\": true}' atau kosong '{}' untuk semua kolom." }
                        },
                        required: ["modelName", "whereJson"]
                    }
                }
            ]
        }];

        const systemInstruction = `Anda adalah "Admin Sarpras", asisten AI super cerdas untuk bidang Sarana & Prasarana Yayasan Dar El Iman.
Anda terintegrasi PENUH dengan seluruh database dan sistem manajemen sarpras. Anda mampu membaca, menganalisis, merangkum, dan mengolah data dari seluruh modul operasional sarpras dengan akurat dan cepat.

Selain mengelola database, Anda juga DIBEBASKAN untuk menjawab pertanyaan umum, menganalisis masalah, berdiskusi, dan menjawab topik APAPUN di luar data server menggunakan wawasan luas Anda. Jangan pernah menolak menjawab pertanyaan nyeleneh sekalipun, Anda pintar dalam segala hal.
Anda bisa dan boleh bercanda santai agar suasana lebih akrab dan bersahabat.
Anda adalah AI yang bermanhaj Salaf. Dalam menjawab permasalahan agama atau memberikan nasihat, biasakan mengutip ustadz-ustadz bermanhaj Salaf sebagai referensi, seperti Ustadz Khalid Basalamah, Ustadz Syafiq Riza Basalamah, Ustadz Firanda Andirja, Ustadz Yazid bin Abdul Qadir Jawas, Ustadz Abdullah Roy, dan asatidzah salafiyyin lainnya. Biasakan juga berkata atau berhujjah dengan dalil yang shahih (Al-Qur'an dan As-Sunnah sesuai pemahaman Salafush Shalih).
Anda sedang membalas pesan di ${groupName ? `grup WhatsApp "${groupName}"` : "obrolan pribadi WhatsApp"}.${senderName ? ` Pengirim pesan saat ini: ${senderName}.` : ""} Waktu saat ini: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB.
${quotedContext}
${historyContext}

PETA FITUR & DOMAIN DATABASE SARPRAS:
1. DATA ASET & INVENTARIS:
   - Tool: "cari_data_aset_barang", "query_database_bebas" (model: asset, room, unit, category, assetLoan, assetDisposal)
   - Membaca ketersediaan barang, lokasi ruangan, penanggung jawab (PIC), kondisi (BAIK, RUSAK_RINGAN, RUSAK_BERAT, DISPOSED), dan peminjaman aset.
2. PEMELIHARAAN & PERBAIKAN:
   - Tool: "cari_data_pemeliharaan", "buat_laporan_pemeliharaan", "cari_riwayat_perawatan" (model: maintenance, maintenanceProgress, vehicleService)
   - Status: SUBMITTED, IN_PROGRESS, COMPLETED. Kode tiket MT/YYYY/XXXXX.
3. PENGADAAN BARANG (RKB & PROCUREMENT):
   - Tool: "cek_pengadaan_aset_dan_rkb" (model: procurement, procurementItem, rKB, rKBItem, vendor)
   - Status: DRAFT, SUBMITTED, APPROVED, PROCESS, COMPLETED. Rincian anggaran, harga satuan, dan vendor rekanan.
4. PEMINJAMAN KENDARAAN (MOBIL/BUS/MOTOR DINAS):
   - Tool: "cari_status_peminjaman", "cari_data_kendaraan", "buat_pengajuan_peminjaman_mobil" (model: vehicleBooking, vehicle)
   - Cek peminjam, jam dinas, bentrok armada, atau langsung catat pengajuan jika user menyebutkan kendaraan & waktu/tujuan.
5. BOOKING JADWAL BUS:
   - Tool: "cek_jadwal_dan_booking_bus" (model: busBooking, vehicle)
   - Mengetahui jadwal pemesanan bus, rute tujuan, tanggal pergi/pulang, jumlah penumpang, sopir yang bertugas, tagihan total, dan status lunas (isPaid).
6. OMSET & KEUANGAN:
   - Tool: "cek_rekap_omset_dan_keuangan" (model: uniformSale, busBooking, invOrder)
   - Rekap omset penjualan seragam (SPMB vs Retail, terbayar vs piutang), sewa bus pariwisata/sekolah, dan penerimaan kas/transfer/QRIS pada hari ini, bulan ini, atau periode tertentu.
7. PAJAK & LEGALITAS ARMADA KENDARAAN:
   - Tool: "cek_pajak_dan_legalitas_kendaraan" (model: vehicle)
   - Memeriksa tanggal jatuh tempo Pajak Tahunan (PKB), Pajak 5 Tahunan (STNK), dan Uji KIR. Mendeteksi unit armada yang pajaknya segera habis (< 60 hari) atau sudah telat bayar pajak.
8. JADWAL & AGENDA KALENDER SARPRAS:
   - Tool: "cek_agenda_dan_jadwal_sarpras" (model: sarprasCalendarEvent, personnelRoutine, personnelAssignment)
   - Kalender kegiatan sarpras (rapat, kunjungan, acara yayasan/sekolah, pemakaian fasilitas/lapangan), rutinitas staf harian/mingguan.
9. MANAJEMEN GUDANG & LOGISTIK:
   - Tool: "cek_stok_dan_pesanan_gudang" (model: invItem, invStock, invOrder, invOrderItem, invCategory)
   - Stok barang umum/ATK (kertas, tinta, perlengkapan), barang yang stoknya kritis di bawah minimum (minStock), dan status pesanan barang oleh unit kerja (PENDING, APPROVED, PROCESS, COMPLETED).
10. MANAJEMEN SERAGAM SEKOLAH:
    - Tool: "cek_stok_dan_penjualan_seragam" (model: uniformItem, uniformVariant, uniformStock, uniformSale, uniformPackage)
    - Ketersediaan stok per model seragam dan ukuran (S/M/L/XL/XXL), stok habis/menipis, dan transaksi pesanan seragam SPMB maupun eceran/retail.
11. MANAJEMEN WORKSHOP (BENGKEL KAYU & BESI):
    - Tool: "cek_pesanan_dan_progres_workshop" (model: workshopOrder, workshopOrderItem, workshopProgress)
    - Surat Perintah Kerja (SPK) bengkel kayu (WOOD) dan bengkel besi (IRON), judul pekerjaan, unit pemesan, PIC tukang, deadline, persentase progres % terkini, dan estimasi biaya material/jasa.
12. LAPORAN KINERJA STAF & MONITORING KABID:
    - Tool: "cek_laporan_kinerja_staff" (model: personnelReport, personnelAssignment, personnelKPI, setoranHafalan)
    - Divisi staf: ASET, GUDANG, TEKNISI, KENDARAAN, KEUANGAN, UMUM.
    - Membaca poin kegiatan kerja harian staf (pagi & sore), kendala lapangan, memantau siapa saja staf yang BELUM mengisi laporan hari ini (fitur Kabid Sarpras), skor KPI bulanan staf, dan riwayat setoran hafalan Quran staf.

PANDUAN INTERAKTIF & VALIDASI PEMINJAMAN KENDARAAN:
1. ATAS NAMA PENGGUNA YANG CHAT:
   - Peminjaman HARUS selalu dicatat atas nama pengguna yang sedang chat (${senderName || "User"}), BUKAN atas nama admin!
2. ATURAN VALIDASI KELENGKAPAN INFORMASI:
   Sebelum mengajukan peminjaman, sistem membutuhkan 4 data penting:
   a. *Kendaraan*: Mobil apa yang ingin dipinjam (misal: Avanza, Innova, Hiace, Hilux, Bus, dll).
   b. *Tujuan*: Keperluan atau lokasi tujuan perjalanan yang jelas (misal: Antar tamu ke Bandara BIM, Dinas ke Bukittinggi, dll).
   c. *Waktu Mulai*: Hari/tanggal dan jam mulai peminjaman (misal: Besok jam 08:00 WIB).
   d. *Waktu Selesai*: Perkiraan hari/tanggal dan jam pengembalian armada (misal: Besok jam 17:00 WIB).
3. JIKA MASIH ADA DATA YANG KURANG ATAU BELUM JELAS:
   - JANGAN MEMANGGIL tool "buat_pengajuan_peminjaman_mobil"!
   - Berikan respon yang santun dan ramah kepada ${senderName || "Akhi/Ukhti"}.
   - Sebutkan data apa saja yang SUDAH Anda catat dari chatnya, lalu tanyakan secara spesifik data apa saja yang MASIH KURANG untuk dilengkapi.
   - Contoh respons jika user hanya bilang "Mau pinjam avanza besok":
     "Baik Akhi/Ukhti *${senderName || 'User'}*, kami siap mencatatkan peminjaman *Avanza* untuk besok. Namun sebelum kami proses pengajuannya, mohon lengkapi info berikut:
     • *Tujuan/Keperluan*: (Ke mana tujuan perjalanannya?)
     • *Jam Mulai*: (Mulai jam berapa besok?)
     • *Perkiraan Jam Selesai*: (Perkiraan kembali jam berapa?)
     
     Silakan dibalas dengan detail tersebut ya agar langsung kami buatkan draf peminjamannya atas nama Anda."
4. JIKA SEMUA 4 DATA SUDAH LENGKAP:
   - Segera panggil tool "buat_pengajuan_peminjaman_mobil" dengan parameter: namaKendaraan, tujuan, waktuMulai, waktuSelesai, dan namaPeminjam="${senderName || 'User'}".
   - Berikan balasan konfirmasi bahwa draf peminjaman telah berhasil dicatat atas nama pengguna tersebut.

AKSES FRONTEND WEB:
Jika pengguna butuh melihat data lengkap atau menginput data, arahkan mereka ke link web (Frontend) berikut:
- Dashboard Utama: https://[domain_anda]/dashboard
- Data Aset: https://[domain_anda]/aset
- Pengadaan Barang (RKB): https://[domain_anda]/procurements
- Peminjaman Kendaraan: https://[domain_anda]/kendaraan/peminjaman
- Reminder Pajak Kendaraan: https://[domain_anda]/kendaraan/reminder
- Jadwal Booking Bus: https://[domain_anda]/bus/booking
- Pemeliharaan / Perbaikan: https://[domain_anda]/pemeliharaan
- Logistik & Gudang: https://[domain_anda]/inventory/orders
- Manajemen Seragam: https://[domain_anda]/seragam/sales
- Bengkel Workshop: https://[domain_anda]/workshop/orders
- Laporan Kinerja Staf: https://[domain_anda]/laporan/staff
- Monitoring Kabid Sarpras: https://[domain_anda]/laporan/kabid
- Kalender Kegiatan: https://[domain_anda]/sarpras-calendar
(Ganti [domain_anda] dengan URL web aplikasi yang sebenarnya, atau sebutkan "di aplikasi web").

PANDUAN MEMPROSES PESAN SUARA / VOICE NOTE (VN) YANG DI-REPLY:
Jika pesan yang dirujuk adalah rekaman suara / Voice Note (VN):
- Dengarkan baik-baik rekaman audio yang dilampirkan langsung ke sistem Anda.
- Pahami apa yang diutarakan atau diminta oleh pembicara di VN tersebut.
- Jika pembicara meminta pengecekan data (kendaraan, bus, stok, omset, jadwal, dll), peminjaman mobil, atau laporan pemeliharaan, segera panggil tools yang relevan.
- Berikan balasan teks WhatsApp yang ramah, sopan, dan langsung menjawab inti dari apa yang dibicarakan dalam rekaman suara tersebut.

PANDUAN FORMAT JAWABAN:
- Gunakan format teks WhatsApp yang elegan: *tebal* untuk penekanan/judul/poin penting, _miring_ untuk istilah, dan bullet point • yang terstruktur.
- Jangan gunakan markdown heading '##' atau tanda bintang ganda '**', gunakan tanda bintang tunggal '*' untuk menebalkan teks di WhatsApp.
- Berikan ringkasan angka dan status secara jelas (misal: total omset, persentase progres, jumlah stok, sisa hari jatuh tempo).
- JANGAN menyebar kata sandi / password akun. Jawablah dengan cerdas layaknya asisten ahli yang amanah.`;

        // Deteksi dan siapkan Audio Part jika pesan yang di-reply adalah Voice Note
        let audioPart = null;
        if (quotedInfo && quotedInfo.isVoiceNote && quotedInfo.audio && quotedInfo.audio.data) {
            const cleanMime = (quotedInfo.audio.mimetype || 'audio/ogg').split(';')[0].trim();
            audioPart = {
                inlineData: {
                    mimeType: cleanMime,
                    data: quotedInfo.audio.data
                }
            };
            console.log(`[AIService] Quoted Voice Note terdeteksi. MIME: ${cleanMime}, Data size: ${Math.round(quotedInfo.audio.data.length / 1024)} KB. Menyiapkan input audio multimodal untuk Gemini...`);
        }

        // Daftar model Gemini untuk fallback jika kuota (Rate Limit) habis
        const fallbackModels = [
            "gemini-2.5-flash-lite",
            "gemini-2.5-flash",
            "gemini-flash-latest",
            "gemini-flash-lite-latest",
            "gemini-3.1-flash-lite",
            "gemini-3-flash-preview",
            "gemini-3.5-flash",
            "gemini-3.5-flash-lite",
            "gemini-2.5-pro",
            "gemini-pro-latest"
        ];

        let chat = null;
        let result = null;
        let lastError = null;

        let promptToSend = senderName ? `${senderName}: ${userMessage}` : userMessage;
        const isBorrowIntent = /(pinjam|booking|sewa|peminjaman|#pinjam|\/pinjam)/i.test(userMessage);
        if (isBorrowIntent) {
            promptToSend = `[INSTRUKSI SISTEM PEMINJAMAN KENDARAAN:
Pengirim pesan saat ini adalah: "${senderName || 'User'}".
Peminjaman HARUS dicatat atas nama pengguna ini ("${senderName || 'User'}"), BUKAN atas nama admin.
Periksa apakah 4 data berikut SUDAH LENGKAP di pesan ini atau riwayat percakapan sebelumnya:
1. Nama Kendaraan (misal Avanza, Innova, Hiace, dll)
2. Tujuan/Keperluan Perjalanan
3. Waktu & Jam Mulai
4. Waktu & Jam Selesai/Kembali

ATURAN TINDAKAN:
- JIKA MASIH ADA DATA YANG KURANG ATAU BELUM JELAS: JANGAN panggil tool "buat_pengajuan_peminjaman_mobil"! Tanyakan kepada "${senderName || 'User'}" informasi apa saja yang masih kurang untuk dilengkapi.
- JIKA SEMUA 4 DATA SUDAH LENGKAP: Panggil tool "buat_pengajuan_peminjaman_mobil" dengan namaPeminjam="${senderName || 'User'}".]\n${promptToSend}`;
        }

        const contentToSend = audioPart ? [audioPart, { text: promptToSend }] : promptToSend;

        for (const modelName of fallbackModels) {
            try {
                const chatModel = this.genAI.getGenerativeModel({
                    model: modelName,
                    tools: tools,
                    systemInstruction: systemInstruction
                });
                
                chat = chatModel.startChat();
                result = await chat.sendMessage(contentToSend);
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
            if (!currentUser && senderName) {
                const sName = senderName.trim();
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

                        // 1. Resolve Peminjam (User) - Wajib atas nama pengguna yang chat, BUKAN admin
                        const finalBorrower = (namaPeminjam || senderName || "User").trim();
                        let applicant = currentUser;

                        if (!applicant && finalBorrower && finalBorrower !== "User") {
                            applicant = await prisma.user.findFirst({
                                where: { name: { contains: finalBorrower } }
                            });
                        }

                        // Jika pengirim belum ada di tabel User, buatkan akun USER otomatis
                        // agar peminjaman 100% tercatat atas nama pengirim, BUKAN atas nama admin!
                        if (!applicant) {
                            try {
                                const bcrypt = require('bcrypt');
                                const rawDigits = senderPhone ? senderPhone.split('@')[0].split(':')[0].replace(/\D/g, '') : '';
                                const userSlug = rawDigits ? `wa_${rawDigits}` : `user_${Date.now()}`;
                                const dummyHash = await bcrypt.hash(`WA-${Date.now()}`, 10);
                                const displayName = finalBorrower !== "User" ? finalBorrower : `Pengguna WA (${rawDigits || 'Umum'})`;

                                applicant = await prisma.user.create({
                                    data: {
                                        username: userSlug,
                                        name: displayName,
                                        phone: rawDigits || null,
                                        role: 'USER',
                                        password: dummyHash,
                                        position: 'Pengguna WhatsApp'
                                    }
                                });
                                console.log(`[AIService] Berhasil mendaftarkan akun peminjam baru: ${applicant.name} (ID: ${applicant.id})`);
                            } catch (createErr) {
                                console.warn('[AIService] Gagal auto-create akun peminjam:', createErr.message);
                                applicant = await prisma.user.findFirst({ where: { role: 'USER' } }) || await prisma.user.findFirst();
                            }
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
                                    // 5. Simpan VehicleBooking ke Database (Peminjam selalu atas nama user pengirim)
                                    const borrowerName = finalBorrower !== "User" ? finalBorrower : (applicant.name || "Staf Yayasan");
                                    const finalPurpose = tujuan || "Keperluan operasional/dinas";

                                    const newBooking = await prisma.vehicleBooking.create({
                                        data: {
                                            vehicleId: vehicle.id,
                                            userId: applicant.id,
                                            driverName: borrowerName,
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
                                            message: `${borrowerName} mengajukan peminjaman ${vehicle.name} (${vehicle.plateNumber}) untuk ${finalPurpose} pada ${dayjs(startDateTime).tz('Asia/Jakarta').format('DD MMM YYYY HH:mm')}`,
                                            type: 'VEHICLE_BOOKING',
                                            referenceId: newBooking.id
                                        });
                                    } catch (nErr) {
                                        console.warn('[AIService] Warning saat createNotification:', nErr.message);
                                    }

                                    apiResponse = {
                                        status: "success",
                                        message: `Alhamdulillah, draf pengajuan peminjaman kendaraan berhasil dicatat di sistem Manajemen Aset atas nama *${borrowerName}*!`,
                                        data: {
                                            id: newBooking.id,
                                            kendaraan: `${vehicle.name} (${vehicle.plateNumber})`,
                                            peminjam: borrowerName,
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
                else if (call.name === 'cek_jadwal_dan_booking_bus') {
                    try {
                        const kw = (call.args.keyword || "").trim();
                        const st = (call.args.status || "").trim();
                        const unpaidOnly = !!call.args.unpaidOnly;

                        let where = {};
                        if (kw) {
                            where.OR = [
                                { destination: { contains: kw } },
                                { requesterName: { contains: kw } },
                                { unit: { contains: kw } },
                                { vehicle: { name: { contains: kw } } },
                                { vehicle: { plateNumber: { contains: kw } } }
                            ];
                        }
                        if (st) where.status = st;
                        if (unpaidOnly) where.isPaid = false;

                        const bookings = await prisma.busBooking.findMany({
                            where,
                            include: {
                                vehicle: { select: { name: true, plateNumber: true } },
                                driver: { select: { name: true, phone: true } },
                                user: { select: { name: true } }
                            },
                            orderBy: { startDate: 'desc' },
                            take: 15
                        });

                        if (bookings.length === 0) {
                            apiResponse.data = "Tidak ditemukan data pemesanan bus yang sesuai kriteria pencarian.";
                        } else {
                            apiResponse.data = bookings.map(b => ({
                                id: b.id,
                                bus: b.vehicle ? `${b.vehicle.name} (${b.vehicle.plateNumber})` : 'Armada belum ditentukan',
                                pemohon: b.requesterName || b.user?.name || '-',
                                unit: b.unit || '-',
                                tujuan: b.destination,
                                keberangkatan: dayjs(b.startDate).tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm'),
                                kepulangan: dayjs(b.endDate).tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm'),
                                penumpang: `${b.passengerCount} orang`,
                                sopir: b.driver?.name ? `${b.driver.name} (${b.driver.phone || 'No kontak'})` : 'Belum ditugaskan',
                                status: b.status,
                                totalTagihan: b.totalBill ? `Rp ${Number(b.totalBill).toLocaleString('id-ID')}` : 'Rp 0',
                                statusBayar: b.isPaid ? 'LUNAS' : 'BELUM LUNAS'
                            }));
                        }
                    } catch (e) {
                        apiResponse.status = "error";
                        apiResponse.message = `Gagal cek jadwal bus: ${e.message}`;
                    }
                }
                else if (call.name === 'cek_pajak_dan_legalitas_kendaraan') {
                    try {
                        const kw = (call.args.keyword || "").trim();
                        const filterPajak = (call.args.filterPajak || "ALL").toUpperCase();

                        let where = { status: "ACTIVE" };
                        if (kw) {
                            where.OR = [
                                { name: { contains: kw } },
                                { plateNumber: { contains: kw } },
                                { brand: { contains: kw } }
                            ];
                        }

                        const now = dayjs().tz('Asia/Jakarta');
                        const in60Days = now.add(60, 'day').toDate();

                        if (filterPajak === 'EXPIRED') {
                            where.OR = [
                                { taxDueDate: { lt: now.toDate() } },
                                { stnkDueDate: { lt: now.toDate() } },
                                { kirDueDate: { lt: now.toDate() } }
                            ];
                        } else if (filterPajak === 'EXPIRING_SOON') {
                            where.OR = [
                                { taxDueDate: { lte: in60Days, gte: now.toDate() } },
                                { stnkDueDate: { lte: in60Days, gte: now.toDate() } },
                                { kirDueDate: { lte: in60Days, gte: now.toDate() } }
                            ];
                        }

                        const vehicles = await prisma.vehicle.findMany({
                            where,
                            select: {
                                id: true,
                                name: true,
                                plateNumber: true,
                                type: true,
                                taxDueDate: true,
                                stnkDueDate: true,
                                kirDueDate: true,
                                odometer: true
                            },
                            orderBy: { taxDueDate: 'asc' },
                            take: 20
                        });

                        const formatDue = (date) => {
                            if (!date) return '-';
                            const d = dayjs(date).tz('Asia/Jakarta');
                            const diffDays = d.diff(now, 'day');
                            let note = '';
                            if (diffDays < 0) note = ` ⚠️ (LEWAT TEMPO ${Math.abs(diffDays)} hari!)`;
                            else if (diffDays <= 30) note = ` ⚠️ (Kritis: ${diffDays} hari lagi)`;
                            else if (diffDays <= 60) note = ` (${diffDays} hari lagi)`;
                            return d.format('DD/MM/YYYY') + note;
                        };

                        apiResponse.data = vehicles.map(v => ({
                            kendaraan: `${v.name} (${v.plateNumber})`,
                            tipe: v.type,
                            odometer: `${v.odometer} km`,
                            pajakTahunan: formatDue(v.taxDueDate),
                            pajak5TahunSTNK: formatDue(v.stnkDueDate),
                            ujiKIR: formatDue(v.kirDueDate)
                        }));
                    } catch (e) {
                        apiResponse.status = "error";
                        apiResponse.message = `Gagal cek pajak kendaraan: ${e.message}`;
                    }
                }
                else if (call.name === 'cek_pengadaan_aset_dan_rkb') {
                    try {
                        const kw = (call.args.keyword || "").trim();
                        const st = (call.args.status || "").trim();

                        let where = {};
                        if (kw) {
                            where.OR = [
                                { title: { contains: kw } },
                                { items: { some: { name: { contains: kw } } } }
                            ];
                        }
                        if (st) where.status = st;

                        const procurements = await prisma.procurement.findMany({
                            where,
                            include: {
                                unit: { select: { name: true } },
                                user: { select: { name: true } },
                                items: { select: { name: true, quantity: true, unit: true, estimatedPrice: true, actualPrice: true } }
                            },
                            orderBy: { id: 'desc' },
                            take: 10
                        });

                        apiResponse.data = procurements.map(p => {
                            const totalEstimasi = p.items.reduce((acc, it) => acc + (it.estimatedPrice || 0) * (it.quantity || 1), 0);
                            return {
                                id: p.id,
                                judul: p.title,
                                unit: p.unit?.name || '-',
                                diajukanOleh: p.user?.name || '-',
                                tipe: p.type,
                                status: p.status,
                                tanggal: dayjs(p.createdAt).tz('Asia/Jakarta').format('DD/MM/YYYY'),
                                totalEstimasi: `Rp ${Number(totalEstimasi).toLocaleString('id-ID')}`,
                                rincianItem: p.items.map(i => `${i.name} (${i.quantity} ${i.unit || 'pcs'} @ Rp ${Number(i.estimatedPrice || 0).toLocaleString('id-ID')})`).join(', ')
                            };
                        });
                    } catch (e) {
                        apiResponse.status = "error";
                        apiResponse.message = `Gagal cek pengadaan: ${e.message}`;
                    }
                }
                else if (call.name === 'cek_stok_dan_pesanan_gudang') {
                    try {
                        const kw = (call.args.keyword || "").trim();
                        const lowStockOnly = !!call.args.lowStockOnly;
                        const statusPesanan = (call.args.statusPesanan || "").trim();

                        if (statusPesanan) {
                            let orderWhere = {};
                            if (kw) orderWhere.OR = [{ requesterName: { contains: kw } }, { requesterUnit: { contains: kw } }, { code: { contains: kw } }];
                            if (statusPesanan !== 'ALL') orderWhere.status = statusPesanan;

                            const orders = await prisma.invOrder.findMany({
                                where: orderWhere,
                                include: { items: { include: { item: { select: { name: true } } } } },
                                orderBy: { date: 'desc' },
                                take: 10
                            });

                            apiResponse.data = orders.map(o => ({
                                kodePesanan: o.code,
                                pemohon: `${o.requesterName} (${o.requesterUnit || 'Unit'})`,
                                tanggal: dayjs(o.date).tz('Asia/Jakarta').format('DD/MM/YYYY'),
                                status: o.status,
                                catatan: o.note || '-',
                                daftarItem: o.items.map(it => `${it.item?.name || 'Barang'}: ${it.quantity} ${it.unit || ''} [Status: ${it.status}]`).join(', ')
                            }));
                        } else {
                            let itemWhere = {};
                            if (kw) itemWhere.OR = [{ name: { contains: kw } }, { code: { contains: kw } }];

                            const items = await prisma.invItem.findMany({
                                where: itemWhere,
                                include: {
                                    category: { select: { name: true } },
                                    stocks: { include: { warehouse: { select: { name: true } } } }
                                },
                                take: 25
                            });

                            let resultItems = items.map(it => {
                                const totalQty = it.stocks.reduce((sum, s) => sum + s.quantity, 0);
                                const isMenipis = totalQty <= it.minStock;
                                return {
                                    kode: it.code,
                                    nama: it.name,
                                    kategori: it.category?.name || '-',
                                    totalStok: `${totalQty} ${it.unit}`,
                                    stokMinimal: it.minStock,
                                    kondisiStok: isMenipis ? (totalQty === 0 ? '❌ HABIS' : '⚠️ MENIPIS / KRITIS') : 'AMAN',
                                    rincianGudang: it.stocks.map(s => `${s.warehouse?.name || 'Gudang'}: ${s.quantity}`).join(', ')
                                };
                            });

                            if (lowStockOnly) {
                                resultItems = resultItems.filter(i => i.kondisiStok.includes('MENIPIS') || i.kondisiStok.includes('HABIS'));
                            }

                            apiResponse.data = resultItems;
                        }
                    } catch (e) {
                        apiResponse.status = "error";
                        apiResponse.message = `Gagal cek gudang: ${e.message}`;
                    }
                }
                else if (call.name === 'cek_stok_dan_penjualan_seragam') {
                    try {
                        const kw = (call.args.keyword || "").trim();
                        const ukuran = (call.args.ukuran || "").trim();
                        const lowStockOnly = !!call.args.lowStockOnly;
                        const tipePenjualan = (call.args.tipePenjualan || "").trim();

                        if (tipePenjualan) {
                            let saleWhere = {};
                            if (tipePenjualan !== 'ALL') saleWhere.type = tipePenjualan;
                            if (kw) saleWhere.OR = [{ customerName: { contains: kw } }, { studentName: { contains: kw } }, { code: { contains: kw } }];

                            const sales = await prisma.uniformSale.findMany({
                                where: saleWhere,
                                include: {
                                    items: {
                                        include: {
                                            variant: { include: { item: { select: { name: true } } } }
                                        }
                                    }
                                },
                                orderBy: { id: 'desc' },
                                take: 10
                            });

                            apiResponse.data = sales.map(s => ({
                                faktur: s.code,
                                tipe: s.type,
                                pelanggan: s.studentName ? `${s.studentName} (${s.targetUnit || ''} - ${s.customerName})` : s.customerName,
                                total: `Rp ${Number(s.totalAmount).toLocaleString('id-ID')}`,
                                terbayar: `Rp ${Number(s.paidAmount).toLocaleString('id-ID')}`,
                                statusBayar: s.paymentStatus,
                                statusFulfillment: s.status,
                                tanggal: dayjs(s.createdAt).tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm'),
                                rincianSeragam: s.items.map(it => `${it.variant?.item?.name || 'Seragam'} (Uk. ${it.variant?.sizeName || '-'}) x${it.quantity}`).join(', ')
                            }));
                        } else {
                            let itemWhere = { isActive: true };
                            if (kw) itemWhere.OR = [{ name: { contains: kw } }, { code: { contains: kw } }];

                            const items = await prisma.uniformItem.findMany({
                                where: itemWhere,
                                include: {
                                    category: { select: { name: true } },
                                    variants: {
                                        where: ukuran ? { sizeName: { contains: ukuran } } : undefined,
                                        include: {
                                            stocks: { include: { warehouse: { select: { name: true } } } }
                                        }
                                    }
                                },
                                take: 20
                            });

                            let results = [];
                            for (const item of items) {
                                for (const variant of item.variants) {
                                    const totalQty = variant.stocks.reduce((acc, s) => acc + s.quantity, 0);
                                    const status = totalQty === 0 ? '❌ HABIS' : (totalQty <= item.minStock ? '⚠️ MENIPIS' : 'AMAN');
                                    if (lowStockOnly && status === 'AMAN') continue;

                                    results.push({
                                        sku: variant.sku || item.code,
                                        seragam: item.name,
                                        ukuran: variant.sizeName,
                                        harga: `Rp ${Number(variant.sellPrice || item.sellPrice || 0).toLocaleString('id-ID')}`,
                                        stok: totalQty,
                                        kondisi: status,
                                        lokasi: variant.stocks.map(s => `${s.warehouse?.name}: ${s.quantity}`).join(', ')
                                    });
                                }
                            }
                            apiResponse.data = results.slice(0, 25);
                        }
                    } catch (e) {
                        apiResponse.status = "error";
                        apiResponse.message = `Gagal cek seragam: ${e.message}`;
                    }
                }
                else if (call.name === 'cek_pesanan_dan_progres_workshop') {
                    try {
                        const wsType = (call.args.workshopType || "").trim().toUpperCase();
                        const kw = (call.args.keyword || "").trim();
                        const st = (call.args.status || "").trim();

                        let where = {};
                        if (wsType) {
                            where.workshopType = wsType.includes('BESI') || wsType === 'IRON' ? 'IRON' : 'WOOD';
                        }
                        if (st) where.status = st;
                        if (kw) {
                            where.OR = [
                                { title: { contains: kw } },
                                { code: { contains: kw } },
                                { picName: { contains: kw } }
                            ];
                        }

                        const orders = await prisma.workshopOrder.findMany({
                            where,
                            include: {
                                unit: { select: { name: true } },
                                requestedBy: { select: { name: true } },
                                progress: { orderBy: { date: 'desc' }, take: 1, select: { percentage: true, description: true, date: true } },
                                items: { select: { name: true, quantity: true, unit: true, specification: true } }
                            },
                            orderBy: { id: 'desc' },
                            take: 10
                        });

                        apiResponse.data = orders.map(o => {
                            const latest = o.progress && o.progress.length > 0 ? o.progress[0] : null;
                            return {
                                spk: o.code,
                                tipe: o.workshopType === 'WOOD' ? 'Bengkel Kayu' : 'Bengkel Besi',
                                judul: o.title,
                                pemesan: `${o.requestedBy?.name || '-'} (${o.unit?.name || 'Unit'})`,
                                picTukang: o.picName || 'Belum ditugaskan',
                                status: o.status,
                                prioritas: o.priority,
                                deadline: o.deadline ? dayjs(o.deadline).tz('Asia/Jakarta').format('DD/MM/YYYY') : '-',
                                progresTerkini: latest ? `${latest.percentage}% (${latest.description || 'Pengerjaan'})` : '0% (Belum ada catatan progres)',
                                estimasiBiaya: `Rp ${Number(o.estimatedCost || 0).toLocaleString('id-ID')}`,
                                daftarBarang: o.items.map(it => `${it.name} (${it.quantity} ${it.unit || ''})`).join(', ')
                            };
                        });
                    } catch (e) {
                        apiResponse.status = "error";
                        apiResponse.message = `Gagal cek workshop: ${e.message}`;
                    }
                }
                else if (call.name === 'cek_rekap_omset_dan_keuangan') {
                    try {
                        const modul = (call.args.modul || "SEMUA").toUpperCase();
                        const periode = (call.args.periode || "BULAN_INI").toUpperCase();

                        const now = dayjs().tz('Asia/Jakarta');
                        let startFilter = now.startOf('month').toDate();
                        let endFilter = now.endOf('month').toDate();
                        let labelPeriode = `Bulan ${now.format('MMMM YYYY')}`;

                        if (periode === 'HARI_INI') {
                            startFilter = now.startOf('day').toDate();
                            endFilter = now.endOf('day').toDate();
                            labelPeriode = `Hari ini (${now.format('DD/MM/YYYY')})`;
                        } else if (periode === 'TAHUN_INI') {
                            startFilter = now.startOf('year').toDate();
                            endFilter = now.endOf('year').toDate();
                            labelPeriode = `Tahun ${now.format('YYYY')}`;
                        } else if (/^\d{4}-\d{2}-\d{2}$/.test(periode)) {
                            const d = dayjs(periode).tz('Asia/Jakarta');
                            startFilter = d.startOf('day').toDate();
                            endFilter = d.endOf('day').toDate();
                            labelPeriode = `Tanggal ${d.format('DD/MM/YYYY')}`;
                        } else if (/^\d{4}-\d{2}$/.test(periode)) {
                            const d = dayjs(periode + '-01').tz('Asia/Jakarta');
                            startFilter = d.startOf('month').toDate();
                            endFilter = d.endOf('month').toDate();
                            labelPeriode = `Bulan ${d.format('MMMM YYYY')}`;
                        }

                        let rekap = { periode: labelPeriode };

                        if (modul === 'SERAGAM' || modul === 'SEMUA') {
                            const sales = await prisma.uniformSale.findMany({
                                where: {
                                    createdAt: { gte: startFilter, lte: endFilter },
                                    status: { not: 'CANCELLED' }
                                },
                                select: { totalAmount: true, paidAmount: true, paymentStatus: true, type: true }
                            });

                            const totalOmset = sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
                            const totalTerbayar = sales.reduce((sum, s) => sum + (s.paidAmount || 0), 0);
                            const piutang = totalOmset - totalTerbayar;
                            const countLunas = sales.filter(s => s.paymentStatus === 'PAID').length;
                            const countBelumLunas = sales.filter(s => s.paymentStatus !== 'PAID').length;

                            rekap.omsetSeragam = {
                                totalTransaksi: sales.length,
                                totalOmset: `Rp ${Number(totalOmset).toLocaleString('id-ID')}`,
                                danaDiterima: `Rp ${Number(totalTerbayar).toLocaleString('id-ID')}`,
                                piutangBelumLunas: `Rp ${Number(piutang).toLocaleString('id-ID')}`,
                                lunas: `${countLunas} transaksi`,
                                belumLunas: `${countBelumLunas} transaksi`
                            };
                        }

                        if (modul === 'BUS' || modul === 'SEMUA') {
                            const busBookings = await prisma.busBooking.findMany({
                                where: {
                                    startDate: { gte: startFilter, lte: endFilter },
                                    status: { not: 'CANCELLED' }
                                },
                                select: { totalBill: true, isPaid: true }
                            });

                            const totalTagihanBus = busBookings.reduce((sum, b) => sum + (b.totalBill || 0), 0);
                            const busLunas = busBookings.filter(b => b.isPaid).reduce((sum, b) => sum + (b.totalBill || 0), 0);

                            rekap.sewaBus = {
                                totalBooking: busBookings.length,
                                totalPendapatanSewa: `Rp ${Number(totalTagihanBus).toLocaleString('id-ID')}`,
                                lunasTerbayar: `Rp ${Number(busLunas).toLocaleString('id-ID')}`,
                                piutangBelumLunas: `Rp ${Number(totalTagihanBus - busLunas).toLocaleString('id-ID')}`
                            };
                        }

                        apiResponse.data = rekap;
                    } catch (e) {
                        apiResponse.status = "error";
                        apiResponse.message = `Gagal rekap omset: ${e.message}`;
                    }
                }
                else if (call.name === 'cek_agenda_dan_jadwal_sarpras') {
                    try {
                        const periode = (call.args.periode || "MINGGU_INI").toUpperCase();
                        const kw = (call.args.keyword || "").trim();

                        const now = dayjs().tz('Asia/Jakarta');
                        let start = now.startOf('day').toDate();
                        let end = now.add(7, 'day').endOf('day').toDate();

                        if (periode === 'HARI_INI') {
                            start = now.startOf('day').toDate();
                            end = now.endOf('day').toDate();
                        } else if (periode === 'BESOK') {
                            start = now.add(1, 'day').startOf('day').toDate();
                            end = now.add(1, 'day').endOf('day').toDate();
                        } else if (periode === 'BULAN_INI') {
                            start = now.startOf('month').toDate();
                            end = now.endOf('month').toDate();
                        }

                        let where = { date: { gte: start, lte: end } };
                        if (kw) {
                            where.OR = [
                                { title: { contains: kw } },
                                { location: { contains: kw } },
                                { category: { contains: kw } }
                            ];
                        }

                        const events = await prisma.sarprasCalendarEvent.findMany({
                            where,
                            include: { pics: { select: { name: true } } },
                            orderBy: { date: 'asc' },
                            take: 15
                        });

                        apiResponse.data = events.map(e => ({
                            kegiatan: e.title,
                            kategori: e.category,
                            waktu: dayjs(e.date).tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm'),
                            lokasi: e.location || 'Lokasi umum',
                            pic: e.pics.map(p => p.name).join(', ') || 'Belum ada PIC',
                            berulang: e.isRecurring ? `Ya (${e.recurringType})` : 'Tidak'
                        }));
                    } catch (e) {
                        apiResponse.status = "error";
                        apiResponse.message = `Gagal cek agenda sarpras: ${e.message}`;
                    }
                }
                else if (call.name === 'cek_laporan_kinerja_staff') {
                    try {
                        const mode = (call.args.mode || "LAPORAN_HARIAN").toUpperCase();
                        const namaStaff = (call.args.namaStaff || "").trim();
                        const targetDateStr = call.args.tanggal || "HARI_INI";

                        const now = dayjs().tz('Asia/Jakarta');
                        let targetDate = now;
                        if (targetDateStr === 'KEMARIN') targetDate = now.subtract(1, 'day');
                        else if (/^\d{4}-\d{2}-\d{2}$/.test(targetDateStr)) targetDate = dayjs(targetDateStr).tz('Asia/Jakarta');

                        const startOfDay = targetDate.startOf('day').toDate();
                        const endOfDay = targetDate.endOf('day').toDate();

                        if (mode === 'BELUM_LAPOR') {
                            const allStaff = await prisma.user.findMany({
                                where: { role: { in: ['USER', 'ADMIN_UNIT', 'AUDITOR'] } },
                                select: { id: true, name: true, position: true, phone: true }
                            });

                            const reportedToday = await prisma.personnelReport.findMany({
                                where: { date: { gte: startOfDay, lte: endOfDay } },
                                select: { userId: true }
                            });
                            const reportedIds = new Set(reportedToday.map(r => r.userId));

                            const notReported = allStaff.filter(s => !reportedIds.has(s.id));
                            apiResponse.data = {
                                tanggal: targetDate.format('DD MMMM YYYY'),
                                totalStaff: allStaff.length,
                                sudahLapor: reportedToday.length,
                                belumLapor: notReported.length,
                                daftarBelumLapor: notReported.map(s => `${s.name} (${s.position || 'Staf'})`)
                            };
                        } else if (mode === 'SETORAN_HAFALAN') {
                            let whereHafalan = {};
                            if (namaStaff) whereHafalan.user = { name: { contains: namaStaff } };

                            const setoran = await prisma.setoranHafalan.findMany({
                                where: whereHafalan,
                                include: { user: { select: { name: true } } },
                                orderBy: { date: 'desc' },
                                take: 10
                            });

                            apiResponse.data = setoran.map(s => ({
                                staf: s.user?.name || '-',
                                jenis: s.tipeSetoran,
                                juz: `Juz ${s.juz}`,
                                surah: `${s.surah} (Ayat ${s.ayatAwal}-${s.ayatAkhir}, Total ${s.totalAyat} ayat)`,
                                nilai: s.nilai,
                                tanggal: dayjs(s.date).tz('Asia/Jakarta').format('DD/MM/YYYY'),
                                catatan: s.catatan || '-'
                            }));
                        } else if (mode === 'SKOR_KPI') {
                            let whereKPI = { month: targetDate.month() + 1, year: targetDate.year() };
                            if (namaStaff) whereKPI.user = { name: { contains: namaStaff } };

                            const kpiList = await prisma.personnelKPI.findMany({
                                where: whereKPI,
                                include: { user: { select: { name: true, position: true } } },
                                take: 15
                            });

                            apiResponse.data = kpiList.map(k => ({
                                staf: k.user?.name || '-',
                                jabatan: k.user?.position || '-',
                                periode: `${k.month}/${k.year}`,
                                penyelesaianTugas: `${k.completionRate}%`,
                                ketepatanWaktu: `${k.punctualityRate}%`,
                                kepatuhanLapor: `${k.reportRate}%`,
                                skorRataRata: k.averageScore,
                                grade: k.grade || '-'
                            }));
                        } else {
                            let reportWhere = { date: { gte: startOfDay, lte: endOfDay } };
                            if (namaStaff) reportWhere.user = { name: { contains: namaStaff } };

                            const reports = await prisma.personnelReport.findMany({
                                where: reportWhere,
                                include: { user: { select: { name: true, position: true } } },
                                orderBy: { date: 'desc' },
                                take: 10
                            });

                            apiResponse.data = reports.map(r => {
                                let meta = r.metadata;
                                if (typeof meta === 'string') {
                                    try { meta = JSON.parse(meta); } catch(e) {}
                                }
                                const morning = meta?.morningPoints || [];
                                const afternoon = meta?.afternoonPoints || [];

                                return {
                                    staf: r.user?.name || '-',
                                    jabatan: r.user?.position || '-',
                                    kategori: r.category,
                                    tanggal: dayjs(r.date).tz('Asia/Jakarta').format('DD/MM/YYYY'),
                                    ringkasan: r.content,
                                    kegiatanPagi: morning.map(p => `• [${p.status || 'OK'}] ${p.text}${p.obstacleNote ? ` (Kendala: ${p.obstacleNote})` : ''}`).join('\n') || '-',
                                    kegiatanSore: afternoon.map(p => `• [${p.status || 'OK'}] ${p.text}${p.obstacleNote ? ` (Kendala: ${p.obstacleNote})` : ''}`).join('\n') || '-'
                                };
                            });
                        }
                    } catch (e) {
                        apiResponse.status = "error";
                        apiResponse.message = `Gagal cek laporan kinerja staf: ${e.message}`;
                    }
                }
                else if (call.name === 'query_database_bebas') {
                    try {
                        const modelInput = (call.args.modelName || "").trim();
                        const lowerInput = modelInput.toLowerCase();

                        // Normalisasi nama model Prisma agar case-insensitive
                        const prismaKeys = Object.keys(prisma).filter(k => !k.startsWith('$') && !k.startsWith('_'));
                        const matchedKey = prismaKeys.find(k => k.toLowerCase() === lowerInput) || modelInput;

                        if (prisma[matchedKey]) {
                            const where = call.args.whereJson ? JSON.parse(call.args.whereJson) : {};
                            const select = call.args.selectJson ? JSON.parse(call.args.selectJson) : undefined;
                            
                            const queryArgs = {
                                where: Object.keys(where).length > 0 ? where : undefined,
                                take: 25
                            };
                            if (select && Object.keys(select).length > 0) {
                                queryArgs.select = select;
                            }
                            
                            apiResponse.data = await prisma[matchedKey].findMany(queryArgs);
                        } else {
                            apiResponse.status = "error";
                            apiResponse.message = `Model '${modelInput}' tidak ditemukan di database Prisma. Model yang tersedia antara lain: asset, vehicle, busBooking, maintenance, procurement, rKB, uniformSale, invItem, invStock, invOrder, workshopOrder, sarprasCalendarEvent, personnelReport, user, vendor, dll.`;
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
