import { Search, Plus } from 'lucide-react';
import { Badge } from '../components/UIComponents';

export const StockTab = ({ stocks, loading, search, setSearch, selectedWarehouse, setSelectedWarehouse, warehouses, openModal }) => (
    <div className="space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="text" placeholder="Cari nama barang atau SKU..." className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none" value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}>
                <option value="">Semua Gudang</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <button onClick={() => openModal('transaction')} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/20">
                <Plus size={14} /> Transaksi Stok
            </button>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                    <tr>
                        <th className="p-3 text-left">SKU</th>
                        <th className="p-3 text-left">Barang</th>
                        <th className="p-3 text-center">Ukuran</th>
                        <th className="p-3 text-center">Gudang</th>
                        <th className="p-3 text-center">Stok</th>
                        <th className="p-3 text-center">Min</th>
                        <th className="p-3 text-right">HPP</th>
                        <th className="p-3 text-center">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {loading ? (
                        <tr><td colSpan="8" className="p-8 text-center text-slate-400">Memuat data...</td></tr>
                    ) : stocks.length === 0 ? (
                        <tr><td colSpan="8" className="p-8 text-center text-slate-400">Belum ada data stok.</td></tr>
                    ) : stocks.map(s => (
                        <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 font-mono text-xs text-slate-400">{s.variant?.sku}</td>
                            <td className="p-3 font-bold text-slate-800">{s.variant?.item?.name}</td>
                            <td className="p-3 text-center"><Badge>{s.variant?.size}</Badge></td>
                            <td className="p-3 text-center text-xs text-slate-500">{s.warehouse?.name}</td>
                            <td className="p-3 text-center"><span className={`font-extrabold text-lg ${s.quantity <= s.minStock ? 'text-red-500' : 'text-slate-700'}`}>{s.quantity}</span></td>
                            <td className="p-3 text-center text-slate-400">{s.minStock}</td>
                            <td className="p-3 text-right text-slate-600">Rp {(s.avgCost || 0).toLocaleString('id-ID')}</td>
                            <td className="p-3 text-center">
                                {s.quantity <= 0 ? <Badge color="red">Habis</Badge> : s.quantity <= s.minStock ? <Badge color="orange">Menipis</Badge> : <Badge color="green">Aman</Badge>}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);
