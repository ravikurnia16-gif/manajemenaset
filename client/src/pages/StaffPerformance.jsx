import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
    Calendar, FileText, FileCheck, Trophy, Plus, Search, 
    Filter, LayoutDashboard, TrendingUp, Users, Activity, 
    CheckCircle2, Clock, Zap, AlertCircle, MapPin, Tag, 
    ArrowRight, MoreVertical, Flag, Loader2, X, ChevronDown, 
    ChevronUp, CheckSquare, Square, Target, Timer, Award,
    Medal, Crown, Send, Trash2, Sparkles, Download, ListChecks,
    ClipboardCheck, History, ClipboardList
} from 'lucide-react';
import api from '../lib/axios';

// --- SHARED COMPONENTS ---

const StatusBadge = ({ status, config }) => {
    const c = config[status] || { label: status, color: 'bg-slate-100 text-slate-600', icon: AlertCircle };
    const Icon = c.icon;
    return (
        <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm border border-white/20 ${c.color}`}>
            <Icon size={12} strokeWidth={2.5} />
            {c.label}
        </span>
    );
};

const PriorityBadge = ({ priority, config }) => {
    const c = config[priority] || { label: priority, color: 'bg-slate-100 text-slate-500' };
    return (
        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border border-white/10 ${c.color}`}>
            {c.label}
        </span>
    );
};

// --- KPI COMPONENTS ---

const ScoreBar = ({ label, score, color, icon: Icon }) => (
    <div className="space-y-2">
        <div className="flex justify-between items-center px-1">
            <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${color.replace('bg-', 'bg-').replace('-500', '-50')} border ${color.replace('bg-', 'border-').replace('-500', '-100')}`}>
                    <Icon size={12} className={color.replace('bg-', 'text-')} />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
            </div>
            <span className={`text-[11px] font-black ${color.replace('bg-', 'text-')}`}>{score}%</span>
        </div>
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner flex">
            <div 
                className={`h-full transition-all duration-1000 ease-out fill-mode-forwards ${color} shadow-[0_0_8px_rgba(0,0,0,0.1)]`} 
                style={{ width: `${score}%` }} 
            />
        </div>
    </div>
);

const RankBadge = ({ rank }) => {
    if (rank === 0) return <Crown className="text-amber-400 drop-shadow-lg" size={28} strokeWidth={2.5} />;
    if (rank === 1) return <Medal className="text-slate-400 drop-shadow-md" size={24} strokeWidth={2.5} />;
    if (rank === 2) return <Medal className="text-amber-700/60 drop-shadow-sm" size={20} strokeWidth={2.5} />;
    return <span className="text-sm font-black text-slate-300 italic">#{rank + 1}</span>;
};

// --- SUB-TASK ITEM ---

const SubTaskItem = ({ item, idx, progressVal, isDone, updating, isAssignee, canAssign, toggleItemStatus, updateItemProgress, appendItemNote }) => {
    const [localVal, setLocalVal] = useState(progressVal);
    const [newNote, setNewNote] = useState('');
    const [showNoteInput, setShowNoteInput] = useState(false);

    useEffect(() => {
        setLocalVal(progressVal);
    }, [progressVal]);

    const commitProgress = () => {
        const clamped = Math.min(100, Math.max(0, localVal));
        if (clamped !== progressVal) {
            updateItemProgress(idx, clamped);
        }
    };

    const handleAddNote = () => {
        if (!newNote.trim()) return;
        appendItemNote(idx, newNote);
        setNewNote('');
        setShowNoteInput(false);
    };

    const logs = Array.isArray(item.logs) ? item.logs : [];

    return (
        <div className={`p-4 rounded-2xl border transition-all shadow-sm ${isDone ? 'bg-emerald-50/30 border-emerald-100' : 'bg-white border-slate-100'}`}>
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                    <button
                        onClick={() => toggleItemStatus(idx)}
                        disabled={updating}
                        className={`mt-0.5 shrink-0 transition-transform active:scale-90 ${isDone ? 'text-emerald-500' : 'text-slate-300'}`}
                    >
                        {isDone ? <CheckSquare size={22} strokeWidth={2.5} /> : <Square size={22} strokeWidth={2.5} />}
                    </button>
                    <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold leading-tight ${isDone ? 'text-emerald-700 line-through decoration-emerald-200' : 'text-slate-700'}`}>
                            {item.text}
                        </p>
                        
                        {logs.length > 0 && (
                            <div className="mt-2 space-y-2 pl-2 border-l-2 border-slate-100">
                                {logs.map((log, lIdx) => (
                                    <div key={lIdx} className="group/log">
                                        <p className="text-[10px] font-medium text-slate-500 leading-relaxed italic">"{log.text}"</p>
                                        <p className="text-[8px] font-black text-slate-300 uppercase tracking-tighter mt-0.5">
                                            {new Date(log.timestamp).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {(isAssignee || canAssign) && (
                            <div className="mt-2">
                                {!showNoteInput ? (
                                    <button onClick={() => setShowNoteInput(true)} className="text-[9px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-widest flex items-center gap-1.5 transition-colors">
                                        <Plus size={10} strokeWidth={3} /> Tambah Catatan
                                    </button>
                                ) : (
                                    <div className="space-y-2 mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Tulis progres atau kendala..." className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none h-16 transition-all" autoFocus />
                                        <div className="flex gap-2">
                                            <button onClick={handleAddNote} disabled={!newNote.trim() || updating} className="px-3 py-1 bg-indigo-600 text-white text-[9px] font-black rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm">SIMPAN</button>
                                            <button onClick={() => setShowNoteInput(false)} className="px-3 py-1 bg-slate-100 text-slate-500 text-[9px] font-black rounded-lg hover:bg-slate-200 transition-all">BATAL</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3 md:w-32 self-start md:self-center mt-2 md:mt-0 bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <input type="number" min="0" max="100" value={localVal} onChange={(e) => setLocalVal(parseInt(e.target.value) || 0)} onBlur={commitProgress} className="w-12 bg-transparent text-center text-xs font-black text-indigo-700 outline-none" disabled={updating || (!isAssignee && !canAssign)} />
                    <span className="text-[10px] font-black text-slate-300">%</span>
                    {canAssign && (
                        <button 
                            onClick={() => toggleItemStatus(idx)}
                            className="p-1 px-2 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                            title="Hapus Tahapan (Hanya Super Admin)"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- MAIN HUB ---

const StaffPerformance = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const urlTab = searchParams.get('tab')?.toUpperCase();
    const validTabs = ['RENCANA', 'LAPORAN', 'PENUGASAN', 'KPI'];
    const initialTab = validTabs.includes(urlTab) ? urlTab : 'LAPORAN';

    const [activeTab, setActiveTab] = useState(initialTab);
    const [loading, setLoading] = useState(true);
    const [reports, setReports] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Filters
    const [filterStaff, setFilterStaff] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [filterPeriod, setFilterPeriod] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });

    const user = JSON.parse(localStorage.getItem('user')) || {};
    const isAdmin = ['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT'].includes(user.role) || 
                    (user.position?.toLowerCase().includes('kepala bidang') && user.unit?.name?.toLowerCase().includes('sarana dan prasarana'));

    // Form State (Consolidated)
    const [form, setForm] = useState({
        startTime: '08:00',
        endTime: '17:00',
        title: '',
        assigneeId: '',
        priority: 'MEDIUM',
        location: '',
        generalItems: activeTab === 'RENCANA' ? [{ activity: '', status: 'PENDING', percentage: 0, note: '' }] : [{ activity: '', status: 'SELESAI', percentage: 100, note: '' }],
        isPlan: activeTab === 'RENCANA'
    });

    const statusConfig = {
        'PENDING': { label: 'MENUNGGU', color: 'bg-amber-500 text-white shadow-amber-200', icon: Clock },
        'IN_PROGRESS': { label: 'PROSES', color: 'bg-indigo-500 text-white shadow-indigo-200', icon: Zap },
        'COMPLETED': { label: 'SELESAI', color: 'bg-emerald-500 text-white shadow-emerald-200', icon: CheckCircle2 },
        'OVERDUE': { label: 'TERLAMBAT', color: 'bg-rose-500 text-white shadow-rose-200', icon: AlertCircle }
    };

    const priorityConfig = {
        'LOW': { label: 'RENDAH', color: 'bg-slate-100 text-slate-500' },
        'MEDIUM': { label: 'MEDIUM', color: 'bg-indigo-50 text-indigo-600' },
        'HIGH': { label: 'TINGGI', color: 'bg-rose-50 text-rose-600' },
        'URGENT': { label: 'URGENT', color: 'bg-rose-600 text-white shadow-lg shadow-rose-200' }
    };

    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    const changeTab = (tab) => {
        setActiveTab(tab);
        setSearchParams({ tab });
        setShowForm(false);
    };

    useEffect(() => {
        if (urlTab && urlTab !== activeTab && validTabs.includes(urlTab)) {
            setActiveTab(urlTab);
        }
    }, [urlTab]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        fetchData();
    }, [activeTab, filterStaff, filterStatus, filterPeriod]);

    const fetchData = async () => {
        if (activeTab === 'LAPORAN' || activeTab === 'RENCANA') await fetchReports();
        if (activeTab === 'PENUGASAN') await fetchAssignments();
        if (activeTab === 'KPI') await fetchKPI();
    };

    const fetchInitialData = async () => {
        try {
            const res = await api.get('/personnel/staff');
            setStaffList(res.data || []);
        } catch (err) {
            console.error('Failed to fetch staff:', err);
        }
    };

    const fetchReports = async () => {
        setLoading(true);
        try {
            const params = {
                userId: filterStaff !== 'ALL' ? filterStaff : undefined,
                type: activeTab === 'RENCANA' ? 'WEEKLY' : 'DAILY'
            };
            const res = await api.get('/personnel/reports', { params });
            const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            
            // Filter by isPlan metadata for RENCANA vs LAPORAN
            const filtered = data.filter(r => {
                const isPlan = r.metadata?.isPlan;
                return activeTab === 'RENCANA' ? isPlan : !isPlan;
            });
            
            setReports(filtered);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAssignments = async () => {
        setLoading(true);
        try {
            const params = { 
                userId: filterStaff !== 'ALL' ? filterStaff : undefined,
                status: filterStatus !== 'ALL' ? filterStatus : undefined
            };
            const res = await api.get('/personnel/assignments', { params });
            setAssignments(res.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchKPI = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/personnel/kpi-leaderboard?month=${filterPeriod.month}&year=${filterPeriod.year}`);
            setLeaderboard(res.data.leaderboard || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // --- SUBMIT LOGIC ---

    const addGeneralItem = (activity = '', note = '', status = null, percentage = null) => {
        const defaultStatus = status || 'PENDING';
        const defaultPercentage = percentage !== null ? percentage : 0;
        
        setForm({
            ...form,
            generalItems: [...form.generalItems, { activity, status: defaultStatus, percentage: defaultPercentage, note }]
        });
    };

    const removeGeneralItem = (index) => {
        const newItems = form.generalItems.filter((_, i) => i !== index);
        setForm({ ...form, generalItems: newItems });
    };

    const handleGeneralItemChange = (index, field, value) => {
        const newItems = [...form.generalItems];
        newItems[index][field] = value;
        if (field === 'status' && value === 'SELESAI') {
            newItems[index].percentage = 100;
        }
        setForm({ ...form, generalItems: newItems });
    };

    const importFromAssignments = () => {
        const activeAssignments = assignments.filter(a => a.assigneeId === user.id && (a.status === 'IN_PROGRESS' || a.status === 'PENDING'));
        if (activeAssignments.length === 0) return alert('Tidak ada penugasan aktif yang ditemukan.');
        
        const newItems = activeAssignments.map(a => ({
            activity: `[TUGAS] ${a.title}`,
            status: a.status === 'COMPLETED' ? 'SELESAI' : 'PROSES',
            percentage: a.progressPercentage || 0,
            note: a.id // Keep ID for reference
        }));

        setForm(prev => ({
            ...prev,
            generalItems: [...prev.generalItems.filter(i => i.activity), ...newItems]
        }));
    };

    const importFromPlan = async () => {
        try {
            // Fetch recent Plans
            const res = await api.get('/personnel/reports', { params: { type: 'WEEKLY' } });
            const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            const lastPlan = data.find(r => r.metadata?.isPlan && r.userId === user.id);
            
            if (!lastPlan || !lastPlan.metadata?.items) return alert('Tidak ditemukan Rencana Kerja aktif untuk Anda.');

            const newItems = lastPlan.metadata.items.map((i, idx) => ({
                ...i,
                activity: `[RENCANA] ${i.activity}`,
                status: i.status || 'PENDING',
                percentage: i.percentage || 0,
                note: `Realisasi dari rencana kerja`,
                planId: lastPlan.id,
                planItemIndex: idx
            }));

            setForm(prev => ({
                ...prev,
                generalItems: [...prev.generalItems.filter(i => i.activity), ...newItems]
            }));
        } catch (err) {
            alert('Gagal mengambil rencana kerja.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const validItems = form.generalItems.filter(it => it.activity.trim());
        if (validItems.length === 0) return alert('Input minimal satu aktivitas');

        try {
            setSubmitting(true);
            const itemsList = validItems
                .map(it => {
                    const progress = it.status !== 'SELESAI' ? ` [${it.percentage}%]` : '';
                    const note = it.note && isNaN(it.note) ? ` - ${it.note}` : '';
                    return `- ${it.activity} (${it.status})${progress}${note}`;
                })
                .join('\n');

            const isPlan = activeTab === 'RENCANA';
            const isTask = activeTab === 'PENUGASAN';

            if (isTask) {
                const taskData = {
                    assigneeId: form.assigneeId,
                    title: form.title || 'Penugasan Hub',
                    description: form.content,
                    category: form.category,
                    priority: form.priority,
                    location: form.location,
                    items: validItems.map(it => ({ text: it.activity, isDone: false, percentage: 0 }))
                };
                if (!taskData.assigneeId) return alert('Pilih staf penerima tugas');
                await api.post('/personnel/assignments', taskData);
                fetchAssignments();
                setShowForm(false);
                resetForm();
                alert('Penugasan berhasil dikirim');
                return;
            }

            const title = isPlan ? (form.title || 'RENCANA KERJA') : 'LAPORAN AKTIVITAS';
            const timeHeader = isPlan ? `📅 Periode: ${form.startDate} s/d ${form.endDate}` : `🕒 Jam: ${form.startTime}-${form.endTime}`;
            const details = `${timeHeader}\n📋 ${title}:\n${itemsList}\n\n📝 Catatan tambahan: ${form.content || '-'}`;

            await api.post('/personnel/reports', {
                ...form,
                date: isPlan ? form.startDate : form.date,
                type: isPlan ? 'WEEKLY' : 'DAILY',
                details: details.replace(/\*/g, ''),
                metadata: {
                    startTime: isPlan ? '-' : form.startTime,
                    endTime: isPlan ? '-' : form.endTime,
                    startDate: form.startDate,
                    endDate: form.endDate,
                    isPlan: isPlan,
                    title: form.title,
                    items: validItems
                }
            });

            setShowForm(false);
            resetForm();
            fetchReports();
            alert(`${isPlan ? 'Rencana' : 'Laporan'} berhasil dikirim`);
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal mengirim data');
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setForm({
            type: 'DAILY',
            category: 'UMUM',
            content: '',
            date: new Date().toISOString().split('T')[0],
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
            startTime: '08:00',
            endTime: '17:00',
            title: '',
            assigneeId: '',
            priority: 'MEDIUM',
            location: '',
            generalItems: [{ activity: '', status: 'PENDING', percentage: 0, note: '' }],
            isPlan: activeTab === 'RENCANA'
        });
    };

    const handleUpdateAssignment = async (id, data) => {
        try {
            await api.put(`/personnel/assignments/${id}/status`, data);
            fetchAssignments();
        } catch (err) {
            alert('Gagal update tugas');
        }
    };

    return (
        <div className="p-4 md:p-8 bg-[#F8FAFC] min-h-screen pt-20 pb-24">
            <div className="max-w-7xl mx-auto space-y-8">
                
                {/* Header Hub */}
                <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 md:p-10 rounded-[32px] md:rounded-[48px] shadow-2xl shadow-indigo-200/20 relative overflow-hidden border border-white/5">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] -mr-48 -mt-48 opacity-50 animate-pulse" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] -ml-32 -mb-32 opacity-30" />
                    
                    <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                        <div className="flex items-center gap-4 md:gap-6">
                            <div className="w-14 h-14 md:w-20 md:h-20 bg-white/10 backdrop-blur-xl rounded-[20px] md:rounded-[28px] flex items-center justify-center shadow-2xl border border-white/10 group-hover:rotate-6 transition-transform">
                                <TrendingUp className="text-indigo-400 group-hover:text-white transition-colors" size={28} md:size={40} />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-tighter uppercase italic flex items-center gap-2">
                                    KINERJA <span className="text-indigo-400">STAF</span>
                                    <Sparkles size={18} className="text-indigo-400/50 hidden md:block" />
                                </h1>
                                <p className="text-[9px] md:text-[11px] font-black text-indigo-200/60 tracking-[0.25em] uppercase mt-1 md:mt-2">Sistem Monitoring & Performa Terintegrasi</p>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:flex items-center gap-2 md:gap-3 bg-white/5 backdrop-blur-md p-1.5 md:p-2.5 rounded-[24px] md:rounded-[32px] border border-white/10">
                            {['RENCANA', 'LAPORAN', 'PENUGASAN', 'KPI'].filter(t => t !== 'KPI' || user.role === 'SUPER_ADMIN').map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => changeTab(tab)}
                                    className={`px-4 md:px-7 py-2.5 md:py-3.5 rounded-xl md:rounded-[24px] text-[10px] md:text-[11px] font-black tracking-widest transition-all duration-300 relative group overflow-hidden ${activeTab === tab ? 'bg-white text-slate-900 shadow-xl scale-105' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                                >
                                    <span className="relative z-10">{tab === 'RENCANA' ? 'RENCANA' : tab === 'LAPORAN' ? 'LAPORAN' : tab === 'PENUGASAN' ? 'TUGAS' : 'KPI'}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Main Content Hub */}
                <div className="space-y-6">
                    {/* Filter & Action Row */}
                    {!showForm && (
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50 backdrop-blur-xl p-3 md:p-4 rounded-[28px] md:rounded-[32px] border border-slate-200/40 shadow-sm overflow-x-auto no-scrollbar">
                            <div className="flex items-center gap-3 md:gap-4 flex-nowrap md:flex-1">
                                {isAdmin && (
                                    <div className="flex items-center gap-2 bg-white px-3 md:px-4 py-2 md:py-2.5 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm min-w-[180px] md:min-w-[240px] shrink-0">
                                        <Users size={14} className="text-indigo-400" />
                                        <select 
                                            className="bg-transparent border-none text-[10px] md:text-[11px] font-black text-slate-600 focus:ring-0 w-full cursor-pointer uppercase tracking-wider"
                                            value={filterStaff}
                                            onChange={(e) => setFilterStaff(e.target.value)}
                                        >
                                            <option value="ALL">SEMUA STAF</option>
                                            {staffList.map(s => <option key={s.id} value={s.id}>{s.name || s.username}</option>)}
                                        </select>
                                    </div>
                                )}
                                {activeTab === 'PENUGASAN' && (
                                    <div className="flex items-center gap-2 bg-white px-3 md:px-4 py-2 md:py-2.5 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm shrink-0">
                                        <Tag size={14} className="text-emerald-400" />
                                        <select 
                                            className="bg-transparent border-none text-[10px] md:text-[11px] font-black text-slate-600 focus:ring-0 cursor-pointer uppercase tracking-wider"
                                            value={filterStatus}
                                            onChange={(e) => setFilterStatus(e.target.value)}
                                        >
                                            <option value="ALL">SEMUA STATUS</option>
                                            <option value="PENDING">MENUNGGU</option>
                                            <option value="IN_PROGRESS">PROSES</option>
                                            <option value="COMPLETED">SELESAI</option>
                                        </select>
                                    </div>
                                )}
                                {activeTab === 'KPI' && (
                                    <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm">
                                        <select 
                                            className="bg-transparent border-none text-[11px] font-black text-slate-600 focus:ring-0 cursor-pointer uppercase tracking-wider"
                                            value={filterPeriod.month}
                                            onChange={(e) => setFilterPeriod({...filterPeriod, month: parseInt(e.target.value)})}
                                        >
                                            {months.map((m, idx) => <option key={m} value={idx + 1}>{m}</option>)}
                                        </select>
                                        <select 
                                            className="bg-transparent border-none text-[11px] font-black text-slate-600 focus:ring-0 cursor-pointer uppercase tracking-wider"
                                            value={filterPeriod.year}
                                            onChange={(e) => setFilterPeriod({...filterPeriod, year: parseInt(e.target.value)})}
                                        >
                                            {[2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {(activeTab !== 'KPI' && (activeTab !== 'PENUGASAN' || user.role === 'SUPER_ADMIN')) && (
                                <button 
                                    onClick={() => { resetForm(); setShowForm(true); }}
                                    className="bg-slate-900 text-white px-6 md:px-8 py-3 md:py-3.5 rounded-xl md:rounded-2xl text-[10px] md:text-[11px] font-black tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95 flex items-center justify-center gap-2 shrink-0"
                                >
                                    <Plus size={14} md:size={16} strokeWidth={3} /> 
                                    {activeTab === 'RENCANA' ? 'BUAT RENCANA' : activeTab === 'LAPORAN' ? 'BUAT LAPORAN' : 'TAMBAH TUGAS'}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Dynamic View: Form or List */}
                    {showForm ? (
                        <div className="bg-white rounded-[48px] p-8 md:p-12 border border-indigo-100 shadow-2xl shadow-indigo-100/30 animate-in slide-in-from-top-4 duration-500 max-w-5xl mx-auto">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-indigo-600 text-white rounded-[24px] flex items-center justify-center shadow-2xl shadow-indigo-200 ring-8 ring-indigo-50">
                                        {activeTab === 'RENCANA' ? <Calendar size={28} /> : activeTab === 'PENUGASAN' ? <ClipboardList size={28} /> : <FileText size={28} />}
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black text-slate-900 italic uppercase">
                                            {activeTab === 'RENCANA' ? 'Input Rencana Kerja' : activeTab === 'PENUGASAN' ? 'Input Penugasan Baru' : 'Input Laporan Harian'}
                                        </h2>
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Lengkapi rincian aktivitas Anda</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowForm(false)} className="self-start md:self-center p-3 bg-slate-50 text-slate-400 hover:text-rose-500 rounded-2xl hover:bg-rose-50 transition-all">
                                    <X size={24} strokeWidth={2.5} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-12">
                                {activeTab === 'RENCANA' ? (
                                    <>
                                        <div className="md:col-span-3 space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">📝 Judul Rencana Kerja</label>
                                            <input 
                                                type="text" 
                                                value={form.title} 
                                                onChange={e => setForm({...form, title: e.target.value})} 
                                                placeholder="Misal: Perbaikan Instalasi Listrik Gedung B"
                                                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold focus:ring-4 focus:ring-indigo-100 outline-none transition-all" 
                                            />
                                        </div>
                                        <FormGroup label="📅 Tanggal Mulai">
                                            <input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} className="form-input" />
                                        </FormGroup>
                                        <FormGroup label="📅 Tanggal Selesai">
                                            <input type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} className="form-input" />
                                        </FormGroup>
                                        <div className="hidden md:block"></div>
                                    </>
                                ) : activeTab === 'PENUGASAN' ? (
                                    <>
                                        <div className="md:col-span-3 space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">📝 Judul Penugasan</label>
                                            <input 
                                                type="text" 
                                                value={form.title} 
                                                onChange={e => setForm({...form, title: e.target.value})} 
                                                placeholder="Misal: Pengecekan Panel Listrik Utama"
                                                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold focus:ring-4 focus:ring-indigo-100 outline-none transition-all" 
                                            />
                                        </div>
                                        <FormGroup label="👤 Penerima Tugas (Staf)">
                                            <select 
                                                className="form-input uppercase"
                                                value={form.assigneeId}
                                                onChange={(e) => setForm({...form, assigneeId: e.target.value})}
                                            >
                                                <option value="">PILIH STAF</option>
                                                {staffList.map(s => <option key={s.id} value={s.id}>{s.name || s.username}</option>)}
                                            </select>
                                        </FormGroup>
                                        <FormGroup label="⚡ Prioritas">
                                            <select 
                                                className="form-input"
                                                value={form.priority}
                                                onChange={(e) => setForm({...form, priority: e.target.value})}
                                            >
                                                <option value="LOW">RENDAH</option>
                                                <option value="MEDIUM">MEDIUM</option>
                                                <option value="HIGH">TINGGI</option>
                                                <option value="URGENT">URGENT</option>
                                            </select>
                                        </FormGroup>
                                        <FormGroup label="📍 Lokasi">
                                            <input 
                                                type="text" 
                                                value={form.location} 
                                                onChange={e => setForm({...form, location: e.target.value})} 
                                                placeholder="Misal: Gedung A Lt. 1"
                                                className="form-input"
                                            />
                                        </FormGroup>
                                    </>
                                ) : (
                                    <>
                                        <FormGroup label="📅 Tanggal Target">
                                            <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="form-input" />
                                        </FormGroup>
                                        <FormGroup label="🕒 Mulai Jam">
                                            <input type="time" value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})} className="form-input" />
                                        </FormGroup>
                                        <FormGroup label="🕒 Selesai Jam">
                                            <input type="time" value={form.endTime} onChange={e => setForm({...form, endTime: e.target.value})} className="form-input" />
                                        </FormGroup>
                                    </>
                                )}

                                <div className="space-y-6">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[.25em] flex items-center gap-2">
                                            <ListChecks size={18} className="text-indigo-500" /> {activeTab === 'PENUGASAN' ? 'Checklist Pekerjaan' : 'Rincian Aktivitas'}
                                        </h3>
                                        <div className="flex flex-wrap gap-2">
                                            {activeTab === 'LAPORAN' && (
                                                <>
                                                    <button type="button" onClick={importFromPlan} className="px-5 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center gap-2">
                                                        <Sparkles size={14} /> Ambil dari Rencana
                                                    </button>
                                                    <button type="button" onClick={importFromAssignments} className="px-5 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all flex items-center gap-2">
                                                        <ClipboardCheck size={14} /> Ambil dari Penugasan
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {form.generalItems.map((item, idx) => (
                                            <div key={idx} className="group relative p-6 bg-slate-50/50 rounded-[32px] border border-slate-200/60 hover:border-indigo-200 hover:bg-white transition-all">
                                                <div className="flex flex-col md:flex-row gap-6">
                                                    <div className="flex-1">
                                                        <input 
                                                            placeholder={activeTab === 'RENCANA' ? "Sebutkan tahapan rencana kerja..." : activeTab === 'PENUGASAN' ? "Deskripsikan langkah/item pekerjaan..." : "Apa yang akan/telah Anda kerjakan?"}
                                                            value={item.activity}
                                                            onChange={e => handleGeneralItemChange(idx, 'activity', e.target.value)}
                                                            className="w-full bg-transparent border-none text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:ring-0"
                                                        />
                                                    </div>
                                                    <div className="flex gap-4">
                                                                                        <div className="flex flex-col gap-2">
                                                            <select 
                                                                value={item.status}
                                                                onChange={e => handleGeneralItemChange(idx, 'status', e.target.value)}
                                                                className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest border-none cursor-pointer ${item.status === 'SELESAI' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}
                                                            >
                                                                <option value="SELESAI">SELESAI</option>
                                                                <option value="PROSES">PROSES</option>
                                                                <option value="PENDING">PENDING</option>
                                                            </select>
                                                            {item.status !== 'PENDING' && (
                                                                <div className="flex items-center gap-2 px-2">
                                                                    <input 
                                                                        type="range" min="0" max="100" step="10"
                                                                        value={item.percentage}
                                                                        onChange={e => handleGeneralItemChange(idx, 'percentage', e.target.value)}
                                                                        className="w-20 h-1 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600"
                                                                    />
                                                                    <span className="text-[9px] font-black text-indigo-600 w-6">{item.percentage}%</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {form.generalItems.length > 1 && (
                                                            <button type="button" onClick={() => removeGeneralItem(idx)} className="p-2 text-rose-300 hover:text-rose-500 transition-colors self-start">
                                                                <Trash2 size={18} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                {activeTab === 'LAPORAN' && (
                                                    <input 
                                                        placeholder="Tambahkan catatan detail jika perlu..."
                                                        value={item.note && isNaN(item.note) ? item.note : ''}
                                                        onChange={e => handleGeneralItemChange(idx, 'note', e.target.value)}
                                                        className="w-full bg-transparent border-none text-[10px] font-medium text-slate-400 italic mt-2 focus:ring-0"
                                                    />
                                                )}
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => addGeneralItem()} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-[32px] text-slate-400 hover:text-indigo-500 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all flex items-center justify-center gap-2">
                                            <Plus size={18} strokeWidth={3} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Tambah Rincian Lagi</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[.25em]">📝 Catatan Tambahan</h3>
                                    <textarea 
                                        value={form.content}
                                        onChange={e => setForm({...form, content: e.target.value})}
                                        rows={4}
                                        className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[32px] text-sm font-medium focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-300"
                                        placeholder="Tuliskan hal penting lainnya..."
                                    />
                                </div>

                                <div className="flex justify-end pt-8">
                                    <button 
                                        type="submit" 
                                        disabled={submitting}
                                        className="bg-indigo-600 text-white px-12 py-5 rounded-[28px] text-sm font-black tracking-widest hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-200 active:scale-95 flex items-center gap-3 disabled:opacity-50"
                                    >
                                        {submitting ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                                        {submitting ? 'SEDANG MENGIRIM...' : activeTab === 'RENCANA' ? 'KIRIM RENCANA KERJA' : activeTab === 'PENUGASAN' ? 'DELEGASIKAN TUGAS SEKARANG' : 'KIRIM LAPORAN RESMI'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                            {loading ? (
                                <div className="py-40 flex flex-col items-center gap-4">
                                    <Loader2 className="animate-spin text-indigo-600" size={48} strokeWidth={2.5} />
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Mengkalkulasi Performa...</p>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {activeTab === 'KPI' && user.role === 'SUPER_ADMIN' ? (
                                        <KPITab leaderboard={leaderboard} />
                                    ) : activeTab === 'PENUGASAN' ? (
                                        <div className="space-y-6">
                                            {/* Summary Stats Row */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div className="bg-white p-4 rounded-[24px] border border-slate-100 shadow-sm flex flex-col gap-1 items-center justify-center text-center">
                                                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Total Tugas</p>
                                                    <p className="text-xl font-black text-slate-900 tracking-tighter">{assignments.length}</p>
                                                </div>
                                                <div className="bg-amber-50 p-4 rounded-[24px] border border-amber-100 shadow-sm flex flex-col gap-1 items-center justify-center text-center">
                                                    <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest">Menunggu</p>
                                                    <p className="text-xl font-black text-amber-600 tracking-tighter">{assignments.filter(a => a.status === 'PENDING').length}</p>
                                                </div>
                                                <div className="bg-indigo-50 p-4 rounded-[24px] border border-indigo-100 shadow-sm flex flex-col gap-1 items-center justify-center text-center">
                                                    <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">Proses</p>
                                                    <p className="text-xl font-black text-indigo-600 tracking-tighter">{assignments.filter(a => a.status === 'IN_PROGRESS').length}</p>
                                                </div>
                                                <div className="bg-emerald-50 p-4 rounded-[24px] border border-emerald-100 shadow-sm flex flex-col gap-1 items-center justify-center text-center">
                                                    <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Selesai</p>
                                                    <p className="text-xl font-black text-emerald-600 tracking-tighter">{assignments.filter(a => a.status === 'COMPLETED').length}</p>
                                                </div>
                                            </div>
                                            
                                            <AssignmentTab 
                                                assignments={assignments} 
                                                statusConfig={statusConfig} 
                                                priorityConfig={priorityConfig}
                                                handleUpdate={handleUpdateAssignment}
                                                userId={user.id}
                                                isAdmin={isAdmin}
                                                fetchData={fetchAssignments}
                                            />
                                        </div>
                                    ) : (
                                        <ReportTab 
                                            reports={reports} 
                                            type={activeTab} 
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                .form-input {
                    width: 100%;
                    padding: 0.875rem 1.25rem;
                    background-color: #F8FAFC;
                    border: 2px solid #F1F5F9;
                    border-radius: 1.25rem;
                    font-size: 0.875rem;
                    font-weight: 700;
                    color: #1E293B;
                    outline: none;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .form-input:focus {
                    border-color: #6366F1;
                    background-color: #FFFFFF;
                    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
                }
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;  /* IE and Edge */
                    scrollbar-width: none;  /* Firefox */
                }
            `}} />
        </div>
    );
};

// --- TAB HELPERS ---

const FormGroup = ({ label, children }) => (
    <div className="space-y-3">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{label}</label>
        {children}
    </div>
);

// --- TAB COMPONENTS ---

const KPITab = ({ leaderboard }) => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {leaderboard.length === 0 ? (
            <div className="lg:col-span-12 py-40 bg-white rounded-[48px] text-center opacity-40">
                <Trophy size={64} className="mx-auto text-slate-200 mb-6" />
                <p className="text-sm font-black text-slate-400 uppercase tracking-[0.4em]">Belum ada data nilai</p>
            </div>
        ) : (
            <>
                <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-8">
                    {leaderboard.slice(0, 3).map((item, idx) => (
                        <div key={item.userId} className={`relative bg-white rounded-[48px] p-10 shadow-xl transition-all hover:scale-[1.03] border-4 ${idx === 0 ? 'border-amber-100 ring-8 ring-amber-50' : 'border-slate-50'}`}>
                            <div className="flex justify-between items-start mb-10">
                                <RankBadge rank={idx} />
                                <div className={`px-6 py-2 rounded-2xl text-[12px] font-black shadow-lg ${item.grade === 'A' ? 'bg-indigo-600 text-white shadow-indigo-200' : item.grade === 'B' ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-slate-900 text-white'}`}>GRADE {item.grade}</div>
                            </div>
                            <div className="mb-10">
                                <h3 className="text-2xl font-black text-slate-900 italic uppercase leading-tight tracking-tighter">{item.name}</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mt-2">
                                    <Zap size={10} className="text-indigo-500" /> {item.position || 'STAF SARPRAS'}
                                </p>
                            </div>
                            <div className="space-y-6">
                                <ScoreBar label="Penyelesaian" score={item.scores.completion} color="bg-indigo-500" icon={Target} />
                                <ScoreBar label="Ketepatan" score={item.scores.punctuality} color="bg-emerald-500" icon={Timer} />
                                <ScoreBar label="Laporan" score={item.scores.report} color="bg-amber-500" icon={FileText} />
                            </div>
                            <div className="mt-12 pt-8 border-t border-slate-50 flex items-center justify-between">
                                <div>
                                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">Skor Rata-rata</p>
                                    <p className="text-5xl font-black text-slate-900 italic tracking-tighter">{item.averageScore}</p>
                                </div>
                                <div className="text-right">
                                    <Activity size={24} className="text-slate-100 mb-2 ml-auto" />
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.stats.total} TUGAS</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                {/* Ranking Table for idx > 3 */}
                {leaderboard.length > 3 && (
                    <div className="lg:col-span-12 space-y-4">
                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] ml-6 mb-4 flex items-center gap-3">
                            <History size={16} /> Riwayat Peringkat Lainnya
                        </h4>
                        {leaderboard.slice(3).map((item, idx) => (
                            <div key={item.userId} className="bg-white p-6 rounded-[32px] border border-slate-50 shadow-sm flex items-center gap-8 hover:translate-x-2 transition-all">
                                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-xs font-black text-slate-300 italic">#{idx + 4}</div>
                                <div className="flex-1">
                                    <h4 className="text-sm font-black text-slate-700 uppercase italic">{item.name}</h4>
                                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mt-0.5">{item.position}</p>
                                </div>
                                <div className="text-center w-24">
                                    <p className="text-[8px] font-black text-slate-300 uppercase mb-1">SCORE</p>
                                    <p className="text-lg font-black text-slate-800 tracking-tighter italic">{item.averageScore}</p>
                                </div>
                                <div className="text-center w-16">
                                    <p className="text-[8px] font-black text-slate-300 uppercase mb-1">GRADE</p>
                                    <p className="text-lg font-black text-indigo-600 tracking-tighter">{item.grade}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </>
        )}
    </div>
);

const AssignmentTab = ({ assignments, statusConfig, priorityConfig, handleUpdate, userId, isAdmin, fetchData }) => {
    const [newItemTexts, setNewItemTexts] = useState({});
    const [expandedIds, setExpandedIds] = useState([]);

    const toggleExpand = (id) => {
        setExpandedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const user = JSON.parse(localStorage.getItem('user')) || {};
    const isAssigneeFor = (a) => a.assigneeId === userId;
    const canAssign = user.role === 'SUPER_ADMIN';

    const toggleItemStatus = async (aId, idx) => {
        const assignment = assignments.find(a => a.id === aId);
        if (!assignment) return;
        const newItems = [...assignment.items];
        const item = newItems[idx];
        item.isDone = !item.isDone;
        item.percentage = item.isDone ? 100 : 0;
        
        const logText = item.isDone ? 'Ditandai selesai' : 'Ditandai belum selesai';
        item.logs = [...(item.logs || []), { text: logText, timestamp: new Date().toISOString() }];

        await handleUpdate(aId, { 
            items: newItems,
            status: newItems.every(i => i.isDone) ? 'COMPLETED' : 'IN_PROGRESS',
            progressPercentage: Math.round((newItems.filter(i => i.isDone).length / newItems.length) * 100)
        });
    };

    const updateItemProgress = async (aId, idx, val) => {
        const assignment = assignments.find(a => a.id === aId);
        if (!assignment) return;
        const newItems = [...assignment.items];
        newItems[idx].percentage = val;
        newItems[idx].isDone = val === 100;
        
        newItems[idx].logs = [...(newItems[idx].logs || []), { text: `Update progres ke ${val}%`, timestamp: new Date().toISOString() }];

        await handleUpdate(aId, { 
            items: newItems,
            progressPercentage: Math.round(newItems.reduce((acc, i) => acc + (i.percentage || 0), 0) / newItems.length)
        });
    };

    const appendItemNote = async (aId, idx, note) => {
        const assignment = assignments.find(a => a.id === aId);
        if (!assignment) return;
        const newItems = [...assignment.items];
        newItems[idx].logs = [...(newItems[idx].logs || []), { text: note, timestamp: new Date().toISOString() }];

        await handleUpdate(aId, { items: newItems });
    };

    const addNewTaskItem = async (aId, text) => {
        if (!text.trim()) return;
        const assignment = assignments.find(a => a.id === aId);
        if (!assignment) return;
        const newItems = [...(assignment.items || []), { text, isDone: false, percentage: 0, logs: [{ text: 'Tahapan ditambahkan oleh pelaksana', timestamp: new Date().toISOString() }] }];
        await handleUpdate(aId, { 
            items: newItems,
            status: 'IN_PROGRESS'
        });
    };

    return (
        <div className="bg-white rounded-[24px] md:rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
            {!isAdmin && (
                <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 md:px-8 py-3 bg-slate-50/80 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    <div className="md:col-span-6 flex gap-4">
                        <div className="w-8 shrink-0" />
                        <span>Detail Tugas & Lokasi</span>
                    </div>
                    <div className="md:col-span-4 text-right">Target Penyelesaian</div>
                    <div className="md:col-span-2 text-right">Status</div>
                </div>
            )}
            {isAdmin && (
                <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 md:px-8 py-3 bg-slate-50/80 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    <div className="md:col-span-6 flex gap-4">
                        <div className="w-8 shrink-0" />
                        <span>Monitoring Penugasan</span>
                    </div>
                    <div className="md:col-span-4 text-center">Pelaksana & Deadline</div>
                    <div className="md:col-span-2 text-right">Status Kerja</div>
                </div>
            )}
            {assignments.length === 0 ? (
                <div className="py-24 text-center opacity-40">
                    <ClipboardCheck size={48} className="mx-auto text-slate-200 mb-4" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Belum ada penugasan aktif</p>
                </div>
            ) : (
                assignments.map((a, idx) => {
                    const statusColors = {
                        'PENDING': 'border-l-amber-500',
                        'IN_PROGRESS': 'border-l-indigo-600',
                        'COMPLETED': 'border-l-emerald-500',
                        'OVERDUE': 'border-l-rose-500'
                    };
                    const accentClass = statusColors[a.status] || 'border-l-slate-200';
                    const isEven = idx % 2 === 0;
                    const isExpanded = expandedIds.includes(a.id);

                    return (
                        <div key={a.id} className={`border-b border-slate-50 border-l-[8px] md:border-l-[12px] ${accentClass} ${isEven ? 'bg-white' : 'bg-slate-50/50'} hover:bg-indigo-50/30 transition-all group relative`}>
                            <div className="p-4 md:p-6 flex flex-col md:flex-row justify-between gap-4 items-center">
                                <div className="flex items-center gap-4 flex-1 min-w-0 w-full md:w-auto">
                                    <button 
                                        onClick={() => toggleExpand(a.id)}
                                        className={`p-2 rounded-xl transition-all ${isExpanded ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600'}`}
                                    >
                                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </button>
                                    <div className="space-y-1 flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <PriorityBadge priority={a.priority} config={priorityConfig} />
                                            <StatusBadge status={a.status} config={statusConfig} />
                                            <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest bg-white/50 px-2 py-0.5 rounded-full border border-slate-100">ID: {a.id}</span>
                                        </div>
                                        <h3 className="text-sm md:text-base font-black text-slate-800 italic uppercase leading-tight tracking-tight truncate group-hover:text-indigo-600 transition-colors">{a.title}</h3>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <Users size={12} className="text-indigo-400" />
                                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest truncate">{a.assignee?.name || a.assignee?.username}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-slate-400">
                                                <MapPin size={12} />
                                                <span className="text-[9px] font-bold uppercase tracking-widest truncate">{a.location || 'SARPRAS ZONE'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 self-end md:self-center">
                                    <div className="flex flex-col items-center md:items-end gap-1">
                                        <div className="relative w-12 h-12 flex items-center justify-center bg-white rounded-full shadow-sm border border-slate-100">
                                            <svg className="w-full h-full -rotate-90">
                                                <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-50" />
                                                <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray={125.6} strokeDashoffset={125.6 - (125.6 * a.progressPercentage) / 100} className="text-indigo-600 transition-all duration-1000 stroke-linecap-round" />
                                            </svg>
                                            <span className="absolute text-[10px] font-black text-slate-900 italic tracking-tighter">{a.progressPercentage}%</span>
                                        </div>
                                        <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest">Penyelesaian</p>
                                    </div>
                                </div>
                            </div>

                            {/* Collapsible Content */}
                            {isExpanded && (
                                <div className="p-8 pt-0 md:pl-20 border-t border-slate-50/50 bg-slate-50/30 animate-in slide-in-from-top-2 duration-300">
                                    <div className="pt-6 max-w-4xl space-y-8">
                                        <div className="space-y-3">
                                            <h4 className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em] flex items-center gap-2 italic">📌 Deskripsi Tugas</h4>
                                            <div className="bg-white p-6 rounded-[24px] border border-slate-100 italic text-sm text-slate-600 leading-relaxed shadow-sm">
                                                {a.description || 'Tidak ada deskripsi tambahan.'}
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-4">
                                            <h4 className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em] flex items-center gap-2 italic">✅ Checklist Pekerjaan</h4>
                                            <div className="space-y-3">
                                                {(Array.isArray(a.items) ? a.items : []).map((item, iIdx) => (
                                                    <SubTaskItem 
                                                        key={iIdx} 
                                                        item={item} 
                                                        idx={iIdx} 
                                                        progressVal={item.percentage || 0}
                                                        isDone={item.isDone}
                                                        isAssignee={isAssigneeFor(a)}
                                                        canAssign={canAssign}
                                                        toggleItemStatus={() => toggleItemStatus(a.id, iIdx)}
                                                        updateItemProgress={(i, v) => updateItemProgress(a.id, i, v)}
                                                        appendItemNote={(i, n) => appendItemNote(a.id, i, n)}
                                                    />
                                                ))}

                                                {(isAssigneeFor(a) || canAssign) && (
                                                    <div className="flex gap-2 p-3 bg-white/60 rounded-xl border border-dashed border-slate-200 mt-4">
                                                        <input 
                                                            type="text" 
                                                            value={newItemTexts[a.id] || ''}
                                                            onChange={(e) => setNewItemTexts({...newItemTexts, [a.id]: e.target.value})}
                                                            placeholder="Tambah tahapan pekerjaan..."
                                                            className="flex-1 bg-transparent border-none text-[10px] font-bold text-slate-700 outline-none placeholder:text-slate-300"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && newItemTexts[a.id]) {
                                                                    addNewTaskItem(a.id, newItemTexts[a.id]);
                                                                    setNewItemTexts({...newItemTexts, [a.id]: ''});
                                                                }
                                                            }}
                                                        />
                                                        <button 
                                                            onClick={() => {
                                                                addNewTaskItem(a.id, newItemTexts[a.id]);
                                                                setNewItemTexts({...newItemTexts, [a.id]: ''});
                                                            }}
                                                            disabled={!newItemTexts[a.id]?.trim()}
                                                            className="px-3 py-1 bg-indigo-600 text-white text-[8px] font-black rounded-lg hover:bg-indigo-700 transition-all uppercase tracking-widest disabled:opacity-30"
                                                        >
                                                            TAMBAH
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );
};

const ReportTab = ({ reports, type }) => {
    const [expandedReportIds, setExpandedReportIds] = useState([]);

    const toggleExpand = (id) => {
        setExpandedReportIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    return (
        <div className="bg-white rounded-[24px] md:rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
            <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 md:px-8 py-3 bg-slate-50/80 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                <div className="md:col-span-6 flex gap-4">
                    <div className="w-8 shrink-0" />
                    <span>Aktivitas Utama & Personil</span>
                </div>
                <div className="md:col-span-4 text-center">{type === 'RENCANA' ? 'Periode Rencana' : 'Waktu Laporan'}</div>
                <div className="md:col-span-2 text-right">Label</div>
            </div>
            
            {reports.length === 0 ? (
                <div className="py-24 text-center opacity-40">
                    <FileText size={48} className="mx-auto text-slate-200 mb-4" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Belum ada {type.toLowerCase()} yang dikirim</p>
                </div>
            ) : (
                reports.map((r, idx) => {
                    const isEven = idx % 2 === 0;
                    const isExpanded = expandedReportIds.includes(r.id);
                    const isPlan = r.metadata?.isPlan;

                    return (
                        <div key={r.id} className={`border-b border-slate-50 border-l-[8px] ${isPlan ? 'border-l-indigo-500' : 'border-l-emerald-500'} ${isEven ? 'bg-white' : 'bg-slate-50/50'} hover:bg-slate-100/50 transition-all group relative`}>
                            <div className="p-4 md:p-6 flex flex-col md:flex-row justify-between gap-4 items-center">
                                <div className="flex items-center gap-4 flex-1 min-w-0 w-full md:w-auto">
                                    <button 
                                        onClick={() => toggleExpand(r.id)}
                                        className={`p-2 rounded-xl transition-all ${isExpanded ? 'bg-slate-800 text-white shadow-lg' : 'bg-slate-100 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600'}`}
                                    >
                                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </button>
                                    <div className="space-y-1 flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <span className="px-2 py-0.5 bg-slate-900 text-white text-[8px] font-black uppercase tracking-widest rounded-full">{r.category || (isPlan ? 'PLN' : 'RPT')}</span>
                                            <span className="text-[9px] font-black text-slate-300">#{r.id.toString().padStart(5, '0')}</span>
                                        </div>
                                        <h3 className="text-sm md:text-base font-black text-slate-800 uppercase italic leading-tight tracking-tight truncate group-hover:text-indigo-600 transition-colors">
                                            {r.user?.name || r.user?.username}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <Calendar size={12} className="text-indigo-400" />
                                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest truncate">
                                                    {new Date(r.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 self-end md:self-center">
                                    <div className="text-center md:text-right min-w-[140px]">
                                        <p className="text-[10px] font-black text-slate-900 tracking-tighter uppercase whitespace-nowrap">
                                            {isPlan ? `${new Date(r.metadata?.startDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} - ${new Date(r.metadata?.endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}` : `${r.metadata?.startTime || '08:00'} - ${r.metadata?.endTime || '17:00'} WIB`}
                                        </p>
                                        <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest">{isPlan ? 'PERIODE TARGET' : 'JAM AKTIVITAS'}</p>
                                    </div>
                                    <div className="px-3 py-1 rounded-full bg-slate-50 border border-slate-100 shadow-sm hidden md:block">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">{isPlan ? 'RENCANA' : 'HARIAN'}</p>
                                    </div>
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="p-8 pt-0 md:pl-20 border-t border-slate-50/50 bg-slate-50/30 animate-in slide-in-from-top-2 duration-300">
                                    <div className="pt-6 max-w-4xl space-y-6">
                                        {r.metadata?.title && isPlan && (
                                            <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-3xl">
                                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Judul Rencana</p>
                                                <h5 className="text-sm font-bold text-slate-700 uppercase">{r.metadata.title}</h5>
                                            </div>
                                        )}

                                        <div className="space-y-4">
                                            <h4 className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em] flex items-center gap-2 italic">📝 Rincian Aktivitas</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {(r.metadata?.items || []).map((it, iIdx) => (
                                                    <div key={iIdx} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-start justify-between gap-4 shadow-sm">
                                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                                            <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${it.status === 'SELESAI' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]'}`} />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-bold text-slate-700 leading-tight">{it.activity || it.name || it.text}</p>
                                                                {it.note && isNaN(it.note) && <p className="text-[10px] font-medium text-slate-400 italic mt-1.5 leading-relaxed">"{it.note}"</p>}
                                                            </div>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <p className={`text-[10px] font-black tracking-tighter ${it.status === 'SELESAI' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                                {it.percentage || 0}% {it.status}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        
                                        {(r.content || r.details) && (
                                            <div className="space-y-3">
                                                <h4 className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em] flex items-center gap-2 italic">📌 Memo Eksekutif</h4>
                                                <div className="bg-white/60 p-5 rounded-2xl border border-slate-100 text-xs text-slate-600 italic leading-relaxed whitespace-pre-wrap">
                                                    {r.content || (r.details?.split('📋')[1]?.split('📝 Catatan')[1]?.substring(1) || r.details)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );
};

export default StaffPerformance;

