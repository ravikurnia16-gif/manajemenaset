import React, { useState, useEffect } from 'react';
import {
    Kanban,
    List,
    Building2,
    Search,
    Filter,
    HardHat,
    Cog,
    Clock,
    CheckCircle2,
    Activity,
    Plus,
    Calendar,
    ArrowRight,
    ArrowLeft,
    Eye,
    ChevronRight,
    AlertTriangle,
    SlidersHorizontal,
    RefreshCw,
    Boxes,
    FileSpreadsheet,
    X
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../../lib/axios';
import Swal from 'sweetalert2';

function WorkshopBaruBoard() {
    const navigate = useNavigate();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const initialType = queryParams.get('type') || '';
    const initialPriority = queryParams.get('priority') || '';
    const initialView = queryParams.get('view') === 'byUnit' ? 'byUnit' : (queryParams.get('view') || 'kanban');

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState(initialView); // 'kanban' | 'table' | 'byUnit'

    useEffect(() => {
        const viewParam = new URLSearchParams(location.search).get('view');
        if (viewParam === 'byUnit' || viewParam === 'table' || viewParam === 'kanban') {
            setViewMode(viewParam);
        }
    }, [location.search]);

    // Filters
    const [filterType, setFilterType] = useState(initialType);
    const [filterPriority, setFilterPriority] = useState(initialPriority);
    const [filterStatus, setFilterStatus] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Quick Percentage Modal State
    const [percentModal, setPercentModal] = useState(false);
    const [targetOrder, setTargetOrder] = useState(null);
    const [percentVal, setPercentVal] = useState(25);
    const [percentNote, setPercentNote] = useState('');

    useEffect(() => {
        fetchOrders();
    }, [filterType, filterPriority, filterStatus]);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filterType) params.append('type', filterType);
            if (filterPriority) params.append('priority', filterPriority);
            if (filterStatus) params.append('status', filterStatus);

            const res = await api.get(`/workshop/orders?${params.toString()}`);
            setOrders(res.data || []);
        } catch (error) {
            console.error('Error fetching workshop orders:', error);
            Swal.fire('Error', 'Gagal memuat antrean workshop.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const filteredOrders = orders.filter(o => {
        const term = searchTerm.toLowerCase();
        return (
            (o.title || '').toLowerCase().includes(term) ||
            (o.code || '').toLowerCase().includes(term) ||
            (o.requestedBy?.name || '').toLowerCase().includes(term) ||
            (o.unit?.name || '').toLowerCase().includes(term)
        );
    });

    // Grouping by Unit for 'byUnit' view
    const ordersByUnit = filteredOrders.reduce((acc, order) => {
        const unitName = order.unit?.name || 'Unit Umum / Tanpa Unit';
        if (!acc[unitName]) acc[unitName] = [];
        acc[unitName].push(order);
        return acc;
    }, {});

    // Grouping by Kanban Columns
    const columns = [
        {
            id: 'PENDING',
            title: 'Antrean Masuk',
            subtitle: 'Menunggu diverifikasi / diproses',
            badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
            headerBg: 'bg-amber-500/10 text-amber-700 border-amber-200',
            statuses: ['PENDING', 'DRAFT']
        },
        {
            id: 'IN_PROGRESS',
            title: 'Pengerjaan Bengkel',
            subtitle: 'Sedang dikerjakan tukang',
            badgeBg: 'bg-blue-100 text-blue-800 border-blue-200',
            headerBg: 'bg-blue-500/10 text-blue-700 border-blue-200',
            statuses: ['IN_PROGRESS']
        },
        {
            id: 'QUALITY_CHECK',
            title: 'Pemeriksaan QC',
            subtitle: 'Pengecekan kualitas & finishing',
            badgeBg: 'bg-purple-100 text-purple-800 border-purple-200',
            headerBg: 'bg-purple-500/10 text-purple-700 border-purple-200',
            statuses: ['QUALITY_CHECK']
        },
        {
            id: 'COMPLETED',
            title: 'Selesai',
            subtitle: 'Siap diserahterimakan',
            badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
            headerBg: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
            statuses: ['COMPLETED']
        }
    ];

    const openPercentModal = (e, order) => {
        e.stopPropagation();
        setTargetOrder(order);
        setPercentVal(order.currentPercentage ?? (order.status === 'PENDING' ? 15 : 25));
        setPercentNote('');
        setPercentModal(true);
    };

    const handleStartWork = (e, order) => {
        e.stopPropagation();
        setTargetOrder(order);
        setPercentVal(15);
        setPercentNote('Mulai pengerjaan di bengkel Unit 21.');
        setPercentModal(true);
    };

    const handleSavePercent = async (e) => {
        e.preventDefault();
        if (!targetOrder) return;
        try {
            if (targetOrder.status === 'PENDING') {
                await api.put(`/workshop/orders/${targetOrder.id}/status`, {
                    status: 'IN_PROGRESS',
                    percentage: parseInt(percentVal, 10),
                    message: percentNote || `Pekerjaan dimulai (Progres: ${percentVal}%).`
                });
            } else {
                await api.post(`/workshop/orders/${targetOrder.id}/progress`, {
                    percentage: parseInt(percentVal, 10),
                    message: percentNote || `Update progres fisik pengerjaan: ${percentVal}%`
                });
            }
            Swal.fire('Berhasil', `Persentase progres berhasil diperbarui ke ${percentVal}%.`, 'success');
            setPercentModal(false);
            fetchOrders();
        } catch (err) {
            Swal.fire('Gagal', err.response?.data?.error || 'Gagal mengubah progres', 'error');
        }
    };

    const handleQuickStatus = async (e, orderId, nextStatus, nextLabel) => {
        e.stopPropagation();
        const result = await Swal.fire({
            title: `${nextLabel}?`,
            text: `Ubah status pesanan ke ${nextLabel}?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#059669',
            cancelButtonColor: '#94a3b8',
            confirmButtonText: 'Ya, Lanjutkan',
            cancelButtonText: 'Batal'
        });

        if (result.isConfirmed) {
            try {
                await api.put(`/workshop/orders/${orderId}/status`, {
                    status: nextStatus,
                    message: `Status diubah menjadi ${nextLabel} melalui Papan Kerja Unit 21.`
                });
                Swal.fire('Berhasil', 'Status pesanan berhasil diperbarui.', 'success');
                fetchOrders();
            } catch (err) {
                Swal.fire('Gagal', err.response?.data?.error || 'Gagal mengubah status', 'error');
            }
        }
    };

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
            {/* Top Navigation & Title */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/workshop-baru/dashboard')}
                        className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                        title="Kembali ke Dashboard"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2">
                            <Kanban className="text-emerald-600" size={24} /> Papan Kerja Workshop Unit 21
                        </h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Pantau seluruh alur antrean pengerjaan fisik kayu & besi secara terpusat
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* View Switcher */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button
                            onClick={() => setViewMode('kanban')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                viewMode === 'kanban'
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <Kanban size={14} /> Kanban
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                viewMode === 'table'
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <List size={14} /> Tabel
                        </button>
                        <button
                            onClick={() => setViewMode('byUnit')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                viewMode === 'byUnit'
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <Building2 size={14} /> Per Unit
                        </button>
                    </div>

                    <button
                        onClick={fetchOrders}
                        className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                        title="Segarkan data"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>

                    <Link
                        to="/workshop-baru/catalog"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-sm transition-colors"
                        title="Katalog Produk Workshop"
                    >
                        <Boxes size={15} /> Katalog
                    </Link>

                    <Link
                        to="/workshop-baru/export"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-sm transition-colors"
                        title="Ekspor Pekerjaan ke PDF/Excel"
                    >
                        <FileSpreadsheet size={15} /> Ekspor
                    </Link>

                    <Link
                        to="/workshop-baru/orders/new"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors"
                    >
                        <Plus size={16} /> Buat Pesanan Baru
                    </Link>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Workshop Type Tabs */}
                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                        <button
                            onClick={() => setFilterType('')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                filterType === ''
                                    ? 'bg-slate-800 text-white shadow-sm'
                                    : 'text-slate-600 hover:bg-slate-200/60'
                            }`}
                        >
                            Semua Workshop
                        </button>
                        <button
                            onClick={() => setFilterType('KAYU')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                filterType === 'KAYU'
                                    ? 'bg-orange-600 text-white shadow-sm'
                                    : 'text-orange-700 hover:bg-orange-100'
                            }`}
                        >
                            <HardHat size={14} /> Workshop Kayu
                        </button>
                        <button
                            onClick={() => setFilterType('BESI')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                filterType === 'BESI'
                                    ? 'bg-slate-700 text-white shadow-sm'
                                    : 'text-slate-700 hover:bg-slate-200'
                            }`}
                        >
                            <Cog size={14} /> Workshop Besi
                        </button>
                    </div>

                    {/* Search box */}
                    <div className="relative flex-1 min-w-[220px] max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Cari kode, judul, unit pemesan..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50/50 focus:bg-white transition-colors"
                        />
                    </div>
                </div>

                {/* Secondary Filters */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
                    <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider mr-1 flex items-center gap-1">
                        <Filter size={12} /> Filter:
                    </span>

                    <select
                        value={filterPriority}
                        onChange={(e) => setFilterPriority(e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs outline-none focus:border-emerald-500"
                    >
                        <option value="">Semua Prioritas</option>
                        <option value="URGENT">🚨 URGENT</option>
                        <option value="HIGH">⚡ TINGGI (HIGH)</option>
                        <option value="NORMAL">NORMAL</option>
                        <option value="LOW">RENDAH (LOW)</option>
                    </select>

                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs outline-none focus:border-emerald-500"
                    >
                        <option value="">Semua Status</option>
                        <option value="PENDING">Antrean Masuk (PENDING)</option>
                        <option value="IN_PROGRESS">Sedang Dikerjakan (IN_PROGRESS)</option>
                        <option value="QUALITY_CHECK">Pemeriksaan QC</option>
                        <option value="COMPLETED">Selesai (COMPLETED)</option>
                        <option value="CANCELLED">Dibatalkan (CANCELLED)</option>
                    </select>

                    {(filterType || filterPriority || filterStatus || searchTerm) && (
                        <button
                            onClick={() => {
                                setFilterType('');
                                setFilterPriority('');
                                setFilterStatus('');
                                setSearchTerm('');
                            }}
                            className="text-xs text-rose-600 hover:text-rose-800 font-medium ml-auto"
                        >
                            Reset Filter
                        </button>
                    )}
                </div>
            </div>

            {/* Content: Kanban View */}
            {viewMode === 'kanban' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
                    {columns.map(col => {
                        const colOrders = filteredOrders.filter(o => col.statuses.includes(o.status));
                        return (
                            <div key={col.id} className="bg-slate-100/80 rounded-2xl p-3 border border-slate-200/70 flex flex-col min-h-[500px]">
                                {/* Column Header */}
                                <div className={`p-3 rounded-xl border ${col.headerBg} mb-3 flex items-center justify-between`}>
                                    <div>
                                        <h3 className="font-extrabold text-xs tracking-wider uppercase">{col.title}</h3>
                                        <p className="text-[10px] text-slate-500">{col.subtitle}</p>
                                    </div>
                                    <span className="w-6 h-6 rounded-full bg-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                                        {colOrders.length}
                                    </span>
                                </div>

                                {/* Order Cards in Column */}
                                <div className="space-y-3 flex-1 overflow-y-auto max-h-[70vh] pr-0.5">
                                    {colOrders.map(order => {
                                        const isOverdue = order.deadline && new Date(order.deadline) < new Date() && order.status !== 'COMPLETED';

                                        return (
                                            <div
                                                key={order.id}
                                                onClick={() => navigate(`/workshop-baru/orders/${order.id}`)}
                                                className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs hover:shadow-md cursor-pointer transition-all hover:border-emerald-400 group relative"
                                            >
                                                {/* Top tags */}
                                                <div className="flex items-center justify-between text-[10px] mb-1.5">
                                                    <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                                                        {order.code}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <span className={`px-1.5 py-0.5 rounded font-bold ${
                                                            order.workshopType === 'KAYU'
                                                                ? 'bg-orange-100 text-orange-700'
                                                                : 'bg-slate-200 text-slate-700'
                                                        }`}>
                                                            {order.workshopType === 'KAYU' ? '🪵 Kayu' : (order.workshopType === 'BESI' ? '⚙️ Besi' : 'Umum')}
                                                        </span>
                                                        {order.priority === 'URGENT' && (
                                                            <span className="px-1.5 py-0.5 rounded font-bold bg-rose-100 text-rose-700">
                                                                URGENT
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Title */}
                                                <h4 className="text-xs font-bold text-slate-900 line-clamp-2 group-hover:text-emerald-700 transition-colors">
                                                    {order.title}
                                                </h4>

                                                {/* Unit & Requester */}
                                                <p className="text-[11px] text-slate-500 mt-1">
                                                    Dari: <strong className="text-slate-700">{order.unit?.name || order.requestedBy?.name || '-'}</strong>
                                                </p>

                                                {/* Deadline Alert */}
                                                <div className={`mt-2 flex items-center gap-1 text-[10px] ${
                                                    isOverdue ? 'text-rose-600 font-bold' : 'text-slate-400'
                                                }`}>
                                                    <Calendar size={11} />
                                                    Target: {order.deadline ? new Date(order.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : 'Tidak ada'}
                                                    {isOverdue && ' (Lewat Batas)'}
                                                </div>

                                                {/* Items summary */}
                                                {order.items && order.items.length > 0 && (
                                                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                                                        <span>{order.items.length} Barang/Pekerjaan</span>
                                                        {order.picName && (
                                                            <span className="font-medium text-slate-600 truncate max-w-[110px]" title={order.picName}>
                                                                PIC: {order.picName}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Progress Bar on Kanban Card for IN_PROGRESS */}
                                                {order.status === 'IN_PROGRESS' && (
                                                    <div className="mt-2.5 pt-2 border-t border-slate-100">
                                                        <div className="flex items-center justify-between text-[11px] mb-1">
                                                            <span className="text-slate-500 font-semibold flex items-center gap-1">
                                                                <SlidersHorizontal size={11} className="text-blue-500" /> Progres Fisik
                                                            </span>
                                                            <span className="font-mono font-black text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/80">
                                                                {order.currentPercentage ?? 0}%
                                                            </span>
                                                        </div>
                                                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-300"
                                                                style={{ width: `${Math.min(100, Math.max(0, order.currentPercentage ?? 0))}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Quick Next Stage Action Button */}
                                                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                                                    <span className="text-[10px] font-semibold text-emerald-600 group-hover:underline flex items-center gap-0.5">
                                                        Detail <ChevronRight size={12} />
                                                    </span>

                                                    {order.status === 'PENDING' && (
                                                        <button
                                                            onClick={(e) => handleStartWork(e, order)}
                                                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-bold transition-colors"
                                                        >
                                                            Mulai Pengerjaan →
                                                        </button>
                                                    )}
                                                    {order.status === 'IN_PROGRESS' && (
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={(e) => openPercentModal(e, order)}
                                                                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-bold transition-colors flex items-center gap-1"
                                                                title="Update Persentase Progres"
                                                            >
                                                                <SlidersHorizontal size={10} /> Update %
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleQuickStatus(e, order.id, 'QUALITY_CHECK', 'Pemeriksaan QC')}
                                                                className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded text-[10px] font-bold transition-colors"
                                                            >
                                                                Uji QC →
                                                            </button>
                                                        </div>
                                                    )}
                                                    {order.status === 'QUALITY_CHECK' && (
                                                        <button
                                                            onClick={(e) => handleQuickStatus(e, order.id, 'COMPLETED', 'Selesaikan')}
                                                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold transition-colors"
                                                        >
                                                            Selesai ✓
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {colOrders.length === 0 && (
                                        <div className="h-32 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-400 text-xs">
                                            Kosong
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Content: Table View */}
            {viewMode === 'table' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                                <tr>
                                    <th className="p-3.5">Kode & Tipe</th>
                                    <th className="p-3.5">Judul Pesanan</th>
                                    <th className="p-3.5">Pemohon (Unit)</th>
                                    <th className="p-3.5">Prioritas</th>
                                    <th className="p-3.5">Target Selesai</th>
                                    <th className="p-3.5">PIC</th>
                                    <th className="p-3.5">Status</th>
                                    <th className="p-3.5 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredOrders.map(order => (
                                    <tr
                                        key={order.id}
                                        onClick={() => navigate(`/workshop-baru/orders/${order.id}`)}
                                        className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                                    >
                                        <td className="p-3.5">
                                            <div className="font-mono font-bold text-slate-800">{order.code}</div>
                                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-1 ${
                                                order.workshopType === 'KAYU' ? 'bg-orange-100 text-orange-800' : 'bg-slate-200 text-slate-800'
                                            }`}>
                                                {order.workshopType || 'UMUM'}
                                            </span>
                                        </td>
                                        <td className="p-3.5 font-semibold text-slate-800 max-w-xs truncate">
                                            {order.title}
                                        </td>
                                        <td className="p-3.5 text-slate-600">
                                            <div className="font-medium text-slate-800">{order.unit?.name || '-'}</div>
                                            <div className="text-[11px] text-slate-400">{order.requestedBy?.name || '-'}</div>
                                        </td>
                                        <td className="p-3.5">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                                order.priority === 'URGENT' ? 'bg-rose-100 text-rose-700' :
                                                order.priority === 'HIGH' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                                {order.priority}
                                            </span>
                                        </td>
                                        <td className="p-3.5 text-slate-600">
                                            {order.deadline ? new Date(order.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                        </td>
                                        <td className="p-3.5 text-slate-700 font-medium">
                                            {order.picName || '-'}
                                        </td>
                                        <td className="p-3.5">
                                            {order.status === 'IN_PROGRESS' ? (
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-blue-100 text-blue-800 border-blue-200">
                                                            Dikerjakan
                                                        </span>
                                                        <button
                                                            onClick={(e) => openPercentModal(e, order)}
                                                            className="font-mono text-[11px] font-black text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200 flex items-center gap-0.5"
                                                            title="Klik untuk ubah persentase"
                                                        >
                                                            {order.currentPercentage ?? 0}% <SlidersHorizontal size={10} />
                                                        </button>
                                                    </div>
                                                    <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-blue-600 rounded-full"
                                                            style={{ width: `${Math.min(100, Math.max(0, order.currentPercentage ?? 0))}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                                    order.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                                                    order.status === 'QUALITY_CHECK' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                                                    'bg-amber-100 text-amber-800 border-amber-200'
                                                }`}>
                                                    {order.status}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3.5 text-right">
                                            <Link
                                                to={`/workshop-baru/orders/${order.id}`}
                                                className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-800 font-bold"
                                            >
                                                Lihat <ChevronRight size={14} />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}

                                {filteredOrders.length === 0 && (
                                    <tr>
                                        <td colSpan="8" className="p-8 text-center text-slate-400">
                                            Tidak ada pesanan workshop yang cocok dengan filter.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Content: View By Unit */}
            {viewMode === 'byUnit' && (
                <div className="space-y-6">
                    {Object.keys(ordersByUnit).length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                            Tidak ada pesanan workshop yang cocok dengan filter.
                        </div>
                    ) : (
                        Object.entries(ordersByUnit).map(([unitName, unitOrders]) => {
                            const inProgressCount = unitOrders.filter(o => o.status === 'IN_PROGRESS').length;
                            const completedCount = unitOrders.filter(o => o.status === 'COMPLETED').length;
                            const pendingCount = unitOrders.filter(o => o.status === 'PENDING').length;

                            return (
                                <div key={unitName} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                                    {/* Unit Header */}
                                    <div className="bg-slate-50/80 p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                                                <Building2 size={16} />
                                            </div>
                                            <div>
                                                <h3 className="font-extrabold text-slate-800 text-sm">{unitName}</h3>
                                                <p className="text-[11px] text-slate-500">
                                                    Total {unitOrders.length} pekerjaan workshop
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {pendingCount > 0 && (
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                                    {pendingCount} Antrean
                                                </span>
                                            )}
                                            {inProgressCount > 0 && (
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                                    {inProgressCount} Dikerjakan
                                                </span>
                                            )}
                                            {completedCount > 0 && (
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                    {completedCount} Selesai
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Orders List for this Unit */}
                                    <div className="divide-y divide-slate-100">
                                        {unitOrders.map(order => (
                                            <div
                                                key={order.id}
                                                onClick={() => navigate(`/workshop-baru/orders/${order.id}`)}
                                                className="p-4 hover:bg-slate-50/80 cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                            >
                                                <div className="space-y-1 min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                            {order.code}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                            order.workshopType === 'KAYU' ? 'bg-orange-100 text-orange-800' : 'bg-slate-200 text-slate-800'
                                                        }`}>
                                                            {order.workshopType === 'KAYU' ? '🪵 Kayu' : '⚙️ Besi'}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                                            order.priority === 'URGENT' ? 'bg-rose-100 text-rose-700' :
                                                            order.priority === 'HIGH' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                                                        }`}>
                                                            {order.priority}
                                                        </span>
                                                    </div>
                                                    <h4 className="font-bold text-slate-900 text-sm truncate">{order.title}</h4>
                                                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                                        <span>Pemohon: {order.requestedBy?.name || '-'}</span>
                                                        {order.deadline && (
                                                            <span>• Target: {new Date(order.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                                                        )}
                                                        {order.picName && <span>• PIC: {order.picName}</span>}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 shrink-0 sm:self-center">
                                                    {/* Progress Indicator */}
                                                    <div className="w-32">
                                                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 mb-1">
                                                            <span>Progres</span>
                                                            <span>{order.currentPercentage ?? (order.status === 'COMPLETED' ? 100 : 0)}%</span>
                                                        </div>
                                                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all ${
                                                                    order.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-blue-600'
                                                                }`}
                                                                style={{ width: `${Math.min(100, Math.max(0, order.currentPercentage ?? (order.status === 'COMPLETED' ? 100 : 0)))}%` }}
                                                            />
                                                        </div>
                                                    </div>

                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 ${
                                                        order.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                                                        order.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                                        order.status === 'QUALITY_CHECK' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                                                        'bg-amber-100 text-amber-800 border-amber-200'
                                                    }`}>
                                                        {order.status}
                                                    </span>

                                                    <Link
                                                        to={`/workshop-baru/orders/${order.id}`}
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                                        title="Buka Detail"
                                                    >
                                                        <ChevronRight size={18} />
                                                    </Link>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* --- MODAL: Quick Update Persentase Progres --- */}
            {percentModal && targetOrder && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl animate-in fade-in zoom-in duration-150">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                                    <SlidersHorizontal size={16} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-sm">
                                        {targetOrder.status === 'PENDING' ? 'Mulai Pengerjaan Workshop' : 'Update Persentase Progres'}
                                    </h3>
                                    <p className="text-[11px] text-slate-500 font-mono truncate max-w-[280px]">
                                        {targetOrder.code} • {targetOrder.title}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setPercentModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSavePercent} className="space-y-4 text-xs">
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-3">
                                <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                                    Persentase Kemajuan Fisik
                                </div>
                                <div className="text-4xl font-black text-blue-600 font-mono tracking-tight">
                                    {percentVal}%
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="5"
                                    value={percentVal}
                                    onChange={e => setPercentVal(parseInt(e.target.value, 10))}
                                    className="w-full accent-blue-600 cursor-pointer h-2.5 bg-slate-200 rounded-lg appearance-none"
                                />
                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                                    {[10, 25, 50, 75, 90, 100].map(val => (
                                        <button
                                            key={val}
                                            type="button"
                                            onClick={() => setPercentVal(val)}
                                            className={`py-1 rounded-lg text-xs font-bold border transition-all ${
                                                percentVal === val
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                            }`}
                                        >
                                            {val}%
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="font-bold text-slate-700 block mb-1">Catatan Pengerjaan (Opsional)</label>
                                <textarea
                                    rows={2}
                                    value={percentNote}
                                    onChange={e => setPercentNote(e.target.value)}
                                    placeholder={`Contoh: Progres ${percentVal}%, pengerjaan pemotongan & perakitan material...`}
                                    className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setPercentModal(false)}
                                    className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 font-semibold"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm"
                                >
                                    Simpan Persentase
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WorkshopBaruBoard;
