import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, HardHat, Phone, MapPin, Star, Wrench, Edit3, Trash2, ChevronLeft, ChevronRight, X, Building2 } from 'lucide-react';
import api from '../lib/axios';

const specialtyOptions = ['Bangunan', 'Listrik', 'Plumbing', 'Cat', 'Las', 'Kayu', 'Keramik', 'Atap', 'Taman', 'AC & Pendingin', 'Lainnya'];

const ContractorList = () => {
    const [contractors, setContractors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [specialtyFilter, setSpecialtyFilter] = useState('');
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
    const [showForm, setShowForm] = useState(false);
    const [editContractor, setEditContractor] = useState(null);
    const [viewContractor, setViewContractor] = useState(null);

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const canManage = ['SUPER_ADMIN', 'ADMIN_ASET', 'KEPALA_BIDANG'].includes(user.role);

    useEffect(() => {
        const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 500);
        return () => clearTimeout(t);
    }, [search]);

    const fetchContractors = useCallback(async () => {
        try {
            setLoading(true);
            const params = { page, limit: 12, search: debouncedSearch };
            if (specialtyFilter) params.specialty = specialtyFilter;
            const res = await api.get('/contractors', { params });
            setContractors(res.data.data || []);
            setMeta(res.data.meta || {});
        } catch (e) { console.error(e); setContractors([]); }
        finally { setLoading(false); }
    }, [page, debouncedSearch, specialtyFilter]);

    useEffect(() => { fetchContractors(); }, [fetchContractors]);

    const handleDelete = async (id) => {
        if (!confirm('Hapus data tukang ini?')) return;
        try {
            await api.delete(`/contractors/${id}`);
            fetchContractors();
        } catch (e) { alert(e.response?.data?.error || 'Gagal menghapus'); }
    };

    const handleSave = async (formData) => {
        try {
            if (editContractor) {
                await api.put(`/contractors/${editContractor.id}`, formData);
            } else {
                await api.post('/contractors', formData);
            }
            setShowForm(false);
            setEditContractor(null);
            fetchContractors();
        } catch (e) { alert(e.response?.data?.error || 'Gagal menyimpan'); }
    };

    const renderStars = (rating) => {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            stars.push(
                <Star
                    key={i}
                    size={12}
                    className={i <= Math.round(rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}
                />
            );
        }
        return <div className="flex items-center gap-0.5">{stars}</div>;
    };

    const statusProjectConfig = {
        PLANNING: 'bg-blue-100 text-blue-700',
        IN_PROGRESS: 'bg-amber-100 text-amber-700',
        COMPLETED: 'bg-green-100 text-green-700',
        ON_HOLD: 'bg-orange-100 text-orange-700',
        CANCELLED: 'bg-red-100 text-red-700',
    };

    return (
        <div className="p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <HardHat className="text-orange-600" /> Database Tukang / Kontraktor
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Kelola data pekerja dan kontraktor pembangunan</p>
                </div>
                {canManage && (
                    <button
                        onClick={() => { setEditContractor(null); setShowForm(true); }}
                        className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all text-sm"
                    >
                        <Plus size={18} /> Tambah Tukang
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col md:flex-row gap-3 items-center">
                <div className="relative flex-1 w-full">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Cari nama, telepon, keahlian..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    />
                </div>
                <select value={specialtyFilter} onChange={e => { setSpecialtyFilter(e.target.value); setPage(1); }} className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm min-w-[160px]">
                    <option value="">Semua Keahlian</option>
                    {specialtyOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>

            {/* Contractor Cards */}
            {loading ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-slate-400">Memuat data...</div>
            ) : contractors.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
                    <HardHat size={48} className="mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-bold text-slate-700">Belum ada data tukang</h3>
                    <p className="text-sm text-slate-400 mt-1">Klik "Tambah Tukang" untuk menambahkan data pertama.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {contractors.map(c => (
                        <div key={c.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group">
                            <div className="p-5">
                                <div className="flex items-start gap-4">
                                    {/* Avatar */}
                                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white font-black text-lg flex-shrink-0 shadow-md">
                                        {c.name?.charAt(0)?.toUpperCase() || '?'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-slate-800 truncate">{c.name}</h3>
                                        {c.specialty && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 rounded-md text-[10px] font-bold uppercase mt-1 border border-orange-100">
                                                <Wrench size={10} /> {c.specialty}
                                            </span>
                                        )}
                                        <div className="mt-2">{renderStars(c.rating)}</div>
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="mt-4 space-y-1.5">
                                    {c.phone && (
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <Phone size={12} className="text-slate-400" /> {c.phone}
                                        </div>
                                    )}
                                    {c.address && (
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <MapPin size={12} className="text-slate-400" /> <span className="truncate">{c.address}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Project count badge */}
                                <div className="flex items-center gap-2 mt-3">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        {c.totalProjects || 0} Proyek
                                    </span>
                                    {!c.isActive && (
                                        <span className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded text-[9px] font-bold uppercase">Non-Aktif</span>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="px-5 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                                <button
                                    onClick={() => setViewContractor(c)}
                                    className="text-xs text-blue-600 font-semibold hover:text-blue-800 transition-colors"
                                >
                                    Lihat Detail →
                                </button>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {canManage && (
                                        <button onClick={() => { setEditContractor(c); setShowForm(true); }} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors" title="Edit">
                                            <Edit3 size={14} />
                                        </button>
                                    )}
                                    {user.role === 'SUPER_ADMIN' && (
                                        <button onClick={() => handleDelete(c.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 transition-colors" title="Hapus">
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {!loading && meta.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-colors"><ChevronLeft size={16} /></button>
                    <span className="text-sm text-slate-500">Hal {meta.page} / {meta.totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages} className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-colors"><ChevronRight size={16} /></button>
                </div>
            )}

            {/* View Detail Modal */}
            {viewContractor && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewContractor(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 rounded-t-2xl flex items-center justify-between">
                            <h2 className="text-lg font-bold text-slate-800">Detail Tukang</h2>
                            <button onClick={() => setViewContractor(null)} className="p-1 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white font-black text-2xl shadow-lg">
                                    {viewContractor.name?.charAt(0)?.toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">{viewContractor.name}</h3>
                                    {viewContractor.specialty && <span className="text-sm text-orange-600 font-semibold">{viewContractor.specialty}</span>}
                                    <div className="mt-1">{renderStars(viewContractor.rating)}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div><span className="text-slate-400 text-xs font-bold uppercase block mb-1">Telepon</span>{viewContractor.phone || '-'}</div>
                                <div><span className="text-slate-400 text-xs font-bold uppercase block mb-1">Total Proyek</span>{viewContractor.totalProjects || 0}</div>
                                <div className="col-span-2"><span className="text-slate-400 text-xs font-bold uppercase block mb-1">Alamat</span>{viewContractor.address || '-'}</div>
                                {viewContractor.notes && <div className="col-span-2"><span className="text-slate-400 text-xs font-bold uppercase block mb-1">Catatan</span>{viewContractor.notes}</div>}
                            </div>

                            {/* Project History */}
                            {viewContractor.projects && viewContractor.projects.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Riwayat Proyek</h4>
                                    <div className="space-y-2">
                                        {viewContractor.projects.map(p => (
                                            <div key={p.id} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-700">{p.name}</div>
                                                    <div className="text-[10px] text-slate-400">{p.code}</div>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${statusProjectConfig[p.status] || 'bg-slate-100 text-slate-600'}`}>
                                                    {p.status?.replace('_', ' ')}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Form Modal */}
            {showForm && (
                <ContractorFormModal
                    contractor={editContractor}
                    onSave={handleSave}
                    onClose={() => { setShowForm(false); setEditContractor(null); }}
                />
            )}
        </div>
    );
};

// ==================== FORM MODAL ====================
const ContractorFormModal = ({ contractor, onSave, onClose }) => {
    const [form, setForm] = useState({
        name: contractor?.name || '',
        phone: contractor?.phone || '',
        address: contractor?.address || '',
        specialty: contractor?.specialty ? contractor.specialty.split(',').map(s => s.trim()) : [],
        rating: contractor?.rating || 0,
        notes: contractor?.notes || '',
        isActive: contractor?.isActive !== false,
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return alert('Nama wajib diisi');
        setSaving(true);
        try { 
            const submitData = { ...form, specialty: form.specialty.join(', ') };
            await onSave(submitData); 
        } finally { setSaving(false); }
    };

    const inputClass = "w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none";
    const labelClass = "block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5";

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 rounded-t-2xl">
                    <h2 className="text-lg font-bold text-slate-800">{contractor ? 'Edit Tukang' : 'Tambah Tukang Baru'}</h2>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className={labelClass}>Nama *</label>
                        <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputClass} placeholder="Nama lengkap..." />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>No. Telepon</label>
                            <input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputClass} placeholder="08xx..." />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Keahlian (Bisa pilih lebih dari satu)</label>
                        <div className="flex flex-wrap gap-2 mt-1">
                            {specialtyOptions.map(s => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => {
                                        setForm(f => {
                                            const current = f.specialty;
                                            return {
                                                ...f,
                                                specialty: current.includes(s) 
                                                    ? current.filter(item => item !== s)
                                                    : [...current, s]
                                            };
                                        });
                                    }}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                                        form.specialty.includes(s)
                                            ? 'bg-orange-100 border-orange-300 text-orange-700 shadow-sm'
                                            : 'bg-white border-slate-200 text-slate-500 hover:border-orange-300 hover:text-orange-600'
                                    }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Alamat</label>
                        <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className={`${inputClass} min-h-[60px]`} placeholder="Alamat lengkap..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Rating (0-5)</label>
                            <input type="number" min="0" max="5" step="0.5" value={form.rating} onChange={e => setForm(f => ({ ...f, rating: parseFloat(e.target.value) || 0 }))} className={inputClass} />
                        </div>
                        <div className="flex items-end">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
                                <span className="text-sm font-semibold text-slate-600">Aktif</span>
                            </label>
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Catatan</label>
                        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={`${inputClass} min-h-[60px]`} placeholder="Catatan tambahan..." />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-semibold text-slate-500 hover:bg-slate-100 transition-colors">Batal</button>
                        <button type="submit" disabled={saving} className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg text-sm font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50">
                            {saving ? 'Menyimpan...' : 'Simpan'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ContractorList;
