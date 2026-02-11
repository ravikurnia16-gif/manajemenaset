import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, Plus, Trash2, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import api from '../lib/axios';

const WarehouseTransactions = () => {
    const [txs, setTxs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState('');
    const navigate = useNavigate();

    const fetchTxs = async () => {
        try {
            setLoading(true);
            const params = {};
            if (typeFilter) params.type = typeFilter;
            const res = await api.get('/warehouse/transactions', { params });
            setTxs(res.data);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    useEffect(() => { fetchTxs(); }, [typeFilter]);

    const handleDelete = async (id) => {
        if (!confirm('Hapus transaksi ini? Stok akan dikembalikan.')) return;
        try { await api.delete(`/warehouse/transactions/${id}`); fetchTxs(); } catch (e) { alert('Gagal menghapus'); }
    };

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><ArrowLeftRight className="text-indigo-600" /> Transaksi Gudang</h1>
                    <p className="text-sm text-slate-500 mt-1">Riwayat barang masuk & keluar</p>
                </div>
                <button onClick={() => navigate('/gudang/transaksi/input')} className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg hover:shadow-xl text-sm">
                    <Plus size={18} /> Transaksi Baru
                </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 flex gap-3">
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                    <option value="">Semua Tipe</option>
                    <option value="IN">Barang Masuk</option>
                    <option value="OUT">Barang Keluar</option>
                </select>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {loading ? <div className="p-10 text-center text-slate-400">Memuat...</div> : txs.length === 0 ? (
                    <div className="p-10 text-center text-slate-400"><ArrowLeftRight size={40} className="mx-auto mb-2 text-slate-300" />Belum ada transaksi</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead><tr className="bg-slate-50 border-b">
                                <th className="text-left p-3 font-semibold text-slate-600">Kode</th>
                                <th className="text-left p-3 font-semibold text-slate-600">Tipe</th>
                                <th className="text-left p-3 font-semibold text-slate-600">Tanggal</th>
                                <th className="text-left p-3 font-semibold text-slate-600">Item</th>
                                <th className="text-left p-3 font-semibold text-slate-600">Oleh</th>
                                <th className="text-left p-3 font-semibold text-slate-600">Catatan</th>
                                <th className="text-center p-3 font-semibold text-slate-600">Aksi</th>
                            </tr></thead>
                            <tbody>
                                {txs.map(tx => (
                                    <tr key={tx.id} className="border-b border-slate-100 hover:bg-slate-50">
                                        <td className="p-3 font-mono text-xs">{tx.code}</td>
                                        <td className="p-3">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${tx.type === 'IN' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                {tx.type === 'IN' ? <><ArrowDownCircle size={12} /> Masuk</> : <><ArrowUpCircle size={12} /> Keluar</>}
                                            </span>
                                        </td>
                                        <td className="p-3 text-slate-500 text-xs">{new Date(tx.date).toLocaleDateString('id-ID')}</td>
                                        <td className="p-3">
                                            <div className="space-y-1">
                                                {(tx.items || []).map((ti, i) => (
                                                    <div key={i} className="text-xs">
                                                        <span className="font-medium">{ti.item?.name}</span>
                                                        {ti.item?.size && <span className="text-slate-400 ml-1">({ti.item.size})</span>}
                                                        <span className="ml-1 font-bold text-indigo-600">×{ti.quantity}</span>
                                                        {ti.recipientName && <span className="text-slate-400 ml-1">→ {ti.recipientName}</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-3 text-xs">{tx.createdBy?.name || tx.createdBy?.username}</td>
                                        <td className="p-3 text-xs text-slate-500">{tx.note || '-'}</td>
                                        <td className="p-3 text-center">
                                            <button onClick={() => handleDelete(tx.id)} className="p-1.5 hover:bg-red-50 rounded text-red-500" title="Hapus"><Trash2 size={15} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WarehouseTransactions;
