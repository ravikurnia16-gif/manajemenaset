import { useState, useEffect } from 'react';
import { Warehouse, Package, ArrowDownCircle, ArrowUpCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../lib/axios';

const StatCard = ({ label, value, icon, color }) => (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white mb-4 shadow-sm`}>
            {icon}
        </div>
        <div className="text-2xl font-black text-slate-800">{value}</div>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">{label}</div>
    </div>
);

const WarehouseDashboard = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/warehouse/dashboard')
            .then(r => { setData(r.data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    if (loading) return (
        <div className="flex h-96 items-center justify-center">
            <Loader2 className="animate-spin text-indigo-600" size={40} />
        </div>
    );

    if (!data) return <div className="p-10 text-center text-slate-400">Gagal memuat data</div>;

    const cards = [
        { label: 'Total Item', value: data.totalItems, icon: <Package size={24} />, color: 'from-blue-500 to-cyan-500' },
        { label: 'Total Stok', value: data.totalStock?.toLocaleString('id-ID'), icon: <Warehouse size={24} />, color: 'from-indigo-500 to-purple-500' },
        { label: 'Stok Rendah', value: data.lowStockCount, icon: <AlertTriangle size={24} />, color: data.lowStockCount > 0 ? 'from-red-500 to-orange-500' : 'from-green-500 to-emerald-500' },
        { label: 'Masuk (Bulan Ini)', value: data.txInThisMonth, icon: <ArrowDownCircle size={24} />, color: 'from-emerald-500 to-teal-500' },
        { label: 'Keluar (Bulan Ini)', value: data.txOutThisMonth, icon: <ArrowUpCircle size={24} />, color: 'from-orange-500 to-amber-500' },
    ];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Warehouse className="text-indigo-600" /> Dashboard Gudang & Logistik
                </h1>
                <p className="text-sm text-slate-500 mt-1 italic">Ringkasan ketersediaan stok dan pergerakan barang habis pakai</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                {cards.map((c, i) => <StatCard key={i} {...c} />)}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Stock by Category Chart */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 font-display">Stok per Kategori</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <BarChart data={data.stockByCategory}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="total" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Low Stock Watchlist */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-slate-800">Watchlist Stok Rendah</h3>
                        <span className="px-2 py-1 bg-red-100 text-red-600 text-[10px] font-black rounded-md uppercase">Urgent</span>
                    </div>
                    {(data.lowStockItems || []).length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center text-green-500 mb-4">
                                <Package size={32} />
                            </div>
                            <p className="text-sm font-medium">Semua stok berada di level aman</p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
                            {data.lowStockItems.map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-transparent hover:border-red-100 transition-colors">
                                    <div>
                                        <div className="text-sm font-bold text-slate-800">{item.name} {item.size ? `(${item.size})` : ''}</div>
                                        <div className="text-[10px] text-slate-400 uppercase font-black tracking-tight">{item.category}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-black text-red-600">{item.stock}</div>
                                        <div className="text-[10px] text-slate-400 font-bold uppercase">Min: {item.minStock}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WarehouseDashboard;
