import { useState, useEffect } from 'react';
import { Users, ClipboardList, Calendar, FileText, TrendingUp, Loader2, Award, AlertCircle, CheckCircle2, Zap, Trophy } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { useNavigate } from 'react-router-dom';
import api from '../lib/axios';

const StatCard = ({ title, value, icon: Icon, color, trend, trendValue }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all group overflow-hidden relative">
        <div className="flex justify-between items-start z-10">
            <div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
                <h3 className="text-3xl font-extrabold text-slate-800">{value}</h3>
            </div>
            <div className={`p-3 rounded-xl ${color} text-white shadow-lg shadow-current/20 group-hover:scale-110 transition-transform`}>
                <Icon size={22} />
            </div>
        </div>
        {trend && (
            <div className="mt-4 flex items-center gap-2 z-10">
                <span className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${trend === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                    <TrendingUp size={10} className={trend === 'down' ? 'rotate-180' : ''} />
                    {trendValue}
                </span>
                <span className="text-[10px] text-slate-400 font-medium italic">vs bulan lalu</span>
            </div>
        )}
        {/* Subtle background decoration */}
        <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full ${color} opacity-[0.03] group-hover:scale-150 transition-transform duration-700`}></div>
    </div>
);

const PersonnelDashboard = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const userStr = localStorage.getItem('user');
    const currentUser = userStr ? JSON.parse(userStr) : {};
    const isAuthorized = ['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT'].includes(currentUser.role);
    const isTechAdmin = ['SUPER_ADMIN', 'BIDANG_IT'].includes(currentUser.role);
    const isKabidSarpras = currentUser.position?.toLowerCase().includes('kepala bidang') && 
                           currentUser.position?.toLowerCase().includes('sarana dan prasarana');
    const canSeeKPI = isKabidSarpras || isTechAdmin;

    useEffect(() => {
        if (!isAuthorized) {
            setError('Akses ditolak. Dashboard hanya untuk Admin Bidang Sarana dan Prasarana.');
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                const res = await api.get('/personnel/dashboard');
                setData(res.data);
            } catch (err) {
                setError(err.response?.data?.error || 'Gagal memuat data dari server Sarpras');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [isAuthorized]);

    if (loading) return (
        <div className="flex flex-col h-[70vh] items-center justify-center space-y-4">
            <Loader2 className="animate-spin text-indigo-600" size={48} />
            <p className="text-slate-500 font-medium animate-pulse">Menghubungkan ke Pusat Data Personalia...</p>
        </div>
    );

    if (error) return (
        <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-3xl border border-slate-200 shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AlertCircle size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Akses Terbatas</h3>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">{error}</p>
            <button
                onClick={() => navigate('/')}
                className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg"
            >
                Kembali ke Dashboard Utama
            </button>
        </div>
    );

    const stats = [
        { title: "Penugasan Aktif", value: data?.stats?.activeAssignments || 0, icon: ClipboardList, color: "bg-indigo-600", trend: "up", trendValue: "+12%" },
        { title: "Rutinitas Otomatis", value: data?.stats?.totalRoutines || 0, icon: Zap, color: "bg-emerald-500", trend: "up", trendValue: "Auto" },
        ...(canSeeKPI ? [{ title: "Top Performer", value: data?.stats?.topPerformer?.name?.split(' ')[0] || "-", icon: Trophy, color: "bg-amber-500", trend: "up", trendValue: `${data?.stats?.topPerformer?.score || 0}%` }] : []),
        { title: "Agenda Sarpras", value: data?.stats?.todayAgenda || 0, icon: Calendar, color: "bg-sky-500", trend: "down", trendValue: "-2" },
    ];

    const COLORS = ['#6366f1', '#f59e0b', '#0ea5e9', '#10b981', '#ef4444', '#94a3b8'];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 p-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Personnel Intelligence</h1>
                    <p className="text-slate-500 text-sm mt-1 font-medium flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-500" />
                        Pusat Kendali & Pemantauan Kinerja Staf Sarpras
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right hidden md:block">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Update Terakhir</p>
                        <p className="text-xs font-bold text-slate-700">{new Date().toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</p>
                    </div>
                    <div className="h-10 w-[1px] bg-slate-200 hidden md:block"></div>
                    <button onClick={() => window.location.reload()} className="bg-slate-50 hover:bg-slate-100 p-2.5 rounded-xl border border-slate-200 text-slate-600 transition-all">
                        <Loader2 size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((s, i) => <StatCard key={i} {...s} />)}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. Progres Aktivitas Laporan */}
                <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">Tren Laporan Harian</h3>
                            <p className="text-xs text-slate-400 font-medium">Monitoring volume pelaporan 7 hari terakhir</p>
                        </div>
                        <select className="bg-slate-50 border-none text-xs font-bold text-slate-500 rounded-lg p-1.5 focus:ring-0">
                            <option>7 Hari Terakhir</option>
                            <option>30 Hari Terakhir</option>
                        </select>
                    </div>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data?.reportTrends}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', border: 'none', color: '#fff', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                                    itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                                    labelStyle={{ display: 'none' }}
                                />
                                <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Status Penugasan Tim */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Beban Kerja Staf</h3>
                    <p className="text-xs text-slate-400 font-medium mb-8">Distribusi status tugas saat ini</p>
                    
                    <div className="flex-1 flex justify-center items-center relative">
                        <div className="absolute flex flex-col items-center">
                            <span className="text-3xl font-black text-slate-800">{data?.stats?.activeAssignments || 0}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tugas</span>
                        </div>
                        <ResponsiveContainer width="100%" height={240}>
                            <PieChart>
                                <Pie
                                    data={data?.assignmentStatus || []}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={75}
                                    outerRadius={100}
                                    stroke="none"
                                    paddingAngle={8}
                                    dataKey="value"
                                >
                                    {(data?.assignmentStatus || []).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={10} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mt-8">
                        {(data?.assignmentStatus || []).slice(0, 4).map((entry, index) => (
                            <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="w-2.5 h-2.5 rounded-full ring-2 ring-white" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{entry.name}</span>
                                    <span className="text-xs font-black text-slate-700">{entry.value} Items</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Quick Actions / Professional Footer */}
            <div className="bg-slate-900 rounded-3xl p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-slate-900/20 overflow-hidden relative">
                <div className="z-10">
                    <h2 className="text-2xl font-bold mb-2">Siap Kelola Tugas Hari Ini?</h2>
                    <p className="text-slate-400 text-sm font-medium">Beri penugasan baru kepada staf atau reviu laporan yang masuk.</p>
                </div>
                <div className="flex flex-wrap gap-4 z-10 w-full md:w-auto">
                    <button onClick={() => navigate('/personalia/penugasan')} className="flex-1 md:flex-none px-6 py-3 bg-white text-slate-900 rounded-2xl font-bold hover:bg-slate-50 transition-all shadow-lg text-xs tracking-widest uppercase">
                        Beri Penugasan
                    </button>
                    <button onClick={() => navigate('/personalia/rutin')} className="flex-1 md:flex-none px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg text-xs tracking-widest uppercase border border-indigo-400/30">
                        Atur Rutinitas
                    </button>
                    {canSeeKPI && (
                        <button onClick={() => navigate('/personalia/kpi')} className="flex-1 md:flex-none px-6 py-3 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-700 transition-all text-xs tracking-widest uppercase border border-slate-700">
                            Papan KPI
                        </button>
                    )}
                </div>
                {/* Decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-slate-400/10 rounded-full -ml-10 -mb-10 blur-2xl"></div>
            </div>
        </div>
    );
};

export default PersonnelDashboard;
