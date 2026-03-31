import { useState, useEffect } from 'react';
import { FileCheck, Plus, Clock, CheckCircle2, AlertCircle, Calendar, User, Search, MapPin, Tag, ArrowRight, MoreVertical, Flag, Loader2 } from 'lucide-react';
import api from '../lib/axios';

const PersonnelAssignments = () => {
    const [assignments, setAssignments] = useState([]);
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [limit, setLimit] = useState(25);
    const [filterStatus, setFilterStatus] = useState('ALL');

    const user = JSON.parse(localStorage.getItem('user')) || {};
    const canAssign = ['KEPALA_BIDANG', 'ADMIN_UNIT', 'SUPER_ADMIN', 'BIDANG_IT', 'ADMIN_ASET'].includes(user.role);

    const [form, setForm] = useState({
        assigneeId: '',
        title: '',
        description: '',
        category: 'UMUM',
        priority: 'MEDIUM', // NEW: Priority field
        location: '',
        startDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        addToCalendar: true
    });

    const statusConfig = {
        PENDING: { color: 'bg-amber-50 text-amber-600 border-amber-100', icon: <Clock size={14} />, label: 'MENUNGGU' },
        IN_PROGRESS: { color: 'bg-indigo-50 text-indigo-600 border-indigo-100', icon: <Loader2 size={14} className="animate-spin" />, label: 'PROSES' },
        IN_REVIEW: { color: 'bg-purple-50 text-purple-600 border-purple-100', icon: <Search size={14} />, label: 'REVIU' },
        COMPLETED: { color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: <CheckCircle2 size={14} />, label: 'SELESAI' },
        CANCELLED: { color: 'bg-slate-50 text-slate-500 border-slate-100', icon: <X size={14} />, label: 'BATAL' }
    };

    const priorityConfig = {
        LOW: { color: 'text-slate-400', label: 'Rendah' },
        MEDIUM: { color: 'text-blue-500', label: 'Normal' },
        HIGH: { color: 'text-orange-500', label: 'Tinggi' },
        URGENT: { color: 'text-red-600', label: 'Mendesak' }
    };

    const fetchAssignments = async () => {
        try {
            setLoading(true);
            const res = await api.get('/personnel/assignments', { params: { limit } });
            setAssignments(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchStaff = async () => {
        try {
            const res = await api.get('/personnel/staff');
            setStaff(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchAssignments();
    }, [limit]);

    useEffect(() => {
        fetchStaff();
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.assigneeId || !form.title) return alert('Penerima tugas dan Judul wajib diisi');

        try {
            setSubmitting(true);
            await api.post('/personnel/assignments', form);
            setShowForm(false);
            setForm({ assigneeId: '', title: '', description: '', category: 'UMUM', priority: 'MEDIUM', location: '', startDate: new Date().toISOString().split('T')[0], dueDate: '', addToCalendar: true });
            fetchAssignments();
            alert(`Tugas berhasil didelegasikan`);
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal memberikan tugas');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateStatus = async (id, newStatus, additionalData = {}) => {
        try {
            await api.put(`/personnel/assignments/${id}/status`, { status: newStatus, ...additionalData });
            fetchAssignments();
        } catch (err) {
            alert('Gagal memperbarui status tugas');
        }
    };

    const filteredAssignments = assignments.filter(a => filterStatus === 'ALL' || a.status === filterStatus);

    return (
        <div className="max-w-6xl mx-auto space-y-8 p-4 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="relative z-10">
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-600/20">
                            <FileCheck size={28} />
                        </div>
                        Manajemen Penugasan
                    </h1>
                    <p className="text-slate-500 text-sm mt-2 font-medium">Delegasi tugas operasional dan pemantauan real-time progres staf Sarpras.</p>
                </div>
                {canAssign && (
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className={`relative z-10 flex items-center gap-2 px-8 py-4 rounded-2xl font-bold shadow-xl transition-all active:scale-95 ${showForm ? 'bg-slate-100 text-slate-600' : 'bg-slate-900 text-white shadow-slate-900/20 hover:bg-slate-800'}`}
                    >
                        {showForm ? <><X size={20} /> Batal</> : <><Plus size={20} /> Delegasi Tugas</>}
                    </button>
                )}
                {/* Decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full -mr-32 -mt-32 opacity-50"></div>
            </div>

            {/* Filter Hub */}
            {!showForm && (
                <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50/50 p-4 rounded-3xl border border-slate-200/50">
                    <div className="flex gap-2 p-1 bg-white rounded-2xl border border-slate-200">
                        {['ALL', 'PENDING', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED'].map((s) => (
                            <button
                                key={s}
                                onClick={() => setFilterStatus(s)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${filterStatus === s ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                            >
                                {s === 'ALL' ? 'SEMUA' : s.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-400">Limit:</span>
                        <select value={limit} onChange={e => setLimit(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500">
                            <option value="10">10 Data</option>
                            <option value="25">25 Data</option>
                            <option value="50">50 Data</option>
                            <option value="all">Semua</option>
                        </select>
                    </div>
                </div>
            )}

            {/* Form Section */}
            {showForm && (
                <div className="bg-white rounded-[40px] border border-indigo-100 p-10 shadow-2xl shadow-indigo-100/50 animate-in slide-in-from-top-10 duration-500">
                    <h3 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-3">
                        <Plus className="text-indigo-600" /> Form Delegasi Tugas Baru
                    </h3>
                    <form onSubmit={handleCreate} className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Penerima Tugas (Staff PIC)</label>
                                <select value={form.assigneeId} onChange={e => setForm({ ...form, assigneeId: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all">
                                    <option value="">-- Pilih Staf --</option>
                                    {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.position})</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Prioritas Kerja</label>
                                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all">
                                    <option value="LOW">Rendah</option>
                                    <option value="MEDIUM">Normal / Rutin</option>
                                    <option value="HIGH">Tinggi</option>
                                    <option value="URGENT">Mendesak (Urgensi Tinggi)</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Judul Penugasan</label>
                                <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Misal: Perbaikan AC Ruang Kantor" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Kategori</label>
                                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all">
                                    <option value="UMUM">Umum</option>
                                    <option value="Perbaikan">🛠️ Perbaikan</option>
                                    <option value="Pemeliharaan">🧹 Pemeliharaan</option>
                                    <option value="Pengadaan">📦 Pengadaan</option>
                                    <option value="Rapat">🤝 Rapat / Dinas</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Lokasi Kerja</label>
                                <input type="text" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Gedung, Lantai, atau Ruang" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tanggal Mulai</label>
                                <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Deadline Selesai</label>
                                <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Instruksi Lengkap (Deskripsi)</label>
                            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} placeholder="Jelaskan detail apa yang harus dikerjakan..." className="w-full p-5 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                        </div>

                        <div className="flex items-center justify-between bg-indigo-50 p-6 rounded-3xl">
                            <div className="flex items-center gap-3">
                                <input type="checkbox" id="syncCalendar" checked={form.addToCalendar} onChange={e => setForm({ ...form, addToCalendar: e.target.checked })} className="w-5 h-5 rounded-lg border-indigo-200 text-indigo-600 focus:ring-indigo-500" />
                                <label htmlFor="syncCalendar" className="text-sm font-bold text-indigo-900 cursor-pointer">Singkronkan ke Kalender Kerja Sarpras</label>
                            </div>
                            <button disabled={submitting} type="submit" className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-indigo-600/30 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50">
                                {submitting ? 'Memproses...' : 'Kirim Penugasan Resmi'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Assignments Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-10">
                {loading ? (
                    <div className="md:col-span-2 py-20 flex flex-col items-center gap-4">
                        <Loader2 className="animate-spin text-indigo-600" size={48} />
                        <p className="text-slate-400 font-black animate-pulse uppercase tracking-[0.2em] text-[10px]">Sinkronisasi Tugas...</p>
                    </div>
                ) : filteredAssignments.length === 0 ? (
                    <div className="md:col-span-2 py-20 bg-white rounded-[40px] border-2 border-dashed border-slate-100 flex flex-col items-center text-center">
                        <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-3xl flex items-center justify-center mb-6">
                            <FileCheck size={40} />
                        </div>
                        <h4 className="text-xl font-bold text-slate-800">Tidak Ada Tugas Ditemukan</h4>
                        <p className="text-slate-400 text-sm max-w-xs mt-2">Daftar penugasan kosong untuk kategori filter ini.</p>
                    </div>
                ) : (
                    filteredAssignments.map(a => (
                        <AssignmentCard key={a.id} a={a} statusConfig={statusConfig} priorityConfig={priorityConfig} handleUpdateStatus={handleUpdateStatus} canAssign={canAssign} userId={user.id} />
                    ))
                )}
            </div>
        </div>
    );
};

const AssignmentCard = ({ a, statusConfig, priorityConfig, handleUpdateStatus, canAssign, userId }) => {
    const isAssignee = a.assigneeId === userId;
    const [updating, setUpdating] = useState(false);
    const [showActions, setShowActions] = useState(false);

    const updateStatusWithLoading = async (newStatus) => {
        setUpdating(true);
        await handleUpdateStatus(a.id, newStatus);
        setUpdating(false);
        setShowActions(false);
    };

    return (
        <div className="group bg-white rounded-[32px] border border-slate-100 p-8 shadow-sm hover:shadow-2xl hover:border-indigo-100 transition-all duration-500 relative overflow-hidden flex flex-col justify-between">
            {/* Top Bar */}
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                    <div className={`px-4 py-1.5 rounded-full border text-[9px] font-black tracking-widest flex items-center gap-2 ${statusConfig[a.status].color}`}>
                        {statusConfig[a.status].icon}
                        {statusConfig[a.status].label}
                    </div>
                    {canAssign && (
                        <button onClick={() => setShowActions(!showActions)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all">
                            <MoreVertical size={20} />
                        </button>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-start gap-4">
                        <h3 className="text-xl font-black text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors">{a.title}</h3>
                        <div className="flex flex-col items-end shrink-0">
                            <div className="flex items-center gap-1.5">
                                <Flag size={14} className={priorityConfig[a.priority || 'MEDIUM'].color} />
                                <span className={`text-[10px] font-black uppercase tracking-tighter ${priorityConfig[a.priority || 'MEDIUM'].color}`}>
                                    {priorityConfig[a.priority || 'MEDIUM'].label}
                                </span>
                            </div>
                        </div>
                    </div>

                    <p className="text-sm text-slate-500 font-medium leading-relaxed line-clamp-3">{a.description}</p>

                    <div className="grid grid-cols-2 gap-4 py-6 border-y border-slate-50 border-dashed">
                        <div className="space-y-1">
                            <p className="text-[9px] font-black text-slate-400 tracking-widest uppercase">Target Selesai</p>
                            <p className="text-xs font-black text-slate-700 flex items-center gap-2">
                                <Calendar size={14} className="text-red-400" />
                                {a.dueDate ? new Date(a.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[9px] font-black text-slate-400 tracking-widest uppercase">Staff Pengerjaan</p>
                            <p className="text-xs font-black text-slate-700 flex items-center gap-2">
                                <User size={14} className="text-indigo-400" />
                                {a.assignee?.name || 'Unknown'}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-4 pt-2">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                            <MapPin size={12} className="text-slate-300" /> {a.location || 'Lokasi Terpusat'}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                            <Tag size={12} className="text-slate-300" /> {a.category}
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 pt-6 border-t border-slate-50 relative z-10">
                <div className="flex items-center gap-3">
                    {a.status === 'PENDING' && (isAssignee || canAssign) && (
                        <button
                            disabled={updating}
                            onClick={() => updateStatusWithLoading('IN_PROGRESS')}
                            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs hover:bg-indigo-700 transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2"
                        >
                            {updating ? <Loader2 className="animate-spin" size={16} /> : <ArrowRight size={16} />}
                            MULAI KERJAKAN
                        </button>
                    )}
                    {a.status === 'IN_PROGRESS' && isAssignee && (
                        <button
                            disabled={updating}
                            onClick={() => updateStatusWithLoading('IN_REVIEW')}
                            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2"
                        >
                            {updating ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                            AJUKAN REVIU / SELESAI
                        </button>
                    )}
                    {a.status === 'IN_REVIEW' && canAssign && (
                        <div className="flex w-full gap-3">
                            <button
                                disabled={updating}
                                onClick={() => updateStatusWithLoading('IN_PROGRESS')}
                                className="flex-1 py-4 bg-red-50 text-red-600 rounded-2xl font-black text-[10px] hover:bg-red-100 transition-all border border-red-100"
                            >
                                PERLU PERBAIKAN
                            </button>
                            <button
                                disabled={updating}
                                onClick={() => updateStatusWithLoading('COMPLETED')}
                                className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20"
                            >
                                KONFIRMASI SELESAI
                            </button>
                        </div>
                    )}
                    {a.status === 'COMPLETED' && (
                        <div className="w-full py-4 bg-emerald-50 text-emerald-600 rounded-2xl font-black text-[10px] flex items-center justify-center gap-2 border border-emerald-100 italic transition-all group-hover:scale-[1.02]">
                            <CheckCircle2 size={16} /> TUGAS TELAH TERSELESAIKAN SECARA RESMI
                        </div>
                    )}
                    {a.status === 'IN_REVIEW' && isAssignee && !canAssign && (
                        <div className="w-full py-4 bg-purple-50 text-purple-600 rounded-2xl font-black text-[10px] flex items-center justify-center gap-2 border border-purple-100 italic">
                            <Loader2 size={16} className="animate-spin" /> SEDANG DIREVIU OLEH ADMIN
                        </div>
                    )}
                </div>
            </div>

            {/* Admin context menu */}
            {showActions && (
                <div className="absolute top-20 right-8 w-48 bg-white border border-slate-100 shadow-2xl rounded-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                    <button onClick={() => updateStatusWithLoading('CANCELLED')} className="w-full px-4 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50">Batalkan Tugas</button>
                    <button onClick={() => updateStatusWithLoading('PENDING')} className="w-full px-4 py-2 text-left text-xs font-bold text-slate-600 hover:bg-slate-50">Reset ke Pending</button>
                </div>
            )}

            {/* Subtle background decoration */}
            <FileCheck className="absolute right-[-40px] top-[-40px] w-64 h-64 text-slate-50 group-hover:text-indigo-50/50 transition-colors duration-700 -rotate-12 pointer-events-none" />
        </div>
    );
};

const X = ({ size }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>;

export default PersonnelAssignments;
