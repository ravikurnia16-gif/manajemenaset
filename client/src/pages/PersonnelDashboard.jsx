import { useState, useEffect } from 'react';
import { Users, ClipboardList, Calendar, FileText, TrendingUp, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';
import api from '../lib/axios';

const StatCard = ({ title, value, icon: Icon, color, desc }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between">
        <div>
            <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
            <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
            {desc && <p className="text-xs text-slate-400 mt-2">{desc}</p>}
        </div>
        <div className={`p-3 rounded-lg ${color} text-white shadow-md`}>
            <Icon size={24} />
        </div>
    </div>
);

const PersonnelDashboard = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const userStr = localStorage.getItem('user');
    const currentUser = userStr ? JSON.parse(userStr) : {};
    const isAuthorized = ['SUPER_ADMIN', 'ADMIN_ASET'].includes(currentUser.role);

    useEffect(() => {
        if (!isAuthorized) {
            setError('Akses ditolak. Dashboard hanya untuk Admin.');
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                const res = await api.get('/personnel/dashboard');
                setData(res.data);
            } catch (err) {
                setError(err.response?.data?.error || 'Gagal memuat data');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [isAuthorized]);

    if (loading) return (
        <div className="flex h-96 items-center justify-center">
            <Loader2 className="animate-spin text-indigo-600" size={40} />
        </div>
    );

    if (error) return (
        <div className="bg-red-50 p-8 rounded-2xl border border-red-100 text-center">
            <h3 className="text-red-800 font-bold mb-2">Akses Terbatas</h3>
            <p className="text-red-600 text-sm mb-4">{error}</p>
            <button
                onClick={() => navigate('/')}
                className="px-4 py-2 bg-white border border-red-200 text-red-700 rounded-lg text-sm font-bold shadow-sm"
            >
                Kembali ke Beranda
            </button>
        </div>
    );

    const stats = [
        { title: "Total Personel", value: data?.stats?.totalPersonnel || 0, icon: Users, color: "bg-indigo-500", desc: "Staf Bidang Sarana dan Prasarana" },
        { title: "Tugas Aktif", value: data?.stats?.activeAssignments || 0, icon: ClipboardList, color: "bg-amber-500", desc: "Belum dinyatakan selesai" },
        { title: "Agenda Hari Ini", value: data?.stats?.todayAgenda || 0, icon: Calendar, color: "bg-sky-500", desc: "Kegiatan di kalender" },
        { title: "Laporan Terkini", value: data?.stats?.pendingReports || 0, icon: FileText, color: "bg-emerald-500", desc: "7 hari terakhir" },
    ];

    const COLORS = ['#6366f1', '#f59e0b', '#0ea5e9', '#10b981', '#ef4444', '#94a3b8'];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Dashboard Personalia</h1>
                <p className="text-slate-500 text-sm italic">Ringkasan aktivitas dan kinerja staf Sarpras</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((s, i) => <StatCard key={i} {...s} />)}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Tren Laporan Mingguan */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Aktivitas Laporan (7 Hari)</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data?.reportTrends}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ fill: '#f8fafc' }}
                                />
                                <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={35} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Status Penugasan */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Status Penugasan</h3>
                    <div className="h-72 flex justify-center items-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data?.assignmentStatus || []}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {(data?.assignmentStatus || []).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-4 mt-2 flex-wrap">
                        {(data?.assignmentStatus || []).map((entry, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase">{entry.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PersonnelDashboard;
