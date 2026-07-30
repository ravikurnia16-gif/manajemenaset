import { Plus } from 'lucide-react';
import { Badge } from './UIComponents';

export const TransactionsTab = ({ transactions, loading, selectedWarehouse, setSelectedWarehouse, warehouses, openModal }) => (
    <div className="space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
            <select className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none" value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}>
                <option value="">Semua Gudang</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <button onClick={() => openModal('transaction')} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/20 ml-auto">
                <Plus size={14} /> Transaksi Baru
            </button>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                    <tr>
                        <th className="p-3 text-left">Kode</th>
                        <th className="p-3 text-center">Tipe</th>
                        <th className="p-3 text-left">Barang</th>
                        <th className="p-3 text-center">Gudang</th>
                        <th className="p-3 text-center">Qty</th>
                        <th className="p-3 text-center">Tanggal</th>
                        <th className="p-3 text-left">Catatan</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {loading ? (
                        <tr><td colSpan="7" className="p-8 text-center text-slate-400">Memuat data...</td></tr>
                    ) : transactions.length === 0 ? (
                        <tr><td colSpan="7" className="p-8 text-center text-slate-400">Belum ada transaksi stok.</td></tr>
                    ) : transactions.map(t => (
                        <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 font-mono text-xs text-slate-400">{t.code}</td>
                            <td className="p-3 text-center">
                                <Badge color={t.type === 'IN' ? 'green' : t.type === 'OUT' ? 'red' : t.type === 'MUTATION' ? 'blue' : 'orange'}>{t.type}</Badge>
                            </td>
                            <td className="p-3 font-medium text-slate-700">{t.variant?.item?.name} ({t.variant?.size || '-'})</td>
                            <td className="p-3 text-center text-xs text-slate-500">
                                {t.warehouse?.name}
                                {t.toWarehouse && <span className="text-blue-500"> → {t.toWarehouse.name}</span>}
                            </td>
                            <td className="p-3 text-center font-bold">{t.quantity > 0 ? `+${t.quantity}` : t.quantity}</td>
                            <td className="p-3 text-center text-xs text-slate-500">{new Date(t.createdAt).toLocaleDateString('id-ID')}</td>
                            <td className="p-3 text-xs text-slate-500 italic max-w-[200px] truncate" title={t.notes}>{t.notes || '-'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);
