import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Settings, Plus, Search, Calendar, Car, Wrench, Trash2, Pencil, Eye, 
    Download, AlertTriangle, Image, X, ExternalLink, CheckCircle, CheckCircle2, 
    Clock, ShieldCheck, Printer, ArrowRight, AlertCircle, FileText, ChevronRight
} from 'lucide-react';
import api from '../lib/axios';
import * as XLSX from 'xlsx';

// Modal Alur Pemeliharaan Kendaraan
import VehicleMaintenanceRequestModal from '../components/vehicle/VehicleMaintenanceRequestModal';
import VehicleMaintenanceReviewModal from '../components/vehicle/VehicleMaintenanceReviewModal';
import VehicleMaintenanceCompleteModal from '../components/vehicle/VehicleMaintenanceCompleteModal';
import VehicleServiceSPKModal from '../components/vehicle/VehicleServiceSPKModal';

const VehicleMaintenanceList = () => {
    const navigate = useNavigate();
    const [logs, setLogs] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedVehicleId, setSelectedVehicleId] = useState('');
    const [activeTab, setActiveTab] = useState('requests'); // 'requests' | 'maintenance' | 'incidents'
    const [requestStatusFilter, setRequestStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'APPROVED' | 'IN_PROGRESS' | 'REJECTED'
    const [previewPhoto, setPreviewPhoto] = useState(null); // photo lightbox modal

    // Modal state
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [reviewModalRequest, setReviewModalRequest] = useState(null);
    const [completeModalRequest, setCompleteModalRequest] = useState(null);
    const [spkModalService, setSpkModalService] = useState(null);

    // Current user context
    const currentUser = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
    const userPosition = (currentUser?.position || '').toLowerCase();
    const userRole = currentUser?.role || '';
    const isKabidSarana = userRole === 'SUPER_ADMIN' || userRole === 'KABID_SARPRAS' || userPosition.includes('kepala bidang sarana');

    useEffect(() => {
        fetchLogs();
        fetchVehicles();
    }, []);

    const fetchLogs = async () => {
        try {
            const res = await api.get('/vehicles/maintenance/all');
            setLogs(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error('Failed to fetch maintenance logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchVehicles = async () => {
        try {
            const res = await api.get('/vehicles');
            setVehicles(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error('Failed to fetch vehicles:', error);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Hapus log pemeliharaan / pengajuan ini?')) return;
        try {
            await api.delete(`/vehicles/maintenance/${id}`);
            fetchLogs();
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal menghapus log');
        }
    };

    // Tandai kendaraan masuk bengkel (IN_PROGRESS)
    const handleStartProgress = async (log) => {
        if (!confirm(`Tandai kendaraan ${log.vehicle?.name || ''} (${log.vehicle?.plateNumber || ''}) sudah masuk bengkel dan dalam pengerjaan?`)) return;
        try {
            await api.put(`/vehicles/maintenance/${log.id}/start-progress`, { workshop: log.workshop });
            fetchLogs();
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal mengubah status pengerjaan');
        }
    };

    // Helper identifikasi apakah log merupakan Laporan Kerusakan / Insiden Peminjaman
    const isIncidentLog = (log) => {
        if (!log) return false;
        const type = (log.type || '').toUpperCase();
        const category = (log.category || '').toUpperCase();
        const desc = (log.description || '');
        return type === 'PERBAIKAN_KERUSAKAN' || 
               category === 'INSIDENTAL' || 
               desc.includes('[LAPORAN INSIDEN JALAN') ||
               desc.toLowerCase().includes('insiden');
    };

    // Helper ekstrak info pelapor dari deskripsi insiden
    const parseIncidentInfo = (desc = '') => {
        const match = desc.match(/\[LAPORAN INSIDEN JALAN oleh (.*?)\]:\s*(.*)/i);
        if (match) {
            return {
                reporter: match[1],
                notes: match[2] || 'Tidak ada catatan tambahan'
            };
        }
        return {
            reporter: null,
            notes: desc || 'Tidak ada deskripsi'
        };
    };

    // Pemisahan Log Berdasarkan Kategori & Status
    const incidentLogs = logs.filter(l => isIncidentLog(l));
    const nonIncidentLogs = logs.filter(l => !isIncidentLog(l));

    // Pengajuan Pemeliharaan (Alur Servis: PENDING, APPROVED, IN_PROGRESS, REJECTED, atau yang memiliki nomor SPK/kode PK)
    const requestLogs = nonIncidentLogs.filter(l => 
        l.status === 'PENDING' || 
        l.status === 'APPROVED' || 
        l.status === 'IN_PROGRESS' || 
        l.status === 'REJECTED' ||
        (l.code && l.code.startsWith('PK/')) ||
        l.requesterId
    );

    // Riwayat Servis Selesai (COMPLETED)
    const maintenanceLogs = nonIncidentLogs.filter(l => 
        !l.status || l.status === 'COMPLETED'
    );

    // Badge Counters
    const pendingRequestsCount = requestLogs.filter(l => l.status === 'PENDING').length;
    const approvedRequestsCount = requestLogs.filter(l => l.status === 'APPROVED').length;
    const inProgressRequestsCount = requestLogs.filter(l => l.status === 'IN_PROGRESS').length;

    // Filter per tab yang sedang aktif
    let currentTabLogs = [];
    if (activeTab === 'requests') {
        currentTabLogs = requestLogs.filter(l => {
            if (requestStatusFilter === 'ALL') return true;
            return l.status === requestStatusFilter;
        });
    } else if (activeTab === 'maintenance') {
        currentTabLogs = maintenanceLogs;
    } else {
        currentTabLogs = incidentLogs;
    }

    const uniqueVehicles = vehicles.length > 0 
        ? vehicles 
        : [...new Map(logs.map(log => [log.vehicle?.id, log.vehicle])).values()].filter(Boolean);

    const filteredLogs = currentTabLogs.filter(log =>
        (selectedVehicleId ? log.vehicle?.id === parseInt(selectedVehicleId) : true) &&
        (log.vehicle?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.vehicle?.plateNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.spkNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.requester?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.description && log.description.toLowerCase().includes(searchTerm.toLowerCase())))
    );

    const handleExport = () => {
        let exportData = [];
        let sheetTitle = 'Pemeliharaan_Kendaraan';

        if (activeTab === 'requests') {
            sheetTitle = 'Pengajuan_Servis_Kendaraan';
            exportData = filteredLogs.map((log, index) => ({
                'No': index + 1,
                'Kode Pengajuan': log.code || '-',
                'Tanggal': new Date(log.date).toLocaleDateString('id-ID'),
                'Kendaraan': log.vehicle?.name || 'Tanpa Nama',
                'Plat Nomor': log.vehicle?.plateNumber || '-',
                'Pemohon': log.requester?.name || '-',
                'Urgensi': log.urgency || 'NORMAL',
                'Kategori': log.category === 'ROUTINE' ? 'Rutin' : 'Non-Rutin',
                'Tipe': log.type || '-',
                'Status': log.status || 'PENDING',
                'No. SPK': log.spkNumber || '-',
                'Estimasi Biaya (Rp)': log.estimatedCost || 0,
                'Biaya Aktual (Rp)': log.cost || 0,
                'Bengkel': log.workshop || '-',
                'Kebutuhan / Keluhan': log.description || '-'
            }));
        } else if (activeTab === 'maintenance') {
            sheetTitle = 'Riwayat_Servis_Selesai';
            exportData = filteredLogs.map((log, index) => ({
                'No': index + 1,
                'Tanggal': new Date(log.date).toLocaleDateString('id-ID'),
                'Kendaraan': log.vehicle?.name || 'Tanpa Nama',
                'Plat Nomor': log.vehicle?.plateNumber || '-',
                'Kategori': log.category === 'ROUTINE' ? 'Rutin' : 'Non-Rutin',
                'Tipe': log.type,
                'Deskripsi': log.description || '-',
                'Odometer (km)': log.odometer || 0,
                'Bengkel': log.workshop || '-',
                'Biaya (Rp)': log.cost || 0,
                'No. SPK': log.spkNumber || '-'
            }));
        } else {
            sheetTitle = 'Laporan_Kerusakan_Insiden';
            exportData = filteredLogs.map((log, index) => {
                const incInfo = parseIncidentInfo(log.description);
                return {
                    'No': index + 1,
                    'Tanggal': new Date(log.date).toLocaleDateString('id-ID'),
                    'Kendaraan': log.vehicle?.name || 'Tanpa Nama',
                    'Plat Nomor': log.vehicle?.plateNumber || '-',
                    'Pelapor': incInfo.reporter || '-',
                    'Deskripsi Kerusakan': incInfo.notes || '-',
                    'Odometer (km)': log.odometer || 0,
                    'Bengkel': log.workshop || '-',
                    'Biaya (Rp)': log.cost || 0
                };
            });
        }

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetTitle);
        XLSX.writeFile(wb, `${sheetTitle}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // Helper Status Badge
    const renderStatusBadge = (status) => {
        switch (status) {
            case 'PENDING':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock size={12} className="animate-spin text-amber-500" style={{ animationDuration: '4s' }} />
                        Menunggu Persetujuan
                    </span>
                );
            case 'APPROVED':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                        <ShieldCheck size={13} className="text-blue-600" />
                        Disetujui (SPK Terbit)
                    </span>
                );
            case 'IN_PROGRESS':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
                        <Wrench size={12} className="text-purple-600 animate-pulse" />
                        Sedang di Bengkel
                    </span>
                );
            case 'COMPLETED':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 size={13} className="text-emerald-600" />
                        Servis Selesai
                    </span>
                );
            case 'REJECTED':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                        <AlertCircle size={12} className="text-rose-600" />
                        Ditolak
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-slate-100 text-slate-700">
                        {status || 'COMPLETED'}
                    </span>
                );
        }
    };

    // Helper Urgensi Badge
    const renderUrgencyBadge = (urgency) => {
        switch (urgency) {
            case 'EMERGENCY':
                return <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-rose-600 text-white animate-pulse">DARURAT</span>;
            case 'HIGH':
                return <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-500 text-white">TINGGI</span>;
            case 'LOW':
                return <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">RENDAH</span>;
            case 'NORMAL':
            default:
                return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">NORMAL</span>;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300 pb-16">
            {/* Header Utama */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2.5">
                        <span className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 inline-flex">
                            <Car size={24} />
                        </span>
                        <span>Pemeliharaan & Servis Kendaraan</span>
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Alur pengajuan servis berkala armada, penerbitan SPK Bengkel resmi, dan kontrol riwayat perawatan.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                    {/* Tombol Ajukan Servis - Alur Baru */}
                    <button
                        onClick={() => setShowRequestModal(true)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/25 transition-all text-xs sm:text-sm cursor-pointer"
                    >
                        <Plus size={18} /> <span>+ Ajukan Pemeliharaan</span>
                    </button>

                    {/* Tombol Health Monitor */}
                    <button
                        onClick={() => navigate('/kendaraan/pemeliharaan/reminder')}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2.5 rounded-xl font-bold hover:bg-emerald-100 transition-all text-xs sm:text-sm cursor-pointer"
                        title="Monitoring kesehatan komponen rutin dan jadwal servis berkala"
                    >
                        <span>🩺 Health Monitor</span>
                    </button>

                    {/* Tombol Ekspor */}
                    <button
                        onClick={handleExport}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold transition-all text-xs sm:text-sm cursor-pointer"
                        title="Ekspor daftar ke file Microsoft Excel"
                    >
                        <Download size={16} /> <span>Excel</span>
                    </button>

                    {/* Tombol Catat Log Langsung (Bypass Alur) */}
                    <button
                        onClick={() => navigate('/kendaraan/pemeliharaan/new')}
                        className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 px-3 py-2.5 rounded-xl border border-slate-200 font-medium transition cursor-pointer"
                        title="Catat riwayat servis masa lalu secara langsung tanpa alur approval"
                    >
                        <span>+ Catat Langsung</span>
                    </button>
                </div>
            </div>

            {/* TAB NAVIGATION: 3 Tab (Pengajuan, Riwayat Servis, Laporan Kerusakan) */}
            <div className="bg-white rounded-2xl border border-slate-100 p-1.5 shadow-sm flex flex-wrap gap-2">
                {/* TAB 1: PENGAJUAN PEMELIHARAAN (ALUR KERJA) */}
                <button
                    onClick={() => setActiveTab('requests')}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                        activeTab === 'requests'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                >
                    <FileText size={16} />
                    <span>Alur Pengajuan Servis</span>
                    {pendingRequestsCount > 0 && (
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold animate-pulse ${
                            activeTab === 'requests' ? 'bg-amber-400 text-slate-900' : 'bg-amber-500 text-white'
                        }`} title={`${pendingRequestsCount} pengajuan menunggu persetujuan Kabid`}>
                            {pendingRequestsCount} Perlu Review
                        </span>
                    )}
                    {pendingRequestsCount === 0 && (
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                            activeTab === 'requests' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                            {requestLogs.length}
                        </span>
                    )}
                </button>

                {/* TAB 2: RIWAYAT SERVIS SELESAI */}
                <button
                    onClick={() => setActiveTab('maintenance')}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                        activeTab === 'maintenance'
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                >
                    <CheckCircle2 size={16} />
                    <span>Riwayat Servis Selesai</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                        activeTab === 'maintenance' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                        {maintenanceLogs.length}
                    </span>
                </button>

                {/* TAB 3: LAPORAN KERUSAKAN & INSIDEN */}
                <button
                    onClick={() => setActiveTab('incidents')}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                        activeTab === 'incidents'
                            ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                >
                    <AlertTriangle size={16} className={incidentLogs.length > 0 ? 'text-rose-500 animate-pulse' : ''} />
                    <span>Laporan Kerusakan & Insiden</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                        activeTab === 'incidents' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'
                    }`}>
                        {incidentLogs.length}
                    </span>
                </button>
            </div>

            {/* Filter Status Khusus Tab Pengajuan */}
            {activeTab === 'requests' && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-xs font-bold text-slate-500 mr-1">Status Pengajuan:</span>
                    {[
                        { key: 'ALL', label: 'Semua Status' },
                        { key: 'PENDING', label: 'Menunggu Review', count: pendingRequestsCount, dot: 'bg-amber-500' },
                        { key: 'APPROVED', label: 'Disetujui / Siap Servis', count: approvedRequestsCount, dot: 'bg-blue-500' },
                        { key: 'IN_PROGRESS', label: 'Sedang di Bengkel', count: inProgressRequestsCount, dot: 'bg-purple-500' },
                        { key: 'COMPLETED', label: 'Selesai' },
                        { key: 'REJECTED', label: 'Ditolak' }
                    ].map(f => (
                        <button
                            key={f.key}
                            onClick={() => setRequestStatusFilter(f.key)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                                requestStatusFilter === f.key
                                    ? 'bg-slate-800 text-white shadow-sm'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            {f.dot && <span className={`w-2 h-2 rounded-full ${f.dot}`} />}
                            <span>{f.label}</span>
                            {f.count !== undefined && f.count > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                                    requestStatusFilter === f.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                                }`}>
                                    {f.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Filter & Search Bar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder={
                            activeTab === 'requests' 
                                ? 'Cari kode pengajuan, SPK, armada, pemohon, bengkel...' 
                                : activeTab === 'maintenance'
                                    ? 'Cari armada, jenis servis, atau deskripsi...'
                                    : 'Cari laporan kerusakan, pelapor, atau armada...'
                        }
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select
                    className="px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none min-w-[220px] text-sm cursor-pointer"
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                >
                    <option value="">Semua Kendaraan</option>
                    {uniqueVehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.name} ({v.plateNumber})</option>
                    ))}
                </select>
            </div>

            {/* Content Display */}
            {loading ? (
                <div className="flex justify-center py-20 bg-white rounded-2xl border border-slate-100">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                </div>
            ) : filteredLogs.length > 0 ? (
                <div className="space-y-4">
                    {/* ══════════════════════════════════════════════════════
                        TAB 1: DAFTAR ALUR PENGAJUAN PEMELIHARAAN (DESKTOP TABLE)
                       ══════════════════════════════════════════════════════ */}
                    {activeTab === 'requests' && (
                        <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                                        <th className="px-5 py-4">Kode & Tanggal</th>
                                        <th className="px-5 py-4">Armada Kendaraan</th>
                                        <th className="px-5 py-4">Pemohon & Kebutuhan</th>
                                        <th className="px-5 py-4">Bengkel & Estimasi</th>
                                        <th className="px-5 py-4 text-center">Status Alur</th>
                                        <th className="px-5 py-4 text-center">Aksi / Tindak Lanjut</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredLogs.map(log => {
                                        const items = Array.isArray(log.items) ? log.items : [];
                                        const isPending = log.status === 'PENDING';
                                        const isApproved = log.status === 'APPROVED';
                                        const isInProgress = log.status === 'IN_PROGRESS';
                                        const isCompleted = log.status === 'COMPLETED';

                                        return (
                                            <tr key={log.id} className="hover:bg-slate-50/70 transition-colors group text-sm font-medium text-slate-600">
                                                {/* Kode & Tanggal */}
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md w-fit border border-blue-100">
                                                            {log.code || `ID-#${log.id}`}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                            <Calendar size={12} className="text-slate-400" />
                                                            {new Date(log.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </div>
                                                        <div className="mt-0.5">
                                                            {renderUrgencyBadge(log.urgency)}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Armada Kendaraan */}
                                                <td className="px-5 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-900 text-sm">{log.vehicle?.name || 'Armada'}</span>
                                                        <span className="text-[11px] font-mono font-bold text-slate-500 uppercase">{log.vehicle?.plateNumber}</span>
                                                        <span className="text-[11px] text-slate-400 mt-0.5">
                                                            KM Saat Diajukan: <b className="text-slate-700 font-mono">{log.odometer?.toLocaleString() || '-'}</b>
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Pemohon & Kebutuhan */}
                                                <td className="px-5 py-4 max-w-sm">
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center gap-1.5 text-xs">
                                                            <span className="font-bold text-slate-800">👤 {log.requester?.name || 'Staff Kendaraan'}</span>
                                                            {log.requester?.position && (
                                                                <span className="text-[10px] text-slate-400">({log.requester.position})</span>
                                                            )}
                                                        </div>

                                                        <p className="text-xs text-slate-700 font-medium leading-relaxed bg-slate-50 p-2 rounded-xl border border-slate-100">
                                                            {log.description || '-'}
                                                        </p>

                                                        {/* Chip Komponen */}
                                                        {items.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 pt-0.5">
                                                                {items.slice(0, 3).map((it, idx) => (
                                                                    <span key={idx} className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-100">
                                                                        {typeof it === 'string' ? it : it.name}
                                                                    </span>
                                                                ))}
                                                                {items.length > 3 && (
                                                                    <span className="text-[10px] font-bold text-slate-400 px-1.5 py-0.5">
                                                                        +{items.length - 3} lainnya
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Bengkel & Estimasi */}
                                                <td className="px-5 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="text-xs font-bold text-slate-800 flex items-center gap-1">
                                                            <Wrench size={12} className="text-slate-400" />
                                                            <span>{log.workshop || 'Ditentukan Sarpras'}</span>
                                                        </div>

                                                        <div className="text-xs text-slate-500">
                                                            Estimasi: <b className="text-slate-800">Rp {(log.estimatedCost || 0).toLocaleString('id-ID')}</b>
                                                        </div>

                                                        {log.cost > 0 && (
                                                            <div className="text-xs text-emerald-700 font-extrabold">
                                                                Aktual: Rp {log.cost.toLocaleString('id-ID')}
                                                            </div>
                                                        )}

                                                        {/* Foto Keluhan / Foto Nota */}
                                                        <div className="flex gap-2 mt-1">
                                                            {log.complaintPhoto && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPreviewPhoto(log.complaintPhoto)}
                                                                    className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded-md border border-blue-200 cursor-pointer"
                                                                    title="Foto kendala armada yang diajukan staff"
                                                                >
                                                                    <Image size={11} /> Foto Keluhan
                                                                </button>
                                                            )}
                                                            {log.proofFile && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPreviewPhoto(log.proofFile)}
                                                                    className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-800 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 cursor-pointer"
                                                                    title="Foto nota / faktur bengkel resmi"
                                                                >
                                                                    <Image size={11} /> Foto Nota
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Status Alur */}
                                                <td className="px-5 py-4 text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        {renderStatusBadge(log.status)}
                                                        {log.spkNumber && (
                                                            <span className="text-[10px] font-mono text-slate-500 font-semibold">
                                                                {log.spkNumber}
                                                            </span>
                                                        )}
                                                        {log.status === 'REJECTED' && log.rejectionReason && (
                                                            <span className="text-[10px] text-rose-600 max-w-[140px] truncate" title={log.rejectionReason}>
                                                                Alasan: {log.rejectionReason}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Aksi Berdasarkan Status */}
                                                <td className="px-5 py-4 text-center">
                                                    <div className="flex flex-col items-center justify-center gap-1.5">
                                                        {/* Status PENDING: Review & Setujui (Kabid Sarana) */}
                                                        {isPending && (
                                                            <>
                                                                {isKabidSarana ? (
                                                                    <button
                                                                        onClick={() => setReviewModalRequest(log)}
                                                                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-500/20 transition cursor-pointer"
                                                                    >
                                                                        <ShieldCheck size={14} /> Review & TTE
                                                                    </button>
                                                                ) : (
                                                                    <span className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 font-medium">
                                                                        Menunggu Kabid
                                                                    </span>
                                                                )}
                                                                <button
                                                                    onClick={() => handleDelete(log.id)}
                                                                    className="text-xs text-rose-600 hover:text-rose-800 p-1 hover:bg-rose-50 rounded-lg cursor-pointer"
                                                                    title="Batalkan / Hapus Pengajuan"
                                                                >
                                                                    Batalkan
                                                                </button>
                                                            </>
                                                        )}

                                                        {/* Status APPROVED: Cetak SPK & Masuk Bengkel */}
                                                        {isApproved && (
                                                            <>
                                                                <button
                                                                    onClick={() => setSpkModalService(log)}
                                                                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/20 transition cursor-pointer"
                                                                >
                                                                    <Printer size={13} /> Cetak SPK
                                                                </button>
                                                                <button
                                                                    onClick={() => handleStartProgress(log)}
                                                                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition cursor-pointer"
                                                                    title="Tandai armada sudah masuk ke bengkel"
                                                                >
                                                                    <Wrench size={13} /> Masuk Bengkel
                                                                </button>
                                                            </>
                                                        )}

                                                        {/* Status IN_PROGRESS: Cetak SPK & Selesaikan Servis */}
                                                        {isInProgress && (
                                                            <>
                                                                <button
                                                                    onClick={() => setCompleteModalRequest(log)}
                                                                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-500/20 transition cursor-pointer"
                                                                    title="Input biaya nota aktual & selesaikan servis"
                                                                >
                                                                    <CheckCircle2 size={14} /> Selesaikan Servis
                                                                </button>
                                                                <button
                                                                    onClick={() => setSpkModalService(log)}
                                                                    className="w-full flex items-center justify-center gap-1.5 px-2 py-1 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg text-xs font-medium transition cursor-pointer"
                                                                >
                                                                    <Printer size={12} /> SPK
                                                                </button>
                                                            </>
                                                        )}

                                                        {/* Status COMPLETED: Cetak SPK & Lihat Rincian */}
                                                        {isCompleted && (
                                                            <div className="flex items-center gap-1">
                                                                {log.spkNumber && (
                                                                    <button
                                                                        onClick={() => setSpkModalService(log)}
                                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                                                                        title="Cetak SPK Kendaraan"
                                                                    >
                                                                        <Printer size={16} />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => navigate(`/kendaraan/pemeliharaan/view/${log.id}`)}
                                                                    className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                                                                    title="Lihat Rincian Lengkap"
                                                                >
                                                                    <Eye size={16} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════════
                        TAB 2: RIWAYAT SERVIS SELESAI (DESKTOP TABLE)
                       ══════════════════════════════════════════════════════ */}
                    {activeTab === 'maintenance' && (
                        <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        <th className="px-6 py-4">Tanggal</th>
                                        <th className="px-6 py-4">Kendaraan</th>
                                        <th className="px-6 py-4">Kategori / Tipe</th>
                                        <th className="px-6 py-4">Deskripsi</th>
                                        <th className="px-6 py-4">Kilometer</th>
                                        <th className="px-6 py-4 text-right">Biaya (Rp)</th>
                                        <th className="px-6 py-4 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50 transition-colors group text-sm font-medium text-slate-600">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={14} className="text-slate-400" />
                                                    {new Date(log.date).toLocaleDateString('id-ID')}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-800">{log.vehicle?.name || 'Tanpa Nama'}</span>
                                                    <span className="text-[10px] uppercase font-mono text-slate-400">{log.vehicle?.plateNumber}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className={`text-[10px] w-fit px-2 py-0.5 rounded-full font-bold ${log.category === 'ROUTINE' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                        {log.category === 'ROUTINE' ? 'RUTIN' : 'NON-RUTIN'}
                                                    </span>
                                                    <span>{log.type}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 max-w-xs truncate">{log.description || '-'}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span>{log.odometer?.toLocaleString()} km</span>
                                                    {log.nextServiceOdometer && (
                                                        <span className="text-[10px] text-blue-500 italic">Next: {log.nextServiceOdometer.toLocaleString()} km</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-800">
                                                {(log.cost || 0).toLocaleString('id-ID')}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {log.spkNumber && (
                                                        <button 
                                                            onClick={() => setSpkModalService(log)} 
                                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer" 
                                                            title="Cetak SPK Kendaraan"
                                                        >
                                                            <Printer size={16} />
                                                        </button>
                                                    )}
                                                    <button onClick={() => navigate(`/kendaraan/pemeliharaan/view/${log.id}`)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer" title="Lihat Rincian">
                                                        <Eye size={16} />
                                                    </button>
                                                    <button onClick={() => navigate(`/kendaraan/pemeliharaan/edit/${log.id}`)} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg cursor-pointer" title="Edit Data">
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button onClick={() => handleDelete(log.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer" title="Hapus">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════════
                        TAB 3: LAPORAN KERUSAKAN & INSIDEN (DESKTOP TABLE)
                       ══════════════════════════════════════════════════════ */}
                    {activeTab === 'incidents' && (
                        <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-rose-50/50 border-b border-rose-100 text-[10px] font-bold text-rose-800 uppercase tracking-wider">
                                        <th className="px-6 py-4">Tanggal Laporan</th>
                                        <th className="px-6 py-4">Kendaraan</th>
                                        <th className="px-6 py-4">Pelapor & Rincian Kerusakan</th>
                                        <th className="px-6 py-4 text-center">Bukti Foto</th>
                                        <th className="px-6 py-4">Kilometer</th>
                                        <th className="px-6 py-4">Status & Biaya</th>
                                        <th className="px-6 py-4 text-center">Aksi Tindak Lanjut</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredLogs.map(log => {
                                        const incInfo = parseIncidentInfo(log.description);
                                        const isHandled = log.cost > 0 || (log.workshop && log.workshop !== 'Perlu Penanganan Sarpras');

                                        return (
                                            <tr key={log.id} className="hover:bg-rose-50/20 transition-colors group text-sm font-medium text-slate-600">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar size={14} className="text-slate-400" />
                                                        <span>{new Date(log.date).toLocaleDateString('id-ID')}</span>
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-800">{log.vehicle?.name || 'Tanpa Nama'}</span>
                                                        <span className="text-[10px] uppercase font-mono text-slate-400">{log.vehicle?.plateNumber}</span>
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4 max-w-sm">
                                                    <div className="space-y-1">
                                                        {incInfo.reporter && (
                                                            <div className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                                                                👤 Pengemudi: {incInfo.reporter}
                                                            </div>
                                                        )}
                                                        <p className="text-xs text-slate-800 font-semibold leading-relaxed break-words">
                                                            {incInfo.notes}
                                                        </p>
                                                    </div>
                                                </td>

                                                {/* Bukti Foto */}
                                                <td className="px-6 py-4 text-center">
                                                    {log.proofFile ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setPreviewPhoto(log.proofFile)}
                                                            className="relative group/photo inline-block cursor-pointer overflow-hidden rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 transition"
                                                            title="Klik untuk memperbesar foto bukti kerusakan"
                                                        >
                                                            <img 
                                                                src={log.proofFile} 
                                                                alt="Bukti Kerusakan" 
                                                                className="w-14 h-14 object-cover group-hover/photo:scale-110 transition duration-300"
                                                            />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/photo:opacity-100 flex items-center justify-center text-white transition">
                                                                <Eye size={16} />
                                                            </div>
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">Tanpa Foto</span>
                                                    )}
                                                </td>

                                                {/* KM */}
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="font-mono text-slate-700 font-bold">{log.odometer?.toLocaleString()} km</span>
                                                </td>

                                                {/* Status & Biaya */}
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        {isHandled ? (
                                                            <>
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full w-fit">
                                                                    <CheckCircle size={11} /> Sudah Ditangani
                                                                </span>
                                                                <span className="text-xs font-bold text-slate-800">
                                                                    Rp {(log.cost || 0).toLocaleString('id-ID')}
                                                                </span>
                                                                {log.workshop && <span className="text-[10px] text-slate-400 truncate max-w-[140px]">{log.workshop}</span>}
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full w-fit">
                                                                    🔴 Perlu Penanganan
                                                                </span>
                                                                <span className="text-[11px] text-slate-400 italic">
                                                                    Belum ada biaya perbaikan
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Aksi */}
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button 
                                                            onClick={() => navigate(`/kendaraan/pemeliharaan/edit/${log.id}`)} 
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs" 
                                                            title="Tindak lanjut dan input biaya perbaikan bengkel"
                                                        >
                                                            <Wrench size={12} />
                                                            <span>Tindak Lanjut</span>
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDelete(log.id)} 
                                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer" 
                                                            title="Hapus Laporan Kerusakan"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════════
                        MOBILE CARDS (SEMUA TAB)
                       ══════════════════════════════════════════════════════ */}
                    <div className="grid grid-cols-1 gap-4 lg:hidden">
                        {filteredLogs.map(log => {
                            const isInc = isIncidentLog(log);
                            const incInfo = isInc ? parseIncidentInfo(log.description) : null;
                            const isHandled = log.cost > 0 || (log.workshop && log.workshop !== 'Perlu Penanganan Sarpras');
                            const isReq = activeTab === 'requests';

                            return (
                                <div key={log.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex flex-col">
                                            {isReq && log.code && (
                                                <span className="font-mono text-xs font-bold text-blue-600">{log.code}</span>
                                            )}
                                            <span className="font-bold text-slate-800 text-base">{log.vehicle?.name || 'Tanpa Nama'}</span>
                                            <span className="text-xs uppercase font-mono text-slate-400 tracking-wider">{log.vehicle?.plateNumber}</span>
                                        </div>
                                        <div>
                                            {isReq ? (
                                                renderStatusBadge(log.status)
                                            ) : isInc ? (
                                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold ${isHandled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                                                    {isHandled ? '✓ DITANGANI' : '🔴 PERLU PENANGANAN'}
                                                </span>
                                            ) : (
                                                <div className={`px-2 py-1 rounded-lg text-[10px] font-bold ${log.category === 'ROUTINE' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>
                                                    {log.category === 'ROUTINE' ? 'RUTIN' : 'NON-RUTIN'}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-50">
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Tanggal</span>
                                            <div className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                                                <Calendar size={13} className="text-blue-500" />
                                                {new Date(log.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Odometer</span>
                                            <div className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                                                <Car size={13} className="text-blue-500" />
                                                {log.odometer?.toLocaleString()} km
                                            </div>
                                        </div>
                                    </div>

                                    {/* Deskripsi & Bukti Foto */}
                                    <div className="space-y-2">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">
                                            {isReq ? 'Keluhan / Kebutuhan Servis' : isInc ? 'Rincian Kerusakan' : 'Deskripsi Servis'}
                                        </span>
                                        {incInfo?.reporter && (
                                            <div className="text-[11px] font-bold text-slate-600">
                                                Pelapor: <span className="text-slate-800">{incInfo.reporter}</span>
                                            </div>
                                        )}
                                        {isReq && log.requester?.name && (
                                            <div className="text-[11px] font-bold text-slate-600">
                                                Pemohon: <span className="text-slate-800">{log.requester.name}</span>
                                            </div>
                                        )}
                                        <div className="text-xs text-slate-700 font-medium leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                            {incInfo ? incInfo.notes : (log.description || '-')}
                                        </div>

                                        {/* Foto */}
                                        <div className="flex gap-2 pt-1">
                                            {log.complaintPhoto && (
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewPhoto(log.complaintPhoto)}
                                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 cursor-pointer"
                                                >
                                                    <Image size={13} /> Foto Keluhan
                                                </button>
                                            )}
                                            {log.proofFile && (
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewPhoto(log.proofFile)}
                                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 cursor-pointer"
                                                >
                                                    <Image size={13} /> Foto Nota
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Aksi Mobile */}
                                    <div className="flex flex-col gap-2 pt-3 border-t border-slate-50">
                                        {isReq ? (
                                            <div className="flex flex-wrap gap-2">
                                                {log.status === 'PENDING' && isKabidSarana && (
                                                    <button
                                                        onClick={() => setReviewModalRequest(log)}
                                                        className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                                                    >
                                                        <ShieldCheck size={14} /> Review & TTE
                                                    </button>
                                                )}
                                                {log.status === 'APPROVED' && (
                                                    <>
                                                        <button
                                                            onClick={() => setSpkModalService(log)}
                                                            className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                                                        >
                                                            <Printer size={13} /> Cetak SPK
                                                        </button>
                                                        <button
                                                            onClick={() => handleStartProgress(log)}
                                                            className="flex-1 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                                                        >
                                                            <Wrench size={13} /> Ke Bengkel
                                                        </button>
                                                    </>
                                                )}
                                                {log.status === 'IN_PROGRESS' && (
                                                    <button
                                                        onClick={() => setCompleteModalRequest(log)}
                                                        className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                                                    >
                                                        <CheckCircle2 size={14} /> Selesaikan Servis
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex justify-between items-center">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-slate-400 uppercase font-bold">Total Biaya</span>
                                                    <span className="text-base font-black text-blue-600">Rp {(log.cost || 0).toLocaleString('id-ID')}</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => navigate(`/kendaraan/pemeliharaan/view/${log.id}`)}
                                                        className="p-2 bg-blue-50 text-blue-600 rounded-xl cursor-pointer"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => navigate(`/kendaraan/pemeliharaan/edit/${log.id}`)}
                                                        className="p-2 bg-orange-50 text-orange-600 rounded-xl cursor-pointer"
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="bg-white p-16 rounded-2xl border border-dashed border-slate-200 text-center">
                    {activeTab === 'requests' ? (
                        <>
                            <FileText size={54} className="mx-auto text-blue-300 mb-3" />
                            <h3 className="text-slate-700 font-bold text-base">Tidak ada pengajuan pemeliharaan</h3>
                            <p className="text-slate-400 text-xs mt-1">Staff kendaraan dapat mengajukan servis armada melalui tombol "+ Ajukan Pemeliharaan".</p>
                        </>
                    ) : activeTab === 'maintenance' ? (
                        <>
                            <Wrench size={54} className="mx-auto text-slate-300 mb-3" />
                            <h3 className="text-slate-600 font-bold text-base">Belum ada riwayat pemeliharaan</h3>
                            <p className="text-slate-400 text-xs mt-1">Klik "+ Ajukan Pemeliharaan" atau "+ Catat Langsung" untuk mencatat perawatan armada.</p>
                        </>
                    ) : (
                        <>
                            <CheckCircle size={54} className="mx-auto text-emerald-400 mb-3" />
                            <h3 className="text-slate-600 font-bold text-base">Tidak ada laporan kerusakan aktif</h3>
                            <p className="text-slate-400 text-xs mt-1">Seluruh armada dalam kondisi baik dan tidak ada insiden yang dilaporkan.</p>
                        </>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                MODAL 1: FORM PENGAJUAN PEMELIHARAAN (STAFF KENDARAAN)
               ══════════════════════════════════════════════════════ */}
            <VehicleMaintenanceRequestModal
                show={showRequestModal}
                onClose={() => setShowRequestModal(false)}
                vehicles={vehicles}
                onSuccess={() => {
                    fetchLogs();
                    setActiveTab('requests');
                }}
            />

            {/* ══════════════════════════════════════════════════════
                MODAL 2: REVIEW & TTE KABID SARANA
               ══════════════════════════════════════════════════════ */}
            <VehicleMaintenanceReviewModal
                show={!!reviewModalRequest}
                request={reviewModalRequest}
                currentUser={currentUser}
                onClose={() => setReviewModalRequest(null)}
                onSuccess={() => {
                    fetchLogs();
                    setReviewModalRequest(null);
                }}
            />

            {/* ══════════════════════════════════════════════════════
                MODAL 3: INPUT BIAYA AKTUAL & NOTA BENGKEL (SELESAI SERVIS)
               ══════════════════════════════════════════════════════ */}
            <VehicleMaintenanceCompleteModal
                show={!!completeModalRequest}
                request={completeModalRequest}
                onClose={() => setCompleteModalRequest(null)}
                onSuccess={() => {
                    fetchLogs();
                    setCompleteModalRequest(null);
                }}
            />

            {/* ══════════════════════════════════════════════════════
                MODAL 4: CETAK SPK KENDARAAN RESMI (A4 PORTRAIT TTE ELEKTRONIK)
               ══════════════════════════════════════════════════════ */}
            <VehicleServiceSPKModal
                show={!!spkModalService}
                service={spkModalService}
                onClose={() => setSpkModalService(null)}
            />

            {/* ══════════════════════════════════════════════════════
                LIGHTBOX PREVIEW FOTO BUKTI / KELUHAN
               ══════════════════════════════════════════════════════ */}
            {previewPhoto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
                    <div className="relative max-w-4xl w-full bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between p-4 bg-slate-800/80 text-white border-b border-white/10">
                            <div className="flex items-center gap-2">
                                <Image size={18} className="text-blue-400" />
                                <span className="font-bold text-sm">Foto Bukti / Lampiran</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={previewPhoto}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold inline-flex items-center gap-1 transition"
                                >
                                    <ExternalLink size={14} /> Tab Baru
                                </a>
                                <button
                                    type="button"
                                    onClick={() => setPreviewPhoto(null)}
                                    className="p-1.5 rounded-lg bg-white/10 hover:bg-rose-600 text-white transition cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                        <div className="p-4 flex items-center justify-center overflow-auto bg-black/40">
                            <img
                                src={previewPhoto}
                                alt="Foto Dokumen"
                                className="max-h-[70vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VehicleMaintenanceList;
