const os = require('os');
const { spawn } = require('child_process');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const sharp = require('sharp');
const { buildRtspUrl } = require('../utils/cctvAccessHelper');
const gateway = require('../utils/cctvGateway');
const { recordCctvAudit } = require('../utils/cctvAuditHelper');

const DEFAULT_MODEL_FALLBACKS = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.5-flash-lite',
    'gemini-1.5-flash'
];

const MAX_FRAME_BYTES = 5 * 1024 * 1024;
const MAX_CONCURRENT_WATCH_JOBS = Math.min(4, Math.max(2, Math.floor((os.cpus()?.length || 2) / 2)));
const MAX_ROI_ZONES = 10;

const escapeXml = (str) => String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Parse and clamp percentage-based ROI boxes (`x`, `y`, `width`, `height` in 0..100%).
 */
function parseRoiZones(raw) {
    let arr = raw;
    if (typeof raw === 'string') {
        if (!raw.trim()) return [];
        try {
            arr = JSON.parse(raw);
        } catch {
            return [];
        }
    }
    if (!Array.isArray(arr)) return [];

    const zones = [];
    for (let i = 0; i < arr.length && zones.length < MAX_ROI_ZONES; i += 1) {
        const item = arr[i];
        const x = Number(item?.x);
        const y = Number(item?.y);
        const width = Number(item?.width);
        const height = Number(item?.height);
        if (![x, y, width, height].every(Number.isFinite)) continue;

        const clampedX = Math.max(0, Math.min(99, Number(x.toFixed(2))));
        const clampedY = Math.max(0, Math.min(99, Number(y.toFixed(2))));
        const clampedW = Math.max(1, Math.min(100 - clampedX, Number(width.toFixed(2))));
        const clampedH = Math.max(1, Math.min(100 - clampedY, Number(height.toFixed(2))));

        zones.push({
            id: String(item?.id || `roi-${zones.length + 1}`).slice(0, 40),
            label: String(item?.label || `Zona ${zones.length + 1}`).trim().slice(0, 60) || `Zona ${zones.length + 1}`,
            x: clampedX,
            y: clampedY,
            width: clampedW,
            height: clampedH
        });
    }
    return zones;
}

/**
 * Overlay labeled ROI rectangles onto a JPEG frame so both Gemini Vision and WA recipients see marked objects.
 */
async function annotateImageWithRois({ imageBuffer, roiZones = [] }) {
    const zones = parseRoiZones(roiZones);
    if (zones.length === 0 || !imageBuffer) return imageBuffer;

    try {
        const meta = await sharp(imageBuffer).metadata();
        const imgW = meta.width || 1280;
        const imgH = meta.height || 720;

        const rects = zones.map((z, idx) => {
            const left = Math.round((z.x / 100) * imgW);
            const top = Math.round((z.y / 100) * imgH);
            const w = Math.max(8, Math.round((z.width / 100) * imgW));
            const h = Math.max(8, Math.round((z.height / 100) * imgH));
            const labelText = `#${idx + 1} ${escapeXml(z.label)}`;
            const tagW = Math.min(imgW - left, Math.max(70, labelText.length * 8 + 14));
            const tagY = Math.max(0, top - 22);
            return `
                <rect x="${left}" y="${top}" width="${w}" height="${h}" fill="rgba(16,185,129,0.12)" stroke="#10b981" stroke-width="3" />
                <rect x="${left}" y="${tagY}" width="${tagW}" height="22" rx="4" fill="#059669" />
                <text x="${left + 6}" y="${tagY + 15}" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#ffffff">${labelText}</text>
            `;
        }).join('');

        const svg = Buffer.from(`<svg width="${imgW}" height="${imgH}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`);
        return await sharp(imageBuffer)
            .composite([{ input: svg, top: 0, left: 0 }])
            .jpeg({ quality: 88 })
            .toBuffer();
    } catch (err) {
        console.warn('[CctvAI] Gagal menggambar overlay ROI:', err.message);
        return imageBuffer;
    }
}

let cachedFfmpegStatus = null;
let watchTickTimer = null;
let watcherStarted = false;
let watchedCamerasCache = [];
let lastCameraRefreshAt = 0;

// Per-camera runtime watcher state (in-memory only)
const cameraWatchState = new Map(); // cameraId -> { lastFrameBuffer, lastCheckedMs, lastAlertMs, busy, lastError }

/**
 * Resolve current time-of-day minutes (0..1439) in Asia/Jakarta (WIB).
 */
function getWibMinutes(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).formatToParts(date);

    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
    return (hour % 24) * 60 + minute;
}

function parseHHMMToMinutes(str) {
    if (!str || typeof str !== 'string') return null;
    const match = str.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hh = parseInt(match[1], 10);
    const mm = parseInt(match[2], 10);
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return hh * 60 + mm;
}

/**
 * Determine whether current WIB time falls inside [startHHMM, endHHMM].
 * Supports overnight ranges like "22:00" -> "05:00". Empty values mean always active.
 */
function isWithinWatchWindow(startHHMM, endHHMM, nowDate = new Date()) {
    const start = parseHHMMToMinutes(startHHMM);
    const end = parseHHMMToMinutes(endHHMM);
    if (start === null || end === null) return true;
    if (start === end) return true;

    const current = getWibMinutes(nowDate);
    if (start < end) {
        return current >= start && current <= end;
    }
    // Overnight window wrapping past midnight
    return current >= start || current <= end;
}

/**
 * Check whether `ffmpeg` binary is available on host PATH or FFMPEG_BIN.
 */
async function checkFfmpegAvailable(forceRefresh = false) {
    if (cachedFfmpegStatus && !forceRefresh) {
        return cachedFfmpegStatus;
    }
    const bin = process.env.FFMPEG_BIN || 'ffmpeg';
    const ok = await new Promise((resolve) => {
        try {
            const proc = spawn(bin, ['-version'], { windowsHide: true });
            const timer = setTimeout(() => {
                proc.kill('SIGKILL');
                resolve(false);
            }, 3000);
            proc.on('error', () => {
                clearTimeout(timer);
                resolve(false);
            });
            proc.on('close', (code) => {
                clearTimeout(timer);
                resolve(code === 0);
            });
        } catch {
            resolve(false);
        }
    });

    cachedFfmpegStatus = {
        available: ok,
        binary: bin,
        checkedAt: new Date().toISOString()
    };
    return cachedFfmpegStatus;
}

/**
 * Compute lightweight percentage of grayscale pixel difference between two JPEG frames using Sharp.
 * When `roiZones` are defined, evaluates motion STRICTLY inside each ROI rectangle and ignores pixels outside.
 */
async function computeFrameMotionPercent(prevBuffer, currBuffer, pixelDiffThreshold = 22, roiZones = []) {
    if (!prevBuffer || !currBuffer) {
        return { motionPercent: 100, changedPixels: 0, totalPixels: 0, isInitialFrame: true, triggeredZones: [] };
    }

    const zones = parseRoiZones(roiZones);
    if (zones.length > 0) {
        const [metaA, metaB] = await Promise.all([
            sharp(prevBuffer).metadata(),
            sharp(currBuffer).metadata()
        ]);
        const imgW = Math.min(metaA.width || 0, metaB.width || 0);
        const imgH = Math.min(metaA.height || 0, metaB.height || 0);

        if (imgW >= 8 && imgH >= 8) {
            let maxPercent = 0;
            let totalChanged = 0;
            let totalChecked = 0;
            const zoneMetrics = [];

            for (const zone of zones) {
                const left = Math.max(0, Math.min(imgW - 2, Math.floor((zone.x / 100) * imgW)));
                const top = Math.max(0, Math.min(imgH - 2, Math.floor((zone.y / 100) * imgH)));
                const width = Math.max(2, Math.min(imgW - left, Math.ceil((zone.width / 100) * imgW)));
                const height = Math.max(2, Math.min(imgH - top, Math.ceil((zone.height / 100) * imgH)));

                const [rawA, rawB] = await Promise.all([
                    sharp(prevBuffer).extract({ left, top, width, height }).resize(48, 48, { fit: 'fill' }).grayscale().raw().toBuffer(),
                    sharp(currBuffer).extract({ left, top, width, height }).resize(48, 48, { fit: 'fill' }).grayscale().raw().toBuffer()
                ]);

                const len = Math.min(rawA.length, rawB.length);
                let changed = 0;
                for (let i = 0; i < len; i += 1) {
                    if (Math.abs(rawA[i] - rawB[i]) >= pixelDiffThreshold) changed += 1;
                }
                const pct = len > 0 ? Number(((changed / len) * 100).toFixed(2)) : 0;
                totalChanged += changed;
                totalChecked += len;
                if (pct > maxPercent) maxPercent = pct;
                zoneMetrics.push({ id: zone.id, label: zone.label, motionPercent: pct });
            }

            return {
                motionPercent: maxPercent,
                changedPixels: totalChanged,
                totalPixels: totalChecked,
                isInitialFrame: false,
                zoneMetrics
            };
        }
    }

    const [rawA, rawB] = await Promise.all([
        sharp(prevBuffer).resize(64, 36, { fit: 'fill' }).grayscale().raw().toBuffer(),
        sharp(currBuffer).resize(64, 36, { fit: 'fill' }).grayscale().raw().toBuffer()
    ]);

    const len = Math.min(rawA.length, rawB.length);
    if (len === 0) return { motionPercent: 0, changedPixels: 0, totalPixels: 0, zoneMetrics: [] };

    let changed = 0;
    for (let i = 0; i < len; i += 1) {
        if (Math.abs(rawA[i] - rawB[i]) >= pixelDiffThreshold) {
            changed += 1;
        }
    }

    const motionPercent = Number(((changed / len) * 100).toFixed(2));
    return { motionPercent, changedPixels: changed, totalPixels: len, isInitialFrame: false, zoneMetrics: [] };
}

/**
 * Resolve best backend frame capture URL for a camera (preferring direct RTSP or gateway HLS).
 */
function resolveCaptureSourceUrl(camera, gatewayCfg = null) {
    const rtsp = buildRtspUrl(camera);
    if (rtsp) return rtsp;

    if (camera?.streamPath && gatewayCfg?.hlsUrl) {
        if (gatewayCfg.username) {
            try {
                const u = new URL(`${gatewayCfg.hlsUrl}/${encodeURIComponent(camera.streamPath)}/index.m3u8`);
                u.username = gatewayCfg.username;
                u.password = gatewayCfg.password || '';
                return u.toString();
            } catch {
                // fallback below
            }
        }
        return `${gatewayCfg.hlsUrl}/${encodeURIComponent(camera.streamPath)}/index.m3u8`;
    }

    const manualUrl = String(camera?.streamUrl || '').trim();
    if (/^(rtsp|https?):\/\//i.test(manualUrl)) {
        return manualUrl;
    }
    return null;
}

/**
 * Grab 1 JPEG snapshot frame from RTSP / HTTP stream using `ffmpeg`.
 */
async function captureCameraFrame({ camera, gatewayCfg = null, timeoutMs = 10000 }) {
    const sourceUrl = resolveCaptureSourceUrl(camera, gatewayCfg);
    if (!sourceUrl) {
        throw new Error('Kamera belum memiliki sumber stream RTSP/HLS yang dapat diambil gambarnya.');
    }

    const ffmpegCheck = await checkFfmpegAvailable();
    if (!ffmpegCheck.available) {
        throw new Error('Binary ffmpeg tidak tersedia di server untuk menangkap frame kamera otomatis.');
    }

    const args = [];
    if (sourceUrl.toLowerCase().startsWith('rtsp://')) {
        args.push('-rtsp_transport', 'tcp');
    }
    args.push(
        '-loglevel', 'error',
        '-skip_frame', 'nokey',
        '-i', sourceUrl,
        '-an', '-sn', '-dn',
        '-frames:v', '1',
        '-vf', "scale='min(640,iw)':-2",
        '-q:v', '5',
        '-f', 'image2pipe',
        '-vcodec', 'mjpeg',
        'pipe:1'
    );

    return new Promise((resolve, reject) => {
        const proc = spawn(ffmpegCheck.binary, args, { windowsHide: true });
        const chunks = [];
        const errChunks = [];
        let totalSize = 0;
        let settled = false;

        const finish = (err, buf) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (err) reject(err);
            else resolve(buf);
        };

        const timer = setTimeout(() => {
            proc.kill('SIGKILL');
            finish(new Error(`Timeout mengambil frame kamera (${timeoutMs} ms).`));
        }, timeoutMs);

        proc.stdout.on('data', (chunk) => {
            totalSize += chunk.length;
            if (totalSize > MAX_FRAME_BYTES) {
                proc.kill('SIGKILL');
                finish(new Error('Ukuran frame terlalu besar.'));
                return;
            }
            chunks.push(chunk);
        });

        proc.stderr.on('data', (chunk) => {
            errChunks.push(chunk);
        });

        proc.on('error', (err) => finish(err));
        proc.on('close', (code) => {
            const out = Buffer.concat(chunks);
            if (code === 0 && out.length > 0) {
                finish(null, out);
            } else {
                const stderrText = Buffer.concat(errChunks).toString('utf8').trim();
                finish(new Error(stderrText || `ffmpeg keluar dengan kode ${code} tanpa menghasilkan frame.`));
            }
        });
    });
}

/**
 * Build structured JSON analysis prompt according to camera preset.
 */
function buildAiPrompt({ preset = 'CLASSROOM', customPrompt = '', camera = {}, roiZones = [] }) {
    const cleanPreset = String(preset || 'CLASSROOM').toUpperCase();
    const camContext = `Kamera: "${camera?.name || 'CCTV'}"${camera?.location ? ` (Lokasi: ${camera.location})` : ''}.`;
    const zones = parseRoiZones(roiZones.length > 0 ? roiZones : camera?.aiRoiZones);
    const roiNote = zones.length > 0
        ? `\nFOKUS KOTAK ROI (ditandai kotak hijau pada gambar): ${zones.map((z, idx) => `#${idx + 1} "${z.label}"`).join(', ')}. Utamakan pengamatan pada benda/area di dalam kotak hijau tersebut (periksa apakah ada orang menyentuh, memindahkan, mengambil benda, atau masuk ke zona bertanda).`
        : '';
    const extraNote = customPrompt && String(customPrompt).trim()
        ? `\nInstruksi khusus dari admin: "${String(customPrompt).trim()}".`
        : '';

    if (cleanPreset === 'SECURITY_NIGHT') {
        return `Anda adalah asisten keamanan CCTV malam hari untuk Yayasan Dar El-Iman. ${camContext}${roiNote}${extraNote}
Analisis gambar snapshot CCTV berikut (mungkin mode inframerah/IR hitam-putih malam hari).
Tentukan apakah terlihat MANUSIA / PENYUSUP di area tersebut, atau hanya halaman kosong, kendaraan parkir diam, hewan (kucing/anjing), serangga dekat lensa, bayangan, atau daun bergoyang.
PENTING: Jangan anggap bayangan/kucing/serangga sebagai penyusup. Set alertTriggered=true HANYA jika cukup jelas terlihat ORANG/MANUSIA yang mencurigakan di area pengawasan.

Balas HANYA JSON valid tanpa markdown dengan format persis:
{
  "subjectType": "MANUSIA" | "KENDARAAN" | "HEWAN_SERANGGA" | "BAYANGAN_CAHAYA" | "KOSONG",
  "intruderDetected": boolean,
  "personCount": number,
  "confidence": "TINGGI" | "SEDANG" | "RENDAH",
  "alertTriggered": boolean,
  "alertReason": string | null,
  "summary": "ringkasan singkat 1-2 kalimat dalam bahasa Indonesia"
}`;
    }

    if (cleanPreset === 'CROWD') {
        return `Anda adalah asisten analisis area CCTV Yayasan. ${camContext}${roiNote}${extraNote}
Hitung perkiraan jumlah orang dan kendaraan yang terlihat di frame secara objektif.

Balas HANYA JSON valid tanpa markdown dengan format persis:
{
  "peopleCount": number,
  "vehicleCount": number,
  "density": "SEPI" | "NORMAL" | "PADAT",
  "alertTriggered": boolean,
  "alertReason": string | null,
  "summary": "ringkasan singkat 1-2 kalimat dalam bahasa Indonesia"
}`;
    }

    if (cleanPreset === 'CUSTOM') {
        return `Anda adalah asisten visual CCTV. ${camContext}${roiNote}
Tugas analisis utama: ${customPrompt && String(customPrompt).trim() ? String(customPrompt).trim() : 'Deskripsikan kondisi ruangan/area, aktivitas orang, serta potensi anomali keamanan.'}
Set alertTriggered=true hanya jika kondisi darurat/anomali sesuai instruksi ditemukan.

Balas HANYA JSON valid tanpa markdown dengan format persis:
{
  "detectedItems": ["poin temuan 1", "poin temuan 2"],
  "alertTriggered": boolean,
  "alertReason": string | null,
  "summary": "ringkasan singkat 1-2 kalimat dalam bahasa Indonesia"
}`;
    }

    // Default: CLASSROOM
    return `Anda adalah asisten pemantauan ruang kelas melalui CCTV untuk sekolah Yayasan Dar El-Iman. ${camContext}${roiNote}${extraNote}
Periksa snapshot ruang kelas ini dan jawab secara objektif berdasarkan apa yang terlihat:
1. Hitung perkiraan jumlah anak/siswa yang terlihat (angka bulat; jika ruangan kosong = 0).
2. Cek keberadaan guru/ustadz/pengajar (biasanya orang dewasa berdiri/duduk di depan papan tulis atau berkeliling mengawasi siswa): pilih "ADA", "TIDAK_TERLIHAT", atau "KELAS_KOSONG".
3. Set alertTriggered=true jika terlihat ada siswa di kelas tetapi guru TIDAK TERLIHAT di frame (atau ada anomali sesuai instruksi khusus).

Balas HANYA JSON valid tanpa markdown dengan format persis:
{
  "studentCount": number,
  "teacherPresent": "ADA" | "TIDAK_TERLIHAT" | "KELAS_KOSONG",
  "classCondition": string,
  "alertTriggered": boolean,
  "alertReason": string | null,
  "summary": "ringkasan singkat 1-2 kalimat dalam bahasa Indonesia"
}`;
}

function parseGeminiJsonResponse(rawText) {
    const cleaned = String(rawText || '')
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```$/i, '')
        .trim();

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    const candidate = firstBrace >= 0 && lastBrace > firstBrace
        ? cleaned.slice(firstBrace, lastBrace + 1)
        : cleaned;

    return JSON.parse(candidate);
}

/**
 * Strip data URI header if present and validate image base64 payload.
 */
function normalizeImagePayload(imageBase64, mimeType = 'image/jpeg') {
    if (!imageBase64 || typeof imageBase64 !== 'string') {
        throw new Error('Gambar snapshot kamera tidak valid.');
    }
    let resolvedMime = mimeType || 'image/jpeg';
    let cleanBase64 = imageBase64.trim();

    const dataUriMatch = cleanBase64.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/s);
    if (dataUriMatch) {
        resolvedMime = dataUriMatch[1];
        cleanBase64 = dataUriMatch[2].trim();
    }

    if (!cleanBase64 || cleanBase64.length > 7 * 1024 * 1024) {
        throw new Error('Ukuran gambar snapshot terlalu besar atau kosong.');
    }

    return { cleanBase64, mimeType: resolvedMime };
}

/**
 * Analyze a single camera snapshot with Gemini Vision.
 */
async function analyzeFrameWithGemini({
    imageBase64,
    mimeType = 'image/jpeg',
    camera = {},
    presetOverride = null,
    customPromptOverride = null,
    alreadyAnnotated = false,
    genAIClient = null
}) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey && !genAIClient) {
        throw new Error('GEMINI_API_KEY belum diatur di file server/.env.');
    }

    const genAI = genAIClient || new GoogleGenerativeAI(apiKey);
    const normalized = normalizeImagePayload(imageBase64, mimeType);
    let cleanBase64 = normalized.cleanBase64;
    let resolvedMime = normalized.mimeType;

    const zones = parseRoiZones(camera?.aiRoiZones);
    if (zones.length > 0 && !alreadyAnnotated) {
        const annotatedBuf = await annotateImageWithRois({
            imageBuffer: Buffer.from(cleanBase64, 'base64'),
            roiZones: zones
        });
        cleanBase64 = annotatedBuf.toString('base64');
        resolvedMime = 'image/jpeg';
    }

    const preset = String(presetOverride || camera?.aiPreset || 'CLASSROOM').toUpperCase();
    const customPrompt = customPromptOverride !== null && customPromptOverride !== undefined
        ? customPromptOverride
        : (camera?.aiCustomPrompt || '');

    const promptText = buildAiPrompt({ preset, customPrompt, camera, roiZones: zones });
    const parts = [
        promptText,
        {
            inlineData: {
                mimeType: resolvedMime,
                data: cleanBase64
            }
        }
    ];

    let lastErr = null;
    for (const modelName of DEFAULT_MODEL_FALLBACKS) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(parts);
            const rawText = result?.response?.text?.() || '';
            let parsed;
            try {
                parsed = parseGeminiJsonResponse(rawText);
            } catch {
                parsed = {
                    alertTriggered: false,
                    alertReason: null,
                    summary: rawText.trim().slice(0, 500) || 'AI tidak mengembalikan ringkasan terstruktur.'
                };
            }

            return {
                preset,
                model: modelName,
                analyzedAt: new Date().toISOString(),
                ...parsed
            };
        } catch (err) {
            lastErr = err;
            console.warn(`[CctvAI] Model ${modelName} gagal (${err.message}), mencoba fallback...`);
        }
    }

    throw lastErr || new Error('Semua model Gemini Vision gagal memproses snapshot kamera.');
}

/**
 * Resolve WhatsApp alert targets from camera setting, falling back to Kabid Sarana phone & SARPRAS_GROUP_WA_ID.
 */
async function resolveAlertRecipients({ camera, prismaClient }) {
    const raw = String(camera?.aiAlertRecipients || '').trim();
    if (raw) {
        return [...new Set(
            raw.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean)
        )];
    }

    const targets = [];
    if (process.env.SARPRAS_GROUP_WA_ID) {
        targets.push(process.env.SARPRAS_GROUP_WA_ID.trim());
    }

    if (prismaClient?.user) {
        const managers = await prismaClient.user.findMany({
            where: {
                position: { contains: 'Kepala Bidang Sarana' },
                phone: { not: null }
            },
            select: { phone: true }
        }).catch(() => []);
        for (const m of managers) {
            if (m.phone && m.phone.trim()) targets.push(m.phone.trim());
        }
    }

    return [...new Set(targets)];
}

/**
 * Send WhatsApp alert with optional JPEG snapshot attachment when local WhatsApp client is connected.
 */
async function dispatchCctvAiWaAlert({
    camera,
    analysis,
    imageBase64 = null,
    mimeType = 'image/jpeg',
    prismaClient,
    waService = null,
    isTest = false
}) {
    const recipients = await resolveAlertRecipients({ camera, prismaClient });
    if (recipients.length === 0) {
        return { sent: false, recipientCount: 0, reason: 'Belum ada nomor/grup penerima WA alert.' };
    }

    const whatsapp = waService || require('./whatsappService');
    const { MessageMedia } = require('whatsapp-web.js');

    const timestampWib = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    const headerTitle = isTest
        ? '🧪 *UJI COBA ALERT AI CCTV*'
        : (analysis?.preset === 'SECURITY_NIGHT'
            ? '🚨 *PERINGATAN KEAMANAN CCTV (AI JAGA MALAM)*'
            : '⚠️ *PERINGATAN PEMANTAUAN CCTV AI*');

    const lines = [
        headerTitle,
        '',
        `📷 *Kamera:* ${camera?.name || '-'}`,
        camera?.location ? `📍 *Lokasi:* ${camera.location}` : null,
        `🕒 *Waktu:* ${timestampWib} WIB`,
        `🤖 *Mode:* ${analysis?.preset || camera?.aiPreset || 'AI'}`,
        analysis?.studentCount !== undefined ? `👨‍🎓 *Perkiraan Siswa:* ${analysis.studentCount}` : null,
        analysis?.teacherPresent ? `👨‍🏫 *Status Guru:* ${analysis.teacherPresent}` : null,
        analysis?.personCount !== undefined ? `🧍 *Perkiraan Orang:* ${analysis.personCount}` : null,
        Array.isArray(analysis?.triggeredZones) && analysis.triggeredZones.length > 0
            ? `🎯 *Zona Terpicu:* ${analysis.triggeredZones.map((z) => `${z.label} (${z.motionPercent}%)`).join(', ')}`
            : null,
        analysis?.alertReason ? `⚡ *Pemicu:* ${analysis.alertReason}` : null,
        '',
        `📝 *Hasil Analisis AI:*`,
        analysis?.summary || '-'
    ].filter(Boolean);

    const textMessage = lines.join('\n');
    const waStatus = whatsapp.getWhatsAppStatus?.();
    const canAttachMedia = Boolean(imageBase64 && waStatus?.status === 'CONNECTED');

    let mediaObj = null;
    if (canAttachMedia) {
        try {
            const { cleanBase64, mimeType: resolvedMime } = normalizeImagePayload(imageBase64, mimeType);
            mediaObj = new MessageMedia(resolvedMime, cleanBase64, `cctv-alert-${camera?.id || 'cam'}.jpg`);
        } catch {
            mediaObj = null;
        }
    }

    for (const target of recipients) {
        const opts = mediaObj ? { media: mediaObj } : {};
        await whatsapp.sendMessage(target, textMessage, opts);
    }

    return { sent: true, recipientCount: recipients.length, recipients, attachedPhoto: Boolean(mediaObj) };
}

/**
 * Evaluate a single camera in background watch loop (motion diff -> Gemini -> optional WA Alert).
 */
async function processWatchedCamera(camera, gatewayCfg, prismaClient) {
    const state = cameraWatchState.get(camera.id) || {
        lastFrameBuffer: null,
        lastCheckedMs: 0,
        lastAlertMs: camera.aiLastAlertAt ? new Date(camera.aiLastAlertAt).getTime() : 0,
        consecutiveErrors: 0,
        backoffUntilMs: 0,
        busy: false,
        lastError: null
    };
    if (state.busy) return;

    state.busy = true;
    cameraWatchState.set(camera.id, state);

    try {
        const frameBuffer = await captureCameraFrame({ camera, gatewayCfg, timeoutMs: 8000 });
        state.consecutiveErrors = 0;
        state.backoffUntilMs = 0;
        const nowMs = Date.now();
        const preset = String(camera.aiPreset || 'SECURITY_NIGHT').toUpperCase();
        const threshold = Number(camera.aiMotionThreshold) > 0 ? Number(camera.aiMotionThreshold) : 6.0;

        let shouldCallGemini = false;
        const zones = parseRoiZones(camera.aiRoiZones);
        let motionInfo = { motionPercent: 0, isInitialFrame: false, zoneMetrics: [] };

        if (preset === 'SECURITY_NIGHT' || preset === 'CUSTOM') {
            motionInfo = await computeFrameMotionPercent(state.lastFrameBuffer, frameBuffer, 22, zones);
            state.lastFrameBuffer = frameBuffer;
            // On very first baseline frame we do not call Gemini unless motion was detected later
            shouldCallGemini = !motionInfo.isInitialFrame && motionInfo.motionPercent >= threshold;
        } else {
            // CLASSROOM / CROWD scheduled watch runs Gemini directly on the configured interval
            state.lastFrameBuffer = frameBuffer;
            shouldCallGemini = true;
        }

        state.lastCheckedMs = nowMs;
        state.lastError = null;

        if (!shouldCallGemini) {
            return;
        }

        const triggeredZones = (motionInfo.zoneMetrics || []).filter((z) => z.motionPercent >= threshold);
        const annotatedBuf = zones.length > 0
            ? await annotateImageWithRois({ imageBuffer: frameBuffer, roiZones: zones })
            : frameBuffer;
        const imageBase64 = annotatedBuf.toString('base64');
        const analysis = await analyzeFrameWithGemini({
            imageBase64,
            mimeType: 'image/jpeg',
            camera,
            alreadyAnnotated: true
        });
        if (triggeredZones.length > 0) {
            analysis.triggeredZones = triggeredZones;
        }

        await prismaClient.cctvCamera.update({
            where: { id: camera.id },
            data: {
                aiLastCheckedAt: new Date(nowMs),
                aiLastSummary: analysis.summary || null
            }
        }).catch(() => null);

        const cooldownMs = Math.max(30, Number(camera.aiAlertCooldownSec) || 180) * 1000;
        const canAlert = Boolean(analysis.alertTriggered) && (nowMs - (state.lastAlertMs || 0) >= cooldownMs);

        if (canAlert) {
            state.lastAlertMs = nowMs;
            const waResult = await dispatchCctvAiWaAlert({
                camera,
                analysis,
                imageBase64,
                mimeType: 'image/jpeg',
                prismaClient
            });

            await prismaClient.cctvCamera.update({
                where: { id: camera.id },
                data: { aiLastAlertAt: new Date(nowMs) }
            }).catch(() => null);

            await recordCctvAudit({
                prismaClient,
                camera,
                action: 'AI_ALERT',
                category: 'CAMERA',
                status: waResult.sent ? 'SUCCESS' : 'FAILED',
                protocol: 'AI_WATCH',
                details: `Alert AI (${analysis.preset}): ${analysis.summary || analysis.alertReason || 'Terdeteksi kejadian'} (Gerakan ${motionInfo.motionPercent}%)`,
                metadata: { ...analysis, motionPercent: motionInfo.motionPercent, waResult }
            });
        } else {
            await recordCctvAudit({
                prismaClient,
                camera,
                action: 'AI_ANALYZE',
                category: 'CAMERA',
                protocol: 'AI_WATCH',
                details: `Pemantauan AI (${analysis.preset}): ${analysis.summary || '-'}`,
                metadata: { ...analysis, motionPercent: motionInfo.motionPercent },
                dedupeCooldownMs: 5 * 60 * 1000
            });
        }
    } catch (error) {
        const now = Date.now();
        state.lastCheckedMs = now;
        state.consecutiveErrors = (state.consecutiveErrors || 0) + 1;
        // Exponential backoff (30s -> 60s -> 120s -> max 300s) so offline cameras never hog worker slots
        const backoffSec = Math.min(300, 30 * (2 ** Math.min(3, state.consecutiveErrors - 1)));
        state.backoffUntilMs = now + backoffSec * 1000;
        state.lastError = error.message;
        console.error(`[CctvAI] Gagal memeriksa kamera "${camera.name}" (#${camera.id}), backoff ${backoffSec}s:`, error.message);
    } finally {
        state.busy = false;
        cameraWatchState.set(camera.id, state);
    }
}

async function runWatchTick(prismaClient) {
    if (!process.env.GEMINI_API_KEY) return;

    const ffmpeg = await checkFfmpegAvailable();
    if (!ffmpeg.available) return;

    const nowMs = Date.now();
    if (nowMs - lastCameraRefreshAt > 30000) {
        lastCameraRefreshAt = nowMs;
        watchedCamerasCache = await prismaClient.cctvCamera.findMany({
            where: {
                isActive: true,
                aiEnabled: true,
                aiWatchEnabled: true
            },
            include: {
                unit: { select: { id: true, name: true, code: true } }
            }
        }).catch(() => []);
    }

    if (watchedCamerasCache.length === 0) return;

    let activeBusyCount = 0;
    for (const st of cameraWatchState.values()) {
        if (st?.busy) activeBusyCount += 1;
    }
    const availableSlots = Math.max(0, MAX_CONCURRENT_WATCH_JOBS - activeBusyCount);
    if (availableSlots === 0) return;

    const nowDate = new Date(nowMs);
    const dueCameras = watchedCamerasCache
        .filter((cam) => {
            if (!isWithinWatchWindow(cam.aiWatchStart, cam.aiWatchEnd, nowDate)) return false;
            const st = cameraWatchState.get(cam.id);
            if (st?.busy) return false;
            if (st?.backoffUntilMs && nowMs < st.backoffUntilMs) return false;
            const intervalMs = Math.max(3, Number(cam.aiWatchIntervalSec) || 5) * 1000;
            return !st || nowMs - st.lastCheckedMs >= intervalMs;
        })
        // Fair round-robin: cameras waited longest run first
        .sort((a, b) => (cameraWatchState.get(a.id)?.lastCheckedMs || 0) - (cameraWatchState.get(b.id)?.lastCheckedMs || 0));

    if (dueCameras.length === 0) return;

    const gatewayCfg = await gateway.getGatewayConfig(prismaClient);
    for (const cam of dueCameras.slice(0, availableSlots)) {
        processWatchedCamera(cam, gatewayCfg, prismaClient);
    }
}

function startCctvAiWatcher(prismaClient) {
    if (watcherStarted || process.env.USE_LOCAL_STORAGE === 'true') return;
    watcherStarted = true;

    checkFfmpegAvailable().then((st) => {
        console.log(`[CctvAI] Background watcher aktif (workers=${MAX_CONCURRENT_WATCH_JOBS}). GEMINI_API_KEY=${Boolean(process.env.GEMINI_API_KEY)}, ffmpeg=${st.available}`);
    });

    watchTickTimer = setInterval(() => {
        runWatchTick(prismaClient).catch((err) => {
            console.error('[CctvAI] Watch tick error:', err.message);
        });
    }, 1000);
}

function stopCctvAiWatcher() {
    watcherStarted = false;
    if (watchTickTimer) {
        clearInterval(watchTickTimer);
        watchTickTimer = null;
    }
}

function invalidateWatchedCamerasCache() {
    lastCameraRefreshAt = 0;
}

async function getAiSystemStatus(prismaClient) {
    const ffmpeg = await checkFfmpegAvailable();
    const [aiEnabledCount, watchEnabledCount] = await Promise.all([
        prismaClient.cctvCamera.count({ where: { aiEnabled: true } }).catch(() => 0),
        prismaClient.cctvCamera.count({ where: { isActive: true, aiEnabled: true, aiWatchEnabled: true } }).catch(() => 0)
    ]);

    return {
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
        ffmpegAvailable: ffmpeg.available,
        watcherRunning: watcherStarted,
        aiEnabledCount,
        watchEnabledCount
    };
}

module.exports = {
    getWibMinutes,
    parseHHMMToMinutes,
    isWithinWatchWindow,
    checkFfmpegAvailable,
    parseRoiZones,
    annotateImageWithRois,
    computeFrameMotionPercent,
    resolveCaptureSourceUrl,
    captureCameraFrame,
    buildAiPrompt,
    parseGeminiJsonResponse,
    normalizeImagePayload,
    analyzeFrameWithGemini,
    resolveAlertRecipients,
    dispatchCctvAiWaAlert,
    startCctvAiWatcher,
    stopCctvAiWatcher,
    invalidateWatchedCamerasCache,
    getAiSystemStatus
};
