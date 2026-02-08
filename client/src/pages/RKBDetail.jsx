import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Trash2, Edit2, CheckCircle, XCircle } from 'lucide-react';
import api from '../lib/axios';

const RKBDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [rkb, setRkb] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showAddItem, setShowAddItem] = useState(false);

    // Form State for new Item
    const [newItem, setNewItem] = useState({
        name: '',
        spec: '',
        qty: 1,
        unit: 'Unit',
        estPrice: 0,
        category: 'ASSET',
        priority: 'MEDIUM',
        month: 1
    });

    useEffect(() => {
        fetchRKBDetail();
    }, [id]);

    const fetchRKBDetail = async () => {
        try {
            const res = await api.get(`/rkb/${id}`);
            setRkb(res.data);
        } catch (error) {
            console.error(error);
            alert('Gagal mengambil data RKB');
        } finally {
            setLoading(false);
        }
    };

    const handleAddItem = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/rkb/${id}/items`, newItem);
            alert('Item berhasil ditambahkan');
            setShowAddItem(false);
            setNewItem({ name: '', spec: '', qty: 1, unit: 'Unit', estPrice: 0, category: 'ASSET', priority: 'MEDIUM', month: 1 });
            fetchRKBDetail();
        } catch (error) {
            console.error(error);
            alert('Gagal menambah item: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleSubmitRKB = async () => {
        if (!confirm('Apakah Anda yakin ingin mengirim RKB ini? Data tidak bisa diubah setelah disubmit.')) return;
        try {
            await api.put(`/rkb/${id}/status`, { status: 'SUBMITTED' });
            alert('RKB Berhasil disubmit!');
            fetchRKBDetail();
        } catch (error) {
            alert('Gagal submit RKB');
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Memuat Data...</div>;
    if (!rkb) return <div className="p-8 text-center text-red-500">RKB Tidak Ditemukan</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-20">
            {/* Header */}
            <div className="flex items-center gap-4 border-b pb-4 border-slate-200">
                <button onClick={() => navigate('/rkb')} className="p-2 hover:bg-slate-100 rounded-full">
                    <ArrowLeft size={24} className="text-slate-600" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Detail RKB: {rkb.unit?.name}</h1>
                    <div className="flex gap-3 text-sm text-slate-500 mt-1">
                        <span className="bg-slate-100 px-2 py-0.5 rounded border">TA {rkb.fiscalYear}</span>
                        <span className={`px-2 py-0.5 rounded font-bold border ${rkb.status === 'APPROVED' ? 'bg-green-100 text-green-700 border-green-200' :
                                rkb.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                    'bg-yellow-50 text-yellow-700 border-yellow-200'
                            }`}>{rkb.status}</span>
                    </div>
                </div>
                <div className="ml-auto flex gap-2">
                    {rkb.status === 'DRAFT' && (
                        <button onClick={handleSubmitRKB} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm">
                            <CheckCircle size={18} /> Submit RKB
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Summary */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="font-bold text-slate-700 mb-4">Ringkasan Anggaran</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-dashed">
                                <span className="text-slate-500 text-sm">Total Item</span>
                                <span className="font-bold">{rkb.items.length}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-dashed">
                                <span className="text-slate-500 text-sm">Total Estimasi</span>
                                <span className="font-bold text-lg text-blue-600">Rp {Number(rkb.totalBudget).toLocaleString('id-ID')}</span>
                            </div>
                        </div>
                    </div>

                    {rkb.status === 'DRAFT' && (
                        <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                            <h3 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                                <Plus size={18} /> Tambah Item Manual
                            </h3>
                            <button
                                onClick={() => setShowAddItem(true)}
                                className="w-full bg-white border border-blue-200 text-blue-600 py-2 rounded-lg font-bold hover:bg-blue-100 shadow-sm"
                            >
                                + Input Item Baru
                            </button>
                        </div>
                    )}
                </div>

                {/* Right: Item List */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700">Daftar Kebutuhan Barang</h3>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-slate-500 bg-slate-50 border-b">
                                    <tr>
                                        <th className="px-4 py-3">Nama Barang / Spesifikasi</th>
                                        <th className="px-4 py-3 text-center">Bulan</th>
                                        <th className="px-4 py-3 text-center">Qty</th>
                                        <th className="px-4 py-3 text-right">Harga Satuan</th>
                                        <th className="px-4 py-3 text-right">Total</th>
                                        <th className="px-4 py-3 text-center">Prioritas</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {rkb.items.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-slate-800">{item.name}</div>
                                                <div className="text-xs text-slate-500 text-wrap max-w-xs">{item.spec}</div>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded border mt-1 inline-block ${item.category === 'ASSET' ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-slate-100 text-slate-600'
                                                    }`}>{item.category}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center font-mono">Bl-{item.month || '-'}</td>
                                            <td className="px-4 py-3 text-center font-bold">
                                                {item.qty} <span className="text-xs font-normal text-slate-400">{item.unit}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-600">
                                                {Number(item.estPrice).toLocaleString('id-ID')}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-800 bg-slate-50/50">
                                                {Number(item.qty * item.estPrice).toLocaleString('id-ID')}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${item.priority === 'HIGH' ? 'bg-red-100 text-red-600' :
                                                        item.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-600' :
                                                            'bg-green-100 text-green-600'
                                                    }`}>
                                                    {item.priority}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {rkb.items.length === 0 && (
                                        <tr>
                                            <td colSpan="6" className="p-8 text-center text-slate-400 italic">
                                                Belum ada item. Silakan tambah manual atau import excel.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Add Item */}
            {showAddItem && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in p-4">
                    <div className="bg-white p-6 rounded-xl w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Plus className="bg-blue-100 text-blue-600 p-1 rounded" /> Tambah Item RKB
                            </h2>
                            <button onClick={() => setShowAddItem(false)} className="text-slate-400 hover:text-slate-600">
                                <XCircle size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleAddItem} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">Nama Barang</label>
                                    <input
                                        type="text" required
                                        className="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={newItem.name}
                                        onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                                        placeholder="Contoh: Laptop Admin"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">Kategori</label>
                                    <select
                                        className="w-full border p-2 rounded text-sm bg-slate-50"
                                        value={newItem.category}
                                        onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                                    >
                                        <option value="ASSET">Aset Tetap (Inventaris)</option>
                                        <option value="NON_ASSET">Habis Pakai / Jasa</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs font-bold text-slate-500 block mb-1">Spesifikasi Lengkap</label>
                                    <textarea
                                        className="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none h-20"
                                        value={newItem.spec}
                                        onChange={e => setNewItem({ ...newItem, spec: e.target.value })}
                                        placeholder="Contoh: RAM 8GB, SSD 512GB, Warna Hitam..."
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">Jumlah (Qty)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number" min="1" required
                                            className="w-20 border p-2 rounded text-sm text-center font-bold"
                                            value={newItem.qty}
                                            onChange={e => setNewItem({ ...newItem, qty: e.target.value })}
                                        />
                                        <input
                                            type="text" required
                                            className="flex-1 border p-2 rounded text-sm"
                                            value={newItem.unit}
                                            onChange={e => setNewItem({ ...newItem, unit: e.target.value })}
                                            placeholder="Satuan (Unit/Pcs)"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">Estimasi Harga Satuan</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-slate-400 text-sm">Rp</span>
                                        <input
                                            type="number" required
                                            className="w-full border p-2 pl-10 rounded text-sm font-mono"
                                            value={newItem.estPrice}
                                            onChange={e => setNewItem({ ...newItem, estPrice: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">Prioritas</label>
                                    <select
                                        className="w-full border p-2 rounded text-sm"
                                        value={newItem.priority}
                                        onChange={e => setNewItem({ ...newItem, priority: e.target.value })}
                                    >
                                        <option value="HIGH">HIGH (Mendesak)</option>
                                        <option value="MEDIUM">MEDIUM (Penting)</option>
                                        <option value="LOW">LOW (Bisa Ditunda)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">Bulan Perencanaan</label>
                                    <select
                                        className="w-full border p-2 rounded text-sm"
                                        value={newItem.month}
                                        onChange={e => setNewItem({ ...newItem, month: e.target.value })}
                                    >
                                        {[...Array(12)].map((_, i) => (
                                            <option key={i + 1} value={i + 1}>Bulan {i + 1}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setShowAddItem(false)} className="px-5 py-2 text-slate-500 font-bold text-sm hover:bg-slate-100 rounded-lg">Batal</button>
                                <button type="submit" className="px-5 py-2 bg-blue-600 text-white font-bold text-sm rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-600/20 flex items-center gap-2">
                                    <Save size={18} /> Simpan Item
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RKBDetail;
