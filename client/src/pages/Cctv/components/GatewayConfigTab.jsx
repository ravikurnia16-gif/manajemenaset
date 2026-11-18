import { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import {
    Copy, Check, Download, RefreshCw, Server, Network, Shield,
    Save, PlugZap, CheckCircle2, XCircle, AlertCircle, Eye, EyeOff,
    KeyRound, Wifi, HardDrive, ArrowRight, Cctv, Users
} from 'lucide-react';
import api from '../../../lib/axios';

const SETUP_STEPS = [
    {
        step: 1,
        icon: Network,
        color: 'blue',
        title: 'Siapkan Kamera & Jaringan Lintas Unit (Tailscale Gratis)',
        points: [
            'Hikvision / G-LENZ DVR/NVR: Pastikan terhubung ke jaringan lokal, catat IP DVR dan port RTSP (554). Pada pengaturan Video/Encode di DVR, pastikan Sub-Stream memakai H.264 (bukan H.265 agar tampil di semua browser). Untuk unit yang modemnya memiliki IP Publik, buka Port Forwarding ke port 554 DVR.',
            'EZVIZ WiFi: Buka aplikasi HP EZVIZ → Pengaturan Kamera → aktifkan LAN Live View / RTSP. Password RTSP kamera adalah Verification Code (6 huruf kapital di stiker bawah kamera).',
            'Unit Terkena CGNAT / Beda Jaringan: Gunakan VPN di MikroTik sekolah atau router OpenWrt/Tailscale agar DVR unit dapat dijangkau oleh server MediaMTX pusat.'
        ]
    },
    {
        step: 2,
        icon: Server,
        color: 'emerald',
        title: 'Jalankan Gateway MediaMTX',
        points: [
            'Isi Username & Password Gateway pada formulir Pengaturan di atas lalu klik Simpan Pengaturan (agar file mediamtx.yml otomatis terisi kredensial aman).',
            'Unduh file mediamtx.yml di bagian bawah halaman ini, lalu jalankan container Docker MediaMTX di server yang sudah terhubung Tailscale.',
            'Jika website online via Easypanel / Docker Compose, taruh container bluenviron/mediamtx satu network dengan server ini lalu gunakan preset Docker (http://mediamtx:8889, :8888, :9997).'
        ]
    },
    {
        step: 3,
        icon: Cctv,
        color: 'indigo',
        title: 'Hubungkan, Daftarkan & Tes Kamera',
        points: [
            'Klik "Tes Koneksi Gateway" pada form di atas dan pastikan status Control API (:9997) dan HLS (:8888) berwarna hijau.',
            'Buka tab Kelola Kamera → Tambah Kamera, pilih Mode Pemutar "Gateway Sarpras (Otomatis)", masukkan IP kamera/DVR, channel, username, dan password RTSP.',
            'Klik tombol "Tes Kamera" pada baris kamera untuk memverifikasi tarikan video RTSP dan memastikan codec yang diterima adalah H.264.'
        ]
    },
    {
        step: 4,
        icon: Users,
        color: 'violet',
        title: 'Buka Menu CCTV ke User Lain Sesuai Kebutuhan',
        points: [
            'Selama belum diberi akses, hanya Kepala Bidang Sarana yang melihat menu Management CCTV.',
            'Buka tab Hak Akses Pengguna → pilih 1 user di panel kiri → centang kamera tertentu di panel kanan → Simpan Hak Akses.',
            'Menu Management CCTV akan otomatis muncul di Sidebar user tersebut dan hanya menayangkan kamera yang Anda izinkan.'
        ]
    }
];

const DOCKER_COMMAND = 'docker run -d --name mediamtx --restart unless-stopped -p 8889:8889 -p 8888:8888 -p 9997:9997 -p 8189:8189/udp -v ./mediamtx.yml:/mediamtx.yml bluenviron/mediamtx';

const StatusChip = ({ label, state }) => {
    if (!state) return null;
    if (state.skipped) {
        return (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
                <AlertCircle size={16} className="text-slate-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-600">{label}: Belum Diisi</p>
                    <p className="text-[11px] text-slate-500">{state.error}</p>
                </div>
            </div>
        );
    }
    if (state.ok) {
        return (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                    <p className="text-xs font-bold text-emerald-800">{label}: Terhubung</p>
                    <p className="text-[11px] text-emerald-700">Layanan MediaMTX merespons normal (HTTP {state.status || 200}).</p>
                </div>
            </div>
        );
    }
    return (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5">
            <XCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
                <p className="text-xs font-bold text-rose-800">{label}: Gagal Terhubung</p>
                <p className="text-[11px] text-rose-700 break-words">{state.error || 'Tidak terjangkau'}</p>
            </div>
        </div>
    );
};

const GatewayConfigTab = ({ onGatewayUpdated, onGoToTab }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const [form, setForm] = useState({
        webrtcUrl: '',
        hlsUrl: '',
        apiUrl: '',
        username: 'sarpras',
        password: ''
    });
    const [hasSavedPassword, setHasSavedPassword] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [testReport, setTestReport] = useState(null);

    const [yaml, setYaml] = useState('');
    const [stats, setStats] = useState({ totalCameras: 0, configuredCount: 0, hasGatewayCredentials: false });
    const [copiedYaml, setCopiedYaml] = useState(false);
    const [copiedDocker, setCopiedDocker] = useState(false);

    const loadAll = useCallback(async () => {
        try {
            setLoading(true);
            const [gwRes, cfgRes] = await Promise.all([
                api.get('/cctv/gateway'),
                api.get('/cctv/mediamtx-config')
            ]);

            if (gwRes.data) {
                setForm({
                    webrtcUrl: gwRes.data.webrtcUrl || '',
                    hlsUrl: gwRes.data.hlsUrl || '',
                    apiUrl: gwRes.data.apiUrl || '',
                    username: gwRes.data.username || 'sarpras',
                    password: ''
                });
                setHasSavedPassword(Boolean(gwRes.data.hasPassword));
            }
            if (cfgRes.data) {
                setYaml(cfgRes.data.yaml || '');
                setStats({
                    totalCameras: cfgRes.data.totalCameras || 0,
                    configuredCount: cfgRes.data.configuredCount || 0,
                    hasGatewayCredentials: Boolean(cfgRes.data.hasGatewayCredentials)
                });
            }
        } catch (err) {
            console.error('Failed to fetch gateway settings:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    const handleApplyPreset = (type) => {
        if (type === 'local') {
            setForm((prev) => ({
                ...prev,
                webrtcUrl: 'http://localhost:8889',
                hlsUrl: 'http://localhost:8888',
                apiUrl: 'http://localhost:9997'
            }));
        } else {
            setForm((prev) => ({
                ...prev,
                webrtcUrl: 'http://mediamtx:8889',
                hlsUrl: 'http://mediamtx:8888',
                apiUrl: 'http://mediamtx:9997'
            }));
        }
    };

    const handleGenerateRandomPassword = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        let generated = 'Sarpras#';
        for (let i = 0; i < 12; i += 1) {
            generated += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setForm((prev) => ({ ...prev, password: generated }));
        setShowPassword(true);
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            await api.put('/cctv/gateway', form);
            await loadAll();
            await onGatewayUpdated?.();
            Swal.fire({
                icon: 'success',
                title: 'Pengaturan Gateway Tersimpan',
                text: 'Konfigurasi MediaMTX dan template mediamtx.yml telah diperbarui.',
                timer: 1800,
                showConfirmButton: false
            });
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Menyimpan Gateway',
                text: err.response?.data?.error || err.message
            });
        } finally {
            setSaving(false);
        }
    };

    const handleTestConnection = async () => {
        try {
            setTesting(true);
            const res = await api.post('/cctv/gateway/test', form);
            setTestReport(res.data);
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Mengetes Gateway',
                text: err.response?.data?.error || err.message
            });
        } finally {
            setTesting(false);
        }
    };

    const handleSyncCameras = async () => {
        try {
            setSyncing(true);
            const res = await api.post('/cctv/gateway/sync');
            const d = res.data || {};
            Swal.fire({
                icon: d.failedCount > 0 ? 'warning' : 'success',
                title: 'Sinkronisasi Selesai',
                html: `Berhasil disinkronkan: <b>${d.syncedCount || 0}</b> kamera<br/>Dilewati (tanpa RTSP / nonaktif): <b>${d.skippedCount || 0}</b><br/>Gagal: <b>${d.failedCount || 0}</b>`
            });
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Sinkronisasi Kamera',
                text: err.response?.data?.error || err.message
            });
        } finally {
            setSyncing(false);
        }
    };

    const handleCopyYaml = async () => {
        try {
            await navigator.clipboard.writeText(yaml);
            setCopiedYaml(true);
            setTimeout(() => setCopiedYaml(false), 2000);
        } catch {
            // ignore clipboard denial
        }
    };

    const handleCopyDocker = async () => {
        try {
            await navigator.clipboard.writeText(DOCKER_COMMAND);
            setCopiedDocker(true);
            setTimeout(() => setCopiedDocker(false), 2000);
        } catch {
            // ignore clipboard denial
        }
    };

    const handleDownloadYaml = () => {
        const blob = new Blob([yaml], { type: 'text/yaml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mediamtx.yml';
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            {/* 1. Form Pengaturan Gateway MediaMTX */}
            <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-sm shrink-0">
                            <Server size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm sm:text-base font-bold text-slate-900">
                                Pengaturan Koneksi Gateway MediaMTX
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Alamat MediaMTX yang dijangkau oleh server backend ini. Semua video akan diproksi aman sesuai hak akses user tanpa mengekspos IP kamera.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={() => handleApplyPreset('local')}
                            className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-700 transition-colors"
                        >
                            Preset Lokal (localhost)
                        </button>
                        <button
                            type="button"
                            onClick={() => handleApplyPreset('docker')}
                            className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-700 transition-colors"
                        >
                            Preset Docker (mediamtx)
                        </button>
                    </div>
                </div>

                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Alamat WebRTC (Port 8889)
                            </label>
                            <input
                                type="text"
                                value={form.webrtcUrl}
                                onChange={(e) => setForm({ ...form, webrtcUrl: e.target.value })}
                                placeholder="http://localhost:8889"
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <p className="text-[11px] text-slate-500 mt-1">Utama, latensi &lt; 1 detik.</p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Alamat HLS (Port 8888)
                            </label>
                            <input
                                type="text"
                                value={form.hlsUrl}
                                onChange={(e) => setForm({ ...form, hlsUrl: e.target.value })}
                                placeholder="http://localhost:8888"
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <p className="text-[11px] text-slate-500 mt-1">Wajib diisi untuk fallback di balik firewall &amp; tes stream.</p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Alamat Control API (Port 9997)
                            </label>
                            <input
                                type="text"
                                value={form.apiUrl}
                                onChange={(e) => setForm({ ...form, apiUrl: e.target.value })}
                                placeholder="http://localhost:9997"
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <p className="text-[11px] text-slate-500 mt-1">Agar kamera baru otomatis tersinkron ke MediaMTX.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Username Internal MediaMTX
                            </label>
                            <input
                                type="text"
                                value={form.username}
                                onChange={(e) => setForm({ ...form, username: e.target.value })}
                                placeholder="sarpras"
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-bold text-slate-700">
                                    Password Internal MediaMTX
                                </label>
                                <button
                                    type="button"
                                    onClick={handleGenerateRandomPassword}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800"
                                >
                                    <KeyRound size={12} /> Buat Password Acak
                                </button>
                            </div>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    placeholder={hasSavedPassword ? 'Tersimpan — kosongkan jika tidak ingin mengubah' : 'Masukkan password gateway'}
                                    className="w-full px-3.5 py-2 pr-10 rounded-xl border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((s) => !s)}
                                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Tombol Aksi */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="submit"
                                disabled={saving}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-sm disabled:opacity-50"
                            >
                                <Save size={15} />
                                {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
                            </button>

                            <button
                                type="button"
                                onClick={handleTestConnection}
                                disabled={testing}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-sm disabled:opacity-50"
                            >
                                <PlugZap size={15} />
                                {testing ? 'Mengetes...' : 'Tes Koneksi Gateway'}
                            </button>

                            <button
                                type="button"
                                onClick={handleSyncCameras}
                                disabled={syncing}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs sm:text-sm font-bold shadow-sm disabled:opacity-50"
                            >
                                <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
                                {syncing ? 'Menyinkronkan...' : 'Sinkronkan Semua Kamera'}
                            </button>
                        </div>

                        {onGoToTab && (
                            <button
                                type="button"
                                onClick={() => onGoToTab('cameras')}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                            >
                                Lanjut ke Kelola Kamera <ArrowRight size={14} />
                            </button>
                        )}
                    </div>

                    {/* Hasil Tes Koneksi Gateway */}
                    {testReport && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
                            <StatusChip label="Control API (:9997)" state={testReport.api} />
                            <StatusChip label="WebRTC (:8889)" state={testReport.webrtc} />
                            <StatusChip label="HLS (:8888)" state={testReport.hls} />
                        </div>
                    )}
                </div>
            </form>

            {/* 2. Panduan Langkah Demi Langkah (Cara Setting di Manajemen CCTV) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                        <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                            <Shield size={18} className="text-blue-600" />
                            Langkah-Langkah Setting CCTV Hingga Muncul di Website
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Ikuti urutan berikut untuk menghubungkan DVR/NVR Hikvision &amp; kamera WiFi EZVIZ lintas unit secara gratis.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-bold">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200">
                            <HardDrive size={12} /> Hikvision DVR/NVR
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-50 text-cyan-700 border border-cyan-200">
                            <Wifi size={12} /> EZVIZ WiFi
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {SETUP_STEPS.map((item) => {
                        const Icon = item.icon;
                        return (
                            <div key={item.step} className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2.5">
                                <div className="flex items-center gap-2.5">
                                    <span className="w-7 h-7 rounded-xl bg-slate-900 text-white text-xs font-black flex items-center justify-center shrink-0">
                                        {item.step}
                                    </span>
                                    <Icon size={17} className="text-blue-600 shrink-0" />
                                    <h4 className="text-xs sm:text-sm font-bold text-slate-900">{item.title}</h4>
                                </div>
                                <ul className="space-y-1.5 pl-2">
                                    {item.points.map((pt, idx) => (
                                        <li key={idx} className="text-xs text-slate-600 leading-relaxed flex items-start gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                            <span>{pt}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 3. Perintah Docker & File mediamtx.yml Otomatis */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
                <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            File Konfigurasi <code className="text-emerald-400">mediamtx.yml</code>
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                            Terisi {stats.configuredCount} dari {stats.totalCameras} kamera dengan sumber RTSP
                            {stats.hasGatewayCredentials ? ' • Kredensial gateway aktif' : ' • Simpan password gateway agar kredensial terisi'}.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={loadAll}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
                        >
                            <RefreshCw size={13} /> Refresh
                        </button>
                        <button
                            type="button"
                            onClick={handleCopyYaml}
                            disabled={loading || !yaml}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold disabled:opacity-50"
                        >
                            {copiedYaml ? <Check size={13} /> : <Copy size={13} />}
                            {copiedYaml ? 'YAML Tersalin!' : 'Copy YAML'}
                        </button>
                        <button
                            type="button"
                            onClick={handleDownloadYaml}
                            disabled={loading || !yaml}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-50"
                        >
                            <Download size={13} /> Download .yml
                        </button>
                    </div>
                </div>

                {/* Perintah Docker Cepat */}
                <div className="px-5 py-3 bg-slate-900/90 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                            Perintah Menjalankan MediaMTX via Docker:
                        </span>
                        <code className="text-[11px] font-mono text-cyan-300 break-all">{DOCKER_COMMAND}</code>
                    </div>
                    <button
                        type="button"
                        onClick={handleCopyDocker}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 shrink-0 self-start sm:self-center"
                    >
                        {copiedDocker ? <Check size={12} /> : <Copy size={12} />}
                        {copiedDocker ? 'Tersalin' : 'Copy Perintah'}
                    </button>
                </div>

                <div className="p-4 overflow-x-auto max-h-[420px]">
                    {loading ? (
                        <div className="py-12 text-center text-xs text-slate-400">Menyusun konfigurasi MediaMTX...</div>
                    ) : (
                        <pre className="text-xs font-mono text-emerald-300 leading-relaxed whitespace-pre">
                            {yaml}
                        </pre>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GatewayConfigTab;
