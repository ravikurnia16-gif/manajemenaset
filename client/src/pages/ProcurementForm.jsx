import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import api from '../lib/axios';

const ProcurementForm = () => {
    const navigate = useNavigate();
    const [header, setHeader] = useState({ type: 'ASSET', rkbId: '' });
    const [items, setItems] = useState([
        { name: '', spec: '', qty: 1, unit: 'unit', estPrice: 0 }
    ]);
    const [loading, setLoading] = useState(false);

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    };

    const addItem = () => {
        setItems([...items, { name: '', spec: '', qty: 1, unit: 'unit', estPrice: 0 }]);
    };

    const removeItem = (index) => {
        if (items.length === 1) return;
        setItems(items.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!confirm('Kirim pengajuan ini?')) return;
        setLoading(true);
        try {
            await api.post('/procurements', { ...header, items });
            alert('Pengajuan berhasil dikirim!');
            navigate('/procurements');
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal mengirim');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in slide-in-from-bottom-4">
            <button onClick={() => navigate('/procurements')} className="flex items-center gap-2 text-slate-500 hover:text-blue-600">
                <ArrowLeft size={16} /> Batal & Kembali
            </button>

            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100">
                <h1 className="text-2xl font-bold text-slate-800 mb-6">Buat Pengajuan Baru</h1>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Header Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-xl">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Jenis Pengadaan</label>
                            <select
                                className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                value={header.type}
                                onChange={e => setHeader({ ...header, type: e.target.value })}
                            >
                                <option value="ASSET">Aset (Barang Modal/Investasi)</option>
                                <option value="NON_ASSET">Non-Aset (Habis Pakai/Operasional)</option>
                                <option value="SERVICE">Jasa / Service</option>
                            </select>
                            <p className="text-xs text-slate-500 mt-2">
                                *Aset akan masuk database inventaris. Non-Aset hanya dicatat sebagai pengeluaran.
                            </p>
                        </div>
                        {/* Placeholder for RKB Select if needed later */}
                    </div>

                    {/* Items Section */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-slate-700">Daftar Barang</h3>
                            <button type="button" onClick={addItem} className="flex items-center gap-2 text-blue-600 font-bold text-sm hover:bg-blue-50 px-3 py-1 rounded-lg transition">
                                <Plus size={16} /> Tambah Baris
                            </button>
                        </div>

                        <div className="space-y-3">
                            {items.map((item, index) => (
                                <div key={index} className="flex gap-4 items-start p-4 border border-slate-200 rounded-xl bg-white hover:border-blue-300 transition-colors">
                                    <div className="flex-1 space-y-3">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <input
                                                placeholder="Nama Barang"
                                                className="border p-2 rounded text-sm font-semibold w-full"
                                                value={item.name}
                                                onChange={e => handleItemChange(index, 'name', e.target.value)}
                                                required
                                            />
                                            <input
                                                placeholder="Spesifikasi Detail (RAM, Warna, Merk...)"
                                                className="border p-2 rounded text-sm w-full"
                                                value={item.spec}
                                                onChange={e => handleItemChange(index, 'spec', e.target.value)}
                                            />
                                        </div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="col-span-1">
                                                <input
                                                    type="number" placeholder="Qty"
                                                    className="border p-2 rounded text-sm w-full"
                                                    value={item.qty}
                                                    onChange={e => handleItemChange(index, 'qty', e.target.value)}
                                                    required
                                                    min="1"
                                                />
                                            </div>
                                            <div className="col-span-1">
                                                <input
                                                    placeholder="Satuan (Pcs/Unit)"
                                                    className="border p-2 rounded text-sm w-full"
                                                    value={item.unit}
                                                    onChange={e => handleItemChange(index, 'unit', e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div className="col-span-1">
                                                <input
                                                    type="number" placeholder="Est. Harga Satuan"
                                                    className="border p-2 rounded text-sm w-full"
                                                    value={item.estPrice}
                                                    onChange={e => handleItemChange(index, 'estPrice', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    {items.length > 1 && (
                                        <button type="button" onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600 p-2">
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100 flex justify-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all transform hover:-translate-y-1"
                        >
                            {loading ? 'Mengirim...' : 'Kirim Pengajuan'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProcurementForm;
