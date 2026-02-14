import { useState, useEffect } from 'react';
import { Box, DollarSign, AlertTriangle, TrendingDown, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../lib/axios';

const StatCard = ({ title, value, icon: Icon, color, desc }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between">
        <div>
            <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
            <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
            {desc && <p className="text-xs text-slate-400 mt-2">{desc}</p>}
        </div>
        <div className={`p-3 rounded-lg ${color} bg-opacity-90 shadow-md`}>
            <Icon className="text-white" size={24} />
        </div>
    </div>
);

const Dashboard = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filterUnit, setFilterUnit] = useState('all');

    const userStr = localStorage.getItem('user');
    const currentUser = userStr ? JSON.parse(userStr) : {};
    const canFilterUnit = ['SUPER_ADMIN', 'ADMIN_ASET'].includes(currentUser.role);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const params = filterUnit !== 'all' ? { unitId: filterUnit } : {};
            const response = await api.get('/dashboard/stats', { params });
            setData(response.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, [filterUnit]);

    if (loading && !data) return (
        <div className="flex h-96 items-center justify-center">
            <Loader2 className="animate-spin text-blue-600" size={40} />
        </div>
    );

    const stats = [
        { title: "Total Aset", value: data?.stats?.totalAssets?.toLocaleString() || '0', icon: Box, color: "bg-blue-500", desc: "Total item terdaftar" },
        { title: "Nilai Buku (Terkini)", value: `Rp ${(data?.stats?.totalValue || 0).toLocaleString()}`, icon: DollarSign, color: "bg-emerald-500", desc: "Estimasi nilai buku saat ini" },
        { title: "Aset Rusak", value: data?.stats?.damagedAssets?.toLocaleString() || '0', icon: AlertTriangle, color: "bg-red-500", desc: "Perlu perhatian" },
        { title: "Habis Umur", value: data?.stats?.expiredAssets?.toLocaleString() || '0', icon: TrendingDown, color: "bg-orange-500", desc: "Melewati masa manfaat" },
    ];

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
                    <p className="text-slate-500 text-sm italic">
                        {filterUnit !== 'all'
                            ? `Menampilkan data untuk: ${data?.units?.find(u => u.id === parseInt(filterUnit))?.name || 'Unit Spesifik'}`
                            : 'Ringkasan statistik aset seluruh perusahaan'}
                    </p>
                </div>
                {canFilterUnit && (
                    <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
                        <span className="text-xs font-bold text-slate-400 ml-2 uppercase">Filter Unit:</span>
                        <select
                            value={filterUnit}
                            onChange={(e) => setFilterUnit(e.target.value)}
                            className="text-sm border-none bg-transparent focus:ring-0 text-slate-700 font-semibold cursor-pointer"
                        >
                            <option value="all">Semua Unit</option>
                            {data?.units?.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((s, i) => <StatCard key={i} {...s} />)}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-slate-700">Statistik Pengadaan Aset</h3>
                        <select className="text-sm border-slate-200 rounded-md text-slate-500 bg-slate-50 p-1">
                            <option>Tahun Ini</option>
                            <option>Tahun Lalu</option>
                        </select>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data?.chartData || []}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ fill: '#f1f5f9' }}
                                />
                                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-700 mb-6">Komposisi Kategori</h3>
                    <div className="h-72 flex justify-center items-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data?.pieData || []}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={110}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {(data?.pieData || []).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-4 mt-4 flex-wrap">
                        {(data?.pieData || []).map((entry, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                <span className="text-xs text-slate-500">{entry.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Unit Statistics Table - Only show if not specifically filtering one unit and data exists */}
            {canFilterUnit && filterUnit === 'all' && data?.unitStats?.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-in zoom-in-95 duration-300">
                    <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-white">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Box className="text-blue-600" size={20} /> Sebaran Aset per Unit
                        </h3>
                        <span className="text-xs font-medium text-slate-400 italic">Data terurut berdasarkan jumlah aset terbanyak</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Unit / Satker</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Total Item</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Rusak Ringan/Berat</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Nilai Buku Saat Ini</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {data.unitStats.map((unit) => (
                                    <tr key={unit.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700 text-sm">{unit.name}</span>
                                                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">{unit.code}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                                                {unit.assetCount}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${unit.damagedCount > 0 ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-400'}`}>
                                                {unit.damagedCount}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="font-bold text-slate-600 text-sm">
                                                Rp {unit.totalValue.toLocaleString()}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
