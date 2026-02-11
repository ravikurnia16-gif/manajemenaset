import { useState, useEffect } from 'react';
import { Warehouse, Package, ArrowDownCircle, ArrowUpCircle, AlertTriangle } from 'lucide-react';
import api from '../lib/axios';

const WarehouseDashboard = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/warehouse/dashboard').then(r => { setData(r.data); setLoading(false); }).catch(() => setLoading(false));
    }, []);

    if (loading) return <div className="p-10 text-center text-slate-400">Memuat dashboard...</div>;
    if (!data) return <div className="p-10 text-center text-slate-400">Gagal memuat data</div>;

    const cards = [
        { label: 'Total Item', value: data.totalItems, icon: <Package size={22} />, color: 'from-blue-500 to-cyan-500' },
        { label: 'Total Stok', value: data.totalStock?.toLocaleString('id-ID'), icon: <Warehouse size={22} />, color: 'from-indigo-500 to-purple-500' },
        { label: 'Stok Rendah', value: data.lowStockCount, icon: <AlertTriangle size={22} />, color: data.lowStockCount > 0 ? 'from-red-500 to-orange-500' : 'from-green-500 to-emerald-500' },
        { label: 'Masuk Bulan Ini', value: data.txInThisMonth, icon: <ArrowDownCircle size={22} />, color: 'from-green-500 to-emerald-500' },
        { label: 'Keluar Bulan Ini', value: data.txOutThisMonth, icon: <ArrowUpCircle size={22} />, color: 'from-orange-500 to-amber-500' },
    ];

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Warehouse className="text-indigo-600" /> Dashboard Gudang</h1>
                <p className="text-sm text-slate-500 mt-1">Ringkasan stok dan transaksi gudang</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {cards.map((c, i) => (
                    <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-lg transition-shadow">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${c.color} flex items-center justify-center text-white mb-3`}>{c.icon}</div>
                        <div className="text-2xl font-bold text-slate-800">{c.value}</div>
                        <div className="text-xs text-slate-500 mt-1">{c.label}</div>
                    </div>
                ))}
            </div>

            {/* Stock by Category */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-600 mb-3">Stok per Kategori</h3>
                    <div className="space-y-3">
                        {(data.stockByCategory || []).map((c, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <span className="text-sm text-slate-700">{c.name}</span>
                                <span className="text-sm font-bold text-slate-800">{c.total.toLocaleString('id-ID')} pcs</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Low Stock Alert */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-red-600 mb-3 flex items-center gap-1"><AlertTriangle size={14} /> Stok Rendah</h3>
                    {(data.lowStockItems || []).length === 0 ? (
                        <p className="text-sm text-green-600">✅ Semua stok aman</p>
                    ) : (
                        <div className="space-y-2">
                            {data.lowStockItems.map((item, i) => (
                                <div key={i} className="flex items-center justify-between text-sm p-2 bg-red-50 rounded-lg">
                                    <span className="text-slate-700">{item.name} {item.size ? `(${item.size})` : ''}</span>
                                    <span className="font-bold text-red-600">{item.stock} / {item.minStock}</span>
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
