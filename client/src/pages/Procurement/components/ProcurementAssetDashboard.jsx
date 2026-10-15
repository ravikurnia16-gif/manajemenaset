import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Clock, CheckCircle, AlertCircle, TrendingUp, Zap, Building2,
    DollarSign, Layers, Search, Filter, ArrowUpRight, Calendar,
    ChevronRight, RefreshCw, FileText, Sparkles, ShieldCheck, User, X
} from 'lucide-react';
import api from '../../../lib/axios';

const formatDurationText = (start, end) => {
    if (!start || !end) return null;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate.getTime() - startDate.getTime();
    if (diffMs < 0) return '0 Hari';

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const remainingHours = diffHours % 24;

    if (diffDays > 0) {
        return remainingHours > 0 ? `${diffDays} Hari ${remainingHours} Jam` : `${diffDays} Hari`;
    }
    if (diffHours > 0) {
        const remainingMinutes = diffMinutes % 60;
        return remainingMinutes > 0 ? `${diffHours} Jam ${remainingMinutes} Menit` : `${diffHours} Jam`;
    }
    return `${Math.max(1, diffMinutes)} Menit`;
};

const formatCurrency = (val) => {
    if (!val || isNaN(val)) return 'Rp 0';
    return `Rp ${Number(val).toLocaleString('id-ID')}`;
};

const getPresetRange = (preset) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const pad = (n) => String(n).padStart(2, '0');
    const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'THIS_MONTH') {
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0);
        return { startDate: toYMD(start), endDate: toYMD(end) };
    }
    if (preset === 'LAST_MONTH') {
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0);
        return { startDate: toYMD(start), endDate: toYMD(end) };
    }
    if (preset === 'THIS_YEAR') {
        const start = new Date(year, 0, 1);
        const end = new Date(year, 11, 31);
        return { startDate: toYMD(start), endDate: toYMD(end) };
    }
    return { startDate: '', endDate: '' };
};

const formatDateIndo = (dateStr) => {
    if (!dateStr) return '';
    try {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        }
        return dateStr;
    } catch (e) {
        return dateStr;
    }
};

const ProcurementAssetDashboard = ({ units = [] }) => {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUnit, setSelectedUnit] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'FINALIZED' | 'IN_PROGRESS'
    const [sortBy, setSortBy] = useState('DURATION_DESC'); // 'DURATION_DESC' | 'DURATION_ASC' | 'NEWEST'
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [datePreset, setDatePreset] = useState('ALL'); // 'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR' | 'CUSTOM'

    const fetchStats = async (start = startDate, end = endDate) => {
        try {
            setLoading(true);
            const params = {};
            if (start) params.startDate = start;
            if (end) params.endDate = end;
            const res = await api.get('/procurements/dashboard', { params });
            setData(res.data);
        } catch (error) {
            console.error("Failed to fetch procurement dashboard analytics", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats('', '');
    }, []);

    const handlePresetChange = (preset) => {
        setDatePreset(preset);
        if (preset === 'ALL') {
            setStartDate('');
            setEndDate('');
            fetchStats('', '');
        } else {
            const range = getPresetRange(preset);
            setStartDate(range.startDate);
            setEndDate(range.endDate);
            fetchStats(range.startDate, range.endDate);
        }
    };

    const handleStartDateChange = (e) => {
        const val = e.target.value;
        setStartDate(val);
        setDatePreset('CUSTOM');
        fetchStats(val, endDate);
    };

    const handleEndDateChange = (e) => {
        const val = e.target.value;
        setEndDate(val);
        setDatePreset('CUSTOM');
        fetchStats(startDate, val);
    };

    const handleResetDate = () => {
        setDatePreset('ALL');
        setStartDate('');
        setEndDate('');
        fetchStats('', '');
    };

    // Filter & Sort records
    const records = data?.records || [];
    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            const matchesSearch = !searchTerm || 
                (r.title && r.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (r.code && r.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (r.user && r.user.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (r.unit && r.unit.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesUnit = !selectedUnit || r.unit === selectedUnit;

            const matchesStatus = 
                statusFilter === 'ALL' ? true :
                statusFilter === 'FINALIZED' ? r.isFinalized :
                statusFilter === 'IN_PROGRESS' ? (!r.isFinalized && r.status !== 'REJECTED') : true;

            // Extra local date check if records aren't fully refreshed yet
            let matchesDate = true;
            if (startDate) {
                const s = new Date(startDate);
                s.setHours(0, 0, 0, 0);
                matchesDate = matchesDate && new Date(r.createdAt) >= s;
            }
            if (endDate) {
                const e = new Date(endDate);
                e.setHours(23, 59, 59, 999);
                matchesDate = matchesDate && new Date(r.createdAt) <= e;
            }

            return matchesSearch && matchesUnit && matchesStatus && matchesDate;
        }).sort((a, b) => {
            if (sortBy === 'DURATION_DESC') return b.durationMs - a.durationMs;
            if (sortBy === 'DURATION_ASC') return a.durationMs - b.durationMs;
            if (sortBy === 'NEWEST') return new Date(b.createdAt) - new Date(a.createdAt);
            return 0;
        });
    }, [records, searchTerm, selectedUnit, statusFilter, sortBy, startDate, endDate]);

    // Dynamic metrics dynamically recomputed from active filtered records
    const dynamicMetrics = useMemo(() => {
        const targetList = filteredRecords;
        const finalized = targetList.filter(r => r.isFinalized);
        const inProgress = targetList.filter(r => !r.isFinalized && r.status !== 'REJECTED');
        
        let avgDays = 0;
        let avgHours = 0;
        let fastestItem = null;
        let slowestItem = null;
        let totalSpend = 0;

        if (finalized.length > 0) {
            const totalMs = finalized.reduce((acc, curr) => acc + (curr.durationMs || 0), 0);
            const avgMs = totalMs / finalized.length;
            avgDays = Math.round(avgMs / (1000 * 60 * 60 * 24));
            avgHours = Math.round(avgMs / (1000 * 60 * 60));

            fastestItem = [...finalized].sort((a, b) => a.durationMs - b.durationMs)[0];
            slowestItem = [...finalized].sort((a, b) => b.durationMs - a.durationMs)[0];
            totalSpend = finalized.reduce((acc, curr) => acc + (curr.totalPrice || 0), 0);
        }

        // Unit performance
        const unitMap = {};
        targetList.forEach(r => {
            const u = r.unit || 'Tanpa Unit';
            if (!unitMap[u]) {
                unitMap[u] = { unit: u, totalPackages: 0, finalizedPackages: 0, totalDurationMs: 0 };
            }
            unitMap[u].totalPackages += 1;
            if (r.isFinalized) {
                unitMap[u].finalizedPackages += 1;
                unitMap[u].totalDurationMs += (r.durationMs || 0);
            }
        });

        const dynamicUnitPerformance = Object.values(unitMap).map(u => ({
            unit: u.unit,
            totalPackages: u.totalPackages,
            finalizedPackages: u.finalizedPackages,
            avgDays: u.finalizedPackages > 0 ? Math.round(u.totalDurationMs / u.finalizedPackages / (1000 * 60 * 60 * 24)) : 0
        })).sort((a, b) => b.totalPackages - a.totalPackages);

        // Speed categories breakdown among finalized
        const fast = finalized.filter(r => r.durationDays <= 3).length;
        const normal = finalized.filter(r => r.durationDays > 3 && r.durationDays <= 7).length;
        const medium = finalized.filter(r => r.durationDays > 7 && r.durationDays <= 14).length;
        const slow = finalized.filter(r => r.durationDays > 14).length;

        return {
            total: targetList.length,
            finalizedCount: finalized.length,
            inProgressCount: inProgress.length,
            avgDurationDays: avgDays,
            avgDurationHours: avgHours,
            fastest: fastestItem,
            slowest: slowestItem,
            totalFinalSpend: totalSpend,
            speedBreakdown: { fast, normal, medium, slow, total: finalized.length },
            unitPerformance: dynamicUnitPerformance
        };
    }, [filteredRecords]);

    if (loading) {
        return (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-3">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-500 font-bold text-sm">Memuat Dashboard Pengadaan Aset & Analisis Waktu...</p>
            </div>
        );
    }

    const avgDurationDays = dynamicMetrics.avgDurationDays;
    const avgDurationHours = dynamicMetrics.avgDurationHours;
    const finalizedCount = dynamicMetrics.finalizedCount;
    const inProgressCount = dynamicMetrics.inProgressCount;
    const totalCount = dynamicMetrics.total;
    const totalFinalSpend = dynamicMetrics.totalFinalSpend;
    const fastest = dynamicMetrics.fastest;
    const slowest = dynamicMetrics.slowest;
    const unitPerformance = dynamicMetrics.unitPerformance;
    const speedBreakdown = dynamicMetrics.speedBreakdown;

    return (
        <div className="space-y-6">
            {/* ── HERO BANNER ── */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-slate-800">
                {/* Background decorative circles */}
                <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
                <div className="absolute right-32 -bottom-16 w-56 h-56 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-black uppercase tracking-wider">
                                <ShieldCheck size={14} /> Hak Akses Khusus: Kepala Bidang Sarana
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold">
                                <Sparkles size={13} /> Analisis Siklus Waktu
                            </span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
                            Dashboard Pengadaan Aset
                        </h1>
                        <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
                            Pemantauan durasi waktu siklus pengadaan aset &amp; barang, <strong>dihitung sejak pengajuan dibuat hingga selesai Tahap 4 (Finalisasi Harga &amp; Rekanan)</strong>.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 w-full lg:w-auto">
                        <button
                            onClick={() => fetchStats(startDate, endDate)}
                            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-sm w-full lg:w-auto"
                            title="Segarkan data analisis"
                        >
                            <RefreshCw size={15} /> Segarkan Data
                        </button>
                    </div>
                </div>
            </div>

            {/* ── FILTER RENTANG TANGGAL (DATE RANGE) ── */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    {/* Preset Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2 text-xs font-black text-slate-700 uppercase tracking-wider mr-1">
                            <Calendar size={16} className="text-blue-600" />
                            <span>Rentang Waktu:</span>
                        </div>

                        <button
                            type="button"
                            onClick={() => handlePresetChange('ALL')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                datePreset === 'ALL'
                                    ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-200'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                        >
                            Semua Waktu
                        </button>

                        <button
                            type="button"
                            onClick={() => handlePresetChange('THIS_MONTH')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                datePreset === 'THIS_MONTH'
                                    ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-200'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                        >
                            Bulan Ini
                        </button>

                        <button
                            type="button"
                            onClick={() => handlePresetChange('LAST_MONTH')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                datePreset === 'LAST_MONTH'
                                    ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-200'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                        >
                            Bulan Lalu
                        </button>

                        <button
                            type="button"
                            onClick={() => handlePresetChange('THIS_YEAR')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                datePreset === 'THIS_YEAR'
                                    ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-200'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                        >
                            Tahun Ini
                        </button>
                    </div>

                    {/* Custom Date Pickers */}
                    <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                            <span className="text-[11px] font-bold text-slate-500">Dari:</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={handleStartDateChange}
                                className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                            />
                            <span className="text-[11px] font-bold text-slate-400">s/d</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={handleEndDateChange}
                                className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                            />
                        </div>

                        {(startDate || endDate) && (
                            <button
                                type="button"
                                onClick={handleResetDate}
                                className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors flex items-center gap-1.5"
                                title="Hapus filter rentang tanggal"
                            >
                                <X size={14} /> Reset Tanggal
                            </button>
                        )}

                        {(startDate || endDate) && (
                            <div className="text-xs text-blue-700 bg-blue-50/80 border border-blue-200/80 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
                                <Calendar size={13} className="text-blue-500" />
                                <span>Periode: {formatDateIndo(startDate) || 'Awal'} – {formatDateIndo(endDate) || 'Sekarang'}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── KPI METRICS CARDS (6 CARDS) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {/* 1. Rata-rata Durasi Pengadaan */}
                <div className="bg-white border-2 border-emerald-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-emerald-800 font-extrabold text-[11px] uppercase tracking-wider">Rata-rata Durasi</span>
                        <div className="p-2 bg-emerald-100/70 rounded-xl text-emerald-700">
                            <Clock size={18} />
                        </div>
                    </div>
                    <div>
                        <div className="text-2xl font-black text-slate-800">
                            {avgDurationDays > 0 ? `${avgDurationDays} Hari` : (avgDurationHours > 0 ? `${avgDurationHours} Jam` : '—')}
                        </div>
                        <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                            Sejak dibuat s/d finalisasi
                        </p>
                    </div>
                </div>

                {/* 2. Selesai Finalisasi */}
                <div className="bg-white border border-blue-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-blue-800 font-extrabold text-[11px] uppercase tracking-wider">Selesai Finalisasi</span>
                        <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                            <CheckCircle size={18} />
                        </div>
                    </div>
                    <div>
                        <div className="text-2xl font-black text-slate-800">{finalizedCount} Paket</div>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                            Dari total {totalCount} paket ({totalCount > 0 ? Math.round((finalizedCount / totalCount) * 100) : 0}%)
                        </p>
                    </div>
                </div>

                {/* 3. Masih Berjalan */}
                <div className="bg-white border border-amber-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-amber-800 font-extrabold text-[11px] uppercase tracking-wider">Sedang Berjalan</span>
                        <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                            <Layers size={18} />
                        </div>
                    </div>
                    <div>
                        <div className="text-2xl font-black text-slate-800">{inProgressCount} Paket</div>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                            Belum mencapai finalisasi
                        </p>
                    </div>
                </div>

                {/* 4. Pengadaan Tercepat */}
                <div className="bg-white border border-purple-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-purple-800 font-extrabold text-[11px] uppercase tracking-wider">Tercepat</span>
                        <div className="p-2 bg-purple-50 rounded-xl text-purple-600">
                            <Zap size={18} />
                        </div>
                    </div>
                    <div>
                        <div className="text-2xl font-black text-slate-800">
                            {fastest ? `${fastest.durationDays} Hari` : '—'}
                        </div>
                        <p className="text-[11px] text-purple-700 font-medium truncate mt-0.5" title={fastest?.title}>
                            {fastest?.title || 'Belum ada data'}
                        </p>
                    </div>
                </div>

                {/* 5. Pengadaan Terlama (Perlu Perhatian) */}
                <div className="bg-white border border-rose-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-rose-800 font-extrabold text-[11px] uppercase tracking-wider">Terlama</span>
                        <div className="p-2 bg-rose-50 rounded-xl text-rose-600">
                            <AlertCircle size={18} />
                        </div>
                    </div>
                    <div>
                        <div className="text-2xl font-black text-slate-800">
                            {slowest ? `${slowest.durationDays} Hari` : '—'}
                        </div>
                        <p className="text-[11px] text-rose-700 font-medium truncate mt-0.5" title={slowest?.title}>
                            {slowest?.title || 'Belum ada data'}
                        </p>
                    </div>
                </div>

                {/* 6. Total Nilai Finalisasi */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-slate-700 font-extrabold text-[11px] uppercase tracking-wider">Total Nilai Final</span>
                        <div className="p-2 bg-slate-100 rounded-xl text-slate-700">
                            <DollarSign size={18} />
                        </div>
                    </div>
                    <div>
                        <div className="text-lg font-black text-slate-800 truncate" title={formatCurrency(totalFinalSpend)}>
                            {formatCurrency(totalFinalSpend)}
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                            Realisasi paket final
                        </p>
                    </div>
                </div>
            </div>

            {/* ── TWO-COLUMN ANALYSIS (PERFORMA UNIT & DISTRIBUSI WAKTU) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left (2 cols): Performa Durasi per Unit Kerja */}
                <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                        <div>
                            <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                                <Building2 size={18} className="text-blue-600" />
                                Rata-rata Durasi Pengadaan per Unit Kerja
                            </h2>
                            <p className="text-slate-400 text-xs mt-0.5">
                                Analisis kecepatan proses dari pengajuan dibuat hingga finalisasi per unit
                            </p>
                        </div>
                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">
                            {unitPerformance.length} Unit
                        </span>
                    </div>

                    {unitPerformance.length === 0 ? (
                        <p className="text-xs text-slate-400 py-6 text-center italic">Belum ada data pengadaan per unit.</p>
                    ) : (
                        <div className="space-y-3.5 max-h-[320px] overflow-y-auto pr-1">
                            {unitPerformance.map((u, idx) => {
                                const maxAvg = Math.max(...unitPerformance.map(it => it.avgDays), 1);
                                const percentage = Math.min(100, Math.round((u.avgDays / maxAvg) * 100));
                                const isSelected = selectedUnit === u.unit;

                                return (
                                    <div
                                        key={idx}
                                        onClick={() => setSelectedUnit(selectedUnit === u.unit ? '' : u.unit)}
                                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                                            isSelected 
                                                ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-100'
                                                : 'bg-slate-50/60 hover:bg-slate-100/70 border-slate-200/80'
                                        }`}
                                    >
                                        <div className="flex justify-between items-center mb-1.5 text-xs">
                                            <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                                                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 font-black text-[10px] flex items-center justify-center">
                                                    {idx + 1}
                                                </span>
                                                {u.unit}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-500 text-[11px]">
                                                    {u.finalizedPackages}/{u.totalPackages} Selesai
                                                </span>
                                                <span className={`font-black text-xs px-2 py-0.5 rounded-md ${
                                                    u.avgDays === 0 ? 'bg-slate-100 text-slate-500' :
                                                    u.avgDays <= 3 ? 'bg-emerald-100 text-emerald-800' :
                                                    u.avgDays <= 7 ? 'bg-blue-100 text-blue-800' :
                                                    u.avgDays <= 14 ? 'bg-amber-100 text-amber-800' :
                                                    'bg-rose-100 text-rose-800'
                                                }`}>
                                                    {u.avgDays > 0 ? `~${u.avgDays} Hari` : 'Belum Selesai'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${
                                                    u.avgDays <= 3 ? 'bg-emerald-500' :
                                                    u.avgDays <= 7 ? 'bg-blue-500' :
                                                    u.avgDays <= 14 ? 'bg-amber-500' : 'bg-rose-500'
                                                }`}
                                                style={{ width: `${Math.max(5, percentage)}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Right (1 col): Distribusi Kecepatan Siklus */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
                    <div>
                        <h2 className="text-base font-black text-slate-800 flex items-center gap-2 mb-1">
                            <TrendingUp size={18} className="text-emerald-600" />
                            Distribusi Kecepatan Finalisasi
                        </h2>
                        <p className="text-slate-400 text-xs mb-4">
                            Pengelompokan durasi dari total {speedBreakdown.total} paket yang telah selesai
                        </p>

                        <div className="space-y-3">
                            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                    <div>
                                        <div className="font-extrabold text-xs text-emerald-900">Sangat Cepat (≤ 3 Hari)</div>
                                        <div className="text-[10px] text-emerald-700">Responsif &amp; kilat</div>
                                    </div>
                                </div>
                                <span className="text-base font-black text-emerald-800">{speedBreakdown.fast}</span>
                            </div>

                            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                                    <div>
                                        <div className="font-extrabold text-xs text-blue-900">Standar (4 - 7 Hari)</div>
                                        <div className="text-[10px] text-blue-700">Sesuai SLA normal</div>
                                    </div>
                                </div>
                                <span className="text-base font-black text-blue-800">{speedBreakdown.normal}</span>
                            </div>

                            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                                    <div>
                                        <div className="font-extrabold text-xs text-amber-900">Sedang (8 - 14 Hari)</div>
                                        <div className="text-[10px] text-amber-700">Butuh follow-up vendor</div>
                                    </div>
                                </div>
                                <span className="text-base font-black text-amber-800">{speedBreakdown.medium}</span>
                            </div>

                            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200/80 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-3 h-3 rounded-full bg-rose-500" />
                                    <div>
                                        <div className="font-extrabold text-xs text-rose-900">Perhatian Khusus (&gt; 14 Hari)</div>
                                        <div className="text-[10px] text-rose-700">Durasi melewati 2 minggu</div>
                                    </div>
                                </div>
                                <span className="text-base font-black text-rose-800">{speedBreakdown.slow}</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>Status paket:</span>
                        <span className="font-bold text-slate-700">{finalizedCount} Selesai · {inProgressCount} Berjalan</span>
                    </div>
                </div>
            </div>

            {/* ── DETAIL ANALISIS TABEL DURASI PENGADAAN ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Header & Controls */}
                <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/60">
                    <div>
                        <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                            <Clock size={18} className="text-blue-600" />
                            Rincian Durasi Paket Pengadaan
                        </h2>
                        <p className="text-slate-400 text-xs mt-0.5">
                            Menampilkan {filteredRecords.length} dari {records.length} total paket pengadaan
                        </p>
                    </div>

                    {/* Filter & Search Bar */}
                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        {/* Search Input */}
                        <div className="relative flex-1 md:w-60 min-w-[180px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                            <input
                                type="text"
                                placeholder="Cari judul / kode..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-100 outline-none"
                            />
                        </div>

                        {/* Unit Filter */}
                        <select
                            value={selectedUnit}
                            onChange={(e) => setSelectedUnit(e.target.value)}
                            className="bg-white border border-slate-200 rounded-xl text-xs font-semibold px-3 py-1.5 text-slate-700 outline-none"
                        >
                            <option value="">Semua Unit</option>
                            {units.map((u, i) => (
                                <option key={i} value={u.name}>{u.name}</option>
                            ))}
                        </select>

                        {/* Status Filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-white border border-slate-200 rounded-xl text-xs font-semibold px-3 py-1.5 text-slate-700 outline-none"
                        >
                            <option value="ALL">Semua Status</option>
                            <option value="FINALIZED">Selesai Finalisasi</option>
                            <option value="IN_PROGRESS">Sedang Berjalan</option>
                        </select>

                        {/* Sort Order */}
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="bg-white border border-slate-200 rounded-xl text-xs font-semibold px-3 py-1.5 text-slate-700 outline-none"
                        >
                            <option value="DURATION_DESC">Durasi Terlama</option>
                            <option value="DURATION_ASC">Durasi Tercepat</option>
                            <option value="NEWEST">Terbaru Diajukan</option>
                        </select>
                    </div>
                </div>

                {/* Table View */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100/70 text-slate-600 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                            <tr>
                                <th className="p-3.5 pl-6 text-center w-12">No</th>
                                <th className="p-3.5">Paket Pengadaan</th>
                                <th className="p-3.5">Unit Pemohon</th>
                                <th className="p-3.5">Tanggal Dibuat</th>
                                <th className="p-3.5">Selesai Finalisasi</th>
                                <th className="p-3.5 text-center">Durasi Pengadaan</th>
                                <th className="p-3.5 text-center">Status</th>
                                <th className="p-3.5 pr-6 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredRecords.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="p-12 text-center text-slate-400 font-medium">
                                        Tidak ada paket pengadaan yang sesuai filter.
                                    </td>
                                </tr>
                            ) : (
                                filteredRecords.map((r, idx) => {
                                    const durationText = formatDurationText(r.createdAt, r.finalizedAt || (r.status === 'COMPLETED' ? r.finalizedAt : new Date()));
                                    
                                    return (
                                        <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="p-3.5 pl-6 text-center text-xs font-bold text-slate-400">
                                                {idx + 1}
                                            </td>
                                            <td className="p-3.5">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-mono text-[11px] font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                        {r.code}
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                                                        r.type === 'ASSET' ? 'border-purple-200 text-purple-700 bg-purple-50' : 'border-amber-200 text-amber-700 bg-amber-50'
                                                    }`}>
                                                        {r.type}
                                                    </span>
                                                </div>
                                                <div
                                                    onClick={() => navigate(`/procurements/${r.id}`)}
                                                    className="font-extrabold text-slate-900 hover:text-blue-600 cursor-pointer line-clamp-1 text-sm"
                                                    title={r.title}
                                                >
                                                    {r.title}
                                                </div>
                                                <div className="text-[11px] text-slate-400 mt-0.5">
                                                    {r.itemCount} Item Barang · {formatCurrency(r.totalPrice)}
                                                </div>
                                            </td>
                                            <td className="p-3.5">
                                                <div className="font-bold text-slate-800 text-xs">{r.unit}</div>
                                                <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                                    <User size={11} /> {r.user}
                                                </div>
                                            </td>
                                            <td className="p-3.5 text-xs text-slate-600 font-medium">
                                                {new Date(r.createdAt).toLocaleDateString('id-ID', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric'
                                                })}
                                                <div className="text-[10px] text-slate-400">
                                                    {new Date(r.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                                                </div>
                                            </td>
                                            <td className="p-3.5 text-xs">
                                                {r.isFinalized ? (
                                                    <div>
                                                        <span className="font-bold text-emerald-700">
                                                            {new Date(r.finalizedAt).toLocaleDateString('id-ID', {
                                                                day: 'numeric',
                                                                month: 'short',
                                                                year: 'numeric'
                                                            })}
                                                        </span>
                                                        <div className="text-[10px] text-slate-400">
                                                            {new Date(r.finalizedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic text-xs">
                                                        Belum Finalisasi
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3.5 text-center">
                                                {r.isFinalized ? (
                                                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black shadow-2xs border ${
                                                        r.durationDays <= 3 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                        r.durationDays <= 7 ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                        r.durationDays <= 14 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                        'bg-rose-50 text-rose-700 border-rose-200'
                                                    }`}>
                                                        <Clock size={12} />
                                                        {durationText}
                                                    </div>
                                                ) : r.status !== 'REJECTED' ? (
                                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200" title="Proses masih berjalan">
                                                        <Clock size={12} className="text-slate-400" />
                                                        {durationText} <span className="text-[10px] text-slate-400">(Berjalan)</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 text-xs">—</span>
                                                )}
                                            </td>
                                            <td className="p-3.5 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide border ${
                                                    r.status === 'SUBMITTED' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                    r.status === 'APPROVED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                    r.status === 'PROCESS' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                                    r.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                    'bg-red-50 text-red-600 border-red-200'
                                                }`}>
                                                    {r.status}
                                                </span>
                                            </td>
                                            <td className="p-3.5 pr-6 text-center">
                                                <button
                                                    onClick={() => navigate(`/procurements/${r.id}`)}
                                                    className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-all border border-blue-200"
                                                    title="Lihat Detail Paket Pengadaan"
                                                >
                                                    Detail <ArrowUpRight size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ProcurementAssetDashboard;
