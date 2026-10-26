import React, { useState, useMemo } from 'react';
import { 
    Calendar, CheckCircle2, AlertCircle, CheckSquare, ChevronDown, ChevronUp,
    Plus, X, RotateCcw, Edit2, Trash2, Layers, Clock, AlertTriangle, 
    Camera, Loader2, Save, Target, Sparkles, Wand2, Undo2, Briefcase, FolderGit2,
    ArrowRight, Search, Filter, Check, Sliders, ShieldAlert, ListTodo, FileText
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import api from '../../../lib/axios';
import { getMediaUrl } from '../../../lib/media';
import { DIVISION_TAGS, ROUTINE_TEMPLATES } from '../constants';

dayjs.locale('id');

const DailyReportFormTab = ({
    user,
    userDivision,
    selectedDate,
    setSelectedDate,
    // 4 Pilar Metode PPP
    completedItems = [],
    setCompletedItems = () => {},
    inProgressItems = [],
    setInProgressItems = () => {},
    hasObstacle = false,
    setHasObstacle = () => {},
    obstacleItems = [],
    setObstacleItems = () => {},
    tomorrowPlans = [],
    setTomorrowPlans = () => {},
    personalStats,
    saving,
    handleSaveReport,
    uploadingPhotoIndex,
    setCameraModalConfig,
    handlePhotoUpload,
    handleRemovePhoto,
    setLightboxPhoto,
    // Templates management
    staffCustomTemplates = [],
    saveStaffTemplates,
    handleResetToDefaultTemplates,
    newTemplateText,
    setNewTemplateText,
    newTemplateCategory,
    setNewTemplateCategory,
    isAddingTemplate,
    setIsAddingTemplate,
    handleAddCustomTemplate,
    editingTemplateId,
    setEditingTemplateId,
    editingTemplateText,
    setEditingTemplateText,
    handleSaveEditTemplate,
    handleDeleteCustomTemplate,
    // Accordion toggles
    showTemplateAccordion,
    setShowTemplateAccordion,
    showAllTemplates,
    setShowAllTemplates,
    showMissedDates,
    setShowMissedDates,
    // Routine & assignments & plans
    assignments = [],
    convertTaskToReport,
    plans = [],
    userProjects = [],
    userWeeklyPlans = [],
    convertPlanItemToReport,
    applyRoutine
}) => {
    // State for AI Polish feature
    const [polishingKey, setPolishingKey] = useState(null);
    const [originalHistory, setOriginalHistory] = useState({});
    
    // Drawers & Accordions
    const [showTaskDrawer, setShowTaskDrawer] = useState(false);
    const [showPlanDrawer, setShowPlanDrawer] = useState(false);
    const [planDrawerFilter, setPlanDrawerFilter] = useState('ALL'); // 'ALL' | 'WEEKLY' | 'PROJECT'
    const [taskSearch, setTaskSearch] = useState('');
    
    // Filter view for mobile (ALL, COMPLETED, IN_PROGRESS, OBSTACLE, TOMORROW)
    const [activePillarTab, setActivePillarTab] = useState('ALL');

    // Polish activity text with Gemini AI
    const handlePolishText = async (index, targetPillar = 'COMPLETED') => {
        let item = null;
        if (targetPillar === 'COMPLETED') item = completedItems[index];
        else if (targetPillar === 'IN_PROGRESS') item = inProgressItems[index];
        else if (targetPillar === 'OBSTACLE') item = obstacleItems[index];
        else if (targetPillar === 'TOMORROW') item = tomorrowPlans[index];

        const textToPolish = item?.title || item?.text || item?.obstacleNote || '';
        if (!textToPolish || !textToPolish.trim()) return;

        const key = `${targetPillar}-${index}`;
        try {
            setPolishingKey(key);
            const res = await api.post('/laporan/ai/polish-text', {
                text: textToPolish,
                categoryTag: item.categoryTag || userDivision || 'UMUM',
                mode: targetPillar === 'OBSTACLE' ? 'obstacle' : 'activity'
            });

            if (res.data?.success && res.data?.polished) {
                setOriginalHistory(prev => ({
                    ...prev,
                    [key]: textToPolish
                }));

                if (targetPillar === 'COMPLETED') {
                    const updated = [...completedItems];
                    updated[index] = { ...updated[index], title: res.data.polished };
                    setCompletedItems(updated);
                } else if (targetPillar === 'IN_PROGRESS') {
                    const updated = [...inProgressItems];
                    updated[index] = { ...updated[index], title: res.data.polished };
                    setInProgressItems(updated);
                } else if (targetPillar === 'OBSTACLE') {
                    const updated = [...obstacleItems];
                    updated[index] = { ...updated[index], obstacleNote: res.data.polished };
                    setObstacleItems(updated);
                } else if (targetPillar === 'TOMORROW') {
                    const updated = [...tomorrowPlans];
                    updated[index] = { ...updated[index], title: res.data.polished };
                    setTomorrowPlans(updated);
                }
            }
        } catch (err) {
            console.error('AI Polish error:', err);
        } finally {
            setPolishingKey(null);
        }
    };

    const handleUndoPolish = (index, targetPillar = 'COMPLETED') => {
        const key = `${targetPillar}-${index}`;
        const prevText = originalHistory[key];
        if (!prevText) return;

        if (targetPillar === 'COMPLETED') {
            const updated = [...completedItems];
            updated[index] = { ...updated[index], title: prevText };
            setCompletedItems(updated);
        } else if (targetPillar === 'IN_PROGRESS') {
            const updated = [...inProgressItems];
            updated[index] = { ...updated[index], title: prevText };
            setInProgressItems(updated);
        } else if (targetPillar === 'OBSTACLE') {
            const updated = [...obstacleItems];
            updated[index] = { ...updated[index], obstacleNote: prevText };
            setObstacleItems(updated);
        } else if (targetPillar === 'TOMORROW') {
            const updated = [...tomorrowPlans];
            updated[index] = { ...updated[index], title: prevText };
            setTomorrowPlans(updated);
        }

        setOriginalHistory(prev => {
            const copy = { ...prev };
            delete copy[key];
            return copy;
        });
    };

    // Filtered assignments for drawer
    const filteredAssignments = useMemo(() => {
        return (assignments || []).filter(a => {
            if (a.status === 'COMPLETED') return false;
            if (!taskSearch) return true;
            const q = taskSearch.toLowerCase();
            return (a.title || '').toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q);
        });
    }, [assignments, taskSearch]);

    // Counters
    const validCompletedCount = completedItems.filter(i => (i.title && i.title.trim()) || (i.photos && i.photos.length > 0)).length;
    const validInProgressCount = inProgressItems.filter(i => (i.title && i.title.trim()) || (i.photos && i.photos.length > 0)).length;
    const validObstacleCount = hasObstacle ? obstacleItems.filter(o => (o.title && o.title.trim()) || (o.obstacleNote && o.obstacleNote.trim())).length : 0;
    const validTomorrowCount = tomorrowPlans.filter(t => t.title && t.title.trim()).length;

    // Pastikan format selectedDate selalu string 'YYYY-MM-DD' yang valid
    const safeSelectedDate = useMemo(() => {
        if (typeof selectedDate === 'string' && dayjs(selectedDate).isValid()) {
            return selectedDate;
        }
        if (selectedDate && typeof selectedDate === 'object' && selectedDate.date && dayjs(selectedDate.date).isValid()) {
            return selectedDate.date;
        }
        return dayjs().format('YYYY-MM-DD');
    }, [selectedDate]);

    return (
        <div className="space-y-6">
            {/* 1. PERINGATAN TANGGAL KOSONG (LAPORAN SUSULAN) */}
            {personalStats?.missedDates && personalStats.missedDates.length > 0 && (
                <div className="bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-200/80 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs animate-in fade-in">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                            <span className="p-2.5 rounded-2xl bg-rose-500 text-white shrink-0 shadow-xs mt-0.5">
                                <AlertTriangle size={20} />
                            </span>
                            <div className="space-y-1">
                                <h3 className="text-sm font-black text-rose-900 tracking-tight">
                                    Laporan Harian Belum Terisi ({personalStats.missedDates.length} Hari Kerja Terakhir)
                                </h3>
                                <p className="text-xs text-rose-700/90 leading-relaxed font-medium">
                                    Sistem mendeteksi ada hari kerja di mana Anda belum mengisi laporan. Klik salah satu tanggal di bawah ini untuk mengisi laporan susulan:
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowMissedDates(!showMissedDates)}
                            className="text-xs font-bold text-rose-700 hover:text-rose-900 underline flex items-center gap-1 shrink-0 cursor-pointer pt-1"
                        >
                            {showMissedDates ? 'Sembunyikan' : 'Lihat Tanggal'}
                            <ChevronDown size={14} className={`transform transition-transform ${showMissedDates ? 'rotate-180' : ''}`} />
                        </button>
                    </div>

                    {showMissedDates && (
                        <div className="mt-4 pt-3 border-t border-rose-200/60 flex flex-wrap gap-2">
                            {personalStats.missedDates.map((mItem, idx) => {
                                const actualDateStr = typeof mItem === 'string' ? mItem : (mItem?.date || '');
                                const labelText = mItem?.formattedDate || 
                                    (actualDateStr && dayjs(actualDateStr).isValid() 
                                        ? dayjs(actualDateStr).format('dddd, DD MMMM YYYY') 
                                        : 'Tanggal Tidak Valid');
                                const isSelected = safeSelectedDate === actualDateStr;

                                return (
                                    <button
                                        key={actualDateStr || idx}
                                        type="button"
                                        onClick={() => setSelectedDate(actualDateStr)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                                            isSelected
                                                ? 'bg-rose-600 text-white ring-2 ring-rose-400 font-black'
                                                : 'bg-white text-rose-800 border border-rose-200 hover:bg-rose-100/70'
                                        }`}
                                    >
                                        <Calendar size={12} />
                                        <span>{labelText}</span>
                                        {mItem?.status === 'PARSIAL' && (
                                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold ml-0.5">
                                                Sebagian
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* 2. TOP HEADER: DATE PICKER & QUICK STATS */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                        <button
                            type="button"
                            onClick={() => setSelectedDate(dayjs(safeSelectedDate).subtract(1, 'day').format('YYYY-MM-DD'))}
                            className="p-1.5 rounded-xl text-slate-600 hover:bg-white hover:text-slate-900 transition-all cursor-pointer"
                            title="Hari Sebelumnya"
                        >
                            &larr;
                        </button>
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-xl shadow-2xs text-xs font-black text-slate-800">
                            <Calendar size={14} className="text-emerald-600" />
                            <span>{dayjs(safeSelectedDate).format('dddd, DD MMMM YYYY')}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSelectedDate(dayjs(safeSelectedDate).add(1, 'day').format('YYYY-MM-DD'))}
                            disabled={safeSelectedDate === dayjs().format('YYYY-MM-DD')}
                            className="p-1.5 rounded-xl text-slate-600 hover:bg-white hover:text-slate-900 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Hari Berikutnya"
                        >
                            &rarr;
                        </button>
                    </div>

                    {safeSelectedDate !== dayjs().format('YYYY-MM-DD') && (
                        <button
                            type="button"
                            onClick={() => setSelectedDate(dayjs().format('YYYY-MM-DD'))}
                            className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-black transition-all cursor-pointer border border-emerald-200/70"
                        >
                            Kembali ke Hari Ini
                        </button>
                    )}
                </div>

                {/* Ringkasan 4 Pilar PPP Counter */}
                <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 md:pb-0">
                    <div className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-1.5 text-[11px] font-black text-emerald-700">
                        <CheckCircle2 size={13} /> Selesai: {validCompletedCount}
                    </div>
                    <div className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-1.5 text-[11px] font-black text-amber-700">
                        <Clock size={13} /> On-Progress: {validInProgressCount}
                    </div>
                    <div className={`px-2.5 py-1 rounded-xl flex items-center gap-1.5 text-[11px] font-black border ${
                        hasObstacle ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}>
                        <AlertTriangle size={13} /> Kendala: {hasObstacle ? validObstacleCount : 'Nihil'}
                    </div>
                    <div className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center gap-1.5 text-[11px] font-black text-indigo-700">
                        <Target size={13} /> Rencana Besok: {validTomorrowCount}
                    </div>
                </div>
            </div>

            {/* 3. QUICK ACTIONS: DRAWER TARIK DARI PENUGASAN, RENCANA KERJA & TEMPLATE */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Tombol Buka Penugasan */}
                <button
                    type="button"
                    onClick={() => { setShowTaskDrawer(!showTaskDrawer); setShowPlanDrawer(false); setShowTemplateAccordion(false); }}
                    className={`p-3.5 rounded-2xl border transition-all text-left flex items-center justify-between cursor-pointer ${
                        showTaskDrawer ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                >
                    <div className="flex items-center gap-2.5">
                        <span className={`p-2 rounded-xl ${showTaskDrawer ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'}`}>
                            <Briefcase size={16} />
                        </span>
                        <div>
                            <p className="text-xs font-black">Tarik dari Penugasan</p>
                            <p className={`text-[10px] ${showTaskDrawer ? 'text-white/80' : 'text-slate-400'}`}>
                                {filteredAssignments.length} Tugas pimpinan aktif
                            </p>
                        </div>
                    </div>
                    <ChevronDown size={16} className={`transform transition-transform ${showTaskDrawer ? 'rotate-180' : ''}`} />
                </button>

                {/* Tombol Buka Rencana Kerja / Project */}
                <button
                    type="button"
                    onClick={() => { setShowPlanDrawer(!showPlanDrawer); setShowTaskDrawer(false); setShowTemplateAccordion(false); }}
                    className={`p-3.5 rounded-2xl border transition-all text-left flex items-center justify-between cursor-pointer ${
                        showPlanDrawer ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                >
                    <div className="flex items-center gap-2.5">
                        <span className={`p-2 rounded-xl ${showPlanDrawer ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                            <FolderGit2 size={16} />
                        </span>
                        <div>
                            <p className="text-xs font-black">Tarik dari Rencana Kerja</p>
                            <p className={`text-[10px] ${showPlanDrawer ? 'text-white/80' : 'text-slate-400'}`}>
                                {(userWeeklyPlans.length + userProjects.length)} Program aktif
                            </p>
                        </div>
                    </div>
                    <ChevronDown size={16} className={`transform transition-transform ${showPlanDrawer ? 'rotate-180' : ''}`} />
                </button>

                {/* Tombol Buka Template Rutin */}
                <button
                    type="button"
                    onClick={() => { setShowTemplateAccordion(!showTemplateAccordion); setShowTaskDrawer(false); setShowPlanDrawer(false); }}
                    className={`p-3.5 rounded-2xl border transition-all text-left flex items-center justify-between cursor-pointer ${
                        showTemplateAccordion ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                >
                    <div className="flex items-center gap-2.5">
                        <span className={`p-2 rounded-xl ${showTemplateAccordion ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
                            <ListTodo size={16} />
                        </span>
                        <div>
                            <p className="text-xs font-black">Kegiatan Rutin & Template</p>
                            <p className={`text-[10px] ${showTemplateAccordion ? 'text-white/80' : 'text-slate-400'}`}>
                                Salin tugas harian standar
                            </p>
                        </div>
                    </div>
                    <ChevronDown size={16} className={`transform transition-transform ${showTemplateAccordion ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {/* EXPANDABLE DRAWER: TARIK DARI PENUGASAN */}
            {showTaskDrawer && (
                <div className="bg-white p-4 sm:p-5 rounded-3xl border border-blue-200 shadow-md space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <h4 className="text-xs font-black text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                            <Briefcase size={14} className="text-blue-600" /> Pilih Penugasan untuk Ditarik ke Laporan Hari Ini
                        </h4>
                        <div className="w-48 sm:w-64">
                            <input
                                type="text"
                                placeholder="Cari penugasan..."
                                value={taskSearch}
                                onChange={(e) => setTaskSearch(e.target.value)}
                                className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {filteredAssignments.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-3 text-center">Tidak ada penugasan pimpinan yang aktif saat ini.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                            {filteredAssignments.map(task => (
                                <div key={task.id} className="p-3 bg-slate-50 hover:bg-blue-50/50 border border-slate-200/80 rounded-2xl space-y-2 transition-all">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="space-y-0.5 flex-1 min-w-0">
                                            <span className="px-2 py-0.5 bg-white border border-slate-200 text-slate-600 rounded text-[9px] font-black uppercase">
                                                {task.category || 'UMUM'}
                                            </span>
                                            <h5 className="text-xs font-bold text-slate-800 leading-snug line-clamp-1">{task.title}</h5>
                                            {task.description && <p className="text-[11px] text-slate-500 line-clamp-1">{task.description}</p>}
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${task.priority === 'TINGGI' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'}`}>
                                            {task.priority || 'SEDANG'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                                        <span className="text-[10px] text-slate-400 font-medium">
                                            {task.dueDate && dayjs(task.dueDate).isValid() ? `Tenggat: ${dayjs(task.dueDate).format('DD/MM/YYYY')}` : 'Tanpa tenggat'}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => { convertTaskToReport(task, 'COMPLETED'); setShowTaskDrawer(false); }}
                                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                                title="Tarik ke Pekerjaan Selesai (100%)"
                                            >
                                                🟢 Selesai
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { convertTaskToReport(task, 'IN_PROGRESS'); setShowTaskDrawer(false); }}
                                                className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                                title="Tarik ke Pekerjaan On-Progress"
                                            >
                                                🟡 Proses
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { convertTaskToReport(task, 'TOMORROW'); setShowTaskDrawer(false); }}
                                                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                                title="Tarik ke Rencana Kerja Besok"
                                            >
                                                🟣 Besok
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* EXPANDABLE DRAWER: TARIK DARI RENCANA KERJA / PROJECT */}
            {showPlanDrawer && (
                <div className="bg-white p-4 sm:p-5 rounded-3xl border border-indigo-200 shadow-md space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <h4 className="text-xs font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                            <FolderGit2 size={14} className="text-indigo-600" /> Tarik Butir dari Rencana Pekanan / Project Anda
                        </h4>
                        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-[10px] font-bold">
                            <button
                                type="button"
                                onClick={() => setPlanDrawerFilter('ALL')}
                                className={`px-2 py-1 rounded-lg transition-all ${planDrawerFilter === 'ALL' ? 'bg-white text-indigo-700 shadow-2xs font-black' : 'text-slate-500'}`}
                            >
                                Semua
                            </button>
                            <button
                                type="button"
                                onClick={() => setPlanDrawerFilter('WEEKLY')}
                                className={`px-2 py-1 rounded-lg transition-all ${planDrawerFilter === 'WEEKLY' ? 'bg-white text-indigo-700 shadow-2xs font-black' : 'text-slate-500'}`}
                            >
                                Pekanan
                            </button>
                            <button
                                type="button"
                                onClick={() => setPlanDrawerFilter('PROJECT')}
                                className={`px-2 py-1 rounded-lg transition-all ${planDrawerFilter === 'PROJECT' ? 'bg-white text-indigo-700 shadow-2xs font-black' : 'text-slate-500'}`}
                            >
                                Project
                            </button>
                        </div>
                    </div>

                    {((planDrawerFilter === 'PROJECT' ? [] : userWeeklyPlans).length === 0 && (planDrawerFilter === 'WEEKLY' ? [] : userProjects).length === 0) ? (
                        <p className="text-xs text-slate-400 italic py-3 text-center">Belum ada rencana pekanan atau project yang terdaftar.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                            {[
                                ...(planDrawerFilter !== 'PROJECT' ? userWeeklyPlans : []),
                                ...(planDrawerFilter !== 'WEEKLY' ? userProjects : [])
                            ].map(plan => {
                                const items = Array.isArray(plan.items) ? plan.items : [];
                                return (
                                    <div key={plan.id} className="p-3 bg-slate-50 hover:bg-indigo-50/40 border border-slate-200/80 rounded-2xl space-y-2 transition-all">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="space-y-0.5 flex-1 min-w-0">
                                                <div className="flex items-center gap-1">
                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${plan.isProject ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {plan.isProject ? '📁 Project' : '📅 Pekanan'}
                                                    </span>
                                                    <span className="px-2 py-0.5 bg-white border border-slate-200 text-slate-600 rounded text-[9px] font-black uppercase">
                                                        {plan.categoryTag || 'UMUM'}
                                                    </span>
                                                </div>
                                                <h5 className="text-xs font-bold text-slate-800 leading-snug">{plan.title}</h5>
                                                {plan.targetOutput && <p className="text-[10px] text-emerald-700 font-bold">🎯 Output: {plan.targetOutput}</p>}
                                            </div>
                                            <span className="text-xs font-black text-indigo-600 shrink-0">{plan.percentage || 0}%</span>
                                        </div>

                                        {/* Sub-item langkah jika ada */}
                                        {items.length > 0 ? (
                                            <div className="space-y-1.5 pt-1.5 border-t border-slate-200/70">
                                                {items.map((sub, sIdx) => (
                                                    <div key={sIdx} className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                                                        <span className="text-[11px] font-medium text-slate-700 truncate flex-1">
                                                            {sIdx + 1}. {sub.activity || sub.text || sub.title}
                                                        </span>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => { convertPlanItemToReport(plan, sub, sIdx, 'COMPLETED'); setShowPlanDrawer(false); }}
                                                                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[9px] font-bold transition-all cursor-pointer"
                                                                title="Tarik Langkah ke Selesai"
                                                            >
                                                                🟢 Selesai
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => { convertPlanItemToReport(plan, sub, sIdx, 'IN_PROGRESS'); setShowPlanDrawer(false); }}
                                                                className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-[9px] font-bold transition-all cursor-pointer"
                                                                title="Tarik Langkah ke On-Progress"
                                                            >
                                                                🟡 Proses
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => { convertPlanItemToReport(plan, sub, sIdx, 'TOMORROW'); setShowPlanDrawer(false); }}
                                                                className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[9px] font-bold transition-all cursor-pointer"
                                                                title="Tarik Langkah ke Rencana Besok"
                                                            >
                                                                🟣 Besok
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-200/60">
                                                <button
                                                    type="button"
                                                    onClick={() => { convertPlanItemToReport(plan, null, null, 'COMPLETED'); setShowPlanDrawer(false); }}
                                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                                >
                                                    🟢 Tarik Selesai
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { convertPlanItemToReport(plan, null, null, 'IN_PROGRESS'); setShowPlanDrawer(false); }}
                                                    className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                                >
                                                    🟡 Tarik On-Progress
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { convertPlanItemToReport(plan, null, null, 'TOMORROW'); setShowPlanDrawer(false); }}
                                                    className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                                >
                                                    🟣 Tarik Rencana Besok
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* EXPANDABLE ACCORDION: TEMPLATE RUTIN */}
            {showTemplateAccordion && (
                <div className="bg-white p-4 sm:p-5 rounded-3xl border border-emerald-200 shadow-md space-y-4 animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                            <ListTodo size={14} className="text-emerald-600" /> Template Rutin Bidang Sarpras
                        </h4>
                        <button
                            type="button"
                            onClick={() => setIsAddingTemplate(!isAddingTemplate)}
                            className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
                        >
                            <Plus size={13} /> Tambah Template Baru
                        </button>
                    </div>

                    {isAddingTemplate && (
                        <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-2">
                            <input
                                type="text"
                                placeholder="Tuliskan butir kegiatan rutin baru..."
                                value={newTemplateText}
                                onChange={(e) => setNewTemplateText(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                            />
                            <div className="flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAddingTemplate(false)}
                                    className="px-3 py-1 text-slate-500 text-xs font-bold cursor-pointer"
                                >
                                    Batal
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAddCustomTemplate}
                                    className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-all cursor-pointer"
                                >
                                    Simpan Template
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                        {(ROUTINE_TEMPLATES[userDivision] || ROUTINE_TEMPLATES.UMUM || []).map((text, idx) => (
                            <div key={idx} className="p-2.5 bg-slate-50 hover:bg-emerald-50/50 border border-slate-200/80 rounded-xl flex items-center justify-between gap-2">
                                <span className="text-xs text-slate-700 font-medium truncate flex-1">{text}</span>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => { applyRoutine(text, userDivision, 'COMPLETED'); setShowTemplateAccordion(false); }}
                                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                                        title="Salin ke Pekerjaan Selesai"
                                    >
                                        + Selesai
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { applyRoutine(text, userDivision, 'TOMORROW'); setShowTemplateAccordion(false); }}
                                        className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                                        title="Salin ke Rencana Besok"
                                    >
                                        + Besok
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* MOBILE NAVIGATION PILLS */}
            <div className="flex sm:hidden items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 overflow-x-auto gap-1">
                <button
                    type="button"
                    onClick={() => setActivePillarTab('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                        activePillarTab === 'ALL' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'
                    }`}
                >
                    Semua ({validCompletedCount + validInProgressCount + validObstacleCount + validTomorrowCount})
                </button>
                <button
                    type="button"
                    onClick={() => setActivePillarTab('COMPLETED')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                        activePillarTab === 'COMPLETED' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500'
                    }`}
                >
                    🟢 Selesai ({completedItems.length})
                </button>
                <button
                    type="button"
                    onClick={() => setActivePillarTab('IN_PROGRESS')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                        activePillarTab === 'IN_PROGRESS' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-500'
                    }`}
                >
                    🟡 On-Progress ({inProgressItems.length})
                </button>
                <button
                    type="button"
                    onClick={() => setActivePillarTab('OBSTACLE')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                        activePillarTab === 'OBSTACLE' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-500'
                    }`}
                >
                    🔴 Kendala ({hasObstacle ? obstacleItems.length : 0})
                </button>
                <button
                    type="button"
                    onClick={() => setActivePillarTab('TOMORROW')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                        activePillarTab === 'TOMORROW' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500'
                    }`}
                >
                    🟣 Rencana Besok ({tomorrowPlans.length})
                </button>
            </div>

            {/* 4. FORMULIR 4 PILAR METODE PPP */}
            <div className="space-y-6">
                {/* ============================================================== */}
                {/* PILAR A: 🟢 PROGRESS - PEKERJAAN SELESAI HARI INI */}
                {/* ============================================================== */}
                <div className={`bg-white p-4 sm:p-6 rounded-3xl border border-emerald-200/80 shadow-sm space-y-4 ${
                    activePillarTab !== 'ALL' && activePillarTab !== 'COMPLETED' ? 'hidden sm:block' : 'block'
                }`}>
                    <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                        <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                                <CheckCircle2 size={18} />
                            </span>
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                    <span>A. Pekerjaan Selesai Hari Ini</span>
                                    <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                                        {completedItems.length} Butir
                                    </span>
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium">
                                    Tugas dan kegiatan yang tuntas 100% hari ini beserta capaian output nyata
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setCompletedItems([
                                ...completedItems, 
                                { title: '', output: '', categoryTag: userDivision || 'UMUM', photos: [] }
                            ])}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
                        >
                            <Plus size={14} /> <span>Tambah Selesai</span>
                        </button>
                    </div>

                    <div className="space-y-4">
                        {completedItems.map((item, index) => (
                            <div key={`c-${index}`} className="p-4 bg-emerald-50/30 border border-emerald-100 rounded-2xl space-y-3">
                                {/* Baris 1: Nomor, Kategori, Badge Sumber & Hapus */}
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center justify-center shrink-0 shadow-xs">
                                            {index + 1}
                                        </span>
                                        <select
                                            value={item.categoryTag || userDivision || 'UMUM'}
                                            onChange={(e) => {
                                                const n = [...completedItems];
                                                n[index].categoryTag = e.target.value;
                                                setCompletedItems(n);
                                            }}
                                            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                                        >
                                            {DIVISION_TAGS.map(d => (
                                                <option key={d.key} value={d.key}>{d.label}</option>
                                            ))}
                                        </select>
                                        {item.sourceType === 'ASSIGNMENT' && (
                                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded-xl">
                                                📋 Dari Penugasan
                                            </span>
                                        )}
                                        {item.sourceType === 'PROJECT' && (
                                            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-1 rounded-xl">
                                                📁 Dari Project
                                            </span>
                                        )}
                                        {item.sourceType === 'PLAN' && (
                                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-xl">
                                                📅 Dari Rencana Pekanan
                                            </span>
                                        )}
                                    </div>
                                    {completedItems.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => setCompletedItems(completedItems.filter((_, i) => i !== index))}
                                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                                            title="Hapus butir pekerjaan ini"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    )}
                                </div>

                                {/* Baris 2: Input Aktivitas + AI Polish */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[11px] font-bold text-slate-600">Uraian Pekerjaan Tuntas:</label>
                                        <div className="flex items-center gap-1.5">
                                            {originalHistory[`COMPLETED-${index}`] && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleUndoPolish(index, 'COMPLETED')}
                                                    className="text-[10px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                                                    title="Kembalikan teks asli sebelum dipoles AI"
                                                >
                                                    <Undo2 size={11} /> Undo AI
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => handlePolishText(index, 'COMPLETED')}
                                                disabled={polishingKey === `COMPLETED-${index}` || !item.title?.trim()}
                                                className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer border border-indigo-200/70 disabled:opacity-40"
                                                title="Perbaiki redaksi kalimat agar formal untuk pelaporan pimpinan"
                                            >
                                                {polishingKey === `COMPLETED-${index}` ? (
                                                    <Loader2 size={11} className="animate-spin text-indigo-600" />
                                                ) : (
                                                    <Wand2 size={11} className="text-indigo-600" />
                                                )}
                                                <span>AI Polish</span>
                                            </button>
                                        </div>
                                    </div>
                                    <textarea
                                        rows="2"
                                        placeholder="Contoh: Pembersihan filter dan pengecekan kebocoran pipa AC ruang kelas 7A..."
                                        value={item.title}
                                        onChange={(e) => {
                                            const n = [...completedItems];
                                            n[index].title = e.target.value;
                                            setCompletedItems(n);
                                        }}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>

                                {/* Baris 3: Target Capaian / Output */}
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                                        <Target size={12} className="text-emerald-600" /> Hasil Terukur / Capaian Output:
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Contoh: Unit AC kembali dingin optimal (suhu 18°C), ruangan sejuk tanpa kebocoran air"
                                        value={item.output || ''}
                                        onChange={(e) => {
                                            const n = [...completedItems];
                                            n[index].output = e.target.value;
                                            setCompletedItems(n);
                                        }}
                                        className="w-full px-3 py-1.5 bg-white border border-emerald-200/80 rounded-xl text-xs font-bold text-emerald-900 placeholder:text-slate-300 outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>

                                {/* Baris 4: Foto Bukti Lapangan */}
                                <div className="space-y-1.5 pt-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                            <Camera size={12} /> Foto Dokumentasi Lapangan (Maks. 5 Foto)
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => setCameraModalConfig({ isOpen: true, index, period: 'completed' })}
                                                className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                                            >
                                                <Camera size={11} /> Ambil Foto Langsung
                                            </button>
                                            <label className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs">
                                                <span>+ Unggah Berkas</span>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handlePhotoUpload(index, file, 'completed');
                                                    }}
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    {/* Thumbnail Foto */}
                                    {item.photos && item.photos.length > 0 && (
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {item.photos.map((ph, pIdx) => {
                                                const url = ph.url || ph;
                                                return (
                                                    <div key={pIdx} className="relative group w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shadow-2xs">
                                                        <img
                                                            src={getMediaUrl(url)}
                                                            alt="Bukti Selesai"
                                                            onClick={() => setLightboxPhoto(getMediaUrl(url))}
                                                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemovePhoto(index, pIdx, 'completed')}
                                                            className="absolute top-1 right-1 p-0.5 bg-rose-600 text-white rounded-md shadow-xs opacity-90 hover:opacity-100 cursor-pointer"
                                                            title="Hapus foto ini"
                                                        >
                                                            <X size={10} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        <button
                            type="button"
                            onClick={() => setCompletedItems([
                                ...completedItems, 
                                { title: '', output: '', categoryTag: userDivision || 'UMUM', photos: [] }
                            ])}
                            className="w-full py-2.5 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 border border-dashed border-emerald-300 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                        >
                            <Plus size={15} /> Tambah Butir Pekerjaan Selesai
                        </button>
                    </div>
                </div>

                {/* ============================================================== */}
                {/* PILAR B: 🟡 PROGRESS - SEDANG DIKERJAKAN (ON-PROGRESS) */}
                {/* ============================================================== */}
                <div className={`bg-white p-4 sm:p-6 rounded-3xl border border-amber-200/80 shadow-sm space-y-4 ${
                    activePillarTab !== 'ALL' && activePillarTab !== 'IN_PROGRESS' ? 'hidden sm:block' : 'block'
                }`}>
                    <div className="flex items-center justify-between border-b border-amber-100 pb-3">
                        <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                                <Clock size={18} />
                            </span>
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                    <span>B. Pekerjaan Sedang Dikerjakan (On-Progress)</span>
                                    <span className="text-[10px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                                        {inProgressItems.length} Butir
                                    </span>
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium">
                                    Pekerjaan bertahap atau belum tuntas 100% yang akan dilanjutkan berikutnya
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setInProgressItems([
                                ...inProgressItems, 
                                { title: '', progressPercentage: 50, targetDate: 'Hari kerja berikutnya', categoryTag: userDivision || 'UMUM', photos: [] }
                            ])}
                            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
                        >
                            <Plus size={14} /> <span>Tambah On-Progress</span>
                        </button>
                    </div>

                    {inProgressItems.length === 0 ? (
                        <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center space-y-1">
                            <p className="text-xs text-slate-500 font-bold">Tidak ada pekerjaan yang tertunda / on-progress.</p>
                            <p className="text-[11px] text-slate-400">Klik tombol di atas jika ada tugas yang baru dikerjakan sebagian hari ini.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {inProgressItems.map((item, index) => (
                                <div key={`p-${index}`} className="p-4 bg-amber-50/30 border border-amber-100 rounded-2xl space-y-3">
                                    {/* Baris 1: Nomor, Kategori, Badges & Hapus */}
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <span className="w-7 h-7 rounded-xl bg-amber-500 text-white text-xs font-black flex items-center justify-center shrink-0 shadow-xs">
                                                {index + 1}
                                            </span>
                                            <select
                                                value={item.categoryTag || userDivision || 'UMUM'}
                                                onChange={(e) => {
                                                    const n = [...inProgressItems];
                                                    n[index].categoryTag = e.target.value;
                                                    setInProgressItems(n);
                                                }}
                                                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                                            >
                                                {DIVISION_TAGS.map(d => (
                                                    <option key={d.key} value={d.key}>{d.label}</option>
                                                ))}
                                            </select>
                                            {item.isFromYesterday && (
                                                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-lg">
                                                    ⚡ Dari Rencana Kemarin
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setInProgressItems(inProgressItems.filter((_, i) => i !== index))}
                                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                                            title="Hapus butir on-progress ini"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>

                                    {/* Baris 2: Input Aktivitas */}
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[11px] font-bold text-slate-600">Uraian Pekerjaan Sedang Berjalan:</label>
                                            <button
                                                type="button"
                                                onClick={() => handlePolishText(index, 'IN_PROGRESS')}
                                                disabled={polishingKey === `IN_PROGRESS-${index}` || !item.title?.trim()}
                                                className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer border border-indigo-200/70 disabled:opacity-40"
                                            >
                                                {polishingKey === `IN_PROGRESS-${index}` ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                                                <span>AI Polish</span>
                                            </button>
                                        </div>
                                        <textarea
                                            rows="2"
                                            placeholder="Contoh: Pemasangan keramik koridor sayap timur lantai 2..."
                                            value={item.title}
                                            onChange={(e) => {
                                                const n = [...inProgressItems];
                                                n[index].title = e.target.value;
                                                setInProgressItems(n);
                                            }}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                                        />
                                    </div>

                                    {/* Baris 3: Estimasi Progres % & Target Tanggal */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                                                <span className="flex items-center gap-1"><Sliders size={12} /> Estimasi Progres:</span>
                                                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md font-black">{item.progressPercentage || 50}%</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="range"
                                                    min="5"
                                                    max="95"
                                                    step="5"
                                                    value={item.progressPercentage || 50}
                                                    onChange={(e) => {
                                                        const n = [...inProgressItems];
                                                        n[index].progressPercentage = parseInt(e.target.value);
                                                        setInProgressItems(n);
                                                    }}
                                                    className="flex-1 accent-amber-600 cursor-pointer"
                                                />
                                                <div className="flex items-center gap-1">
                                                    {[25, 50, 75, 90].map(pct => (
                                                        <button
                                                            key={pct}
                                                            type="button"
                                                            onClick={() => {
                                                                const n = [...inProgressItems];
                                                                n[index].progressPercentage = pct;
                                                                setInProgressItems(n);
                                                            }}
                                                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                                                                item.progressPercentage === pct ? 'bg-amber-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                                            }`}
                                                        >
                                                            {pct}%
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                                                <Calendar size={12} className="text-amber-600" /> Target Tanggal Selesai:
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Contoh: Besok sore / 28 Oktober 2026"
                                                value={item.targetDate || ''}
                                                onChange={(e) => {
                                                    const n = [...inProgressItems];
                                                    n[index].targetDate = e.target.value;
                                                    setInProgressItems(n);
                                                }}
                                                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Baris 4: Foto Bukti Opsional */}
                                    <div className="space-y-1 pt-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                                <Camera size={12} /> Foto Kondisi Saat Ini (Opsional)
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setCameraModalConfig({ isOpen: true, index, period: 'inprogress' })}
                                                    className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Camera size={11} /> Kamera
                                                </button>
                                                <label className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer">
                                                    <span>+ Unggah</span>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) handlePhotoUpload(index, file, 'inprogress');
                                                        }}
                                                    />
                                                </label>
                                            </div>
                                        </div>

                                        {item.photos && item.photos.length > 0 && (
                                            <div className="flex flex-wrap gap-2 pt-1">
                                                {item.photos.map((ph, pIdx) => {
                                                    const url = ph.url || ph;
                                                    return (
                                                        <div key={pIdx} className="relative group w-14 h-14 rounded-xl overflow-hidden border border-slate-200">
                                                            <img
                                                                src={getMediaUrl(url)}
                                                                alt="Bukti On Progress"
                                                                onClick={() => setLightboxPhoto(getMediaUrl(url))}
                                                                className="w-full h-full object-cover cursor-pointer"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemovePhoto(index, pIdx, 'inprogress')}
                                                                className="absolute top-1 right-1 p-0.5 bg-rose-600 text-white rounded-md cursor-pointer"
                                                            >
                                                                <X size={10} />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ============================================================== */}
                {/* PILAR C: 🔴 PROBLEMS - KENDALA & HAMBATAN LAPANGAN */}
                {/* ============================================================== */}
                <div className={`bg-white p-4 sm:p-6 rounded-3xl border border-rose-200/80 shadow-sm space-y-4 ${
                    activePillarTab !== 'ALL' && activePillarTab !== 'OBSTACLE' ? 'hidden sm:block' : 'block'
                }`}>
                    <div className="flex items-center justify-between border-b border-rose-100 pb-3">
                        <div className="flex items-center gap-2.5">
                            <span className={`w-8 h-8 rounded-2xl flex items-center justify-center font-bold ${
                                hasObstacle ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                                <AlertTriangle size={18} />
                            </span>
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                    <span>C. Kendala & Hambatan Lapangan</span>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                        hasObstacle ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                                    }`}>
                                        {hasObstacle ? `${obstacleItems.length} Kendala Dilaporkan` : 'Nihil / Lancar'}
                                    </span>
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium">
                                    Laporkan hambatan teknis atau kebutuhan eskalasi agar pimpinan dapat memberikan bantuan
                                </p>
                            </div>
                        </div>

                        {/* Toggle Ada Kendala / Nihil */}
                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                            <button
                                type="button"
                                onClick={() => setHasObstacle(false)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                    !hasObstacle ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                ✅ Nihil (Lancar)
                            </button>
                            <button
                                type="button"
                                onClick={() => setHasObstacle(true)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                    hasObstacle ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                ⚠️ Ada Kendala
                            </button>
                        </div>
                    </div>

                    {!hasObstacle ? (
                        <div className="p-4 bg-emerald-50/50 border border-emerald-200/60 rounded-2xl flex items-center gap-3">
                            <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                            <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                                <strong>Alhamdulillah:</strong> Tidak ada kendala operasional yang menghambat pekerjaan hari ini.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {obstacleItems.map((obs, index) => (
                                <div key={`obs-${index}`} className="p-4 bg-rose-50/40 border border-rose-200 rounded-2xl space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="w-7 h-7 rounded-xl bg-rose-600 text-white text-xs font-black flex items-center justify-center shrink-0">
                                                {index + 1}
                                            </span>
                                            <select
                                                value={obs.categoryTag || userDivision || 'UMUM'}
                                                onChange={(e) => {
                                                    const n = [...obstacleItems];
                                                    n[index].categoryTag = e.target.value;
                                                    setObstacleItems(n);
                                                }}
                                                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                                            >
                                                {DIVISION_TAGS.map(d => (
                                                    <option key={d.key} value={d.key}>{d.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {obstacleItems.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => setObstacleItems(obstacleItems.filter((_, i) => i !== index))}
                                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl cursor-pointer"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[11px] font-bold text-rose-900">Uraian Masalah / Hambatan Lapangan:</label>
                                            <button
                                                type="button"
                                                onClick={() => handlePolishText(index, 'OBSTACLE')}
                                                disabled={polishingKey === `OBSTACLE-${index}` || !obs.obstacleNote?.trim()}
                                                className="px-2 py-0.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40"
                                            >
                                                {polishingKey === `OBSTACLE-${index}` ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                                                <span>AI Polish</span>
                                            </button>
                                        </div>
                                        <textarea
                                            rows="2"
                                            placeholder="Contoh: Stok kabel UTP Cat6 di gudang habis dan toko langganan tutup..."
                                            value={obs.obstacleNote || ''}
                                            onChange={(e) => {
                                                const n = [...obstacleItems];
                                                n[index].obstacleNote = e.target.value;
                                                n[index].title = e.target.value;
                                                setObstacleItems(n);
                                            }}
                                            className="w-full px-3 py-2 bg-white border border-rose-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-rose-500"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                                            💡 Tindakan Perbaikan / Solusi yang Diajukan (Action Plan):
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Contoh: Pengajuan pembelian darurat 1 roll kabel melalui kas kecil atau pinjam dari unit SMA"
                                            value={obs.actionPlan || ''}
                                            onChange={(e) => {
                                                const n = [...obstacleItems];
                                                n[index].actionPlan = e.target.value;
                                                setObstacleItems(n);
                                            }}
                                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-rose-500"
                                        />
                                    </div>

                                    {/* Foto Bukti Kendala */}
                                    <div className="space-y-1 pt-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                                <Camera size={12} /> Foto Bukti Kendala / Kerusakan (Opsional)
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setCameraModalConfig({ isOpen: true, index, period: 'obstacle' })}
                                                    className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg text-[10px] font-black cursor-pointer"
                                                >
                                                    <Camera size={11} /> Kamera
                                                </button>
                                                <label className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold cursor-pointer">
                                                    <span>+ Unggah</span>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) handlePhotoUpload(index, file, 'obstacle');
                                                        }}
                                                    />
                                                </label>
                                            </div>
                                        </div>

                                        {obs.photos && obs.photos.length > 0 && (
                                            <div className="flex flex-wrap gap-2 pt-1">
                                                {obs.photos.map((ph, pIdx) => {
                                                    const url = ph.url || ph;
                                                    return (
                                                        <div key={pIdx} className="relative group w-14 h-14 rounded-xl overflow-hidden border border-slate-200">
                                                            <img
                                                                src={getMediaUrl(url)}
                                                                alt="Bukti Kendala"
                                                                onClick={() => setLightboxPhoto(getMediaUrl(url))}
                                                                className="w-full h-full object-cover cursor-pointer"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemovePhoto(index, pIdx, 'obstacle')}
                                                                className="absolute top-1 right-1 p-0.5 bg-rose-600 text-white rounded-md cursor-pointer"
                                                            >
                                                                <X size={10} />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            <button
                                type="button"
                                onClick={() => setObstacleItems([
                                    ...obstacleItems, 
                                    { title: '', obstacleNote: '', actionPlan: '', categoryTag: userDivision || 'UMUM', photos: [] }
                                ])}
                                className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-dashed border-rose-300 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <Plus size={14} /> Tambah Kendala Lainnya
                            </button>
                        </div>
                    )}
                </div>

                {/* ============================================================== */}
                {/* PILAR D: 🟣 PLANS - RENCANA KERJA BESOK / HARI BERIKUTNYA */}
                {/* ============================================================== */}
                <div className={`bg-white p-4 sm:p-6 rounded-3xl border border-indigo-200/80 shadow-sm space-y-4 ${
                    activePillarTab !== 'ALL' && activePillarTab !== 'TOMORROW' ? 'hidden sm:block' : 'block'
                }`}>
                    <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
                        <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                                <Target size={18} />
                            </span>
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                    <span>D. Rencana Kerja Besok / Hari Berikutnya</span>
                                    <span className="text-[10px] font-black bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                                        Wajib Staf
                                    </span>
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium">
                                    Butir agenda ini akan otomatis ter-carry over pada laporan esok hari
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setTomorrowPlans([
                                ...tomorrowPlans, 
                                { title: '', categoryTag: userDivision || 'UMUM', priority: 'SEDANG' }
                            ])}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
                        >
                            <Plus size={14} /> <span>Tambah Rencana</span>
                        </button>
                    </div>

                    <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-center gap-2.5 text-xs text-indigo-900 font-medium">
                        <Sparkles size={16} className="text-indigo-600 shrink-0" />
                        <span>
                            Susun target agenda besok agar aktivitas kerja terarah dan otomatis siap dilaporkan pada keesokan harinya.
                        </span>
                    </div>

                    <div className="space-y-3">
                        {tomorrowPlans.map((plan, index) => (
                            <div key={`tp-${index}`} className="p-3.5 bg-indigo-50/30 border border-indigo-100 rounded-2xl space-y-2.5">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center justify-center shrink-0">
                                            {index + 1}
                                        </span>
                                        <select
                                            value={plan.categoryTag || userDivision || 'UMUM'}
                                            onChange={(e) => {
                                                const n = [...tomorrowPlans];
                                                n[index].categoryTag = e.target.value;
                                                setTomorrowPlans(n);
                                            }}
                                            className="px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                                        >
                                            {DIVISION_TAGS.map(d => (
                                                <option key={d.key} value={d.key}>{d.label}</option>
                                            ))}
                                        </select>
                                        <div className="flex items-center gap-1">
                                            {['TINGGI', 'SEDANG', 'RENDAH'].map(pri => (
                                                <button
                                                    key={pri}
                                                    type="button"
                                                    onClick={() => {
                                                        const n = [...tomorrowPlans];
                                                        n[index].priority = pri;
                                                        setTomorrowPlans(n);
                                                    }}
                                                    className={`px-2 py-0.5 rounded-lg text-[9px] font-black cursor-pointer transition-all ${
                                                        plan.priority === pri
                                                            ? (pri === 'TINGGI' ? 'bg-rose-600 text-white' : pri === 'SEDANG' ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white')
                                                            : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    {pri}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {tomorrowPlans.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => setTomorrowPlans(tomorrowPlans.filter((_, i) => i !== index))}
                                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl cursor-pointer"
                                            title="Hapus butir rencana ini"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[11px] font-bold text-slate-600">Rencana Kegiatan Besok:</label>
                                        <button
                                            type="button"
                                            onClick={() => handlePolishText(index, 'TOMORROW')}
                                            disabled={polishingKey === `TOMORROW-${index}` || !plan.title?.trim()}
                                            className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40"
                                        >
                                            {polishingKey === `TOMORROW-${index}` ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                                            <span>AI Polish</span>
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Contoh: Pengecekan unit genset dan pemeliharaan instalasi air..."
                                        value={plan.title}
                                        onChange={(e) => {
                                            const n = [...tomorrowPlans];
                                            n[index].title = e.target.value;
                                            setTomorrowPlans(n);
                                        }}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>
                        ))}

                        <button
                            type="button"
                            onClick={() => setTomorrowPlans([
                                ...tomorrowPlans, 
                                { title: '', categoryTag: userDivision || 'UMUM', priority: 'SEDANG' }
                            ])}
                            className="w-full py-2.5 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-800 border border-dashed border-indigo-300 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                        >
                            <Plus size={15} /> Tambah Butir Rencana Besok
                        </button>
                    </div>
                </div>
            </div>

            {/* 5. FLOATING / STICKY SAVE BAR */}
            <div className="fixed sm:sticky bottom-[72px] sm:bottom-4 z-[45] left-3 right-3 sm:left-auto sm:right-auto sm:flex sm:justify-end">
                <div className="w-full sm:w-auto bg-white/95 backdrop-blur-md p-3 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xl flex flex-col sm:flex-row items-center gap-3">
                    <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-slate-600 px-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>Metode PPP Terpadu</span>
                        <span className="text-slate-300">|</span>
                        <span>{dayjs(safeSelectedDate).format('DD/MM/YYYY')}</span>
                    </div>

                    <button
                        type="button"
                        onClick={handleSaveReport}
                        disabled={saving}
                        className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                        {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        <span>
                            {saving ? 'Menyimpan ke Server...' : 'Simpan Laporan Harian (PPP) & Rencana Besok'}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DailyReportFormTab;
