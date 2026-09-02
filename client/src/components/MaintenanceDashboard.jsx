import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Wrench, CheckCircle, AlertTriangle, TrendingUp, Loader2, Clock, Zap, Calendar, CalendarRange, RotateCcw } from 'lucide-react';
import api from '../lib/axios';
import { useNavigate } from 'react-router-dom';

const StatCard = ({ title, value, icon: Icon, color, bg, subtitle }) => (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all">
        <div className="flex justify-between items-start mb-4">
            <div>
                <p className="text-slate-500 text-sm font-semibold mb-1">{title}</p>
                <h3 className="text-2xl font-black text-slate-800">{value}</h3>
            </div>
            <div className={`p-3 rounded-xl ${bg} ${color}`}>
                <Icon size={24} strokeWidth={2.5} />
            </div>
        </div>
        {subtitle && (
            <p className="text-xs text-slate-500 font-medium">{subtitle}</p>
        )}
    </div>
);

const MONTH_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const MaintenanceDashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Period Mode: 'MONTH' (Bulan & Tahun) | 'RANGE' (Rentang Tanggal Custom)
    const [periodMode, setPeriodMode] = useState('MONTH');
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());

    // Custom date range state
    const todayStr = new Date().toISOString().split('T')[0];
    const firstDayStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(firstDayStr);
    const [endDate, setEndDate] = useState(todayStr);

    const navigate = useNavigate();

    useEffect(() => {
        fetchStats();
    }, [periodMode, month, year, startDate, endDate]);

    const fetchStats = async () => {
        try {
            setLoading(true);
            let url = '/maintenance/stats/dashboard';
            if (periodMode === 'RANGE') {
                if (!startDate || !endDate) return;
                url += `?startDate=${startDate}&endDate=${endDate}`;
            } else {
                url += `?month=${month}&year=${year}`;
            }

            const response = await api.get(url);
            setStats(response.data);
            setError(null);
        } catch (err) {
            setError(err.response?.data?.error || 'Gagal mengambil data statistik');
        } finally {
            setLoading(false);
        }
    };

    // Preset Range Helpers
    const setPresetRange = (type) => {
        const now = new Date();
        const endStr = now.toISOString().split('T')[0];
        let start = new Date();

        if (type === 'TODAY') {
            setStartDate(endStr);
            setEndDate(endStr);
        } else if (type === '7DAYS') {
            start.setDate(now.getDate() - 7);
            setStartDate(start.toISOString().split('T')[0]);
            setEndDate(endStr);
        } else if (type === '30DAYS') {
            start.setDate(now.getDate() - 30);
            setStartDate(start.toISOString().split('T')[0]);
            setEndDate(endStr);
        } else if (type === 'THIS_MONTH') {
            const first = new Date(now.getFullYear(), now.getMonth(), 1);
            setStartDate(first.toISOString().split('T')[0]);
            setEndDate(endStr);
        } else if (type === 'THIS_YEAR') {
            const first = new Date(now.getFullYear(), 0, 1);
            setStartDate(first.toISOString().split('T')[0]);
            setEndDate(endStr);
        }
    };

    if (loading && !stats) {
        return (
            <div className="flex items-center justify-center p-16">
                <Loader2 size={32} className="animate-spin text-blue-500" />
            </div>
        );
    }

    if (error && !stats) {
        return (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-200 text-sm text-center">
                {error || 'Data tidak tersedia'}
            </div>
        );
    }

    const periodLabelFormatted = stats?.periodInfo?.formattedRange || (
        periodMode === 'MONTH' 
            ? `${MONTH_NAMES[month - 1]} ${year}` 
            : `${startDate} s/d ${endDate}`
    );

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Period Filter Card with Date Range */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    {/* Header with Active Date Range display */}
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                            <CalendarRange size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-slate-800">Periode Statistik</h4>
                                <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                    {periodMode === 'MONTH' ? 'Mode Bulan' : 'Mode Rentang Tanggal'}
                                </span>
                            </div>
                            <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mt-0.5">
                                <Calendar size={13} className="text-blue-500" />
                                Rentang Aktif: <strong className="text-slate-700">{periodLabelFormatted}</strong>
                            </p>
                        </div>
                    </div>

                    {/* Mode Switcher Tabs */}
                    <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600 self-stretch sm:self-auto">
                        <button
                            onClick={() => setPeriodMode('MONTH')}
                            className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg transition-all ${
                                periodMode === 'MONTH'
                                    ? 'bg-white text-blue-600 shadow-xs font-extrabold'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            Pilih Bulan & Tahun
                        </button>
                        <button
                            onClick={() => setPeriodMode('RANGE')}
                            className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg transition-all ${
                                periodMode === 'RANGE'
                                    ? 'bg-white text-blue-600 shadow-xs font-extrabold'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            Rentang Tanggal Khusus
                        </button>
                    </div>
                </div>

                {/* Controls depending on mode */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    {periodMode === 'MONTH' ? (
                        <div className="flex flex-wrap items-center gap-2.5">
                            <select 
                                value={month} 
                                onChange={e => setMonth(parseInt(e.target.value))}
                                className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {MONTH_NAMES.map((m, i) => (
                                    <option key={i+1} value={i+1}>{m}</option>
                                ))}
                            </select>
                            <select 
                                value={year} 
                                onChange={e => setYear(parseInt(e.target.value))}
                                className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {[2024, 2025, 2026, 2027, 2028].map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                            
                            {(month !== new Date().getMonth() + 1 || year !== new Date().getFullYear()) && (
                                <button 
                                    onClick={() => { setMonth(new Date().getMonth() + 1); setYear(new Date().getFullYear()); }}
                                    className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-xl transition-colors inline-flex items-center gap-1"
                                >
                                    <RotateCcw size={13} /> Reset ke Bulan Ini
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-wrap items-center gap-2.5 w-full">
                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-700">
                                <span className="text-slate-400 font-bold">Dari:</span>
                                <input 
                                    type="date"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                    className="bg-transparent font-semibold outline-none text-slate-700 cursor-pointer"
                                />
                            </div>

                            <span className="text-slate-400 text-xs font-bold">s/d</span>

                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-700">
                                <span className="text-slate-400 font-bold">Sampai:</span>
                                <input 
                                    type="date"
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                    className="bg-transparent font-semibold outline-none text-slate-700 cursor-pointer"
                                />
                            </div>

                            {/* Preset Buttons */}
                            <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                                <span className="text-[11px] text-slate-400 font-semibold mr-1 hidden sm:inline">Pilihan Cepat:</span>
                                <button 
                                    type="button"
                                    onClick={() => setPresetRange('7DAYS')}
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors"
                                >
                                    7 Hari
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setPresetRange('30DAYS')}
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors"
                                >
                                    30 Hari
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setPresetRange('THIS_MONTH')}
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors"
                                >
                                    Bulan Ini
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setPresetRange('THIS_YEAR')}
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors"
                                >
                                    Tahun Ini
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    title={periodMode === 'MONTH' ? `Biaya Bulan ${MONTH_NAMES[month - 1]}` : 'Biaya Periode Terpilih'} 
                    value={`Rp ${stats?.totalCostThisMonth?.toLocaleString('id-ID') || 0}`} 
                    icon={TrendingUp} 
                    color="text-blue-600" 
                    bg="bg-blue-50"
                    subtitle={`Total biaya (${periodLabelFormatted})`}
                />
                <StatCard 
                    title="Laporan Aktif" 
                    value={stats?.activeReportsCount || 0} 
                    icon={Wrench} 
                    color="text-orange-600" 
                    bg="bg-orange-50"
                    subtitle="Dalam proses perbaikan"
                />
                <StatCard 
                    title="Aset Overdue" 
                    value={stats?.overdueAssetsCount || 0} 
                    icon={AlertTriangle} 
                    color="text-red-600" 
                    bg="bg-red-50"
                    subtitle="Telat jadwal servis rutin"
                />
                <StatCard 
                    title="Total Penyelesaian" 
                    value={stats?.monthlyTrend?.reduce((sum, m) => sum + m.count, 0) || 0} 
                    icon={CheckCircle} 
                    color="text-green-600" 
                    bg="bg-green-50"
                    subtitle="Laporan selesai (6 Bulan terakhir)"
                />
            </div>

            {/* SLA Performance Section */}
            {stats?.slaStats && (
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                    <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Zap className="text-amber-500" size={20} />
                            <div>
                                <h3 className="text-base font-bold text-slate-800">SLA Perbaikan (Khusus Sarpras)</h3>
                                <p className="text-xs text-slate-500">Rata-rata waktu penyelesaian dari laporan dibuat hingga diselesaikan</p>
                            </div>
                        </div>
                        <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                            Periode: {periodLabelFormatted}
                        </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl border border-indigo-100 p-5 shadow-sm border-l-4 border-l-indigo-500">
                            <p className="text-slate-500 text-sm font-semibold mb-1">Rata-rata Keseluruhan</p>
                            <h3 className="text-2xl font-black text-indigo-700">{(stats.slaStats?.overallAvgDays || 0).toFixed(1)} <span className="text-sm font-medium text-slate-500">Hari</span></h3>
                            <p className="text-xs text-slate-400 mt-1">Kecepatan rata-rata Sarpras</p>
                        </div>
                        
                        <div className="bg-white rounded-xl border border-red-100 p-5 shadow-sm border-l-4 border-l-red-500">
                            <p className="text-slate-500 text-sm font-semibold mb-1">Darurat (Emergency)</p>
                            <h3 className="text-2xl font-black text-red-600">{(stats.slaStats?.byUrgency?.EMERGENCY?.avgDays || 0).toFixed(1)} <span className="text-sm font-medium text-slate-500">Hari</span></h3>
                            <p className="text-xs text-slate-400 mt-1">{stats.slaStats?.byUrgency?.EMERGENCY?.count || 0} laporan selesai</p>
                        </div>
                        
                        <div className="bg-white rounded-xl border border-amber-100 p-5 shadow-sm border-l-4 border-l-amber-500">
                            <p className="text-slate-500 text-sm font-semibold mb-1">Penting (Urgent)</p>
                            <h3 className="text-2xl font-black text-amber-600">{(stats.slaStats?.byUrgency?.URGENT?.avgDays || 0).toFixed(1)} <span className="text-sm font-medium text-slate-500">Hari</span></h3>
                            <p className="text-xs text-slate-400 mt-1">{stats.slaStats?.byUrgency?.URGENT?.count || 0} laporan selesai</p>
                        </div>
                        
                        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm border-l-4 border-l-slate-400">
                            <p className="text-slate-500 text-sm font-semibold mb-1">Biasa (Normal)</p>
                            <h3 className="text-2xl font-black text-slate-700">{(stats.slaStats?.byUrgency?.NORMAL?.avgDays || 0).toFixed(1)} <span className="text-sm font-medium text-slate-500">Hari</span></h3>
                            <p className="text-xs text-slate-400 mt-1">{stats.slaStats?.byUrgency?.NORMAL?.count || 0} laporan selesai</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Initial Response Speed Section (Sarpras Only) */}
            {stats?.initialResponseStats && (
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                    <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Clock className="text-blue-500" size={20} />
                            <div>
                                <h3 className="text-base font-bold text-slate-800">Kecepatan Respon Awal (Sarpras)</h3>
                                <p className="text-xs text-slate-500">Rata-rata waktu respon pertama (Setujui/Tolak) — hari kerja Senin-Jumat</p>
                            </div>
                        </div>
                        <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                            Periode: {periodLabelFormatted}
                        </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl border border-blue-100 p-5 shadow-sm border-l-4 border-l-blue-500">
                            <p className="text-slate-500 text-sm font-semibold mb-1">Rata-rata Keseluruhan</p>
                            <h3 className="text-2xl font-black text-blue-700">{(stats.initialResponseStats?.overallAvgHours || 0).toFixed(1)} <span className="text-sm font-medium text-slate-500">Jam</span></h3>
                            <p className="text-xs text-slate-400 mt-1">{stats.initialResponseStats?.totalResponded || 0} laporan direspon</p>
                        </div>
                        
                        <div className="bg-white rounded-xl border border-red-100 p-5 shadow-sm border-l-4 border-l-red-500">
                            <p className="text-slate-500 text-sm font-semibold mb-1">Darurat (Emergency)</p>
                            <h3 className="text-2xl font-black text-red-600">{(stats.initialResponseStats?.byUrgency?.EMERGENCY?.avgHours || 0).toFixed(1)} <span className="text-sm font-medium text-slate-500">Jam</span></h3>
                            <p className="text-xs text-slate-400 mt-1">{stats.initialResponseStats?.byUrgency?.EMERGENCY?.count || 0} laporan direspon</p>
                        </div>
                        
                        <div className="bg-white rounded-xl border border-amber-100 p-5 shadow-sm border-l-4 border-l-amber-500">
                            <p className="text-slate-500 text-sm font-semibold mb-1">Penting (Urgent)</p>
                            <h3 className="text-2xl font-black text-amber-600">{(stats.initialResponseStats?.byUrgency?.URGENT?.avgHours || 0).toFixed(1)} <span className="text-sm font-medium text-slate-500">Jam</span></h3>
                            <p className="text-xs text-slate-400 mt-1">{stats.initialResponseStats?.byUrgency?.URGENT?.count || 0} laporan direspon</p>
                        </div>
                        
                        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm border-l-4 border-l-slate-400">
                            <p className="text-slate-500 text-sm font-semibold mb-1">Biasa (Normal)</p>
                            <h3 className="text-2xl font-black text-slate-700">{(stats.initialResponseStats?.byUrgency?.NORMAL?.avgHours || 0).toFixed(1)} <span className="text-sm font-medium text-slate-500">Jam</span></h3>
                            <p className="text-xs text-slate-400 mt-1">{stats.initialResponseStats?.byUrgency?.NORMAL?.count || 0} laporan direspon</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Cost Trend Chart */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-slate-800">Tren Biaya Pemeliharaan</h3>
                        <p className="text-sm text-slate-500">Total biaya yang dikeluarkan dalam 6 bulan terakhir</p>
                    </div>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats?.monthlyTrend || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 12, fill: '#64748b' }}
                                    tickFormatter={(value) => `Rp ${(value/1000000).toFixed(1)}Jt`}
                                    dx={-10}
                                />
                                <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value) => [`Rp ${value.toLocaleString('id-ID')}`, 'Total Biaya']}
                                />
                                <Area type="monotone" dataKey="cost" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCost)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Recent Active Reports */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col">
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-800">Laporan Butuh Tindakan</h3>
                        <p className="text-sm text-slate-500">5 laporan terbaru yang masih aktif</p>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-3">
                        {stats?.recentReports?.length > 0 ? (
                            stats.recentReports.map(report => (
                                <div 
                                    key={report.id}
                                    onClick={() => navigate(`/maintenance/${report.id}`)}
                                    className="p-3 border border-slate-100 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{report.code}</span>
                                        <span className="text-[10px] text-slate-400 font-medium">
                                            {new Date(report.createdAt).toLocaleDateString('id-ID')}
                                        </span>
                                    </div>
                                    <h4 className="text-sm font-semibold text-slate-800 line-clamp-1">{report.title}</h4>
                                    <p className="text-xs text-slate-500 mt-1">{report.unit?.name || 'Umum'}</p>
                                </div>
                            ))
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10">
                                <CheckCircle size={32} className="mb-2 text-slate-300" />
                                <p className="text-sm font-medium">Tidak ada laporan aktif</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MaintenanceDashboard;
