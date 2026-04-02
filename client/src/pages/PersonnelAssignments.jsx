import { useState, useEffect } from 'react';
import { FileCheck, Plus, Clock, CheckCircle2, AlertCircle, Calendar, User, Search, MapPin, Tag, ArrowRight, MoreVertical, Flag, Activity, Loader2, X, ChevronDown, ChevronUp, CheckSquare, Square, Zap } from 'lucide-react';
import api from '../lib/axios';

const StatusBadge = ({ status, statusConfig }) => (
    <div className={`px-4 py-1.5 rounded-full border text-[10px] font-black tracking-widest flex items-center gap-2 ${statusConfig[status].color} w-full md:w-auto justify-center shadow-lg shadow-indigo-100/20 backdrop-blur-sm transition-all hover:scale-105 whitespace-nowrap`}>
        {statusConfig[status].icon} {statusConfig[status].label}
    </div>
);

const ExtensionBadge = ({ status }) => {
    if (!status) return null;
    const config = {
        PENDING: { color: 'bg-amber-50 text-amber-600 border-amber-100 shadow-amber-100/50', label: 'PENUNDAAN DIAJUKAN' },
        APPROVED: { color: 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-emerald-100/50', label: 'PENUNDAAN DISETUJUI' },
        REJECTED: { color: 'bg-rose-50 text-rose-600 border-rose-100 shadow-rose-100/50', label: 'PENUNDAAN DITOLAK' }
    };
    return (
        <div className={`px-3 py-1 rounded-full border text-[8px] font-black tracking-widest shadow-lg ${config[status]?.color || 'bg-slate-50 text-slate-400'}`}>
            {config[status]?.label || status}
        </div>
    );
};

const ActionButtons = ({ a, canAssign, isAssignee, handleUpdateAssignment, fullWidth = false }) => (
    <div className={`flex gap-1.5 ${fullWidth ? 'w-full' : 'w-full md:w-auto'}`}>
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
        {isAssignee && a.status !== 'COMPLETED' && !a.extensionStatus && (
            <button 
                onClick={() => window.dispatchEvent(new CustomEvent('openExtensionModal', { detail: a }))}
                className="px-2 py-1 bg-amber-50 text-amber-600 text-[8px] font-bold rounded-lg border border-amber-100 hover:bg-amber-100 transition-all"
            >
                MINTA PENUNDAAN
            </button>
        )}
        {canAssign && a.extensionStatus === 'PENDING' && (
            <div className="flex gap-1">
                <button 
                    onClick={() => handleUpdateAssignment(a.id, { extensionStatus: 'APPROVED' }, true)}
                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg border border-transparent hover:border-emerald-100"
                    title="Setujui Penundaan"
                >
                    <CheckCircle2 size={12} strokeWidth={3} />
                </button>
                <button 
                    onClick={() => handleUpdateAssignment(a.id, { extensionStatus: 'REJECTED' }, true)}
                    className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-100"
                    title="Tolak Penundaan"
                >
                    <X size={12} strokeWidth={3} />
                </button>
            </div>
        )}
    </div>
);

const ProgressBar = ({ progress }) => (
    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden relative shadow-inner">
        <div className={`h-full transition-all duration-[1500ms] ease-out ${progress === 100 ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]' : 'bg-gradient-to-r from-indigo-500 to-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.3)]'}`} style={{ width: `${progress}%` }} />
    </div>
);

const AssignmentProgress = ({ progress, totalCount, completedCount, editProgress, manualProgress, setManualProgress, setEditProgress, a, handleUpdateAssignment, canAssign, isAssignee }) => (
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
                        if (e.key === 'Escape') {
                            setManualProgress(a.progressPercentage || 0);
                            setEditProgress(false);
                        }
                    }}
                    onBlur={() => {
                        if (manualProgress !== a.progressPercentage) {
                            handleUpdateAssignment(a.id, { progressPercentage: manualProgress });
                        }
                        setEditProgress(false);
                    }}
                    className="w-14 md:w-16 px-1.5 md:py-1.5 bg-white border-2 border-indigo-500 rounded-lg text-center text-indigo-700 font-black outline-none shadow-xl shadow-indigo-100 text-[10px]"
                    autoFocus
                />
                <span className="text-indigo-600 font-black">%</span>
            </div>
        ) : (
            <div 
                className={`flex items-center gap-2 group/val transition-all ${totalCount === 0 && (canAssign || isAssignee) ? 'cursor-edit hover:scale-105 active:scale-95' : ''}`}
                onClick={() => totalCount === 0 && (canAssign || isAssignee) && setEditProgress(true)}
                title={totalCount > 0 ? "Progres dihitung otomatis dari checklist" : (canAssign || isAssignee ? "Klik untuk ubah persentase" : "")}
            >
                <span className={`px-2 py-0.5 md:py-1 rounded-md font-black border transition-all ${totalCount > 0 ? 'bg-slate-50 text-slate-400 border-slate-100 italic' : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-600 hover:text-white shadow-sm'}`}>
                    {progress}%
                </span>
                {totalCount > 0 && <span className="text-[9px] text-slate-300 font-medium tracking-tight">({completedCount}/{totalCount})</span>}
                {totalCount === 0 && (canAssign || isAssignee) && <Tag size={8} className="text-indigo-300 opacity-0 md:group-hover/val:opacity-100" />}
            </div>
        )}
    </div>
);

const AssigneeAvatar = ({ assignee, size = "w-8 h-8" }) => (
    <div className={`${size} rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-500 overflow-hidden shrink-0`}>
        {assignee?.name ? assignee.name[0].toUpperCase() : <User size={14} />}
    </div>
);

const DeadlineBadge = ({ dueDate }) => (
    <div className="inline-flex flex-col items-center gap-0.5 bg-slate-100/50 md:bg-slate-50 px-3 py-1.5 rounded-xl transition-colors min-w-[70px]">
        <span className="text-[8px] md:text-[9px] font-black text-slate-400 tracking-widest uppercase">Maks Selesai</span>
        <span className="text-[10px] md:text-[11px] font-black text-slate-700">{dueDate ? new Date(dueDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : '-'}</span>
    </div>
);

const SubTaskItem = ({ item, idx, progressVal, isDone, updating, isAssignee, canAssign, toggleItemStatus, updateItemProgress }) => {
    const [localVal, setLocalVal] = useState(progressVal);

    useEffect(() => {
        setLocalVal(progressVal);
    }, [progressVal]);

    const commitProgress = () => {
        const clamped = Math.min(100, Math.max(0, localVal));
        if (clamped !== progressVal) {
            updateItemProgress(idx, clamped);
        }
    };

    return (
        <div className={`p-4 rounded-2xl border transition-all shadow-sm ${isDone ? 'bg-emerald-50/30 border-emerald-100' : 'bg-white border-slate-100'}`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                        onClick={() => toggleItemStatus(idx)}
                        disabled={updating}
                        className={`shrink-0 transition-transform active:scale-90 ${isDone ? 'text-emerald-500' : 'text-slate-300'}`}
                    >
                        {isDone ? <CheckSquare size={22} /> : <Square size={22} />}
                    </button>
                    <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold leading-tight ${isDone ? 'text-emerald-700 line-through decoration-emerald-200' : 'text-slate-700'}`}>
                            {item.text}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[8px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded ${isDone ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                {isDone ? 'SELESAI' : 'PROGRES'}
                            </span>
                            <span className={`text-[10px] font-black ${isDone ? 'text-emerald-500' : 'text-indigo-600'}`}>{progressVal}%</span>
                        </div>
                    </div>
                </div>

                {/* Progress Percentage Input - local state, commit on blur/Enter */}
                <div className="flex items-center gap-2 md:w-32">
                    <input 
                        type="number"
                        min="0" max="100"
                        value={localVal}
                        onChange={(e) => setLocalVal(parseInt(e.target.value) || 0)}
                        onBlur={commitProgress}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.target.blur(); }
                            if (e.key === 'Escape') { setLocalVal(progressVal); e.target.blur(); }
                        }}
                        className="w-16 px-2 py-1.5 bg-white border-2 border-slate-200 rounded-lg text-center text-xs font-black text-indigo-700 outline-none focus:border-indigo-500 transition-all"
                        disabled={updating || (!isAssignee && !canAssign)}
                    />
                    <span className="text-xs font-black text-slate-400">%</span>
                </div>
            </div>
            
            {/* Item Progress Bar */}
            <div className="mt-3 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                    className={`h-full transition-all duration-500 ${isDone ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                    style={{ width: `${progressVal}%` }} 
                />
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
    
    // Parse items with safety and enhance with progress if missing
    let items = [];
    try {
        const rawItems = Array.isArray(a.items) ? a.items : (typeof a.items === 'string' ? JSON.parse(a.items) : []);
        items = rawItems.map(it => ({
            ...it,
            progress: typeof it.progress === 'number' ? it.progress : (it.status === 'COMPLETED' ? 100 : 0)
        }));
    } catch (e) {
        console.error("Error parsing items:", e);
        items = [];
    }

    const totalCount = items.length;
    
    // Average progress of all sub-tasks
    const progress = totalCount > 0 
        ? Math.round(items.reduce((acc, it) => acc + (it.progress || 0), 0) / totalCount)
        : (a.progressPercentage || 0);

    const completedCount = items.filter(it => it.progress === 100).length;
    
    const updateItemProgress = async (itemIdx, newProgress) => {
        if (updating || (!isAssignee && !canAssign)) return;
        const newItems = [...items];
        newItems[itemIdx].progress = Math.min(100, Math.max(0, newProgress));
        newItems[itemIdx].status = newItems[itemIdx].progress === 100 ? 'COMPLETED' : 'PENDING';
        
        // Calculate new overall progress
        const newOverallProgress = Math.round(newItems.reduce((acc, it) => acc + it.progress, 0) / totalCount);
        
        setUpdating(true);
        await handleUpdateAssignment(a.id, { 
            items: newItems,
            progressPercentage: newOverallProgress 
        });
        setUpdating(false);
    };

    const toggleItemStatus = async (itemIdx) => {
        const currentProgress = items[itemIdx].progress;
        await updateItemProgress(itemIdx, currentProgress === 100 ? 0 : 100);
    };

    return (
        <div className={`group bg-white rounded-[20px] md:rounded-2xl border ${expanded ? 'border-indigo-100 shadow-xl' : 'border-slate-100 hover:border-slate-200'} transition-all duration-300 relative overflow-hidden overflow-visible`}>
            {/* Desktop View (Grid) */}
            <div className="hidden md:grid md:grid-cols-12 gap-4 items-center p-5">
                {/* Info Column */}
                <div className="md:col-span-3 flex items-start gap-4">
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
                        <div className="flex items-center gap-2 mt-1">
                            <ExtensionBadge status={a.extensionStatus} />
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium italic truncate">
                                <MapPin size={10} /> {a.location || 'Lokasi Terpusat'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Progress Column */}
                <div className="md:col-span-3">
                   <div className="flex flex-col gap-1.5 group/prog">
                        <div className="flex justify-between items-end text-[10px] font-black tracking-tighter">
                            <span className="text-slate-400 uppercase">Progres Penugasan</span>
                            <AssignmentProgress 
                                progress={progress} 
                                totalCount={totalCount} 
                                completedCount={completedCount} 
                                editProgress={editProgress}
                                manualProgress={manualProgress}
                                setManualProgress={setManualProgress}
                                setEditProgress={setEditProgress}
                                a={a}
                                handleUpdateAssignment={handleUpdateAssignment}
                                canAssign={canAssign}
                                isAssignee={isAssignee}
                            />
                        </div>
                        <ProgressBar progress={progress} />
                   </div>
                </div>

                {/* Staff Column */}
                <div className="md:col-span-2 flex items-center justify-center gap-3">
                    <AssigneeAvatar assignee={a.assignee} />
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-700 truncate">{a.assignee?.name || 'Staff'}</p>
                        <p className="text-[9px] text-slate-400 font-medium">Pelaksana</p>
                    </div>
                </div>

                {/* Date Column */}
                <div className="md:col-span-2 text-center">
                    <DeadlineBadge dueDate={a.dueDate} />
                </div>

                {/* Status Column */}
                <div className="md:col-span-2 flex flex-col items-end gap-2 px-4 md:px-0">
                    <StatusBadge status={a.status} statusConfig={statusConfig} />
                    <ActionButtons 
                        a={a} 
                        canAssign={canAssign} 
                        isAssignee={isAssignee} 
                        handleUpdateAssignment={handleUpdateAssignment} 
                    />
                </div>
            </div>

            {/* Mobile View (Optimized) */}
            <div className="md:hidden p-5 space-y-4">
                {/* Header: Priority, Category, Expand, Status */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setExpanded(!expanded)}
                            className={`p-1.5 rounded-lg transition-all ${expanded ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}
                        >
                            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${priorityConfig[a.priority || 'MEDIUM'].color} bg-slate-50 border border-slate-100`}>
                            {priorityConfig[a.priority || 'MEDIUM'].label}
                        </span>
                    </div>
                    <StatusBadge status={a.status} statusConfig={statusConfig} />
                </div>

                {/* Title & Location */}
                <div>
                    <h4 className="text-sm font-bold text-slate-800 leading-snug uppercase">{a.title}</h4>
                    <div className="flex items-center gap-2 text-[9px] text-slate-400 mt-1 font-medium italic uppercase tracking-wider">
                        <MapPin size={10} /> {a.location || 'Lokasi Terpusat'} • {a.category}
                    </div>
                </div>

                {/* Info Row: Assignee & Deadline */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="flex items-center gap-2.5 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                        <AssigneeAvatar assignee={a.assignee} size="w-7 h-7" />
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold text-slate-700 truncate">{a.assignee?.name?.split(' ')[0] || 'Staff'}</p>
                            <p className="text-[8px] text-slate-400 font-medium">Pelaksana</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2.5 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <Clock size={12} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold text-slate-700">{a.dueDate ? new Date(a.dueDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : '-'}</p>
                            <p className="text-[8px] text-slate-400 font-medium">Deadline</p>
                        </div>
                    </div>
                </div>

                {/* Progress Section */}
                <div className="space-y-2 pt-1">
                    <div className="flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        <span>Penyelesaian</span>
                        <AssignmentProgress 
                            progress={progress} 
                            totalCount={totalCount} 
                            completedCount={completedCount} 
                            editProgress={editProgress}
                            manualProgress={manualProgress}
                            setManualProgress={setManualProgress}
                            setEditProgress={setEditProgress}
                            a={a}
                            handleUpdateAssignment={handleUpdateAssignment}
                            canAssign={canAssign}
                            isAssignee={isAssignee}
                        />
                    </div>
                    <ProgressBar progress={progress} />
                </div>

                {/* Actions Row */}
                <div className="pt-2 border-t border-slate-50">
                    <ActionButtons 
                        a={a} 
                        canAssign={canAssign} 
                        isAssignee={isAssignee} 
                        handleUpdateAssignment={handleUpdateAssignment}
                        fullWidth={true}
                    />
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
                            <div className="space-y-4">
                                {items.map((item, idx) => {
                                    const progressVal = item.progress || 0;
                                    const isDone = progressVal === 100;
                                    return (
                                        <SubTaskItem
                                            key={idx}
                                            item={item}
                                            idx={idx}
                                            progressVal={progressVal}
                                            isDone={isDone}
                                            updating={updating}
                                            isAssignee={isAssignee}
                                            canAssign={canAssign}
                                            toggleItemStatus={toggleItemStatus}
                                            updateItemProgress={updateItemProgress}
                                        />
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
        items: [{ text: '', status: 'PENDING', progress: 0 }]
    });

    const [extensionModal, setExtensionModal] = useState({ show: false, assignment: null, requestedDate: '', reason: '' });

    useEffect(() => {
        const handleOpenModal = (e) => {
            setExtensionModal({ 
                show: true, 
                assignment: e.detail, 
                requestedDate: e.detail.requestedExtensionDate ? new Date(e.detail.requestedExtensionDate).toISOString().split('T')[0] : '', 
                reason: e.detail.extensionReason || '' 
            });
        };
        window.addEventListener('openExtensionModal', handleOpenModal);
        return () => window.removeEventListener('openExtensionModal', handleOpenModal);
    }, []);

    const statusConfig = {
        PENDING: { color: 'bg-amber-50 text-amber-600 border-amber-100 shadow-sm', icon: <Clock size={13} />, label: 'MENUNGGU' },
        IN_PROGRESS: { color: 'bg-indigo-50 text-indigo-600 border-indigo-100 shadow-sm', icon: <Zap size={13} fill="currentColor" fillOpacity={0.2} />, label: 'PROSES' },
        IN_REVIEW: { color: 'bg-purple-50 text-purple-600 border-purple-100 shadow-sm', icon: <Search size={13} />, label: 'REVIU' },
        COMPLETED: { color: 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm', icon: <CheckCircle2 size={13} />, label: 'SELESAI' },
        CANCELLED: { color: 'bg-slate-50 text-slate-500 border-slate-100 shadow-sm', icon: <X size={13} />, label: 'BATAL' }
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
        setForm({ ...form, items: [...form.items, { text: '', status: 'PENDING', progress: 0 }] });
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
            setForm({ assigneeId: '', title: '', description: '', category: 'UMUM', priority: 'MEDIUM', location: '', startDate: new Date().toISOString().split('T')[0], dueDate: '', addToCalendar: true, items: [{ text: '', status: 'PENDING', progress: 0 }] });
            fetchAssignments();
            alert(`Tugas berhasil didelegasikan`);
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal memberikan tugas');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateAssignment = async (id, payload, isExtension = false) => {
        try {
            setUpdating(id);
            if (isExtension) {
                await api.post(`/personnel/assignments/${id}/handle-extension`, { status: payload.extensionStatus });
            } else {
                await api.put(`/personnel/assignments/${id}/status`, payload);
            }
            fetchAssignments();
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal memperbarui tugas');
        } finally {
            setUpdating(null);
        }
    };

    const handleRequestExtension = async (e) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            await api.post(`/personnel/assignments/${extensionModal.assignment.id}/request-extension`, {
                requestedDate: extensionModal.requestedDate,
                reason: extensionModal.reason
            });
            setExtensionModal({ show: false, assignment: null, requestedDate: '', reason: '' });
            fetchAssignments();
            alert('Permohonan penundaan berhasil dikirim');
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal mengirim permohonan');
        } finally {
            setSubmitting(false);
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
                    <div className="flex gap-1 overflow-x-auto pb-2 md:pb-0 scrollbar-hide bg-slate-100/50 p-1 rounded-xl w-full md:w-auto">
                        {['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED'].map((s) => (
                            <button
                                key={s}
                                onClick={() => setFilterStatus(s)}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all whitespace-nowrap ${filterStatus === s ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
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
            {/* Extension Request Modal */}
            {extensionModal.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">Ajukan Penundaan</h3>
                            <button onClick={() => setExtensionModal({ ...extensionModal, show: false })} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleRequestExtension} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Usulan Deadline Baru</label>
                                <input 
                                    type="date" 
                                    required 
                                    value={extensionModal.requestedDate} 
                                    onChange={e => setExtensionModal({ ...extensionModal, requestedDate: e.target.value })}
                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none" 
                                />
                                <p className="text-[10px] text-slate-400 italic px-1 italic">Deadline asal: {new Date(extensionModal.assignment.dueDate).toLocaleDateString('id-ID')}</p>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Alasan Penundaan</label>
                                <textarea 
                                    required 
                                    value={extensionModal.reason}
                                    onChange={e => setExtensionModal({ ...extensionModal, reason: e.target.value })}
                                    placeholder="Jelaskan alasan memerlukan waktu tambahan..."
                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-amber-500 outline-none h-24 italic"
                                />
                            </div>
                            
                            <button 
                                type="submit" 
                                disabled={submitting}
                                className="w-full py-4 bg-amber-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-amber-600/20 hover:bg-amber-700 transition-all flex items-center justify-center gap-2"
                            >
                                {submitting ? <Loader2 size={20} className="animate-spin" /> : 'KIRIM PENGAJUAN'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PersonnelAssignments;
