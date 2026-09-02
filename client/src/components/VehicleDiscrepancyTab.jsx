import React, { useState, useEffect, useMemo } from 'react';
import { 
    Gauge, Car, Users, Navigation2, Calendar, Search, 
    AlertTriangle, CheckCircle, Clock, Filter, Camera, 
    X, ExternalLink, RefreshCw, ChevronRight, ArrowUpRight,
    TrendingUp, Eye
} from 'lucide-react';
import api from '../lib/axios';
import { getMediaUrl } from '../lib/media';

const VehicleDiscrepancyTab = ({ currentUserProfile, isAdmin }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters
    const [periodType, setPeriodType] = useState('THIS_MONTH'); // 'THIS_MONTH', 'LAST_MONTH', 'THIS_YEAR', 'ALL', 'CUSTOM'
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('ALL'); // 'ALL', 'Mobil', 'Bus', 'Motor'
    const [searchQuery, setSearchQuery] = useState('');

    // Photo Preview Modal
    const [previewPhoto, setPreviewPhoto] = useState(null); // { url, title, date, diff }

    // Active View inside tab: 'LOGS' or 'VEHICLES'
    const [viewMode, setViewMode] = useState('LOGS');

    const fetchAnalytics = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {};
            const now = new Date();

            if (periodType === 'THIS_MONTH') {
                params.month = now.getMonth() + 1;
                params.year = now.getFullYear();
            } else if (periodType === 'LAST_MONTH') {
                const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                params.month = prev.getMonth() + 1;
                params.year = prev.getFullYear();
            } else if (periodType === 'THIS_YEAR') {
                params.year = now.getFullYear();
            } else if (periodType === 'CUSTOM' && customStartDate && customEndDate) {
                params.startDate = customStartDate;
                params.endDate = customEndDate;
            }

            if (categoryFilter !== 'ALL') {
                params.vehicleType = categoryFilter;
            }

            const res = await api.get('/vehicles/discrepancies/analytics', { params });
            setData(res.data);
        } catch (err) {
            console.error('Failed to load discrepancy analytics:', err);
            setError(err.response?.data?.error || err.message || 'Gagal memuat data audit diskrepansi');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, [periodType, customStartDate, customEndDate, categoryFilter]);

    // Format helper for categories
    const categoryMap = useMemo(() => {
        if (!data?.byCategory) return {};
        const map = {};
        data.byCategory.forEach(c => {
            map[c.category] = c;
        });
        return map;
    }, [data]);

    const mobilStat = categoryMap['Mobil'] || { systemTrips: 0, discrepancyTrips: 0, totalTrips: 0, systemPercent: 100, discrepancyPercent: 0, systemKm: 0, discrepancyKm: 0 };
    const busStat = categoryMap['Bus'] || { systemTrips: 0, discrepancyTrips: 0, totalTrips: 0, systemPercent: 100, discrepancyPercent: 0, systemKm: 0, discrepancyKm: 0 };
    const motorStat = categoryMap['Motor'] || { systemTrips: 0, discrepancyTrips: 0, totalTrips: 0, systemPercent: 100, discrepancyPercent: 0, systemKm: 0, discrepancyKm: 0 };

    // Filtered logs
    const filteredLogs = useMemo(() => {
        if (!data?.discrepancyLogs) return [];
        return data.discrepancyLogs.filter(log => {
            const matchSearch = !searchQuery || 
                (log.vehicleName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (log.plateNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (log.userName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (log.driverName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (log.userUnit || '').toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchCat = categoryFilter === 'ALL' || 
                (log.vehicleType || '').toLowerCase().includes(categoryFilter.toLowerCase());

            return matchSearch && matchCat;
        });
    }, [data?.discrepancyLogs, searchQuery, categoryFilter]);

    // Filtered vehicle breakdown
    const filteredVehicles = useMemo(() => {
        if (!data?.byVehicle) return [];
        return data.byVehicle.filter(v => {
            const matchSearch = !searchQuery || 
                (v.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (v.plateNumber || '').toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchCat = categoryFilter === 'ALL' || 
                (v.type || '').toLowerCase().includes(categoryFilter.toLowerCase());

            return matchSearch && matchCat;
        });
    }, [data?.byVehicle, searchQuery, categoryFilter]);

    return (
        <div className="p-4 md:p-6 space-y-6 animate-in fade-in duration-300">
            {/* Header Title & Description */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-indigo-950 p-6 rounded-2xl text-white shadow-xl">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                            Audit Armada & Kepatuhan
                        </span>
                    </div>
                    <h2 className="text-xl md:text-2xl font-black flex items-center gap-2.5">
                        <Gauge className="text-indigo-400" size={24} />
                        Audit Diskrepansi & Kepatuhan Sistem
                    </h2>
                    <p className="text-xs md:text-sm text-indigo-200/80 mt-1 max-w-2xl">
                        Komparasi peminjaman armada yang <b>menggunakan sistem (resmi)</b> dibanding <b>tanpa sistem (terdeteksi selisih KM)</b>, khususnya Mobil dan Bus.
                    </p>
                </div>

                <button
                    onClick={fetchAnalytics}
                    disabled={loading}
                    className="self-start lg:self-center flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/20 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    <span>Segarkan Data</span>
                </button>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Period Presets */}
                    <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                        {[
                            { id: 'THIS_MONTH', label: 'Bulan Ini' },
                            { id: 'LAST_MONTH', label: 'Bulan Lalu' },
                            { id: 'THIS_YEAR', label: 'Tahun Ini' },
                            { id: 'ALL', label: 'Semua Waktu' },
                            { id: 'CUSTOM', label: 'Kustom Tanggal' }
                        ].map(p => (
                            <button
                                key={p.id}
                                onClick={() => setPeriodType(p.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    periodType === p.id 
                                        ? 'bg-white text-blue-600 shadow-sm' 
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {/* Category Filter */}
                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                        {[
                            { id: 'ALL', label: 'Semua Armada' },
                            { id: 'Mobil', label: '🚗 Mobil' },
                            { id: 'Bus', label: '🚌 Bus' },
                            { id: 'Motor', label: '🏍️ Motor' }
                        ].map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setCategoryFilter(cat.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    categoryFilter === cat.id 
                                        ? 'bg-indigo-600 text-white shadow-sm' 
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Custom Date Pickers & Search */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-100">
                    {periodType === 'CUSTOM' && (
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500"
                            />
                            <span className="text-xs text-slate-400 font-bold">s/d</span>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500"
                            />
                        </div>
                    )}

                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                        <input
                            type="text"
                            placeholder="Cari armada, plat nomor, atau nama peminjam..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-blue-500 focus:bg-white transition-colors"
                        />
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle size={16} className="text-rose-500 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Top KPI Cards (Banyak Peminjaman: Sistem vs Tanpa Sistem) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Overall System Compliance */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-bold text-slate-500">Tingkat Kepatuhan Sistem</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                (data?.summary?.systemPercent || 0) >= 80 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : (data?.summary?.systemPercent || 0) >= 50 
                                    ? 'bg-amber-100 text-amber-800' 
                                    : 'bg-rose-100 text-rose-800'
                            }`}>
                                {(data?.summary?.systemPercent || 0).toFixed(1)}% Kepatuhan
                            </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-3xl font-black text-slate-900">
                                {data?.summary?.systemTripsCount || 0}
                                <span className="text-base font-semibold text-slate-400"> / {data?.summary?.totalTrips || 0}</span>
                            </h3>
                            <span className="text-xs font-bold text-emerald-600">Peminjaman</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                            {data?.summary?.discrepancyTripsCount || 0} peminjaman terdeteksi tanpa sistem (selisih odometer).
                        </p>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
                        <div className="flex justify-between text-[10px] font-bold text-slate-500">
                            <span className="text-emerald-700">✓ Sistem: {data?.summary?.systemTripsCount || 0} ({((data?.summary?.systemPercent || 100)).toFixed(0)}%)</span>
                            <span className="text-rose-600">⚠️ Luar: {data?.summary?.discrepancyTripsCount || 0} ({((data?.summary?.discrepancyPercent || 0)).toFixed(0)}%)</span>
                        </div>
                        <div className="w-full bg-rose-100 rounded-full h-2 overflow-hidden flex">
                            <div 
                                className="bg-emerald-500 h-full transition-all duration-500" 
                                style={{ width: `${Math.min(100, Math.max(0, data?.summary?.systemPercent || 100))}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* 2. Mobil Comparison */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                                <Car size={14} className="text-blue-600" />
                                <span>Armada Mobil</span>
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                                {mobilStat.systemPercent.toFixed(1)}% Sistem
                            </span>
                        </div>
                        <div className="flex items-baseline gap-1.5">
                            <h3 className="text-2xl font-black text-slate-900">
                                {mobilStat.systemTrips}
                                <span className="text-sm font-semibold text-slate-400"> / {mobilStat.totalTrips}</span>
                            </h3>
                            <span className="text-xs font-medium text-slate-500">Trip</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                            {mobilStat.discrepancyTrips} kali dipakai tanpa sistem.
                        </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
                        <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-slate-600">KM Sistem: {mobilStat.systemKm.toLocaleString('id-ID')}</span>
                            <span className="text-rose-600">KM Luar: {mobilStat.discrepancyKm.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="w-full bg-rose-100 rounded-full h-2 overflow-hidden flex">
                            <div 
                                className="bg-blue-600 h-full transition-all duration-500" 
                                style={{ width: `${Math.min(100, Math.max(0, mobilStat.systemPercent))}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* 3. Bus Comparison */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                                <Users size={14} className="text-amber-600" />
                                <span>Armada Bus</span>
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200">
                                {busStat.systemPercent.toFixed(1)}% Sistem
                            </span>
                        </div>
                        <div className="flex items-baseline gap-1.5">
                            <h3 className="text-2xl font-black text-slate-900">
                                {busStat.systemTrips}
                                <span className="text-sm font-semibold text-slate-400"> / {busStat.totalTrips}</span>
                            </h3>
                            <span className="text-xs font-medium text-slate-500">Trip</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                            {busStat.discrepancyTrips} kali dipakai tanpa sistem.
                        </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
                        <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-slate-600">KM Sistem: {busStat.systemKm.toLocaleString('id-ID')}</span>
                            <span className="text-rose-600">KM Luar: {busStat.discrepancyKm.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="w-full bg-rose-100 rounded-full h-2 overflow-hidden flex">
                            <div 
                                className="bg-amber-500 h-full transition-all duration-500" 
                                style={{ width: `${Math.min(100, Math.max(0, busStat.systemPercent))}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* 4. Motor Comparison */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                                <Navigation2 size={14} className="text-emerald-600" />
                                <span>Sepeda Motor</span>
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                                {motorStat.systemPercent.toFixed(1)}% Sistem
                            </span>
                        </div>
                        <div className="flex items-baseline gap-1.5">
                            <h3 className="text-2xl font-black text-slate-900">
                                {motorStat.systemTrips}
                                <span className="text-sm font-semibold text-slate-400"> / {motorStat.totalTrips}</span>
                            </h3>
                            <span className="text-xs font-medium text-slate-500">Trip</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                            {motorStat.discrepancyTrips} kali dipakai tanpa sistem.
                        </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
                        <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-slate-600">KM Sistem: {motorStat.systemKm.toLocaleString('id-ID')}</span>
                            <span className="text-rose-600">KM Luar: {motorStat.discrepancyKm.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="w-full bg-rose-100 rounded-full h-2 overflow-hidden flex">
                            <div 
                                className="bg-emerald-500 h-full transition-all duration-500" 
                                style={{ width: `${Math.min(100, Math.max(0, motorStat.systemPercent))}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* View Switcher: Riwayat Kejadian vs Rekapitulasi per Armada */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setViewMode('LOGS')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                            viewMode === 'LOGS'
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        <AlertTriangle size={14} />
                        <span>Riwayat Kejadian Diskrepansi ({filteredLogs.length})</span>
                    </button>
                    <button
                        onClick={() => setViewMode('VEHICLES')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                            viewMode === 'VEHICLES'
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        <Car size={14} />
                        <span>Rekap per Armada ({filteredVehicles.length})</span>
                    </button>
                </div>

                <div className="text-xs text-slate-500 font-medium">
                    {viewMode === 'LOGS' 
                        ? `Menampilkan ${filteredLogs.length} insiden selisih odometer`
                        : `Menampilkan ${filteredVehicles.length} unit armada`
                    }
                </div>
            </div>

            {/* Content View 1: Riwayat Kejadian Diskrepansi (Audit Logs) */}
            {viewMode === 'LOGS' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                    {loading ? (
                        <div className="p-12 text-center text-slate-400 font-semibold">
                            <div className="inline-block w-6 h-6 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2" />
                            <p>Memuat data riwayat diskrepansi...</p>
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="p-12 text-center space-y-2">
                            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                                <CheckCircle size={24} />
                            </div>
                            <h4 className="text-sm font-bold text-slate-800">Tidak Ada Kejadian Diskrepansi</h4>
                            <p className="text-xs text-slate-500 max-w-md mx-auto">
                                Seluruh peminjaman armada pada periode ini tercatat sesuai odometer sistem tanpa selisih di luar sistem.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider">
                                    <tr>
                                        <th className="p-3.5">Waktu Terdeteksi</th>
                                        <th className="p-3.5">Armada</th>
                                        <th className="p-3.5">Peminjam / Pelapor</th>
                                        <th className="p-3.5 text-right">KM Terakhir Sistem</th>
                                        <th className="p-3.5 text-right">KM Awal Input</th>
                                        <th className="p-3.5 text-center">Selisih (Luar Sistem)</th>
                                        <th className="p-3.5 text-center">Bukti Foto</th>
                                        <th className="p-3.5">Catatan / Tujuan</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredLogs.map(log => {
                                        const dt = new Date(log.date);
                                        return (
                                            <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="p-3.5 whitespace-nowrap">
                                                    <div className="font-bold text-slate-800">
                                                        {dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                                        <Clock size={10} />
                                                        {dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                                                    </div>
                                                </td>
                                                <td className="p-3.5">
                                                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-slate-100 text-slate-700">
                                                            {log.vehicleType}
                                                        </span>
                                                        <span>{log.vehicleName}</span>
                                                    </div>
                                                    <div className="text-[10px] font-mono text-slate-500 mt-0.5 font-bold">
                                                        {log.plateNumber}
                                                    </div>
                                                </td>
                                                <td className="p-3.5">
                                                    <div className="font-bold text-slate-800">{log.userName}</div>
                                                    <div className="text-[10px] text-slate-500">Unit: {log.userUnit}</div>
                                                </td>
                                                <td className="p-3.5 text-right font-mono font-semibold text-slate-600">
                                                    {log.prevEndKm?.toLocaleString('id-ID')} KM
                                                </td>
                                                <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                                                    {log.currentStartKm?.toLocaleString('id-ID')} KM
                                                </td>
                                                <td className="p-3.5 text-center">
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-black bg-rose-50 text-rose-700 border border-rose-200">
                                                        <AlertTriangle size={12} className="text-rose-500" />
                                                        +{log.discrepancyKm?.toLocaleString('id-ID')} KM
                                                    </span>
                                                </td>
                                                <td className="p-3.5 text-center">
                                                    {log.startPhoto ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setPreviewPhoto({
                                                                url: getMediaUrl(log.startPhoto),
                                                                title: `${log.vehicleName} (${log.plateNumber})`,
                                                                date: dt.toLocaleString('id-ID'),
                                                                diff: log.discrepancyKm,
                                                                user: log.userName
                                                            })}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                                                            title="Lihat Foto Bukti Odometer"
                                                        >
                                                            <Camera size={12} />
                                                            <span>Lihat Foto</span>
                                                        </button>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-400 italic">Tanpa Foto</span>
                                                    )}
                                                </td>
                                                <td className="p-3.5 max-w-[200px]">
                                                    <div className="truncate text-slate-700 font-medium" title={log.destination}>
                                                        {log.destination || '-'}
                                                    </div>
                                                    {log.preTripNotes && (
                                                        <div className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-1 truncate" title={log.preTripNotes}>
                                                            Catatan: {log.preTripNotes}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Content View 2: Rekapitulasi per Armada Kendaraan */}
            {viewMode === 'VEHICLES' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider">
                                <tr>
                                    <th className="p-3.5">Armada Kendaraan</th>
                                    <th className="p-3.5">Kategori</th>
                                    <th className="p-3.5 text-center">Trip Sistem (Resmi)</th>
                                    <th className="p-3.5 text-center">Kejadian Tanpa Sistem</th>
                                    <th className="p-3.5 text-center">Total Peminjaman</th>
                                    <th className="p-3.5 text-center min-w-[160px]">Persentase Kepatuhan</th>
                                    <th className="p-3.5 text-right">KM Sistem</th>
                                    <th className="p-3.5 text-right">KM Luar Sistem</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredVehicles.map(v => {
                                    return (
                                        <tr key={v.vehicleId} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="p-3.5">
                                                <div className="font-bold text-slate-900">{v.name}</div>
                                                <div className="text-[10px] font-mono text-slate-500">{v.plateNumber}</div>
                                            </td>
                                            <td className="p-3.5">
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                                                    {v.type}
                                                </span>
                                            </td>
                                            <td className="p-3.5 text-center">
                                                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-mono">
                                                    {v.systemTripsCount} Trip
                                                </span>
                                            </td>
                                            <td className="p-3.5 text-center">
                                                {v.discrepancyCount > 0 ? (
                                                    <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 font-mono">
                                                        {v.discrepancyCount} Kali
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 font-mono">0</span>
                                                )}
                                            </td>
                                            <td className="p-3.5 text-center font-bold text-slate-800 font-mono">
                                                {v.totalTrips}
                                            </td>
                                            <td className="p-3.5">
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-[10px] font-bold">
                                                        <span className="text-emerald-700">{v.systemPercent.toFixed(0)}% Sistem</span>
                                                        <span className="text-rose-600">{v.discrepancyPercent.toFixed(0)}% Luar</span>
                                                    </div>
                                                    <div className="w-full bg-rose-100 rounded-full h-1.5 overflow-hidden flex">
                                                        <div 
                                                            className="bg-emerald-500 h-full transition-all duration-300"
                                                            style={{ width: `${Math.min(100, Math.max(0, v.systemPercent))}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-3.5 text-right font-mono font-semibold text-slate-700">
                                                {v.systemKm.toLocaleString('id-ID')} KM
                                            </td>
                                            <td className="p-3.5 text-right font-mono font-bold text-rose-600">
                                                {v.discrepancyKm > 0 ? `+${v.discrepancyKm.toLocaleString('id-ID')} KM` : '-'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal Lightbox Foto Odometer Awal */}
            {previewPhoto && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <div>
                                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                                    <Camera size={16} className="text-blue-600" />
                                    <span>Bukti Foto Odometer Awal</span>
                                </h4>
                                <p className="text-xs text-slate-500">{previewPhoto.title} • {previewPhoto.date}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPreviewPhoto(null)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body / Image */}
                        <div className="p-4 overflow-y-auto flex flex-col items-center justify-center bg-slate-950/5">
                            <img
                                src={previewPhoto.url}
                                alt="Foto Odometer"
                                className="max-h-[55vh] w-auto rounded-xl object-contain border border-slate-200 shadow-md"
                            />

                            <div className="mt-3 w-full bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-center justify-between">
                                <div>
                                    <span className="text-xs text-rose-800 font-bold block">Terdeteksi Selisih Di Luar Sistem</span>
                                    <span className="text-[11px] text-rose-600">Pelapor: {previewPhoto.user}</span>
                                </div>
                                <span className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-xs font-black">
                                    +{previewPhoto.diff} KM
                                </span>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-3 border-t border-slate-100 flex justify-end bg-slate-50">
                            <button
                                type="button"
                                onClick={() => setPreviewPhoto(null)}
                                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VehicleDiscrepancyTab;
