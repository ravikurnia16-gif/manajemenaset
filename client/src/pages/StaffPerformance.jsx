import { useState, useEffect, Component } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Calendar, FileText, ClipboardList, Trophy, Plus, X, ChevronDown,
    ChevronUp, CheckSquare, Square, CheckCircle, Clock, Zap, AlertCircle,
    MapPin, Loader2, Target, Timer, TrendingUp, Sparkles, Users,
    Activity, Crown, Medal, Send, Trash2, RotateCcw, Tag,
    ShieldCheck, MessageSquare, ListChecks, Flag
} from 'lucide-react';
import api from '../lib/axios';

// ============================================
// ERROR BOUNDARY
// ============================================
class StaffPerformanceErrorBoundary extends Component {
    constructor(props) { super(props); this.state = { hasError: false, error: null }; }
    static getDerivedStateFromError(error) { return { hasError: true, error }; }
    componentDidCatch(error, info) { console.error('StaffPerformance crashed:', error, info); }
    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center p-8">
                    <div className="text-center max-w-md">
                        <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><AlertCircle size={32} className="text-rose-500" /></div>
                        <h2 className="text-xl font-black text-slate-800 mb-2">Terjadi Kesalahan</h2>
                        <pre className="text-xs text-slate-500 bg-slate-50 p-4 rounded-xl mb-4 text-left overflow-auto max-h-32">{this.state.error?.toString()}</pre>
                        <button onClick={() => { this.setState({ hasError: false }); window.location.reload(); }} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all">Muat Ulang</button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

// ============================================
// UTILITIES
// ============================================
const safeParseUser = () => { try { const r = localStorage.getItem('user'); if (!r) return {}; const p = JSON.parse(r); return p && typeof p === 'object' ? p : {}; } catch { return {}; } };
const fmtDate = (d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => { if (!d) return '-'; const dt = new Date(d); return isNaN(dt) ? '-' : dt.toLocaleDateString('id-ID', opts); };
const fmtTime = (d) => { if (!d) return ''; const dt = new Date(d); return isNaN(dt) ? '' : dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); };
const today = () => new Date().toISOString().split('T')[0];

// ============================================
// SHARED UI COMPONENTS
// ============================================
const Modal = ({ open, onClose, title, icon: Icon, children, wide }) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 bg-black/30 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
            <div className={`bg-white rounded-3xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-2xl'} animate-in zoom-in-95 fade-in duration-300 my-4`} onClick={e => e.stopPropagation()}>
                <div className="sticky top-0 bg-white/95 backdrop-blur-md px-6 py-5 border-b border-slate-100 flex items-center justify-between rounded-t-3xl z-10">
                    <div className="flex items-center gap-3">
                        {Icon && <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center"><Icon size={20} className="text-indigo-600" /></div>}
                        <h2 className="text-base font-black text-slate-900 uppercase italic tracking-tight">{title}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"><X size={20} /></button>
                </div>
                <div className="p-6">{children}</div>
            </div>
        </div>
    );
};

const ProgressRing = ({ pct = 0, size = 48, strokeWidth = 4 }) => {
    const r = (size - strokeWidth) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (circ * Math.min(pct, 100)) / 100;
    const color = pct >= 100 ? 'text-emerald-500' : pct > 50 ? 'text-indigo-500' : pct > 0 ? 'text-amber-500' : 'text-slate-200';
    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
                <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent" className="text-slate-100" />
                <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent" strokeDasharray={circ} strokeDashoffset={offset} className={`${color} transition-all duration-700 ease-out`} strokeLinecap="round" />
            </svg>
            <span className="absolute text-[10px] font-black text-slate-800 italic">{Math.round(pct)}%</span>
        </div>
    );
};

const EmptyState = ({ icon: Icon = FileText, message = 'Belum ada data' }) => (
    <div className="py-20 text-center">
        <Icon size={48} className="mx-auto text-slate-200 mb-4" />
        <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">{message}</p>
    </div>
);

const Badge = ({ children, className = '' }) => (
    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${className}`}>{children}</span>
);

const statusCfg = {
    'PENDING': { label: 'Menunggu', color: 'bg-amber-100 text-amber-700', icon: Clock },
    'IN_PROGRESS': { label: 'Proses', color: 'bg-indigo-100 text-indigo-700', icon: Zap },
    'COMPLETED': { label: 'Selesai', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
    'OVERDUE': { label: 'Terlambat', color: 'bg-rose-100 text-rose-700', icon: AlertCircle }
};
const priorityCfg = {
    'LOW': { label: 'Rendah', color: 'bg-slate-100 text-slate-500' },
    'MEDIUM': { label: 'Medium', color: 'bg-blue-50 text-blue-600' },
    'HIGH': { label: 'Tinggi', color: 'bg-rose-50 text-rose-600' },
    'URGENT': { label: 'Urgent', color: 'bg-rose-600 text-white' }
};

const ScoreBar = ({ label, score, color, icon: Icon }) => (
    <div className="space-y-2">
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg bg-opacity-10 ${color.replace('bg-', 'bg-')}`}><Icon size={12} className={color.replace('bg-', 'text-')} /></div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
            </div>
            <span className={`text-[11px] font-black ${color.replace('bg-', 'text-')}`}>{score}%</span>
        </div>
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full transition-all duration-1000 ease-out ${color} rounded-full`} style={{ width: `${score}%` }} />
        </div>
    </div>
);

// ============================================
// MAIN COMPONENT
// ============================================
const StaffPerformance = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const validTabs = ['RENCANA_TUGAS', 'RUTINITAS', 'LAPORAN', 'KPI'];
    const urlTab = searchParams.get('tab')?.toUpperCase();
    const initialTab = validTabs.includes(urlTab) ? urlTab : 'RENCANA_TUGAS';

    const [activeTab, setActiveTab] = useState(initialTab);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Data
    const [plans, setPlans] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [routineAssignments, setRoutineAssignments] = useState([]);
    const [routineTemplates, setRoutineTemplates] = useState([]);
    const [dailyLogs, setDailyLogs] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [staffList, setStaffList] = useState([]);

    // Modals
    const [showRencanaModal, setShowRencanaModal] = useState(false);
    const [showTugasModal, setShowTugasModal] = useState(false);
    const [showInsidentalModal, setShowInsidentalModal] = useState(false);
    const [showRutinitasModal, setShowRutinitasModal] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);

    // Filters
    const [filterStaff, setFilterStaff] = useState('ALL');
    const [filterPeriod, setFilterPeriod] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
    const [filterDate, setFilterDate] = useState({ start: '', end: '' });

    // Helper: filter data by date range
    const inDateRange = (dateStr) => {
        if (!filterDate.start && !filterDate.end) return true;
        if (!dateStr) return true;
        const d = new Date(dateStr).toISOString().split('T')[0];
        if (filterDate.start && d < filterDate.start) return false;
        if (filterDate.end && d > filterDate.end) return false;
        return true;
    };

    const user = safeParseUser();
    const userRole = user.role || '';
    const userPosition = typeof user.position === 'string' ? user.position : '';
    const isKabid = userRole === 'SUPER_ADMIN' || userPosition.includes('Kepala Bidang Sarana dan Prasarana');
    const isAdmin = ['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT'].includes(userRole) || isKabid;
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    const tabConfig = [
        { key: 'RENCANA_TUGAS', label: 'Rencana & Tugas', icon: ListChecks },
        { key: 'RUTINITAS', label: 'Rutinitas', icon: RotateCcw },
        { key: 'LAPORAN', label: 'Laporan', icon: FileText },
        { key: 'KPI', label: 'KPI', icon: Trophy, adminOnly: true },
    ];

    const changeTab = (t) => { setActiveTab(t); setSearchParams({ tab: t }); };

    useEffect(() => { if (urlTab && urlTab !== activeTab && validTabs.includes(urlTab)) setActiveTab(urlTab); }, [urlTab]);
    useEffect(() => { fetchStaff(); fetchRoutineTemplates(); }, []);
    useEffect(() => { fetchTabData(); }, [activeTab, filterStaff, filterPeriod]);

    const fetchStaff = async () => { try { const r = await api.get('/personnel/staff'); setStaffList(r.data || []); } catch {} };
    const fetchRoutineTemplates = async () => { try { const r = await api.get('/personnel/routines'); setRoutineTemplates(r.data || []); } catch {} };

    const fetchTabData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'RENCANA_TUGAS') { await fetchPlans(); await fetchAllAssignments(); }
            else if (activeTab === 'RUTINITAS') await fetchAllAssignments();
            else if (activeTab === 'LAPORAN') await fetchDailyLogs();
            else if (activeTab === 'KPI') await fetchKPI();
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const fetchPlans = async () => {
        const params = { type: 'WEEKLY', userId: filterStaff !== 'ALL' ? filterStaff : undefined };
        const res = await api.get('/personnel/reports', { params });
        const data = (Array.isArray(res.data) ? res.data : []).filter(r => r.metadata?.isPlan);
        setPlans(data);
    };

    const fetchAllAssignments = async () => {
        const params = { userId: filterStaff !== 'ALL' ? filterStaff : undefined };
        const res = await api.get('/personnel/assignments', { params });
        const all = res.data || [];
        setAssignments(all.filter(a => !a.routineId && !a.title?.startsWith('[RUTIN]')));
        setRoutineAssignments(all.filter(a => a.routineId || a.title?.startsWith('[RUTIN]')));
    };

    const fetchDailyLogs = async () => {
        const params = { type: 'DAILY', userId: filterStaff !== 'ALL' ? filterStaff : undefined, limit: 200 };
        const res = await api.get('/personnel/reports', { params });
        setDailyLogs(Array.isArray(res.data) ? res.data : []);
    };

    const fetchKPI = async () => {
        const res = await api.get(`/personnel/kpi-leaderboard?month=${filterPeriod.month}&year=${filterPeriod.year}`);
        setLeaderboard(res.data.leaderboard || []);
    };

    // --- HANDLERS ---
    const handleUpdateAssignment = async (id, data) => {
        try { await api.put(`/personnel/assignments/${id}/status`, data); await fetchAllAssignments(); } catch { alert('Gagal memperbarui'); }
    };

    const handleUpdatePlanItem = async (plan, itemIdx, updates) => {
        const updatedItems = [...(plan.metadata?.items || [])];
        updatedItems[itemIdx] = { ...updatedItems[itemIdx], ...updates };
        if (updates.percentage === 100) updatedItems[itemIdx].status = 'SELESAI';
        try {
            await api.put(`/personnel/reports/${plan.id}`, {
                type: plan.type, category: plan.category, content: plan.content,
                date: plan.date, metadata: { ...plan.metadata, items: updatedItems }
            });
            await fetchPlans();
        } catch { alert('Gagal memperbarui rencana'); }
    };

    const handleCreatePlan = async (formData) => {
        setSubmitting(true);
        try {
            const payload = {
                type: 'WEEKLY', category: 'UMUM', content: formData.notes || '',
                date: formData.startDate,
                metadata: {
                    isPlan: true, title: formData.title, startDate: formData.startDate, endDate: formData.endDate,
                    items: formData.items.filter(i => i.activity.trim()).map(i => ({ activity: i.activity, status: 'PENDING', percentage: 0 }))
                }
            };
            if (editingPlan) await api.put(`/personnel/reports/${editingPlan.id}`, payload);
            else await api.post('/personnel/reports', payload);
            setShowRencanaModal(false); setEditingPlan(null); await fetchPlans();
        } catch (err) { alert(err.response?.data?.error || 'Gagal menyimpan rencana'); }
        finally { setSubmitting(false); }
    };

    const handleCreateTask = async (formData) => {
        setSubmitting(true);
        try {
            await api.post('/personnel/assignments', {
                assigneeId: formData.assigneeId, title: formData.title, description: formData.notes || '',
                category: 'UMUM', priority: formData.priority, location: formData.location,
                startDate: formData.startDate, dueDate: formData.dueDate,
                items: formData.items.filter(i => i.text.trim()).map(i => ({ text: i.text, isDone: false, percentage: 0 }))
            });
            setShowTugasModal(false); await fetchAllAssignments();
        } catch (err) { alert(err.response?.data?.error || 'Gagal membuat tugas'); }
        finally { setSubmitting(false); }
    };

    const handleCreateInsidental = async (formData) => {
        setSubmitting(true);
        try {
            await api.post('/personnel/reports', {
                type: 'DAILY', category: 'UMUM', content: formData.activity, date: today(),
                metadata: { items: [{ activity: formData.activity, status: formData.status || 'SELESAI', percentage: formData.status === 'SELESAI' ? 100 : (formData.percentage || 50) }], startTime: formData.time }
            });
            setShowInsidentalModal(false); await fetchDailyLogs();
        } catch (err) { alert(err.response?.data?.error || 'Gagal menyimpan laporan'); }
        finally { setSubmitting(false); }
    };

    // --- RENDER ---
    return (
        <div className="p-4 md:p-8 bg-[#F8FAFC] min-h-screen pt-20 pb-24">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* ─── HEADER ─── */}
                <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 md:p-10 rounded-[32px] md:rounded-[48px] shadow-2xl shadow-indigo-200/20 relative overflow-hidden border border-white/5">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] -mr-48 -mt-48 animate-pulse" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] -ml-32 -mb-32" />
                    <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 md:w-16 md:h-16 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/10">
                                <TrendingUp className="text-indigo-400" size={28} />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter uppercase italic">
                                    Kinerja <span className="text-indigo-400">Staf</span>
                                </h1>
                                <p className="text-[10px] font-black text-indigo-300/50 tracking-[0.25em] uppercase mt-1">Monitoring & Performa Terintegrasi</p>
                            </div>
                        </div>
                        <div className="flex overflow-x-auto no-scrollbar items-center gap-1.5 bg-white/5 backdrop-blur-md p-1.5 rounded-2xl border border-white/10">
                            {tabConfig.filter(t => !t.adminOnly || isAdmin).map(tab => (
                                <button key={tab.key} onClick={() => changeTab(tab.key)}
                                    className={`shrink-0 px-4 md:px-5 py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all flex items-center gap-2 ${activeTab === tab.key ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                                    <tab.icon size={14} />{tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ─── TOOLBAR ─── */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-white/60 backdrop-blur-xl p-3 rounded-2xl border border-slate-200/50 shadow-sm">
                    <div className="flex items-center gap-3">
                        {isKabid && (
                            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-100 shadow-sm min-w-[180px]">
                                <Users size={14} className="text-indigo-400" />
                                <select className="bg-transparent border-none text-[10px] font-black text-slate-600 focus:ring-0 w-full cursor-pointer uppercase tracking-wider" value={filterStaff} onChange={e => setFilterStaff(e.target.value)}>
                                    <option value="ALL">Semua Staf</option>
                                    {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        )}
                        {activeTab === 'KPI' && (
                            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-100 shadow-sm">
                                <select className="bg-transparent border-none text-[10px] font-black text-slate-600 focus:ring-0 cursor-pointer uppercase tracking-wider" value={filterPeriod.month} onChange={e => setFilterPeriod({ ...filterPeriod, month: parseInt(e.target.value) })}>
                                    {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                                </select>
                                <select className="bg-transparent border-none text-[10px] font-black text-slate-600 focus:ring-0 cursor-pointer" value={filterPeriod.year} onChange={e => setFilterPeriod({ ...filterPeriod, year: parseInt(e.target.value) })}>
                                    {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        )}
                        {['RENCANA_TUGAS', 'RUTINITAS', 'LAPORAN'].includes(activeTab) && (
                            <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-xl border border-slate-100 shadow-sm">
                                <Calendar size={13} className="text-indigo-400 shrink-0" />
                                <input type="date" value={filterDate.start} onChange={e => setFilterDate({ ...filterDate, start: e.target.value })} className="bg-transparent border-none text-[10px] font-black text-slate-600 focus:ring-0 cursor-pointer w-[110px]" title="Dari tanggal" />
                                <span className="text-[9px] font-black text-slate-300">—</span>
                                <input type="date" value={filterDate.end} onChange={e => setFilterDate({ ...filterDate, end: e.target.value })} className="bg-transparent border-none text-[10px] font-black text-slate-600 focus:ring-0 cursor-pointer w-[110px]" title="Sampai tanggal" />
                                {(filterDate.start || filterDate.end) && (
                                    <button onClick={() => setFilterDate({ start: '', end: '' })} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-rose-500 transition-colors" title="Reset filter">
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {activeTab === 'RENCANA_TUGAS' && (
                            <>
                                <button onClick={() => { setEditingPlan(null); setShowRencanaModal(true); }} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-black tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2 active:scale-95">
                                    <Plus size={14} strokeWidth={3} />Rencana
                                </button>
                                {isKabid && (
                                    <button onClick={() => setShowTugasModal(true)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95">
                                        <Plus size={14} strokeWidth={3} />Tugas
                                    </button>
                                )}
                            </>
                        )}
                        {activeTab === 'RUTINITAS' && isAdmin && (
                            <button onClick={() => setShowRutinitasModal(true)} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2 active:scale-95">
                                <Plus size={14} strokeWidth={3} />Rutinitas
                            </button>
                        )}
                        {activeTab === 'LAPORAN' && (
                            <button onClick={() => setShowInsidentalModal(true)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95">
                                <Plus size={14} strokeWidth={3} />Insidental
                            </button>
                        )}
                    </div>
                </div>

                {/* ─── CONTENT ─── */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {loading ? (
                        <div className="py-32 flex flex-col items-center gap-4">
                            <Loader2 className="animate-spin text-indigo-500" size={40} />
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Memuat data...</p>
                        </div>
                    ) : (
                        <>
                            {activeTab === 'RENCANA_TUGAS' && <RencanaTugasTab plans={plans.filter(p => inDateRange(p.metadata?.startDate || p.date))} assignments={assignments.filter(a => inDateRange(a.startDate || a.createdAt))} onUpdatePlanItem={handleUpdatePlanItem} onUpdateAssignment={handleUpdateAssignment} onEditPlan={(p) => { setEditingPlan(p); setShowRencanaModal(true); }} userId={user.id} isKabid={isKabid} />}
                            {activeTab === 'RUTINITAS' && <RutinitasTab assignments={routineAssignments.filter(a => inDateRange(a.createdAt))} templates={routineTemplates} onUpdate={handleUpdateAssignment} userId={user.id} isKabid={isKabid} isAdmin={isAdmin} />}
                            {activeTab === 'LAPORAN' && <LaporanTab logs={dailyLogs.filter(l => inDateRange(l.date))} isKabid={isKabid} />}
                            {activeTab === 'KPI' && <KPITab leaderboard={leaderboard} />}
                        </>
                    )}
                </div>
            </div>

            {/* ─── MODALS ─── */}
            <RencanaFormModal open={showRencanaModal} onClose={() => { setShowRencanaModal(false); setEditingPlan(null); }} onSubmit={handleCreatePlan} submitting={submitting} editing={editingPlan} />
            <TugasFormModal open={showTugasModal} onClose={() => setShowTugasModal(false)} onSubmit={handleCreateTask} submitting={submitting} staffList={staffList} />
            <InsidentalFormModal open={showInsidentalModal} onClose={() => setShowInsidentalModal(false)} onSubmit={handleCreateInsidental} submitting={submitting} />
            <RutinitasFormModal open={showRutinitasModal} onClose={() => setShowRutinitasModal(false)} onSubmit={async (formData) => {
                setSubmitting(true);
                try {
                    await api.post('/personnel/routines', formData);
                    setShowRutinitasModal(false);
                    await fetchRoutineTemplates(); await fetchAllAssignments();
                } catch (err) { alert(err.response?.data?.error || 'Gagal membuat rutinitas'); }
                finally { setSubmitting(false); }
            }} submitting={submitting} />

            <style dangerouslySetInnerHTML={{ __html: `.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}` }} />
        </div>
    );
};

// ============================================
// TAB: RENCANA & TUGAS (COMBINED)
// ============================================
const RencanaTugasTab = ({ plans, assignments, onUpdatePlanItem, onUpdateAssignment, onEditPlan, userId, isKabid }) => {
    const [expanded, setExpanded] = useState([]);
    const toggle = id => setExpanded(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);

    const totalItems = plans.length + assignments.length;

    return (
        <div className="space-y-8">
            {totalItems === 0 && <EmptyState icon={ListChecks} message="Belum ada rencana atau tugas" />}

            {/* ── SECTION: RENCANA ── */}
            {plans.length > 0 && (
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white"><Calendar size={14} /></div>
                        <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Rencana Kerja</h3>
                        <Badge className="bg-indigo-100 text-indigo-600">{plans.length}</Badge>
                    </div>
                    <div className="space-y-3">
                        {plans.map(plan => {
                            const items = plan.metadata?.items || [];
                            const completed = items.filter(i => i.percentage === 100 || i.status === 'SELESAI').length;
                            const pct = items.length > 0 ? Math.round((completed / items.length) * 100) : 0;
                            const isOpen = expanded.includes(`plan-${plan.id}`);
                            return (
                                <div key={plan.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
                                    <div className="p-5 flex items-center justify-between cursor-pointer gap-4" onClick={() => toggle(`plan-${plan.id}`)}>
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <ProgressRing pct={pct} size={52} />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Badge className={pct === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                                                        {pct === 100 ? 'Selesai' : 'Berjalan'}
                                                    </Badge>
                                                    <Badge className="bg-indigo-50 text-indigo-500">Rencana</Badge>
                                                    {isKabid && <span className="text-[9px] font-bold text-slate-400 uppercase">{plan.user?.name}</span>}
                                                </div>
                                                <h3 className="text-sm font-black text-slate-800 uppercase italic truncate">{plan.metadata?.title || 'Rencana Kerja'}</h3>
                                                <p className="text-[10px] font-bold text-slate-400 mt-0.5 flex items-center gap-2">
                                                    <Calendar size={11} className="text-indigo-400" />
                                                    {fmtDate(plan.metadata?.startDate, { day: '2-digit', month: 'short' })} – {fmtDate(plan.metadata?.endDate, { day: '2-digit', month: 'short' })}
                                                    <span className="text-slate-300">•</span>
                                                    <span>{completed}/{items.length} item</span>
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={e => { e.stopPropagation(); onEditPlan(plan); }} className="p-2 hover:bg-indigo-50 rounded-lg text-slate-300 hover:text-indigo-600 transition-all"><FileText size={16} /></button>
                                            <div className={`p-2 rounded-xl transition-all ${isOpen ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </div>
                                        </div>
                                    </div>
                                    {isOpen && (
                                        <div className="border-t border-slate-50 p-5 bg-slate-50/40 space-y-2 animate-in slide-in-from-top-2 duration-200">
                                            {items.map((item, idx) => (
                                                <PlanItem key={idx} item={item} idx={idx} onUpdate={(updates) => onUpdatePlanItem(plan, idx, updates)} isKabid={isKabid} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── SECTION: TUGAS DARI KABID ── */}
            {assignments.length > 0 && (
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-emerald-600 rounded-xl flex items-center justify-center text-white"><ClipboardList size={14} /></div>
                        <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Tugas dari Pimpinan</h3>
                        <Badge className="bg-emerald-100 text-emerald-600">{assignments.length}</Badge>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        {assignments.map((a, idx) => {
                            const isOpen = expanded.includes(`task-${a.id}`);
                            const sc = statusCfg[a.status] || statusCfg.PENDING;
                            const pc = priorityCfg[a.priority] || priorityCfg.MEDIUM;
                            const isAssignee = a.assigneeId === userId;
                            return (
                                <div key={a.id} className={`border-b border-slate-50 ${idx % 2 ? 'bg-slate-50/30' : ''} transition-all`}>
                                    <div className="p-4 md:p-5 flex items-center gap-4 cursor-pointer" onClick={() => toggle(`task-${a.id}`)}>
                                        <ProgressRing pct={a.progressPercentage || 0} size={44} />
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <Badge className={pc.color}>{pc.label}</Badge>
                                                <Badge className={sc.color}>{sc.label}</Badge>
                                                <Badge className="bg-emerald-50 text-emerald-500">Tugas</Badge>
                                            </div>
                                            <h3 className="text-sm font-black text-slate-800 italic uppercase truncate">{a.title}</h3>
                                            <div className="flex flex-wrap items-center gap-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                                <span className="flex items-center gap-1"><Users size={11} className="text-indigo-400" />{a.assignee?.name}</span>
                                                {a.location && <span className="flex items-center gap-1"><MapPin size={11} />{a.location}</span>}
                                                {a.dueDate && <span className="flex items-center gap-1"><Clock size={11} />{fmtDate(a.dueDate, { day: '2-digit', month: 'short' })}</span>}
                                            </div>
                                        </div>
                                        <div className={`p-2 rounded-xl transition-all ${isOpen ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </div>
                                    </div>
                                    {isOpen && (
                                        <TaskChecklist assignment={a} onUpdate={onUpdateAssignment} isAssignee={isAssignee} isAdmin={isKabid} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

const PlanItem = ({ item, idx, onUpdate, isKabid }) => {
    const [localPct, setLocalPct] = useState(item.percentage || 0);
    const [editing, setEditing] = useState(false);
    useEffect(() => setLocalPct(item.percentage || 0), [item.percentage]);
    const isDone = localPct === 100 || item.status === 'SELESAI';

    const commit = (pct) => {
        const clamped = Math.min(100, Math.max(0, pct));
        setLocalPct(clamped);
        if (clamped !== (item.percentage || 0)) onUpdate({ percentage: clamped, status: clamped === 100 ? 'SELESAI' : clamped > 0 ? 'PROSES' : 'PENDING' });
        setEditing(false);
    };
    const toggleDone = () => {
        const newPct = isDone ? 0 : 100;
        setLocalPct(newPct);
        onUpdate({ percentage: newPct, status: newPct === 100 ? 'SELESAI' : 'PENDING' });
    };

    const pctColor = isDone ? 'bg-emerald-500' : localPct > 50 ? 'bg-indigo-500' : localPct > 0 ? 'bg-amber-500' : 'bg-slate-200';

    return (
        <div className={`p-3 rounded-xl border transition-all ${isDone ? 'bg-emerald-50/50 border-emerald-100' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center gap-3">
                <button onClick={toggleDone} className={`shrink-0 transition-all active:scale-90 ${isDone ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-400'}`}>
                    {isDone ? <CheckSquare size={20} /> : <Square size={20} />}
                </button>
                <span className={`flex-1 text-xs font-bold min-w-0 ${isDone ? 'text-emerald-700 line-through decoration-emerald-200' : 'text-slate-700'}`}>{item.activity}</span>
                {!isKabid && !editing ? (
                    <button onClick={() => setEditing(true)} className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${isDone ? 'bg-emerald-100 text-emerald-700' : localPct > 0 ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                        {localPct}%
                    </button>
                ) : isKabid ? (
                    <span className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black ${isDone ? 'bg-emerald-100 text-emerald-700' : localPct > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>{localPct}%</span>
                ) : null}
            </div>
            {/* Progress bar */}
            <div className="mt-2 ml-8 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${pctColor} rounded-full transition-all duration-500`} style={{ width: `${localPct}%` }} />
            </div>
            {/* Inline editor */}
            {editing && !isKabid && (
                <div className="mt-3 ml-8 flex items-center gap-3 p-2 bg-slate-50 rounded-xl border border-slate-100 animate-in fade-in duration-200">
                    <input type="range" min="0" max="100" step="5" value={localPct} onChange={e => setLocalPct(parseInt(e.target.value))}
                        className="flex-1 h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600" />
                    <input type="number" min="0" max="100" step="5" value={localPct} onChange={e => setLocalPct(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                        className="w-14 px-2 py-1 text-center text-[11px] font-black text-indigo-700 bg-white border border-indigo-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-200" />
                    <span className="text-[10px] font-black text-slate-400">%</span>
                    <button onClick={() => commit(localPct)} className="px-3 py-1 bg-indigo-600 text-white text-[8px] font-black rounded-lg hover:bg-indigo-700 transition-all uppercase tracking-widest">
                        Simpan
                    </button>
                    <button onClick={() => { setLocalPct(item.percentage || 0); setEditing(false); }} className="p-1 text-slate-400 hover:text-rose-500 transition-colors">
                        <X size={14} />
                    </button>
                </div>
            )}
        </div>
    );
};

const TaskChecklist = ({ assignment, onUpdate, isAssignee, isAdmin }) => {
    const [newText, setNewText] = useState('');
    const [editingIdx, setEditingIdx] = useState(null);
    const [localPct, setLocalPct] = useState(0);
    const items = Array.isArray(assignment.items) ? assignment.items : [];

    const updateItemProgress = async (idx, pct) => {
        const newItems = [...items];
        const clamped = Math.min(100, Math.max(0, pct));
        newItems[idx] = { ...newItems[idx], percentage: clamped, isDone: clamped === 100 };
        
        // Calculate new overall average progress
        const avgPct = Math.round(newItems.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / newItems.length);
        const allDone = newItems.every(i => i.isDone);
        
        await onUpdate(assignment.id, { 
            items: newItems, 
            status: allDone ? 'COMPLETED' : avgPct > 0 ? 'IN_PROGRESS' : 'PENDING', 
            progressPercentage: avgPct 
        });
        setEditingIdx(null);
    };

    const toggleItem = async (idx) => {
        const item = items[idx];
        const newPct = item.isDone ? 0 : 100;
        await updateItemProgress(idx, newPct);
    };

    const addItem = async () => {
        if (!newText.trim()) return;
        const newItems = [...items, { text: newText.trim(), isDone: false, percentage: 0 }];
        await onUpdate(assignment.id, { items: newItems, status: 'IN_PROGRESS' });
        setNewText('');
    };

    return (
        <div className="border-t border-slate-50 p-5 bg-slate-50/30 space-y-3 animate-in slide-in-from-top-2 duration-200">
            {assignment.description && (
                <div className="bg-white p-4 rounded-xl border border-slate-100 text-xs text-slate-600 italic">{assignment.description}</div>
            )}
            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">✅ Checklist Pekerjaan</p>
            <div className="space-y-2">
                {items.map((item, idx) => {
                    const isDone = item.isDone || item.percentage === 100;
                    const pct = item.percentage || 0;
                    const isEditing = editingIdx === idx;
                    const barColor = isDone ? 'bg-emerald-500' : pct > 50 ? 'bg-indigo-500' : pct > 0 ? 'bg-amber-500' : 'bg-slate-200';

                    return (
                        <div key={idx} className={`p-3 rounded-xl border transition-all ${isDone ? 'bg-emerald-50/50 border-emerald-100' : 'bg-white border-slate-100'}`}>
                            <div className="flex items-center gap-3">
                                <button onClick={() => (isAssignee || isAdmin) && toggleItem(idx)} className={`shrink-0 transition-all active:scale-90 ${isDone ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-400'}`}>
                                    {isDone ? <CheckSquare size={20} /> : <Square size={20} />}
                                </button>
                                <span className={`flex-1 text-xs font-bold ${isDone ? 'text-emerald-700 line-through decoration-emerald-200' : 'text-slate-700'}`}>{item.text}</span>
                                
                                {!isAdmin && isAssignee && !isEditing ? (
                                    <button onClick={() => setEditingIdx(idx) || setLocalPct(pct)} className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${isDone ? 'bg-emerald-100 text-emerald-700' : pct > 0 ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                        {pct}%
                                    </button>
                                ) : (
                                    <span className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black ${isDone ? 'bg-emerald-100 text-emerald-700' : pct > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>{pct}%</span>
                                )}
                            </div>
                            
                            {/* Progress bar */}
                            <div className="mt-2 ml-8 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                            </div>

                            {/* Inline Editor */}
                            {isEditing && (
                                <div className="mt-3 ml-8 flex items-center gap-3 p-2 bg-slate-50 rounded-xl border border-slate-100 animate-in fade-in duration-200">
                                    <input type="range" min="0" max="100" step="5" value={localPct} onChange={e => setLocalPct(parseInt(e.target.value))}
                                        className="flex-1 h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600" />
                                    <input type="number" min="0" max="100" step="1" value={localPct} onChange={e => setLocalPct(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                                        className="w-14 px-2 py-1 text-center text-[11px] font-black text-indigo-700 bg-white border border-indigo-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-200" />
                                    <button onClick={() => updateItemProgress(idx, localPct)} className="px-3 py-1 bg-indigo-600 text-white text-[8px] font-black rounded-lg hover:bg-indigo-700 transition-all uppercase tracking-widest">OK</button>
                                    <button onClick={() => setEditingIdx(null)} className="p-1 text-slate-400 hover:text-rose-500 transition-colors"><X size={14} /></button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {(isAssignee || isAdmin) && (
                <div className="flex gap-2 p-3 bg-white/50 rounded-xl border border-dashed border-slate-200">
                    <input type="text" value={newText} onChange={e => setNewText(e.target.value)} placeholder="Tambah tahapan pekerjaan..." className="flex-1 bg-transparent border-none text-[10px] font-bold text-slate-700 outline-none placeholder:text-slate-300"
                        onKeyDown={e => e.key === 'Enter' && addItem()} />
                    <button onClick={addItem} disabled={!newText.trim()} className="px-3 py-1 bg-indigo-600 text-white text-[8px] font-black rounded-lg hover:bg-indigo-700 disabled:opacity-30 transition-all uppercase tracking-widest">Tambah</button>
                </div>
            )}
        </div>
    );
};

// ============================================
// TAB: RUTINITAS
// ============================================
const RutinitasTab = ({ assignments, templates, onUpdate, userId, isKabid, isAdmin }) => {
    const [expanded, setExpanded] = useState([]);
    const toggle = id => setExpanded(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);

    const freqMap = {};
    templates.forEach(t => { freqMap[t.id] = t.frequency || 'DAILY'; });
    const getFreq = a => freqMap[a.routineId] || 'DAILY';
    const freqLabel = { DAILY: 'Harian', WEEKLY: 'Mingguan', MONTHLY: 'Bulanan' };
    const freqColor = { DAILY: 'bg-blue-100 text-blue-700', WEEKLY: 'bg-purple-100 text-purple-700', MONTHLY: 'bg-teal-100 text-teal-700' };

    // Filter: Kabid sees all, Admin Aset / staff sees only their own
    const filtered = isKabid ? assignments : assignments.filter(a => a.assigneeId === userId);

    if (filtered.length === 0) return <EmptyState icon={RotateCcw} message="Belum ada rutinitas aktif" />;

    // Group by frequency
    const grouped = { DAILY: [], WEEKLY: [], MONTHLY: [] };
    filtered.forEach(a => { const f = getFreq(a); (grouped[f] || grouped.DAILY).push(a); });

    return (
        <div className="space-y-6">
            {Object.entries(grouped).filter(([, list]) => list.length > 0).map(([freq, list]) => (
                <div key={freq}>
                    <div className="flex items-center gap-2 mb-3">
                        <RotateCcw size={14} className="text-indigo-400" />
                        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{freqLabel[freq]}</h3>
                        <Badge className={freqColor[freq]}>{list.length}</Badge>
                    </div>
                    <div className="space-y-3">
                        {list.map(a => {
                            const items = Array.isArray(a.items) ? a.items : [];
                            const done = items.filter(i => i.isDone).length;
                            const pct = items.length > 0 ? Math.round(done / items.length * 100) : (a.progressPercentage || 0);
                            const isOpen = expanded.includes(a.id);
                            const isAssignee = a.assigneeId === userId;
                            return (
                                <div key={a.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                    <div className="p-4 flex items-center gap-4 cursor-pointer" onClick={() => toggle(a.id)}>
                                        <ProgressRing pct={pct} size={44} />
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-black text-slate-800 italic uppercase truncate">{a.title.replace('[RUTIN] ', '')}</h4>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {isKabid && a.assignee && <span className="text-[9px] font-black text-indigo-500 uppercase">{a.assignee.name}</span>}
                                                <p className="text-[10px] font-bold text-slate-400">{done}/{items.length} selesai • {fmtDate(a.createdAt, { day: '2-digit', month: 'short' })}</p>
                                            </div>
                                        </div>
                                        <Badge className={pct === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>{pct === 100 ? 'Lunas' : 'Aktif'}</Badge>
                                        <div className={`p-1.5 rounded-lg transition-all ${isOpen ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                            {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </div>
                                    </div>
                                    {isOpen && (
                                        <TaskChecklist assignment={a} onUpdate={onUpdate} isAssignee={isAssignee} isAdmin={isKabid} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

// ============================================
// TAB: LAPORAN HARIAN
// ============================================
const LaporanTab = ({ logs, isKabid }) => {
    // Group logs by date
    const grouped = {};
    logs.forEach(l => {
        const dateKey = new Date(l.date).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(l);
    });

    const sourceTag = (log) => {
        if (log.metadata?.autoLog) {
            const src = log.metadata.source;
            const colors = { RENCANA: 'bg-indigo-100 text-indigo-700', TUGAS: 'bg-emerald-100 text-emerald-700', RUTINITAS: 'bg-blue-100 text-blue-700' };
            return <Badge className={colors[src] || 'bg-slate-100 text-slate-600'}>{src}</Badge>;
        }
        if (log.category === 'AUTO_LOG') return <Badge className="bg-slate-100 text-slate-500">Sistem</Badge>;
        return <Badge className="bg-amber-100 text-amber-700">Insidental</Badge>;
    };

    if (logs.length === 0) return <EmptyState icon={FileText} message="Belum ada laporan harian" />;

    return (
        <div className="space-y-6">
            {Object.entries(grouped).map(([date, entries]) => (
                <div key={date}>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white"><Calendar size={14} /></div>
                        <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{date}</h3>
                        <Badge className="bg-slate-100 text-slate-400">{entries.length}</Badge>
                    </div>
                    <div className="relative pl-10 border-l-2 border-slate-100 space-y-3 ml-4">
                        {entries.map(log => (
                            <div key={log.id} className="relative">
                                <div className="absolute -left-[1.35rem] top-4 w-2.5 h-2.5 rounded-full bg-white border-2 border-indigo-300" />
                                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                                    <div className="flex items-center gap-2 mb-2">
                                        {sourceTag(log)}
                                        <span className="text-[9px] font-bold text-slate-300 tracking-wider">{fmtTime(log.metadata?.timestamp || log.createdAt)}</span>
                                        {isKabid && log.user && <span className="text-[9px] font-black text-indigo-500 uppercase">{log.user.name}</span>}
                                    </div>
                                    <p className="text-xs font-bold text-slate-700 leading-relaxed">{log.content || log.metadata?.sourceTitle || '-'}</p>
                                    {log.metadata?.progressPercentage !== undefined && (
                                        <div className="mt-2 flex items-center gap-2">
                                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${log.metadata.progressPercentage}%` }} />
                                            </div>
                                            <span className="text-[9px] font-black text-indigo-600">{log.metadata.progressPercentage}%</span>
                                        </div>
                                    )}
                                    {/* Insidental items */}
                                    {!log.metadata?.autoLog && log.metadata?.items && (
                                        <div className="mt-2 space-y-1">
                                            {log.metadata.items.map((it, i) => (
                                                <div key={i} className="flex items-center gap-2 text-[10px] text-slate-500">
                                                    <CheckCircle size={12} className={it.status === 'SELESAI' ? 'text-emerald-500' : 'text-slate-300'} />
                                                    <span className="font-bold">{it.activity}</span>
                                                    <Badge className={it.status === 'SELESAI' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}>{it.status}</Badge>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

// ============================================
// TAB: KPI
// ============================================
const KPITab = ({ leaderboard }) => {
    if (leaderboard.length === 0) return <EmptyState icon={Trophy} message="Belum ada data penilaian" />;

    const RankIcon = ({ rank }) => {
        if (rank === 0) return <Crown className="text-amber-400 drop-shadow-lg" size={28} />;
        if (rank === 1) return <Medal className="text-slate-400 drop-shadow" size={24} />;
        if (rank === 2) return <Medal className="text-amber-700/60" size={20} />;
        return <span className="text-sm font-black text-slate-300 italic">#{rank + 1}</span>;
    };

    return (
        <div className="space-y-8">
            {/* Top 3 Podium */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {leaderboard.slice(0, 3).map((item, idx) => (
                    <div key={item.userId} className={`bg-white rounded-3xl p-8 shadow-lg transition-all hover:scale-[1.02] border-2 ${idx === 0 ? 'border-amber-200 ring-4 ring-amber-50' : 'border-slate-100'}`}>
                        <div className="flex justify-between items-start mb-8">
                            <RankIcon rank={idx} />
                            <div className={`px-4 py-1.5 rounded-xl text-[11px] font-black ${item.grade === 'A' ? 'bg-indigo-600 text-white' : item.grade === 'B' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-white'}`}>Grade {item.grade}</div>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 italic uppercase tracking-tight mb-1">{item.name}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">{item.position || 'Staf Sarpras'}</p>
                        <div className="space-y-4">
                            <ScoreBar label="Penyelesaian" score={item.scores.completion} color="bg-indigo-500" icon={Target} />
                            <ScoreBar label="Ketepatan" score={item.scores.punctuality} color="bg-emerald-500" icon={Timer} />
                            <ScoreBar label="Insidental" score={item.scores.insidental || item.scores.report || 0} color="bg-amber-500" icon={Activity} />
                        </div>
                        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                            <div>
                                <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Skor Total</p>
                                <p className="text-4xl font-black text-slate-900 italic tracking-tighter">{item.averageScore}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] font-black text-slate-400 uppercase">{item.stats.total} Tugas</p>
                                <p className="text-[9px] font-bold text-slate-300">{item.stats.completed} Selesai</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {/* Remaining leaderboard */}
            {leaderboard.length > 3 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-3 bg-slate-50 border-b border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Peringkat Lainnya</p>
                    </div>
                    {leaderboard.slice(3).map((item, idx) => (
                        <div key={item.userId} className="flex items-center gap-5 px-6 py-4 border-b border-slate-50 hover:bg-slate-50/50 transition-all">
                            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-xs font-black text-slate-300 italic">#{idx + 4}</div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-black text-slate-700 uppercase italic truncate">{item.name}</h4>
                                <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">{item.position}</p>
                            </div>
                            <div className="text-center w-20">
                                <p className="text-lg font-black text-slate-800 tracking-tighter italic">{item.averageScore}</p>
                                <p className="text-[8px] font-black text-slate-300 uppercase">Score</p>
                            </div>
                            <div className={`px-3 py-1 rounded-lg text-[10px] font-black ${item.grade === 'A' ? 'bg-indigo-100 text-indigo-700' : item.grade === 'B' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                {item.grade}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ============================================
// FORM MODALS
// ============================================
const RencanaFormModal = ({ open, onClose, onSubmit, submitting, editing }) => {
    const [title, setTitle] = useState('');
    const [startDate, setStartDate] = useState(today());
    const [endDate, setEndDate] = useState(today());
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState([{ activity: '' }]);

    useEffect(() => {
        if (editing) {
            setTitle(editing.metadata?.title || '');
            setStartDate(editing.metadata?.startDate || today());
            setEndDate(editing.metadata?.endDate || today());
            setNotes(editing.content || '');
            setItems(editing.metadata?.items?.map(i => ({ activity: i.activity || '' })) || [{ activity: '' }]);
        } else {
            setTitle(''); setStartDate(today()); setEndDate(today()); setNotes(''); setItems([{ activity: '' }]);
        }
    }, [editing, open]);

    const addItem = () => setItems([...items, { activity: '' }]);
    const removeItem = idx => setItems(items.filter((_, i) => i !== idx));
    const updateItem = (idx, val) => { const n = [...items]; n[idx].activity = val; setItems(n); };

    const submit = e => {
        e.preventDefault();
        if (!title.trim()) return alert('Judul rencana wajib diisi');
        if (items.filter(i => i.activity.trim()).length === 0) return alert('Minimal satu item rencana');
        onSubmit({ title, startDate, endDate, notes, items });
    };

    return (
        <Modal open={open} onClose={onClose} title={editing ? 'Edit Rencana Kerja' : 'Buat Rencana Kerja'} icon={Calendar}>
            <form onSubmit={submit} className="space-y-5">
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">📝 Judul Rencana</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Misal: Perbaikan Pagar Gedung B"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-200 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">📅 Mulai</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-200 outline-none" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">📅 Selesai</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-200 outline-none" />
                    </div>
                </div>
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">📋 Checklist Item Rencana</label>
                    <div className="space-y-2">
                        {items.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-300 w-6 text-center">{idx + 1}.</span>
                                <input type="text" value={item.activity} onChange={e => updateItem(idx, e.target.value)} placeholder="Deskripsikan tahapan kerja..."
                                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-200 outline-none" />
                                {items.length > 1 && <button type="button" onClick={() => removeItem(idx)} className="p-2 text-rose-300 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>}
                            </div>
                        ))}
                        <button type="button" onClick={addItem} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:text-indigo-500 hover:border-indigo-200 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest">
                            <Plus size={14} />Tambah Item
                        </button>
                    </div>
                </div>
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">📝 Catatan</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Catatan tambahan..."
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-200 outline-none" />
                </div>
                <button type="submit" disabled={submitting} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black tracking-widest hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
                    {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    {submitting ? 'Menyimpan...' : editing ? 'Perbarui Rencana' : 'Simpan Rencana'}
                </button>
            </form>
        </Modal>
    );
};

const TugasFormModal = ({ open, onClose, onSubmit, submitting, staffList }) => {
    const [title, setTitle] = useState('');
    const [assigneeId, setAssigneeId] = useState('');
    const [priority, setPriority] = useState('MEDIUM');
    const [startDate, setStartDate] = useState(today());
    const [dueDate, setDueDate] = useState('');
    const [location, setLocation] = useState('');
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState([{ text: '' }]);

    useEffect(() => {
        if (open) { setTitle(''); setAssigneeId(''); setPriority('MEDIUM'); setStartDate(today()); setDueDate(''); setLocation(''); setNotes(''); setItems([{ text: '' }]); }
    }, [open]);

    const addItem = () => setItems([...items, { text: '' }]);
    const removeItem = idx => setItems(items.filter((_, i) => i !== idx));
    const updateItem = (idx, val) => { const n = [...items]; n[idx].text = val; setItems(n); };

    const submit = e => {
        e.preventDefault();
        if (!title.trim()) return alert('Judul tugas wajib diisi');
        if (!assigneeId) return alert('Pilih staf penerima tugas');
        onSubmit({ title, assigneeId, priority, startDate, dueDate, location, notes, items });
    };

    return (
        <Modal open={open} onClose={onClose} title="Buat Penugasan Baru" icon={ClipboardList} wide>
            <form onSubmit={submit} className="space-y-5">
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">📝 Judul Tugas</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Misal: Pengecekan Panel Listrik Utama"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-200 outline-none" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">👤 Penerima Tugas</label>
                        <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-200 outline-none uppercase">
                            <option value="">Pilih Staf</option>
                            {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">⚡ Prioritas</label>
                        <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-200 outline-none">
                            <option value="LOW">Rendah</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HIGH">Tinggi</option>
                            <option value="URGENT">Urgent</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">📍 Lokasi</label>
                        <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Gedung A Lt.1" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-200 outline-none" />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">📅 Mulai</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-200 outline-none" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">📅 Deadline</label>
                        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-200 outline-none" />
                    </div>
                </div>
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">📋 Checklist Pekerjaan</label>
                    <div className="space-y-2">
                        {items.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-300 w-6 text-center">{idx + 1}.</span>
                                <input type="text" value={item.text} onChange={e => updateItem(idx, e.target.value)} placeholder="Deskripsikan langkah pekerjaan..."
                                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-200 outline-none" />
                                {items.length > 1 && <button type="button" onClick={() => removeItem(idx)} className="p-2 text-rose-300 hover:text-rose-500"><Trash2 size={16} /></button>}
                            </div>
                        ))}
                        <button type="button" onClick={addItem} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:text-indigo-500 hover:border-indigo-200 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest">
                            <Plus size={14} />Tambah Item
                        </button>
                    </div>
                </div>
                <button type="submit" disabled={submitting} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black tracking-widest hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
                    {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    {submitting ? 'Mengirim...' : 'Delegasikan Tugas'}
                </button>
            </form>
        </Modal>
    );
};

const InsidentalFormModal = ({ open, onClose, onSubmit, submitting }) => {
    const [activity, setActivity] = useState('');
    const [status, setStatus] = useState('SELESAI');
    const [time, setTime] = useState(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));

    useEffect(() => {
        if (open) { setActivity(''); setStatus('SELESAI'); setTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })); }
    }, [open]);

    const submit = e => {
        e.preventDefault();
        if (!activity.trim()) return alert('Isi deskripsi aktivitas');
        onSubmit({ activity, status, time });
    };

    return (
        <Modal open={open} onClose={onClose} title="Laporan Insidental" icon={Flag}>
            <form onSubmit={submit} className="space-y-5">
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">📝 Apa yang dikerjakan?</label>
                    <textarea value={activity} onChange={e => setActivity(e.target.value)} rows={3} placeholder="Misal: Perbaikan AC bocor di Ruang Kepala" autoFocus
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-200 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">🕒 Jam</label>
                        <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-200 outline-none" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">📊 Status</label>
                        <select value={status} onChange={e => setStatus(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-200 outline-none">
                            <option value="SELESAI">Selesai</option>
                            <option value="PROSES">Sedang Dikerjakan</option>
                            <option value="PENDING">Menunggu</option>
                        </select>
                    </div>
                </div>
                <button type="submit" disabled={submitting} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black tracking-widest hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
                    {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    {submitting ? 'Menyimpan...' : 'Simpan Laporan'}
                </button>
            </form>
        </Modal>
    );
};

// ============================================
// FORM MODAL: RUTINITAS
// ============================================
const RutinitasFormModal = ({ open, onClose, onSubmit, submitting }) => {
    const [title, setTitle] = useState('');
    const [frequency, setFrequency] = useState('DAILY');
    const [dayOfWeek, setDayOfWeek] = useState(1);
    const [dayOfMonth, setDayOfMonth] = useState(1);
    const [priority, setPriority] = useState('MEDIUM');
    const [location, setLocation] = useState('');
    const [description, setDescription] = useState('');
    const [items, setItems] = useState([{ text: '' }]);

    useEffect(() => {
        if (open) { setTitle(''); setFrequency('DAILY'); setDayOfWeek(1); setDayOfMonth(1); setPriority('MEDIUM'); setLocation(''); setDescription(''); setItems([{ text: '' }]); }
    }, [open]);

    const addItem = () => setItems([...items, { text: '' }]);
    const removeItem = idx => setItems(items.filter((_, i) => i !== idx));
    const updateItem = (idx, val) => { const n = [...items]; n[idx].text = val; setItems(n); };

    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    const submit = e => {
        e.preventDefault();
        if (!title.trim()) return alert('Judul rutinitas wajib diisi');
        onSubmit({
            title, frequency, priority, location,
            description,
            dayOfWeek: frequency === 'WEEKLY' ? parseInt(dayOfWeek) : undefined,
            dayOfMonth: frequency === 'MONTHLY' ? parseInt(dayOfMonth) : undefined,
            items: items.filter(i => i.text.trim()).map(i => ({ text: i.text, isDone: false }))
        });
    };

    return (
        <Modal open={open} onClose={onClose} title="Buat Rutinitas Baru" icon={RotateCcw} wide>
            <form onSubmit={submit} className="space-y-5">
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">📝 Judul Rutinitas</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Misal: Pengecekan Panel Listrik Harian"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-200 outline-none" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">🔄 Frekuensi</label>
                        <select value={frequency} onChange={e => setFrequency(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-200 outline-none">
                            <option value="DAILY">Harian</option>
                            <option value="WEEKLY">Mingguan</option>
                            <option value="MONTHLY">Bulanan</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">⚡ Prioritas</label>
                        <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-200 outline-none">
                            <option value="LOW">Rendah</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HIGH">Tinggi</option>
                        </select>
                    </div>
                </div>
                {frequency === 'WEEKLY' && (
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">📅 Hari Pelaksanaan</label>
                        <select value={dayOfWeek} onChange={e => setDayOfWeek(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-200 outline-none">
                            {days.map((d, i) => <option key={i} value={i}>{d}</option>)}
                        </select>
                    </div>
                )}
                {frequency === 'MONTHLY' && (
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">📅 Tanggal Pelaksanaan</label>
                        <select value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-200 outline-none">
                            {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>Tanggal {d}</option>)}
                        </select>
                    </div>
                )}
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">📍 Lokasi</label>
                    <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Gedung A Lt.1"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-200 outline-none" />
                </div>
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">📋 Checklist Pekerjaan</label>
                    <div className="space-y-2">
                        {items.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-300 w-6 text-center">{idx + 1}.</span>
                                <input type="text" value={item.text} onChange={e => updateItem(idx, e.target.value)} placeholder="Deskripsikan langkah pekerjaan..."
                                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-200 outline-none" />
                                {items.length > 1 && <button type="button" onClick={() => removeItem(idx)} className="p-2 text-rose-300 hover:text-rose-500"><Trash2 size={16} /></button>}
                            </div>
                        ))}
                        <button type="button" onClick={addItem} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:text-indigo-500 hover:border-indigo-200 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest">
                            <Plus size={14} />Tambah Item
                        </button>
                    </div>
                </div>
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">📝 Catatan</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Catatan tambahan..."
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-200 outline-none" />
                </div>
                <button type="submit" disabled={submitting} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black tracking-widest hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
                    {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    {submitting ? 'Menyimpan...' : 'Simpan Rutinitas'}
                </button>
            </form>
        </Modal>
    );
};

// ============================================
// EXPORT
// ============================================
const StaffPerformanceWithBoundary = () => (
    <StaffPerformanceErrorBoundary>
        <StaffPerformance />
    </StaffPerformanceErrorBoundary>
);

export default StaffPerformanceWithBoundary;
