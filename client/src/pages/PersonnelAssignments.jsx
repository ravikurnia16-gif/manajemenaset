import { useState, useEffect } from 'react';
import { FileCheck, Plus, Clock, CheckCircle2, AlertCircle, Calendar, User, Search, MapPin, Tag, ArrowRight, MoreVertical, Flag, Loader2, X, ChevronDown, ChevronUp, CheckSquare, Square } from 'lucide-react';
import api from '../lib/axios';

const PersonnelAssignments = () => {
    const [assignments, setAssignments] = useState([]);
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [updating, setUpdating] = useState(null); // id of assignment being updated
    const [limit, setLimit] = useState(25);
    const [filterStatus, setFilterStatus] = useState('ALL');

    const user = JSON.parse(localStorage.getItem('user')) || {};
    const canAssign = ['KEPALA_BIDANG', 'ADMIN_UNIT', 'SUPER_ADMIN', 'BIDANG_IT', 'ADMIN_ASET'].includes(user.role);

    const [form, setForm] = useState({
        assigneeId: '',
        title: '',
        description: '',
        category: 'UMUM',
        priority: 'MEDIUM',
        location: '',
        startDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        addToCalendar: true,
        items: [{ text: '', status: 'PENDING' }]
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

    const addItem = () => {
        setForm({ ...form, items: [...form.items, { text: '', status: 'PENDING' }] });
    };

    const removeItem = (idx) => {
        setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
    };

    const handleItemChange = (idx, value) => {
        const newItems = [...form.items];
        newItems[idx].text = value;
        setForm({ ...form, items: newItems });
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        const validItems = form.items.filter(it => it.text.trim());
        if (!form.assigneeId || !form.title) return alert('Penerima tugas dan Judul wajib diisi');

        try {
            setSubmitting(true);
            await api.post('/personnel/assignments', { ...form, items: validItems });
            setShowForm(false);
            setForm({ assigneeId: '', title: '', description: '', category: 'UMUM', priority: 'MEDIUM', location: '', startDate: new Date().toISOString().split('T')[0], dueDate: '', addToCalendar: true, items: [{ text: '', status: 'PENDING' }] });
            fetchAssignments();
            alert(`Tugas berhasil didelegasikan`);
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal memberikan tugas');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateAssignment = async (id, payload) => {
        try {
            setUpdating(id);
            await api.put(`/personnel/assignments/${id}/status`, payload);
            fetchAssignments();
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal memperbarui tugas');
        } finally {
            setUpdating(null);
        }
    };

    const filteredAssignments = assignments.filter(a => filterStatus === 'ALL' || a.status === filterStatus);

    return (
        <div className="max-w-7xl mx-auto space-y-6 p-4 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 md:p-8 rounded-[24px] border border-slate-100 shadow-sm relative overflow-hidden backdrop-blur-xl bg-white/80">
                <div className="relative z-10">
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-600/20">
                            <FileCheck size={24} />
                        </div>
                        Manajemen Penugasan
                    </h1>
                    <p className="text-slate-500 text-xs md:text-sm mt-2 font-medium">Monitoring tugas staf dengan sistem checklist satu pintu.</p>
                </div>
                {canAssign && (
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className={`relative z-10 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold shadow-xl transition-all active:scale-95 text-sm ${showForm ? 'bg-slate-100 text-slate-600' : 'bg-slate-900 text-white shadow-slate-900/20 hover:bg-slate-800'}`}
                    >
                        {showForm ? <><X size={18} /> Tutup Form</> : <><Plus size={18} /> Delegasi Tugas</>}
                    </button>
                )}
            </div>

            {/* Form Section (Checklist items) */}
            {showForm && (
                <div className="bg-white rounded-[32px] border border-indigo-100 p-6 md:p-10 shadow-2xl shadow-indigo-100/50 animate-in slide-in-from-top-10 duration-500">
                    <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3 border-b border-slate-50 pb-4">
                        <Plus size={20} className="text-indigo-600" /> Buat Penugasan Checklist
                    </h3>
                    <form onSubmit={handleCreate} className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Pilih Staf Pelaksana</label>
                                <select value={form.assigneeId} onChange={e => setForm({ ...form, assigneeId: e.target.value })} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all">
                                    <option value="">-- Pilih Staf --</option>
                                    {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.position})</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Prioritas</label>
                                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all">
                                    <option value="LOW">Rendah</option>
                                    <option value="MEDIUM">Normal</option>
                                    <option value="HIGH">Tinggi</option>
                                    <option value="URGENT">Sangat Mendesak</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Judul Penugasan Utarna</label>
                            <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Misal: Pemeliharaan Fasilitas Gedung A" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                        </div>

                        {/* Checklist Input Grid */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rincian Item Tugas (Checklist)</label>
                                <button type="button" onClick={addItem} className="text-indigo-600 hover:text-indigo-800 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                                    <Plus size={14} /> Tambah Item
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {form.items.map((item, idx) => (
                                    <div key={idx} className="flex gap-2 group">
                                        <div className="flex-1 relative">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-black text-[10px]">{idx + 1}</div>
                                            <input 
                                                value={item.text} 
                                                onChange={e => handleItemChange(idx, e.target.value)}
                                                placeholder="Sebutkan pekerjaan spesifik..." 
                                                className="w-full pl-10 pr-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none group-hover:bg-white transition-all" 
                                            />
                                        </div>
                                        {form.items.length > 1 && (
                                            <button type="button" onClick={() => removeItem(idx)} className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                                                <X size={18} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="col-span-1 space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tgl Mulai</label>
                                <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
                            </div>
                            <div className="col-span-1 space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Deadline</label>
                                <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
                            </div>
                            <div className="col-span-2 space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Lokasi</label>
                                <input type="text" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Area lokasi kerja" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-50">
                            <div className="flex items-center gap-3">
                                <input type="checkbox" id="syncCalendar" checked={form.addToCalendar} onChange={e => setForm({ ...form, addToCalendar: e.target.checked })} className="w-5 h-5 rounded-lg border-indigo-200 text-indigo-600" />
                                <label htmlFor="syncCalendar" className="text-xs font-bold text-slate-600">Sync ke Kalender Kerja</label>
                            </div>
                            <button disabled={submitting} type="submit" className="w-full md:w-auto bg-indigo-600 text-white px-12 py-4 rounded-xl font-black shadow-xl shadow-indigo-600/30 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50">
                                {submitting ? 'Mengirim Data...' : 'Kirim Penugasan'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Filter Hub */}
            {!showForm && (
                <div className="flex flex-wrap items-center justify-between gap-4 bg-white/50 backdrop-blur-sm p-3 rounded-2xl border border-slate-100">
                    <div className="flex gap-1 bg-slate-100/50 p-1 rounded-xl">
                        {['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED'].map((s) => (
                            <button
                                key={s}
                                onClick={() => setFilterStatus(s)}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${filterStatus === s ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {s === 'ALL' ? 'SEMUA' : statusConfig[s].label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Assignments List (Professional List View) */}
            <div className="space-y-3 pb-10">
                {loading ? (
                    <div className="py-20 flex flex-col items-center gap-4 bg-white rounded-3xl border border-slate-100 shadow-sm">
                        <Loader2 className="animate-spin text-indigo-600" size={40} />
                        <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Sinkronisasi Data...</p>
                    </div>
                ) : filteredAssignments.length === 0 ? (
                    <div className="py-20 bg-white rounded-3xl border-2 border-dashed border-slate-100 flex flex-col items-center text-center">
                        <FileCheck size={48} className="text-slate-200 mb-4" />
                        <h4 className="text-lg font-bold text-slate-800">Daftar Tugas Kosong</h4>
                        <p className="text-slate-400 text-xs mt-1">Gunakan tombol diatas untuk memberi tugas baru.</p>
                    </div>
                ) : (
                    <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <div className="col-span-3">Pekerjaan & Info</div>
                        <div className="col-span-3 text-center">Checklist Progres</div>
                        <div className="col-span-2 text-center">Personil</div>
                        <div className="col-span-2 text-center">Deadline</div>
                        <div className="col-span-2 text-right">Status & Aksi</div>
                    </div>
                )}

                {!loading && filteredAssignments.map(a => (
                    <AssignmentRow 
                        key={a.id} 
                        a={a} 
                        statusConfig={statusConfig} 
                        priorityConfig={priorityConfig} 
                        handleUpdateAssignment={handleUpdateAssignment} 
                        canAssign={canAssign} 
                        userId={user.id} 
                    />
                ))}
            </div>
        </div>
    );
};

const AssignmentRow = ({ a, statusConfig, priorityConfig, handleUpdateAssignment, canAssign, userId }) => {
    const isAssignee = a.assigneeId === userId;
    const [expanded, setExpanded] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [editProgress, setEditProgress] = useState(false);
    const [manualProgress, setManualProgress] = useState(a.progressPercentage || 0);

    useEffect(() => {
        setManualProgress(a.progressPercentage || 0);
    }, [a.progressPercentage]);
    
    // Parse items if it's a string (MySQL might return stringified JSON depending on config)
    const items = Array.isArray(a.items) ? a.items : (typeof a.items === 'string' ? JSON.parse(a.items) : []);
    const totalCount = items.length;
    const completedCount = items.filter(it => it.status === 'COMPLETED').length;
    
    // Logic: If there is a checklist, use calculation. If not, use DB value for simple tasks.
    const progress = totalCount > 0 
        ? Math.round((completedCount / totalCount) * 100) 
        : (a.progressPercentage || 0);

    const toggleItemStatus = async (itemIdx) => {
        if (updating || (!isAssignee && !canAssign)) return;
        setUpdating(true);
        const newItems = [...items];
        newItems[itemIdx].status = newItems[itemIdx].status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
        await handleUpdateAssignment(a.id, { items: newItems });
        setUpdating(false);
    };

    return (
        <div className={`group bg-white rounded-2xl border ${expanded ? 'border-indigo-100 shadow-xl' : 'border-slate-100 hover:border-slate-200'} transition-all duration-300 relative overflow-hidden overflow-visible`}>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-4 md:p-5">
                {/* Info Column */}
                <div className="col-span-1 md:col-span-3 flex items-start gap-4">
                    <button 
                        onClick={() => setExpanded(!expanded)}
                        className={`mt-1 p-1.5 rounded-lg transition-all ${expanded ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600'}`}
                    >
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${priorityConfig[a.priority || 'MEDIUM'].color} bg-slate-50 border border-slate-100`}>
                                {priorityConfig[a.priority || 'MEDIUM'].label}
                            </span>
                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{a.category}</span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 truncate leading-tight group-hover:text-indigo-600 transition-colors uppercase">{a.title}</h4>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1 font-medium italic">
                            <MapPin size={10} /> {a.location || 'Lokasi Terpusat'}
                        </div>
                    </div>
                </div>

                {/* Progress Column */}
                <div className="col-span-1 md:col-span-3 px-4 md:px-0">
                   <div className="flex flex-col gap-1.5 group/prog">
                        <div className="flex justify-between items-end text-[10px] font-black tracking-tighter">
                            <span className="text-slate-400 uppercase">Progres Penugasan</span>
                            <div className="flex items-center gap-2">
                                {editProgress && totalCount === 0 ? (
                                    <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                                        <input 
                                            type="number" 
                                            min="0" max="100" 
                                            value={manualProgress} 
                                            onChange={(e) => setManualProgress(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleUpdateAssignment(a.id, { progressPercentage: manualProgress });
                                                    setEditProgress(false);
                                                }
                                                if (e.key === 'Escape') setEditProgress(false);
                                            }}
                                            onBlur={() => {
                                                handleUpdateAssignment(a.id, { progressPercentage: manualProgress });
                                                setEditProgress(false);
                                            }}
                                            className="w-14 px-2 py-1 bg-white border-2 border-indigo-500 rounded-lg text-center text-indigo-700 font-bold outline-none shadow-lg shadow-indigo-100"
                                            autoFocus
                                        />
                                        <span className="text-indigo-400 font-bold">%</span>
                                    </div>
                                ) : (
                                    <div 
                                        className={`flex items-center gap-2 cursor-pointer group/val ${totalCount === 0 && (canAssign || isAssignee) ? 'hover:text-indigo-600' : ''}`}
                                        onClick={() => totalCount === 0 && (canAssign || isAssignee) && setEditProgress(true)}
                                    >
                                        <span className="text-indigo-600 px-1.5 py-0.5 bg-indigo-50 rounded-md border border-indigo-100 font-black relative">
                                            {progress}%
                                            {totalCount === 0 && (canAssign || isAssignee) && (
                                                <div className="absolute -right-1 -top-1 opacity-0 group-hover/val:opacity-100 transition-opacity bg-indigo-600 text-white rounded-full p-0.5 shadow-sm">
                                                    <Tag size={6} />
                                                </div>
                                            )}
                                        </span>
                                        {totalCount > 0 && <span className="text-slate-300 font-medium">({completedCount}/{totalCount})</span>}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden relative">
                            <div className={`h-full transition-all duration-1000 ${progress === 100 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-indigo-600'}`} style={{ width: `${progress}%` }} />
                        </div>
                   </div>
                </div>

                {/* Staff Column */}
                <div className="col-span-1 md:col-span-2 flex items-center justify-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-500 overflow-hidden shrink-0">
                        {a.assignee?.name ? a.assignee.name[0].toUpperCase() : <User size={14} />}
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-700 truncate">{a.assignee?.name || 'Staff'}</p>
                        <p className="text-[9px] text-slate-400 font-medium">Pelaksana</p>
                    </div>
                </div>

                {/* Date Column */}
                <div className="col-span-1 md:col-span-2 text-center">
                    <div className="inline-flex flex-col items-center gap-0.5 bg-slate-50 group-hover:bg-red-50/50 px-3 py-1.5 rounded-xl transition-colors">
                        <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase">Maks Selesai</span>
                        <span className="text-[11px] font-black text-slate-700">{a.dueDate ? new Date(a.dueDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : '-'}</span>
                    </div>
                </div>

                {/* Status Column */}
                <div className="col-span-1 md:col-span-2 flex flex-col items-end gap-2 px-4 md:px-0">
                    <div className={`px-3 py-1 rounded-lg border text-[9px] font-black tracking-widest flex items-center gap-1.5 ${statusConfig[a.status].color} w-full md:w-auto justify-center shadow-sm`}>
                        {statusConfig[a.status].icon} {statusConfig[a.status].label}
                    </div>
                    
                    <div className="flex gap-1.5 w-full md:w-auto">
                        {(canAssign || isAssignee) && a.status === 'PENDING' && (
                            <button 
                                onClick={() => handleUpdateAssignment(a.id, { status: 'IN_PROGRESS' })}
                                className="flex-1 md:flex-none px-3 py-1 bg-indigo-600 text-white text-[9px] font-black rounded-lg hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200"
                            >
                                MULAI
                            </button>
                        )}
                        {(canAssign || isAssignee) && a.status === 'IN_PROGRESS' && (
                            <button 
                                onClick={() => handleUpdateAssignment(a.id, { status: 'COMPLETED', progressPercentage: 100 })}
                                className="flex-1 md:flex-none px-3 py-1 bg-emerald-600 text-white text-[9px] font-black rounded-lg hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200"
                            >
                                SELESAI
                            </button>
                        )}
                        {canAssign && (
                            <button 
                                onClick={() => handleUpdateAssignment(a.id, { status: 'CANCELLED' })}
                                className="p-1 px-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                title="Batalkan"
                            >
                                <X size={12} strokeWidth={3} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Expanded Content (Sub-tasks Checklist) */}
            {expanded && (
                <div className="border-t border-slate-50 bg-slate-50/30 p-6 animate-in slide-in-from-top-2 duration-300">
                    <div className="max-w-4xl">
                        <div className="flex items-center justify-between mb-4">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <FileCheck size={14} className="text-indigo-600" /> Rincian Sub-Tugas (Checklist)
                            </h5>
                            <span className="text-[10px] font-bold text-slate-400 italic">Klik item untuk menandai selesai</span>
                        </div>

                        {totalCount === 0 ? (
                            <div className="p-4 bg-white rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400 italic">
                                Tidak ada sub-tugas yang didefinisikan.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {items.map((item, idx) => {
                                    const isDone = item.status === 'COMPLETED';
                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => toggleItemStatus(idx)}
                                            disabled={updating}
                                            className={`flex items-center gap-4 p-4 rounded-xl border transition-all text-left shadow-sm ${isDone ? 'bg-emerald-50/50 border-emerald-100 border-l-4 border-l-emerald-500' : 'bg-white border-slate-100 hover:border-indigo-200'}`}
                                        >
                                            <div className={`shrink-0 ${isDone ? 'text-emerald-500' : 'text-slate-300'}`}>
                                                {isDone ? <CheckSquare size={20} /> : <Square size={20} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-xs font-bold leading-tight ${isDone ? 'text-emerald-700 line-through decoration-emerald-300' : 'text-slate-700'}`}>
                                                    {item.text}
                                                </p>
                                                <span className={`text-[9px] font-black tracking-widest uppercase ${isDone ? 'text-emerald-400' : 'text-slate-400'}`}>
                                                    {isDone ? 'COMPLETED' : 'PENDING'}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {a.description && (
                            <div className="mt-8 space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Instruksi Tambahan</label>
                                <div className="p-4 bg-white border border-slate-100 rounded-xl text-xs text-slate-600 leading-relaxed font-medium">
                                    {a.description}
                                </div>
                            </div>
                        )}
                        
                        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                            <button 
                                onClick={() => setExpanded(false)}
                                className="text-[10px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest py-2 px-4"
                            >
                                Tutup Rincian
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PersonnelAssignments;
