/**
 * Integrasi Gateway MediaMTX untuk Management CCTV.
 *
 * Alur tayangan:
 *   Kamera/DVR (RTSP, via LAN/Tailscale) --> MediaMTX --> Backend Sarpras (proxy + cek hak akses) --> Browser
 *
 * - Backend menyinkronkan daftar kamera ke MediaMTX lewat Control API (port 9997),
 *   sehingga Kepala Bidang Sarana tidak perlu mengedit mediamtx.yml setiap menambah kamera.
 * - Browser TIDAK pernah menerima alamat RTSP / IP / password kamera. Browser hanya memanggil
 *   /api/cctv/play/:id/... yang diperiksa hak aksesnya, lalu diteruskan backend ke MediaMTX.
 */

const { buildRtspUrl } = require('./cctvAccessHelper');

const DEFAULT_TIMEOUT_MS = 8000;

const trimSlash = (url) => String(url || '').trim().replace(/\/+$/, '');

/**
 * Mengambil konfigurasi gateway dari database (tabel CctvGateway id=1),
 * dengan fallback ke environment variable MEDIAMTX_*.
 */
const getGatewayConfig = async (prisma) => {
    let row = null;
    try {
        row = await prisma.cctvGateway.findUnique({ where: { id: 1 } });
    } catch {
        row = null;
    }

    return {
        webrtcUrl: trimSlash(row?.webrtcUrl || process.env.MEDIAMTX_WEBRTC_URL || ''),
        hlsUrl: trimSlash(row?.hlsUrl || process.env.MEDIAMTX_HLS_URL || ''),
        apiUrl: trimSlash(row?.apiUrl || process.env.MEDIAMTX_API_URL || ''),
        username: row?.username || process.env.MEDIAMTX_USER || '',
        password: row?.password || process.env.MEDIAMTX_PASS || '',
        updatedAt: row?.updatedAt || null
    };
};

const isPlaybackConfigured = (cfg) => Boolean(cfg && (cfg.webrtcUrl || cfg.hlsUrl));

const buildAuthHeaders = (cfg) => {
    if (!cfg?.username) return {};
    const token = Buffer.from(`${cfg.username}:${cfg.password || ''}`).toString('base64');
    return { Authorization: `Basic ${token}` };
};

/**
 * Menentukan apakah kamera ditayangkan lewat Gateway Sarpras (proxy backend).
 * - streamMode GATEWAY selalu lewat gateway.
 * - streamMode WHEP/HLS lama yang URL-nya dikosongkan juga otomatis lewat gateway.
 */
const usesGatewayPlayback = (camera) => {
    if (!camera?.streamPath) return false;
    const mode = String(camera.streamMode || 'GATEWAY').toUpperCase();
    if (mode === 'GATEWAY') return true;
    if ((mode === 'WHEP' || mode === 'HLS') && !String(camera.streamUrl || '').trim()) return true;
    return false;
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) => {
    return fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
};

const describeFetchError = (err) => {
    if (!err) return 'Kesalahan tidak diketahui';
    if (err.name === 'TimeoutError' || err.name === 'AbortError') return 'Waktu koneksi habis (timeout)';
    const code = err.cause?.code || err.code;
    if (code === 'ECONNREFUSED') return 'Koneksi ditolak (MediaMTX belum berjalan / port salah)';
    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'Alamat host tidak ditemukan';
    if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH') return 'Host tidak dapat dijangkau dari server';
    return err.message || String(err);
};

/**
 * Pemanggil Control API MediaMTX (v3).
 */
const apiRequest = async (cfg, method, apiPath, body) => {
    if (!cfg?.apiUrl) {
        return { ok: false, status: 0, error: 'Control API MediaMTX belum diatur' };
    }
    try {
        const res = await fetchWithTimeout(`${cfg.apiUrl}${apiPath}`, {
            method,
            headers: {
                ...buildAuthHeaders(cfg),
                ...(body ? { 'Content-Type': 'application/json' } : {})
            },
            body: body ? JSON.stringify(body) : undefined
        });
        const text = await res.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = text;
        }
        return {
            ok: res.ok,
            status: res.status,
            data,
            error: res.ok ? null : (data?.error || (typeof data === 'string' ? data : `HTTP ${res.status}`))
        };
    } catch (err) {
        return { ok: false, status: 0, error: describeFetchError(err) };
    }
};

/**
 * Menambahkan / memperbarui path kamera di MediaMTX.
 */
const upsertCameraPath = async (cfg, camera) => {
    const name = camera.streamPath;
    const source = buildRtspUrl(camera);
    if (!name) return { ok: false, skipped: true, error: 'Kode path kamera kosong' };
    if (!source) return { ok: false, skipped: true, error: 'IP / RTSP kamera belum diisi' };

    const body = { source, sourceOnDemand: true };
    const encoded = encodeURIComponent(name);

    let res = await apiRequest(cfg, 'POST', `/v3/config/paths/add/${encoded}`, body);
    if (!res.ok && res.status === 400) {
        // Path sudah ada -> ganti konfigurasinya
        res = await apiRequest(cfg, 'POST', `/v3/config/paths/replace/${encoded}`, body);
    }
    return res.ok ? { ok: true, action: 'upsert' } : { ok: false, error: res.error, status: res.status };
};

const deleteCameraPath = async (cfg, pathName) => {
    if (!pathName) return { ok: true, skipped: true };
    const res = await apiRequest(cfg, 'DELETE', `/v3/config/paths/delete/${encodeURIComponent(pathName)}`);
    if (res.ok || res.status === 404) return { ok: true, action: 'delete' };
    return { ok: false, error: res.error, status: res.status };
};

/**
 * Sinkronisasi satu kamera ke MediaMTX. Kamera nonaktif / tanpa sumber RTSP dihapus dari gateway.
 * Tidak pernah melempar error agar proses simpan data kamera tidak gagal karena gateway mati.
 */
const syncCamera = async (cfg, camera, previousPathName = null) => {
    if (!cfg?.apiUrl) {
        return { ok: false, skipped: true, error: 'Control API MediaMTX belum diatur (sinkronisasi dilewati)' };
    }
    try {
        if (previousPathName && previousPathName !== camera.streamPath) {
            await deleteCameraPath(cfg, previousPathName);
        }
        if (!camera.isActive || !buildRtspUrl(camera)) {
            const del = await deleteCameraPath(cfg, camera.streamPath);
            return { ...del, action: 'delete', reason: !camera.isActive ? 'Kamera nonaktif' : 'Sumber RTSP kosong' };
        }
        return await upsertCameraPath(cfg, camera);
    } catch (err) {
        return { ok: false, error: describeFetchError(err) };
    }
};

const syncAllCameras = async (cfg, cameras = []) => {
    const results = [];
    for (const cam of cameras) {
        const result = await syncCamera(cfg, cam);
        results.push({ id: cam.id, name: cam.name, streamPath: cam.streamPath, ...result });
    }
    return results;
};

/**
 * Mengecek apakah sebuah URL layanan HTTP dapat dijangkau (status HTTP apa pun dianggap terjangkau).
 */
const probeHttp = async (url, cfg) => {
    if (!url) return { ok: false, skipped: true, error: 'Belum diatur' };
    try {
        const res = await fetchWithTimeout(url, { method: 'GET', headers: buildAuthHeaders(cfg) }, 5000);
        await res.arrayBuffer().catch(() => null);
        return { ok: true, status: res.status };
    } catch (err) {
        return { ok: false, error: describeFetchError(err) };
    }
};

const testGateway = async (cfg) => {
    const [api, webrtc, hls] = await Promise.all([
        cfg.apiUrl
            ? apiRequest(cfg, 'GET', '/v3/config/global/get')
            : Promise.resolve({ ok: false, skipped: true, error: 'Belum diatur' }),
        probeHttp(cfg.webrtcUrl, cfg),
        probeHttp(cfg.hlsUrl, cfg)
    ]);

    let apiMessage = api.error || null;
    if (!api.ok && (api.status === 401 || api.status === 403)) {
        apiMessage = 'Ditolak MediaMTX: periksa username/password gateway dan izin "api" di mediamtx.yml';
    }

    return {
        api: { ok: api.ok, skipped: Boolean(api.skipped), status: api.status, error: apiMessage },
        webrtc,
        hls,
        allOk: api.ok && (webrtc.ok || hls.ok)
    };
};

const extractTrackCodecs = (pathInfo) => {
    const raw = pathInfo?.tracks || pathInfo?.tracks2 || [];
    if (!Array.isArray(raw)) return [];
    return raw
        .map((t) => (typeof t === 'string' ? t : (t?.codec || t?.type || '')))
        .filter(Boolean);
};

/**
 * Tes tayangan kamera: memicu MediaMTX menarik RTSP kamera (on-demand) melalui permintaan HLS,
 * lalu membaca codec video yang diterima.
 */
const testCameraStream = async (cfg, camera) => {
    if (!camera.streamPath) {
        return { ok: false, error: 'Kode path kamera kosong' };
    }
    if (!buildRtspUrl(camera)) {
        return { ok: false, error: 'IP / sumber RTSP kamera belum diisi' };
    }

    const result = { ok: false, codecs: [], warnings: [] };

    if (cfg.apiUrl) {
        const sync = await syncCamera(cfg, camera);
        if (!sync.ok && !sync.skipped) {
            return { ...result, error: `Gagal mendaftarkan kamera ke MediaMTX: ${sync.error}` };
        }
    }

    if (cfg.hlsUrl) {
        try {
            const res = await fetchWithTimeout(
                `${cfg.hlsUrl}/${camera.streamPath}/index.m3u8`,
                { headers: buildAuthHeaders(cfg) },
                25000
            );
            const body = await res.text();
            if (res.ok && body.includes('#EXTM3U')) {
                result.ok = true;
            } else if (res.status === 401 || res.status === 403) {
                result.error = 'MediaMTX menolak akses baca: periksa username/password gateway';
            } else {
                result.error = `Kamera belum mengirim video (HTTP ${res.status}). Periksa IP, port 554, username/password RTSP, dan koneksi Tailscale unit.`;
            }
        } catch (err) {
            result.error = `Tidak ada respons dari kamera: ${describeFetchError(err)}`;
        }
    } else if (!cfg.apiUrl) {
        return { ...result, error: 'Isi minimal alamat HLS atau Control API gateway untuk melakukan tes.' };
    }

    if (cfg.apiUrl) {
        const info = await apiRequest(cfg, 'GET', `/v3/paths/get/${encodeURIComponent(camera.streamPath)}`);
        if (info.ok && info.data) {
            result.codecs = extractTrackCodecs(info.data);
            if (!cfg.hlsUrl) {
                result.ok = Boolean(info.data.ready);
                if (!result.ok) {
                    result.error = 'Path terdaftar, namun stream belum siap. Lakukan tes ulang atau buka Live Monitoring.';
                }
            }
        }
    }

    if (result.codecs.some((c) => /265|hevc/i.test(c))) {
        result.warnings.push(
            'Kamera mengirim video H.265/HEVC. Sebagian besar browser tidak dapat memutarnya. ' +
            'Ubah Video Encoding Sub-Stream di DVR/NVR/kamera menjadi H.264.'
        );
    }

    return result;
};

module.exports = {
    getGatewayConfig,
    isPlaybackConfigured,
    buildAuthHeaders,
    usesGatewayPlayback,
    fetchWithTimeout,
    describeFetchError,
    syncCamera,
    syncAllCameras,
    deleteCameraPath,
    testGateway,
    testCameraStream
};
