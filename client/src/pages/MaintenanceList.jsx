import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Plus, Search, Filter, Trash2, Eye, Wrench, Calendar, AlertCircle, Download, ChevronLeft, ChevronRight, BarChart2, Clock, CheckCircle } from 'lucide-react';
import api from '../lib/axios';
import * as XLSX from 'xlsx';
import MaintenanceDashboard from '../components/MaintenanceDashboard';

const statusColors = {
    SUBMITTED: 'bg-blue-100 text-blue-700',
    APPROVED: 'bg-cyan-100 text-cyan-700',
    VALIDATED: 'bg-indigo-100 text-indigo-700',
    ASSIGNED: 'bg-yellow-100 text-yellow-700',
    COMPLETED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700'
};

const statusLabels = {
    SUBMITTED: 'Diajukan',
    APPROVED: 'Disetujui',
    ASSIGNED: 'Ditugaskan',
    COMPLETED: 'Selesai',
    REJECTED: 'Ditolak'
};

const urgencyLabels = {
    NORMAL: 'Biasa',
    URGENT: 'Penting',
    EMERGENCY: 'Darurat'
};

const urgencyColors = {
    NORMAL: 'text-slate-400 bg-slate-50 border-slate-100',
    URGENT: 'text-amber-600 bg-amber-50 border-amber-100',
    EMERGENCY: 'text-red-600 bg-red-50 border-red-100'
};

const MaintenanceList = () => {
    const [reports, setReports] = useState([]);
    const [schedule, setSchedule] = useState([]);
    const [selectedScheduleIds, setSelectedScheduleIds] = useState([]);
    const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1, limit: 10 });
    const [loading, setLoading] = useState(true);
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isDashboardAuthorized = ['SUPER_ADMIN', 'ADMIN_ASET'].includes(user.role);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [targetDeptFilter, setTargetDeptFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [limit, setLimit] = useState(10);
    const [page, setPage] = useState(1);
    const [activeTab, setActiveTab] = useState('list'); // 'dashboard', 'schedule', 'list'
    const navigate = useNavigate();
    const location = useLocation();

    // Get category and targetDept from query param
    const queryParams = new URLSearchParams(location.search);
    const categoryFromUrl = queryParams.get('category');
    const targetDeptFromUrl = queryParams.get('targetDept');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1); // Reset to page 1 on new search
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const fetchReports = async () => {
        try {
            setLoading(true);
            const params = {
                page,
                limit,
                search: debouncedSearch,
                status: statusFilter,
                type: typeFilter,
                targetDept: targetDeptFilter,
                category: categoryFromUrl,
                startDate,
                endDate
            };
            const res = await api.get('/maintenance', { params });
            setReports(res.data.data || []);
            setMeta(res.data.meta || { total: 0, page: 1, totalPages: 1, limit: 10 });
        } catch (err) {
            console.error(err);
            setReports([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchSchedule = async () => {
        try {
            setLoading(true);
            const res = await api.get('/maintenance/schedule');
            setSchedule(res.data || []);
        } catch (err) {
            console.error(err);
            setSchedule([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (targetDeptFromUrl) setTargetDeptFilter(targetDeptFromUrl);
    }, [targetDeptFromUrl]);

    useEffect(() => {
        if (activeTab === 'list') {
            fetchReports();
        } else if (activeTab === 'schedule') {
            fetchSchedule();
        }
    }, [activeTab, statusFilter, typeFilter, targetDeptFilter, categoryFromUrl, debouncedSearch, page, limit, startDate, endDate]);

    // Group schedule by Unit
    const groupedSchedule = schedule.reduce((acc, item) => {
        const unitName = item.unit?.name || 'Tanpa Unit';
        if (!acc[unitName]) acc[unitName] = [];
        acc[unitName].push(item);
        return acc;
    }, {});

    const scheduleStats = {
        overdue: schedule.filter(i => i.serviceStatus === 'OVERDUE').length,
        soon: schedule.filter(i => i.serviceStatus === 'SOON').length,
        ok: schedule.filter(i => i.serviceStatus === 'OK').length
    };

    const toggleScheduleSelection = (id) => {
        setSelectedScheduleIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleBulkService = () => {
        if (selectedScheduleIds.length === 0) return;
        const ids = selectedScheduleIds.join(',');
        navigate(`/pemeliharaan/input?assetIds=${ids}&category=ROUTINE`);
    };

    const handleDelete = async (id) => {
        if (!confirm('Hapus laporan ini?')) return;
        try {
            await api.delete(`/maintenance/${id}`);
            setReports(prev => prev.filter(r => r.id !== id));
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal menghapus');
        }
    };

    const handleExport = async () => {
        try {
            setLoading(true);
            // Fetch ALL data with current filters for export
            const params = {
                limit: 'all',
                search: debouncedSearch,
                status: statusFilter,
                type: typeFilter,
                targetDept: targetDeptFilter,
                category: categoryFromUrl,
                startDate,
                endDate
            };
            const res = await api.get('/maintenance', { params });
            const allData = res.data.data || [];

            const exportData = allData.map((r, index) => ({
                'No': index + 1,
                'Kode': r.code,
                'Judul': r.title,
                'Urgensi': urgencyLabels[r.urgency] || r.urgency,
                'Pelapor': `${r.user?.username || ''} (${r.unit?.name || ''})`,
                'Aset': r.assets?.map(a => `${a.name} (${a.code})`).join(', ') || '-',
                'Masa': r.category === 'ROUTINE' ? 'Rutin' : 'Insidentil',
                'Bidang': r.targetDept === 'PEMBANGUNAN' ? 'Pembangunan' : 'Sarpras',
                'Status': statusLabels[r.status] || r.status,
                'Tanggal': r.createdAt ? new Date(r.createdAt).toLocaleDateString('id-ID') : '-'
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            
            const colWidths = [
                { wch: 5 },   // No
                { wch: 15 },  // Kode
                { wch: 30 },  // Judul
                { wch: 15 },  // Urgensi
                { wch: 25 },  // Pelapor
                { wch: 40 },  // Aset
                { wch: 15 },  // Masa
                { wch: 15 },  // Bidang
                { wch: 15 },  // Status
                { wch: 15 }   // Tanggal
            ];
            ws['!cols'] = colWidths;

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Laporan Pemeliharaan");
            XLSX.writeFile(wb, `Laporan_Pemeliharaan_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (err) {
            console.error('Export error:', err);
            alert('Gagal mengekspor data');
        } finally {
            setLoading(false);
        }
    };

    const filtered = reports; // Now filtered by backend

    return (
        <div className="p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Wrench className="text-blue-600" /> Pemeliharaan
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Pusat kendali pemeliharaan aset dan umum
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => navigate('/pemeliharaan/input')}
                        className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all text-sm"
                    >
                        <Plus size={18} /> Buat Laporan Baru
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-nowrap overflow-x-auto gap-2 bg-white p-1.5 rounded-xl border border-slate-200">
                {isDashboardAuthorized && (
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                    >
                        <BarChart2 size={18} /> Dashboard
                    </button>
                )}
                <button
                    onClick={() => setActiveTab('schedule')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'schedule' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                >
                    <Calendar size={18} /> Jadwal Servis
                </button>
                <button
                    onClick={() => setActiveTab('list')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'list' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                >
                    <Clock size={18} /> Daftar Laporan
                </button>
            </div>

            {/* Tab Contents */}
            {isDashboardAuthorized && activeTab === 'dashboard' && <MaintenanceDashboard />}
            
            {activeTab === 'schedule' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Schedule Stats Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="bg-red-100 p-3 rounded-xl text-red-600">
                                <AlertCircle size={24} />
                            </div>
                            <div>
                                <div className="text-2xl font-black text-slate-800">{scheduleStats.overdue}</div>
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Terlewat (Overdue)</div>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="bg-amber-100 p-3 rounded-xl text-amber-600">
                                <Clock size={24} />
                            </div>
                            <div>
                                <div className="text-2xl font-black text-slate-800">{scheduleStats.soon}</div>
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Segera (30 Hari)</div>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="bg-green-100 p-3 rounded-xl text-green-600">
                                <CheckCircle size={24} />
                            </div>
                            <div>
                                <div className="text-2xl font-black text-slate-800">{scheduleStats.ok}</div>
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Terjadwal Aman</div>
                            </div>
                        </div>
                    </div>

                    {/* Grouped Content */}
                    <div className="space-y-4">
                        {Object.keys(groupedSchedule).length > 0 ? (
                            Object.entries(groupedSchedule).map(([unitName, assets]) => (
                                <div key={unitName} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="bg-slate-50/80 px-6 py-3 border-b border-slate-200 flex justify-between items-center">
                                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                            <span className="w-2 h-6 bg-blue-600 rounded-full"></span>
                                            {unitName}
                                            <span className="text-xs bg-white px-2 py-0.5 rounded-lg border border-slate-200 text-slate-500 ml-2">
                                                {assets.length} Aset
                                            </span>
                                        </h3>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <tbody className="divide-y divide-slate-100">
                                                {assets.map(item => (
                                                    <tr key={item.id} className={`hover:bg-slate-50/30 transition-colors ${selectedScheduleIds.includes(item.id) ? 'bg-blue-50/30' : ''}`}>
                                                        <td className="pl-6 py-4 w-10">
                                                            {!item.hasActiveReport && (
                                                                <input 
                                                                    type="checkbox"
                                                                    checked={selectedScheduleIds.includes(item.id)}
                                                                    onChange={() => toggleScheduleSelection(item.id)}
                                                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                                />
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-4 w-1/3">
                                                            <div className="font-bold text-slate-800 text-sm">{item.name}</div>
                                                            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter">{item.code}</div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="text-xs font-bold text-slate-700">
                                                                {new Date(item.nextMaintenanceEst).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                            </div>
                                                            <div className={`text-[10px] font-bold ${item.daysToService < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                                                {item.daysToService < 0 ? `${Math.abs(item.daysToService)} Hari Terlewat` : `${item.daysToService} Hari Lagi`}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${
                                                                item.serviceStatus === 'OVERDUE' ? 'bg-red-50 text-red-600 border border-red-100' :
                                                                item.serviceStatus === 'SOON' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                                                'bg-green-50 text-green-600 border border-green-100'
                                                            }`}>
                                                                {item.serviceStatus}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            {item.hasActiveReport ? (
                                                                <span className="text-[9px] font-bold text-orange-500 italic bg-orange-50 px-2 py-1 rounded border border-orange-100">Diproses</span>
                                                            ) : (
                                                                <button 
                                                                    onClick={() => navigate(`/pemeliharaan/input?assetId=${item.id}&category=ROUTINE`)}
                                                                    className="bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded-lg font-bold text-[10px] transition-all shadow-sm"
                                                                >
                                                                    Servis
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center shadow-inner">
                                <CheckCircle size={48} className="mx-auto text-green-400 mb-4 opacity-50" />
                                <h3 className="text-lg font-bold text-slate-800">Semua Aset Terpelihara</h3>
                                <p className="text-slate-500 text-sm mt-2">Tidak ada aset yang membutuhkan servis dalam waktu dekat.</p>
                            </div>
                        )}
                    </div>

                    {/* Bulk Action Float Button */}
                    {selectedScheduleIds.length > 0 && (
                        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 duration-500">
                            <button
                                onClick={handleBulkService}
                                className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black shadow-2xl flex items-center gap-4 hover:scale-105 transition-all ring-4 ring-white"
                            >
                                <Wrench size={20} className="text-blue-400" />
                                <span>PROSES {selectedScheduleIds.length} ASET SEKALIGUS</span>
                                <span className="bg-blue-600 text-[10px] px-2 py-1 rounded-lg ml-2">GO →</span>
                            </button>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'list' && (
                <div className="space-y-4 animate-in fade-in duration-500">
                    {/* Filters & Actions for List Tab */}
                    <div className="flex justify-end mb-2">
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg font-semibold shadow hover:shadow-lg transition-all text-sm"
                        >
                            <Download size={16} /> Ekspor Data
                        </button>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col md:flex-row gap-3 items-center">
                        <div className="relative flex-1 w-full">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                        type="text"
                        placeholder="Cari kode, judul, pelapor..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
                <select
                    value={categoryFromUrl || ''}
                    onChange={e => {
                        const val = e.target.value;
                        navigate(val ? `/pemeliharaan?category=${val}` : '/pemeliharaan');
                    }}
                    className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm min-w-[140px]"
                >
                    <option value="">Semua Kategori</option>
                    <option value="ROUTINE">📅 Rutin</option>
                    <option value="INCIDENTAL">🚨 Insidentil</option>
                </select>
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm min-w-[140px]"
                >
                    <option value="">Semua Status</option>
                    {Object.keys(statusLabels).map(s => (
                        <option key={s} value={s}>{statusLabels[s]}</option>
                    ))}
                </select>
                <select
                    value={targetDeptFilter}
                    onChange={e => {
                        const val = e.target.value;
                        setTargetDeptFilter(val);
                        // Update URL to preserve other filters
                        const params = new URLSearchParams(location.search);
                        if (val) params.set('targetDept', val);
                        else params.delete('targetDept');
                        navigate(`/pemeliharaan?${params.toString()}`);
                    }}
                    className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm min-w-[140px]"
                >
                    <option value="">Semua Bidang</option>
                    <option value="SARPRAS">🔧 Sarpras</option>
                    <option value="PEMBANGUNAN">🏗️ Pembangunan</option>
                </select>
                <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                    className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm min-w-[140px]"
                >
                    <option value="">Semua Tipe</option>
                    <option value="ASSET">Aset Terdata</option>
                    <option value="NON_ASSET">Non-Aset</option>
                </select>
            </div>

            {/* Date Filters Row */}
            <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dari Tanggal</span>
                    <input 
                        type="date" 
                        value={startDate} 
                        onChange={e => { setStartDate(e.target.value); setPage(1); }}
                        className="py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sampai</span>
                    <input 
                        type="date" 
                        value={endDate} 
                        onChange={e => { setEndDate(e.target.value); setPage(1); }}
                        className="py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                {(startDate || endDate) && (
                    <button 
                        onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }}
                        className="text-[10px] font-bold text-red-500 hover:text-red-600 uppercase"
                    >
                        Reset Tanggal
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-10 text-center text-slate-400">Memuat data...</div>
                ) : filtered.length === 0 ? (
                    <div className="p-10 text-center text-slate-400">
                        <Wrench size={40} className="mx-auto mb-2 text-slate-300" />
                        Belum ada laporan pemeliharaan
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left p-3 font-semibold text-slate-600">Kode</th>
                                    <th className="text-left p-3 font-semibold text-slate-600">Judul</th>
                                    <th className="text-left p-3 font-semibold text-slate-600 text-center">Aset</th>
                                    <th className="text-left p-3 font-semibold text-slate-600 text-center">Masa</th>
                                    <th className="text-left p-3 font-semibold text-slate-600">Status</th>
                                    <th className="text-left p-3 font-semibold text-slate-600">Tanggal</th>
                                    <th className="text-center p-3 font-semibold text-slate-600">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(r => (
                                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                        <td className="p-3 font-mono text-xs">{r.code}</td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-[10px] shadow-sm ${r.targetDept === 'PEMBANGUNAN' ? 'bg-orange-500' : 'bg-blue-500'}`}>
                                                    {r.targetDept === 'PEMBANGUNAN' ? 'PB' : 'SP'}
                                                </div>
                                                <div>
                                                    <div className="font-medium flex items-center gap-1.5">
                                                        {r.title}
                                                        {r.urgency && r.urgency !== 'NORMAL' && (
                                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase border ${urgencyColors[r.urgency]}`}>
                                                                {urgencyLabels[r.urgency]}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400">{r.user?.username} ({r.unit?.name})</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3 text-center">
                                            {r.assets && r.assets.length > 0 ? (
                                                <div className="flex flex-col items-center">
                                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold border border-blue-100">
                                                        {r.assets.length} Aset
                                                    </span>
                                                    <div className="text-[9px] text-slate-400 mt-1 max-w-[100px] truncate">
                                                        {r.assets?.map(a => a.code).join(', ')}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${r.category === 'ROUTINE' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {r.category === 'ROUTINE' ? 'Rutin' : 'Insidentil'}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusColors[r.status] || 'bg-gray-100 text-gray-600'}`}>
                                                {statusLabels[r.status] || r.status}
                                            </span>
                                        </td>
                                        <td className="p-3 text-slate-500 text-xs">
                                            {r.createdAt ? new Date(r.createdAt).toLocaleDateString('id-ID') : '-'}
                                        </td>
                                        <td className="p-3 text-center flex items-center justify-center gap-1">
                                            <button onClick={() => navigate(`/pemeliharaan/${r.id}`)} className="p-1.5 hover:bg-blue-50 rounded text-blue-600" title="Detail">
                                                <Eye size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(r.id)} className="p-1.5 hover:bg-red-50 rounded text-red-500" title="Hapus">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination Controls */}
            {!loading && meta.totalPages > 0 && (
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-xs text-slate-500 font-medium">
                        Menampilkan <span className="text-slate-800">{(meta.page - 1) * meta.limit + 1}</span> - <span className="text-slate-800">{Math.min(meta.page * meta.limit, meta.total)}</span> dari <span className="text-slate-800 font-bold">{meta.total}</span> data
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <select 
                            value={limit} 
                            onChange={e => { setLimit(e.target.value); setPage(1); }}
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 font-semibold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value={10}>10 Baris</option>
                            <option value={25}>25 Baris</option>
                            <option value={50}>50 Baris</option>
                            <option value="all">Semua</option>
                        </select>

                        <div className="flex items-center gap-1 ml-2">
                            <button 
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={meta.page === 1}
                                className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-600"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            
                            {[...Array(meta.totalPages)].map((_, i) => {
                                const p = i + 1;
                                // Simple logic to show only few pages if many
                                if (meta.totalPages > 7) {
                                    if (p !== 1 && p !== meta.totalPages && (p < meta.page - 1 || p > meta.page + 1)) {
                                        if (p === 2 || p === meta.totalPages - 1) return <span key={p} className="px-1 text-slate-300">...</span>;
                                        return null;
                                    }
                                }
                                return (
                                    <button 
                                        key={p}
                                        onClick={() => setPage(p)}
                                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${meta.page === p ? 'bg-blue-600 text-white shadow-md scale-110' : 'text-slate-500 hover:bg-slate-100'}`}
                                    >
                                        {p}
                                    </button>
                                );
                            })}

                            <button 
                                onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                                disabled={meta.page === meta.totalPages}
                                className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-600"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
                </div>
            )}
            
            {/* End of activeTab === 'list' */}
            {activeTab === 'list' && (
                <div className="hidden"></div>
            )}
        </div>
    );
};

export default MaintenanceList;
