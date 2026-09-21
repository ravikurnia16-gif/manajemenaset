import React, { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Plus, Eye, Filter, Files, Trash2, Search, ClipboardList, Clock, 
    CheckCircle, PackageCheck, XCircle, ChevronDown, ChevronRight,
    FileText, User, Tag, Layers, Printer, ExternalLink, ShieldCheck, CheckCheck
} from 'lucide-react';
import api from '../lib/axios';
import * as XLSX from 'xlsx';
import ProcurementLetterModal from '../components/ProcurementLetterModal';

const ProcurementList = () => {
    const navigate = useNavigate();
    let savedFilters = {};
    try {
        savedFilters = JSON.parse(sessionStorage.getItem('procurementFilters') || '{}');
    } catch (e) {
        console.error('Failed to parse procurementFilters from sessionStorage', e);
    }

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState(savedFilters.filter || { categoryId: '', status: '', unitId: '', search: '' });
    const [units, setUnits] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [pagination, setPagination] = useState(savedFilters.pagination || { limit: 10, page: 1 });
    const [dashboardStats, setDashboardStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(true);

    // Accordion State: Set of procurement IDs currently expanded
    const [expandedIds, setExpandedIds] = useState(new Set());

    // Letter Modal State
    const [selectedLetterData, setSelectedLetterData] = useState(null);
    const [showLetterModal, setShowLetterModal] = useState(false);
    const [loadingLetterId, setLoadingLetterId] = useState(null);

    let currentUser = {};
    try {
        currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    } catch (e) {
        currentUser = {};
    }
    const isKabid = currentUser.role === 'SUPER_ADMIN' || (currentUser.position && currentUser.position.toLowerCase().includes('kepala bidang sarana'));

    useEffect(() => {
        sessionStorage.setItem('procurementFilters', JSON.stringify({
            filter,
            pagination
        }));
    }, [filter, pagination]);

    useEffect(() => {
        fetchUnits();
        fetchCategories();
        fetchDashboardStats();
    }, []);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchRequests();
            setSelectedIds([]);
        }, 400);
        return () => clearTimeout(timeoutId);
    }, [filter, pagination.limit, pagination.page]);

    const fetchUnits = async () => {
        try {
            const res = await api.get('/master/units');
            setUnits(res.data || []);
        } catch (error) {
            console.error("Failed to fetch units");
        }
    };

    const fetchCategories = async () => {
        try {
            const res = await api.get('/master/categories');
            setCategories(res.data || []);
        } catch (error) {
            console.error("Failed to fetch categories");
        }
    };

    const fetchDashboardStats = async () => {
        try {
            setLoadingStats(true);
            const res = await api.get('/procurements/dashboard');
            setDashboardStats(res.data);
        } catch (error) {
            console.error("Failed to fetch dashboard stats", error);
        } finally {
            setLoadingStats(false);
        }
    };

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filter.categoryId) params.append('categoryId', filter.categoryId);
            if (filter.status) params.append('status', filter.status);
            if (filter.unitId) params.append('unitId', filter.unitId);
            if (filter.search) params.append('search', filter.search);
            params.append('limit', pagination.limit);
            params.append('page', pagination.page);

            const res = await api.get(`/procurements?${params.toString()}`);
            const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setRequests(data);
        } catch (error) {
            console.error("fetchRequests error:", error);
            setRequests([]);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Apakah anda yakin ingin menghapus paket pengadaan ini? Seluruh data item di dalamnya akan dihapus.')) return;
        try {
            await api.delete(`/procurements/${id}`);
            fetchRequests();
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal menghapus');
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Apakah anda yakin ingin menghapus ${selectedIds.length} pengajuan terpilih?`)) return;
        try {
            await api.post('/procurements/bulk-delete', { ids: selectedIds });
            fetchRequests();
            setSelectedIds([]);
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal menghapus');
        }
    };

    const toggleExpandRow = (id) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleExpandAll = () => {
        if (expandedIds.size === paginatedRequests.length) {
            setExpandedIds(new Set());
        } else {
            setExpandedIds(new Set(paginatedRequests.map(r => r.id)));
        }
    };

    const handleOpenLetter = async (procurementId) => {
        try {
            setLoadingLetterId(procurementId);
            const res = await api.get(`/procurements/${procurementId}`);
            if (res.data?.requestLetter) {
                setSelectedLetterData({
                    ...res.data.requestLetter,
                    procurementId
                });
                setShowLetterModal(true);
            } else {
                alert('Surat Permohonan belum dibuat atau tidak tersedia untuk pengajuan ini.');
            }
        } catch (e) {
            alert('Gagal mengambil data Surat Permohonan.');
        } finally {
            setLoadingLetterId(null);
        }
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedIds(paginatedRequests.map(r => r.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(sid => sid !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const formatCurrency = (val) => {
        if (!val || isNaN(val)) return 'Rp 0';
        return `Rp ${Number(val).toLocaleString('id-ID')}`;
    };

    const handleExport = () => {
        if (requests.length === 0) return alert('Tidak ada data untuk diekspor');

        // Export data with item breakdown
        const rows = [];
        requests.forEach(req => {
            const items = req.items || [];
            if (items.length === 0) {
                rows.push({
                    'Kode Request': req.code,
                    'Judul Pengajuan': req.title || '-',
                    'Unit Kerja': req.unit?.name || '-',
                    'Pemohon': req.user?.username || '-',
                    'Status': req.status,
                    'Tanggal Pengajuan': new Date(req.createdAt).toLocaleDateString('id-ID'),
                    'Jumlah Item': 0,
                    'Nama Barang': '-',
                    'Spesifikasi': '-',
                    'Qty': 0,
                    'Satuan': '-',
                    'Estimasi Harga': 0,
                    'Petugas': '-'
                });
            } else {
                items.forEach((it, idx) => {
                    rows.push({
                        'Kode Request': idx === 0 ? req.code : '',
                        'Judul Pengajuan': idx === 0 ? (req.title || '-') : '',
                        'Unit Kerja': idx === 0 ? (req.unit?.name || '-') : '',
                        'Pemohon': idx === 0 ? (req.user?.username || '-') : '',
                        'Status': idx === 0 ? req.status : '',
                        'Tanggal Pengajuan': idx === 0 ? new Date(req.createdAt).toLocaleDateString('id-ID') : '',
                        'Jumlah Item': idx === 0 ? items.length : '',
                        'No Item': idx + 1,
                        'Nama Barang': it.name,
                        'Spesifikasi': it.spec || '-',
                        'Qty': it.qty,
                        'Satuan': it.unit,
                        'Estimasi Harga': it.estPrice || 0,
                        'Petugas Ditugaskan': it.assignedTo || it.assignedToUser?.name || '-'
                    });
                });
            }
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Pengadaan & Rincian Item");
        XLSX.writeFile(wb, `Laporan_Pengadaan_Aset_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const statusWeight = {
        'SUBMITTED': 1,
        'APPROVED': 2,
        'PROCESS': 3,
        'DRAFT': 4,
        'VALIDATED': 5,
        'REJECTED': 6,
        'COMPLETED': 7
    };

    const safeRequests = Array.isArray(requests) ? requests : [];
    const filteredRequests = [...safeRequests].sort((a, b) => {
        const weightA = statusWeight[a?.status] || 99;
        const weightB = statusWeight[b?.status] || 99;
        if (weightA !== weightB) return weightA - weightB;
        const dateA = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
    });

    const totalItems = filteredRequests.length;
    const totalPages = pagination.limit === -1 ? 1 : Math.max(1, Math.ceil(totalItems / pagination.limit));

    const paginatedRequests = pagination.limit === -1
        ? filteredRequests
        : filteredRequests.slice((pagination.page - 1) * pagination.limit, pagination.page * pagination.limit);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-1">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2">
                        <Layers className="text-blue-600" size={26} />
                        Pengadaan Barang & Jasa
                    </h1>
                    <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
                        Daftar paket pengajuan per Judul Pengadaan beserta rincian item & penugasan petugas
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    {selectedIds.length > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm"
                        >
                            <Trash2 size={16} /> Hapus ({selectedIds.length})
                        </button>
                    )}
                    <button
                        onClick={handleExport}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm flex-1 sm:flex-none justify-center transition-all"
                    >
                        <Files size={16} /> Ekspor Excel (Rincian Item)
                    </button>
                    <button
                        onClick={() => navigate('/procurements/new')}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-lg shadow-blue-600/20 flex-1 sm:flex-none justify-center transition-all"
                    >
                        <Plus size={16} /> Buat Pengajuan Baru
                    </button>
                </div>
            </div>

            {/* Dashboard Stats */}
            {!loadingStats && dashboardStats && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 px-1">
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 shadow-lg flex flex-col justify-between hover:scale-[1.02] transition-transform text-white">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-slate-300 font-bold text-xs uppercase tracking-wider">Total Paket</span>
                            <div className="p-1.5 bg-slate-700/60 rounded-lg text-slate-200"><ClipboardList size={18} /></div>
                        </div>
                        <div className="text-3xl font-black">{dashboardStats.total}</div>
                    </div>
                    <div className="bg-white border border-amber-200/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-amber-700 font-bold text-xs uppercase tracking-wider">Menunggu</span>
                            <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600"><Clock size={18} /></div>
                        </div>
                        <div className="text-2xl font-black text-slate-800">{dashboardStats.submitted}</div>
                    </div>
                    <div className="bg-white border border-blue-200/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-blue-700 font-bold text-xs uppercase tracking-wider">Disetujui</span>
                            <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600"><CheckCircle size={18} /></div>
                        </div>
                        <div className="text-2xl font-black text-slate-800">{dashboardStats.approved}</div>
                    </div>
                    <div className="bg-white border border-indigo-200/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-indigo-700 font-bold text-xs uppercase tracking-wider">Diproses</span>
                            <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600"><PackageCheck size={18} /></div>
                        </div>
                        <div className="text-2xl font-black text-slate-800">{dashboardStats.process}</div>
                    </div>
                    <div className="bg-white border border-emerald-200/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-emerald-700 font-bold text-xs uppercase tracking-wider">Selesai</span>
                            <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600"><CheckCircle size={18} /></div>
                        </div>
                        <div className="text-2xl font-black text-slate-800">{dashboardStats.completed}</div>
                    </div>
                    <div className="bg-white border border-red-200/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-red-700 font-bold text-xs uppercase tracking-wider">Ditolak</span>
                            <div className="p-1.5 bg-red-50 rounded-lg text-red-600"><XCircle size={18} /></div>
                        </div>
                        <div className="text-2xl font-black text-slate-800">{dashboardStats.rejected}</div>
                    </div>
                </div>
            )}

            {/* Filter Bar */}
            <div className="flex flex-wrap gap-2.5 sm:gap-4 items-center bg-white p-3.5 sm:p-4 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-2 text-slate-500">
                    <Filter size={16} />
                    <span className="text-xs font-black uppercase tracking-wider">Filter:</span>
                </div>

                <div className="relative flex-1 min-w-[200px] max-w-full sm:max-w-[300px]">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Cari judul, kode, atau item barang..."
                        className="w-full pl-10 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-100 outline-none text-slate-700"
                        value={filter.search || ''}
                        onChange={e => setFilter({ ...filter, search: e.target.value })}
                    />
                </div>

                <select
                    className="border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-100 outline-none text-slate-700"
                    value={filter.categoryId}
                    onChange={e => setFilter({ ...filter, categoryId: e.target.value })}
                >
                    <option value="">Semua Kategori</option>
                    {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>

                <select
                    className="border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-100 outline-none text-slate-700"
                    value={filter.status}
                    onChange={e => setFilter({ ...filter, status: e.target.value })}
                >
                    <option value="">Semua Status</option>
                    <option value="SUBMITTED">Menunggu Validasi</option>
                    <option value="APPROVED">Disetujui</option>
                    <option value="PROCESS">Diproses Petugas</option>
                    <option value="COMPLETED">Selesai</option>
                    <option value="REJECTED">Ditolak</option>
                </select>

                <select
                    className="border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-100 outline-none text-slate-700"
                    value={filter.unitId || ''}
                    onChange={e => setFilter({ ...filter, unitId: e.target.value })}
                >
                    <option value="">Semua Unit</option>
                    {units.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                </select>

                {/* Expand All Toggle */}
                {paginatedRequests.length > 0 && (
                    <button
                        onClick={handleExpandAll}
                        className="px-3 py-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors ml-auto sm:ml-0"
                        title="Buka atau tutup seluruh rincian item pengadaan"
                    >
                        {expandedIds.size === paginatedRequests.length ? 'Tutup Rincian' : 'Buka Semua Rincian'}
                    </button>
                )}

                <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
                    <span className="text-xs text-slate-400 font-bold">Limit:</span>
                    <select
                        className="border border-slate-200 bg-slate-50 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700"
                        value={pagination.limit}
                        onChange={e => setPagination({ ...pagination, limit: parseInt(e.target.value), page: 1 })}
                    >
                        <option value="10">10</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="-1">Semua</option>
                    </select>
                </div>
            </div>

            {/* Desktop Master-Detail Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hidden sm:block">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-600 font-black uppercase text-[11px] tracking-wider border-b border-slate-200">
                        <tr>
                            <th className="p-4 w-12 text-center">
                                <input
                                    type="checkbox"
                                    onChange={handleSelectAll}
                                    checked={paginatedRequests.length > 0 && selectedIds.length === paginatedRequests.length}
                                    className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                            </th>
                            <th className="p-4 w-10"></th>
                            <th className="p-4">Kode & Judul Pengadaan</th>
                            <th className="p-4">Unit & Pemohon</th>
                            <th className="p-4">Rincian Barang</th>
                            <th className="p-4">Petugas Lapangan</th>
                            <th className="p-4 text-center">Status</th>
                            <th className="p-4 text-center">Aksi Cepat</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan="8" className="p-12 text-center text-slate-400">
                                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                    Memuat paket pengadaan...
                                </td>
                            </tr>
                        ) : paginatedRequests.length === 0 ? (
                            <tr>
                                <td colSpan="8" className="p-12 text-center text-slate-400 font-medium">
                                    Belum ada pengajuan pengadaan yang sesuai dengan filter.
                                </td>
                            </tr>
                        ) : (
                            paginatedRequests.map((req) => {
                                const isExpanded = expandedIds.has(req.id);
                                const items = Array.isArray(req.items) ? req.items : [];
                                const totalEst = req.totalEstimatedPrice != null
                                    ? req.totalEstimatedPrice
                                    : items.reduce((s, it) => s + ((it.qty || 1) * (it.estPrice || 0)), 0);
                                const assignees = Array.isArray(req.assignees)
                                    ? req.assignees
                                    : Array.from(new Set(items.filter(i => i && i.assignedTo).map(i => i.assignedTo)));

                                return (
                                    <Fragment key={req.id}>
                                        {/* Master Row: Judul Pengadaan Induk */}
                                        <tr className={`transition-colors hover:bg-slate-50/80 ${isExpanded ? 'bg-blue-50/30' : ''}`}>
                                            <td className="p-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.includes(req.id)}
                                                    onChange={() => handleSelectOne(req.id)}
                                                    className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="p-4 text-center">
                                                <button
                                                    onClick={() => toggleExpandRow(req.id)}
                                                    className={`p-1.5 rounded-lg transition-transform text-slate-400 hover:text-blue-600 hover:bg-blue-50 ${
                                                        isExpanded ? 'bg-blue-100 text-blue-700 rotate-90' : ''
                                                    }`}
                                                    title={isExpanded ? "Tutup rincian item" : "Buka rincian item"}
                                                >
                                                    <ChevronRight size={16} />
                                                </button>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-mono text-xs font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                                        {req.code}
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                                                        req.type === 'ASSET' ? 'border-purple-200 text-purple-700 bg-purple-50' : 'border-amber-200 text-amber-700 bg-amber-50'
                                                    }`}>
                                                        {req.type}
                                                    </span>
                                                </div>
                                                <div 
                                                    onClick={() => toggleExpandRow(req.id)}
                                                    className="font-extrabold text-slate-900 hover:text-blue-600 cursor-pointer line-clamp-1 text-sm"
                                                    title="Klik untuk membuka/menutup rincian item"
                                                >
                                                    {req.title || 'Pengadaan Tanpa Judul'}
                                                </div>
                                                {req.notes && (
                                                    <p className="text-[11px] text-amber-800 italic truncate max-w-xs mt-0.5">
                                                        Catatan: {req.notes}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <div className="font-bold text-slate-800 text-xs">{req.unit?.name || 'Unit Umum'}</div>
                                                <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                                    <User size={12} /> {req.user?.name || req.user?.username || 'Pemohon'}
                                                </div>
                                                <div className="text-[10px] text-slate-400 mt-0.5">
                                                    {new Date(req.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-slate-800 bg-slate-100 border border-slate-200/80 px-2.5 py-1 rounded-lg w-fit">
                                                        <Layers size={13} className="text-blue-600" />
                                                        {items.length || req._count?.items || 0} Item Barang
                                                    </span>
                                                    {totalEst > 0 && (
                                                        <span className="text-[11px] font-extrabold text-emerald-700">
                                                            {formatCurrency(totalEst)}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {assignees.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1 max-w-[180px]">
                                                        {assignees.map((st, idx) => (
                                                            <span key={idx} className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                <User size={10} /> {st}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-[11px] text-slate-400 font-medium italic">
                                                        Belum ditugaskan
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide border ${
                                                    req.status === 'SUBMITTED' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                    req.status === 'APPROVED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                    req.status === 'PROCESS' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                                    req.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                    'bg-red-50 text-red-600 border-red-200'
                                                }`}>
                                                    {req.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    {/* Surat Permohonan Button */}
                                                    <button
                                                        onClick={() => handleOpenLetter(req.id)}
                                                        disabled={loadingLetterId === req.id}
                                                        className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all border border-slate-200 hover:border-emerald-300"
                                                        title="Lihat / Cetak Surat Permohonan Resmi Unit"
                                                    >
                                                        {loadingLetterId === req.id ? (
                                                            <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                                                        ) : (
                                                            <FileText size={16} />
                                                        )}
                                                    </button>
                                                    {/* Detail Page Button */}
                                                    <button
                                                        onClick={() => navigate(`/procurements/${req.id}`)}
                                                        className="p-2 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-all border border-slate-200 hover:border-blue-300"
                                                        title="Buka Lembar Detail Pengadaan"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    {/* Delete Button */}
                                                    <button
                                                        onClick={() => handleDelete(req.id)}
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-slate-200 hover:border-red-300"
                                                        title="Hapus Pengadaan"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Detail Sub-Row (Expanded Accordion) */}
                                        {isExpanded && (
                                            <tr className="bg-slate-50/70 border-b border-slate-200">
                                                <td colSpan="8" className="p-4 pl-14 pr-6">
                                                    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4 animate-in fade-in">
                                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
                                                            <div className="flex items-center gap-2">
                                                                <Layers className="text-blue-600" size={18} />
                                                                <h4 className="font-extrabold text-sm text-slate-800">
                                                                    Rincian Item Permintaan ({items.length} Barang)
                                                                </h4>
                                                                <span className="text-xs text-slate-400">
                                                                    • Di bawah Surat Permohonan yang sama
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => handleOpenLetter(req.id)}
                                                                    className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                                                                >
                                                                    <FileText size={14} /> Pratinjau Surat Permohonan
                                                                </button>
                                                                <button
                                                                    onClick={() => navigate(`/procurements/${req.id}`)}
                                                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                                                                >
                                                                    Kelola & Penugasan Staf <ExternalLink size={13} />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Nested Item Table */}
                                                        {items.length === 0 ? (
                                                            <p className="text-xs text-slate-400 italic py-2">
                                                                Tidak ada rincian item dalam paket pengajuan ini.
                                                            </p>
                                                        ) : (
                                                            <div className="overflow-x-auto rounded-xl border border-slate-100">
                                                                <table className="w-full text-xs text-left">
                                                                    <thead className="bg-slate-100/70 text-slate-600 font-bold uppercase text-[10px]">
                                                                        <tr>
                                                                            <th className="p-3 w-8 text-center">No</th>
                                                                            <th className="p-3">Nama Barang & Spesifikasi</th>
                                                                            <th className="p-3 text-center">Kuantitas</th>
                                                                            <th className="p-3">Kategori</th>
                                                                            <th className="p-3 text-right">Estimasi Satuan</th>
                                                                            <th className="p-3 text-right">Total Estimasi</th>
                                                                            <th className="p-3">Sumber Dana</th>
                                                                            <th className="p-3">Petugas Penanggung Jawab</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-100 bg-white">
                                                                        {items.map((it, idx) => {
                                                                            const itemTotal = (it.qty || 1) * (it.estPrice || 0);
                                                                            const staffName = it.assignedToUser?.name || it.assignedTo;

                                                                            return (
                                                                                <tr key={it.id || idx} className="hover:bg-slate-50/50">
                                                                                    <td className="p-3 text-center font-bold text-slate-400">
                                                                                        {idx + 1}
                                                                                    </td>
                                                                                    <td className="p-3">
                                                                                        <p className="font-bold text-slate-800">{it.name}</p>
                                                                                        {it.spec && (
                                                                                            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{it.spec}</p>
                                                                                        )}
                                                                                    </td>
                                                                                    <td className="p-3 text-center font-bold text-slate-700">
                                                                                        {it.qty} {it.unit}
                                                                                    </td>
                                                                                    <td className="p-3 text-slate-600">
                                                                                        {it.category?.name || '-'}
                                                                                    </td>
                                                                                    <td className="p-3 text-right font-medium text-slate-600">
                                                                                        {formatCurrency(it.estPrice)}
                                                                                    </td>
                                                                                    <td className="p-3 text-right font-black text-slate-800">
                                                                                        {formatCurrency(itemTotal)}
                                                                                    </td>
                                                                                    <td className="p-3">
                                                                                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold">
                                                                                            {it.fundingSource || 'Yayasan'}
                                                                                        </span>
                                                                                    </td>
                                                                                    <td className="p-3">
                                                                                        {staffName ? (
                                                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-bold text-[11px]">
                                                                                                <CheckCircle size={12} className="text-emerald-600" />
                                                                                                {staffName}
                                                                                            </span>
                                                                                        ) : (
                                                                                            <span className="inline-flex items-center gap-1 text-slate-400 text-[11px] italic">
                                                                                                <Clock size={12} /> Belum dipilih
                                                                                            </span>
                                                                                        )}
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}

                                                        {/* Sub-table Footer */}
                                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-2 text-xs text-slate-500">
                                                            <div className="flex items-center gap-4">
                                                                <span>Total Volume: <strong className="text-slate-800">{items.reduce((s, i) => s + (i.qty || 0), 0)} unit</strong></span>
                                                                <span>Total Anggaran: <strong className="text-emerald-700 font-black">{formatCurrency(totalEst)}</strong></span>
                                                            </div>
                                                            <span className="text-[11px] text-slate-400">
                                                                Petugas yang sama dapat ditugaskan ke beberapa item sekaligus pada menu kelola.
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card Layout with Accordion Item Drawer */}
            <div className="block sm:hidden space-y-3">
                {loading ? (
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center text-slate-500">
                        Loading data...
                    </div>
                ) : paginatedRequests.length === 0 ? (
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center text-slate-500">
                        Belum ada request pengadaan.
                    </div>
                ) : (
                    paginatedRequests.map((req) => {
                        const isExpanded = expandedIds.has(req.id);
                        const items = Array.isArray(req.items) ? req.items : [];
                        const totalEst = req.totalEstimatedPrice != null
                            ? req.totalEstimatedPrice
                            : items.reduce((s, it) => s + ((it.qty || 1) * (it.estPrice || 0)), 0);

                        return (
                            <div key={req.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono text-xs font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded border">
                                            {req.code}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                                            req.type === 'ASSET' ? 'border-purple-200 text-purple-700 bg-purple-50' : 'border-amber-200 text-amber-700 bg-amber-50'
                                        }`}>
                                            {req.type}
                                        </span>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                        req.status === 'SUBMITTED' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                        req.status === 'APPROVED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                        req.status === 'PROCESS' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                        req.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                        'bg-red-50 text-red-600 border-red-200'
                                    }`}>
                                        {req.status}
                                    </span>
                                </div>

                                <div>
                                    <h4 className="font-extrabold text-sm text-slate-900 leading-snug">{req.title || '-'}</h4>
                                    <p className="text-xs text-slate-500 mt-0.5">{req.unit?.name} • {req.user?.username}</p>
                                </div>

                                <div className="flex items-center justify-between text-xs py-2 px-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="font-bold text-slate-700">{items.length} Item Barang</span>
                                    {totalEst > 0 && <span className="font-black text-emerald-700">{formatCurrency(totalEst)}</span>}
                                </div>

                                {/* Toggle Expand Items */}
                                <button
                                    onClick={() => toggleExpandRow(req.id)}
                                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 transition-colors"
                                >
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    {isExpanded ? 'Tutup Rincian Item' : `Lihat ${items.length} Item Barang`}
                                </button>

                                {/* Expanded Mobile Items */}
                                {isExpanded && (
                                    <div className="space-y-2 pt-2 border-t border-slate-100 animate-in fade-in">
                                        {items.map((it, idx) => (
                                            <div key={idx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70 text-xs space-y-1">
                                                <div className="flex justify-between items-start">
                                                    <span className="font-bold text-slate-800">{idx + 1}. {it.name}</span>
                                                    <span className="font-bold text-slate-700">{it.qty} {it.unit}</span>
                                                </div>
                                                <div className="flex justify-between text-[11px] text-slate-500">
                                                    <span>Petugas: <strong className="text-slate-700">{it.assignedTo || it.assignedToUser?.name || 'Belum'}</strong></span>
                                                    <span className="font-bold text-emerald-700">{formatCurrency((it.qty || 1) * (it.estPrice || 0))}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Action Buttons Mobile */}
                                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                    <button
                                        onClick={() => handleOpenLetter(req.id)}
                                        className="flex-1 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200 flex items-center justify-center gap-1"
                                    >
                                        <FileText size={14} /> Surat Permohonan
                                    </button>
                                    <button
                                        onClick={() => navigate(`/procurements/${req.id}`)}
                                        className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1"
                                    >
                                        Detail <ExternalLink size={13} />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Pagination Controls */}
            {pagination.limit !== -1 && totalPages > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-slate-500 font-bold px-1">
                    <div>
                        Menampilkan {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, totalItems)} dari {totalItems} paket pengadaan
                    </div>
                    <div className="flex gap-1">
                        <button
                            disabled={pagination.page === 1}
                            onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                            className="px-3 py-1.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-50"
                        >
                            Prev
                        </button>
                        {[...Array(totalPages)].map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setPagination({ ...pagination, page: i + 1 })}
                                className={`px-3 py-1.5 rounded-xl border ${
                                    pagination.page === i + 1 
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                                        : 'bg-white border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                {i + 1}
                            </button>
                        ))}
                        <button
                            disabled={pagination.page === totalPages}
                            onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                            className="px-3 py-1.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* Procurement Request Letter Modal */}
            {selectedLetterData && (
                <ProcurementLetterModal
                    isOpen={showLetterModal}
                    onClose={() => {
                        setShowLetterModal(false);
                        setSelectedLetterData(null);
                    }}
                    letterData={selectedLetterData}
                    procurementId={selectedLetterData?.procurementId}
                    isKabidUser={isKabid}
                    onUpdated={() => {
                        fetchRequests();
                    }}
                />
            )}
        </div>
    );
};

export default ProcurementList;

