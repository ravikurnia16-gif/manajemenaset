import React, { useState, useEffect } from 'react';
import {
    Package,
    Plus,
    Search,
    Edit2,
    Trash2,
    Clock,
    DollarSign,
    ExternalLink,
    ArrowLeft,
    TrendingUp,
    CheckCircle2,
    X,
    Camera,
    Image,
    Layers,
    ShoppingCart,
    Filter,
    Info,
    Store,
    Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/axios';
import { getMediaUrl } from '../../lib/media';
import Swal from 'sweetalert2';

export default function WorkshopBaruCatalog() {
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [vendor, setVendor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('ALL');

    // Modals
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [savingProduct, setSavingProduct] = useState(false);

    // Form
    const [form, setForm] = useState({
        name: '',
        price: '',
        unit: 'Unit',
        specification: '',
        image: null
    });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

    // Price History Modal
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedProductHistory, setSelectedProductHistory] = useState(null);

    // Quick Update Price Modal
    const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
    const [productForPriceUpdate, setProductForPriceUpdate] = useState(null);
    const [newPrice, setNewPrice] = useState('');

    useEffect(() => {
        loadCatalog();
    }, []);

    const loadCatalog = async () => {
        try {
            setLoading(true);
            const res = await api.get('/workshop/catalog');
            setProducts(res.data?.products || []);
            setVendor(res.data?.vendor || null);
        } catch (error) {
            console.error('Failed to load workshop catalog:', error);
            Swal.fire('Error', 'Gagal memuat katalog produk workshop.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAddModal = () => {
        setEditingProduct(null);
        setForm({
            name: '',
            price: '',
            unit: 'Unit',
            specification: '',
            image: null
        });
        setImageFile(null);
        setImagePreview(null);
        setIsProductModalOpen(true);
    };

    const handleOpenEditModal = (p) => {
        setEditingProduct(p);
        setForm({
            name: p.name || '',
            price: p.price || '',
            unit: p.specification?.includes('[Satuan:') ? p.specification.split('[Satuan:')[1].split(']')[0].trim() : 'Unit',
            specification: p.specification?.replace(/\[Satuan:[^\]]+\]\s*/, '') || '',
            image: p.image || null
        });
        setImageFile(null);
        setImagePreview(p.image ? (p.image.startsWith('http') ? p.image : getMediaUrl(p.image)) : null);
        setIsProductModalOpen(true);
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSaveProduct = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) {
            return Swal.fire('Peringatan', 'Nama produk wajib diisi.', 'warning');
        }

        try {
            setSavingProduct(true);
            const formData = new FormData();
            formData.append('name', form.name);
            formData.append('price', form.price || '0');
            formData.append('unit', form.unit || 'Unit');
            formData.append('specification', form.specification || '');

            if (imageFile) {
                formData.append('image', imageFile);
            } else if (form.image) {
                formData.append('image', form.image);
            }

            if (editingProduct) {
                await api.put(`/workshop/catalog/${editingProduct.id}`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                Swal.fire({
                    title: 'Berhasil!',
                    text: 'Produk katalog berhasil diperbarui & disinkronkan ke Data Vendor.',
                    icon: 'success',
                    timer: 1800,
                    showConfirmButton: false
                });
            } else {
                await api.post('/workshop/catalog', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                Swal.fire({
                    title: 'Berhasil!',
                    text: 'Produk katalog baru berhasil ditambahkan & terdaftar di Data Vendor.',
                    icon: 'success',
                    timer: 1800,
                    showConfirmButton: false
                });
            }

            setIsProductModalOpen(false);
            loadCatalog();
        } catch (error) {
            console.error('Save product error:', error);
            Swal.fire('Gagal', error.response?.data?.error || 'Gagal menyimpan produk.', 'error');
        } finally {
            setSavingProduct(false);
        }
    };

    const handleDeleteProduct = async (p) => {
        const result = await Swal.fire({
            title: 'Hapus Produk Katalog?',
            text: `Yakin ingin menghapus "${p.name}" dari Katalog Workshop dan Data Vendor?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e11d48',
            confirmButtonText: 'Ya, Hapus',
            cancelButtonText: 'Batal'
        });

        if (!result.isConfirmed) return;

        try {
            await api.delete(`/workshop/catalog/${p.id}`);
            Swal.fire('Terhapus', 'Produk berhasil dihapus.', 'success');
            loadCatalog();
        } catch (error) {
            console.error('Delete product error:', error);
            Swal.fire('Gagal', error.response?.data?.error || 'Gagal menghapus produk.', 'error');
        }
    };

    const handleOpenHistoryModal = (p) => {
        setSelectedProductHistory(p);
        setIsHistoryModalOpen(true);
    };

    const handleOpenQuickPrice = (p) => {
        setProductForPriceUpdate(p);
        setNewPrice(p.price || '');
        setIsPriceModalOpen(true);
    };

    const handleSaveQuickPrice = async (e) => {
        e.preventDefault();
        if (!productForPriceUpdate) return;

        try {
            await api.put(`/workshop/catalog/${productForPriceUpdate.id}`, {
                name: productForPriceUpdate.name,
                price: parseFloat(newPrice) || 0,
                specification: productForPriceUpdate.specification
            });

            Swal.fire({
                title: 'Harga Diperbarui!',
                text: 'Perubahan harga berhasil dicatat ke riwayat & Data Vendor.',
                icon: 'success',
                timer: 1800,
                showConfirmButton: false
            });

            setIsPriceModalOpen(false);
            loadCatalog();
        } catch (error) {
            console.error('Update price error:', error);
            Swal.fire('Gagal', error.response?.data?.error || 'Gagal memperbarui harga.', 'error');
        }
    };

    const handleOrderProduct = (p) => {
        navigate('/workshop-baru/orders/new', {
            state: { fromCatalog: p }
        });
    };

    // Filter
    const filteredProducts = products.filter(p => {
        const matchSearch = (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.specification || '').toLowerCase().includes(searchQuery.toLowerCase());
        
        if (!matchSearch) return false;

        if (selectedCategory === 'KAYU') {
            return (p.name + ' ' + (p.specification || '')).toLowerCase().match(/kayu|mebel|meja|kursi|lemari|rak|partisi|pintu/);
        }
        if (selectedCategory === 'BESI') {
            return (p.name + ' ' + (p.specification || '')).toLowerCase().match(/besi|las|tralis|kanopi|pagar|baja|rangka/);
        }

        return true;
    });

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/workshop-baru/dashboard')}
                        className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2">
                                <Package className="text-emerald-600" size={24} /> Katalog Produk Workshop
                            </h1>
                            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <Store size={12} /> Terhubung Data Vendor
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Daftar produk standar fabrikasi Unit 21 yang langsung tersinkronisasi dengan master Data Vendor
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate('/vendors')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm"
                        title="Buka Halaman Data Vendor"
                    >
                        <Store size={14} className="text-blue-600" /> Buka Data Vendor
                    </button>

                    <button
                        onClick={handleOpenAddModal}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 hover:scale-105"
                    >
                        <Plus size={16} /> Tambah Produk Baru
                    </button>
                </div>
            </div>

            {/* Vendor Connection Info Banner */}
            {vendor && (
                <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <Store size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-extrabold text-sm text-slate-800">{vendor.name}</h3>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-200/80 text-emerald-900">
                                    {vendor.category || 'Workshop & Fabrikasi'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5 line-clamp-1">
                                {vendor.description || 'Penyedia fabrikasi mebel dan konstruksi internal.'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0">
                        <span className="font-bold text-emerald-800 bg-white px-3 py-1.5 rounded-xl border border-emerald-200 shadow-sm">
                            📦 {products.length} Produk Terhubung
                        </span>
                    </div>
                </div>
            )}

            {/* Search & Category Filter */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-3 text-slate-400" size={16} />
                    <input
                        type="text"
                        className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="Cari produk workshop berdasarkan nama atau rincian spesifikasi..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                    <button
                        onClick={() => setSelectedCategory('ALL')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                            selectedCategory === 'ALL' 
                                ? 'bg-slate-900 text-white shadow-sm' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        Semua ({products.length})
                    </button>
                    <button
                        onClick={() => setSelectedCategory('KAYU')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                            selectedCategory === 'KAYU' 
                                ? 'bg-orange-600 text-white shadow-sm' 
                                : 'bg-orange-50 text-orange-800 hover:bg-orange-100'
                        }`}
                    >
                        🪵 Mebel & Kayu
                    </button>
                    <button
                        onClick={() => setSelectedCategory('BESI')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                            selectedCategory === 'BESI' 
                                ? 'bg-slate-700 text-white shadow-sm' 
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                    >
                        ⚙️ Besi & Pengelasan
                    </button>
                </div>
            </div>

            {/* Products Grid */}
            {loading ? (
                <div className="p-16 text-center text-slate-400 text-sm">
                    <Loader2 className="animate-spin inline-block mr-2" size={20} /> Memuat katalog produk workshop...
                </div>
            ) : filteredProducts.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <Package size={28} />
                    </div>
                    <h3 className="font-bold text-slate-700 text-sm">Belum Ada Produk di Katalog</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Tambahkan produk standar seperti meja, lemari arsip, tralis, atau kusen agar langsung terdaftar di Data Vendor.
                    </p>
                    <button
                        onClick={handleOpenAddModal}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm"
                    >
                        <Plus size={14} /> Tambah Produk Pertama
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredProducts.map((p) => {
                        const historyCount = p.priceHistory?.length || 0;
                        const mediaSrc = p.image ? (p.image.startsWith('http') ? p.image : getMediaUrl(p.image)) : null;

                        return (
                            <div 
                                key={p.id}
                                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md hover:border-emerald-300 transition-all group"
                            >
                                {/* Image Box */}
                                <div className="h-44 bg-slate-100 relative overflow-hidden flex items-center justify-center">
                                    {mediaSrc ? (
                                        <img 
                                            src={mediaSrc} 
                                            alt={p.name} 
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center gap-1 text-slate-400">
                                            <Package size={36} />
                                            <span className="text-[10px] font-semibold">Tidak ada foto</span>
                                        </div>
                                    )}

                                    {/* Action Floating Buttons */}
                                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                                        <button
                                            onClick={() => handleOpenEditModal(p)}
                                            className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-slate-700 shadow-sm transition-all"
                                            title="Edit Produk"
                                        >
                                            <Edit2 size={13} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteProduct(p)}
                                            className="p-1.5 rounded-lg bg-white/90 hover:bg-rose-50 text-rose-600 shadow-sm transition-all"
                                            title="Hapus Produk"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>

                                {/* Content Details */}
                                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                                    <div className="space-y-1.5">
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="font-extrabold text-sm text-slate-800 group-hover:text-emerald-700 transition-colors">
                                                {p.name}
                                            </h3>
                                        </div>

                                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                            {p.specification || 'Tidak ada spesifikasi khusus.'}
                                        </p>
                                    </div>

                                    {/* Price & History Badge */}
                                    <div className="pt-2 border-t border-slate-100 space-y-2">
                                        <div className="flex items-baseline justify-between">
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Harga Standar</span>
                                                <p className="text-base font-black text-emerald-700 font-mono">
                                                    Rp {(parseFloat(p.price) || 0).toLocaleString('id-ID')}
                                                </p>
                                            </div>

                                            {/* Price History Button */}
                                            <button
                                                type="button"
                                                onClick={() => handleOpenHistoryModal(p)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                                                title="Lihat riwayat update harga"
                                            >
                                                <Clock size={12} className="text-slate-500" />
                                                <span>{historyCount > 1 ? `${historyCount}x Update` : 'Harga Awal'}</span>
                                            </button>
                                        </div>

                                        {/* Action Bar */}
                                        <div className="grid grid-cols-2 gap-2 pt-1">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenQuickPrice(p)}
                                                className="w-full inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl border border-emerald-300 text-emerald-800 bg-emerald-50/60 hover:bg-emerald-100 text-xs font-bold transition-all"
                                            >
                                                <DollarSign size={13} /> Update Harga
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleOrderProduct(p)}
                                                className="w-full inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm"
                                            >
                                                <ShoppingCart size={13} /> Pesan Item
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* MODAL 1: Tambah / Edit Produk Workshop */}
            {isProductModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
                                <Package className="text-emerald-600" size={20} />
                                {editingProduct ? 'Edit Produk Workshop' : 'Tambah Produk Workshop Baru'}
                            </h3>
                            <button
                                onClick={() => setIsProductModalOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveProduct} className="p-5 space-y-4 overflow-y-auto flex-1">
                            {/* Nama Produk */}
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase mb-1.5 block">
                                    Nama Produk / Barang <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-semibold text-slate-800"
                                    placeholder="Contoh: Meja Rapat Kayu Jati 240x120cm"
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    required
                                />
                            </div>

                            {/* Harga & Satuan */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase mb-1.5 block">
                                        Harga Standar (Rp)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800"
                                        placeholder="Contoh: 1500000"
                                        value={form.price}
                                        onChange={e => setForm({ ...form, price: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase mb-1.5 block">
                                        Satuan
                                    </label>
                                    <select
                                        className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium text-slate-800"
                                        value={form.unit}
                                        onChange={e => setForm({ ...form, unit: e.target.value })}
                                    >
                                        <option value="Unit">Unit</option>
                                        <option value="Set">Set</option>
                                        <option value="Pcs">Pcs</option>
                                        <option value="Meter">Meter</option>
                                        <option value="Lembar">Lembar</option>
                                    </select>
                                </div>
                            </div>

                            {/* Spesifikasi / Rincian */}
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase mb-1.5 block">
                                    Rincian & Spesifikasi Teknis
                                </label>
                                <textarea
                                    rows={3}
                                    className="w-full border border-slate-300 rounded-xl p-3 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-slate-700"
                                    placeholder="Rincian bahan material, ukuran panjang x lebar x tinggi, finishing politur/cat/HPL, konstruksi rangka..."
                                    value={form.specification}
                                    onChange={e => setForm({ ...form, specification: e.target.value })}
                                />
                            </div>

                            {/* Foto Produk */}
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase mb-1.5 block">
                                    Foto Produk Workshop
                                </label>
                                <div className="flex items-center gap-3">
                                    {imagePreview ? (
                                        <img 
                                            src={imagePreview} 
                                            alt="Preview" 
                                            className="w-20 h-20 rounded-xl object-cover border border-slate-300 shrink-0" 
                                        />
                                    ) : (
                                        <div className="w-20 h-20 rounded-xl bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400 shrink-0">
                                            <Image size={24} />
                                        </div>
                                    )}
                                    <div className="flex-1 space-y-1">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            id="product-photo-upload"
                                            className="hidden"
                                            onChange={handleImageChange}
                                        />
                                        <label
                                            htmlFor="product-photo-upload"
                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer transition-colors shadow-sm"
                                        >
                                            <Camera size={14} /> Pilih / Ambil Foto
                                        </label>
                                        <p className="text-[10px] text-slate-400">Format JPG, PNG (Maks 5MB)</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                                <span>Produk ini akan otomatis tampil di tab produk <strong>Data Vendor</strong>.</span>
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsProductModalOpen(false)}
                                    className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingProduct}
                                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50"
                                >
                                    {savingProduct ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
                                    {savingProduct ? 'Menyimpan...' : (editingProduct ? 'Simpan Perubahan' : 'Simpan ke Katalog')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: Riwayat Perubahan Harga */}
            {isHistoryModalOpen && selectedProductHistory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl max-w-md w-full flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                    <Clock className="text-indigo-600" size={18} /> Riwayat Perubahan Harga
                                </h3>
                                <p className="text-xs text-slate-500 font-medium line-clamp-1 mt-0.5">
                                    {selectedProductHistory.name}
                                </p>
                            </div>
                            <button
                                onClick={() => setIsHistoryModalOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
                            {(!selectedProductHistory.priceHistory || selectedProductHistory.priceHistory.length === 0) ? (
                                <div className="text-center py-8 text-slate-400 text-xs">
                                    Belum ada catatan riwayat harga.
                                </div>
                            ) : (
                                <div className="relative border-l-2 border-slate-200 ml-3 space-y-4 pl-4">
                                    {selectedProductHistory.priceHistory.map((h, i) => (
                                        <div key={h.id || i} className="relative">
                                            <span className={`absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                                                i === 0 ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-slate-400'
                                            }`} />
                                            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] font-bold text-slate-500">
                                                        {new Date(h.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                    </span>
                                                    {i === 0 && (
                                                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                                            Harga Terkini
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm font-black text-slate-800 font-mono mt-0.5">
                                                    Rp {(parseFloat(h.price) || 0).toLocaleString('id-ID')}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => setIsHistoryModalOpen(false)}
                                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 3: Quick Update Harga */}
            {isPriceModalOpen && productForPriceUpdate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl max-w-sm w-full flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                <DollarSign className="text-emerald-600" size={18} /> Update Harga Produk
                            </h3>
                            <button
                                onClick={() => setIsPriceModalOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveQuickPrice} className="p-5 space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                    Produk
                                </label>
                                <p className="font-bold text-xs text-slate-800">{productForPriceUpdate.name}</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                    Harga Saat Ini: Rp {(parseFloat(productForPriceUpdate.price) || 0).toLocaleString('id-ID')}
                                </p>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-700 uppercase block mb-1">
                                    Harga Baru (Rp) <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-emerald-800"
                                    placeholder="Masukkan harga baru..."
                                    value={newPrice}
                                    onChange={e => setNewPrice(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>

                            <p className="text-[11px] text-slate-500">
                                * Perubahan harga akan otomatis dicatat ke riwayat update harga dan langsung tampil di Data Vendor.
                            </p>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsPriceModalOpen(false)}
                                    className="px-3 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20"
                                >
                                    Simpan Harga Baru
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
