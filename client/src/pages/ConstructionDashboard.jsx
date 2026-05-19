import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Building2, Clock, CheckCircle, PauseCircle, XCircle, TrendingUp, MapPin, User, ChevronLeft, ChevronRight, Edit3, Trash2, Eye, DollarSign, Filter, AlertTriangle } from 'lucide-react';
import api from '../lib/axios';

const statusConfig = {
    PLANNING: { label: 'Perencanaan', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <Clock size={14} /> },
    IN_PROGRESS: { label: 'Berjalan', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <TrendingUp size={14} /> },
    ON_HOLD: { label: 'Ditunda', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: <PauseCircle size={14} /> },
    COMPLETED: { label: 'Selesai', color: 'bg-green-100 text-green-700 border-green-200', icon: <CheckCircle size={14} /> },
    CANCELLED: { label: 'Dibatalkan', color: 'bg-red-100 text-red-700 border-red-200', icon: <XCircle size={14} /> },
};

const priorityConfig = {
    LOW: { label: 'Rendah', color: 'text-slate-500' },
    MEDIUM: { label: 'Sedang', color: 'text-blue-600' },
    HIGH: { label: 'Tinggi', color: 'text-amber-600' },
    CRITICAL: { label: 'Kritis', color: 'text-red-600' },
};

const formatCurrency = (val) => {
    if (!val) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
};

const ConstructionDashboard = () => {
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('');
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
    const [showForm, setShowForm] = useState(false);
    const [editProject, setEditProject] = useState(null);
    const [contractors, setContractors] = useState([]);

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const canManage = ['SUPER_ADMIN', 'ADMIN_ASET', 'KEPALA_BIDANG'].includes(user.role);

    useEffect(() => {
        const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 500);
        return () => clearTimeout(t);
    }, [search]);

    const fetchStats = useCallback(async () => {
        try {
            const res = await api.get('/construction/stats');
            setStats(res.data);
        } catch (e) { console.error(e); }
    }, []);

    const fetchProjects = useCallback(async () => {
        try {
            setLoading(true);
            const params = { page, limit: 12, search: debouncedSearch };
            if (statusFilter) params.status = statusFilter;
            if (priorityFilter) params.priority = priorityFilter;
            const res = await api.get('/construction/projects', { params });
            setProjects(res.data.data || []);
            setMeta(res.data.meta || {});
        } catch (e) { console.error(e); setProjects([]); }
        finally { setLoading(false); }
    }, [page, debouncedSearch, statusFilter, priorityFilter]);

    const fetchContractors = useCallback(async () => {
        try {
            const res = await api.get('/contractors', { params: { limit: 'all' } });
            setContractors(res.data.data || []);
        } catch (e) { console.error(e); }
    }, []);

    useEffect(() => { fetchStats(); fetchContractors(); }, []);
    useEffect(() => { fetchProjects(); }, [fetchProjects]);

    const handleDelete = async (id) => {
        if (!confirm('Hapus proyek ini? Data tidak bisa dikembalikan.')) return;
        try {
            await api.delete(`/construction/projects/${id}`);
            fetchProjects();
            fetchStats();
        } catch (e) { alert(e.response?.data?.error || 'Gagal menghapus'); }
    };

    const handleSave = async (formData) => {
        try {
            if (editProject) {
                await api.put(`/construction/projects/${editProject.id}`, formData);
            } else {
                await api.post('/construction/projects', formData);
            }
            setShowForm(false);
            setEditProject(null);
            fetchProjects();
            fetchStats();
        } catch (e) { alert(e.response?.data?.error || 'Gagal menyimpan'); }
    };

    return (
        <div className="p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Building2 className="text-orange-600" /> Manajemen Proyek Pembangunan
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Kelola dan pantau seluruh proyek prasarana</p>
                </div>
                {canManage && (
                    <button
                        onClick={() => { setEditProject(null); setShowForm(true); }}
                        className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all text-sm"
                    >
                        <Plus size={18} /> Proyek Baru
                    </button>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-3xl font-black text-slate-800">{stats.total || 0}</div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Total Proyek</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-3xl font-black text-amber-600">{stats.inProgress || 0}</div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Sedang Berjalan</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-3xl font-black text-green-600">{stats.completed || 0}</div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Selesai</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-lg font-black text-slate-700">{formatCurrency(stats.totalBudget)}</div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Total Anggaran</div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col md:flex-row gap-3 items-center">
                <div className="relative flex-1 w-full">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Cari nama proyek, kode, lokasi..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    />
                </div>
                <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm min-w-[140px]">
                    <option value="">Semua Status</option>
                    {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setPage(1); }} className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm min-w-[140px]">
                    <option value="">Semua Prioritas</option>
                    {Object.entries(priorityConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
            </div>

            {/* Project Cards Grid */}
            {loading ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-slate-400">Memuat data...</div>
            ) : projects.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
                    <Building2 size={48} className="mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-bold text-slate-700">Belum ada proyek</h3>
                    <p className="text-sm text-slate-400 mt-1">Klik "Proyek Baru" untuk menambahkan proyek pertama.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {projects.map(p => {
                        const sc = statusConfig[p.status] || statusConfig.PLANNING;
                        const pc = priorityConfig[p.priority] || priorityConfig.MEDIUM;
                        return (
                            <div key={p.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group">
                                {/* Card Header */}
                                <div className="p-5 pb-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{p.code}</div>
                                            <h3 className="font-bold text-slate-800 mt-1 truncate">{p.name}</h3>
                                        </div>
                                        <span className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase border whitespace-nowrap ${sc.color}`}>
                                            {sc.icon} {sc.label}
                                        </span>
                                    </div>

                                    {p.location && (
                                        <div className="flex items-center gap-1 text-xs text-slate-400 mt-2">
                                            <MapPin size={12} /> {p.location}
                                        </div>
                                    )}

                                    {/* Progress Bar */}
                                    <div className="mt-4">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Progress</span>
                                            <span className="text-sm font-black text-slate-700">{p.progress || 0}%</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${p.progress >= 100 ? 'bg-green-500' : p.progress >= 50 ? 'bg-amber-500' : 'bg-orange-500'}`}
                                                style={{ width: `${Math.min(p.progress || 0, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Card Footer */}
                                <div className="px-5 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3 text-xs text-slate-400">
                                        {p.contractor && (
                                            <span className="flex items-center gap-1">
                                                <User size={12} /> {p.contractor.name}
                                            </span>
                                        )}
                                        {p.budgetAmount > 0 && (
                                            <span className="flex items-center gap-1">
                                                <DollarSign size={12} /> {formatCurrency(p.budgetAmount)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {canManage && (
                                            <button
                                                onClick={() => { setEditProject(p); setShowForm(true); }}
                                                className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors"
                                                title="Edit"
                                            >
                                                <Edit3 size={14} />
                                            </button>
                                        )}
                                        {user.role === 'SUPER_ADMIN' && (
                                            <button
                                                onClick={() => handleDelete(p.id)}
                                                className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 transition-colors"
                                                title="Hapus"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
            {!loading && meta.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-colors">
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm text-slate-500">Hal {meta.page} / {meta.totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages} className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-colors">
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}

            {/* Modal Form */}
            {showForm && (
                <ProjectFormModal
                    project={editProject}
                    contractors={contractors}
                    onSave={handleSave}
                    onClose={() => { setShowForm(false); setEditProject(null); }}
                />
            )}
        </div>
    );
};

// ==================== PROJECT FORM MODAL ====================
const ProjectFormModal = ({ project, contractors, onSave, onClose }) => {
    const [form, setForm] = useState({
        name: project?.name || '',
        description: project?.description || '',
        location: project?.location || '',
        status: project?.status || 'PLANNING',
        priority: project?.priority || 'MEDIUM',
        progress: project?.progress || 0,
        startDate: project?.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '',
        endDate: project?.endDate ? new Date(project.endDate).toISOString().split('T')[0] : '',
        budgetAmount: project?.budgetAmount || '',
        actualCost: project?.actualCost || '',
        fundingSource: project?.fundingSource || '',
        picName: project?.picName || '',
        contractorId: project?.contractorId || '',
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return alert('Nama proyek wajib diisi');
        setSaving(true);
        try {
            await onSave(form);
        } finally { setSaving(false); }
    };

    const inputClass = "w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none";
    const labelClass = "block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5";

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 rounded-t-2xl z-10">
                    <h2 className="text-lg font-bold text-slate-800">{project ? 'Edit Proyek' : 'Proyek Baru'}</h2>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className={labelClass}>Nama Proyek *</label>
                            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputClass} placeholder="Pembangunan Gedung Baru..." />
                        </div>
                        <div className="md:col-span-2">
                            <label className={labelClass}>Deskripsi</label>
                            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={`${inputClass} min-h-[80px]`} placeholder="Detail proyek..." />
                        </div>
                        <div>
                            <label className={labelClass}>Lokasi</label>
                            <input type="text" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className={inputClass} placeholder="Islamic Center, Lt. 2..." />
                        </div>
                        <div>
                            <label className={labelClass}>PIC / Penanggung Jawab</label>
                            <input type="text" value={form.picName} onChange={e => setForm(f => ({ ...f, picName: e.target.value }))} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Status</label>
                            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputClass}>
                                {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Prioritas</label>
                            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className={inputClass}>
                                {Object.entries(priorityConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Progress (%)</label>
                            <input type="number" min="0" max="100" value={form.progress} onChange={e => setForm(f => ({ ...f, progress: parseFloat(e.target.value) || 0 }))} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Kontraktor / Tukang</label>
                            <select value={form.contractorId} onChange={e => setForm(f => ({ ...f, contractorId: e.target.value }))} className={inputClass}>
                                <option value="">— Tidak ada —</option>
                                {contractors.map(c => <option key={c.id} value={c.id}>{c.name} {c.specialty ? `(${c.specialty})` : ''}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Tanggal Mulai</label>
                            <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Tanggal Selesai (Target)</label>
                            <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Anggaran (Rp)</label>
                            <input type="number" value={form.budgetAmount} onChange={e => setForm(f => ({ ...f, budgetAmount: e.target.value }))} className={inputClass} placeholder="0" />
                        </div>
                        <div>
                            <label className={labelClass}>Biaya Realisasi (Rp)</label>
                            <input type="number" value={form.actualCost} onChange={e => setForm(f => ({ ...f, actualCost: e.target.value }))} className={inputClass} placeholder="0" />
                        </div>
                        <div className="md:col-span-2">
                            <label className={labelClass}>Sumber Dana</label>
                            <input type="text" value={form.fundingSource} onChange={e => setForm(f => ({ ...f, fundingSource: e.target.value }))} className={inputClass} placeholder="Mandiri, APBN, dll..." />
                        </div>
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

export default ConstructionDashboard;
