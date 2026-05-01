import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Search, Filter, Trash2, Edit, ChevronRight, Monitor, ShoppingBag, Briefcase, Zap } from 'lucide-react';
import api from '../lib/axios';
import { getMediaUrl } from '../lib/media';

const AssetStandardCatalog = () => {
    const [standards, setStandards] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const navigate = useNavigate();

    const user = JSON.parse(localStorage.getItem('user')) || {};
    const canEdit = ['SUPER_ADMIN', 'BIDANG_IT', 'ADMIN_ASET', 'ADMIN_UNIT'].includes(user.role);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [stdRes, catsRes] = await Promise.all([
                api.get('/asset-standards', { params: { categoryId: categoryFilter, search } }),
                api.get('/master/categories')
            ]);
            setStandards(stdRes.data);
            setCategories(catsRes.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const delaySearch = setTimeout(() => {
            fetchData();
        }, 300);
        return () => clearTimeout(delaySearch);
    }, [categoryFilter, search]);

    const handleDelete = async (id) => {
        if (!confirm('Hapus standar ini dari katalog?')) return;
        try {
            await api.delete(`/asset-standards/${id}`);
            fetchData();
        } catch (e) {
            alert('Gagal menghapus standar');
        }
    };

    const getIcon = (catName) => {
        const n = catName?.toLowerCase() || '';
        if (n.includes('elektronik') || n.includes('it')) return <Monitor size={20} className="text-blue-500" />;
        if (n.includes('furnitur') || n.includes('meubel')) return <Briefcase size={20} className="text-amber-500" />;
        if (n.includes('kendaraan')) return <Zap size={20} className="text-emerald-500" />;
        return <ShoppingBag size={20} className="text-indigo-500" />;
    };

    return (
        <div className="p-4 md:p-8 min-h-screen bg-slate-50 space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
                            <FileText className="text-white" size={24} />
                        </div>
                        Katalog Standar Aset
                    </h1>
                    <p className="text-slate-500 font-medium">Panduan spesifikasi teknis dan standar kualitas aset Sarpras</p>
                </div>
                {canEdit && (
                    <button
                        onClick={() => navigate('/aset/katalog-standar/new')}
                        className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-2xl font-bold shadow-xl hover:shadow-indigo-200 hover:-translate-y-0.5 transition-all active:scale-95 text-sm"
                    >
                        <Plus size={20} /> Tambah Standar Baru
                    </button>
                )}
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white/70 backdrop-blur-md rounded-3xl border border-slate-200 p-5 flex flex-col md:flex-row gap-4 shadow-sm">
                <div className="relative flex-1 group">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Cari nama barang atau spesifikasi..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all placeholder:text-slate-400"
                    />
                </div>
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-slate-100 rounded-xl text-slate-500">
                        <Filter size={18} />
                    </div>
                    <select
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value)}
                        className="py-3.5 px-4 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all min-w-[200px] font-medium"
                    >
                        <option value="">Semua Kategori</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Content Grid */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-24 space-y-4">
                    <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-medium animate-pulse">Menyelaraskan data standar...</p>
                </div>
            ) : standards.length === 0 ? (
                <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-20 text-center space-y-4">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                        <FileText size={40} />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-xl font-bold text-slate-800">Katalog Kosong</h3>
                        <p className="text-slate-500">Belum ada standar yang ditambahkan untuk kriteria ini.</p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {standards.map(std => (
                        <div key={std.id} className="group bg-white rounded-[32px] border border-slate-200 overflow-hidden hover:shadow-2xl hover:shadow-indigo-100 transition-all duration-500 hover:-translate-y-1">
                            <div className="relative h-56 bg-slate-100 overflow-hidden">
                                {std.image ? (
                                    <img src={getMediaUrl(std.image)} alt={std.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 space-y-2">
                                        <div className="p-4 bg-white rounded-full shadow-sm">
                                            {getIcon(std.category?.name)}
                                        </div>
                                        <span className="text-xs font-bold uppercase tracking-widest">No Preview Available</span>
                                    </div>
                                )}
                                <div className="absolute top-4 left-4">
                                    <span className="px-4 py-1.5 bg-white/90 backdrop-blur-md text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-full shadow-sm border border-white/20">
                                        {std.category?.name}
                                    </span>
                                </div>
                            </div>

                            <div className="p-7 space-y-5">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">{std.name}</h3>
                                    {std.estimatedPrice && (
                                        <p className="text-emerald-600 font-extrabold text-sm mt-1">
                                            Est. {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(std.estimatedPrice)}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Spesifikasi Standar</div>
                                        <p className="text-xs text-slate-600 leading-relaxed font-medium line-clamp-3 whitespace-pre-wrap italic">
                                            "{std.specification || 'Spesifikasi belum dirinci...'}"
                                        </p>
                                    </div>
                                    
                                    {std.minSpec && (
                                        <div className="border-l-4 border-indigo-500 pl-4 py-1">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Syarat Minimum</div>
                                            <p className="text-xs text-slate-800 font-bold line-clamp-1">{std.minSpec}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                    <div className="flex gap-2">
                                        {canEdit && (
                                            <>
                                                <button 
                                                    onClick={() => navigate(`/aset/katalog-standar/edit/${std.id}`)}
                                                    className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                                    title="Edit Standar"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(std.id)}
                                                    className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                                    title="Hapus"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                    <button className="flex items-center gap-1.5 text-slate-400 hover:text-indigo-600 font-bold text-xs transition-colors group/btn">
                                        Lihat Detail <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AssetStandardCatalog;
