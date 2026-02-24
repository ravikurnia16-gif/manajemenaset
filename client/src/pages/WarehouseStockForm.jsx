import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Package } from 'lucide-react';
import api from '../lib/axios';

const WarehouseStockForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = !!id;
    const [categories, setCategories] = useState([]);
    const [saving, setSaving] = useState(false);
    const [isSeragam, setIsSeragam] = useState(false);
    const [newCatName, setNewCatName] = useState('');

    const [form, setForm] = useState({
        name: '', categoryId: '', type: '', gender: '', size: '',
        purchaseYear: '', itemUnit: '', stock: '0', minStock: '5', purchasePrice: '', supplier: '', location: ''
    });

    useEffect(() => {
        api.get('/warehouse/categories').then(r => setCategories(r.data));
        if (isEdit) {
            api.get(`/warehouse/items/${id}`).then(r => {
                const d = r.data;
                setForm({
                    name: d.name || '', categoryId: d.categoryId?.toString() || '',
                    type: d.type || '', gender: d.gender || '', size: d.size || '',
                    purchaseYear: d.purchaseYear?.toString() || '', itemUnit: d.itemUnit || '',
                    stock: d.stock?.toString() || '0', minStock: d.minStock?.toString() || '5',
                    purchasePrice: d.purchasePrice?.toString() || '',
                    supplier: d.supplier || '', location: d.location || ''
                });
                setIsSeragam(d.category?.name?.toLowerCase().includes('seragam'));
            });
        }
    }, [id]);

    useEffect(() => {
        const cat = categories.find(c => c.id === parseInt(form.categoryId));
        setIsSeragam(cat?.name?.toLowerCase().includes('seragam') || false);
    }, [form.categoryId, categories]);

    const handleAddCategory = async () => {
        if (!newCatName) return;
        try {
            const res = await api.post('/warehouse/categories', { name: newCatName });
            setCategories(prev => [...prev, res.data]);
            setForm(prev => ({ ...prev, categoryId: res.data.id.toString() }));
            setNewCatName('');
        } catch (e) { alert('Gagal menambah kategori'); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name || !form.categoryId) return alert('Nama dan Kategori wajib diisi');
        if (isSeragam && !form.purchaseYear) return alert('Tahun Pembelian wajib untuk Seragam');

        try {
            setSaving(true);
            const payload = { ...form, categoryId: parseInt(form.categoryId) };
            if (isEdit) {
                await api.put(`/warehouse/items/${id}`, payload);
            } else {
                await api.post('/warehouse/items', payload);
            }
            navigate('/gudang/stok');
        } catch (e) { alert(e.response?.data?.error || 'Gagal menyimpan'); } finally { setSaving(false); }
    };

    return (
        <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <button onClick={() => navigate('/gudang/stok')} className="p-2 hover:bg-slate-100 rounded-lg"><ArrowLeft size={20} /></button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Package className="text-indigo-600" /> {isEdit ? 'Edit' : 'Tambah'} Stok</h1>
                    <p className="text-sm text-slate-500 mt-1">{isEdit ? 'Ubah data item' : 'Tambah item stok baru'}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                {/* Category */}
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Kategori *</label>
                    <div className="flex gap-2">
                        <select value={form.categoryId} onChange={e => setForm(prev => ({ ...prev, categoryId: e.target.value }))} className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                            <option value="">Pilih Kategori</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <div className="flex gap-1">
                            <input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Kategori baru" className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm w-36" />
                            <button type="button" onClick={handleAddCategory} className="px-3 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold">+</button>
                        </div>
                    </div>
                </div>

                {/* Name */}
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Barang *</label>
                    <input type="text" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Misal: Baju Putih, Buku Tulis..." className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" required />
                </div>

                {/* Seragam-specific fields */}
                {isSeragam && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-4">
                        <p className="text-xs font-semibold text-blue-600">🏷️ Detail Seragam</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Tipe</label>
                                <select value={form.type} onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm">
                                    <option value="">Pilih</option>
                                    <option value="BAJU">Baju</option>
                                    <option value="CELANA">Celana</option>
                                    <option value="JILBAB">Jilbab</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Gender</label>
                                <select value={form.gender} onChange={e => setForm(prev => ({ ...prev, gender: e.target.value }))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm">
                                    <option value="">Pilih</option>
                                    <option value="L">Ikhwan</option>
                                    <option value="P">Akhwat</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Ukuran</label>
                                <select value={form.size} onChange={e => setForm(prev => ({ ...prev, size: e.target.value }))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm">
                                    <option value="">Pilih</option>
                                    {['SS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', '38', '40', '42', '44', '46', '48', '50/20', '50/22', '50/24', '52/20', '52/22', '52/24', '54/20', '54/22', '54/24'].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Tahun Pembuatan *</label>
                                <input type="number" value={form.purchaseYear} onChange={e => setForm(prev => ({ ...prev, purchaseYear: e.target.value }))} placeholder="2025" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Unit Seragam</label>
                                <select value={form.itemUnit} onChange={e => setForm(prev => ({ ...prev, itemUnit: e.target.value }))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm">
                                    <option value="">Pilih Unit</option>
                                    {['SD', 'SMP', 'SMA', 'Pondok Putra', 'Pondok Putri', 'Yayasan'].map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stock & Price */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Stok Awal</label>
                        <input type="number" value={form.stock} onChange={e => setForm(prev => ({ ...prev, stock: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Stok Minimum</label>
                        <input type="number" value={form.minStock} onChange={e => setForm(prev => ({ ...prev, minStock: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Harga Beli (Rp)</label>
                        <input type="number" value={form.purchasePrice} onChange={e => setForm(prev => ({ ...prev, purchasePrice: e.target.value }))} placeholder="0" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Supplier</label>
                        <input type="text" value={form.supplier} onChange={e => setForm(prev => ({ ...prev, supplier: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                    </div>
                </div>

                {/* Non-seragam: optional year */}
                {!isSeragam && (
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Tahun Pembelian (Opsional)</label>
                            <input type="number" value={form.purchaseYear} onChange={e => setForm(prev => ({ ...prev, purchaseYear: e.target.value }))} placeholder="2025" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Lokasi</label>
                            <input type="text" value={form.location} onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))} placeholder="Misal: Rak A1" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                        </div>
                    </div>
                )}

                <button type="submit" disabled={saving} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2">
                    <Save size={18} /> {saving ? 'Menyimpan...' : isEdit ? 'Update' : 'Simpan'}
                </button>
            </form>
        </div>
    );
};

export default WarehouseStockForm;
