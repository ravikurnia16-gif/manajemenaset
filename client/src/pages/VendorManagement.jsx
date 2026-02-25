import { useState, useEffect } from 'react';
import axios from '../lib/axios';
import {
    Users, Plus, Search, MapPin, Phone, Mail, Globe,
    MoreVertical, Edit2, Trash2, Package, CheckCircle,
    X, Camera, ExternalLink, Info, Filter, ShoppingBag
} from 'lucide-react';

const VendorManagement = () => {
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('ALL');

    // Vendor Modal States
    const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
    const [currentVendor, setCurrentVendor] = useState(null);
    const [vendorForm, setVendorForm] = useState({
        name: '', address: '', phone: '', email: '',
        website: '', description: '', category: '',
        photo: null, isVerified: false
    });

    // Product Modal States
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [selectedVendorForProducts, setSelectedVendorForProducts] = useState(null);
    const [products, setProducts] = useState([]);
    const [productForm, setProductForm] = useState({
        name: '', price: '', specification: '', image: null
    });
    const [isAddingProduct, setIsAddingProduct] = useState(false);

    useEffect(() => {
        fetchVendors();
    }, [search, selectedCategory]);

    const fetchVendors = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/vendors', {
                params: { search, category: selectedCategory === 'ALL' ? '' : selectedCategory }
            });
            setVendors(res.data);
        } catch (error) {
            console.error('Fetch vendors error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveVendor = async (e) => {
        e.preventDefault();
        try {
            // Only send fields the backend expects
            const payload = {
                name: vendorForm.name,
                address: vendorForm.address || null,
                phone: vendorForm.phone || null,
                email: vendorForm.email || null,
                website: vendorForm.website || null,
                description: vendorForm.description || null,
                category: vendorForm.category || null,
                photo: vendorForm.photo || null,
                isVerified: vendorForm.isVerified || false
            };
            if (currentVendor) {
                await axios.put(`/api/vendors/${currentVendor.id}`, payload);
            } else {
                await axios.post('/api/vendors', payload);
            }
            setIsVendorModalOpen(false);
            fetchVendors();
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal menyimpan vendor');
        }
    };

    const handleDeleteVendor = async (id) => {
        if (!confirm('Hapus vendor ini?')) return;
        try {
            await axios.delete(`/api/vendors/${id}`);
            fetchVendors();
        } catch (error) {
            alert('Gagal menghapus vendor');
        }
    };

    const openProductModal = async (vendor) => {
        setSelectedVendorForProducts(vendor);
        setIsProductModalOpen(true);
        fetchProducts(vendor.id);
    };

    const fetchProducts = async (vendorId) => {
        try {
            const res = await axios.get(`/api/vendors/${vendorId}/products`);
            setProducts(res.data);
        } catch (error) {
            console.error('Fetch products error:', error);
        }
    };

    const handleAddProduct = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`/api/vendors/${selectedVendorForProducts.id}/products`, productForm);
            setProductForm({ name: '', price: '', specification: '', image: null });
            setIsAddingProduct(false);
            fetchProducts(selectedVendorForProducts.id);
        } catch (error) {
            alert('Gagal menambah produk');
        }
    };

    const handleDeleteProduct = async (productId) => {
        if (!confirm('Hapus produk ini?')) return;
        try {
            await axios.delete(`/api/vendors/${selectedVendorForProducts.id}/products/${productId}`);
            fetchProducts(selectedVendorForProducts.id);
        } catch (error) {
            alert('Gagal menghapus produk');
        }
    };

    const handleImageUpload = (e, target) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (target === 'vendor') {
                    setVendorForm({ ...vendorForm, photo: reader.result });
                } else {
                    setProductForm({ ...productForm, image: reader.result });
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const categories = ['ALL', 'IT', 'Alat Tulis', 'Meubel', 'Elektronik', 'Konstruksi', 'Lainnya'];

    return (
        <div className="p-6 pb-20 max-w-7xl mx-auto animate-fadeIn">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Users className="text-blue-600" /> Manajemen Vendor Profesional
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Kelola data vendor, katalog produk, dan info spesifikasi secara mendalam.</p>
                </div>
                <button
                    onClick={() => {
                        setCurrentVendor(null);
                        setVendorForm({
                            name: '', address: '', phone: '', email: '',
                            website: '', description: '', category: '',
                            photo: null, isVerified: false
                        });
                        setIsVendorModalOpen(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95"
                >
                    <Plus size={18} /> Tambah Vendor Baru
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 mb-8">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Cari nama vendor atau deskripsi..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
                    <Filter size={16} className="text-slate-400 shrink-0" />
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${selectedCategory === cat
                                ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-400'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-slate-50 h-64 rounded-2xl animate-pulse" />
                    ))}
                </div>
            ) : vendors.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Users className="text-slate-400" />
                    </div>
                    <h3 className="text-slate-800 font-bold text-lg">Belum Ada Data Vendor</h3>
                    <p className="text-slate-500 mt-1 max-w-sm mx-auto px-4">Data vendor yang Anda input di form aset akan muncul di sini. Klik tombol Tambah untuk data profesional.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {vendors.map(vendor => (
                        <div key={vendor.id} className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 transition-all overflow-hidden">
                            <div className="relative h-32 bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden">
                                {vendor.photo ? (
                                    <img src={vendor.photo} alt={vendor.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                ) : (
                                    <div className="flex items-center justify-center h-full opacity-30">
                                        <Users size={48} className="text-slate-400" />
                                    </div>
                                )}
                                <div className="absolute top-3 right-3 flex gap-2">
                                    {vendor.isVerified && (
                                        <span className="bg-blue-600 text-white p-1 rounded-full shadow-lg" title="Vendor Terverifikasi">
                                            <CheckCircle size={14} />
                                        </span>
                                    )}
                                    <div className="relative group/menu">
                                        <button className="bg-white/80 backdrop-blur-sm p-1.5 rounded-full hover:bg-white shadow-sm flex items-center justify-center transition-all">
                                            <MoreVertical size={14} className="text-slate-600" />
                                        </button>
                                        <div className="absolute right-0 top-8 bg-white border border-slate-100 rounded-xl shadow-2xl p-1.5 hidden group-hover/menu:block z-10 w-32 border-b-2 border-b-blue-500">
                                            <button
                                                onClick={() => {
                                                    setCurrentVendor(vendor);
                                                    setVendorForm({
                                                        name: vendor.name || '',
                                                        address: vendor.address || '',
                                                        phone: vendor.phone || '',
                                                        email: vendor.email || '',
                                                        website: vendor.website || '',
                                                        description: vendor.description || '',
                                                        category: vendor.category || '',
                                                        photo: vendor.photo || null,
                                                        isVerified: vendor.isVerified || false
                                                    });
                                                    setIsVendorModalOpen(true);
                                                }}
                                                className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-slate-50 rounded-lg text-slate-700"
                                            >
                                                <Edit2 size={12} /> Edit Profil
                                            </button>
                                            <button
                                                onClick={() => handleDeleteVendor(vendor.id)}
                                                className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-red-50 rounded-lg text-red-600"
                                            >
                                                <Trash2 size={12} /> Hapus
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute bottom-3 left-3">
                                    <span className="bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full text-[10px] font-bold text-blue-600 shadow-sm uppercase tracking-wider">
                                        {vendor.category || 'Vendor'}
                                    </span>
                                </div>
                            </div>

                            <div className="p-5">
                                <h3 className="font-bold text-slate-800 text-lg mb-1 leading-tight">{vendor.name}</h3>
                                <p className="text-slate-500 text-xs line-clamp-2 mb-4 h-8">{vendor.description || 'Tidak ada deskripsi.'}</p>

                                <div className="space-y-2.5 mb-6">
                                    <div className="flex items-center gap-3 text-slate-600">
                                        <MapPin size={14} className="text-slate-400 shrink-0" />
                                        <span className="text-xs truncate">{vendor.address || '-'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-600">
                                        <Phone size={14} className="text-slate-400 shrink-0" />
                                        <span className="text-xs">{vendor.phone || '-'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-600">
                                        <ShoppingBag size={14} className="text-slate-400 shrink-0" />
                                        <span className="text-xs font-semibold text-blue-600">{vendor._count?.products || 0} Produk Terdaftar</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => openProductModal(vendor)}
                                    className="w-full bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 py-2.5 rounded-xl border border-slate-200 hover:border-blue-200 text-sm font-bold flex items-center justify-center gap-2 transition-all"
                                >
                                    <Package size={16} /> Lihat Katalog Produk
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Vendor Modal */}
            {isVendorModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsVendorModalOpen(false)}></div>
                    <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl relative overflow-hidden animate-slideUp">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h2 className="font-bold text-slate-800 text-xl flex items-center gap-2">
                                {currentVendor ? <Edit2 size={20} className="text-blue-600" /> : <Plus size={20} className="text-blue-600" />}
                                {currentVendor ? 'Edit Profil Vendor' : 'Tambah Vendor Baru'}
                            </h2>
                            <button onClick={() => setIsVendorModalOpen(false)} className="bg-white p-2 rounded-full border border-slate-200 text-slate-400 hover:text-slate-600 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveVendor} className="overflow-y-auto max-h-[80vh] p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Photo Upload */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-slate-700">Logo/Foto Profile</label>
                                    <div className="relative group cursor-pointer" onClick={() => document.getElementById('vendor-photo-input').click()}>
                                        <div className="w-full aspect-square bg-slate-100 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden transition-all group-hover:border-blue-400 group-hover:bg-blue-50">
                                            {vendorForm.photo ? (
                                                <img src={vendorForm.photo} className="w-full h-full object-cover" />
                                            ) : (
                                                <Camera className="text-slate-300 group-hover:text-blue-400 transition-colors" size={32} />
                                            )}
                                        </div>
                                        <div className="absolute inset-0 bg-black/40 items-center justify-center hidden group-hover:flex rounded-2xl transition-all">
                                            <span className="text-white text-xs font-bold">Ganti Foto</span>
                                        </div>
                                        <input
                                            id="vendor-photo-input"
                                            type="file"
                                            hidden
                                            accept="image/*"
                                            onChange={(e) => handleImageUpload(e, 'vendor')}
                                        />
                                    </div>
                                </div>

                                <div className="md:col-span-2 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Nama Vendor/Toko</label>
                                            <input
                                                required
                                                type="text"
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={vendorForm.name}
                                                onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Kategori Utama</label>
                                            <select
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={vendorForm.category}
                                                onChange={(e) => setVendorForm({ ...vendorForm, category: e.target.value })}
                                            >
                                                <option value="">Pilih Kategori</option>
                                                {categories.filter(c => c !== 'ALL').map(c => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Nomor HP/WA</label>
                                            <input
                                                type="text"
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={vendorForm.phone}
                                                onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                                            <input
                                                type="email"
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={vendorForm.email}
                                                onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Alamat Kantor/Toko</label>
                                    <textarea
                                        rows="2"
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                        value={vendorForm.address}
                                        onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })}
                                    ></textarea>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Website / Link Portfolio</label>
                                    <div className="flex gap-2">
                                        <div className="flex-1 relative">
                                            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                            <input
                                                type="text"
                                                placeholder="https://example.com"
                                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={vendorForm.website}
                                                onChange={(e) => setVendorForm({ ...vendorForm, website: e.target.value })}
                                            />
                                        </div>
                                        {vendorForm.website && (
                                            <a href={vendorForm.website} target="_blank" rel="noreferrer" className="bg-slate-100 h-10 w-10 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-200 transition-colors">
                                                <ExternalLink size={18} />
                                            </a>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Deskripsi / Spesialisasi Professional</label>
                                    <textarea
                                        rows="3"
                                        placeholder="Jelaskan mengenai keahlian atau layanan vendor..."
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                        value={vendorForm.description}
                                        onChange={(e) => setVendorForm({ ...vendorForm, description: e.target.value })}
                                    ></textarea>
                                </div>

                                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-2xl">
                                    <input
                                        type="checkbox"
                                        id="isVerified"
                                        className="w-5 h-5 accent-blue-600 rounded"
                                        checked={vendorForm.isVerified}
                                        onChange={(e) => setVendorForm({ ...vendorForm, isVerified: e.target.checked })}
                                    />
                                    <label htmlFor="isVerified" className="text-sm text-blue-800 font-bold flex items-center gap-1">
                                        Vendor Terverifikasi <Info size={14} className="opacity-50" title="Tandai jika vendor ini adalah rekanan tetap atau berkualitas terjamin." />
                                    </label>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 sticky bottom-0 bg-white">
                                <button
                                    type="button"
                                    onClick={() => setIsVendorModalOpen(false)}
                                    className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-all"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="flex-[2] px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/20 transition-all transform active:scale-95"
                                >
                                    {currentVendor ? 'Simpan Perubahan' : 'Daftarkan Vendor'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Product Modal */}
            {isProductModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setIsProductModalOpen(false)}></div>
                    <div className="bg-slate-50 rounded-[2.5rem] w-full max-w-4xl shadow-2xl relative overflow-hidden animate-slideUp flex flex-col md:flex-row max-h-[90vh]">
                        {/* Vendor Sidebar Info */}
                        <div className="w-full md:w-80 bg-white border-r border-slate-100 p-8 shrink-0 overflow-y-auto">
                            <div className="w-24 h-24 rounded-3xl overflow-hidden bg-slate-50 border border-slate-100 mb-6 mx-auto shadow-inner shadow-black/5">
                                {selectedVendorForProducts?.photo ? (
                                    <img src={selectedVendorForProducts.photo} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="flex items-center justify-center h-full opacity-30 text-slate-400 font-bold text-3xl">
                                        {selectedVendorForProducts?.name?.charAt(0)}
                                    </div>
                                )}
                            </div>
                            <h2 className="text-xl font-black text-slate-800 text-center mb-2 leading-tight">{selectedVendorForProducts?.name}</h2>
                            <div className="flex justify-center mb-6">
                                <span className="bg-blue-600/10 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter">
                                    {selectedVendorForProducts?.category || 'PRO-VENDOR'}
                                </span>
                            </div>

                            <div className="space-y-4 text-slate-500">
                                <div className="p-4 bg-slate-50 rounded-2xl flex items-start gap-4">
                                    <MapPin size={16} className="text-slate-400 mt-1 shrink-0" />
                                    <div className="text-xs leading-relaxed">{selectedVendorForProducts?.address || '-'}</div>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl flex items-center gap-4">
                                    <Phone size={16} className="text-slate-400 shrink-0" />
                                    <div className="text-xs font-bold">{selectedVendorForProducts?.phone || '-'}</div>
                                </div>
                            </div>

                            <button
                                onClick={() => setIsAddingProduct(true)}
                                className="w-full mt-10 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-blue-600/20 active:scale-95 transition-all"
                            >
                                <Plus size={18} /> Tambah Produk
                            </button>
                        </div>

                        {/* Product List Area */}
                        <div className="flex-1 p-8 overflow-y-auto bg-slate-50/50">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                                    <ShoppingBag className="text-blue-600" size={24} /> Katalog Produk
                                    <span className="text-sm font-bold bg-slate-200 text-slate-500 py-1 px-3 rounded-full ml-2">{products.length} Items</span>
                                </h3>
                                <button onClick={() => setIsProductModalOpen(false)} className="bg-white p-3 rounded-2xl shadow-sm text-slate-400 hover:text-red-500 transition-all border border-slate-100">
                                    <X size={20} />
                                </button>
                            </div>

                            {isAddingProduct && (
                                <form onSubmit={handleAddProduct} className="bg-white p-6 rounded-3xl shadow-2xl shadow-blue-900/5 border-2 border-blue-500/20 mb-8 animate-fadeIn">
                                    <div className="flex items-center justify-between mb-6">
                                        <h4 className="font-black text-slate-800 uppercase tracking-widest text-xs">Form Produk Baru</h4>
                                        <button onClick={() => setIsAddingProduct(false)} className="text-slate-400 hover:text-slate-600">
                                            <X size={16} />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Produk/Model</label>
                                                <input
                                                    required
                                                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all"
                                                    value={productForm.name}
                                                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Harga (IDR)</label>
                                                <input
                                                    type="number"
                                                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all"
                                                    value={productForm.price}
                                                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Spesifikasi Detail</label>
                                                <textarea
                                                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 transition-all resize-none"
                                                    rows="2"
                                                    value={productForm.specification}
                                                    onChange={(e) => setProductForm({ ...productForm, specification: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2 flex flex-col items-center">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest self-start ml-1">Foto Produk</label>
                                            <div className="flex-1 w-full bg-slate-100 rounded-3xl flex items-center justify-center overflow-hidden relative cursor-pointer group" onClick={() => document.getElementById('product-img').click()}>
                                                {productForm.image ? (
                                                    <img src={productForm.image} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Camera className="text-slate-300" size={40} />
                                                )}
                                                <input id="product-img" type="file" hidden accept="image/*" onChange={(e) => handleImageUpload(e, 'product')} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 mt-8">
                                        <button type="submit" className="flex-1 bg-slate-800 text-white font-black py-3 rounded-2xl shadow-xl shadow-slate-800/10 active:scale-95 transition-all uppercase tracking-widest text-xs">Simpan Produk</button>
                                        <button type="button" onClick={() => setIsAddingProduct(false)} className="px-6 py-3 font-black text-slate-400 uppercase tracking-widest text-xs">Batal</button>
                                    </div>
                                </form>
                            )}

                            {products.length === 0 ? (
                                <div className="text-center py-20 bg-white/50 border-2 border-dashed border-slate-200 rounded-[2rem]">
                                    <Package size={48} className="text-slate-200 mx-auto mb-4" />
                                    <p className="text-slate-400 font-bold">Katalog produk masih kosong.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    {products.map(prod => (
                                        <div key={prod.id} className="bg-white p-5 rounded-[2rem] shadow-sm hover:shadow-2xl hover:shadow-blue-500/5 transition-all border border-slate-100 group relative">
                                            <div className="flex gap-5">
                                                <div className="w-20 h-20 rounded-2xl bg-slate-50 overflow-hidden shrink-0 border border-slate-100">
                                                    {prod.image ? (
                                                        <img src={prod.image} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={24} /></div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h5 className="font-black text-slate-800 leading-tight mb-1 truncate">{prod.name}</h5>
                                                    <div className="text-xl font-black text-blue-600 mb-1">Rp {prod.price?.toLocaleString() || '0'}</div>
                                                    <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">{prod.specification || '-'}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteProduct(prod.id)}
                                                className="absolute -top-2 -right-2 w-8 h-8 bg-white text-red-400 border border-red-100 rounded-full shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 hover:text-red-600 active:scale-90"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VendorManagement;
