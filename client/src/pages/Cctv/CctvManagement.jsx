import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
    Cctv, Plus, Search, ShieldCheck, Users, Server, LayoutGrid,
    Edit2, Trash2, Copy, Power, Wifi, HardDrive, RefreshCw, Eye,
    SlidersHorizontal, AlertTriangle, Activity, BookOpen, Layers, Map as MapIcon
} from 'lucide-react';
import api from '../../lib/axios';
import { cn } from '../../lib/utils';
import CctvPlayer from './components/CctvPlayer';
import CameraFormModal from './components/CameraFormModal';
import CameraBatchModal from './components/CameraBatchModal';
import CameraAccessModal from './components/CameraAccessModal';
import AccessControlTab from './components/AccessControlTab';
import GatewayConfigTab from './components/GatewayConfigTab';
import FloorPlanTab from './components/FloorPlanTab';

const GRID_OPTIONS = [
    { key: '1', label: '1x1', cols: 'grid-cols-1 max-w-4xl mx-auto' },
    { key: '2', label: '2x2', cols: 'grid-cols-1 md:grid-cols-2' },
    { key: '3', label: '3x3', cols: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' },
    { key: '4', label: '4x4', cols: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4' }
];

const CctvManagement = () => {
    const navigate = useNavigate();
    const currentUser = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem('user')) || {};
        } catch {
            return {};
        }
    }, []);

    const isManager = useMemo(
        () => (currentUser?.position || '').toLowerCase().includes('kepala bidang sarana'),
        [currentUser?.position]
    );

    const [activeTab, setActiveTab] = useState('live'); // live | floorplan | cameras | access | gateway
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testingCameraId, setTestingCameraId] = useState(null);
    const [gatewayConfigured, setGatewayConfigured] = useState(false);

    const [streams, setStreams] = useState([]);
    const [floorPlans, setFloorPlans] = useState([]);
    const [adminCameras, setAdminCameras] = useState([]);
    const [accessUsers, setAccessUsers] = useState([]);
    const [units, setUnits] = useState([]);

    // Live View Controls
    const [gridMode, setGridMode] = useState('2');
    const [expandedCameraId, setExpandedCameraId] = useState(null);
    const [liveSearch, setLiveSearch] = useState('');
    const [liveUnitFilter, setLiveUnitFilter] = useState('');
    const [liveBrandFilter, setLiveBrandFilter] = useState('ALL');

    // Camera Table Controls
    const [camSearch, setCamSearch] = useState('');
    const [camUnitFilter, setCamUnitFilter] = useState('');

    // Modals
    const [cameraModalOpen, setCameraModalOpen] = useState(false);
    const [batchModalOpen, setBatchModalOpen] = useState(false);
    const [editingCamera, setEditingCamera] = useState(null);
    const [accessModalCamera, setAccessModalCamera] = useState(null);

    const loadAllData = useCallback(async () => {
        try {
            setLoading(true);
            const [streamsRes, unitsRes, floorPlansRes] = await Promise.all([
                api.get('/cctv/streams'),
                api.get('/master/units').catch(() => ({ data: [] })),
                api.get('/cctv/floor-plans').catch(() => ({ data: { floorPlans: [] } }))
            ]);

            setStreams(streamsRes.data?.cameras || []);
            setGatewayConfigured(Boolean(streamsRes.data?.gatewayConfigured));
            setUnits(Array.isArray(unitsRes.data) ? unitsRes.data : []);
            setFloorPlans(Array.isArray(floorPlansRes.data?.floorPlans) ? floorPlansRes.data.floorPlans : []);

            if (streamsRes.data?.isManager && isManager) {
                const [camsRes, usersRes] = await Promise.all([
                    api.get('/cctv/cameras'),
                    api.get('/cctv/access/users')
                ]);
                setAdminCameras(Array.isArray(camsRes.data) ? camsRes.data : []);
                setAccessUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
            }
        } catch (err) {
            if (err.response?.status === 403) {
                window.dispatchEvent(new Event('cctvAccessChanged'));
                await Swal.fire({
                    icon: 'warning',
                    title: 'Akses Belum Diberikan',
                    text: err.response?.data?.error || 'Menu Management CCTV hanya dapat diakses oleh Kepala Bidang Sarana atau pengguna yang telah diberi akses.',
                    confirmButtonColor: '#2563eb'
                });
                navigate('/dashboard', { replace: true });
                return;
            }
            console.error('Failed to load CCTV data:', err);
        } finally {
            setLoading(false);
        }
    }, [isManager, navigate]);

    useEffect(() => {
        loadAllData();
    }, [loadAllData]);

    const filteredStreams = useMemo(() => {
        const q = liveSearch.trim().toLowerCase();
        return streams.filter((cam) => {
            if (liveUnitFilter && String(cam.unitId || '') !== liveUnitFilter) return false;
            if (liveBrandFilter !== 'ALL' && cam.brand !== liveBrandFilter) return false;
            if (!q) return true;
            return (
                (cam.name || '').toLowerCase().includes(q) ||
                (cam.location || '').toLowerCase().includes(q) ||
                (cam.unit?.name || '').toLowerCase().includes(q)
            );
        });
    }, [streams, liveSearch, liveUnitFilter, liveBrandFilter]);

    const filteredAdminCameras = useMemo(() => {
        const q = camSearch.trim().toLowerCase();
        return adminCameras.filter((cam) => {
            if (camUnitFilter && String(cam.unitId || '') !== camUnitFilter) return false;
            if (!q) return true;
            return (
                (cam.name || '').toLowerCase().includes(q) ||
                (cam.location || '').toLowerCase().includes(q) ||
                (cam.brand || '').toLowerCase().includes(q) ||
                (cam.unit?.name || '').toLowerCase().includes(q) ||
                (cam.ipAddress || '').toLowerCase().includes(q)
            );
        });
    }, [adminCameras, camSearch, camUnitFilter]);

    const handleOpenCreateCamera = () => {
        setEditingCamera(null);
        setCameraModalOpen(true);
    };

    const handleOpenEditCamera = (camera) => {
        // Ambil versi lengkap dari adminCameras jika dipanggil dari Live View
        const fullCam = adminCameras.find((c) => c.id === camera.id) || camera;
        setEditingCamera(fullCam);
        setCameraModalOpen(true);
    };

    const handleDuplicateCamera = (camera) => {
        const nextChannel = camera.deviceType === 'DVR_NVR' ? (Number(camera.channelNo) || 1) + 1 : 1;
        setEditingCamera({
            ...camera,
            id: undefined,
            name: `${camera.name} (Ch.${nextChannel})`,
            channelNo: nextChannel,
            rtspCustomUrl: '',
            streamPath: '',
            streamUrl: ''
        });
        setCameraModalOpen(true);
    };

    const handleSaveCamera = async (payload) => {
        try {
            setSaving(true);
            if (editingCamera?.id) {
                await api.put(`/cctv/cameras/${editingCamera.id}`, payload);
            } else {
                await api.post('/cctv/cameras', payload);
            }
            setCameraModalOpen(false);
            setEditingCamera(null);
            await loadAllData();
            Swal.fire({
                icon: 'success',
                title: editingCamera?.id ? 'Kamera Diperbarui' : 'Kamera Ditambahkan',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Menyimpan Kamera',
                text: err.response?.data?.error || err.message
            });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveBatchCameras = async (payload) => {
        try {
            setSaving(true);
            const res = await api.post('/cctv/cameras/batch', payload);
            const data = res.data || {};
            setBatchModalOpen(false);
            await loadAllData();
            const skippedText = data.skippedChannels?.length
                ? `<br/><span style="color:#64748b">Dilewati (sudah terdaftar): Ch.${data.skippedChannels.join(', Ch.')}</span>`
                : '';
            Swal.fire({
                icon: data.createdCount > 0 ? 'success' : 'info',
                title: data.createdCount > 0
                    ? `${data.createdCount} Channel Berhasil Ditambahkan!`
                    : 'Tidak Ada Channel Baru Ditambahkan',
                html: `<div style="font-size:13px">Tersinkron ke MediaMTX: <b>${data.syncedCount || 0}</b>${skippedText}</div>`
            });
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Menambah Batch Channel',
                text: err.response?.data?.error || err.message
            });
        } finally {
            setSaving(false);
        }
    };

    const handleToggleCamera = async (camera) => {
        try {
            await api.patch(`/cctv/cameras/${camera.id}/toggle`);
            await loadAllData();
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Mengubah Status',
                text: err.response?.data?.error || err.message
            });
        }
    };

    const handleTestCamera = async (camera) => {
        try {
            setTestingCameraId(camera.id);
            const res = await api.post(`/cctv/cameras/${camera.id}/test`);
            const data = res.data || {};
            if (data.ok) {
                const codecText = data.codecs?.length ? data.codecs.join(', ') : 'Terdeteksi aktif';
                const warningsHtml = (data.warnings || []).length > 0
                    ? `<div style="margin-top:10px;padding:10px;border-radius:8px;background:#fef3c7;color:#92400e;font-size:12px;text-align:left;"><b>Peringatan:</b> ${data.warnings.join('<br/>')}</div>`
                    : '';
                await Swal.fire({
                    icon: data.warnings?.length ? 'warning' : 'success',
                    title: 'Stream Kamera Terhubung!',
                    html: `<p style="font-size:13px;">Kamera <b>${camera.name}</b> siap ditayangkan.</p><p style="font-size:12px;color:#475569;margin-top:4px;">Codec Track: <code>${codecText}</code></p>${warningsHtml}`
                });
            } else {
                await Swal.fire({
                    icon: 'error',
                    title: 'Kamera Belum Merespons',
                    text: data.error || 'Tidak dapat menarik stream RTSP kamera lewat MediaMTX.'
                });
            }
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Mengetes Kamera',
                text: err.response?.data?.error || err.message
            });
        } finally {
            setTestingCameraId(null);
        }
    };

    const handleDeleteCamera = async (camera) => {
        const result = await Swal.fire({
            icon: 'warning',
            title: 'Hapus Kamera CCTV?',
            text: `Kamera "${camera.name}" beserta seluruh data hak akses terkait akan dihapus permanen.`,
            showCancelButton: true,
            confirmButtonText: 'Ya, Hapus',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#e11d48'
        });

        if (!result.isConfirmed) return;

        try {
            await api.delete(`/cctv/cameras/${camera.id}`);
            await loadAllData();
            window.dispatchEvent(new Event('cctvAccessChanged'));
            Swal.fire({
                icon: 'success',
                title: 'Kamera Dihapus',
                timer: 1400,
                showConfirmButton: false
            });
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Menghapus',
                text: err.response?.data?.error || err.message
            });
        }
    };

    const handleSaveUserAccess = async (userId, cameraIds) => {
        try {
            setSaving(true);
            const res = await api.put(`/cctv/access/user/${userId}`, { cameraIds });
            await loadAllData();
            window.dispatchEvent(new Event('cctvAccessChanged'));
            Swal.fire({
                icon: 'success',
                title: 'Hak Akses Diperbarui',
                text: res.data?.message,
                timer: 2000,
                showConfirmButton: false
            });
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Menyimpan Akses',
                text: err.response?.data?.error || err.message
            });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveCameraAccess = async (cameraId, userIds) => {
        try {
            setSaving(true);
            const res = await api.put(`/cctv/access/camera/${cameraId}`, { userIds });
            setAccessModalCamera(null);
            await loadAllData();
            window.dispatchEvent(new Event('cctvAccessChanged'));
            Swal.fire({
                icon: 'success',
                title: 'Akses Kamera Diperbarui',
                text: res.data?.message,
                timer: 1800,
                showConfirmButton: false
            });
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Menyimpan Akses',
                text: err.response?.data?.error || err.message
            });
        } finally {
            setSaving(false);
        }
    };

    const activeGridCols = (GRID_OPTIONS.find((g) => g.key === gridMode) || GRID_OPTIONS[1]).cols;
    const expandedCamera = useMemo(
        () => filteredStreams.find((c) => c.id === expandedCameraId) || null,
        [filteredStreams, expandedCameraId]
    );

    const grantedUsersTotal = useMemo(
        () => accessUsers.filter((u) => !u.isCctvManager && u.grantedCount > 0).length,
        [accessUsers]
    );

    // Ambil unit unik yang ada di streams viewer agar filter unit di Live Monitoring rapi
    const availableLiveUnits = useMemo(() => {
        if (isManager) return units;
        const unitMap = new Map();
        streams.forEach((s) => {
            if (s.unit?.id) unitMap.set(s.unit.id, s.unit);
        });
        return Array.from(unitMap.values());
    }, [isManager, units, streams]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
                <Cctv size={38} className="animate-pulse text-blue-600" />
                <p className="text-sm font-semibold">Memuat Management CCTV...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header & Role Banner */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                    <div className="p-3.5 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-200 shrink-0">
                        <Cctv size={26} />
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
                                Management <span className="text-blue-600">CCTV</span>
                            </h1>
                            {isManager ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-violet-100 text-violet-800 border border-violet-200">
                                    <ShieldCheck size={12} /> Kontrol Penuh Kepala Bidang Sarana
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <Eye size={12} /> Akses Terbatas ({streams.length} Kamera Diizinkan)
                                </span>
                            )}
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 mt-1">
                            Pemantauan terpusat kamera Hikvision (DVR/NVR) &amp; EZVIZ (WiFi) lintas unit dan jaringan.
                        </p>
                    </div>
                </div>

                {/* Quick Metrics / Actions */}
                <div className="flex flex-wrap items-center gap-2.5">
                    {isManager && (
                        <>
                            <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                                <span className="text-slate-500 block text-[10px] font-bold uppercase">Total Kamera</span>
                                <span className="font-black text-slate-800 text-sm">{adminCameras.length}</span>
                            </div>
                            <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                                <span className="text-slate-500 block text-[10px] font-bold uppercase">User Diberi Akses</span>
                                <span className="font-black text-indigo-600 text-sm">{grantedUsersTotal}</span>
                            </div>
                            <button
                                type="button"
                                onClick={handleOpenCreateCamera}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-200 transition-all"
                            >
                                <Plus size={16} /> Tambah Kamera
                            </button>
                            <button
                                type="button"
                                onClick={() => setBatchModalOpen(true)}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-200 transition-all"
                            >
                                <Layers size={16} /> Banyak Channel (1 Klik)
                            </button>
                        </>
                    )}
                    <button
                        type="button"
                        onClick={loadAllData}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs sm:text-sm font-semibold transition-colors"
                        title="Muat Ulang Data"
                    >
                        <RefreshCw size={15} /> Refresh
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs w-fit">
                <button
                    type="button"
                    onClick={() => setActiveTab('live')}
                    className={cn(
                        'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all',
                        activeTab === 'live'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                    )}
                >
                    <LayoutGrid size={15} /> Live Monitoring ({streams.length})
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('floorplan')}
                    className={cn(
                        'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all',
                        activeTab === 'floorplan'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                    )}
                >
                    <MapIcon size={15} /> Denah Lokasi ({floorPlans.length})
                </button>

                {isManager && (
                    <>
                        <button
                            type="button"
                            onClick={() => setActiveTab('cameras')}
                            className={cn(
                                'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all',
                                activeTab === 'cameras'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-slate-600 hover:bg-slate-100'
                            )}
                        >
                            <SlidersHorizontal size={15} /> Kelola Kamera ({adminCameras.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('access')}
                            className={cn(
                                'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all',
                                activeTab === 'access'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-slate-600 hover:bg-slate-100'
                            )}
                        >
                            <Users size={15} /> Hak Akses Pengguna
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('gateway')}
                            className={cn(
                                'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all',
                                activeTab === 'gateway'
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'text-slate-600 hover:bg-slate-100'
                            )}
                        >
                            <BookOpen size={15} /> Pengaturan &amp; Langkah Setting
                        </button>
                    </>
                )}
            </div>

            {isManager && !gatewayConfigured && activeTab !== 'gateway' && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <Server size={20} className="text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs sm:text-sm font-bold text-amber-900">
                                Gateway MediaMTX Belum Dikonfigurasi
                            </p>
                            <p className="text-xs text-amber-800 mt-0.5">
                                Agar CCTV Hikvision DVR/NVR dan EZVIZ WiFi bisa tampil langsung di website, ikuti langkah setting dan simpan koneksi MediaMTX di tab <strong>Pengaturan &amp; Langkah Setting</strong>.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setActiveTab('gateway')}
                        className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs shrink-0 self-start sm:self-center"
                    >
                        Buka Pengaturan &amp; Panduan
                    </button>
                </div>
            )}

            {/* TAB 1: LIVE MONITORING */}
            {activeTab === 'live' && (
                <div className="space-y-4">
                    {/* Toolbar Filter + Grid */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2.5 flex-1">
                            <div className="relative flex-1 min-w-[200px] max-w-xs">
                                <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                                <input
                                    type="text"
                                    value={liveSearch}
                                    onChange={(e) => setLiveSearch(e.target.value)}
                                    placeholder="Cari kamera / lokasi..."
                                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <select
                                value={liveUnitFilter}
                                onChange={(e) => setLiveUnitFilter(e.target.value)}
                                className="px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Semua Unit Pendidikan</option>
                                {availableLiveUnits.map((u) => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>

                            <select
                                value={liveBrandFilter}
                                onChange={(e) => setLiveBrandFilter(e.target.value)}
                                className="px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="ALL">Semua Merek</option>
                                <option value="HIKVISION">Hikvision</option>
                                <option value="G-LENZ">G-LENZ</option>
                                <option value="EZVIZ">EZVIZ</option>
                                <option value="DAHUA">Dahua</option>
                                <option value="LAINNYA">Lainnya</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0 self-start md:self-auto">
                            <span className="text-[11px] font-bold text-slate-500 px-2">Tampilan:</span>
                            {GRID_OPTIONS.map((opt) => (
                                <button
                                    key={opt.key}
                                    type="button"
                                    onClick={() => {
                                        setExpandedCameraId(null);
                                        setGridMode(opt.key);
                                    }}
                                    className={cn(
                                        'px-2.5 py-1 rounded-lg text-xs font-bold transition-all',
                                        gridMode === opt.key && !expandedCameraId
                                            ? 'bg-white text-blue-600 shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Grid Kamera */}
                    {filteredStreams.length === 0 ? (
                        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center space-y-3">
                            <Cctv size={44} className="mx-auto text-slate-300" />
                            <div>
                                <h3 className="text-base font-bold text-slate-700">
                                    {streams.length === 0
                                        ? 'Belum Ada Kamera CCTV Terdaftar'
                                        : 'Tidak Ada Kamera yang Cocok dengan Filter'}
                                </h3>
                                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                                    {isManager && streams.length === 0
                                        ? 'Mulai dengan menambahkan kamera CCTV unit pendidikan (Hikvision DVR/NVR atau WiFi EZVIZ), lalu tentukan pengguna yang berhak memantaunya.'
                                        : 'Coba ubah filter unit, merek, atau kata kunci pencarian.'}
                                </p>
                            </div>
                            {isManager && streams.length === 0 && (
                                <button
                                    type="button"
                                    onClick={handleOpenCreateCamera}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
                                >
                                    <Plus size={15} /> Tambah Kamera Pertama
                                </button>
                            )}
                        </div>
                    ) : expandedCamera ? (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between bg-slate-900 text-white px-4 py-2.5 rounded-xl">
                                <span className="text-xs font-semibold">
                                    Mode Fokus Tunggal: <strong>{expandedCamera.name}</strong>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setExpandedCameraId(null)}
                                    className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold"
                                >
                                    Kembali ke Grid Semua Kamera
                                </button>
                            </div>
                            <div className="max-w-5xl mx-auto">
                                <CctvPlayer
                                    camera={expandedCamera}
                                    isExpanded
                                    onToggleExpand={() => setExpandedCameraId(null)}
                                    canManage={isManager}
                                    onEditCamera={handleOpenEditCamera}
                                    onOpenGateway={() => setActiveTab('gateway')}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className={cn('grid gap-4', activeGridCols)}>
                            {filteredStreams.map((cam, idx) => (
                                <CctvPlayer
                                    key={cam.id}
                                    camera={cam}
                                    isExpanded={false}
                                    startDelayMs={Math.min(idx * 250, 2800)}
                                    onToggleExpand={(id) => setExpandedCameraId(id)}
                                    canManage={isManager}
                                    onEditCamera={handleOpenEditCamera}
                                    onOpenGateway={() => setActiveTab('gateway')}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 1B: DENAH LOKASI & TITIK KAMERA */}
            {activeTab === 'floorplan' && (
                <FloorPlanTab
                    floorPlans={floorPlans}
                    allCameras={isManager ? adminCameras : streams}
                    units={units}
                    isManager={isManager}
                    onRefresh={loadAllData}
                    onOpenEditCamera={handleOpenEditCamera}
                />
            )}

            {/* TAB 2: KELOLA KAMERA (Hanya Kepala Bidang Sarana) */}
            {isManager && activeTab === 'cameras' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2.5 flex-1">
                            <div className="relative flex-1 min-w-[200px] max-w-xs">
                                <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                                <input
                                    type="text"
                                    value={camSearch}
                                    onChange={(e) => setCamSearch(e.target.value)}
                                    placeholder="Cari kamera, IP, lokasi..."
                                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <select
                                value={camUnitFilter}
                                onChange={(e) => setCamUnitFilter(e.target.value)}
                                className="px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white outline-none"
                            >
                                <option value="">Semua Unit</option>
                                {units.map((u) => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => setBatchModalOpen(true)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs"
                            >
                                <Layers size={15} /> Banyak Channel (1 Klik)
                            </button>
                            <button
                                type="button"
                                onClick={handleOpenCreateCamera}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-xs"
                            >
                                <Plus size={15} /> Tambah Kamera Baru
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    <th className="px-4 py-3">Kamera &amp; Lokasi</th>
                                    <th className="px-4 py-3">Unit Pendidikan</th>
                                    <th className="px-4 py-3">Merek &amp; Perangkat</th>
                                    <th className="px-4 py-3">Stream Web</th>
                                    <th className="px-4 py-3">Akses Pengguna</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                                {filteredAdminCameras.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-xs">
                                            Belum ada data kamera yang sesuai.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredAdminCameras.map((cam) => (
                                        <tr key={cam.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-slate-800">{cam.name}</div>
                                                <div className="text-[11px] text-slate-500">
                                                    {cam.location || 'Area belum diisi'}
                                                    {cam.ipAddress ? ` • IP: ${cam.ipAddress}` : ''}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-700 font-medium">
                                                {cam.unit?.name || <span className="text-slate-400">Umum</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold text-[10px]">
                                                        {cam.brand}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                                                        {cam.deviceType === 'WIFI_CAMERA' ? (
                                                            <><Wifi size={12} className="text-cyan-600" /> WiFi</>
                                                        ) : (
                                                            <><HardDrive size={12} className="text-blue-600" /> DVR Ch.{cam.channelNo}</>
                                                        )}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-0.5">
                                                    {cam.usesGateway ? (
                                                        <>
                                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                                                                <Server size={11} /> Gateway Sarpras
                                                            </span>
                                                            {cam.ipAddress || cam.rtspCustomUrl ? (
                                                                <span className="text-[10px] font-mono text-slate-500 max-w-[180px] truncate" title={cam.rtspPreviewUrl || cam.streamPath}>
                                                                    /{cam.streamPath}
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-semibold">
                                                                    <AlertTriangle size={11} /> IP/RTSP belum diisi
                                                                </span>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="text-[11px] font-bold text-blue-700">
                                                                {cam.streamMode}
                                                            </span>
                                                            {cam.streamUrl ? (
                                                                <span className="text-[10px] font-mono text-slate-500 max-w-[180px] truncate" title={cam.streamUrl}>
                                                                    {cam.streamUrl}
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-semibold">
                                                                    <AlertTriangle size={11} /> URL belum diisi
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setAccessModalCamera(cam)}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-colors"
                                                >
                                                    <Users size={13} />
                                                    {cam.accessCount > 0 ? `${cam.accessCount} User` : 'Belum Dibagikan'}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3">
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleCamera(cam)}
                                                    className={cn(
                                                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors',
                                                        cam.isActive
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                                            : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                                    )}
                                                    title="Klik untuk aktif/nonaktifkan kamera"
                                                >
                                                    <Power size={11} />
                                                    {cam.isActive ? 'Aktif' : 'Nonaktif'}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleTestCamera(cam)}
                                                        disabled={testingCameraId === cam.id}
                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50"
                                                        title="Tes Tarikan Stream RTSP Kamera"
                                                    >
                                                        <Activity size={13} className={testingCameraId === cam.id ? 'animate-spin' : ''} />
                                                        {testingCameraId === cam.id ? 'Tes...' : 'Tes'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEditCamera(cam)}
                                                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                        title="Edit Kamera"
                                                    >
                                                        <Edit2 size={15} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDuplicateCamera(cam)}
                                                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                                        title="Duplikat (Tambah Channel Berikutnya)"
                                                    >
                                                        <Copy size={15} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteCamera(cam)}
                                                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                        title="Hapus Kamera"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 3: HAK AKSES PENGGUNA (Hanya Kepala Bidang Sarana) */}
            {isManager && activeTab === 'access' && (
                <AccessControlTab
                    users={accessUsers}
                    cameras={adminCameras}
                    units={units}
                    onSaveUserAccess={handleSaveUserAccess}
                    saving={saving}
                    onGoToCameras={() => {
                        setActiveTab('cameras');
                        handleOpenCreateCamera();
                    }}
                />
            )}

            {/* TAB 4: PENGATURAN & LANGKAH SETTING (Hanya Kepala Bidang Sarana) */}
            {isManager && activeTab === 'gateway' && (
                <GatewayConfigTab
                    onGatewayUpdated={loadAllData}
                    onGoToTab={setActiveTab}
                />
            )}

            {/* Modals (Khusus Kepala Bidang Sarana) */}
            {isManager && (
                <>
                    <CameraFormModal
                        isOpen={cameraModalOpen}
                        onClose={() => {
                            setCameraModalOpen(false);
                            setEditingCamera(null);
                        }}
                        onSave={handleSaveCamera}
                        initialData={editingCamera}
                        units={units}
                        gatewayConfigured={gatewayConfigured}
                        saving={saving}
                    />

                    <CameraBatchModal
                        isOpen={batchModalOpen}
                        onClose={() => setBatchModalOpen(false)}
                        onSaveBatch={handleSaveBatchCameras}
                        units={units}
                        existingCameras={adminCameras}
                        gatewayConfigured={gatewayConfigured}
                        saving={saving}
                    />

                    <CameraAccessModal
                        isOpen={Boolean(accessModalCamera)}
                        onClose={() => setAccessModalCamera(null)}
                        camera={accessModalCamera}
                        users={accessUsers}
                        onSave={handleSaveCameraAccess}
                        saving={saving}
                    />
                </>
            )}
        </div>
    );
};

export default CctvManagement;
