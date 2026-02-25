import { useState, useEffect } from 'react';
import api from '../lib/axios';
import { Search, Package, User, Building, MapPin, Phone, Globe, Info, ExternalLink, Grid, List as ListIcon, Filter, X, ChevronRight } from 'lucide-react';

const ProductCatalog = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async (searchTerm = '') => {
        try {
            setLoading(true);
            const res = await api.get(`/vendors/all/products?search=${searchTerm}`);
            setProducts(res.data);
        } catch (error) {
            console.error('Error fetching products:', error);
            alert('Gagal mengambil data catalog produk');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        fetchProducts(search);
    };

    const formatCurrency = (amount) => {
        if (!amount) return 'Hubungi Vendor';
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mt-2">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                            <Package size={24} />
                        </div>
                        Katalog Produk Vendor
                    </h1>
                    <p className="text-slate-500 mt-1">Daftar produk dan jasa dari seluruh vendor terdaftar</p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Grid size={20} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <ListIcon size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <form onSubmit={handleSearch} className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Cari produk, spesifikasi, atau vendor..."
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-all shadow-md shadow-blue-200 flex items-center gap-2"
                    >
                        Cari
                    </button>
                    {search && (
                        <button
                            type="button"
                            onClick={() => { setSearch(''); fetchProducts(''); }}
                            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-all"
                        >
                            <X size={20} />
                        </button>
                    )}
                </form>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                    <p className="text-slate-500 animate-pulse">Memuat katalog produk...</p>
                </div>
            ) : products.length > 0 ? (
                viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {products.map((product) => (
                            <div key={product.id} className="group bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                                <div className="aspect-square relative flex items-center justify-center bg-slate-50 overflow-hidden">
                                    {product.image ? (
                                        <img
                                            src={product.image.startsWith('http') ? product.image : `${import.meta.env.VITE_API_URL}${product.image}`}
                                            alt={product.name}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                        />
                                    ) : (
                                        <Package className="text-slate-200" size={64} />
                                    )}
                                    <div className="absolute top-3 right-3">
                                        <span className="bg-white/90 backdrop-blur-sm text-blue-600 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm border border-slate-100 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                            {product.vendor.category}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-5">
                                    <h3 className="font-bold text-slate-800 line-clamp-1 group-hover:text-blue-600 transition-colors uppercase" title={product.name}>
                                        {product.name}
                                    </h3>
                                    <p className="text-blue-600 font-bold text-lg mt-1">
                                        {formatCurrency(product.price)}
                                    </p>

                                    <div className="mt-4 pt-4 border-t border-slate-50">
                                        <div className="flex items-center gap-2 text-slate-600 mb-1">
                                            <Building size={14} className="text-slate-400" />
                                            <span className="text-sm font-medium line-clamp-1">{product.vendor.name}</span>
                                        </div>
                                        <p className="text-xs text-slate-400 line-clamp-2 min-h-[32px] mt-2 italic leading-relaxed">
                                            {product.specification || 'Tidak ada spesifikasi tambahan.'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50">
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Produk</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Vendor</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Harga</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Spesifikasi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {products.map((product) => (
                                    <tr key={product.id} className="hover:bg-blue-50/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-lg bg-slate-100 flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-200">
                                                    {product.image ? (
                                                        <img
                                                            src={product.image.startsWith('http') ? product.image : `${import.meta.env.VITE_API_URL}${product.image}`}
                                                            alt={product.name}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <Package size={20} className="text-slate-300" />
                                                    )}
                                                </div>
                                                <span className="font-bold text-slate-800 uppercase group-hover:text-blue-600 transition-colors">{product.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-800">{product.vendor.name}</span>
                                                <span className="text-xs text-slate-400">{product.vendor.category}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-blue-600 font-bold whitespace-nowrap">
                                            {formatCurrency(product.price)}
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 text-sm italic line-clamp-2 max-w-xs">
                                            {product.specification || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dotted border-slate-300 text-slate-400">
                    <Package size={64} className="mb-4 opacity-20" />
                    <p className="text-lg font-medium">Tidak ada produk ditemukan</p>
                    <p className="text-sm">Coba kata kunci pencarian yang lain</p>
                    <button
                        onClick={() => { setSearch(''); fetchProducts(''); }}
                        className="mt-4 text-blue-600 hover:underline font-medium"
                    >
                        Tampilkan Semua Produk
                    </button>
                </div>
            )}
        </div>
    );
};

export default ProductCatalog;
