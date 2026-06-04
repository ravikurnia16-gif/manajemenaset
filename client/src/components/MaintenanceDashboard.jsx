import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Wrench, CheckCircle, AlertTriangle, TrendingUp, Loader2, Clock, Zap, Calendar } from 'lucide-react';
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

const MaintenanceDashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const navigate = useNavigate();

    useEffect(() => {
        fetchStats();
    }, [month, year]);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/maintenance/stats/dashboard?month=${month}&year=${year}`);
            setStats(response.data);
            setError(null);
        } catch (err) {
            setError(err.response?.data?.error || 'Gagal mengambil data statistik');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 size={32} className="animate-spin text-blue-500" />
            </div>
        );
    }

    if (error || !stats) {
        return (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-200 text-sm text-center">
                {error || 'Data tidak tersedia'}
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Month & Year Picker */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                        <Calendar size={20} />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-slate-800">Periode Statistik</h4>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Pilih Bulan & Tahun</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <select 
                        value={month} 
                        onChange={e => setMonth(parseInt(e.target.value))}
                        className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((m, i) => (
                            <option key={i+1} value={i+1}>{m}</option>
                        ))}
                    </select>
                    <select 
                        value={year} 
                        onChange={e => setYear(parseInt(e.target.value))}
                        className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {[2024, 2025, 2026, 2027].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                    {/* Reset to current month */}
                    {(month !== new Date().getMonth() + 1 || year !== new Date().getFullYear()) && (
                        <button 
                            onClick={() => { setMonth(new Date().getMonth() + 1); setYear(new Date().getFullYear()); }}
                            className="text-xs font-bold text-blue-600 hover:underline px-2"
                        >
                            Bulan Ini
                        </button>
                    )}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    title="Biaya Bulan Ini" 
                    value={`Rp ${stats.totalCostThisMonth?.toLocaleString('id-ID') || 0}`} 
                    icon={TrendingUp} 
                    color="text-blue-600" 
                    bg="bg-blue-50"
                    subtitle="Total pengeluaran perawatan"
                />
                <StatCard 
                    title="Laporan Aktif" 
                    value={stats.activeReportsCount} 
                    icon={Wrench} 
                    color="text-orange-600" 
                    bg="bg-orange-50"
                    subtitle="Dalam proses perbaikan"
                />
                <StatCard 
                    title="Aset Overdue" 
                    value={stats.overdueAssetsCount} 
                    icon={AlertTriangle} 
                    color="text-red-600" 
                    bg="bg-red-50"
                    subtitle="Telat jadwal servis rutin"
                />
                <StatCard 
                    title="Total Penyelesaian" 
                    value={stats.monthlyTrend?.reduce((sum, m) => sum + m.count, 0) || 0} 
                    icon={CheckCircle} 
                    color="text-green-600" 
                    bg="bg-green-50"
                    subtitle="Laporan selesai (6 Bulan)"
                />
            </div>

            {/* SLA Performance Section */}
            {stats.slaStats && (
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                    <div className="mb-4 flex items-center gap-2">
                        <Zap className="text-amber-500" size={20} />
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">SLA Perbaikan (Khusus Sarpras)</h3>
                            <p className="text-xs text-slate-500">Rata-rata waktu penyelesaian dari laporan dibuat hingga diselesaikan</p>
                        </div>
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
            {stats.initialResponseStats && (
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                    <div className="mb-4 flex items-center gap-2">
                        <Clock className="text-blue-500" size={20} />
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">Kecepatan Respon Awal (Sarpras)</h3>
                            <p className="text-xs text-slate-500">Rata-rata waktu respon pertama (Setujui/Tolak) — hari kerja Senin-Jumat</p>
                        </div>
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
                            <AreaChart data={stats.monthlyTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
                        {stats.recentReports?.length > 0 ? (
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
