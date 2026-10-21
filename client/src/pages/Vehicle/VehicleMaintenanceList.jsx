import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
    Settings, Plus, Search, Calendar, Car, Wrench, Trash2, Pencil, Eye, 
    Download, AlertTriangle, Image, X, ExternalLink, CheckCircle, CheckCircle2, 
    Clock, ShieldCheck, Printer, ArrowRight, AlertCircle, FileText, ChevronRight,
    DollarSign
} from 'lucide-react';
import api from '../../lib/axios';
import { getMediaUrl } from '../../lib/media';
import * as XLSX from 'xlsx';

// Modal Alur Pemeliharaan Kendaraan
import VehicleMaintenanceRequestModal from './components/VehicleMaintenanceRequestModal';
import VehicleMaintenanceReviewModal from './components/VehicleMaintenanceReviewModal';
import VehicleMaintenanceCompleteModal from './components/VehicleMaintenanceCompleteModal';
import VehicleServiceSPKModal from './components/VehicleServiceSPKModal';

const VehicleMaintenanceList = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [logs, setLogs] = useState([]);
    const [tripIncidents, setTripIncidents] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingIncidents, setLoadingIncidents] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedVehicleId, setSelectedVehicleId] = useState('');
    const [activeTab, setActiveTab] = useState(() => {
        const tabParam = searchParams?.get('tab');
        if (tabParam === 'damage' || tabParam === 'maintenance') return tabParam;
        return 'requests';
    }); // 'requests' | 'damage' | 'maintenance'
    const [requestStatusFilter, setRequestStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED'
    const [damageStatusFilter, setDamageStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED'
    const [previewPhoto, setPreviewPhoto] = useState(null); // photo lightbox modal

    // Modal state
    const [requestModalConfig, setRequestModalConfig] = useState({
        show: false,
        category: 'ROUTINE',
        type: 'SERVICE_RUTIN',
        vehicleId: '',
        description: '',
        odometer: '',
        photo: null,
        bookingId: null
    });
    const [reviewModalRequest, setReviewModalRequest] = useState(null);
    const [completeModalRequest, setCompleteModalRequest] = useState(null);
    const [spkModalService, setSpkModalService] = useState(null);

    // Current user context
    const currentUser = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
    const userPosition = (currentUser?.position || '').toLowerCase();
    const userRole = currentUser?.role || '';
    const isKabidSarana = 
        userRole === 'SUPER_ADMIN' || 
        userRole === 'KABID_SARPRAS' || 
        userPosition.includes('kepala bidang sarana') ||
        userPosition.includes('kabid sarpras') ||
        userPosition.includes('sarana');

    useEffect(() => {
        fetchLogs();
        fetchTripIncidents();
        fetchVehicles();
    }, []);

    useEffect(() => {
        const tabParam = searchParams?.get('tab');
        if (tabParam && ['requests', 'damage', 'maintenance'].includes(tabParam)) {
            setActiveTab(tabParam);
        }
    }, [searchParams]);

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

    const fetchTripIncidents = async () => {
        try {
            setLoadingIncidents(true);
            const res = await api.get('/vehicles/incidents');
            setTripIncidents(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error('Failed to fetch trip incidents:', error);
        } finally {
            setLoadingIncidents(false);
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
            fetchTripIncidents();
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
            fetchTripIncidents();
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal mengubah status pengerjaan');
        }
    };

    // Helper ekstrak foto bukti / keluhan
    const getLogPhoto = (log) => {
        if (!log) return null;
        return log.proofFile || log.complaintPhoto || log.photo || null;
    };

    // Handler Tindak Lanjut Insiden Perjalanan ke Alur Servis / Bengkel
    const handleFollowUpIncident = (inc) => {
        setRequestModalConfig({
            show: true,
            category: 'NON_ROUTINE',
            type: 'PERBAIKAN',
            vehicleId: inc.vehicleId,
            description: `[Tindak Lanjut Insiden #${inc.id}] Rute: ${inc.destination || '-'}. Catatan Sopir (${inc.driverName}): ${inc.incidentNotes || '-'}`,
            odometer: inc.endKm || '',
            photo: inc.incidentPhoto || null,
            bookingId: inc.id
        });
    };

    // TAB 1: Alur Pengajuan Pemeliharaan & Servis Kendaraan (Semua pengajuan aktif di alur kerja)
    const requestLogs = logs.filter(l => {
        return (
            l.status === 'PENDING' || 
            l.status === 'APPROVED' || 
            l.status === 'IN_PROGRESS' || 
            l.status === 'REJECTED' ||
            (l.code && l.code.startsWith('PK/') && l.status !== 'COMPLETED')
        );
    });

    // TAB 2: Laporan Kerusakan Murni dari Laporan Pemakaian Kendaraan (Trip End Report hasIncident)
    const damageLogs = tripIncidents;

    // TAB 3: Riwayat Servis Selesai (COMPLETED routine / scheduled services)
    const maintenanceLogs = logs.filter(l => 
        !l.status || l.status === 'COMPLETED'
    );

    // Badge Counters Tab Pengajuan Servis (Tab 1)
    const pendingRequestsCount = requestLogs.filter(l => l.status === 'PENDING').length;
    const approvedRequestsCount = requestLogs.filter(l => l.status === 'APPROVED').length;
    const inProgressRequestsCount = requestLogs.filter(l => l.status === 'IN_PROGRESS').length;

    // Badge Counters Tab Laporan Kerusakan (Tab 2)
    const damagePendingCount = damageLogs.filter(inc => !inc.isFollowedUp || inc.service?.status === 'PENDING').length;
    const damageApprovedCount = damageLogs.filter(inc => inc.isFollowedUp && inc.service?.status === 'APPROVED').length;
    const damageInProgressCount = damageLogs.filter(inc => inc.isFollowedUp && inc.service?.status === 'IN_PROGRESS').length;
    const damageCompletedCount = damageLogs.filter(inc => inc.isFollowedUp && inc.service?.status === 'COMPLETED').length;

    // Filter Tab 1 (Pengajuan) & Tab 3 (Riwayat Selesai)
    let currentTabLogs = [];
    if (activeTab === 'requests') {
        currentTabLogs = requestLogs.filter(l => {
            if (requestStatusFilter === 'ALL') return true;
            return l.status === requestStatusFilter;
        });
    } else if (activeTab === 'maintenance') {
        currentTabLogs = maintenanceLogs;
    }

    const uniqueVehicles = vehicles.length > 0 
        ? vehicles 
        : [...new Map(logs.map(log => [log.vehicle?.id, log.vehicle])).values()].filter(Boolean);

    const filteredLogs = currentTabLogs.filter(log => {
        if (selectedVehicleId && log.vehicle?.id !== parseInt(selectedVehicleId)) return false;
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            (log.vehicle?.name && log.vehicle.name.toLowerCase().includes(term)) ||
            (log.vehicle?.plateNumber && log.vehicle.plateNumber.toLowerCase().includes(term)) ||
            (log.type && log.type.toLowerCase().includes(term)) ||
            (log.code && log.code.toLowerCase().includes(term)) ||
            (log.spkNumber && log.spkNumber.toLowerCase().includes(term)) ||
            (log.requester?.name && log.requester.name.toLowerCase().includes(term)) ||
            (log.description && log.description.toLowerCase().includes(term))
        );
    });

    // Filter Khusus Tab 2: Laporan Kerusakan dari Pemakaian Kendaraan
    const filteredDamageLogs = damageLogs.filter(inc => {
        if (selectedVehicleId && inc.vehicleId !== parseInt(selectedVehicleId)) return false;

        if (damageStatusFilter === 'PENDING') {
            if (inc.isFollowedUp && inc.service?.status !== 'PENDING') return false;
        } else if (damageStatusFilter === 'APPROVED') {
            if (!inc.isFollowedUp || inc.service?.status !== 'APPROVED') return false;
        } else if (damageStatusFilter === 'IN_PROGRESS') {
            if (!inc.isFollowedUp || inc.service?.status !== 'IN_PROGRESS') return false;
        } else if (damageStatusFilter === 'COMPLETED') {
            if (!inc.isFollowedUp || inc.service?.status !== 'COMPLETED') return false;
        } else if (damageStatusFilter === 'REJECTED') {
            if (!inc.isFollowedUp || inc.service?.status !== 'REJECTED') return false;
        }

        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        const matchVehicle = (inc.vehicle?.name && inc.vehicle.name.toLowerCase().includes(term)) ||
                             (inc.vehicle?.plateNumber && inc.vehicle.plateNumber.toLowerCase().includes(term));
        const matchDriver = (inc.driverName && inc.driverName.toLowerCase().includes(term)) ||
                            (inc.user?.name && inc.user.name.toLowerCase().includes(term));
        const matchDest = (inc.destination && inc.destination.toLowerCase().includes(term));
        const matchNotes = (inc.incidentNotes && inc.incidentNotes.toLowerCase().includes(term));
        const matchService = inc.service && (
            (inc.service.code && inc.service.code.toLowerCase().includes(term)) ||
            (inc.service.spkNumber && inc.service.spkNumber.toLowerCase().includes(term))
        );
        return matchVehicle || matchDriver || matchDest || matchNotes || matchService;
    });

    const handleExport = () => {
        let exportData = [];
        let sheetTitle = 'Pemeliharaan_Kendaraan';

        if (activeTab === 'damage') {
            sheetTitle = 'Laporan_Kerusakan_Pemakaian_Kendaraan';
            exportData = filteredDamageLogs.map((inc, index) => ({
                'No': index + 1,
                'ID Insiden': `#TRIP-${inc.id}`,
                'Waktu Selesai Jalan': inc.createdAt ? new Date(inc.createdAt).toLocaleString('id-ID') : '-',
                'Kendaraan': inc.vehicle?.name || 'Tanpa Nama',
                'Plat Nomor': inc.vehicle?.plateNumber || '-',
                'Pengemudi / Sopir': inc.driverName || '-',
                'Peminjam': inc.user?.name || '-',
                'Tujuan / Rute': inc.destination || '-',
                'KM Awal': inc.startKm || '-',
                'KM Akhir': inc.endKm || '-',
                'Jarak Tempuh (km)': inc.totalDistance || '-',
                'Kronologi / Kerusakan': inc.incidentNotes || '-',
                'Status Tindak Lanjut': inc.isFollowedUp ? (inc.service?.status || 'SUDAH DIAJUKAN SERVIS') : 'BELUM DITINDAKLANJUTI',
                'Kode Tiket Servis': inc.service?.code || '-',
                'No. SPK': inc.service?.spkNumber || '-'
            }));
        } else if (activeTab === 'requests') {
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
        } else {
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
                        Monitoring servis berkala armada, penanganan laporan kerusakan & insiden darurat, penerbitan SPK Bengkel resmi, serta arsip riwayat perawatan.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                    {/* Tombol Lapor Kerusakan */}
                    <button
                        onClick={() => setRequestModalConfig({
                            show: true,
                            category: 'NON_ROUTINE',
                            type: 'PERBAIKAN',
                            vehicleId: '',
                            description: '',
                            odometer: '',
                            photo: null,
                            bookingId: null
                        })}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-rose-600 to-red-600 text-white px-4 py-2.5 rounded-xl font-bold hover:from-rose-700 hover:to-red-700 shadow-md shadow-rose-500/25 transition-all text-xs sm:text-sm cursor-pointer"
                        title="Laporkan kendala, insiden, atau kerusakan armada untuk perbaikan darurat/bengkel"
                    >
                        <AlertTriangle size={16} /> <span>+ Lapor Kerusakan</span>
                    </button>

                    {/* Tombol Ajukan Servis Rutin */}
                    <button
                        onClick={() => setRequestModalConfig({
                            show: true,
                            category: 'ROUTINE',
                            type: 'SERVICE_RUTIN',
                            vehicleId: '',
                            description: '',
                            odometer: '',
                            photo: null,
                            bookingId: null
                        })}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/25 transition-all text-xs sm:text-sm cursor-pointer"
                        title="Pengajuan servis berkala, ganti oli, dan tune-up armada"
                    >
                        <Plus size={16} /> <span>+ Ajukan Servis</span>
                    </button>

                    {/* Tombol Health Monitor */}
                    <button
                        onClick={() => navigate('/kendaraan/pemeliharaan/reminder')}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3.5 py-2.5 rounded-xl font-bold hover:bg-emerald-100 transition-all text-xs sm:text-sm cursor-pointer"
                        title="Monitoring kesehatan komponen rutin dan jadwal servis berkala"
                    >
                        <span>🩺 Health Monitor</span>
                    </button>

                    {/* Tombol Ekspor */}
                    <button
                        onClick={handleExport}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2.5 rounded-xl font-bold transition-all text-xs sm:text-sm cursor-pointer"
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

            {/* TAB NAVIGATION: 3 Tab (Alur Pengajuan Servis, Laporan Kerusakan, Riwayat Servis Selesai) */}
            <div className="bg-white rounded-2xl border border-slate-100 p-1.5 shadow-sm flex flex-wrap gap-2">
                {/* TAB 1: PENGAJUAN PEMELIHARAAN (ALUR KERJA SERVIS RUTIN) */}
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
                    {pendingRequestsCount > 0 ? (
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold animate-pulse ${
                            activeTab === 'requests' ? 'bg-amber-400 text-slate-900' : 'bg-amber-500 text-white'
                        }`} title={`${pendingRequestsCount} pengajuan menunggu persetujuan Kabid`}>
                            {pendingRequestsCount} Perlu Review
                        </span>
                    ) : (
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                            activeTab === 'requests' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                            {requestLogs.length}
                        </span>
                    )}
                </button>

                {/* TAB 2: LAPORAN KERUSAKAN (DEDICATED TAB) */}
                <button
                    onClick={() => setActiveTab('damage')}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                        activeTab === 'damage'
                            ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                >
                    <AlertTriangle size={16} className={activeTab === 'damage' ? 'text-white' : 'text-rose-500'} />
                    <span>Laporan Kerusakan</span>
                    {damagePendingCount > 0 ? (
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold animate-pulse ${
                            activeTab === 'damage' ? 'bg-white text-rose-700' : 'bg-rose-500 text-white'
                        }`} title={`${damagePendingCount} laporan kerusakan menunggu review`}>
                            {damagePendingCount} Perlu Review
                        </span>
                    ) : (
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                            activeTab === 'damage' ? 'bg-white/20 text-white' : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                            {damageLogs.length}
                        </span>
                    )}
                </button>

                {/* TAB 3: RIWAYAT SERVIS SELESAI */}
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
            </div>

            {/* Filter Status Khusus Tab Pengajuan Rutin */}
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

            {/* Filter Status Khusus Tab Laporan Kerusakan */}
            {activeTab === 'damage' && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-xs font-bold text-slate-500 mr-1">Status Kerusakan:</span>
                    {[
                        { key: 'ALL', label: 'Semua Laporan' },
                        { key: 'PENDING', label: 'Menunggu Review', count: damagePendingCount, dot: 'bg-amber-500' },
                        { key: 'APPROVED', label: 'Disetujui / Siap Bengkel', count: damageApprovedCount, dot: 'bg-blue-500' },
                        { key: 'IN_PROGRESS', label: 'Dalam Pengerjaan', count: damageInProgressCount, dot: 'bg-purple-500' },
                        { key: 'COMPLETED', label: 'Perbaikan Selesai', count: damageCompletedCount, dot: 'bg-emerald-500' },
                        { key: 'REJECTED', label: 'Ditolak' }
                    ].map(f => (
                        <button
                            key={f.key}
                            onClick={() => setDamageStatusFilter(f.key)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                                damageStatusFilter === f.key
                                    ? 'bg-rose-600 text-white shadow-sm'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            {f.dot && <span className={`w-2 h-2 rounded-full ${f.dot}`} />}
                            <span>{f.label}</span>
                            {f.count !== undefined && f.count > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                                    damageStatusFilter === f.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
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
                            activeTab === 'damage'
                                ? 'Cari laporan kerusakan, armada, pelapor, no SPK...'
                                : activeTab === 'requests' 
                                ? 'Cari kode pengajuan, SPK, armada, pemohon, bengkel...' 
                                : 'Cari armada, jenis servis, atau deskripsi...'
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
            ) : activeTab === 'damage' ? (
                /* ══════════════════════════════════════════════════════
                   TAB 2: LAPORAN KERUSAKAN MURNI DARI LAPORAN PEMAKAIAN KENDARAAN (TRIP END REPORT)
                   ══════════════════════════════════════════════════════ */
                filteredDamageLogs.length > 0 ? (
                    <div className="space-y-4">
                        {/* Desktop Table (Tab 2) */}
                        <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-rose-50/50 border-b border-rose-100 text-[11px] font-extrabold text-rose-800 uppercase tracking-wider">
                                        <th className="px-5 py-4">ID & Waktu Insiden</th>
                                        <th className="px-5 py-4">Armada Kendaraan</th>
                                        <th className="px-5 py-4">Pengemudi & Rute Perjalanan</th>
                                        <th className="px-5 py-4">Kronologi & Foto Kerusakan</th>
                                        <th className="px-5 py-4 text-center">Status Servis</th>
                                        <th className="px-5 py-4 text-center">Tindak Lanjut</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredDamageLogs.map(inc => {
                                        const hasService = inc.isFollowedUp && inc.service;
                                        const photoUrl = inc.incidentPhoto ? getMediaUrl(inc.incidentPhoto) : null;
                                        const isPending = hasService && inc.service.status === 'PENDING';
                                        const isApproved = hasService && inc.service.status === 'APPROVED';
                                        const isInProgress = hasService && inc.service.status === 'IN_PROGRESS';
                                        const isCompleted = hasService && inc.service.status === 'COMPLETED';

                                        return (
                                            <tr key={inc.id} className="hover:bg-slate-50/70 transition-colors group text-sm font-medium text-slate-600">
                                                {/* ID & Waktu */}
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="font-mono font-bold text-xs text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md w-fit border border-rose-200">
                                                            #TRIP-{inc.id}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                            <Calendar size={12} className="text-slate-400" />
                                                            {new Date(inc.createdAt || inc.tripEndTime).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </div>
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-200 w-fit">
                                                            🚨 Insiden Perjalanan
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Armada Kendaraan */}
                                                <td className="px-5 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-900 text-sm">{inc.vehicle?.name || 'Armada'}</span>
                                                        <span className="text-[11px] font-mono font-bold text-slate-500 uppercase">{inc.vehicle?.plateNumber}</span>
                                                        <div className="text-[11px] text-slate-500 mt-1 flex flex-col gap-0.5">
                                                            <span>KM Akhir: <b className="text-slate-700 font-mono">{inc.endKm?.toLocaleString() || '-'}</b></span>
                                                            {inc.totalDistance && (
                                                                <span className="text-blue-600 font-semibold text-[10px]">Jarak Tempuh: {inc.totalDistance.toLocaleString()} km</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Pengemudi & Rute */}
                                                <td className="px-5 py-4 max-w-xs">
                                                    <div className="space-y-1">
                                                        <div className="text-xs font-bold text-slate-800 flex items-center gap-1">
                                                            <span>👤 Sopir: {inc.driverName}</span>
                                                        </div>
                                                        {inc.user?.name && inc.user.name !== inc.driverName && (
                                                            <div className="text-[11px] text-slate-500">
                                                                Peminjam: {inc.user.name}
                                                            </div>
                                                        )}
                                                        <div className="text-xs text-slate-600 bg-slate-50 p-1.5 rounded-lg border border-slate-100 mt-1">
                                                            <span className="font-bold text-slate-700">Tujuan:</span> {inc.destination || '-'}
                                                            {inc.purpose && <div className="text-[10px] text-slate-400 truncate mt-0.5">Keperluan: {inc.purpose}</div>}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Kronologi & Foto Kerusakan */}
                                                <td className="px-5 py-4 max-w-sm">
                                                    <div className="space-y-1.5">
                                                        <p className="text-xs text-slate-700 font-medium leading-relaxed bg-rose-50/60 p-2 rounded-xl border border-rose-100">
                                                            {inc.incidentNotes || 'Kerusakan saat perjalanan'}
                                                        </p>
                                                        {photoUrl && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setPreviewPhoto(photoUrl)}
                                                                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 cursor-pointer transition hover:bg-rose-100"
                                                                title="Lihat foto bukti kerusakan di jalan"
                                                            >
                                                                <Image size={12} /> Foto Kerusakan
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Status Servis */}
                                                <td className="px-5 py-4 text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        {hasService ? (
                                                            <>
                                                                {renderStatusBadge(inc.service.status)}
                                                                <span className="font-mono font-bold text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 mt-0.5">
                                                                    {inc.service.code || `ID-#${inc.service.id}`}
                                                                </span>
                                                                {inc.service.spkNumber && (
                                                                    <span className="text-[10px] font-mono text-slate-500 font-semibold">
                                                                        {inc.service.spkNumber}
                                                                    </span>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                                                                <AlertCircle size={12} className="text-amber-500" />
                                                                Belum Ada Tiket
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Aksi Tindak Lanjut */}
                                                <td className="px-5 py-4 text-center">
                                                    <div className="flex flex-col items-center justify-center gap-1.5">
                                                        {!hasService ? (
                                                            <button
                                                                onClick={() => handleFollowUpIncident(inc)}
                                                                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-rose-500/20 transition cursor-pointer"
                                                                title="Terbitkan pengajuan servis bengkel untuk insiden ini"
                                                            >
                                                                <Wrench size={13} /> + Tindak Lanjut Servis
                                                            </button>
                                                        ) : (
                                                            <>
                                                                {isPending && (
                                                                    isKabidSarana ? (
                                                                        <button
                                                                            onClick={() => setReviewModalRequest(inc.service)}
                                                                            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-500/20 transition cursor-pointer"
                                                                        >
                                                                            <ShieldCheck size={14} /> Review & TTE
                                                                        </button>
                                                                    ) : (
                                                                        <span className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 font-medium">
                                                                            Menunggu Kabid
                                                                        </span>
                                                                    )
                                                                )}
                                                                {isApproved && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => setSpkModalService(inc.service)}
                                                                            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
                                                                        >
                                                                            <Printer size={13} /> Cetak SPK
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleStartProgress(inc.service)}
                                                                            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition cursor-pointer"
                                                                        >
                                                                            <Wrench size={13} /> Masuk Bengkel
                                                                        </button>
                                                                    </>
                                                                )}
                                                                {isInProgress && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => setCompleteModalRequest(inc.service)}
                                                                            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
                                                                        >
                                                                            <CheckCircle2 size={14} /> Selesaikan Servis
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setSpkModalService(inc.service)}
                                                                            className="w-full flex items-center justify-center gap-1.5 px-2 py-1 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg text-xs font-medium transition cursor-pointer"
                                                                        >
                                                                            <Printer size={12} /> SPK
                                                                        </button>
                                                                    </>
                                                                )}
                                                                {isCompleted && (
                                                                    <div className="flex items-center gap-1">
                                                                        {inc.service.spkNumber && (
                                                                            <button
                                                                                onClick={() => setSpkModalService(inc.service)}
                                                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                                                                                title="Cetak SPK Kendaraan"
                                                                            >
                                                                                <Printer size={16} />
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            onClick={() => navigate(`/kendaraan/pemeliharaan/view/${inc.service.id}`)}
                                                                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                                                                            title="Lihat Rincian Lengkap"
                                                                        >
                                                                            <Eye size={16} />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards (Tab 2) */}
                        <div className="grid grid-cols-1 gap-4 lg:hidden">
                            {filteredDamageLogs.map(inc => {
                                const hasService = inc.isFollowedUp && inc.service;
                                const photoUrl = inc.incidentPhoto ? getMediaUrl(inc.incidentPhoto) : null;

                                return (
                                    <div key={inc.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="flex flex-col">
                                                <span className="font-mono text-xs font-bold text-rose-600">#TRIP-{inc.id}</span>
                                                <span className="font-bold text-slate-800 text-base">{inc.vehicle?.name || 'Tanpa Nama'}</span>
                                                <span className="text-xs uppercase font-mono text-slate-400 tracking-wider">{inc.vehicle?.plateNumber}</span>
                                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-200 mt-1 w-fit">
                                                    🚨 Insiden Perjalanan
                                                </span>
                                            </div>
                                            <div>
                                                {hasService ? (
                                                    renderStatusBadge(inc.service.status)
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                                                        Belum Ada Tiket
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-50 text-xs">
                                            <div>
                                                <span className="text-[10px] text-slate-400 uppercase font-bold">Sopir / Peminjam</span>
                                                <div className="font-semibold text-slate-800">{inc.driverName}</div>
                                                {inc.destination && <div className="text-[11px] text-slate-500">Rute: {inc.destination}</div>}
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-slate-400 uppercase font-bold">KM Perjalanan</span>
                                                <div className="font-semibold text-slate-800">{inc.endKm ? `${inc.endKm.toLocaleString()} km` : '-'}</div>
                                                {inc.totalDistance && <div className="text-[10px] text-blue-600 font-bold">Jarak: {inc.totalDistance} km</div>}
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold">Kronologi Insiden</span>
                                            <div className="text-xs text-slate-700 font-medium bg-rose-50/60 p-2.5 rounded-xl border border-rose-100">
                                                {inc.incidentNotes || 'Kerusakan kendaraan saat perjalanan'}
                                            </div>
                                            {photoUrl && (
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewPhoto(photoUrl)}
                                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 cursor-pointer"
                                                >
                                                    <Image size={13} /> Foto Kerusakan
                                                </button>
                                            )}
                                        </div>

                                        <div className="pt-2 border-t border-slate-50">
                                            {!hasService ? (
                                                <button
                                                    onClick={() => handleFollowUpIncident(inc)}
                                                    className="w-full py-2.5 bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                                                >
                                                    <Wrench size={14} /> + Tindak Lanjut ke Servis
                                                </button>
                                            ) : (
                                                <div className="flex flex-wrap gap-2">
                                                    {inc.service.status === 'PENDING' && isKabidSarana && (
                                                        <button
                                                            onClick={() => setReviewModalRequest(inc.service)}
                                                            className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                                                        >
                                                            <ShieldCheck size={14} /> Review & TTE
                                                        </button>
                                                    )}
                                                    {inc.service.status === 'APPROVED' && (
                                                        <>
                                                            <button
                                                                onClick={() => setSpkModalService(inc.service)}
                                                                className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                                                            >
                                                                <Printer size={13} /> Cetak SPK
                                                            </button>
                                                            <button
                                                                onClick={() => handleStartProgress(inc.service)}
                                                                className="flex-1 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                                                            >
                                                                <Wrench size={13} /> Ke Bengkel
                                                            </button>
                                                        </>
                                                    )}
                                                    {inc.service.status === 'IN_PROGRESS' && (
                                                        <button
                                                            onClick={() => setCompleteModalRequest(inc.service)}
                                                            className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                                                        >
                                                            <CheckCircle2 size={14} /> Selesaikan Servis
                                                        </button>
                                                    )}
                                                    {inc.service.status === 'COMPLETED' && (
                                                        <button
                                                            onClick={() => navigate(`/kendaraan/pemeliharaan/view/${inc.service.id}`)}
                                                            className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                                                        >
                                                            <Eye size={14} /> Lihat Rincian
                                                        </button>
                                                    )}
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
                        <AlertTriangle size={54} className="mx-auto text-rose-300 mb-3" />
                        <h3 className="text-slate-700 font-bold text-base">Tidak ada laporan kerusakan perjalanan</h3>
                        <p className="text-slate-400 text-xs mt-1">Belum ada kendala atau kerusakan yang dilaporkan saat pengembalian armada pemakaian jalan.</p>
                    </div>
                )
            ) : filteredLogs.length > 0 ? (
                /* ══════════════════════════════════════════════════════
                   TAB 1 & TAB 3: PENGAJUAN SERVIS & RIWAYAT SERVIS SELESAI
                   ══════════════════════════════════════════════════════ */
                <div className="space-y-4">
                    {/* TAB 1: DAFTAR ALUR PENGAJUAN SERVIS (DESKTOP TABLE) */}
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
                                                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                                            {renderUrgencyBadge(log.urgency)}
                                                            {log.category === 'NON_ROUTINE' ? (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded-md border border-orange-200 shadow-2xs">
                                                                    🔧 Perbaikan
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-200 shadow-2xs">
                                                                    🔄 Servis Rutin
                                                                </span>
                                                            )}
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

                                                        {log.description?.includes('Status Anggaran: Sudah Tersedia') && (
                                                            <div className="mt-0.5">
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200 shadow-2xs">
                                                                    <DollarSign size={10} /> Anggaran Tersedia
                                                                </span>
                                                            </div>
                                                        )}

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

                    {/* TAB 3: RIWAYAT SERVIS SELESAI (DESKTOP TABLE) */}
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

                    {/* MOBILE CARDS (TAB 1 & TAB 3) */}
                    <div className="grid grid-cols-1 gap-4 lg:hidden">
                        {filteredLogs.map(log => {
                            const photoUrl = getLogPhoto(log);
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
                                                {log.odometer ? `${log.odometer.toLocaleString()} km` : '-'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Deskripsi & Bukti Foto */}
                                    <div className="space-y-2">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">
                                            {isReq ? 'Keluhan / Kebutuhan Servis' : 'Deskripsi Servis'}
                                        </span>
                                        {isReq && log.requester?.name && (
                                            <div className="text-[11px] font-bold text-slate-600">
                                                Pemohon: <span className="text-slate-800">{log.requester.name}</span>
                                            </div>
                                        )}
                                        <div className="text-xs text-slate-700 font-medium leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                            {log.description || '-'}
                                        </div>

                                        {/* Foto */}
                                        {photoUrl && (
                                            <div className="flex gap-2 pt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewPhoto(getMediaUrl(photoUrl))}
                                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 cursor-pointer"
                                                >
                                                    <Image size={13} /> {log.complaintPhoto ? 'Foto Keluhan' : 'Foto Bukti'}
                                                </button>
                                            </div>
                                        )}
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
                            <h3 className="text-slate-700 font-bold text-base">Tidak ada pengajuan servis</h3>
                            <p className="text-slate-400 text-xs mt-1">Staff kendaraan dapat mengajukan servis armada melalui tombol "+ Ajukan Servis".</p>
                        </>
                    ) : (
                        <>
                            <Wrench size={54} className="mx-auto text-slate-300 mb-3" />
                            <h3 className="text-slate-600 font-bold text-base">Belum ada riwayat pemeliharaan selesai</h3>
                            <p className="text-slate-400 text-xs mt-1">Servis yang telah diselesaikan akan tercatat di sini.</p>
                        </>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                MODAL 1: FORM PENGAJUAN PEMELIHARAAN (STAFF KENDARAAN)
               ══════════════════════════════════════════════════════ */}
            <VehicleMaintenanceRequestModal
                show={requestModalConfig.show}
                initialCategory={requestModalConfig.category}
                initialType={requestModalConfig.type}
                initialVehicleId={requestModalConfig.vehicleId}
                initialDescription={requestModalConfig.description}
                initialOdometer={requestModalConfig.odometer}
                initialPhoto={requestModalConfig.photo}
                bookingId={requestModalConfig.bookingId}
                onClose={() => setRequestModalConfig({
                    show: false,
                    category: 'ROUTINE',
                    type: 'SERVICE_RUTIN',
                    vehicleId: '',
                    description: '',
                    odometer: '',
                    photo: null,
                    bookingId: null
                })}
                vehicles={vehicles}
                currentUser={currentUser}
                onSuccess={() => {
                    fetchLogs();
                    fetchTripIncidents();
                    if (requestModalConfig.bookingId || requestModalConfig.category === 'NON_ROUTINE') {
                        setActiveTab('damage');
                    } else {
                        setActiveTab('requests');
                    }
                    setRequestModalConfig({
                        show: false,
                        category: 'ROUTINE',
                        type: 'SERVICE_RUTIN',
                        vehicleId: '',
                        description: '',
                        odometer: '',
                        photo: null,
                        bookingId: null
                    });
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
                    fetchTripIncidents();
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
                    fetchTripIncidents();
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
