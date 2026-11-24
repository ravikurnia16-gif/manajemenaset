const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { PrismaClient } = require('@prisma/client');
const mammoth = require('mammoth');
const aiService = require('./aiService');
const minioService = require('./minioService');

dayjs.extend(utc);
dayjs.extend(timezone);

const defaultPrisma = new PrismaClient();

const DEFAULT_SOP_GENERAL_FORMAT = [
    '# STANDAR OPERASIONAL PROSEDUR (SOP)',
    '',
    '## A. Identitas Dokumen',
    '| Parameter | Keterangan |',
    '| :--- | :--- |',
    '| Nomor Dokumen | [Diisi otomatis / sesuai nomor arsip Kantor AI] |',
    '| Judul SOP | [Judul Jelas & Operasional] |',
    '| Unit / Bidang | Bidang Sarana Yayasan Dar el-Iman |',
    '| Tanggal Berlaku & Revisi | [Tanggal / Rev. 01] |',
    '| Penanggung Jawab | Kepala Bidang Sarana |',
    '',
    '## 1. Tujuan',
    '- Menjelaskan maksud utama penyusunan SOP dan standar hasil yang diharapkan.',
    '',
    '## 2. Ruang Lingkup',
    '- Menyebutkan unit kerja, fasilitas, aset, kendaraan, atau proses yang tercakup dalam SOP.',
    '',
    '## 3. Dasar Kebijakan & Referensi',
    '- Mengacu pada ketentuan Yayasan Dar el-Iman, peraturan Bidang Sarana, dan SOP terkait.',
    '',
    '## 4. Definisi & Istilah',
    '| Istilah | Pengertian |',
    '| :--- | :--- |',
    '| PIC | [Penanggung jawab pelaksana langsung di unit / lapangan] |',
    '| Admin Aset / Sarpras | [Petugas pengelola administrasi dan verifikasi sistem SIAD] |',
    '',
    '## 5. Pihak Terkait & Tanggung Jawab',
    '| No | Peran / Pihak Terkait | Tugas & Tanggung Jawab Utama |',
    '| :-- | :--- | :--- |',
    '| 1 | Pemohon / Admin Unit | [Mengajukan permohonan dan melengkapi data awal di sistem] |',
    '| 2 | PIC / Petugas Lapangan | [Melaksanakan pemeriksaan teknis dan eksekusi lapangan] |',
    '| 3 | Admin Aset / Sarpras | [Memverifikasi kelengkapan dokumen dan mencatat ke sistem] |',
    '| 4 | Kepala Bidang Sarana | [Memberikan persetujuan akhir, pengawasan, dan evaluasi] |',
    '',
    '## 6. Prosedur Pelaksanaan (Alur Kerja)',
    '| No | Tahap / Aktivitas | Pelaksana (PIC) | Output / Bukti | Batas Waktu (SLA) |',
    '| :-- | :--- | :--- | :--- | :--- |',
    '| 1 | Persiapan & Pengajuan | [Pemohon / Unit] | [Form pengajuan sistem] | [Hari ke-1] |',
    '| 2 | Verifikasi & Persetujuan | [Admin Aset / Kabid] | [Status disetujui (ACC)] | [1 hari kerja] |',
    '| 3 | Pelaksanaan / Eksekusi Lapangan | [PIC / Teknisi / Staf] | [Bukti foto & laporan kerja] | [Sesuai jadwal] |',
    '| 4 | Pencatatan Sistem & Dokumentasi | [Admin Aset / Staf] | [Log arsip & pembaruan status] | [Hari sama] |',
    '| 5 | Penyelesaian & Serah Terima | [PIC & Penerima] | [Berita Acara / BAST selesai] | [1 hari kerja] |',
    '',
    '## 7. Ketentuan Khusus, Larangan & Sanksi',
    '- Ketentuan batas waktu (SLA) dan kewajiban pelaporan kondisi nyata wajib dipatuhi seluruh unit.',
    '',
    '| No | Pelanggaran / Deviasi | Kategori | Sanksi / Tindak Lanjut |',
    '| :-- | :--- | :--- | :--- |',
    '| 1 | [Keterlambatan pelaporan / pengembalian melebihi SLA] | [Ringan] | [Teguran tertulis & pembatasan akses sementara] |',
    '| 2 | [Kelalaian atau penyalahgunaan aset / fasilitas] | [Berat] | [Berita acara pemeriksaan & sanksi pimpinan] |',
    '',
    '## 8. Formulir & Dokumen Pendukung',
    '| No | Nama Formulir / Dokumen | Kode / Menu Sistem | Keterangan |',
    '| :-- | :--- | :--- | :--- |',
    '| 1 | [Formulir Pengajuan / Ceklis] | [SIAD / sarpras.dareliman.or.id] | [Input digital utama] |',
    '| 2 | [Berita Acara / Bukti Lampiran] | [Lampiran Sistem] | [Dokumentasi serah terima / pemeriksaan] |',
    '',
    '## 9. Evaluasi, Pengesahan & Penutup',
    '- Audit kepatuhan SOP dilaksanakan secara berkala oleh Kepala Bidang Sarana Yayasan Dar el-Iman.',
    '',
    '| Disusun Oleh | Diperiksa Oleh | Disetujui Oleh |',
    '| :--- | :--- | :--- |',
    '| Staf Administrasi Kantor AI | Admin Aset Bidang Sarana | Kepala Bidang Sarana |'
].join('\n');

const MARKDOWN_TABLE_RULES = [
    'ATURAN PENYAJIAN TABEL MARKDOWN (WAJIB DIPATUHI):',
    '- Setiap bagian yang berisi data terstruktur, perbandingan, pembagian peran, alur langkah kerja (Tahap/PIC/Output/SLA), daftar sanksi/ketentuan bertabel, daftar formulir pendukung, daftar metrik operasional, maupun kolom pengesahan WAJIB disajikan sebagai TABEL MARKDOWN VALID — bukan sekadar paragraf atau poin-poin biasa.',
    '- Gunakan format tabel Markdown standar dengan pipe di awal & akhir dan baris pemisah persis di bawah header, contoh:',
    '  | Kolom 1 | Kolom 2 | Kolom 3 |',
    '  | :--- | :--- | :--- |',
    '  | Isi 1 | Isi 2 | Isi 3 |',
    '- Setiap baris tabel HARUS ditulis dalam satu baris utuh (jangan dipisah newline di tengah sel), sisipkan satu baris kosong sebelum dan sesudah tabel, dan JANGAN membungkus dokumen dengan ```markdown ... ```.'
].join('\n');

const DEFAULT_POLICY_GUIDELINES = [
    'Gunakan bahasa Indonesia baku, tegas, sopan, dan bernuansa amanah/islami sesuai kultur Yayasan Dar el-Iman.',
    'Sesuaikan prosedur dengan peran nyata yang berjalan di Bidang Sarana: Kepala Bidang Sarana, Admin Aset, Admin Unit, PIC Kendaraan, Staff Kendaraan, Staff Gudang & Logistik, Teknisi Pemeliharaan, dan Tim Workshop Unit 21.',
    'Semua dokumen yang dihasilkan adalah dokumen kerja internal Kantor AI dan belum dipublikasikan ke E-Office atau modul lain sebelum ditinjau pimpinan.'
].join('\n');

const CURATED_ADMIN_PROPOSALS = [
    {
        title: 'SOP Peminjaman, Pemakaian & Pelaporan KM Kendaraan Operasional (Termasuk Rollover Odometer)',
        category: 'SOP',
        domain: 'Kendaraan',
        priority: 'HIGH',
        rationale: 'Menstandarkan proses booking kendaraan, verifikasi foto odometer bila ada selisih KM, pembatasan digit odometer & rollover ke angka 1, serta kewajiban isi kondisi BBM saat End Trip.',
        brief: 'Susun SOP lengkap mulai pengajuan booking, ceklis pra-jalan, penanganan selisih odometer dan rollover 5-6 digit, hingga pilihan isi BBM sendiri atau lapor PIC saat End Trip.'
    },
    {
        title: 'SOP Ceklis Harian, Mingguan & Bulanan Armada serta Eskalasi Perbaikan Terkontrol',
        category: 'SOP',
        domain: 'Kendaraan',
        priority: 'HIGH',
        rationale: 'Memisahkan pencatatan temuan ceklis rutin harian agar tidak langsung membanjiri antrean request perbaikan sebelum diverifikasi PIC/Staff Kendaraan.',
        brief: 'Jelaskan jadwal pengisian ceklis harian/mingguan/bulanan, kriteria status SIAP JALAN vs PERLU PERBAIKAN, serta mekanisme tindak lanjut manual ke pengajuan perbaikan bengkel.'
    },
    {
        title: 'SOP Peminjaman Aset Inventaris Unit & Aset Kantor Yayasan',
        category: 'SOP',
        domain: 'Aset',
        priority: 'HIGH',
        rationale: 'Mengatur alur peminjaman aset antar unit dan persetujuan khusus oleh Admin Aset untuk aset milik unit Kantor Yayasan.',
        brief: 'Uraikan syarat kelayakan aset dipinjam, persetujuan Admin Unit / Admin Aset (khusus Kantor Yayasan), batas waktu pengembalian, dan pengecekan kondisi saat kembali.'
    },
    {
        title: 'SOP Pengelolaan Pesanan Workshop Kayu & Besi Unit 21',
        category: 'SOP',
        domain: 'Workshop',
        priority: 'NORMAL',
        rationale: 'Menyeragamkan katalog harga tetap, varian bentuk/ukuran, harga custom, estimasi penyelesaian, hingga penyelesaian otomatis saat progres mencapai 100%.',
        brief: 'Buat prosedur pemesanan pekerjaan kayu/besi dari unit kerja ke Workshop Unit 21, penentuan kategori pekerjaan, estimasi biaya, pembaruan progres hingga 100% selesai.'
    },
    {
        title: 'SOP Pengadaan Barang, Verifikasi Penawaran & Serah Terima (BAST)',
        category: 'SOP',
        domain: 'Pengadaan',
        priority: 'NORMAL',
        rationale: 'Memastikan seluruh pengadaan unit melewati validasi spesifikasi, perbandingan vendor yang transparan, dan serah terima terverifikasi.',
        brief: 'Rincikan alur RKB/pengajuan pengadaan, validasi Admin Aset & persetujuan Kepala Bidang Sarana, penerbitan PO/surat tugas, hingga BAST masuk aset/gudang.'
    },
    {
        title: 'Aturan Disiplin Kepatuhan Odometer, Kondisi BBM & Sanksi Keterlambatan Kendaraan',
        category: 'ATURAN',
        domain: 'Kendaraan',
        priority: 'HIGH',
        rationale: 'Menjadi payung hukum tertulis bagi seluruh pengemudi/peminjam kendaraan dinas agar tertib mencatat KM, BBM minimal setengah tangki, dan ketepatan waktu pengembalian.',
        brief: 'Susun pasal-pasal kewajiban pengemudi, toleransi selisih odometer 1 KM, aturan pelaporan BBM < 1/2 tangki, pembekuan akun (sanksi) sementara, serta mekanisme pemulihan.'
    },
    {
        title: 'SOP Pemeliharaan Aset Gedung, Sarpras & Penanganan Laporan Kerusakan Mendesak',
        category: 'SOP',
        domain: 'Pemeliharaan',
        priority: 'NORMAL',
        rationale: 'Memperjelas pembagian penanganan antara laporan kerusakan rutin, darurat, dan koordinasi teknisi lapangan.',
        brief: 'Jabarkan cara pelaporan kerusakan dengan bukti foto, klasifikasi urgensi (Normal/Urgent/Emergency), penugasan teknisi, verifikasi hasil perbaikan, dan penutupan tiket.'
    },
    {
        title: 'Surat Edaran Kepatuhan Audit Aset, Monitoring CCTV ROI & Kebersihan Gudang Logistik',
        category: 'SURAT',
        domain: 'Umum',
        priority: 'NORMAL',
        rationale: 'Mengingatkan seluruh penanggung jawab unit untuk menjaga kerapian aset terdaftar, pengawasan area penting, dan pencatatan mutasi/stok minimum gudang.',
        brief: 'Buat draft surat edaran resmi dari Bidang Sarana kepada seluruh Kepala Unit / PJ Sarpras terkait kepatuhan inventarisasi aset, stok minimum gudang, dan tata tertib keamanan area.'
    },
    {
        title: 'SOP Manajemen Stok Minimum, Penerimaan Vendor & Pengeluaran Barang Gudang Logistik',
        category: 'SOP',
        domain: 'Gudang',
        priority: 'NORMAL',
        rationale: 'Mencegah kekosongan stok barang operasional dan seragam serta menjamin kesesuaian pencatatan fisik dengan sistem.',
        brief: 'Jelaskan tata cara stock opname berkala, ambang batas minStock, penerimaan barang dari vendor, dan serah terima pesanan unit kerja.'
    }
];

const DEFAULT_OFFICE_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.5-flash-lite'
];

const ROUTINE_STALE_LOCK_MS = 5 * 60 * 1000;
const STALE_DRAFTING_MS = 3 * 60 * 1000;

let isRoutineRunning = false;
const routineState = {
    isRunning: false,
    startedAt: null,
    finishedAt: null,
    currentStep: null,
    lastTrigger: null,
    lastResult: null,
    lastError: null
};

function getRoutineState() {
    if (
        routineState.isRunning &&
        routineState.startedAt &&
        Date.now() - new Date(routineState.startedAt).getTime() > ROUTINE_STALE_LOCK_MS
    ) {
        isRoutineRunning = false;
        routineState.isRunning = false;
        routineState.finishedAt = new Date().toISOString();
        routineState.currentStep = null;
        routineState.lastError = 'Shift otomatis melewati batas waktu 5 menit dan direset otomatis.';
    }
    return { ...routineState };
}

function withTimeout(promise, ms, label = 'Permintaan AI') {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
            reject(new Error(`${label} timeout setelah ${Math.round(ms / 1000)} detik.`));
        }, ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timer) clearTimeout(timer);
    });
}

async function invokeOfficeGemini(payload, timeoutMs = 25000) {
    const proto = aiService ? Object.getPrototypeOf(aiService) : null;
    const isCustomFallback =
        aiService &&
        typeof aiService.generateContentWithFallback === 'function' &&
        proto &&
        aiService.generateContentWithFallback !== proto.generateContentWithFallback;

    if (isCustomFallback || !aiService?.genAI) {
        const res = await withTimeout(
            aiService.generateContentWithFallback(payload),
            timeoutMs,
            'Gemini AI'
        );
        const text = res?.response?.text?.()?.trim() || '';
        if (!text) throw new Error('Respons AI kosong');
        return { text, model: 'custom-fallback' };
    }

    let lastError = null;
    for (const modelName of DEFAULT_OFFICE_MODELS) {
        try {
            const model = aiService.genAI.getGenerativeModel({ model: modelName });
            const res = await withTimeout(
                model.generateContent(payload),
                timeoutMs,
                `Gemini (${modelName})`
            );
            const text = res?.response?.text?.()?.trim() || '';
            if (!text) throw new Error(`Respons AI kosong (${modelName})`);
            return { text, model: modelName };
        } catch (err) {
            lastError = err;
            console.warn(`[AI Office] Model ${modelName} gagal: ${err.message}`);
        }
    }

    throw lastError || new Error('Semua model Gemini untuk Kantor AI gagal merespons.');
}

async function generateOfficeAiText(prompt, { timeoutMs = 25000 } = {}) {
    return invokeOfficeGemini(prompt, timeoutMs);
}

async function generateOfficeAiMultimodal(parts, { timeoutMs = 40000 } = {}) {
    return invokeOfficeGemini(parts, timeoutMs);
}

function decodeHtmlEntities(str) {
    return String(str || '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10) || 32));
}

function cleanMarkdownFence(text) {
    const trimmed = String(text || '').trim();
    const fenced = trimmed.match(/^```(?:markdown|md)?\s*\r?\n([\s\S]*?)\r?\n```$/i);
    return fenced ? fenced[1].trim() : trimmed;
}

function convertMammothHtmlToMarkdown(html) {
    if (!html) return '';
    let work = String(html);

    work = work.replace(/<table[\s\S]*?<\/table>/gi, (tableHtml) => {
        const rowMatches = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
        if (rowMatches.length === 0) return '';
        const parsedRows = rowMatches
            .map((rowHtml) => {
                const cellMatches = rowHtml.match(/<(th|td)\b[\s\S]*?<\/\1>/gi) || [];
                return cellMatches.map((cellHtml) =>
                    decodeHtmlEntities(
                        cellHtml
                            .replace(/<br\s*\/?>/gi, ' ')
                            .replace(/<\/p>/gi, ' ')
                            .replace(/<[^>]+>/g, ' ')
                            .replace(/\|/g, '\\|')
                            .replace(/\s+/g, ' ')
                            .trim()
                    )
                );
            })
            .filter(r => r.length > 0);
        if (parsedRows.length === 0) return '';
        const colCount = Math.max(...parsedRows.map(r => r.length));
        const normalized = parsedRows.map((r) => {
            const row = [...r];
            while (row.length < colCount) row.push('');
            return row;
        });
        const header = normalized[0];
        const sep = new Array(colCount).fill(':---');
        const lines = [
            `| ${header.join(' | ')} |`,
            `| ${sep.join(' | ')} |`,
            ...normalized.slice(1).map(r => `| ${r.join(' | ')} |`)
        ];
        return `\n\n${lines.join('\n')}\n\n`;
    });

    work = work.replace(/<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, lvl, inner) => {
        const hashes = '#'.repeat(parseInt(lvl, 10));
        const clean = decodeHtmlEntities(inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
        return clean ? `\n\n${hashes} ${clean}\n\n` : '';
    });

    work = work.replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner) => {
        let idx = 1;
        return '\n' + inner.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_m, liInner) => {
            const clean = decodeHtmlEntities(liInner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
            return clean ? `${idx++}. ${clean}\n` : '';
        }) + '\n';
    });

    work = work.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, liInner) => {
        const clean = decodeHtmlEntities(liInner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
        return clean ? `\n- ${clean}` : '';
    });

    work = work.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, _tag, inner) => {
        const txt = inner.replace(/<[^>]+>/g, '').trim();
        return txt ? `**${txt}**` : '';
    });
    work = work.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, _tag, inner) => {
        const txt = inner.replace(/<[^>]+>/g, '').trim();
        return txt ? `*${txt}*` : '';
    });

    work = work
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<p\b[^>]*>/gi, '')
        .replace(/<[^>]+>/g, '');

    return decodeHtmlEntities(work)
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

const SOP_TEMPLATE_MIME_MAP = {
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pdf: 'application/pdf',
    txt: 'text/plain',
    md: 'text/markdown',
    markdown: 'text/markdown',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp'
};

function validateSopTemplateUpload({ buffer, originalname = '', mimetype = '' } = {}) {
    const buf = Buffer.isBuffer(buffer) ? buffer : (buffer ? Buffer.from(buffer) : null);
    if (!buf || buf.length === 0) {
        const err = new Error('File dokumen format SOP kosong atau tidak terbaca.');
        err.statusCode = 400;
        throw err;
    }

    const ext = String(originalname || '').toLowerCase().split('.').pop();
    if (ext === 'doc') {
        const err = new Error('Format .doc lama tidak didukung langsung. Silakan simpan ulang sebagai .docx atau .pdf lalu unggah kembali.');
        err.statusCode = 400;
        throw err;
    }

    if (!Object.prototype.hasOwnProperty.call(SOP_TEMPLATE_MIME_MAP, ext)) {
        const err = new Error('Format file tidak didukung. Gunakan file .docx, .pdf, .txt, .md, atau gambar (.png/.jpg/.webp).');
        err.statusCode = 400;
        throw err;
    }

    return {
        buf,
        originalname: String(originalname || `format-sop.${ext}`),
        ext,
        mimeType: SOP_TEMPLATE_MIME_MAP[ext] || mimetype || 'application/octet-stream'
    };
}

async function saveSopTemplateFile({ buffer, originalname = '', mimetype = '' } = {}) {
    const { buf, originalname: safeOriginal, ext, mimeType } = validateSopTemplateUpload({
        buffer,
        originalname,
        mimetype
    });
    const sanitizedName = safeOriginal.replace(/[^a-zA-Z0-9._-]/g, '_');
    const localDir = path.join(__dirname, '../uploads/ai-office-templates');

    try {
        const fileUrl = await minioService.uploadFile(buf, sanitizedName, mimeType, 'ai-office-templates');
        return { fileUrl, fileName: safeOriginal, mimeType, ext, storage: 'minio' };
    } catch (minioErr) {
        console.warn(`[AI Office] MinIO template upload fallback ke local storage: ${minioErr.message}`);
        await fs.promises.mkdir(localDir, { recursive: true });
        const uniqueName = `${Date.now()}-${sanitizedName}`;
        const absPath = path.join(localDir, uniqueName);
        await fs.promises.writeFile(absPath, buf);
        return {
            fileUrl: `/uploads/ai-office-templates/${uniqueName}`,
            fileName: safeOriginal,
            mimeType,
            ext,
            storage: 'local'
        };
    }
}

async function deleteSopTemplateFile(fileUrl) {
    if (!fileUrl) return;
    const rawUrl = String(fileUrl);
    if (rawUrl.startsWith('/api/media/')) {
        await minioService.deleteFile(rawUrl);
        return;
    }
    if (rawUrl.startsWith('/uploads/ai-office-templates/')) {
        const relName = path.basename(rawUrl);
        const absPath = path.join(__dirname, '../uploads/ai-office-templates', relName);
        await fs.promises.unlink(absPath).catch(() => {});
    }
}

function streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
    });
}

async function loadSopTemplateReference(config) {
    const fileUrl = config?.sopTemplateFileUrl;
    if (!fileUrl) return null;

    const fileName = config.sopTemplateFileName || 'format-sop';
    const ext = String(fileName || fileUrl).toLowerCase().split('.').pop();
    const mimeType = config.sopTemplateMimeType || SOP_TEMPLATE_MIME_MAP[ext] || 'application/octet-stream';

    try {
        const rawUrl = String(fileUrl);
        if (rawUrl.startsWith('/uploads/ai-office-templates/')) {
            const relName = path.basename(rawUrl);
            const absPath = path.join(__dirname, '../uploads/ai-office-templates', relName);
            const buffer = await fs.promises.readFile(absPath);
            return { buffer, fileName, mimeType, ext };
        }
        if (rawUrl.startsWith('/api/media/')) {
            const objectName = rawUrl.replace('/api/media/', '');
            const stream = await minioService.minioClient.getObject(minioService.bucketName, objectName);
            const buffer = await streamToBuffer(stream);
            return { buffer, fileName, mimeType, ext };
        }
    } catch (err) {
        console.warn(`[AI Office] Gagal membaca dokumen pedoman SOP "${fileName}": ${err.message}`);
    }
    return null;
}

async function buildSopTemplatePromptContext(config, { templateLoader = loadSopTemplateReference } = {}) {
    const ref = await templateLoader(config);
    const textFormat = config?.sopGeneralFormat && String(config.sopGeneralFormat).trim()
        ? String(config.sopGeneralFormat).trim()
        : '';

    if (ref?.buffer && ref.buffer.length > 0) {
        if (['pdf', 'png', 'jpg', 'jpeg', 'webp'].includes(ref.ext)) {
            const extraNote = textFormat
                ? `\nCATATAN / PANDUAN FORMAT TEKS TAMBAHAN DARI PIMPINAN:\n${textFormat}`
                : '';
            return {
                mode: 'multimodal',
                fileName: ref.fileName,
                inlineData: {
                    mimeType: ref.mimeType,
                    data: ref.buffer.toString('base64')
                },
                instructions: `TERLAMPIR DOKUMEN FORMAT SOP RESMI DARI PIMPINAN ("${ref.fileName}").
WAJIB BERPEDOMAN LANGSUNG pada dokumen terlampir tersebut (lihat struktur kop/identitas dokumen, urutan bab & sub-bab, nama kolom tabel, formulir pendukung, dan blok pengesahan), lalu ISI seluruh bagiannya dengan prosedur operasional yang konkret, lengkap, dan siap pakai untuk judul SOP di atas.${extraNote}`
            };
        }

        let extractedRefText = '';
        if (ref.ext === 'docx') {
            try {
                const htmlRes = await mammoth.convertToHtml({ buffer: ref.buffer });
                extractedRefText = convertMammothHtmlToMarkdown(htmlRes.value || '');
                if (!extractedRefText) {
                    const txtRes = await mammoth.extractRawText({ buffer: ref.buffer });
                    extractedRefText = String(txtRes.value || '').trim();
                }
            } catch (err) {
                console.warn(`[AI Office] Gagal membaca dokumen .docx pedoman "${ref.fileName}": ${err.message}`);
            }
        } else if (['txt', 'md', 'markdown'].includes(ref.ext)) {
            extractedRefText = ref.buffer.toString('utf8').replace(/^\uFEFF/, '').trim();
        }

        if (extractedRefText) {
            const extraNote = textFormat
                ? `\n\nCATATAN / PANDUAN FORMAT TEKS TAMBAHAN DARI PIMPINAN:\n${textFormat}`
                : '';
            return {
                mode: 'text',
                fileName: ref.fileName,
                instructions: `DOKUMEN FORMAT SOP RESMI DARI PIMPINAN ("${ref.fileName}"):
WAJIB BERPEDOMAN PENUH pada struktur dokumen berikut (pertahankan urutan bab, kolom tabel, dan format pengesahan lalu ISI kontennya secara operasional dan spesifik sesuai judul SOP):\n\n${extractedRefText.slice(0, 24000)}${extraNote}`
            };
        }
    }

    return {
        mode: 'text',
        fileName: null,
        instructions: `WAJIB mengikuti dan mengembangkan FORMAT SOP UMUM dari pimpinan di bawah ini menjadi SOP yang sangat operasional, lengkap, detail, dan siap pakai (pertahankan dan lengkapi setiap bagian bertabel menjadi tabel Markdown nyata dengan isi spesifik):\n\n${textFormat || DEFAULT_SOP_GENERAL_FORMAT}`
    };
}

async function extractSopFormatFromFile({ buffer, originalname = '', mimetype = '' } = {}) {
    const { buf, ext, mimeType } = validateSopTemplateUpload({ buffer, originalname, mimetype });

    if (['txt', 'md', 'markdown'].includes(ext)) {
        const raw = buf.toString('utf8').replace(/^\uFEFF/, '').trim();
        if (!raw) {
            const err = new Error('Isi file teks kosong.');
            err.statusCode = 400;
            throw err;
        }
        return {
            formatText: raw,
            extractedBy: 'text',
            fileName: originalname,
            usedFallback: false
        };
    }

    if (ext === 'docx') {
        const htmlResult = await mammoth.convertToHtml({ buffer: buf });
        let rawMarkdown = convertMammothHtmlToMarkdown(htmlResult.value || '');
        if (!rawMarkdown) {
            const textResult = await mammoth.extractRawText({ buffer: buf });
            rawMarkdown = String(textResult.value || '').trim();
        }
        if (!rawMarkdown) {
            const err = new Error('Dokumen Word (.docx) tidak memiliki teks yang dapat dibaca.');
            err.statusCode = 400;
            throw err;
        }

        let formatText = rawMarkdown;
        let usedFallback = false;
        let extractedBy = 'docx-ai';
        try {
            const aiPrompt = `Anda menerima hasil konversi dokumen contoh Format SOP dari pimpinan Bidang Sarana Yayasan Dar el-Iman.
Rapikan dan jadikan teks berikut sebagai TEMPLATE FORMAT SOP UMUM dalam bahasa Indonesia berformat Markdown bersih yang siap dijadikan acuan pembuatan berbagai SOP baru.

ATURAN WAJIB:
- Pertahankan SELURUH struktur bab, penomoran, poin, serta tabel Markdown (| kolom | ... dengan pemisah | :--- | ...) yang ada pada dokumen sumber.
- Jika ada isi spesifik contoh (misal nomor surat lama, tanggal tertentu, atau uraian contoh konkret), ubah bagian isiannya menjadi placeholder jelas dalam kurung siku [ ... ] agar bisa dipakai ulang untuk SOP apa pun, sambil tetap menjaga nama kolom tabel dan struktur bab asli.
- Kembalikan HANYA teks Markdown template tanpa komentar pengantar/penutup dan tanpa pembungkus kode \`\`\`.

DOKUMEN SUMBER:
${rawMarkdown.slice(0, 24000)}`;
            const aiRes = await generateOfficeAiText(aiPrompt, { timeoutMs: 30000 });
            const cleaned = cleanMarkdownFence(aiRes.text);
            if (cleaned) {
                formatText = cleaned;
            } else {
                usedFallback = true;
                extractedBy = 'docx';
            }
        } catch {
            usedFallback = true;
            extractedBy = 'docx';
        }

        return {
            formatText,
            extractedBy,
            fileName: originalname,
            usedFallback
        };
    }

    const mimeMap = {
        pdf: 'application/pdf',
        png: 'image/png',
        webp: 'image/webp',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg'
    };
    const resolvedMime = mimeMap[ext] || mimetype || 'application/pdf';
    const aiPrompt = `Ekstrak struktur & contoh Format SOP dari dokumen terlampir menjadi TEMPLATE FORMAT SOP UMUM dalam format Markdown yang bersih untuk Bidang Sarana Yayasan Dar el-Iman.

ATURAN WAJIB:
- Pertahankan seluruh judul, bab/sub-bab, urutan poin, tanda tangan/kolom pengesahan, dan TABEL secara akurat.
- Semua tabel WAJIB ditulis sebagai tabel Markdown valid (\`| Kolom 1 | Kolom 2 |\` diikuti baris pemisah \`| :--- | :--- |\`).
- Gunakan placeholder jelas dalam tanda kurung siku \`[ ... ]\` untuk bagian yang nantinya diisi menyesuaikan masing-masing judul SOP baru.
- Kembalikan HANYA isi Markdown template saja tanpa pengantar dan tanpa blok \`\`\`.`;

    try {
        const aiRes = await generateOfficeAiMultimodal([
            aiPrompt,
            {
                inlineData: {
                    mimeType: resolvedMime,
                    data: buf.toString('base64')
                }
            }
        ], { timeoutMs: 40000 });
        const formatText = cleanMarkdownFence(aiRes.text);
        if (!formatText) {
            throw new Error('Hasil ekstraksi dokumen kosong.');
        }
        return {
            formatText,
            extractedBy: ext === 'pdf' ? 'pdf-ai' : 'image-ai',
            fileName: originalname,
            usedFallback: false
        };
    } catch (aiErr) {
        const err = new Error(
            `Gagal mengekstrak format SOP dari file ${ext.toUpperCase()} melalui AI (${aiErr.message}). Silakan coba ulangi atau unggah dalam format .docx / .txt / .md.`
        );
        err.statusCode = 422;
        throw err;
    }
}

async function recoverStaleDraftingItems(prismaClient = defaultPrisma, maxAgeMs = STALE_DRAFTING_MS) {
    if (!prismaClient?.aiOfficeItem?.updateMany) return { count: 0 };
    const cutoff = new Date(Date.now() - maxAgeMs);
    return prismaClient.aiOfficeItem.updateMany({
        where: {
            status: 'DRAFTING',
            updatedAt: { lt: cutoff }
        },
        data: { status: 'APPROVED_FOR_DRAFT' }
    });
}

function getTodayWib() {
    return dayjs().tz('Asia/Jakarta').format('YYYY-MM-DD');
}

function getCategoryPrefix(category) {
    switch (String(category || '').toUpperCase()) {
        case 'LAPORAN_HARIAN': return 'SUP';
        case 'SOP': return 'SOP';
        case 'ATURAN': return 'ATR';
        case 'SURAT': return 'SRT';
        default: return 'DOK';
    }
}

async function generateItemCode(prismaClient, category, outputDate = getTodayWib()) {
    const prefix = getCategoryPrefix(category);
    const compactDate = outputDate.replace(/-/g, '');
    const codePrefix = `AIO/${prefix}/${compactDate}-`;

    const existing = await prismaClient.aiOfficeItem.findMany({
        where: { code: { startsWith: codePrefix } },
        select: { code: true }
    });

    let maxSeq = 0;
    for (const row of existing) {
        const tail = row.code.slice(codePrefix.length);
        const parsed = parseInt(tail, 10);
        if (!Number.isNaN(parsed) && parsed > maxSeq) maxSeq = parsed;
    }

    const nextSeq = String(maxSeq + 1).padStart(3, '0');
    return `${codePrefix}${nextSeq}`;
}

async function getOrCreateConfig(prismaClient = defaultPrisma) {
    let config = await prismaClient.aiOfficeConfig.findUnique({
        where: { id: 1 }
    });

    if (!config) {
        config = await prismaClient.aiOfficeConfig.create({
            data: {
                id: 1,
                isEnabled: true,
                supervisorName: 'Staf Supervisi AI',
                adminStaffName: 'Staf Administrasi AI',
                dailyScheduleHour: 7,
                dailyScheduleMinute: 30,
                eveningScheduleHour: 16,
                maxDailyDrafts: 2,
                sopGeneralFormat: DEFAULT_SOP_GENERAL_FORMAT,
                policyGuidelines: DEFAULT_POLICY_GUIDELINES
            }
        });
    }

    return config;
}

async function safeCount(fn, fallback = 0) {
    try {
        return await fn();
    } catch {
        return fallback;
    }
}

async function safeFindMany(fn, fallback = []) {
    try {
        return await fn();
    } catch {
        return fallback;
    }
}

async function collectOperationalSnapshot(prismaClient = defaultPrisma) {
    const now = new Date();
    const todayStart = dayjs().tz('Asia/Jakarta').startOf('day').toDate();
    const sevenDaysAgo = dayjs().tz('Asia/Jakarta').subtract(7, 'day').startOf('day').toDate();

    const [
        totalAssets,
        assetsMinorDamage,
        assetsHeavyDamage,
        pendingAssetLoans,
        borrowedAssetLoans,
        overdueAssetLoans,
        openMaintenances,
        urgentMaintenances,
        openMaintenanceList,
        activeVehicles,
        inactiveVehicles,
        pendingVehicleServices,
        inProgressVehicleServices,
        todayVehicleChecklists,
        recentNeedRepairChecklists,
        activeVehicleBookings,
        activeWorkshopOrders,
        activeWorkshopList,
        openProcurements,
        warehouseStocks,
        existingRules,
        existingAiItems
    ] = await Promise.all([
        safeCount(() => prismaClient.asset.count()),
        safeCount(() => prismaClient.asset.count({ where: { condition: 'RUSAK_RINGAN' } })),
        safeCount(() => prismaClient.asset.count({ where: { condition: 'RUSAK_BERAT' } })),
        safeCount(() => prismaClient.assetLoan.count({ where: { status: 'PENDING' } })),
        safeCount(() => prismaClient.assetLoan.count({ where: { status: 'BORROWED' } })),
        safeCount(() => prismaClient.assetLoan.count({ where: { status: 'BORROWED', expectedReturnDate: { lt: now } } })),
        safeCount(() => prismaClient.maintenance.count({ where: { status: { notIn: ['COMPLETED', 'REJECTED'] } } })),
        safeCount(() => prismaClient.maintenance.count({ where: { status: { notIn: ['COMPLETED', 'REJECTED'] }, urgency: { in: ['URGENT', 'EMERGENCY'] } } })),
        safeFindMany(() => prismaClient.maintenance.findMany({
            where: { status: { notIn: ['COMPLETED', 'REJECTED'] } },
            select: { code: true, title: true, urgency: true, status: true },
            orderBy: { createdAt: 'desc' },
            take: 5
        })),
        safeCount(() => prismaClient.vehicle.count({ where: { status: 'ACTIVE' } })),
        safeCount(() => prismaClient.vehicle.count({ where: { status: 'INACTIVE' } })),
        safeCount(() => prismaClient.vehicleService.count({ where: { status: 'PENDING' } })),
        safeCount(() => prismaClient.vehicleService.count({ where: { status: 'IN_PROGRESS' } })),
        safeCount(() => prismaClient.vehicleChecklist.count({ where: { createdAt: { gte: todayStart } } })),
        safeCount(() => prismaClient.vehicleChecklist.count({ where: { status: 'PERLU PERBAIKAN', createdAt: { gte: sevenDaysAgo } } })),
        safeCount(() => prismaClient.vehicleBooking.count({ where: { status: { in: ['PENDING', 'APPROVED', 'BERLANGSUNG'] } } })),
        safeCount(() => prismaClient.workshopOrder.count({ where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } })),
        safeFindMany(() => prismaClient.workshopOrder.findMany({
            where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
            select: { code: true, title: true, status: true, priority: true },
            orderBy: { createdAt: 'desc' },
            take: 5
        })),
        safeCount(() => prismaClient.procurement.count({ where: { status: { in: ['SUBMITTED', 'VALIDATED', 'APPROVED', 'PROCESS'] } } })),
        safeFindMany(() => prismaClient.warehouseItem.findMany({ select: { name: true, stock: true, minStock: true } })),
        safeFindMany(() => prismaClient.sarprasRule.findMany({ select: { title: true, category: true } })),
        safeFindMany(() => prismaClient.aiOfficeItem.findMany({
            where: { status: { not: 'REJECTED' } },
            select: { title: true, category: true, status: true }
        }))
    ]);

    const lowStockItems = (warehouseStocks || []).filter(item => (item.stock || 0) <= (item.minStock || 5));

    return {
        capturedAt: dayjs().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm WIB'),
        outputDate: getTodayWib(),
        assets: {
            total: totalAssets,
            rusakRingan: assetsMinorDamage,
            rusakBerat: assetsHeavyDamage,
            loansPending: pendingAssetLoans,
            loansBorrowed: borrowedAssetLoans,
            loansOverdue: overdueAssetLoans
        },
        maintenance: {
            openCount: openMaintenances,
            urgentCount: urgentMaintenances,
            recentOpen: openMaintenanceList
        },
        vehicles: {
            active: activeVehicles,
            inactive: inactiveVehicles,
            servicePending: pendingVehicleServices,
            serviceInProgress: inProgressVehicleServices,
            checklistsToday: todayVehicleChecklists,
            checklistsNeedRepairLast7d: recentNeedRepairChecklists,
            activeBookings: activeVehicleBookings
        },
        workshop: {
            activeOrders: activeWorkshopOrders,
            recentActive: activeWorkshopList
        },
        procurement: {
            openCount: openProcurements
        },
        warehouse: {
            totalItems: (warehouseStocks || []).length,
            lowStockCount: lowStockItems.length,
            lowStockSample: lowStockItems.slice(0, 5).map(i => `${i.name} (stok ${i.stock}/min ${i.minStock})`)
        },
        existingGovernanceTitles: [
            ...(existingRules || []).map(r => r.title),
            ...(existingAiItems || []).map(i => i.title)
        ].filter(Boolean)
    };
}

function buildFallbackSupervisorReport(snapshot, config) {
    const a = snapshot.assets;
    const m = snapshot.maintenance;
    const v = snapshot.vehicles;
    const w = snapshot.workshop;
    const wh = snapshot.warehouse;
    const cleanCell = (val) => String(val ?? '-').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();

    const recentMaintSection = (m.recentOpen || []).length > 0
        ? [
            '| Kode | Judul Pekerjaan | Urgensi | Status |',
            '| :--- | :--- | :--- | :--- |',
            ...m.recentOpen.map(item => `| ${cleanCell(item.code)} | ${cleanCell(item.title)} | ${cleanCell(item.urgency)} | ${cleanCell(item.status)} |`)
        ].join('\n')
        : '- Tidak ada tiket pemeliharaan aset yang terbuka saat ini.';

    const recentWorkshopSection = (w.recentActive || []).length > 0
        ? [
            '| Kode | Nama Pekerjaan | Prioritas | Status |',
            '| :--- | :--- | :--- | :--- |',
            ...w.recentActive.map(item => `| ${cleanCell(item.code)} | ${cleanCell(item.title)} | ${cleanCell(item.priority)} | ${cleanCell(item.status)} |`)
        ].join('\n')
        : '- Tidak ada pekerjaan workshop aktif saat ini.';

    return [
        `# LAPORAN SUPERVISI HARIAN BIDANG SARANA`,
        ``,
        `| Parameter | Keterangan |`,
        `| :--- | :--- |`,
        `| Kepada Yth | Kepala Bidang Sarana Yayasan Dar el-Iman |`,
        `| Dari | ${cleanCell(config.supervisorName)} |`,
        `| Tanggal | ${snapshot.outputDate} (${snapshot.capturedAt}) |`,
        ``,
        `## 1. Ringkasan Eksekutif`,
        `Assalamu'alaikum warahmatullahi wabarakatuh. Berikut adalah laporan pengawasan operasional harian Bidang Sarana berdasarkan data langsung dari sistem Manajemen Aset.`,
        `Saat ini tercatat **${a.total} aset terdaftar** (${a.rusakRingan} rusak ringan, ${a.rusakBerat} rusak berat), **${m.openCount} tiket pemeliharaan terbuka** (${m.urgentCount} mendesak), **${v.active} kendaraan aktif**, **${w.activeOrders} order Workshop Unit 21**, serta **${snapshot.procurement.openCount} pengadaan berjalan**.`,
        ``,
        `## 2. Statistik Operasional Hari Ini`,
        `| Bidang | Kondisi / Angka Terkini | Perhatian Khusus |`,
        `| :--- | :--- | :--- |`,
        `| Aset & Peminjaman | ${a.total} total (${a.rusakRingan} rusak ringan, ${a.rusakBerat} rusak berat) | ${a.loansPending} tunggu ACC, ${a.loansBorrowed} dipinjam (${a.loansOverdue} terlambat) |`,
        `| Pemeliharaan Aset | ${m.openCount} tiket aktif terbuka | ${m.urgentCount} berstatus URGENT/EMERGENCY |`,
        `| Armada Kendaraan | ${v.active} aktif, ${v.inactive} non-aktif, ${v.activeBookings} booking aktif | ${v.servicePending} servis tunggu ACC, ${v.serviceInProgress} di bengkel, ${v.checklistsNeedRepairLast7d} temuan ceklis 7 hari |`,
        `| Workshop Unit 21 | ${w.activeOrders} pekerjaan aktif | Pantau progres menuju 100% |`,
        `| Pengadaan & Gudang | ${snapshot.procurement.openCount} pengadaan berjalan | ${wh.lowStockCount} dari ${wh.totalItems} item stok di batas minimum |`,
        ``,
        `## 3. Sorotan Temuan & Prioritas Pengawasan`,
        `### Tiket Pemeliharaan Aset Aktif`,
        recentMaintSection,
        ``,
        `### Antrean Pekerjaan Workshop Unit 21`,
        recentWorkshopSection,
        ``,
        `### Item Gudang Stok Menipis`,
        wh.lowStockSample.length > 0 ? wh.lowStockSample.map(s => `- ${s}`).join('\n') : '- Seluruh stok gudang masih di atas batas minimum.',
        ``,
        `## 4. Rekomendasi Tindak Lanjut Lapangan`,
        `1. Tindak lanjuti **${a.loansOverdue} peminjaman aset terlambat** dan **${a.loansPending} permohonan menunggu persetujuan**.`,
        `2. Prioritaskan penyelesaian **${m.urgentCount} pemeliharaan urgent** serta review **${v.servicePending} pengajuan servis kendaraan**.`,
        `3. Evaluasi **${v.checklistsNeedRepairLast7d} temuan ceklis perlu perbaikan** dalam 7 hari terakhir bersama PIC Armada sebelum membuat request bengkel bila diperlukan.`,
        `4. Lakukan restock untuk **${wh.lowStockCount} item gudang** yang mencapai stok minimum.`,
        ``,
        `_Catatan: Disusun otomatis dalam mode ringkasan deterministik terverifikasi (internal Kantor AI)._`
    ].join('\n');
}

async function runSupervisorShift({
    prisma = defaultPrisma,
    trigger = 'MANUAL',
    actor = null,
    force = false
} = {}) {
    const config = await getOrCreateConfig(prisma);
    const outputDate = getTodayWib();

    if (!force) {
        const existingToday = await prisma.aiOfficeItem.findFirst({
            where: {
                category: 'LAPORAN_HARIAN',
                staffRole: 'SUPERVISI',
                outputDate
            },
            orderBy: { createdAt: 'desc' }
        });

        if (existingToday) {
            return { skipped: true, item: existingToday, reason: 'Laporan supervisi hari ini sudah tersedia.' };
        }
    }

    const snapshot = await collectOperationalSnapshot(prisma);
    let content = '';
    let usedFallback = false;
    let aiError = null;

    const prompt = `Anda adalah ${config.supervisorName} di Kantor AI Bidang Sarana Yayasan Dar el-Iman.
Tugas Anda menyusun **Laporan Supervisi Harian kepada Kepala Bidang Sarana** berdasarkan data operasional NYATA berikut (DILARANG keras mengarang atau mengubah angka di luar data JSON ini):

DATA REAL DATABASE (${snapshot.capturedAt}):
${JSON.stringify({
    outputDate: snapshot.outputDate,
    assets: snapshot.assets,
    maintenance: snapshot.maintenance,
    vehicles: snapshot.vehicles,
    workshop: snapshot.workshop,
    procurement: snapshot.procurement,
    warehouse: snapshot.warehouse
}, null, 2)}

ATURAN PENULISAN:
${config.policyGuidelines || DEFAULT_POLICY_GUIDELINES}

${MARKDOWN_TABLE_RULES}

FORMAT LAPORAN (Markdown rapi, profesional, ringkas dan siap dibaca pimpinan di lapangan):
1. Judul & Header Resmi dalam tabel 2 kolom (Kepada Yth: Kepala Bidang Sarana, Dari: ${config.supervisorName}, Tanggal: ${outputDate})
2. Ringkasan Eksekutif (kondisi umum hari ini dalam 1-2 paragraf)
3. Statistik Operasional Terverifikasi — WAJIB disajikan sebagai **TABEL MARKDOWN** per bidang sesuai angka persis dari JSON (kolom: Bidang | Status / Angka Terkini | Catatan Prioritas)
4. Sorotan Temuan & Tiket/Pekerjaan Prioritas — jika ada daftar tiket maintenance/workshop/stok menipis, sajikan dalam **TABEL MARKDOWN**
5. Rekomendasi Tindak Lanjut Konkret untuk Kepala Bidang Sarana hari ini
6. Saran Usulan SOP / Aturan baru bila terlihat ada celah operasional.`;

    try {
        const aiRes = await generateOfficeAiText(prompt);
        content = cleanMarkdownFence(aiRes.text);
    } catch (err) {
        usedFallback = true;
        aiError = err.message;
        content = buildFallbackSupervisorReport(snapshot, config);
    }

    const code = await generateItemCode(prisma, 'LAPORAN_HARIAN', outputDate);
    const item = await prisma.aiOfficeItem.create({
        data: {
            code,
            staffRole: 'SUPERVISI',
            category: 'LAPORAN_HARIAN',
            domain: 'Umum',
            title: `Laporan Supervisi Harian Bidang Sarana — ${dayjs(outputDate).format('DD MMM YYYY')}`,
            rationale: 'Output harian wajib Staf Supervisi AI berdasarkan pantauan data operasional sistem.',
            brief: `Pantauan aset (${snapshot.assets.total}), maintenance terbuka (${snapshot.maintenance.openCount}), kendaraan aktif (${snapshot.vehicles.active}), workshop aktif (${snapshot.workshop.activeOrders}).`,
            priority: (snapshot.maintenance.urgentCount > 0 || snapshot.assets.loansOverdue > 0) ? 'HIGH' : 'NORMAL',
            status: 'DRAFT_READY',
            content,
            metricsSnapshot: JSON.stringify(snapshot),
            outputDate,
            triggeredBy: trigger,
            createdById: actor?.id || null,
            createdByName: actor?.name || config.supervisorName
        }
    });

    await prisma.aiOfficeConfig.update({
        where: { id: 1 },
        data: { lastSupervisorRunAt: new Date() }
    });

    await prisma.aiOfficeRunLog.create({
        data: {
            staffRole: 'SUPERVISI',
            trigger,
            status: usedFallback ? 'PARTIAL' : 'SUCCESS',
            summary: `Menerbitkan laporan supervisi harian ${item.code}${usedFallback ? ' (fallback terstruktur)' : ''}.`,
            itemsCreated: 1,
            itemsDrafted: 1,
            errorMessage: aiError
        }
    });

    return { skipped: false, usedFallback, item };
}

function parseJsonArrayFromText(rawText) {
    const cleaned = String(rawText || '')
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
    const startIdx = cleaned.indexOf('[');
    const endIdx = cleaned.lastIndexOf(']');
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
        throw new Error('Output AI tidak memuat array JSON yang valid');
    }
    const parsed = JSON.parse(cleaned.slice(startIdx, endIdx + 1));
    if (!Array.isArray(parsed)) throw new Error('Hasil parse bukan array');
    return parsed;
}

function normalizeProposalCategory(rawCat, fallbackCategory = 'SOP') {
    const upper = String(rawCat || '').toUpperCase().trim();
    if (['SOP', 'ATURAN', 'SURAT', 'LAINNYA'].includes(upper)) return upper;
    if (upper.includes('ATURAN') || upper.includes('KEBIJAKAN') || upper.includes('TATA TERTIB')) return 'ATURAN';
    if (upper.includes('SURAT') || upper.includes('EDARAN')) return 'SURAT';
    if (upper.includes('SOP')) return 'SOP';
    return fallbackCategory === 'ALL' ? 'SOP' : fallbackCategory;
}

function normalizePriority(rawPrio) {
    const upper = String(rawPrio || '').toUpperCase().trim();
    if (['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(upper)) return upper;
    return 'NORMAL';
}

async function proposeAdminBacklog({
    prisma = defaultPrisma,
    trigger = 'MANUAL',
    count = 4,
    focusTopic = '',
    category = 'ALL',
    actor = null,
    autoApprove = true
} = {}) {
    const config = await getOrCreateConfig(prisma);
    const snapshot = await collectOperationalSnapshot(prisma);
    const outputDate = getTodayWib();
    const safeCountVal = Math.max(1, Math.min(8, parseInt(count, 10) || 4));
    const existingSet = new Set((snapshot.existingGovernanceTitles || []).map(t => t.toLowerCase().trim()));

    let proposals = [];
    let usedFallback = false;
    let aiError = null;

    const categoryInstruction = category && category !== 'ALL'
        ? `Semua usulan harus berkategori "${category}".`
        : 'Campurkan kategori secara proporsional sesuai kebutuhan: "SOP", "ATURAN", "SURAT", atau "LAINNYA".';

    const topicInstruction = focusTopic && focusTopic.trim()
        ? `FOKUS UTAMA PERMINTAAN PIMPINAN: "${focusTopic.trim()}". Prioritaskan judul yang relevan dengan topik ini.`
        : 'Pilih kebutuhan paling mendesak di Bidang Sarana berdasarkan data kondisi lapangan saat ini.';

    const prompt = `Anda adalah ${config.adminStaffName} yang membantu Kepala Bidang Sarana Yayasan Dar el-Iman menyusun daftar dokumen SOP, aturan, dan surat administrasi sarpras.
Berdasarkan kondisi operasional terkini, susun tepat ${safeCountVal} topik dokumen baru yang BELUM ADA untuk segera disusun draft lengkapnya.

KONTEKS SISTEM & DATA TERKINI:
- Aset: ${snapshot.assets.total} total (${snapshot.assets.rusakBerat} rusak berat), ${snapshot.assets.loansOverdue} pinjaman terlambat.
- Pemeliharaan: ${snapshot.maintenance.openCount} terbuka (${snapshot.maintenance.urgentCount} urgent).
- Kendaraan: ${snapshot.vehicles.active} aktif, ${snapshot.vehicles.checklistsNeedRepairLast7d} temuan ceklis 7 hari terakhir, ${snapshot.vehicles.servicePending} servis pending.
- Workshop Unit 21: ${snapshot.workshop.activeOrders} pekerjaan aktif (kayu/besi).
- Gudang & Pengadaan: ${snapshot.procurement.openCount} pengadaan berjalan, ${snapshot.warehouse.lowStockCount} item stok minimum.

JUDUL YANG SUDAH ADA (DILARANG DUPLIKAT):
${snapshot.existingGovernanceTitles.slice(0, 40).map(t => `- ${t}`).join('\n') || '- (Belum ada)'}

ATURAN:
- ${categoryInstruction}
- ${topicInstruction}
- Kembalikan HANYA JSON array valid tanpa teks tambahan di luar JSON, format:
[
  {
    "title": "Judul Dokumen",
    "category": "SOP",
    "domain": "Aset | Kendaraan | Pemeliharaan | Workshop | Gudang | Pengadaan | CCTV | Personalia | Umum",
    "priority": "NORMAL | HIGH | URGENT",
    "rationale": "Alasan singkat mengapa Bidang Sarana membutuhkan dokumen ini",
    "brief": "Arahan ruang lingkup & poin-poin inti dokumen"
  }
]`;

    try {
        const aiRes = await generateOfficeAiText(prompt);
        const parsed = parseJsonArrayFromText(aiRes.text);
        proposals = parsed.filter(p => p && p.title && !existingSet.has(String(p.title).toLowerCase().trim()));
    } catch (err) {
        usedFallback = true;
        aiError = err.message;
    }

    if (proposals.length === 0) {
        usedFallback = true;
        const targetCat = category && category !== 'ALL' ? category : null;
        const candidates = CURATED_ADMIN_PROPOSALS.filter(item => {
            if (targetCat && item.category !== targetCat) return false;
            return !existingSet.has(item.title.toLowerCase().trim());
        });

        proposals = (candidates.length > 0 ? candidates : CURATED_ADMIN_PROPOSALS)
            .filter(item => !existingSet.has(item.title.toLowerCase().trim()))
            .slice(0, safeCountVal);

        if (proposals.length === 0 && focusTopic) {
            proposals = [{
                title: `${category !== 'ALL' ? category : 'SOP'} ${focusTopic.trim()}`,
                category: category !== 'ALL' ? category : 'SOP',
                domain: 'Umum',
                priority: 'HIGH',
                rationale: 'Usulan khusus sesuai kebutuhan pimpinan Bidang Sarana.',
                brief: `Susun dokumen resmi mengenai ${focusTopic.trim()} sesuai alur Bidang Sarana.`
            }];
        }
    }

    const approvedNow = Boolean(autoApprove);
    const createdItems = [];
    for (const p of proposals.slice(0, safeCountVal)) {
        const cleanTitle = String(p.title || '').trim();
        if (!cleanTitle || existingSet.has(cleanTitle.toLowerCase())) continue;
        existingSet.add(cleanTitle.toLowerCase());

        const itemCategory = normalizeProposalCategory(p.category, category);
        const code = await generateItemCode(prisma, itemCategory, outputDate);

        const created = await prisma.aiOfficeItem.create({
            data: {
                code,
                staffRole: 'ADMINISTRASI',
                category: itemCategory,
                domain: p.domain ? String(p.domain).slice(0, 60) : 'Umum',
                title: cleanTitle.slice(0, 240),
                rationale: p.rationale ? String(p.rationale) : 'Kebutuhan tata kelola operasional Bidang Sarana.',
                brief: p.brief ? String(p.brief) : null,
                priority: normalizePriority(p.priority),
                status: approvedNow ? 'APPROVED_FOR_DRAFT' : 'PROPOSED',
                outputDate,
                triggeredBy: trigger,
                approvedById: approvedNow ? (actor?.id || null) : null,
                approvedByName: approvedNow ? (actor?.name || 'Auto-ACC Pimpinan') : null,
                approvedAt: approvedNow ? new Date() : null,
                createdById: actor?.id || null,
                createdByName: actor?.name || config.adminStaffName
            }
        });
        createdItems.push(created);
    }

    await prisma.aiOfficeConfig.update({
        where: { id: 1 },
        data: { lastAdminRunAt: new Date() }
    });

    const summaryText = approvedNow
        ? `Menyiapkan ${createdItems.length} topik dokumen (Auto-ACC siap disusun)`
        : `Mengajukan ${createdItems.length} daftar usulan dokumen (menunggu ACC pimpinan)`;

    await prisma.aiOfficeRunLog.create({
        data: {
            staffRole: 'ADMINISTRASI',
            trigger,
            status: usedFallback ? 'PARTIAL' : 'SUCCESS',
            summary: `${summaryText}${usedFallback ? ' [mode kurasi cadangan]' : ''}.`,
            itemsCreated: createdItems.length,
            itemsDrafted: 0,
            errorMessage: aiError
        }
    });

    return { usedFallback, items: createdItems };
}

function buildFallbackDraftDocument(item, config) {
    const today = getTodayWib();
    if (item.category === 'SOP') {
        const baseTemplate = (config.sopGeneralFormat || DEFAULT_SOP_GENERAL_FORMAT)
            .replace('[Diisi otomatis / sesuai nomor arsip Kantor AI]', item.code)
            .replace('[Judul Jelas & Operasional]', item.title)
            .replace('[Tanggal / Rev. 01]', `${today} / Rev. 01`);

        return [
            baseTemplate,
            '',
            '---',
            '## Catatan Penyesuaian Khusus Bidang Sarana',
            `- **Bidang Terkait:** ${item.domain || 'Umum'}`,
            `- **Latar Belakang / Kebutuhan:** ${item.rationale || '-'}`,
            `- **Ruang Lingkup Instruksi:** ${item.brief || 'Mengikuti alur operasional standar aplikasi Manajemen Aset Bidang Sarana.'}`,
            '',
            '_Draft ini disusun sebagai kerangka siap tinjau dari format SOP umum Kantor AI. Gunakan fitur "Revisi dengan AI" atau edit langsung untuk penyempurnaan akhir._'
        ].join('\n');
    }

    return [
        `# ${item.title.toUpperCase()}`,
        ``,
        `| Parameter | Keterangan |`,
        `| :--- | :--- |`,
        `| Kode Arsip Kantor AI | ${item.code} |`,
        `| Kategori | ${item.category} |`,
        `| Bidang | ${item.domain || 'Umum'} |`,
        `| Tanggal Penyusunan | ${today} |`,
        `| Penyusun | ${config.adminStaffName} |`,
        ``,
        `## 1. Latar Belakang`,
        item.rationale || 'Disusun untuk mendukung ketertiban administrasi dan operasional Bidang Sarana Yayasan Dar el-Iman.',
        ``,
        `## 2. Pokok Ketentuan / Isi Dokumen`,
        item.brief || 'Mengatur hak, kewajiban, mekanisme koordinasi, dan pelaporan unit terkait kepada Kepala Bidang Sarana.',
        ``,
        `## 3. Penanggung Jawab & Tindak Lanjut`,
        `| No | Pihak / Peran | Peran & Tanggung Jawab |`,
        `| :-- | :--- | :--- |`,
        `| 1 | Kepala Bidang Sarana | Pengarah, pemberi persetujuan akhir, dan pengawas kepatuhan |`,
        `| 2 | Admin Aset / Sarpras | Pelaksana pencatatan, verifikasi data, dan dokumentasi di sistem |`,
        `| 3 | PIC / Unit Terkait | Pelaksana teknis lapangan dan pelapor kondisi |`,
        ``,
        `## 4. Penutup`,
        `Dokumen ini merupakan draft internal Kantor AI untuk ditinjau Kepala Bidang Sarana sebelum diterbitkan secara resmi.`,
        ``,
        `_Disusun dalam mode template cadangan terstruktur._`
    ].join('\n');
}

async function draftApprovedItem({
    prisma = defaultPrisma,
    itemId,
    trigger = 'MANUAL',
    actor = null
} = {}) {
    const id = parseInt(itemId, 10);
    if (Number.isNaN(id)) {
        const err = new Error('ID dokumen tidak valid.');
        err.statusCode = 400;
        throw err;
    }

    const item = await prisma.aiOfficeItem.findUnique({ where: { id } });
    if (!item) {
        const err = new Error('Dokumen Kantor AI tidak ditemukan.');
        err.statusCode = 404;
        throw err;
    }

    const prevStatus = item.status === 'DRAFT_READY' ? 'DRAFT_READY' : 'APPROVED_FOR_DRAFT';
    if (!['PROPOSED', 'APPROVED_FOR_DRAFT', 'DRAFT_READY', 'DRAFTING'].includes(item.status)) {
        const err = new Error('Dokumen tidak dapat disusun draft dari status saat ini.');
        err.statusCode = 400;
        throw err;
    }

    const config = await getOrCreateConfig(prisma);
    if (item.status !== 'DRAFTING') {
        await prisma.aiOfficeItem.update({
            where: { id },
            data: {
                status: 'DRAFTING',
                ...(item.status === 'PROPOSED'
                    ? {
                        approvedById: item.approvedById || actor?.id || null,
                        approvedByName: item.approvedByName || actor?.name || 'Auto-ACC Pimpinan',
                        approvedAt: item.approvedAt || new Date()
                    }
                    : {})
            }
        });
    }

    const snapshot = await collectOperationalSnapshot(prisma);
    let content = '';
    let usedFallback = false;
    let aiError = null;

    let templateCtx = null;
    if (item.category === 'SOP') {
        templateCtx = await buildSopTemplatePromptContext(config);
    }

    const sopInstructions = item.category === 'SOP'
        ? templateCtx.instructions
        : `Susun dokumen resmi kategori "${item.category}" secara lengkap dan terstruktur (Tabel Identitas Dokumen berisi Kode ${item.code}, Dasar Pertimbangan, Pasal/Poin Ketentuan lengkap, Tabel Pembagian Tugas / Mekanisme Pelaksanaan, Tabel Sanksi/SLA jika relevan, Kolom Pengesahan bertabel, dan Penutup).`;

    const prompt = `Anda adalah ${config.adminStaffName} di Kantor AI Bidang Sarana Yayasan Dar el-Iman.
Kepala Bidang Sarana telah MENYETUJUI (ACC) penyusunan draft dokumen berikut:

- Kode Dokumen Kantor AI: ${item.code}
- Kategori: ${item.category}
- Bidang: ${item.domain || 'Umum'}
- Judul: ${item.title}
- Latar Belakang / Kebutuhan: ${item.rationale || '-'}
- Arahan Khusus / Brief Pimpinan: ${item.brief || '-'}
- Catatan Revisi (jika ada): ${item.revisionNotes || '-'}

KONTEKS KONDISI NYATA BIDANG SARANA SAAT INI:
- Total aset ${snapshot.assets.total}, pinjaman pending ${snapshot.assets.loansPending}, overdue ${snapshot.assets.loansOverdue}
- Maintenance terbuka ${snapshot.maintenance.openCount}, kendaraan aktif ${snapshot.vehicles.active}, servis pending ${snapshot.vehicles.servicePending}
- Workshop Unit 21 aktif ${snapshot.workshop.activeOrders}, pengadaan berjalan ${snapshot.procurement.openCount}, gudang stok menipis ${snapshot.warehouse.lowStockCount}

ATURAN PENULISAN:
${config.policyGuidelines || DEFAULT_POLICY_GUIDELINES}

${MARKDOWN_TABLE_RULES}

${sopInstructions}

Kembalikan naskah dokumen lengkap dalam format Markdown yang bersih dan terstruktur rapi (siap dibaca dan diekspor ke PDF).`;

    try {
        const aiRes = templateCtx?.mode === 'multimodal'
            ? await generateOfficeAiMultimodal([prompt, { inlineData: templateCtx.inlineData }], { timeoutMs: 35000 })
            : await generateOfficeAiText(prompt);
        content = cleanMarkdownFence(aiRes.text);
    } catch (err) {
        usedFallback = true;
        aiError = err.message;
        content = buildFallbackDraftDocument(item, config);
    }

    const updated = await prisma.aiOfficeItem.update({
        where: { id },
        data: {
            content,
            status: 'DRAFT_READY',
            triggeredBy: trigger
        }
    }).catch(async (saveErr) => {
        await prisma.aiOfficeItem.update({
            where: { id },
            data: { status: prevStatus }
        }).catch(() => {});
        throw saveErr;
    });

    await prisma.aiOfficeConfig.update({
        where: { id: 1 },
        data: { lastAdminRunAt: new Date() }
    });

    await prisma.aiOfficeRunLog.create({
        data: {
            staffRole: 'ADMINISTRASI',
            trigger,
            status: usedFallback ? 'PARTIAL' : 'SUCCESS',
            summary: `Menyusun draft lengkap ${updated.code} (${updated.title})${usedFallback ? ' [template fallback]' : ''}.`,
            itemsCreated: 0,
            itemsDrafted: 1,
            errorMessage: aiError
        }
    });

    return { usedFallback, item: updated };
}

async function reviseDraftItem({
    prisma = defaultPrisma,
    itemId,
    instruction,
    actor = null
} = {}) {
    const id = parseInt(itemId, 10);
    if (Number.isNaN(id)) {
        const err = new Error('ID dokumen tidak valid.');
        err.statusCode = 400;
        throw err;
    }
    if (!instruction || !String(instruction).trim()) {
        const err = new Error('Instruksi revisi wajib diisi.');
        err.statusCode = 400;
        throw err;
    }

    const item = await prisma.aiOfficeItem.findUnique({ where: { id } });
    if (!item) {
        const err = new Error('Dokumen tidak ditemukan.');
        err.statusCode = 404;
        throw err;
    }

    const config = await getOrCreateConfig(prisma);
    const cleanInstruction = String(instruction).trim();
    let updatedContent = '';
    let usedFallback = false;
    let aiError = null;

    let templateCtx = null;
    if (item.category === 'SOP') {
        templateCtx = await buildSopTemplatePromptContext(config);
    }

    const prompt = `Anda adalah ${item.staffRole === 'SUPERVISI' ? config.supervisorName : config.adminStaffName} di Kantor AI Bidang Sarana Yayasan Dar el-Iman.
Perbarui/revisi dokumen berikut sesuai instruksi pimpinan tanpa menghilangkan struktur penting yang sudah ada.

JUDUL: ${item.title}
KATEGORI: ${item.category}
${item.category === 'SOP' ? `ACUAN PEDOMAN FORMAT SOP:\n${templateCtx.instructions}\n` : ''}
${MARKDOWN_TABLE_RULES}

ISI DOKUMEN SAAT INI:
${item.content || '(Kosong)'}

INSTRUKSI REVISI DARI PIMPINAN (${actor?.name || 'Kepala Bidang Sarana'}):
"${cleanInstruction}"

Kembalikan seluruh isi dokumen hasil revisi secara lengkap dalam format Markdown yang rapi.`;

    try {
        const aiRes = templateCtx?.mode === 'multimodal'
            ? await generateOfficeAiMultimodal([prompt, { inlineData: templateCtx.inlineData }], { timeoutMs: 35000 })
            : await generateOfficeAiText(prompt);
        updatedContent = cleanMarkdownFence(aiRes.text);
    } catch (err) {
        usedFallback = true;
        aiError = err.message;
        updatedContent = `${item.content || buildFallbackDraftDocument(item, config)}\n\n---\n## Catatan Tambahan / Revisi (${dayjs().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm')})\n- ${cleanInstruction}`;
    }

    const updated = await prisma.aiOfficeItem.update({
        where: { id },
        data: {
            content: updatedContent,
            revisionNotes: cleanInstruction,
            status: item.status === 'FINALIZED' ? 'FINALIZED' : 'DRAFT_READY'
        }
    });

    await prisma.aiOfficeRunLog.create({
        data: {
            staffRole: item.staffRole,
            trigger: 'MANUAL',
            status: usedFallback ? 'PARTIAL' : 'SUCCESS',
            summary: `Merevisi ${updated.code} sesuai arahan: "${cleanInstruction.slice(0, 100)}"${usedFallback ? ' [catatan fallback]' : ''}.`,
            itemsCreated: 0,
            itemsDrafted: 1,
            errorMessage: aiError
        }
    });

    return { usedFallback, item: updated };
}

async function runAutoProposeAndDraft({
    prisma = defaultPrisma,
    trigger = 'MANUAL',
    count = 2,
    focusTopic = '',
    category = 'ALL',
    actor = null
} = {}) {
    if (getRoutineState().isRunning) {
        return { skipped: true, reason: 'Shift Kantor AI sedang berjalan.' };
    }

    const safeCount = Math.max(1, Math.min(5, parseInt(count, 10) || 2));
    isRoutineRunning = true;
    routineState.isRunning = true;
    routineState.startedAt = new Date().toISOString();
    routineState.finishedAt = null;
    routineState.currentStep = 'Menentukan topik dokumen baru (Auto-ACC)...';
    routineState.lastTrigger = trigger;
    routineState.lastError = null;

    try {
        await recoverStaleDraftingItems(prisma).catch(() => {});
        const proposeRes = await proposeAdminBacklog({
            prisma,
            trigger,
            count: safeCount,
            focusTopic,
            category,
            actor,
            autoApprove: true
        });
        const created = proposeRes.items || [];
        let draftedCount = 0;

        for (let idx = 0; idx < created.length; idx++) {
            const item = created[idx];
            routineState.currentStep = `Menyusun draft (${idx + 1}/${created.length}): ${item.title}`;
            try {
                await draftApprovedItem({ prisma, itemId: item.id, trigger, actor });
                draftedCount += 1;
            } catch (err) {
                console.error(`[AiOffice] Gagal draft langsung item #${item.id}:`, err.message);
            }
        }

        const summary = {
            skipped: false,
            outputDate: getTodayWib(),
            supervisorCreated: false,
            draftedCount,
            proposedCreated: created.length
        };
        routineState.lastResult = summary;
        return summary;
    } catch (err) {
        routineState.lastError = err.message;
        throw err;
    } finally {
        isRoutineRunning = false;
        routineState.isRunning = false;
        routineState.finishedAt = new Date().toISOString();
        routineState.currentStep = null;
    }
}

async function runDailyOfficeRoutine({
    prisma = defaultPrisma,
    trigger = 'SCHEDULER',
    force = false
} = {}) {
    if (!force && process.env.USE_LOCAL_STORAGE === 'true') {
        return { skipped: true, reason: 'USE_LOCAL_STORAGE=true' };
    }

    if (getRoutineState().isRunning) {
        return { skipped: true, reason: 'Shift Kantor AI sedang berjalan.' };
    }

    isRoutineRunning = true;
    routineState.isRunning = true;
    routineState.startedAt = new Date().toISOString();
    routineState.finishedAt = null;
    routineState.currentStep = 'Memeriksa konfigurasi Kantor AI...';
    routineState.lastTrigger = trigger;
    routineState.lastError = null;
    try {
        await recoverStaleDraftingItems(prisma).catch(() => {});
        const config = await getOrCreateConfig(prisma);
        if (!force && !config.isEnabled) {
            const skippedRes = { skipped: true, reason: 'Otomasi Kantor AI sedang dinonaktifkan.' };
            routineState.lastResult = skippedRes;
            return skippedRes;
        }

        const today = getTodayWib();
        routineState.currentStep = 'Staf Supervisi menyusun Laporan Harian...';
        const supervisorResult = await runSupervisorShift({ prisma, trigger, force });

        if (prisma.aiOfficeItem?.updateMany) {
            await prisma.aiOfficeItem.updateMany({
                where: { staffRole: 'ADMINISTRASI', status: 'PROPOSED' },
                data: {
                    status: 'APPROVED_FOR_DRAFT',
                    approvedByName: 'Auto-ACC Pimpinan',
                    approvedAt: new Date()
                }
            }).catch(() => {});
        }

        const maxDrafts = Math.max(1, Math.min(5, config.maxDailyDrafts || 2));
        const [draftReadyToday, finalizedToday] = await Promise.all([
            prisma.aiOfficeItem.count({
                where: { staffRole: 'ADMINISTRASI', outputDate: today, status: 'DRAFT_READY' }
            }),
            prisma.aiOfficeItem.count({
                where: { staffRole: 'ADMINISTRASI', outputDate: today, status: 'FINALIZED' }
            })
        ]);
        const draftedTodayCount = draftReadyToday + finalizedToday;
        const slotsRemaining = force ? maxDrafts : Math.max(0, maxDrafts - draftedTodayCount);

        let draftedCount = 0;
        let proposedCreated = 0;
        const draftedItems = [];

        if (slotsRemaining > 0) {
            const approvedQueue = await prisma.aiOfficeItem.findMany({
                where: {
                    staffRole: 'ADMINISTRASI',
                    status: 'APPROVED_FOR_DRAFT'
                },
                orderBy: [
                    { approvedAt: 'asc' },
                    { createdAt: 'asc' }
                ],
                take: slotsRemaining
            });

            const itemsToDraft = [...approvedQueue];
            if (itemsToDraft.length < slotsRemaining) {
                routineState.currentStep = 'Staf Administrasi menyiapkan topik baru (Auto-ACC)...';
                const missingCount = slotsRemaining - itemsToDraft.length;
                const propRes = await proposeAdminBacklog({
                    prisma,
                    trigger,
                    count: missingCount,
                    autoApprove: true
                });
                const newlyProposed = propRes.items || [];
                proposedCreated = newlyProposed.length;
                for (const np of newlyProposed) {
                    if (itemsToDraft.length < slotsRemaining) {
                        itemsToDraft.push(np);
                    }
                }
            }

            for (let idx = 0; idx < itemsToDraft.length; idx++) {
                const queueItem = itemsToDraft[idx];
                routineState.currentStep = `Menyusun draft (${idx + 1}/${itemsToDraft.length}): ${queueItem.title}`;
                try {
                    const draftRes = await draftApprovedItem({ prisma, itemId: queueItem.id, trigger });
                    draftedCount += 1;
                    draftedItems.push(draftRes.item);
                } catch (err) {
                    console.error(`[AiOffice] Gagal draft item #${queueItem.id}:`, err.message);
                }
            }
        }

        if (!force && supervisorResult.skipped && slotsRemaining === 0) {
            return {
                skipped: true,
                reason: 'Target output harian Kantor AI hari ini sudah terpenuhi.',
                outputDate: today,
                supervisorCreated: false,
                draftedCount: 0,
                proposedCreated: 0
            };
        }

        const summary = {
            skipped: false,
            outputDate: today,
            supervisorCreated: !supervisorResult.skipped,
            draftedCount,
            proposedCreated
        };
        routineState.lastResult = summary;
        return summary;
    } catch (err) {
        routineState.lastError = err.message;
        throw err;
    } finally {
        isRoutineRunning = false;
        routineState.isRunning = false;
        routineState.finishedAt = new Date().toISOString();
        routineState.currentStep = null;
    }
}

module.exports = {
    getRoutineState,
    recoverStaleDraftingItems,
    validateSopTemplateUpload,
    saveSopTemplateFile,
    deleteSopTemplateFile,
    loadSopTemplateReference,
    buildSopTemplatePromptContext,
    convertMammothHtmlToMarkdown,
    extractSopFormatFromFile,
    DEFAULT_SOP_GENERAL_FORMAT,
    DEFAULT_POLICY_GUIDELINES,
    CURATED_ADMIN_PROPOSALS,
    getTodayWib,
    generateItemCode,
    getOrCreateConfig,
    collectOperationalSnapshot,
    runSupervisorShift,
    proposeAdminBacklog,
    draftApprovedItem,
    reviseDraftItem,
    runAutoProposeAndDraft,
    runDailyOfficeRoutine
};
