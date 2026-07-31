import { Search, ShoppingCart } from 'lucide-react';
import { Badge } from './UIComponents';

export const SalesTab = ({ sales, loading, search, setSearch, openModal }) => (
    <div className="space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="text" placeholder="Cari kode, nama pelanggan, atau siswa..." className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button onClick={() => openModal('sale')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700">
                <ShoppingCart size={14} /> Buat Pesanan
            </button>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                    <tr>
                        <th className="p-3 text-left">Invoice</th>
                        <th className="p-3 text-left">Pelanggan</th>
                        <th className="p-3 text-center">Tipe</th>
                        <th className="p-3 text-right">Total</th>
                        <th className="p-3 text-center">Bayar</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-center">Tanggal</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {loading ? (
                        <tr><td colSpan="7" className="p-8 text-center text-slate-400">Memuat data...</td></tr>
                    ) : sales.length === 0 ? (
                        <tr><td colSpan="7" className="p-8 text-center text-slate-400">Belum ada transaksi pesanan.</td></tr>
                    ) : sales.map(s => (
                        <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 font-mono text-xs text-slate-400">{s.code}</td>
                            <td className="p-3">
                                <div className="font-bold text-slate-800">{s.customerName}</div>
                                {s.studentName && <div className="text-[10px] text-slate-400">Siswa: {s.studentName}</div>}
                            </td>
                            <td className="p-3 text-center"><Badge color={s.type === 'SPMB' ? 'purple' : s.type === 'UNIT_ORDER' ? 'blue' : 'slate'}>{s.type}</Badge></td>
                            <td className="p-3 text-right font-bold text-slate-700">Rp {(s.totalAmount || 0).toLocaleString('id-ID')}</td>
                            <td className="p-3 text-center">
                                <Badge color={s.paymentStatus === 'PAID' ? 'green' : s.paymentStatus === 'PARTIAL' ? 'orange' : 'red'}>{s.paymentStatus}</Badge>
                            </td>
                            <td className="p-3 text-center">
                                <Badge color={s.status === 'COMPLETED' ? 'green' : s.status === 'PARTIAL_DELIVERED' ? 'orange' : 'slate'}>{s.status}</Badge>
                            </td>
                            <td className="p-3 text-center text-xs text-slate-500">{new Date(s.createdAt).toLocaleDateString('id-ID')}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);
