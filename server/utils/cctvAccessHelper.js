const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Mengecek apakah user memiliki jabatan (position) Kepala Bidang Sarana.
 * Hanya position inilah yang awalnya memiliki akses ke Management CCTV
 * dan berwenang mengelola kamera serta memberikan akses ke user lain.
 */
const isKabidSaranaPosition = (user) => {
    const pos = String(user?.position || '').toLowerCase();
    return pos.includes('kepala bidang sarana');
};

/**
 * Mengambil metadata akses CCTV milik user dari database.
 */
const getUserCctvAccessMeta = async (user, prismaClient = prisma) => {
    if (!user || !user.id) {
        return {
            isCctvManager: false,
            cctvAccessCount: 0,
            hasCctvAccess: false
        };
    }

    const isCctvManager = isKabidSaranaPosition(user);
    let cctvAccessCount = 0;

    try {
        cctvAccessCount = await prismaClient.cctvAccess.count({
            where: { userId: Number(user.id) }
        });
    } catch (err) {
        // Fallback aman bila tabel belum dimigrasi atau DB sedang tidak terjangkau
        cctvAccessCount = 0;
    }

    return {
        isCctvManager,
        cctvAccessCount,
        hasCctvAccess: isCctvManager || cctvAccessCount > 0
    };
};

/**
 * Menghasilkan slug streamPath yang aman untuk MediaMTX (huruf kecil, angka, tanda hubung).
 */
const slugifyStreamPath = (name, unitCode = '') => {
    const base = [unitCode, name]
        .filter(Boolean)
        .join('-')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
    return base || `cam-${Date.now()}`;
};

/**
 * Menyusun URL RTSP sumber berdasarkan merek & jenis perangkat kamera/DVR/NVR.
 */
const buildRtspUrl = (camera) => {
    if (!camera) return null;
    if (camera.rtspCustomUrl && String(camera.rtspCustomUrl).trim()) {
        return String(camera.rtspCustomUrl).trim();
    }

    const ip = String(camera.ipAddress || '').trim();
    if (!ip) return null;

    const port = Number(camera.rtspPort) || 554;
    const username = String(camera.rtspUsername || 'admin').trim();
    const password = camera.rtspPassword ? String(camera.rtspPassword) : '';
    const channelNo = Number(camera.channelNo) || 1;
    const quality = (camera.rtspQuality || 'SUB').toUpperCase();
    const brand = (camera.brand || 'HIKVISION').toUpperCase();
    const deviceType = (camera.deviceType || 'DVR_NVR').toUpperCase();

    const encodedUser = encodeURIComponent(username);
    const encodedPass = password ? `:${encodeURIComponent(password)}` : '';
    const authSegment = username ? `${encodedUser}${encodedPass}@` : '';

    if (brand === 'HIKVISION') {
        const streamCode = quality === 'MAIN' ? '01' : '02';
        return `rtsp://${authSegment}${ip}:${port}/Streaming/Channels/${channelNo}${streamCode}`;
    }

    if (brand === 'EZVIZ') {
        if (deviceType === 'WIFI_CAMERA') {
            return `rtsp://${authSegment}${ip}:${port}/h264_stream`;
        }
        const streamLabel = quality === 'MAIN' ? 'main' : 'sub';
        return `rtsp://${authSegment}${ip}:${port}/h264/ch${channelNo}/${streamLabel}/av_stream`;
    }

    if (brand === 'DAHUA') {
        const subtype = quality === 'MAIN' ? '0' : '1';
        return `rtsp://${authSegment}${ip}:${port}/cam/realmonitor?channel=${channelNo}&subtype=${subtype}`;
    }

    if (brand === 'G-LENZ' || brand === 'GLENZ') {
        const idx = Math.max(0, channelNo - 1);
        const streamLabel = quality === 'MAIN' ? 'MAIN' : 'SUB';
        return `rtsp://${authSegment}${ip}:${port}/live/${idx}/${streamLabel}`;
    }

    return `rtsp://${authSegment}${ip}:${port}/stream${channelNo}`;
};

/**
 * Menghasilkan konfigurasi mediamtx.yml otomatis untuk seluruh kamera aktif yang memiliki sumber RTSP.
 * gateway: { username, password } dipakai sebagai akun internal MediaMTX (izin read, playback, api)
 * sehingga hanya backend Sarpras yang dapat membaca stream & mengatur path.
 */
const yamlQuote = (value) => `"${String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

const generateMediamtxConfig = (cameras = [], gateway = {}) => {
    const gwUser = gateway.username || 'sarpras';
    const gwPass = gateway.password || 'GANTI_PASSWORD_GATEWAY';

    const lines = [
        '# Konfigurasi MediaMTX (Auto-Generated oleh Management CCTV Sarpras)',
        '# Jalankan di server yang terhubung Tailscale ke jaringan CCTV semua unit.',
        '# Kamera baru juga otomatis didaftarkan backend melalui Control API (tanpa edit file ini).',
        '',
        'logLevel: info',
        '',
        '# --- Autentikasi: hanya backend Sarpras (akun gateway) yang boleh membaca stream & memakai API ---',
        'authMethod: internal',
        'authInternalUsers:',
        `  - user: ${yamlQuote(gwUser)}`,
        `    pass: ${yamlQuote(gwPass)}`,
        '    ips: []',
        '    permissions:',
        '      - action: read',
        '      - action: playback',
        '      - action: api',
        '',
        '# --- Control API (dipakai tombol "Sinkronkan" & "Tes Kamera" di website) ---',
        'api: yes',
        'apiAddress: :9997',
        '',
        '# --- WebRTC (latensi < 1 detik) ---',
        'webrtc: yes',
        'webrtcAddress: :8889',
        'webrtcLocalUDPAddress: :8189',
        '# Isi IP publik / domain server agar browser dari luar jaringan dapat menerima video WebRTC.',
        '# Jika dibiarkan kosong, website otomatis beralih ke mode HLS (tetap tampil, delay 2-5 detik).',
        'webrtcAdditionalHosts: []',
        '',
        '# --- HLS (cadangan otomatis, berjalan lewat proxy backend) ---',
        'hls: yes',
        'hlsAddress: :8888',
        'hlsVariant: fmp4',
        'hlsSegmentDuration: 1s',
        '',
        '# --- Protokol lain tidak diperlukan ---',
        'rtmp: no',
        'srt: no',
        '',
        'paths:'
    ];

    const configuredCameras = cameras.filter((cam) => cam.isActive && buildRtspUrl(cam));

    if (configuredCameras.length === 0) {
        lines.push('  # Belum ada kamera aktif dengan IP/RTSP terdaftar.');
        lines.push('  # Kamera akan ditambahkan otomatis oleh website melalui Control API.');
        lines.push('  all_others:');
    } else {
        for (const cam of configuredCameras) {
            const pathKey = cam.streamPath || slugifyStreamPath(cam.name, cam.unit?.code || '');
            const rtspUrl = buildRtspUrl(cam);
            const label = [cam.unit?.name, cam.name, cam.brand, cam.deviceType].filter(Boolean).join(' | ');
            lines.push(`  # ${label}`);
            lines.push(`  ${pathKey}:`);
            lines.push(`    source: ${yamlQuote(rtspUrl)}`);
            lines.push('    sourceOnDemand: yes');
            lines.push('');
        }
    }

    return lines.join('\n');
};

module.exports = {
    isKabidSaranaPosition,
    getUserCctvAccessMeta,
    slugifyStreamPath,
    buildRtspUrl,
    generateMediamtxConfig
};
