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
    Loader2,
    Instagram,
    Heart,
    MessageCircle,
    Send,
    Bookmark,
    Sparkles,
    Crop,
    Tag
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/axios';
import { getMediaUrl } from '../../lib/media';
import Swal from 'sweetalert2';
import {
    PRESET_UNITS,
    WORKSHOP_CATEGORIES,
    getCategoryMeta,
    parseCatalogSpecification,
    buildCatalogSpecification,
    inferCatalogCategory
} from './components/workshopCatalogUtils';

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
        category: 'KAYU', // KAYU | BESI | UMUM
        priceMode: 'FIXED', // FIXED | CUSTOM | VARIANT
        price: '',
        unit: 'Unit',
        customUnit: '',
        priceNote: '',
        variants: [{ label: '', unit: 'Unit', price: '' }],
        specification: '',
        image: null
    });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [rawImageFile, setRawImageFile] = useState(null);
    const [igRatio, setIgRatio] = useState('1:1'); // '1:1' (Square) or '4:5' (Portrait)
    const [isProcessingImage, setIsProcessingImage] = useState(false);

    // Helper to process photo into exact Instagram Post specifications (1:1 Square 1080x1080 or 4:5 Portrait 1080x1350)
    const processImageToInstagramRatio = (fileOrUrl, targetRatio = '1:1') => {
        return new Promise((resolve, reject) => {
            const img = new window.Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                const targetW = 1080;
                const targetH = targetRatio === '4:5' ? 1350 : 1080;
                const ratioValue = targetRatio === '4:5' ? (4 / 5) : 1;

                canvas.width = targetW;
                canvas.height = targetH;

                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                // Calculate center crop
                const srcRatio = img.width / img.height;
                let srcX = 0;
                let srcY = 0;
                let srcW = img.width;
                let srcH = img.height;

                if (srcRatio > ratioValue) {
                    srcW = img.height * ratioValue;
                    srcX = (img.width - srcW) / 2;
                } else {
                    srcH = img.width / ratioValue;
                    srcY = (img.height - srcH) / 2;
                }

                ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, targetW, targetH);

                canvas.toBlob((blob) => {
                    if (!blob) return reject(new Error('Gagal memproses gambar'));
                    const originalName = (fileOrUrl && fileOrUrl.name) ? fileOrUrl.name.replace(/\.[^/.]+$/, '') : 'produk_ig';
                    const newFile = new File(
                        [blob],
                        `${originalName}_ig_${targetRatio.replace(':', 'x')}.jpg`,
                        { type: 'image/jpeg' }
                    );
                    const previewUrl = URL.createObjectURL(blob);
                    resolve({ file: newFile, previewUrl });
                }, 'image/jpeg', 0.92);
            };
            img.onerror = (err) => reject(err);

            if (typeof fileOrUrl === 'string') {
                img.src = fileOrUrl;
            } else {
                img.src = URL.createObjectURL(fileOrUrl);
            }
        });
    };

    // Price History Modal
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedProductHistory, setSelectedProductHistory] = useState(null);

    // Quick Update Price Modal
    const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
    const [productForPriceUpdate, setProductForPriceUpdate] = useState(null);
    const [newPrice, setNewPrice] = useState('');
    const [quickPriceMode, setQuickPriceMode] = useState('FIXED');
    const [quickPriceNote, setQuickPriceNote] = useState('');

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
            category: selectedCategory === 'BESI' ? 'BESI' : (selectedCategory === 'UMUM' ? 'UMUM' : 'KAYU'),
            priceMode: 'FIXED',
            price: '',
            unit: 'Unit',
            customUnit: '',
            priceNote: '',
            variants: [{ label: '', unit: 'Unit', price: '' }],
            specification: '',
            image: null
        });
        setImageFile(null);
        setImagePreview(null);
        setRawImageFile(null);
        setIgRatio('1:1');
        setIsProductModalOpen(true);
    };

    const handleOpenEditModal = (p) => {
        const parsed = parseCatalogSpecification(p.specification);
        const inferredCat = parsed.category || inferCatalogCategory(p) || 'KAYU';
        const isPresetUnit = PRESET_UNITS.includes(parsed.unit);
        setEditingProduct(p);
        setForm({
            name: p.name || '',
            category: inferredCat,
            priceMode: parsed.priceMode,
            price: p.price !== null && p.price !== undefined && Number(p.price) > 0 ? String(p.price) : '',
            unit: isPresetUnit ? parsed.unit : 'CUSTOM_UNIT',
            customUnit: isPresetUnit ? '' : parsed.unit,
            priceNote: parsed.priceNote || '',
            variants: parsed.variants.length > 0
                ? parsed.variants.map((v) => ({ label: v.label, unit: v.unit, price: String(v.price || '') }))
                : [{ label: '', unit: parsed.unit || 'Unit', price: '' }],
            specification: parsed.cleanSpec,
            image: p.image || null
        });
        setImageFile(null);
        setRawImageFile(null);
        setIgRatio('1:1');
        setImagePreview(p.image ? (p.image.startsWith('http') ? p.image : getMediaUrl(p.image)) : null);
        setIsProductModalOpen(true);
    };

    const handleImageChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                setIsProcessingImage(true);
                setRawImageFile(file);
                const result = await processImageToInstagramRatio(file, igRatio);
                setImageFile(result.file);
                setImagePreview(result.previewUrl);
            } catch (error) {
                console.error('Error processing Instagram photo:', error);
                setImageFile(file);
                setImagePreview(URL.createObjectURL(file));
            } finally {
                setIsProcessingImage(false);
            }
        }
    };

    const handleChangeRatio = async (newRatio) => {
        if (newRatio === igRatio) return;
        setIgRatio(newRatio);
        const source = rawImageFile || imagePreview;
        if (source) {
            try {
                setIsProcessingImage(true);
                const result = await processImageToInstagramRatio(source, newRatio);
                setImageFile(result.file);
                setImagePreview(result.previewUrl);
            } catch (error) {
                console.error('Error re-cropping image:', error);
            } finally {
                setIsProcessingImage(false);
            }
        }
    };

    const handleRemoveImage = () => {
        setImageFile(null);
        setImagePreview(null);
        setRawImageFile(null);
        setForm(prev => ({ ...prev, image: null }));
    };

    const handleSaveProduct = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) {
            return Swal.fire('Peringatan', 'Nama produk wajib diisi.', 'warning');
        }

        const resolvedUnit = form.unit === 'CUSTOM_UNIT'
            ? (form.customUnit.trim() || 'Unit')
            : (form.unit || 'Unit');

        let cleanedVariants = [];
        let resolvedPrice = parseFloat(form.price) || 0;

        if (form.priceMode === 'VARIANT') {
            cleanedVariants = (form.variants || [])
                .filter((v) => (v.label || '').trim() || (v.unit || '').trim() || Number(v.price) > 0)
                .map((v) => ({
                    label: (v.label || '').trim() || 'Varian',
                    unit: (v.unit || '').trim() || resolvedUnit,
                    price: Math.max(0, parseFloat(v.price) || 0)
                }));

            if (cleanedVariants.length === 0) {
                return Swal.fire('Peringatan', 'Tambahkan minimal 1 varian bentuk/satuan pada mode Harga Varian.', 'warning');
            }
            const positivePrices = cleanedVariants.map((v) => v.price).filter((n) => n > 0);
            resolvedPrice = positivePrices.length > 0 ? Math.min(...positivePrices) : 0;
        }

        const combinedSpec = buildCatalogSpecification({
            category: form.category || 'KAYU',
            unit: resolvedUnit,
            priceMode: form.priceMode,
            priceNote: form.priceNote,
            variants: cleanedVariants,
            cleanSpec: form.specification
        });

        try {
            setSavingProduct(true);
            const formData = new FormData();
            formData.append('name', form.name.trim());
            formData.append('price', String(resolvedPrice));
            formData.append('unit', resolvedUnit);
            formData.append('specification', combinedSpec);

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
        const parsed = parseCatalogSpecification(p.specification);
        setProductForPriceUpdate(p);
        setNewPrice(p.price !== null && p.price !== undefined && Number(p.price) > 0 ? String(p.price) : '');
        setQuickPriceMode(parsed.priceMode === 'CUSTOM' ? 'CUSTOM' : 'FIXED');
        setQuickPriceNote(parsed.priceNote || '');
        setIsPriceModalOpen(true);
    };

    const handleSaveQuickPrice = async (e) => {
        e.preventDefault();
        if (!productForPriceUpdate) return;

        const parsed = parseCatalogSpecification(productForPriceUpdate.specification);
        const nextSpec = buildCatalogSpecification({
            category: parsed.category || inferCatalogCategory(productForPriceUpdate),
            unit: parsed.unit,
            priceMode: parsed.variants.length > 0 && quickPriceMode === 'FIXED' ? parsed.priceMode : quickPriceMode,
            priceNote: quickPriceNote,
            variants: parsed.variants,
            cleanSpec: parsed.cleanSpec
        });

        try {
            await api.put(`/workshop/catalog/${productForPriceUpdate.id}`, {
                name: productForPriceUpdate.name,
                price: newPrice !== '' ? (parseFloat(newPrice) || 0) : 0,
                unit: parsed.unit,
                specification: nextSpec
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

    const handleOrderProduct = async (p) => {
        const parsed = parseCatalogSpecification(p.specification);
        const catId = parsed.category || inferCatalogCategory(p);
        const mappedWorkshopType = catId === 'KAYU' || catId === 'BESI' ? catId : '';

        if (parsed.variants.length > 0) {
            const inputOptions = {};
            parsed.variants.forEach((v, idx) => {
                const priceLabel = v.price > 0 ? `Rp ${v.price.toLocaleString('id-ID')}` : 'Harga Custom';
                inputOptions[idx] = `${v.label} (${v.unit}) — ${priceLabel}`;
            });
            inputOptions.CUSTOM_SHAPE = '✏️ Bentuk / Ukuran Custom Lainnya (Harga Custom)';

            const { value: chosenIdx, isConfirmed } = await Swal.fire({
                title: `Pilih Bentuk / Satuan`,
                text: p.name,
                input: 'select',
                inputOptions,
                showCancelButton: true,
                confirmButtonText: 'Lanjut Pesan',
                cancelButtonText: 'Batal',
                confirmButtonColor: '#059669'
            });
            if (!isConfirmed) return;

            if (chosenIdx === 'CUSTOM_SHAPE') {
                navigate('/workshop-baru/orders/new', {
                    state: {
                        fromCatalog: {
                            ...p,
                            name: `${p.name} (Bentuk/Ukuran Custom)`,
                            unit: parsed.unit,
                            price: 0,
                            workshopType: mappedWorkshopType,
                            specification: `${parsed.cleanSpec}${parsed.cleanSpec ? '\n' : ''}Catatan: Pesanan bentuk/ukuran custom (estimasi harga menyesuaikan desain)`
                        }
                    }
                });
                return;
            }

            const chosen = parsed.variants[Number(chosenIdx)] || parsed.variants[0];
            navigate('/workshop-baru/orders/new', {
                state: {
                    fromCatalog: {
                        ...p,
                        name: `${p.name} (${chosen.label})`,
                        unit: chosen.unit,
                        price: chosen.price,
                        workshopType: mappedWorkshopType,
                        specification: parsed.cleanSpec
                    }
                }
            });
            return;
        }

        navigate('/workshop-baru/orders/new', {
            state: {
                fromCatalog: {
                    ...p,
                    unit: parsed.unit,
                    workshopType: mappedWorkshopType,
                    specification: parsed.priceNote
                        ? `${parsed.cleanSpec}${parsed.cleanSpec ? '\n' : ''}Catatan Harga: ${parsed.priceNote}`
                        : parsed.cleanSpec
                }
            }
        });
    };

    const categoryCounts = products.reduce(
        (acc, p) => {
            const cat = inferCatalogCategory(p);
            if (cat === 'KAYU') acc.KAYU += 1;
            else if (cat === 'BESI') acc.BESI += 1;
            else if (cat === 'UMUM') acc.UMUM += 1;
            return acc;
        },
        { KAYU: 0, BESI: 0, UMUM: 0 }
    );

    // Filter
    const filteredProducts = products.filter(p => {
        const parsed = parseCatalogSpecification(p.specification);
        const matchSearch = (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (parsed.cleanSpec || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (parsed.priceNote || '').toLowerCase().includes(searchQuery.toLowerCase());

        if (!matchSearch) return false;

        if (selectedCategory === 'ALL') return true;
        return inferCatalogCategory(p) === selectedCategory;
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
                        🪵 Pekerjaan Kayu ({categoryCounts.KAYU})
                    </button>
                    <button
                        onClick={() => setSelectedCategory('BESI')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                            selectedCategory === 'BESI' 
                                ? 'bg-slate-700 text-white shadow-sm' 
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                    >
                        ⚙️ Pekerjaan Besi ({categoryCounts.BESI})
                    </button>
                    {categoryCounts.UMUM > 0 && (
                        <button
                            onClick={() => setSelectedCategory('UMUM')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                                selectedCategory === 'UMUM'
                                    ? 'bg-teal-600 text-white shadow-sm'
                                    : 'bg-teal-50 text-teal-800 hover:bg-teal-100'
                            }`}
                        >
                            🛠️ Campuran ({categoryCounts.UMUM})
                        </button>
                    )}
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
                        const parsed = parseCatalogSpecification(p.specification);
                        const catMeta = getCategoryMeta(parsed.category || inferCatalogCategory(p));
                        const numericPrice = parseFloat(p.price) || 0;
                        const variantPrices = parsed.variants.map((v) => Number(v.price) || 0).filter((n) => n > 0);
                        const minVariantPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : numericPrice;
                        const maxVariantPrice = variantPrices.length > 0 ? Math.max(...variantPrices) : numericPrice;

                        return (
                            <div 
                                key={p.id}
                                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md hover:border-emerald-300 transition-all group"
                            >
                                {/* Image Box - Rasio 1:1 Postingan Instagram */}
                                <div 
                                    className="aspect-square w-full bg-slate-100 relative overflow-hidden flex items-center justify-center"
                                    style={{ aspectRatio: '1 / 1' }}
                                >
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

                                    {/* Instagram Ratio Badge */}
                                    {mediaSrc && (
                                        <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[10px] font-bold text-white flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                            <Instagram size={10} className="text-pink-400" />
                                            <span>1:1 IG</span>
                                        </div>
                                    )}

                                    {/* Mode Harga Badge */}
                                    {parsed.priceMode !== 'FIXED' && (
                                        <div className={`absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold shadow-xs flex items-center gap-1 ${
                                            parsed.priceMode === 'CUSTOM'
                                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                                : 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                                        }`}>
                                            <Tag size={10} />
                                            <span>{parsed.priceMode === 'CUSTOM' ? 'Harga Custom' : `${parsed.variants.length} Variasi`}</span>
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
                                            <div className="space-y-1">
                                                {catMeta && (
                                                    <span className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-bold ${catMeta.chipCls}`}>
                                                        {catMeta.badge}
                                                    </span>
                                                )}
                                                <h3 className="font-extrabold text-sm text-slate-800 group-hover:text-emerald-700 transition-colors">
                                                    {p.name}
                                                </h3>
                                            </div>
                                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold shrink-0">
                                                /{parsed.unit}
                                            </span>
                                        </div>

                                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                            {parsed.cleanSpec || 'Tidak ada spesifikasi khusus.'}
                                        </p>

                                        {parsed.priceNote && (
                                            <p className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200/70">
                                                💡 {parsed.priceNote}
                                            </p>
                                        )}

                                        {parsed.variants.length > 0 && (
                                            <div className="flex flex-wrap gap-1 pt-0.5">
                                                {parsed.variants.map((v, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200/80 text-[10px] font-semibold"
                                                    >
                                                        {v.label} ({v.unit}): {v.price > 0 ? `Rp ${v.price.toLocaleString('id-ID')}` : 'Custom'}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Price & History Badge */}
                                    <div className="pt-2 border-t border-slate-100 space-y-2">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase block">
                                                    {parsed.priceMode === 'CUSTOM'
                                                        ? 'Harga Custom (Satuan / Bentuk)'
                                                        : parsed.priceMode === 'VARIANT'
                                                            ? 'Kisaran Harga Varian'
                                                            : `Harga Standar / ${parsed.unit}`}
                                                </span>
                                                {parsed.priceMode === 'CUSTOM' && numericPrice <= 0 ? (
                                                    <p className="text-sm font-black text-amber-700">
                                                        Sesuai Ukuran / Bentuk
                                                    </p>
                                                ) : parsed.priceMode === 'VARIANT' && maxVariantPrice > minVariantPrice ? (
                                                    <p className="text-sm font-black text-indigo-700 font-mono">
                                                        Rp {minVariantPrice.toLocaleString('id-ID')} – {maxVariantPrice.toLocaleString('id-ID')}
                                                    </p>
                                                ) : parsed.priceMode === 'CUSTOM' ? (
                                                    <p className="text-base font-black text-amber-700 font-mono">
                                                        Mulai Rp {numericPrice.toLocaleString('id-ID')} <span className="text-[11px] font-bold text-slate-500">/ {parsed.unit}</span>
                                                    </p>
                                                ) : (
                                                    <p className="text-base font-black text-emerald-700 font-mono">
                                                        Rp {numericPrice.toLocaleString('id-ID')} <span className="text-[11px] font-bold text-slate-500">/ {parsed.unit}</span>
                                                    </p>
                                                )}
                                            </div>

                                            {/* Price History Button */}
                                            <button
                                                type="button"
                                                onClick={() => handleOpenHistoryModal(p)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shrink-0"
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
                    <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
                        {/* Header Modal */}
                        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                                    <Package size={20} />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-slate-800 text-sm sm:text-base">
                                        {editingProduct ? 'Edit Produk Workshop' : 'Tambah Produk Workshop Baru'}
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        Katalog standar Unit 21 • Otomatis terhubung dengan Data Vendor
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsProductModalOpen(false)}
                                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/70 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveProduct} className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                {/* KOLOM KIRI: Data Produk */}
                                <div className="md:col-span-6 space-y-4">
                                    {/* Nama Produk */}
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-700 uppercase mb-1.5 block">
                                            Nama Produk / Barang <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-semibold text-slate-800 shadow-xs"
                                            placeholder="Contoh: Meja Rapat Kayu Jati 240×120cm"
                                            value={form.name}
                                            onChange={e => setForm({ ...form, name: e.target.value })}
                                            required
                                        />
                                    </div>

                                    {/* Kategori Pekerjaan (Kayu vs Besi vs Campuran) */}
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-700 uppercase mb-1.5 block">
                                            Kategori Pekerjaan Workshop <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {WORKSHOP_CATEGORIES.map((cat) => (
                                                <button
                                                    key={cat.id}
                                                    type="button"
                                                    onClick={() => setForm((prev) => ({ ...prev, category: cat.id }))}
                                                    className={`px-2.5 py-2 rounded-xl text-[11px] font-bold border transition-all text-center ${
                                                        form.category === cat.id
                                                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    {cat.badge}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Skema Harga & Satuan */}
                                    <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700 uppercase mb-1.5 block">
                                                Skema Penetapan Harga
                                            </label>
                                            <div className="grid grid-cols-3 gap-1.5">
                                                {[
                                                    { id: 'FIXED', label: 'Harga Tetap' },
                                                    { id: 'CUSTOM', label: 'Harga Custom' },
                                                    { id: 'VARIANT', label: 'Varian Satuan/Bentuk' }
                                                ].map((mode) => (
                                                    <button
                                                        key={mode.id}
                                                        type="button"
                                                        onClick={() => setForm((prev) => ({ ...prev, priceMode: mode.id }))}
                                                        className={`px-2 py-2 rounded-xl text-[11px] font-bold border transition-all ${
                                                            form.priceMode === mode.id
                                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                                        }`}
                                                    >
                                                        {mode.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            {form.priceMode !== 'VARIANT' && (
                                                <div>
                                                    <label className="text-[11px] font-bold text-slate-700 uppercase mb-1.5 block">
                                                        {form.priceMode === 'CUSTOM' ? 'Estimasi Mulai (Rp, Opsional)' : 'Harga Standar (Rp)'}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800 shadow-xs font-mono bg-white"
                                                        placeholder={form.priceMode === 'CUSTOM' ? '0 = Sesuai ukuran' : 'Contoh: 1500000'}
                                                        value={form.price}
                                                        onChange={e => setForm({ ...form, price: e.target.value })}
                                                    />
                                                </div>
                                            )}

                                            <div className={form.priceMode === 'VARIANT' ? 'col-span-2' : ''}>
                                                <label className="text-[11px] font-bold text-slate-700 uppercase mb-1.5 block">
                                                    Satuan Utama
                                                </label>
                                                <select
                                                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium text-slate-800 shadow-xs"
                                                    value={form.unit}
                                                    onChange={e => setForm({ ...form, unit: e.target.value })}
                                                >
                                                    {PRESET_UNITS.map((u) => (
                                                        <option key={u} value={u}>{u}</option>
                                                    ))}
                                                    <option value="CUSTOM_UNIT">+ Ketik Satuan Custom...</option>
                                                </select>
                                            </div>
                                        </div>

                                        {form.unit === 'CUSTOM_UNIT' && (
                                            <div>
                                                <label className="text-[11px] font-bold text-slate-700 uppercase mb-1 block">
                                                    Nama Satuan Custom
                                                </label>
                                                <input
                                                    type="text"
                                                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-semibold"
                                                    placeholder="Contoh: Daun Pintu, Kubik, Meter Lari, Lubang..."
                                                    value={form.customUnit}
                                                    onChange={e => setForm({ ...form, customUnit: e.target.value })}
                                                />
                                            </div>
                                        )}

                                        {(form.priceMode === 'CUSTOM' || form.priceMode === 'VARIANT') && (
                                            <div>
                                                <label className="text-[11px] font-bold text-slate-700 uppercase mb-1 block">
                                                    Catatan / Dasar Perhitungan Harga (Opsional)
                                                </label>
                                                <input
                                                    type="text"
                                                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                                                    placeholder="Contoh: Harga menyesuaikan ukuran (m²), bentuk rangka & ketebalan bahan"
                                                    value={form.priceNote}
                                                    onChange={e => setForm({ ...form, priceNote: e.target.value })}
                                                />
                                            </div>
                                        )}

                                        {form.priceMode === 'VARIANT' && (
                                            <div className="space-y-2 pt-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] font-bold text-indigo-900">
                                                        Daftar Variasi Berdasarkan Satuan / Bentuk
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setForm((prev) => ({
                                                            ...prev,
                                                            variants: [
                                                                ...prev.variants,
                                                                { label: '', unit: prev.unit === 'CUSTOM_UNIT' ? (prev.customUnit || 'Unit') : prev.unit, price: '' }
                                                            ]
                                                        }))}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[10px] font-bold hover:bg-indigo-700"
                                                    >
                                                        <Plus size={11} /> Tambah Varian
                                                    </button>
                                                </div>

                                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                                    {form.variants.map((v, idx) => (
                                                        <div key={idx} className="grid grid-cols-12 gap-1.5 items-center bg-white p-2 rounded-xl border border-indigo-100">
                                                            <input
                                                                type="text"
                                                                className="col-span-5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                                                                placeholder="Bentuk / Ukuran (mis. L-Shape)"
                                                                value={v.label}
                                                                onChange={(e) => setForm((prev) => ({
                                                                    ...prev,
                                                                    variants: prev.variants.map((item, i) => i === idx ? { ...item, label: e.target.value } : item)
                                                                }))}
                                                            />
                                                            <input
                                                                type="text"
                                                                className="col-span-3 px-2 py-1.5 rounded-lg border border-slate-200 text-xs"
                                                                placeholder="Satuan (m²/Unit)"
                                                                value={v.unit}
                                                                onChange={(e) => setForm((prev) => ({
                                                                    ...prev,
                                                                    variants: prev.variants.map((item, i) => i === idx ? { ...item, unit: e.target.value } : item)
                                                                }))}
                                                            />
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                className="col-span-3 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-mono"
                                                                placeholder="0 = Custom"
                                                                title="Isi 0 bila harga bentuk ini menyesuaikan / custom"
                                                                value={v.price}
                                                                onChange={(e) => setForm((prev) => ({
                                                                    ...prev,
                                                                    variants: prev.variants.map((item, i) => i === idx ? { ...item, price: e.target.value } : item)
                                                                }))}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setForm((prev) => ({
                                                                    ...prev,
                                                                    variants: prev.variants.length > 1
                                                                        ? prev.variants.filter((_, i) => i !== idx)
                                                                        : prev.variants
                                                                }))}
                                                                className="col-span-1 flex justify-center text-slate-400 hover:text-rose-600"
                                                                title="Hapus baris"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Spesifikasi / Rincian */}
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-700 uppercase mb-1.5 block">
                                            Rincian & Spesifikasi Teknis
                                        </label>
                                        <textarea
                                            rows={4}
                                            className="w-full border border-slate-300 rounded-xl p-3 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-slate-700 shadow-xs leading-relaxed"
                                            placeholder="Rincian bahan material, ukuran panjang x lebar x tinggi, finishing politur/cat/HPL, konstruksi rangka..."
                                            value={form.specification}
                                            onChange={e => setForm({ ...form, specification: e.target.value })}
                                        />
                                    </div>

                                    <div className="p-3.5 bg-emerald-50/80 rounded-2xl border border-emerald-200/80 text-emerald-900 text-xs flex items-center gap-2.5 shadow-xs">
                                        <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                                        <span className="leading-snug">
                                            Produk ini akan otomatis tampil di tab produk <strong>Data Vendor</strong>.
                                        </span>
                                    </div>
                                </div>

                                {/* KOLOM KANAN: Foto Produk Postingan Instagram */}
                                <div className="md:col-span-6 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1.5">
                                            <Instagram size={14} className="text-pink-600" />
                                            <span>Foto Produk (Format Instagram)</span>
                                        </label>

                                        {/* Toggle Rasio Instagram */}
                                        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                                            <button
                                                type="button"
                                                onClick={() => handleChangeRatio('1:1')}
                                                className={`px-2 py-1 rounded-md text-[10px] font-extrabold transition-all ${
                                                    igRatio === '1:1'
                                                        ? 'bg-white text-slate-900 shadow-xs'
                                                        : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                            >
                                                1:1 Persegi
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleChangeRatio('4:5')}
                                                className={`px-2 py-1 rounded-md text-[10px] font-extrabold transition-all ${
                                                    igRatio === '4:5'
                                                        ? 'bg-white text-slate-900 shadow-xs'
                                                        : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                            >
                                                4:5 Potret
                                            </button>
                                        </div>
                                    </div>

                                    {/* Keterangan Ukuran Instagram */}
                                    <div className="flex items-center justify-between text-[10px] text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                                        <span className="font-semibold text-slate-600">
                                            Format: {igRatio === '1:1' ? '1:1 Persegi (1080 × 1080 px)' : '4:5 Potret (1080 × 1350 px)'}
                                        </span>
                                        <span className="text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded">
                                            ✓ Auto-Crop Canvas
                                        </span>
                                    </div>

                                    {/* Upload Trigger / Dropzone / Preview */}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        id="product-photo-upload"
                                        className="hidden"
                                        onChange={handleImageChange}
                                    />

                                    {imagePreview ? (
                                        /* MOCKUP POSTINGAN INSTAGRAM */
                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden transition-all">
                                            {/* Instagram Header */}
                                            <div className="px-3.5 py-2 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 p-[1.5px] shrink-0">
                                                        <div className="w-full h-full bg-white rounded-full flex items-center justify-center text-[8px] font-black text-emerald-800">
                                                            WS
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="text-[11px] font-bold text-slate-800 leading-tight">workshop.dareliman</p>
                                                        <p className="text-[9px] text-slate-400">Padang • Katalog Resmi</p>
                                                    </div>
                                                </div>
                                                <span className="text-[9px] font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 px-2 py-0.5 rounded-full shadow-xs">
                                                    {igRatio === '1:1' ? '1:1 (1080×1080)' : '4:5 (1080×1350)'}
                                                </span>
                                            </div>

                                            {/* Photo Container in Exact Instagram Ratio */}
                                            <div className={`relative w-full bg-slate-900 group ${igRatio === '1:1' ? 'aspect-square max-h-[290px]' : 'aspect-[4/5] max-h-[350px]'} flex items-center justify-center overflow-hidden`}>
                                                {isProcessingImage ? (
                                                    <div className="flex flex-col items-center gap-2 text-white">
                                                        <Loader2 size={26} className="animate-spin text-pink-400" />
                                                        <span className="text-xs font-medium">Menyesuaikan Rasio Instagram...</span>
                                                    </div>
                                                ) : (
                                                    <img
                                                        src={imagePreview}
                                                        alt="Pratinjau Postingan Instagram"
                                                        className="w-full h-full object-cover"
                                                    />
                                                )}

                                                {/* Hover Action Overlay */}
                                                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
                                                    <label
                                                        htmlFor="product-photo-upload"
                                                        className="cursor-pointer px-3 py-1.5 rounded-xl bg-white text-slate-800 text-xs font-bold shadow-lg hover:bg-slate-100 transition-all flex items-center gap-1.5"
                                                    >
                                                        <Camera size={13} /> Ganti Foto
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={handleRemoveImage}
                                                        className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-lg hover:bg-rose-700 transition-all flex items-center gap-1.5"
                                                    >
                                                        <Trash2 size={13} /> Hapus
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Instagram Bottom Interactions */}
                                            <div className="p-3 space-y-1.5 bg-white">
                                                <div className="flex items-center justify-between text-slate-700">
                                                    <div className="flex items-center gap-2.5">
                                                        <Heart size={16} className="text-rose-500 fill-rose-500" />
                                                        <MessageCircle size={16} />
                                                        <Send size={16} />
                                                    </div>
                                                    <Bookmark size={16} />
                                                </div>

                                                {/* Caption Preview */}
                                                <div className="text-[11px] text-slate-700 leading-relaxed font-normal">
                                                    <span className="font-bold text-slate-900 mr-1.5">workshop.dareliman</span>
                                                    <span className="font-semibold text-slate-800">{form.name || 'Nama Produk Workshop'}</span>
                                                    {form.priceMode === 'CUSTOM' ? (
                                                        <span className="text-amber-700 font-bold ml-1.5">
                                                            ({form.price ? `Mulai Rp ${parseFloat(form.price).toLocaleString('id-ID')} / ${form.unit === 'CUSTOM_UNIT' ? (form.customUnit || 'Unit') : form.unit}` : 'Harga Custom'})
                                                        </span>
                                                    ) : form.price && (
                                                        <span className="text-emerald-700 font-bold ml-1.5">
                                                            (Rp {parseFloat(form.price).toLocaleString('id-ID')} / {form.unit === 'CUSTOM_UNIT' ? (form.customUnit || 'Unit') : form.unit})
                                                        </span>
                                                    )}
                                                    {form.specification && (
                                                        <p className="text-slate-500 mt-0.5 line-clamp-1">{form.specification}</p>
                                                    )}
                                                    <p className="text-indigo-600 text-[10px] font-medium mt-0.5">
                                                        #workshop #katalog #furnitur #dareliman
                                                    </p>
                                                </div>

                                                <div className="pt-1 flex items-center justify-between border-t border-slate-100 text-[10px]">
                                                    <span className="text-slate-400">Siap diekspor ke postingan feed</span>
                                                    <label
                                                        htmlFor="product-photo-upload"
                                                        className="text-indigo-600 hover:text-indigo-700 font-bold cursor-pointer flex items-center gap-1"
                                                    >
                                                        <Camera size={11} /> Ganti Gambar
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        /* EMPTY STATE INSTAGRAM DROPZONE */
                                        <label
                                            htmlFor="product-photo-upload"
                                            className={`cursor-pointer group block relative w-full ${
                                                igRatio === '1:1' ? 'aspect-square max-h-[290px]' : 'aspect-[4/5] max-h-[350px]'
                                            } rounded-2xl border-2 border-dashed border-rose-300 hover:border-rose-500 bg-gradient-to-tr from-amber-500/5 via-rose-500/5 to-purple-600/5 hover:from-amber-500/10 hover:to-purple-600/10 transition-all p-6 flex flex-col items-center justify-center text-center shadow-xs`}
                                        >
                                            {isProcessingImage ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Loader2 size={30} className="animate-spin text-pink-500" />
                                                    <p className="text-xs font-bold text-slate-700">Menyesuaikan Ukuran Instagram...</p>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 p-0.5 shadow-md group-hover:scale-105 transition-transform mb-2.5">
                                                        <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center text-rose-500">
                                                            <Instagram size={28} />
                                                        </div>
                                                    </div>

                                                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-800 group-hover:text-rose-600 transition-colors">
                                                        Pilih / Ambil Foto Produk
                                                    </h4>
                                                    <p className="text-[11px] text-slate-500 mt-1 max-w-[240px] leading-relaxed">
                                                        Otomatis disesuaikan ke ukuran postingan Instagram (<strong>{igRatio === '1:1' ? '1:1 Persegi 1080×1080 px' : '4:5 Potret 1080×1350 px'}</strong>)
                                                    </p>

                                                    <div className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-rose-200 text-slate-700 text-xs font-bold shadow-xs group-hover:border-rose-300 transition-all">
                                                        <Camera size={13} className="text-rose-500" />
                                                        <span>Buka Galeri / Kamera</span>
                                                    </div>

                                                    <span className="text-[10px] text-slate-400 mt-2">
                                                        Format JPG, PNG, WebP (Maks 10MB)
                                                    </span>
                                                </>
                                            )}
                                        </label>
                                    )}
                                </div>
                            </div>

                            {/* Footer Modal */}
                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setIsProductModalOpen(false)}
                                    className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingProduct || isProcessingImage}
                                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all"
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
                                <label className="text-[11px] font-bold text-slate-700 uppercase block mb-1.5">
                                    Mode Harga
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setQuickPriceMode('FIXED')}
                                        className={`py-2 rounded-xl text-xs font-bold border ${
                                            quickPriceMode === 'FIXED'
                                                ? 'bg-emerald-600 text-white border-emerald-600'
                                                : 'bg-white text-slate-600 border-slate-200'
                                        }`}
                                    >
                                        Harga Tetap
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setQuickPriceMode('CUSTOM')}
                                        className={`py-2 rounded-xl text-xs font-bold border ${
                                            quickPriceMode === 'CUSTOM'
                                                ? 'bg-amber-600 text-white border-amber-600'
                                                : 'bg-white text-slate-600 border-slate-200'
                                        }`}
                                    >
                                        Harga Custom
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-700 uppercase block mb-1">
                                    {quickPriceMode === 'CUSTOM' ? 'Estimasi Mulai Dari (Rp, 0/kosong = Custom)' : 'Harga Baru (Rp)'} {quickPriceMode === 'FIXED' && <span className="text-rose-500">*</span>}
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-emerald-800"
                                    placeholder={quickPriceMode === 'CUSTOM' ? 'Kosongkan atau isi estimasi dasar...' : 'Masukkan harga baru...'}
                                    value={newPrice}
                                    onChange={e => setNewPrice(e.target.value)}
                                    required={quickPriceMode === 'FIXED'}
                                    autoFocus
                                />
                            </div>

                            {quickPriceMode === 'CUSTOM' && (
                                <div>
                                    <label className="text-[11px] font-bold text-slate-700 uppercase block mb-1">
                                        Catatan Harga Custom (Satuan / Bentuk)
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder="Contoh: Harga dihitung per m² / tergantung bentuk"
                                        value={quickPriceNote}
                                        onChange={e => setQuickPriceNote(e.target.value)}
                                    />
                                </div>
                            )}

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
