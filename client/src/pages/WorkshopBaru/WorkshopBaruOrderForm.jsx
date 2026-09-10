import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
    ArrowLeft, Plus, Trash2, Save, HardHat, 
    Boxes, Sparkles, AlertCircle, CheckCircle2,
    Search, X, DollarSign, Package
} from 'lucide-react';
import api from '../../lib/axios';
import Swal from 'sweetalert2';

export default function WorkshopBaruOrderForm() {
    const navigate = useNavigate();
    const location = useLocation();
    const fromMaintenance = location.state?.fromMaintenance;
    const initialCatalogItem = location.state?.fromCatalog;

    const [loading, setLoading] = useState(false);
    const [units, setUnits] = useState([]);
    const [catalogProducts, setCatalogProducts] = useState([]);
    const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
    const [catalogSearch, setCatalogSearch] = useState('');

    const [form, setForm] = useState({
        title: fromMaintenance ? fromMaintenance.title : (initialCatalogItem ? `Pemesanan ${initialCatalogItem.name}` : ''),
        priority: 'NORMAL',
        notes: fromMaintenance ? fromMaintenance.notes : '',
        unitId: fromMaintenance ? fromMaintenance.unitId : ''
    });

    const [items, setItems] = useState(() => {
        if (initialCatalogItem) {
            return [{
                name: initialCatalogItem.name,
                spec: initialCatalogItem.specification || '',
                qty: 1,
                unit: 'Unit',
                estimatedPrice: initialCatalogItem.price || 0
            }];
        }
        return [{ name: '', spec: '', qty: 1, unit: 'Unit', estimatedPrice: 0 }];
    });

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [unitsRes, catalogRes] = await Promise.allSettled([
                    api.get('/master/units'),
                    api.get('/workshop/catalog')
                ]);

                if (unitsRes.status === 'fulfilled') {
                    setUnits(unitsRes.value.data || []);
                }
                if (catalogRes.status === 'fulfilled' && catalogRes.value.data?.products) {
                    setCatalogProducts(catalogRes.value.data.products);
                }
            } catch (err) {
                console.error('Failed to fetch units / catalog:', err);
            }
        };
        fetchInitialData();
    }, []);

    const handleFormChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleItemChange = (index, field, value) => {
        setItems(prev => prev.map((item, i) =>
            i === index ? { ...item, [field]: value } : item
        ));
    };

    const addItem = () => {
        setItems([...items, { name: '', spec: '', qty: 1, unit: 'Unit', estimatedPrice: 0 }]);
    };

    const removeItem = (index) => {
        if (items.length === 1) return;
        setItems(items.filter((_, i) => i !== index));
    };

    const handleSelectCatalogItem = (product) => {
        const newItem = {
            name: product.name,
            spec: product.specification || '',
            qty: 1,
            unit: 'Unit',
            estimatedPrice: product.price || 0
        };

        // Jika baris pertama masih kosong, replace; jika tidak, tambahkan baru
        if (items.length === 1 && !items[0].name.trim() && !items[0].spec.trim()) {
            setItems([newItem]);
        } else {
            setItems([...items, newItem]);
        }

        if (!form.title) {
            setForm(prev => ({ ...prev, title: `Pemesanan ${product.name}` }));
        }

        setIsCatalogModalOpen(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.title.trim()) {
            return Swal.fire('Peringatan', 'Judul pesanan wajib diisi.', 'warning');
        }

        if (!form.unitId) {
            return Swal.fire('Peringatan', 'Silakan pilih Unit pemesan.', 'warning');
        }

        const emptyItems = items.filter(it => !it.name.trim());
        if (emptyItems.length > 0) {
            return Swal.fire('Peringatan', 'Semua item pekerjaan harus memiliki nama.', 'warning');
        }

        const totalEst = items.reduce((acc, it) => acc + (parseFloat(it.estimatedPrice || 0) * parseInt(it.qty || 1)), 0);

        const confirm = await Swal.fire({
            title: 'Kirim Pesanan Workshop?',
            html: `
                <div class="text-left text-xs space-y-2 mt-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <p><strong>Judul:</strong> ${form.title}</p>
                    <p><strong>Total Item:</strong> ${items.length} item pekerjaan</p>
                    <p><strong>Estimasi Biaya:</strong> Rp ${totalEst.toLocaleString('id-ID')}</p>
                    <p class="text-slate-500 pt-1 text-[11px]">Pesanan akan langsung masuk ke Antrean Papan Kerja Workshop Baru (Unit 21).</p>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#059669',
            confirmButtonText: 'Ya, Kirim Sekarang',
            cancelButtonText: 'Batal'
        });

        if (!confirm.isConfirmed) return;

        setLoading(true);
        try {
            await api.post('/workshop/orders', {
                title: form.title,
                priority: form.priority,
                notes: form.notes,
                unitId: form.unitId,
                maintenanceId: fromMaintenance?.id,
                items: items.map(it => ({
                    name: it.name,
                    spec: it.spec,
                    qty: parseInt(it.qty) || 1,
                    unit: it.unit || 'Unit',
                    estimatedPrice: parseFloat(it.estimatedPrice) || 0
                }))
            });

            Swal.fire({
                title: 'Berhasil!',
                text: 'Pesanan workshop baru telah berhasil dibuat dan masuk ke antrean pengerjaan.',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });

            navigate('/workshop-baru/board');
        } catch (error) {
            console.error('Error creating workshop order:', error);
            Swal.fire('Gagal', error.response?.data?.error || 'Gagal membuat pesanan.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const filteredCatalog = catalogProducts.filter(p => 
        (p.name || '').toLowerCase().includes(catalogSearch.toLowerCase()) ||
        (p.specification || '').toLowerCase().includes(catalogSearch.toLowerCase())
    );

    return (
        <div className="max-w-5xl mx-auto space-y-5 pb-24 px-3 sm:px-6 pt-4">
            {/* Nav Back */}
            <div className="flex items-center justify-between">
                <button 
                    onClick={() => navigate('/workshop-baru/board')} 
                    className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-500 hover:text-emerald-700 transition-colors"
                >
                    <ArrowLeft size={16} /> Batal & Kembali ke Papan Kerja
                </button>
                <span className="text-[11px] font-bold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                    Workshop Baru (Unit 21)
                </span>
            </div>

            <div className="bg-white p-5 sm:p-8 rounded-2xl shadow-sm border border-slate-200">
                <div className="mb-6 border-b border-slate-100 pb-4">
                    <h1 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2">
                        <HardHat className="text-emerald-600" size={24} /> Buat Pesanan Workshop Baru
                    </h1>
                    <p className="text-slate-500 text-xs sm:text-sm mt-1">
                        Formulir pengajuan pesanan pekerjaan fabrikasi mebel, perbaikan, dan konstruksi Unit 21.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Detail Pesanan Utama */}
                    <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200 space-y-4">
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                            Informasi Pesanan
                        </h3>

                        {/* Judul Pesanan */}
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase mb-1.5 block">
                                Judul Pesanan / Pekerjaan <span className="text-rose-500">*</span>
                            </label>
                            <input
                                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-semibold text-slate-800 bg-white"
                                placeholder="Contoh: Pembuatan Meja Kerja & Lemari Arsip Ruang Guru"
                                value={form.title}
                                onChange={e => handleFormChange('title', e.target.value)}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Unit Pemesan */}
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase mb-1.5 block">
                                    Pesanan Dari Unit <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium text-slate-800"
                                    value={form.unitId}
                                    onChange={e => handleFormChange('unitId', e.target.value)}
                                    required
                                >
                                    <option value="">-- Pilih Unit Pemesan --</option>
                                    {units.map(unit => (
                                        <option key={unit.id} value={unit.id}>
                                            {unit.name} ({unit.code})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Prioritas */}
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase mb-1.5 block">
                                    Tingkat Prioritas
                                </label>
                                <select
                                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium text-slate-800"
                                    value={form.priority}
                                    onChange={e => handleFormChange('priority', e.target.value)}
                                >
                                    <option value="LOW">🟢 Low - Standar / Tidak Mendesak</option>
                                    <option value="NORMAL">🔵 Normal - Pengerjaan Reguler</option>
                                    <option value="HIGH">🟠 High - Penting / Butuh Segera</option>
                                    <option value="URGENT">🔴 Urgent - Sangat Mendesak / Prioritas Utama</option>
                                </select>
                            </div>
                        </div>

                        {/* Catatan Tambahan */}
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase mb-1.5 block">
                                Catatan Tambahan (Opsional)
                            </label>
                            <textarea
                                rows={2}
                                className="w-full border border-slate-300 rounded-xl p-3 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-slate-700"
                                placeholder="Catatan teknis khusus, lokasi penempatan barang, atau arahan khusus untuk pengerjaan..."
                                value={form.notes}
                                onChange={e => handleFormChange('notes', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Daftar Item Pekerjaan */}
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <Boxes size={18} className="text-emerald-600" /> Daftar Item Pekerjaan
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Rincian barang, fabrikasi, atau item perbaikan yang diminta.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCatalogModalOpen(true)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all shadow-sm"
                                    title="Pilih langsung dari Katalog Produk Workshop"
                                >
                                    <Package size={14} /> Pilih dari Katalog Workshop
                                </button>
                                <button
                                    type="button"
                                    onClick={addItem}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm"
                                >
                                    <Plus size={14} /> Tambah Item
                                </button>
                            </div>
                        </div>

                        {/* Items List */}
                        <div className="space-y-3">
                            {items.map((item, index) => (
                                <div 
                                    key={index}
                                    className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 relative group hover:border-emerald-300 transition-colors"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center">
                                            {index + 1}
                                        </span>
                                        {items.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeItem(index)}
                                                className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                                                title="Hapus baris item"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                                                Nama Item / Pekerjaan <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                className="w-full border border-slate-200 rounded-lg p-2 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-slate-800 bg-slate-50/50"
                                                placeholder="Contoh: Lemari Arsip 4 Pintu"
                                                value={item.name}
                                                onChange={e => handleItemChange(index, 'name', e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                                                Spesifikasi & Ukuran
                                            </label>
                                            <input
                                                className="w-full border border-slate-200 rounded-lg p-2 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-slate-700 bg-slate-50/50"
                                                placeholder="Contoh: Bahan Kayu Blokmin 18mm, HPL Taco, 120x40x180 cm"
                                                value={item.spec}
                                                onChange={e => handleItemChange(index, 'spec', e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3 pt-1">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                                                Jumlah
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                className="w-full border border-slate-200 rounded-lg p-2 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800 bg-slate-50/50"
                                                value={item.qty}
                                                onChange={e => handleItemChange(index, 'qty', e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                                                Satuan
                                            </label>
                                            <select
                                                className="w-full border border-slate-200 rounded-lg p-2 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-slate-800 bg-slate-50/50"
                                                value={item.unit}
                                                onChange={e => handleItemChange(index, 'unit', e.target.value)}
                                            >
                                                <option value="Unit">Unit</option>
                                                <option value="Pcs">Pcs</option>
                                                <option value="Set">Set</option>
                                                <option value="Meter">Meter</option>
                                                <option value="Lembar">Lembar</option>
                                                <option value="Titik">Titik</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                                                Estimasi Biaya / Item
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                className="w-full border border-slate-200 rounded-lg p-2 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-slate-800 bg-slate-50/50"
                                                placeholder="Rp 0"
                                                value={item.estimatedPrice || ''}
                                                onChange={e => handleItemChange(index, 'estimatedPrice', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Submit Bar */}
                    <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <p className="text-xs text-slate-500">
                            * Seluruh data pesanan akan diteruskan langsung ke tim Workshop Unit 21.
                        </p>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button
                                type="button"
                                onClick={() => navigate('/workshop-baru/board')}
                                className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
                            >
                                <Save size={16} /> {loading ? 'Mengirim Pesanan...' : 'Kirim Pesanan Workshop'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {/* Modal Drawer: Pilih dari Katalog Workshop */}
            {isCatalogModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
                        {/* Header */}
                        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
                                    <Package className="text-emerald-600" size={20} /> Pilih Produk dari Katalog Workshop
                                </h3>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Pilih produk standar workshop untuk otomatis mengisi nama, spesifikasi, dan estimasi harga.
                                </p>
                            </div>
                            <button 
                                onClick={() => setIsCatalogModalOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Search bar */}
                        <div className="p-3 border-b border-slate-100 bg-white">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                                    placeholder="Cari produk di katalog workshop..."
                                    value={catalogSearch}
                                    onChange={e => setCatalogSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Product List */}
                        <div className="p-4 overflow-y-auto space-y-2.5 divide-y divide-slate-100 flex-1">
                            {filteredCatalog.length === 0 ? (
                                <div className="text-center py-10 text-slate-400 text-xs">
                                    Belum ada produk di katalog yang sesuai.
                                </div>
                            ) : (
                                filteredCatalog.map((product) => (
                                    <div 
                                        key={product.id}
                                        onClick={() => handleSelectCatalogItem(product)}
                                        className="pt-2.5 first:pt-0 flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-emerald-50/60 cursor-pointer transition-colors group"
                                    >
                                        <div className="flex items-center gap-3">
                                            {product.image ? (
                                                <img 
                                                    src={product.image} 
                                                    alt={product.name} 
                                                    className="w-12 h-12 object-cover rounded-lg border border-slate-200 shrink-0" 
                                                />
                                            ) : (
                                                <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                                                    <Package size={20} />
                                                </div>
                                            )}
                                            <div>
                                                <h4 className="font-bold text-xs text-slate-800 group-hover:text-emerald-700 transition-colors">
                                                    {product.name}
                                                </h4>
                                                <p className="text-[11px] text-slate-500 line-clamp-1">
                                                    {product.specification || 'Tidak ada rincian spesifikasi'}
                                                </p>
                                                <p className="text-[11px] font-extrabold text-emerald-700 mt-0.5">
                                                    Rp {(product.price || 0).toLocaleString('id-ID')}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 shadow-sm shrink-0"
                                        >
                                            Pilih Item
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
