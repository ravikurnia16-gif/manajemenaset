import { useState, useEffect, Component } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Calendar, FileText, ClipboardList, Trophy, Plus, X, ChevronDown,
    ChevronUp, CheckSquare, Square, CheckCircle, Clock, Zap, AlertCircle,
    MapPin, Loader2, Target, Timer, TrendingUp, Sparkles, Users,
    Activity, Crown, Medal, Send, Trash2, RotateCcw, Tag, Edit3,
    ShieldCheck, MessageSquare, ListChecks, Flag, LayoutDashboard,
    PieChart as PieIcon, BarChart3
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

const SummarySection = ({ title, icon: Icon, color, count, children, emptyMsg }) => (
    <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
        <div className={`px-6 py-4 border-b border-slate-100 flex items-center gap-3`}>
            <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center shrink-0`}>
                <Icon size={16} className="text-white" />
            </div>
            <div className="flex-1">
                <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">{title}</h3>
            </div>
            <span className={`text-[10px] font-black px-3 py-1 rounded-full ${color.replace('bg-', 'bg-').replace(/-(\d+)$/, '-100')} text-slate-600`}>{count} Item</span>
        </div>
        <div className="divide-y divide-slate-50">
            {count === 0
                ? <div className="py-8 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest italic">{emptyMsg || 'Belum ada data'}</div>
                : children
            }
        </div>
    </div>
);

const statusCfgSmall = {
    'PENDING':     { label: 'Menunggu', cls: 'bg-amber-100 text-amber-700' },
    'IN_PROGRESS': { label: 'Proses',   cls: 'bg-indigo-100 text-indigo-700' },
    'COMPLETED':   { label: 'Selesai',  cls: 'bg-emerald-100 text-emerald-700' },
    'OVERDUE':     { label: 'Terlambat',cls: 'bg-rose-100 text-rose-700' },
};

const SummaryTab = ({ assignments, plans, routineAssignments, dailyLogs }) => {

    // ── Tugas ──
    const activeTasks = assignments.filter(a => a.status !== 'COMPLETED');
    const doneTasks   = assignments.filter(a => a.status === 'COMPLETED');

    // ── Rencana ──
    const activePlans = plans.filter(p => {
        const items = p.metadata?.items || [];
        const pct = items.length > 0 ? items.filter(i => i.percentage === 100 || i.status === 'SELESAI').length / items.length * 100 : 0;
        return pct < 100;
    });
    const donePlans = plans.filter(p => {
        const items = p.metadata?.items || [];
        const pct = items.length > 0 ? items.filter(i => i.percentage === 100 || i.status === 'SELESAI').length / items.length * 100 : 0;
        return pct >= 100;
    });

    // ── Rutinitas ──
    const recentRoutines = routineAssignments.slice(0, 15);
    const uniqueRoutineNames = [...new Map(recentRoutines.map(r => [r.title?.replace('[RUTIN] ',''), r])).values()];

    // ── Laporan Harian ──
    const recentLogs = dailyLogs.slice(0, 10);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">

            {/* ── TUGAS ── */}
            <SummarySection title="Penugasan" icon={ClipboardList} color="bg-indigo-500" count={assignments.length} emptyMsg="Belum ada penugasan">
                {activeTasks.length > 0 && (
                    <div>
                        <p className="px-6 pt-4 pb-1 text-[9px] font-black text-indigo-400 uppercase tracking-widest">Sedang Berlangsung ({activeTasks.length})</p>
                        {activeTasks.map(a => {
                            const sc = statusCfgSmall[a.status] || statusCfgSmall.PENDING;
                            const pct = a.progressPercentage || 0;
                            const items = Array.isArray(a.items) ? a.items : [];
                            return (
                                <div key={a.id} className="px-6 py-3 flex items-start gap-3 hover:bg-slate-50/50 transition-all">
                                    <ProgressRing pct={pct} size={36} strokeWidth={3} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${sc.cls}`}>{sc.label}</span>
                                            <span className="text-[10px] font-black text-slate-700 uppercase italic truncate">{a.title}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[9px] font-bold text-slate-400">
                                            <span className="flex items-center gap-1"><Users size={10} />{a.assignee?.name || '—'}</span>
                                            {a.dueDate && <span className="flex items-center gap-1"><Clock size={10} />Deadline: {fmtDate(a.dueDate, { day:'2-digit', month:'short' })}</span>}
                                        </div>
                                        {items.length > 0 && (
                                            <div className="mt-2 space-y-0.5">
                                                {items.slice(0, 3).map((it, i) => (
                                                    <div key={i} className="flex items-center gap-1.5">
                                                        {it.isDone || it.percentage === 100
                                                            ? <CheckCircle size={10} className="text-emerald-400 shrink-0" />
                                                            : <Square size={10} className="text-slate-300 shrink-0" />}
                                                        <span className={`text-[9px] font-bold ${it.isDone || it.percentage === 100 ? 'text-emerald-600 line-through' : 'text-slate-500'}`}>{it.text}</span>
                                                        {it.percentage > 0 && it.percentage < 100 && <span className="text-[8px] text-indigo-400 font-black">{it.percentage}%</span>}
                                                    </div>
                                                ))}
                                                {items.length > 3 && <span className="text-[8px] text-slate-300 font-bold">+{items.length - 3} item lainnya</span>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {doneTasks.length > 0 && (
                    <div>
                        <p className="px-6 pt-4 pb-1 text-[9px] font-black text-emerald-400 uppercase tracking-widest">Selesai ({doneTasks.length})</p>
                        {doneTasks.map(a => (
                            <div key={a.id} className="px-6 py-2.5 flex items-center gap-3 bg-emerald-50/30 hover:bg-emerald-50/60 transition-all">
                                <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <span className="text-[10px] font-black text-emerald-700 uppercase italic line-through truncate block">{a.title}</span>
                                    <span className="text-[9px] font-bold text-slate-400">{a.assignee?.name || '—'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </SummarySection>

            {/* ── RENCANA ── */}
            <SummarySection title="Rencana Kerja" icon={Calendar} color="bg-violet-500" count={plans.length} emptyMsg="Belum ada rencana kerja">
                {activePlans.length > 0 && (
                    <div>
                        <p className="px-6 pt-4 pb-1 text-[9px] font-black text-violet-400 uppercase tracking-widest">Dalam Progres ({activePlans.length})</p>
                        {activePlans.map(p => {
                            const items = p.metadata?.items || [];
                            const done = items.filter(i => i.percentage === 100 || i.status === 'SELESAI').length;
                            const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0;
                            return (
                                <div key={p.id} className="px-6 py-3 hover:bg-slate-50/50 transition-all">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-black text-slate-700 uppercase italic">{p.metadata?.title || 'Rencana Kerja'}</span>
                                        <span className="text-[10px] font-black text-violet-600 shrink-0 ml-2">{pct}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-2">
                                        <div className="h-full bg-gradient-to-r from-violet-500 to-purple-400 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                                    </div>
                                    <div className="space-y-0.5">
                                        {items.map((it, i) => (
                                            <div key={i} className="flex items-center gap-1.5">
                                                {it.percentage === 100 || it.status === 'SELESAI'
                                                    ? <CheckCircle size={10} className="text-emerald-400 shrink-0" />
                                                    : it.percentage > 0
                                                        ? <Zap size={10} className="text-amber-400 shrink-0" />
                                                        : <Square size={10} className="text-slate-300 shrink-0" />}
                                                <span className={`text-[9px] font-bold ${it.percentage === 100 || it.status === 'SELESAI' ? 'text-emerald-600 line-through' : 'text-slate-500'}`}>{it.activity}</span>
                                                {it.percentage > 0 && it.percentage < 100 && <span className="text-[8px] text-amber-500 font-black">{it.percentage}%</span>}
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[8px] font-bold text-slate-300 mt-1">{fmtDate(p.metadata?.startDate, {day:'2-digit', month:'short'})} — {fmtDate(p.metadata?.endDate, {day:'2-digit', month:'short'})} • {p.user?.name || '—'}</p>
                                </div>
                            );
                        })}
                    </div>
                )}
                {donePlans.length > 0 && (
                    <div>
                        <p className="px-6 pt-4 pb-1 text-[9px] font-black text-emerald-400 uppercase tracking-widest">Selesai ({donePlans.length})</p>
                        {donePlans.map(p => (
                            <div key={p.id} className="px-6 py-2.5 flex items-center gap-3 bg-emerald-50/30">
                                <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                                <div>
                                    <span className="text-[10px] font-black text-emerald-700 uppercase italic line-through">{p.metadata?.title || 'Rencana Kerja'}</span>
                                    <p className="text-[8px] font-bold text-slate-400">{p.user?.name || '—'}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </SummarySection>

            {/* ── RUTINITAS ── */}
            <SummarySection title="Rutinitas Tim" icon={RotateCcw} color="bg-emerald-500" count={uniqueRoutineNames.length} emptyMsg="Belum ada rutinitas terdaftar">
                {uniqueRoutineNames.map((r, idx) => {
                    const sc = statusCfgSmall[r.status] || statusCfgSmall.PENDING;
                    const items = Array.isArray(r.items) ? r.items : [];
                    return (
                        <div key={r.id || idx} className="px-6 py-3 flex items-start gap-3 hover:bg-slate-50/50 transition-all">
                            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0"><RotateCcw size={14} className="text-emerald-500" /></div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${sc.cls}`}>{sc.label}</span>
                                    <span className="text-[10px] font-black text-slate-700 uppercase italic">{r.title?.replace('[RUTIN] ','')}</span>
                                </div>
                                <div className="flex flex-wrap gap-3 text-[9px] font-bold text-slate-400">
                                    <span className="flex items-center gap-1"><Users size={10} />{r.assignee?.name || '—'}</span>
                                    {r.location && <span className="flex items-center gap-1"><MapPin size={10} />{r.location}</span>}
                                </div>
                                {items.length > 0 && (
                                    <div className="mt-1.5 space-y-0.5">
                                        {items.slice(0, 3).map((it, i) => (
                                            <div key={i} className="flex items-center gap-1.5">
                                                {it.isDone ? <CheckCircle size={9} className="text-emerald-400" /> : <Square size={9} className="text-slate-300" />}
                                                <span className={`text-[9px] font-bold ${it.isDone ? 'text-emerald-600 line-through' : 'text-slate-500'}`}>{it.text}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </SummarySection>

            {/* ── LAPORAN HARIAN ── */}
            <SummarySection title="Laporan Harian" icon={Flag} color="bg-rose-500" count={recentLogs.length} emptyMsg="Belum ada laporan harian">
                {recentLogs.map((log, idx) => {
                    const items = log.metadata?.items || [];
                    return (
                        <div key={log.id || idx} className="px-6 py-4 hover:bg-slate-50/50 transition-all">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center shrink-0"><Flag size={12} className="text-rose-400" /></div>
                                <div>
                                    <span className="text-[10px] font-black text-slate-700">{log.user?.name || 'Staf'}</span>
                                    <span className="text-[9px] font-bold text-slate-400 ml-2">• {fmtDate(log.date)}</span>
                                    {log.metadata?.startTime && <span className="text-[9px] font-bold text-slate-400 ml-2">{log.metadata.startTime}{log.metadata.endTime ? ` – ${log.metadata.endTime}` : ''}</span>}
                                </div>
                            </div>
                            {items.length > 0 ? (
                                <div className="ml-9 space-y-1">
                                    {items.map((it, i) => (
                                        <div key={i} className="flex items-start gap-2">
                                            <span className={`mt-0.5 shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded ${
                                                it.status === 'SELESAI' ? 'bg-emerald-100 text-emerald-600'
                                                : it.status === 'PROSES' ? 'bg-amber-100 text-amber-600'
                                                : 'bg-slate-100 text-slate-500'
                                            }`}>{it.status || 'SELESAI'}</span>
                                            <p className="text-[10px] font-bold text-slate-600 leading-relaxed">{it.activity}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="ml-9 text-[10px] font-bold text-slate-500 italic">{log.content || 'Tidak ada detail kegiatan'}</p>
                            )}
                        </div>
                    );
                })}
            </SummarySection>

        </div>
    );
};

const SummaryCard = ({ title, value, icon: Icon, color, desc }) => (
    <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex items-start justify-between relative overflow-hidden group hover:shadow-md transition-all">
        <div className={`absolute -right-4 -top-4 w-24 h-24 ${color} opacity-5 rounded-full blur-2xl group-hover:scale-150 transition-all duration-700`} />
        <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
            <h3 className="text-3xl font-black text-slate-800 italic tracking-tighter mb-2">{value}</h3>
            {desc && <p className="text-[9px] font-bold text-slate-400/80 uppercase tracking-tight">{desc}</p>}
        </div>
        <div className={`p-3.5 rounded-2xl ${color} bg-opacity-10 text-white shadow-sm transition-transform group-hover:rotate-12`}>
            <Icon size={22} className={color.replace('bg-', 'text-')} />
        </div>
    </div>
);

const SummaryTab = ({ leaderboard, assignments, plans, dailyLogs }) => {
    const hasLeaderboard = leaderboard.length > 0;
    const totalTasks = [...assignments, ...plans].length;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">

            {/* Top info banner if no KPI data */}
            {!hasLeaderboard && (
                <div className="flex items-center gap-4 bg-amber-50 border border-amber-200 p-5 rounded-2xl">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                        <AlertCircle size={20} className="text-amber-500" />
                    </div>
                    <div>
                        <p className="text-[11px] font-black text-amber-700 uppercase tracking-widest mb-0.5">Data KPI Belum Tersedia</p>
                        <p className="text-xs font-bold text-amber-600/80">KPI dihitung otomatis berdasarkan tugas yang diselesaikan. Minta staf menyelesaikan penugasan agar data muncul.</p>
                    </div>
                </div>
            )}

            {/* Staff Progress Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-indigo-900"><BarChart3 size={120} /></div>
                    <h3 className="text-sm font-black text-slate-800 uppercase italic tracking-tight mb-8 flex items-center gap-2">
                        <Target size={18} className="text-indigo-500" /> Progres Capaian Staf
                    </h3>
                    {hasLeaderboard ? (
                        <div className="space-y-6">
                            {leaderboard.map((item, idx) => (
                                <div key={item.userId} className="group">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-400 italic">#{idx+1}</div>
                                            <span className="text-xs font-black text-slate-700 uppercase italic">{item.name}</span>
                                        </div>
                                        <span className="text-[10px] font-black text-indigo-600">{item.scores?.completion || 0}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-indigo-500 to-blue-400 rounded-full transition-all duration-1000 ease-out group-hover:from-indigo-600 shadow-sm" style={{ width: `${item.scores?.completion || 0}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-10 text-center">
                            <BarChart3 size={36} className="mx-auto text-slate-200 mb-3" />
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Belum ada data KPI bulan ini</p>
                        </div>
                    )}
                </div>

                <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-emerald-900"><Sparkles size={120} /></div>
                    <h3 className="text-sm font-black text-slate-800 uppercase italic tracking-tight mb-8 flex items-center gap-2">
                        <Timer size={18} className="text-emerald-500" /> Analisa Ketepatan Waktu
                    </h3>
                    {hasLeaderboard ? (
                        <div className="space-y-6">
                            {leaderboard.map((item) => (
                                <div key={item.userId} className="group">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-black text-slate-700 uppercase italic">{item.name}</span>
                                        <span className="text-[10px] font-black text-emerald-600">{item.scores?.punctuality || 0}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-1000 ease-out group-hover:from-emerald-600 shadow-sm" style={{ width: `${item.scores?.punctuality || 0}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-10 text-center">
                            <Timer size={36} className="mx-auto text-slate-200 mb-3" />
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Belum ada data ketepatan waktu</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Penugasan Aktif Summary */}
            {totalTasks > 0 && (
                <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-black text-slate-800 uppercase italic tracking-tight mb-6 flex items-center gap-2">
                        <ClipboardList size={18} className="text-blue-500" /> Penugasan Aktif Tim
                        <Badge className="bg-blue-100 text-blue-600 ml-1">{totalTasks}</Badge>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[...assignments.slice(0, 3), ...plans.slice(0, 3)].slice(0, 6).map((item, idx) => {
                            const sc = statusCfg[item.status] || statusCfg.PENDING;
                            const Icon = sc.icon;
                            const pct = item.progressPercentage || (() => {
                                const items = item.metadata?.items || [];
                                const done = items.filter(i => i.percentage === 100 || i.status === 'SELESAI').length;
                                return items.length > 0 ? Math.round((done / items.length) * 100) : 0;
                            })();
                            return (
                                <div key={item.id || idx} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                                    <div className={`p-2 rounded-lg ${sc.color}`}><Icon size={14} /></div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-black text-slate-700 uppercase italic truncate">{item.title || item.metadata?.title || 'Penugasan'}</p>
                                        <p className="text-[9px] font-bold text-slate-400">{item.assignee?.name || item.user?.name || '—'}</p>
                                    </div>
                                    <span className="text-[10px] font-black text-slate-500 shrink-0">{pct}%</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Recent Activity Feed */}
            <div className="bg-slate-900 p-8 rounded-[40px] shadow-2xl shadow-indigo-200/20 text-white relative overflow-hidden border border-white/5">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] -mr-32 -mt-32" />
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-sm font-black uppercase italic tracking-widest flex items-center gap-3">
                        <Zap size={18} className="text-amber-400" /> Laporan Harian Terbaru
                    </h3>
                    <Badge className="bg-white/10 text-indigo-300">{dailyLogs.length} Laporan</Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dailyLogs.slice(0, 4).map((log, idx) => (
                        <div key={idx} className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 group hover:bg-white/10 transition-all">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0"><FileText size={18} /></div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{log.user?.name || 'Staf'}</span>
                                        <span className="text-[8px] font-bold text-slate-500">• {fmtDate(log.date)}</span>
                                    </div>
                                    <p className="text-[11px] font-bold text-slate-300 line-clamp-2 leading-relaxed">{log.content || log.metadata?.sourceTitle || 'Laporan tanpa keterangan'}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                    {dailyLogs.length === 0 && (
                        <div className="md:col-span-2 py-10 text-center">
                            <Activity size={36} className="mx-auto text-slate-600 mb-3" />
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Belum ada laporan harian terbaru</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================
const StaffPerformance = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const user = safeParseUser();
    const userRole = user.role || '';
    const userPosition = typeof user.position === 'string' ? user.position : '';
    const isKabid = ['SUPER_ADMIN', 'KEPALA_BIDANG'].includes(userRole) || userPosition.includes('Kepala Bidang Sarana dan Prasarana');
    const isAdmin = ['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT', 'KEPALA_BIDANG'].includes(userRole) || isKabid;
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    const validTabs = isAdmin ? ['RINGKASAN', 'RENCANA_TUGAS', 'RUTINITAS', 'LAPORAN', 'KPI'] : ['RENCANA_TUGAS', 'RUTINITAS', 'LAPORAN'];
    const urlTab = searchParams.get('tab')?.toUpperCase();
    const initialTab = validTabs.includes(urlTab) ? urlTab : (isAdmin ? 'RINGKASAN' : 'RENCANA_TUGAS');

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
    const [pageSize, setPageSize] = useState(20);
    const [pagination, setPagination] = useState({ total: 0, totalPages: 1, currentPage: 1 });

    // Modals
    const [showRencanaModal, setShowRencanaModal] = useState(false);
    const [showTugasModal, setShowTugasModal] = useState(false);
    const [showDailyModal, setShowDailyModal] = useState(false);
    const [showRutinitasModal, setShowRutinitasModal] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);
    const [editingRoutine, setEditingRoutine] = useState(null);
    const [editingAssignment, setEditingAssignment] = useState(null);

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

    const tabConfig = [
        { key: 'RINGKASAN', label: 'Ringkasan', icon: LayoutDashboard, adminOnly: true },
        { key: 'RENCANA_TUGAS', label: 'Rencana & Tugas', icon: ListChecks },
        { key: 'RUTINITAS', label: 'Rutinitas', icon: RotateCcw },
        { key: 'LAPORAN', label: 'Laporan', icon: FileText },
        { key: 'KPI', label: 'KPI', icon: Trophy, adminOnly: true },
    ];

    const changeTab = (t) => { setActiveTab(t); setSearchParams({ tab: t }); };

    useEffect(() => { if (urlTab && urlTab !== activeTab && validTabs.includes(urlTab)) setActiveTab(urlTab); }, [urlTab]);
    useEffect(() => { fetchStaff(); fetchRoutineTemplates(); }, []);
    useEffect(() => { 
        setPagination(prev => ({ ...prev, currentPage: 1 })); 
        fetchTabData(1, pageSize); 
    }, [activeTab, filterStaff, filterPeriod, pageSize]);

    const fetchStaff = async () => { try { const r = await api.get('/personnel/staff'); setStaffList(r.data || []); } catch {} };
    const fetchRoutineTemplates = async () => { try { const r = await api.get('/personnel/routines'); setRoutineTemplates(r.data || []); } catch {} };

    const fetchTabData = async (page = pagination.currentPage, limit = pageSize) => {
        setLoading(true);
        try {
            if (activeTab === 'RINGKASAN') { await fetchKPI(); await fetchPlans(1, 20); await fetchAllAssignments(1, 20); await fetchDailyLogs(1, 20); }
            else if (activeTab === 'RENCANA_TUGAS') { await fetchPlans(page, limit); await fetchAllAssignments(page, limit); }
            else if (activeTab === 'RUTINITAS') await fetchAllAssignments(page, limit);
            else if (activeTab === 'LAPORAN') await fetchDailyLogs(page, limit);
            else if (activeTab === 'KPI') await fetchKPI();
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const fetchPlans = async (page = 1, limit = pageSize) => {
        const params = { type: 'WEEKLY', userId: filterStaff !== 'ALL' ? filterStaff : undefined, page, limit };
        const res = await api.get('/personnel/reports', { params });
        const resData = res.data?.data || (Array.isArray(res.data) ? res.data : []);
        const data = resData.filter(r => r.metadata?.isPlan);
        setPlans(data);
        if (activeTab === 'RENCANA_TUGAS' && res.data?.total !== undefined) {
            setPagination({ total: res.data.total, totalPages: res.data.totalPages, currentPage: res.data.page });
        }
    };

    const fetchAllAssignments = async (page = 1, limit = pageSize) => {
        const params = { userId: filterStaff !== 'ALL' ? filterStaff : undefined, page, limit };
        const res = await api.get('/personnel/assignments', { params });
        const resData = res.data?.data || (Array.isArray(res.data) ? res.data : []);
        setAssignments(resData.filter(a => !a.routineId && !a.title?.startsWith('[RUTIN]')));
        setRoutineAssignments(resData.filter(a => a.routineId || a.title?.startsWith('[RUTIN]')));
        if (res.data?.total !== undefined) {
            setPagination({ total: res.data.total, totalPages: res.data.totalPages, currentPage: res.data.page });
        }
    };

    const fetchDailyLogs = async (page = 1, limit = pageSize) => {
        const params = { type: 'DAILY', userId: filterStaff !== 'ALL' ? filterStaff : undefined, page, limit };
        const res = await api.get('/personnel/reports', { params });
        setDailyLogs(res.data?.data || (Array.isArray(res.data) ? res.data : []));
        if (res.data?.total !== undefined) {
            setPagination({ total: res.data.total, totalPages: res.data.totalPages, currentPage: res.data.page });
        }
    };

    const fetchKPI = async () => {
        const res = await api.get(`/personnel/kpi-leaderboard?month=${filterPeriod.month}&year=${filterPeriod.year}`);
        setLeaderboard(res.data.leaderboard || []);
    };

    // --- HANDLERS ---
    const handleUpdateAssignment = async (id, data) => {
        try { await api.put(`/personnel/assignments/${id}/status`, data); await fetchAllAssignments(pagination.currentPage, pageSize); } catch { alert('Gagal memperbarui'); }
    };

    const handleDeleteRoutine = async (id) => {
        if (!confirm('Hapus rutinitas ini? Jadwal yang sudah tercipta tidak akan terhapus, namun tidak akan ada jadwal baru lagi.')) return;
        try { await api.delete(`/personnel/routines/${id}`); await fetchRoutineTemplates(); } catch { alert('Gagal menghapus'); }
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
            if (editingAssignment || formData.id) {
                const id = editingAssignment?.id || formData.id;
                await api.put(`/personnel/assignments/${id}/status`, {
                    ...formData,
                    description: formData.description || formData.notes
                });
            } else {
                await api.post('/personnel/assignments', {
                    ...formData,
                    description: formData.description || formData.notes,
                    items: formData.items.map(it => ({ ...it, isDone: false, percentage: 0 }))
                });
            }
            setShowTugasModal(false); setEditingAssignment(null);
            await fetchAllAssignments(pagination.currentPage, pageSize);
        } catch (err) { alert(err.response?.data?.error || 'Gagal menyimpan tugas'); }
        finally { setSubmitting(false); }
    };

    const handleCreateDailyReport = async (formData) => {
        setSubmitting(true);
        try {
            await api.post('/personnel/reports', {
                type: 'DAILY', 
                category: 'UMUM', 
                content: formData.items[0]?.activity || 'Laporan Harian', 
                date: formData.date || today(),
                metadata: { 
                    items: formData.items,
                    startTime: formData.startTime,
                    endTime: formData.endTime,
                    timestamp: new Date().toISOString()
                }
            });
            setShowDailyModal(false); await fetchDailyLogs();
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

                {/* ─── SUMMARY CARDS (Dashboard Row) ─── */}
                {isAdmin && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                        {(() => {
                            const totalPlanned = leaderboard.reduce((acc, curr) => acc + (curr.stats?.total || 0), 0);
                            const totalDone = leaderboard.reduce((acc, curr) => acc + (curr.stats?.completed || 0), 0);
                            const avgPct = totalPlanned > 0 ? Math.round((totalDone / totalPlanned) * 100) : 0;
                            const avgPunctual = leaderboard.length > 0 ? Math.round(leaderboard.reduce((acc, curr) => acc + (curr.scores?.punctuality || 0), 0) / leaderboard.length) : 0;
                            
                            return (
                                <>
                                    <SummaryCard title="Total Penugasan" value={totalPlanned} icon={ClipboardList} color="bg-indigo-500" desc="Rencana + Tugas + Rutin" />
                                    <SummaryCard title="Rata-rata Progres" value={`${avgPct}%`} icon={Zap} color="bg-amber-500" desc="Ketercapaian Kumulatif Tim" />
                                    <SummaryCard title="Ketepatan Waktu" value={`${avgPunctual}%`} icon={Timer} color="bg-emerald-500" desc="Selesai Sebelum Deadline" />
                                    <SummaryCard title="Aktivitas Harian" value={dailyLogs.length} icon={Activity} color="bg-blue-500" desc="Laporan masuk periode ini" />
                                </>
                            );
                        })()}
                    </div>
                )}

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
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-100/50 rounded-xl border border-slate-200/50">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest hidden md:inline">Tampilkan:</span>
                            <select value={pageSize} onChange={e => setPageSize(e.target.value === 'all' ? 'all' : parseInt(e.target.value))} className="bg-transparent border-none text-[10px] font-black text-slate-600 outline-none cursor-pointer">
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                                <option value="all">Semua</option>
                            </select>
                        </div>

                        {activeTab === 'LAPORAN' && (
                            <button onClick={() => setShowDailyModal(true)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95">
                                <Plus size={14} strokeWidth={3} />Laporan Harian
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
                              {activeTab === 'RINGKASAN' && <SummaryTab assignments={assignments} plans={plans} routineAssignments={routineAssignments} dailyLogs={dailyLogs} />}
                              {activeTab === 'RENCANA_TUGAS' && <RencanaTugasTab plans={plans.filter(p => inDateRange(p.metadata?.startDate || p.date))} assignments={assignments.filter(a => inDateRange(a.startDate || a.createdAt))} onUpdatePlanItem={handleUpdatePlanItem} onUpdateAssignment={handleUpdateAssignment} onEditPlan={(p) => { setEditingPlan(p); setShowRencanaModal(true); }} userId={user.id} isKabid={isKabid} />}
                              {activeTab === 'RUTINITAS' && <RutinitasTab assignments={routineAssignments.filter(a => inDateRange(a.createdAt))} templates={routineTemplates} onUpdate={handleUpdateAssignment} onDeleteRoutine={handleDeleteRoutine} onEditRoutine={(t) => { setEditingRoutine(t); setShowRutinitasModal(true); }} onEditAssignment={(a) => { setEditingAssignment(a); setShowTugasModal(true); }} userId={user.id} isKabid={isKabid} isAdmin={isAdmin} />}
                              {activeTab === 'LAPORAN' && <LaporanTab logs={dailyLogs.filter(l => inDateRange(l.date))} isKabid={isKabid} />}
                              {activeTab === 'KPI' && <KPITab leaderboard={leaderboard} />}

                             {activeTab !== 'KPI' && pageSize !== 'all' && pagination.totalPages > 1 && (
                                <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Menampilkan {(pagination.currentPage - 1) * pageSize + 1} — {Math.min(pagination.currentPage * pageSize, pagination.total)} dari {pagination.total} data
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <button disabled={pagination.currentPage <= 1} onClick={() => fetchTabData(pagination.currentPage - 1)} 
                                            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-all">
                                            Sebelumnya
                                        </button>
                                        <span className="px-3 text-[10px] font-black text-indigo-600">{pagination.currentPage} / {pagination.totalPages}</span>
                                        <button disabled={pagination.currentPage >= pagination.totalPages} onClick={() => fetchTabData(pagination.currentPage + 1)} 
                                            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-all">
                                            Berikutnya
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* ─── MODALS ─── */}
            <RencanaFormModal open={showRencanaModal} onClose={() => { setShowRencanaModal(false); setEditingPlan(null); }} onSubmit={handleCreatePlan} submitting={submitting} editing={editingPlan} />
            <TugasFormModal open={showTugasModal} onClose={() => { setShowTugasModal(false); setEditingAssignment(null); }} onSubmit={handleCreateTask} submitting={submitting} staffList={staffList} editing={editingAssignment} />
            <DailyActivityFormModal open={showDailyModal} onClose={() => setShowDailyModal(false)} onSubmit={handleCreateDailyReport} submitting={submitting} />
            <RutinitasFormModal open={showRutinitasModal} onClose={() => { setShowRutinitasModal(false); setEditingRoutine(null); }} onSubmit={async (formData) => {
                setSubmitting(true);
                try {
                    if (editingRoutine) {
                        await api.put(`/personnel/routines/${editingRoutine.id}`, formData);
                    } else {
                        await api.post('/personnel/routines', formData);
                    }
                    setShowRutinitasModal(false); setEditingRoutine(null);
                    await fetchRoutineTemplates(); await fetchAllAssignments(pagination.currentPage, pageSize);
                } catch (err) { alert(err.response?.data?.error || 'Gagal menyimpan rutinitas'); }
                finally { setSubmitting(false); }
            }} submitting={submitting} editing={editingRoutine} />

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
    const sortedPlans = [...plans].sort((a, b) => {
        const aItems = a.metadata?.items || [];
        const aCompleted = aItems.filter(i => i.percentage === 100 || i.status === 'SELESAI').length;
        const aPct = aItems.length > 0 ? Math.round((aCompleted / aItems.length) * 100) : 0;
        
        const bItems = b.metadata?.items || [];
        const bCompleted = bItems.filter(i => i.percentage === 100 || i.status === 'SELESAI').length;
        const bPct = bItems.length > 0 ? Math.round((bCompleted / bItems.length) * 100) : 0;

        const aDone = aPct === 100;
        const bDone = bPct === 100;
        if (aDone !== bDone) return aDone ? 1 : -1;
        
        const aDate = new Date(a.metadata?.startDate || a.date);
        const bDate = new Date(b.metadata?.startDate || b.date);
        return bDate - aDate;
    });

    const sortedAssignments = [...assignments].sort((a, b) => {
        const aDone = a.status === 'COMPLETED';
        const bDone = b.status === 'COMPLETED';
        if (aDone !== bDone) return aDone ? 1 : -1;
        
        const aDate = new Date(a.startDate || a.createdAt);
        const bDate = new Date(b.startDate || b.createdAt);
        return bDate - aDate;
    });

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
                        {sortedPlans.map(plan => {
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
                        {sortedAssignments.map((a, idx) => {
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

    const commit = (pctVal) => {
        const val = typeof pctVal === 'string' ? (parseInt(pctVal) || 0) : pctVal;
        const clamped = Math.min(100, Math.max(0, val));
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
                {!editing ? (
                    <button onClick={() => setEditing(true)} className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${isDone ? 'bg-emerald-100 text-emerald-700' : localPct > 0 ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                        {localPct}%
                    </button>
                ) : null}
            </div>
            {/* Progress bar */}
            <div className="mt-2 ml-8 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${pctColor} rounded-full transition-all duration-500`} style={{ width: `${localPct}%` }} />
            </div>
            {/* Inline editor */}
            {editing && (
                <div className="mt-3 ml-8 flex items-center gap-3 p-2 bg-slate-50 rounded-xl border border-slate-100 animate-in fade-in duration-200">
                    <input type="range" min="0" max="100" step="5" value={localPct || 0} onChange={e => setLocalPct(e.target.value)}
                        className="flex-1 h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600" />
                    <input type="number" min="0" max="100" step="1" value={localPct} onChange={e => setLocalPct(e.target.value === '' ? '' : Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && commit(localPct)}
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

    const updateItemProgress = async (idx, pctVal) => {
        const val = typeof pctVal === 'string' ? (parseInt(pctVal) || 0) : pctVal;
        const newItems = [...items];
        const clamped = Math.min(100, Math.max(0, val));
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
                                
                                {!isEditing ? (
                                    <button onClick={() => { setEditingIdx(idx); setLocalPct(pct); }} className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${isDone ? 'bg-emerald-100 text-emerald-700' : pct > 0 ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
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
                                <div className="mt-3 ml-8 flex items-center gap-3 p-2 bg-slate-50 rounded-xl border border-slate-100 animate-in fade-in duration-200" onClick={e => e.stopPropagation()}>
                                    <input type="range" min="0" max="100" step="5" value={localPct || 0} onChange={e => setLocalPct(e.target.value)}
                                        className="flex-1 h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600" />
                                    <input type="number" min="0" max="100" step="1" value={localPct} onChange={e => setLocalPct(e.target.value === '' ? '' : Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                                        autoFocus
                                        onKeyDown={e => e.key === 'Enter' && updateItemProgress(idx, localPct)}
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
const RutinitasTab = ({ assignments, templates, onUpdate, onDeleteRoutine, onEditRoutine, onEditAssignment, userId, isKabid, isAdmin }) => {
    const [expanded, setExpanded] = useState([]);
    const [showTemplates, setShowTemplates] = useState(false);
    const toggle = id => setExpanded(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);

    const freqMap = {};
    templates.forEach(t => { freqMap[t.id] = t.frequency || 'DAILY'; });
    const getFreq = a => freqMap[a.routineId] || 'DAILY';
    const freqLabel = { DAILY: 'Harian', WEEKLY: 'Mingguan', MONTHLY: 'Bulanan' };
    const freqColor = { DAILY: 'bg-blue-100 text-blue-700', WEEKLY: 'bg-purple-100 text-purple-700', MONTHLY: 'bg-teal-100 text-teal-700' };

    // Filter: Kabid sees all, Admin Aset / staff sees only their own
    const filtered = isKabid ? assignments : assignments.filter(a => a.assigneeId === userId);
    const myTemplates = isKabid ? templates : templates.filter(t => t.assigneeId === userId);

    return (
        <div className="space-y-6">
            {myTemplates.length > 0 && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/50">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-slate-200 rounded-lg flex items-center justify-center text-slate-500"><RotateCcw size={12} /></div>
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Kelola Aturan Rutinitas</h3>
                        </div>
                        <button onClick={() => setShowTemplates(!showTemplates)} className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline">
                            {showTemplates ? 'Sembunyikan' : 'Lihat Semua'}
                        </button>
                    </div>
                    
                    {showTemplates && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 animate-in slide-in-from-top-2 duration-300">
                            {myTemplates.map(t => (
                                <div key={t.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <p className="text-xs font-black text-slate-700 truncate">{t.title}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge className={freqColor[t.frequency]}>{freqLabel[t.frequency]}</Badge>
                                            {isKabid && t.assignee && <span className="text-[8px] font-bold text-slate-400 capitalize">{t.assignee.name}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => onEditRoutine(t)} className="p-2 text-indigo-400 hover:bg-indigo-50 rounded-lg transition-all"><Edit3 size={14} /></button>
                                        <button onClick={() => onDeleteRoutine(t.id)} className="p-2 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {filtered.length === 0 ? (
                <EmptyState icon={RotateCcw} message="Belum ada rutinitas aktif" />
            ) : (
                Object.entries(grouped(filtered, getFreq)).filter(([, list]) => list.length > 0).map(([freq, list]) => (
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
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-sm font-black text-slate-800 italic uppercase truncate">{a.title.replace('[RUTIN] ', '')}</h4>
                                                    {(isAssignee || isKabid) && (
                                                        <button onClick={(e) => { e.stopPropagation(); onEditAssignment(a); }} className="p-1 text-slate-300 hover:text-indigo-500 transition-colors">
                                                            <Edit3 size={12} />
                                                        </button>
                                                    )}
                                                </div>
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
                ))
            )}
        </div>
    );
};

// Helper for grouping
const grouped = (list, getFreq) => {
    const g = { DAILY: [], WEEKLY: [], MONTHLY: [] };
    list.forEach(a => { const f = getFreq(a); (g[f] || g.DAILY).push(a); });
    return g;
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
                                        <span className="text-[9px] font-bold text-slate-300 tracking-wider">
                                            {log.metadata?.startTime && log.metadata?.endTime 
                                                ? `${log.metadata.startTime} — ${log.metadata.endTime}`
                                                : fmtTime(log.metadata?.timestamp || log.createdAt)}
                                        </span>
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

const TugasFormModal = ({ open, onClose, onSubmit, submitting, staffList, editing }) => {
    const [title, setTitle] = useState('');
    const [assigneeId, setAssigneeId] = useState('');
    const [priority, setPriority] = useState('MEDIUM');
    const [startDate, setStartDate] = useState(today());
    const [dueDate, setDueDate] = useState('');
    const [location, setLocation] = useState('');
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState([{ text: '' }]);

    useEffect(() => {
        if (open) { 
            if (editing) {
                setTitle(editing.title || '');
                setAssigneeId(editing.assigneeId || '');
                setPriority(editing.priority || 'MEDIUM');
                setStartDate(editing.startDate ? new Date(editing.startDate).toISOString().split('T')[0] : today());
                setDueDate(editing.dueDate ? new Date(editing.dueDate).toISOString().split('T')[0] : '');
                setLocation(editing.location || '');
                setNotes(editing.description || '');
                setItems(Array.isArray(editing.items) ? editing.items : [{ text: '' }]);
            } else {
                setTitle(''); setAssigneeId(''); setPriority('MEDIUM'); setStartDate(today()); setDueDate(''); setLocation(''); setNotes(''); setItems([{ text: '' }]); 
            }
        }
    }, [open, editing]);

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
                    {submitting ? 'Menyimpan...' : (editing ? 'Simpan Perubahan' : 'Delegasikan Tugas')}
                </button>
            </form>
        </Modal>
    );
};

const DailyActivityFormModal = ({ open, onClose, onSubmit, submitting }) => {
    const [date, setDate] = useState(today());
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [items, setItems] = useState([{ activity: '', status: 'SELESAI' }]);

    useEffect(() => {
        if (open) { 
            setDate(today()); 
            setStartTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })); 
            setEndTime('');
            setItems([{ activity: '', status: 'SELESAI' }]); 
        }
    }, [open]);

    const addItem = () => setItems([...items, { activity: '', status: 'SELESAI' }]);
    const removeItem = idx => setItems(items.filter((_, i) => i !== idx));
    const updateItem = (idx, field, val) => { const n = [...items]; n[idx][field] = val; setItems(n); };

    const submit = e => {
        e.preventDefault();
        const validItems = items.filter(i => i.activity.trim());
        if (validItems.length === 0) return alert('Silakan isi setidaknya satu aktivitas');
        onSubmit({ items: validItems, date, startTime, endTime });
    };

    return (
        <Modal open={open} onClose={onClose} title="Laporan Aktivitas Harian" icon={Flag} wide>
            <form onSubmit={submit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">📅 Tanggal</label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-200 outline-none" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">🕒 Jam Mulai</label>
                        <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-200 outline-none" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">🕒 Jam Selesai</label>
                        <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-200 outline-none" />
                    </div>
                </div>

                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">📝 Daftar Kegiatan</label>
                    <div className="space-y-3">
                        {items.map((it, idx) => (
                            <div key={idx} className="flex gap-3 items-start animate-in slide-in-from-right-2 duration-300">
                                <div className="flex-1 space-y-2">
                                    <textarea value={it.activity} onChange={e => updateItem(idx, 'activity', e.target.value)} rows={2} placeholder="Sebutkan apa yang dikerjakan..."
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-200 outline-none" />
                                    <div className="flex gap-2">
                                        {['SELESAI', 'PROSES', 'PENDING'].map(s => (
                                            <button key={s} type="button" onClick={() => updateItem(idx, 'status', s)}
                                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black transition-all ${it.status === s ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {items.length > 1 && (
                                    <button type="button" onClick={() => removeItem(idx)} className="p-2 text-rose-300 hover:text-rose-500 mt-2 transition-colors">
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        ))}
                        <button type="button" onClick={addItem} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-indigo-200 hover:text-indigo-500 transition-all flex items-center justify-center gap-2">
                            <Plus size={16} />Tambah Kegiatan
                        </button>
                    </div>
                </div>

                <button type="submit" disabled={submitting} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
                    {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    {submitting ? 'Menyimpan...' : 'Simpan Laporan Harian'}
                </button>
            </form>
        </Modal>
    );
};

// ============================================
// FORM MODAL: RUTINITAS
// ============================================
const RutinitasFormModal = ({ open, onClose, onSubmit, submitting, editing }) => {
    const [title, setTitle] = useState('');
    const [frequency, setFrequency] = useState('DAILY');
    const [dayOfWeek, setDayOfWeek] = useState(1);
    const [dayOfMonth, setDayOfMonth] = useState(1);
    const [priority, setPriority] = useState('MEDIUM');
    const [location, setLocation] = useState('');
    const [description, setDescription] = useState('');
    const [items, setItems] = useState([{ text: '' }]);

    useEffect(() => {
        if (open) { 
            if (editing) {
                setTitle(editing.title || '');
                setFrequency(editing.frequency || 'DAILY');
                setDayOfWeek(editing.dayOfWeek || 0);
                setDayOfMonth(editing.dayOfMonth || 1);
                setPriority(editing.priority || 'MEDIUM');
                setLocation(editing.location || '');
                setDescription(editing.description || '');
                setItems(Array.isArray(editing.items) ? editing.items : [{ text: '' }]);
            } else {
                setTitle(''); setFrequency('DAILY'); setDayOfWeek(1); setDayOfMonth(1); setPriority('MEDIUM'); setLocation(''); setDescription(''); setItems([{ text: '' }]); 
            }
        }
    }, [open, editing]);

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
                    {submitting ? 'Menyimpan...' : (editing ? 'Simpan Perubahan' : 'Simpan Rutinitas')}
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
