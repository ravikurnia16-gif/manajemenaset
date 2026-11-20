import { useMemo, useState } from 'react';
import {
    X, Save, Eye, EyeOff, Cctv, ChevronDown, ChevronRight,
    Wifi, HardDrive, Info, Server, AlertTriangle, Sparkles, BellRing
} from 'lucide-react';

const STREAM_MODE_INFO = {
    GATEWAY: {
        label: 'Gateway Sarpras (MediaMTX Otomatis - Rekomendasi)',
        placeholder: '',
        hint: 'Tidak perlu mengisi URL web manual. Backend otomatis menghubungkan kamera via Pengaturan Gateway MediaMTX & melindungi stream dengan hak akses user.'
    },
    WHEP: {
        label: 'URL WebRTC / WHEP Langsung (Manual)',
        placeholder: 'https://cctv.domain-yayasan.id/sdit1-gerbang/whep',
        hint: 'Isi URL endpoint WHEP secara manual jika tidak lewat proxy Gateway Sarpras.'
    },
    HLS: {
        label: 'URL HLS .m3u8 Langsung (Manual)',
        placeholder: 'https://cctv.domain-yayasan.id/sdit1-gerbang/index.m3u8',
        hint: 'Mendukung semua browser melalui hls.js.'
    },
    IFRAME: {
        label: 'Iframe / Web Embed (Manual)',
        placeholder: 'https://cctv.domain-yayasan.id/sdit1-gerbang/',
        hint: 'Menampilkan halaman web player eksternal atau embed NVR.'
    },
    MJPEG: {
        label: 'MJPEG / Snapshot Gambar (Manual)',
        placeholder: 'http://ip-kamera/mjpg/video.mjpg',
        hint: 'Cocok untuk stream MJPEG langsung atau endpoint snapshot.'
    },
    VIDEO: {
        label: 'Direct Video MP4 / Test (Manual)',
        placeholder: 'https://.../sample.mp4',
        hint: 'Untuk memutar URL file MP4 langsung atau simulasi uji coba pemutar.'
    }
};

const computeRtspPreview = (form) => {
    if (form.rtspCustomUrl?.trim()) return form.rtspCustomUrl.trim();
    if (!form.ipAddress?.trim()) return '';
    const ip = form.ipAddress.trim();
    const port = Number(form.rtspPort) || 554;
    const user = form.rtspUsername?.trim() || 'admin';
    const pass = form.rtspPassword ? `:${form.rtspPassword}` : '';
    const auth = user ? `${user}${pass}@` : '';
    const ch = form.deviceType === 'WIFI_CAMERA' ? 1 : (Number(form.channelNo) || 1);
    const quality = (form.rtspQuality || 'SUB').toUpperCase();

    if (form.brand === 'HIKVISION') {
        const suffix = quality === 'MAIN' ? '01' : '02';
        return `rtsp://${auth}${ip}:${port}/Streaming/Channels/${ch}${suffix}`;
    }
    if (form.brand === 'EZVIZ') {
        if (form.deviceType === 'WIFI_CAMERA') {
            return `rtsp://${auth}${ip}:${port}/h264_stream`;
        }
        const label = quality === 'MAIN' ? 'main' : 'sub';
        return `rtsp://${auth}${ip}:${port}/h264/ch${ch}/${label}/av_stream`;
    }
    if (form.brand === 'DAHUA') {
        const subtype = quality === 'MAIN' ? '0' : '1';
        return `rtsp://${auth}${ip}:${port}/cam/realmonitor?channel=${ch}&subtype=${subtype}`;
    }
    if (form.brand === 'G-LENZ' || form.brand === 'GLENZ') {
        const idx = Math.max(1, ch);
        const label = quality === 'MAIN' ? 'MAIN' : 'SUB';
        return `rtsp://${auth}${ip}:${port}/live/${idx}/${label}`;
    }
    return `rtsp://${auth}${ip}:${port}/stream${ch}`;
};

const buildInitialForm = (initialData) => ({
    name: initialData?.name || '',
    unitId: initialData?.unitId ? String(initialData.unitId) : '',
    location: initialData?.location || '',
    brand: initialData?.brand || 'HIKVISION',
    deviceType: initialData?.deviceType || 'DVR_NVR',
    channelNo: initialData?.channelNo || 1,
    streamMode: initialData?.streamMode || 'GATEWAY',
    streamUrl: initialData?.streamUrl || '',
    streamPath: initialData?.streamPath || '',
    ipAddress: initialData?.ipAddress || '',
    rtspPort: initialData?.rtspPort || 554,
    rtspUsername: initialData?.rtspUsername || 'admin',
    rtspPassword: initialData?.rtspPassword || '',
    rtspQuality: initialData?.rtspQuality || 'SUB',
    rtspCustomUrl: initialData?.rtspCustomUrl || '',
    notes: initialData?.notes || '',
    sortOrder: initialData?.sortOrder || 0,
    isActive: initialData?.isActive !== undefined ? initialData.isActive : true,
    aiEnabled: Boolean(initialData?.aiEnabled),
    aiPreset: initialData?.aiPreset || 'CLASSROOM',
    aiCustomPrompt: initialData?.aiCustomPrompt || '',
    aiWatchEnabled: Boolean(initialData?.aiWatchEnabled),
    aiWatchStart: initialData?.aiWatchStart || '22:00',
    aiWatchEnd: initialData?.aiWatchEnd || '05:00',
    aiWatchIntervalSec: initialData?.aiWatchIntervalSec ?? 5,
    aiMotionThreshold: initialData?.aiMotionThreshold ?? 6.0,
    aiAlertCooldownSec: initialData?.aiAlertCooldownSec ?? 180,
    aiAlertRecipients: initialData?.aiAlertRecipients || ''
});

const CameraFormModalInner = ({
    onClose,
    onSave,
    initialData = null,
    units = [],
    gatewayConfigured = false,
    saving = false
}) => {
    const [form, setForm] = useState(() => buildInitialForm(initialData));
    const [showRtspManual, setShowRtspManual] = useState(
        () => Boolean(initialData?.ipAddress || initialData?.rtspCustomUrl || initialData?.streamPath)
    );
    const [showPassword, setShowPassword] = useState(false);

    const rtspPreview = useMemo(() => computeRtspPreview(form), [form]);
    const isGatewayMode = form.streamMode === 'GATEWAY';
    const modeInfo = STREAM_MODE_INFO[form.streamMode] || STREAM_MODE_INFO.GATEWAY;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        onSave({
            ...form,
            unitId: form.unitId ? parseInt(form.unitId, 10) : null,
            channelNo: form.deviceType === 'WIFI_CAMERA' ? 1 : (parseInt(form.channelNo, 10) || 1),
            rtspPort: parseInt(form.rtspPort, 10) || 554,
            sortOrder: parseInt(form.sortOrder, 10) || 0
        });
    };

    const isEditing = Boolean(initialData?.id);

    const rtspFieldsBlock = (
        <div className="space-y-4">
            {/* Tips spesifik merek */}
            {form.brand === 'EZVIZ' && (
                <div className="p-3 rounded-xl bg-cyan-50 border border-cyan-200 text-[11px] text-cyan-800 leading-relaxed">
                    <strong>Tips EZVIZ WiFi:</strong> Di aplikasi HP EZVIZ, aktifkan menu <em>LAN Live View / RTSP</em>. Gunakan <strong>admin</strong> sebagai username dan masukkan <strong>Verification Code</strong> (6 huruf di stiker bawah kamera) pada kolom password.
                </div>
            )}
            {form.brand === 'HIKVISION' && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-800 leading-relaxed">
                    <strong>Tips Hikvision DVR/NVR:</strong> Gunakan IP LAN/Tailscale DVR dengan Port <code>554</code>. Pastikan <em>Sub-Stream Encoding</em> DVR diset ke <strong>H.264</strong> (bukan H.265) agar bisa diputar mulus di seluruh browser.
                </div>
            )}
            {form.brand === 'G-LENZ' && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 leading-relaxed">
                    <strong>Tips G-LENZ DVR:</strong> Otomatis menggunakan format <code>/live/&lt;channel&gt;/SUB</code> (Channel 1 → <code>/live/1/SUB</code>, Channel 2 → <code>/live/2/SUB</code>, dst.). Gunakan Port RTSP <code>554</code> atau port external hasil Port Forwarding (misal <code>15554</code>).
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                        IP Kamera / DVR (IP LAN atau Tailscale 100.x.x.x)
                    </label>
                    <input
                        type="text"
                        value={form.ipAddress}
                        onChange={(e) => setForm({ ...form, ipAddress: e.target.value })}
                        placeholder="100.64.0.12 atau 192.168.1.50"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono bg-white"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Port RTSP</label>
                    <input
                        type="number"
                        value={form.rtspPort}
                        onChange={(e) => setForm({ ...form, rtspPort: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono bg-white"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Username RTSP</label>
                    <input
                        type="text"
                        value={form.rtspUsername}
                        onChange={(e) => setForm({ ...form, rtspUsername: e.target.value })}
                        placeholder="admin"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono bg-white"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {form.brand === 'EZVIZ' ? 'Verification Code / Password' : 'Password RTSP DVR/NVR'}
                    </label>
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={form.rtspPassword}
                            onChange={(e) => setForm({ ...form, rtspPassword: e.target.value })}
                            placeholder={form.brand === 'EZVIZ' ? 'Kode 6 huruf di stiker' : '••••••'}
                            className="w-full px-3 py-2 pr-9 rounded-lg border border-slate-300 text-sm font-mono bg-white"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((s) => !s)}
                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                        >
                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Kualitas RTSP</label>
                    <select
                        value={form.rtspQuality}
                        onChange={(e) => setForm({ ...form, rtspQuality: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                    >
                        <option value="SUB">Sub-Stream (Ringan &amp; H.264)</option>
                        <option value="MAIN">Main-Stream (HD Tinggi)</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Kode Path MediaMTX</label>
                    <input
                        type="text"
                        value={form.streamPath}
                        onChange={(e) => setForm({ ...form, streamPath: e.target.value })}
                        placeholder="Otomatis jika dikosongkan"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono bg-white"
                    />
                </div>
                <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Custom RTSP URL (Opsional Override)
                    </label>
                    <input
                        type="text"
                        value={form.rtspCustomUrl}
                        onChange={(e) => setForm({ ...form, rtspCustomUrl: e.target.value })}
                        placeholder="Isi hanya jika format RTSP kamera berbeda dari standar"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono bg-white"
                    />
                </div>
            </div>

            {rtspPreview && (
                <div className="p-3 bg-slate-900 rounded-xl text-emerald-300 text-xs font-mono break-all">
                    <div className="text-[10px] text-slate-400 uppercase font-sans font-bold mb-1">
                        Alamat RTSP Sumber (Hanya Terlihat oleh Kepala Bidang Sarana):
                    </div>
                    {rtspPreview}
                </div>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-200">
                            <Cctv size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-800">
                                {isEditing ? 'Edit Kamera CCTV' : 'Tambah Kamera CCTV Baru'}
                            </h3>
                            <p className="text-xs text-slate-500">
                                Dukung perangkat DVR/NVR Hikvision maupun Kamera WiFi EZVIZ lintas jaringan.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
                    {/* Identitas Kamera */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Nama Kamera <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="Contoh: Gerbang Utama SDIT 1"
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Unit Pendidikan / Lokasi</label>
                            <select
                                value={form.unitId}
                                onChange={(e) => setForm({ ...form, unitId: e.target.value })}
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            >
                                <option value="">-- Umum / Lintas Unit --</option>
                                {units.map((u) => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Area / Titik Lokasi</label>
                            <input
                                type="text"
                                value={form.location}
                                onChange={(e) => setForm({ ...form, location: e.target.value })}
                                placeholder="Contoh: Pos Satpam / Koridor Lt. 1"
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Merek & Jenis Perangkat */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Merek Kamera</label>
                            <select
                                value={form.brand}
                                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="HIKVISION">Hikvision</option>
                                <option value="G-LENZ">G-LENZ</option>
                                <option value="EZVIZ">EZVIZ</option>
                                <option value="DAHUA">Dahua</option>
                                <option value="LAINNYA">Lainnya (ONVIF/RTSP)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Tipe Perangkat</label>
                            <div className="grid grid-cols-2 gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setForm({ ...form, deviceType: 'DVR_NVR' })}
                                    className={`flex items-center justify-center gap-1 py-2 px-2 rounded-xl border text-xs font-semibold transition-all ${
                                        form.deviceType === 'DVR_NVR'
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                                    }`}
                                >
                                    <HardDrive size={13} /> DVR/NVR
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setForm({ ...form, deviceType: 'WIFI_CAMERA', channelNo: 1 })}
                                    className={`flex items-center justify-center gap-1 py-2 px-2 rounded-xl border text-xs font-semibold transition-all ${
                                        form.deviceType === 'WIFI_CAMERA'
                                            ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm'
                                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                                    }`}
                                >
                                    <Wifi size={13} /> WiFi
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Channel DVR/NVR</label>
                            <input
                                type="number"
                                min={1}
                                max={64}
                                disabled={form.deviceType === 'WIFI_CAMERA'}
                                value={form.deviceType === 'WIFI_CAMERA' ? 1 : form.channelNo}
                                onChange={(e) => setForm({ ...form, channelNo: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white disabled:bg-slate-100 disabled:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Cara Pemutaran & Sumber Kamera */}
                    <div className="space-y-3 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className={isGatewayMode ? 'sm:col-span-3' : 'sm:col-span-1'}>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Mode Pemutar Video</label>
                                <select
                                    value={form.streamMode}
                                    onChange={(e) => setForm({ ...form, streamMode: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    {Object.entries(STREAM_MODE_INFO).map(([key, item]) => (
                                        <option key={key} value={key}>{item.label}</option>
                                    ))}
                                </select>
                            </div>

                            {!isGatewayMode && (
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-bold text-slate-700 mb-1">URL Stream Web</label>
                                    <input
                                        type="text"
                                        value={form.streamUrl}
                                        onChange={(e) => setForm({ ...form, streamUrl: e.target.value })}
                                        placeholder={modeInfo.placeholder}
                                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                    />
                                </div>
                            )}
                        </div>

                        <p className="text-[11px] text-blue-700 flex items-start gap-1.5">
                            {isGatewayMode ? <Server size={13} className="shrink-0 mt-0.5" /> : <Info size={13} className="shrink-0 mt-0.5" />}
                            <span>{modeInfo.hint}</span>
                        </p>

                        {isGatewayMode && !gatewayConfigured && (
                            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-center gap-2">
                                <AlertTriangle size={14} className="shrink-0 text-amber-600" />
                                <span>
                                    Gateway MediaMTX belum dikonfigurasi. Data kamera tetap bisa disimpan dulu, lalu lanjut atur di tab <strong>Pengaturan &amp; Gateway</strong>.
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Sumber RTSP: Langsung terbuka untuk mode GATEWAY, lipat untuk mode URL manual */}
                    {isGatewayMode ? (
                        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                Sumber Koneksi Kamera (RTSP / IP Perangkat)
                            </h4>
                            {rtspFieldsBlock}
                        </div>
                    ) : (
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setShowRtspManual((v) => !v)}
                                className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-700 transition-colors"
                            >
                                <span>Detail Sumber RTSP / Tailscale (Opsional)</span>
                                {showRtspManual ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                            {showRtspManual && (
                                <div className="p-4 bg-white border-t border-slate-200">
                                    {rtspFieldsBlock}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Status, Urutan & Catatan */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Urutan Tampil</label>
                            <input
                                type="number"
                                value={form.sortOrder}
                                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                            />
                        </div>
                        <div className="sm:col-span-2 flex items-center gap-3 pt-4">
                            <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={form.isActive}
                                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm font-semibold text-slate-700">
                                    Kamera Aktif (Siap Ditayangkan)
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* Pengaturan Analisis AI & Jaga Otomatis + Alert WA (Opsional Per-Kamera) */}
                    <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <h3 className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                                    <Sparkles size={14} className="text-purple-600" />
                                    Analisis AI &amp; Penjagaan Otomatis (Opsional Per-Kamera)
                                </h3>
                                <p className="text-[11px] text-slate-600 mt-0.5">
                                    Aktifkan hanya untuk kamera tertentu yang membutuhkan AI (mis. pantau kelas atau kamera belakang malam hari).
                                </p>
                            </div>
                            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-purple-200 cursor-pointer shrink-0">
                                <input
                                    type="checkbox"
                                    checked={form.aiEnabled}
                                    onChange={(e) => setForm({
                                        ...form,
                                        aiEnabled: e.target.checked,
                                        aiWatchEnabled: e.target.checked ? form.aiWatchEnabled : false
                                    })}
                                    className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-xs font-bold text-purple-900">Aktifkan AI</span>
                            </label>
                        </div>

                        {form.aiEnabled && (
                            <div className="space-y-3 pt-2 border-t border-purple-200/70">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Mode Analisis AI</label>
                                        <select
                                            value={form.aiPreset}
                                            onChange={(e) => setForm({ ...form, aiPreset: e.target.value })}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                                        >
                                            <option value="CLASSROOM">Kelas: Hitung Siswa &amp; Cek Guru</option>
                                            <option value="SECURITY_NIGHT">Keamanan Malam: Deteksi Penyusup / Maling</option>
                                            <option value="CROWD">Area Umum: Hitung Orang &amp; Kendaraan</option>
                                            <option value="CUSTOM">Instruksi Kustom (Tulis Sendiri)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                            Catatan / Instruksi AI {form.aiPreset === 'CUSTOM' ? '(Wajib untuk Custom)' : '(Opsional)'}
                                        </label>
                                        <input
                                            type="text"
                                            value={form.aiCustomPrompt}
                                            onChange={(e) => setForm({ ...form, aiCustomPrompt: e.target.value })}
                                            placeholder={
                                                form.aiPreset === 'SECURITY_NIGHT'
                                                    ? 'Contoh: Waspadai orang dekat pagar belakang'
                                                    : 'Contoh: Cek apakah lampu/AC masih menyala'
                                            }
                                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="p-3 rounded-xl bg-white border border-purple-200 space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div>
                                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                                <BellRing size={13} className="text-amber-600" />
                                                Jaga Otomatis di Server + WA Alert
                                            </span>
                                            <span className="block text-[11px] text-slate-500">
                                                Memantau gerakan secara lokal lalu verifikasi dengan Gemini AI sesuai jam aktif sebelum kirim WA Alert.
                                            </span>
                                        </div>
                                        <label className="inline-flex items-center gap-2 cursor-pointer shrink-0">
                                            <input
                                                type="checkbox"
                                                checked={form.aiWatchEnabled}
                                                onChange={(e) => setForm({ ...form, aiWatchEnabled: e.target.checked })}
                                                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                            />
                                            <span className="text-xs font-bold text-slate-700">Aktifkan Jaga Otomatis</span>
                                        </label>
                                    </div>

                                    {form.aiWatchEnabled && (
                                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-600 mb-1">Jam Mulai (WIB)</label>
                                                <input
                                                    type="time"
                                                    value={form.aiWatchStart}
                                                    onChange={(e) => setForm({ ...form, aiWatchStart: e.target.value })}
                                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-600 mb-1">Jam Selesai (WIB)</label>
                                                <input
                                                    type="time"
                                                    value={form.aiWatchEnd}
                                                    onChange={(e) => setForm({ ...form, aiWatchEnd: e.target.value })}
                                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-600 mb-1">Interval Cek (dtk)</label>
                                                <input
                                                    type="number"
                                                    min={3}
                                                    max={300}
                                                    value={form.aiWatchIntervalSec}
                                                    onChange={(e) => setForm({ ...form, aiWatchIntervalSec: e.target.value })}
                                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-600 mb-1">Sensitivitas Gerak (%)</label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={50}
                                                    step="0.5"
                                                    value={form.aiMotionThreshold}
                                                    onChange={(e) => setForm({ ...form, aiMotionThreshold: e.target.value })}
                                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-600 mb-1">Jeda Alert WA (dtk)</label>
                                                <input
                                                    type="number"
                                                    min={30}
                                                    max={3600}
                                                    value={form.aiAlertCooldownSec}
                                                    onChange={(e) => setForm({ ...form, aiAlertCooldownSec: e.target.value })}
                                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                                                />
                                            </div>
                                            <div className="col-span-2 sm:col-span-5">
                                                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                                                    Nomor HP / ID Grup Penerima WA Alert (pisah koma — kosongkan untuk kirim ke Kepala Bidang Sarana / Grup Sarpras)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={form.aiAlertRecipients}
                                                    onChange={(e) => setForm({ ...form, aiAlertRecipients: e.target.value })}
                                                    placeholder="Contoh: 081234567890, 628987654321, 120363xxxx@g.us"
                                                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Catatan (Opsional)</label>
                        <textarea
                            rows={2}
                            value={form.notes}
                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            placeholder="Catatan teknis perangkat, nomor NVR, posisi tiang, dll..."
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </form>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-white transition-colors"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving || !form.name.trim()}
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold shadow-md shadow-blue-200 transition-colors"
                    >
                        <Save size={16} />
                        {saving ? 'Menyimpan...' : isEditing ? 'Simpan Perubahan' : 'Simpan Kamera'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const CameraFormModal = ({ isOpen, initialData = null, ...props }) => {
    if (!isOpen) return null;
    const modalKey = initialData?.id
        ? `edit-${initialData.id}-${initialData.updatedAt || ''}`
        : initialData
            ? `dup-${initialData.channelNo || 1}`
            : 'create-new';
    return <CameraFormModalInner key={modalKey} initialData={initialData} {...props} />;
};

export default CameraFormModal;
