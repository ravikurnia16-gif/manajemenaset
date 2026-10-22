import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, Calendar, User, Tag, AlertCircle, 
    Plus, Trash2, CheckCircle2, Save, Loader2, Target, Clock, Sparkles,
    Layers, ChevronDown, ChevronUp, FolderGit2, Check
} from 'lucide-react';
import api from '../../../lib/axios';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

const PlanModal = ({ 
    isOpen, 
    onClose, 
    onSuccess, 
    staffList = [], 
    initialStaff = null, 
    initialPlan = null,
    staffPlansData = []
}) => {
    const currentUser = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
    
    // Otomatis rentang pekan depan (Senin s.d. Jumat)
    const defaultNextWeekStart = dayjs().add(1, 'week').startOf('isoWeek').format('YYYY-MM-DD');
    const defaultNextWeekEnd = dayjs().add(1, 'week').startOf('isoWeek').add(4, 'day').format('YYYY-MM-DD');

    const [userId, setUserId] = useState('');
    const [title, setTitle] = useState('');
    const [planType, setPlanType] = useState('WEEKLY'); // 'WEEKLY' | 'PROJECT'
    const [category, setCategory] = useState('UMUM');
    const [priority, setPriority] = useState('SEDANG');
    const [startDate, setStartDate] = useState(defaultNextWeekStart);
    const [endDate, setEndDate] = useState(defaultNextWeekEnd);
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState([
        { activity: '', targetDate: defaultNextWeekEnd, status: 'PENDING', percentage: 0 }
    ]);
    const [saving, setSaving] = useState(false);
    const [loadingAi, setLoadingAi] = useState(false);

    // Butir-butir rencana yang pernah dibuat sebelumnya
    const [loadedStaffPlans, setLoadedStaffPlans] = useState([]);
    const [candidateTab, setCandidateTab] = useState('RANGE'); // 'RANGE' | 'ALL_PROJECTS'
    const [isCandidateDrawerOpen, setIsCandidateDrawerOpen] = useState(true);

    // Muat data rencana & project staf jika belum ada
    useEffect(() => {
        if (isOpen && (!staffPlansData || staffPlansData.length === 0)) {
            api.get('/kinerja-manajemen/staff-plans')
                .then(res => {
                    if (res.data?.success) {
                        setLoadedStaffPlans(res.data.staff || []);
                    }
                })
                .catch(err => console.warn('Gagal memuat staff plans untuk pilihan butir:', err));
        }
    }, [isOpen, staffPlansData]);

    useEffect(() => {
        if (isOpen) {
            if (initialPlan) {
                setUserId(initialPlan.userId || (initialStaff ? initialStaff.id : ''));
                setTitle(initialPlan.title || '');
                const isProj = !!initialPlan.isProject || initialPlan.planType === 'PROJECT' || initialPlan.metadata?.isProject || initialPlan.metadata?.planType === 'PROJECT';
                setPlanType(isProj ? 'PROJECT' : 'WEEKLY');
                setCategory(initialPlan.categoryTag || initialPlan.category || 'UMUM');
                setPriority(initialPlan.priority || 'SEDANG');
                setStartDate(initialPlan.startDate ? dayjs(initialPlan.startDate).format('YYYY-MM-DD') : defaultNextWeekStart);
                const planEndDate = initialPlan.endDate ? dayjs(initialPlan.endDate).format('YYYY-MM-DD') : defaultNextWeekEnd;
                setEndDate(planEndDate);
                setNotes(initialPlan.content || '');
                const rawItems = Array.isArray(initialPlan.items) && initialPlan.items.length > 0 
                    ? initialPlan.items 
                    : [{ activity: '', targetDate: planEndDate, status: 'PENDING', percentage: 0 }];
                setItems(rawItems.map(it => {
                    let itDate = it.targetDate ? dayjs(it.targetDate).format('YYYY-MM-DD') : '';
                    if (itDate && planEndDate && dayjs(itDate).isAfter(dayjs(planEndDate), 'day')) {
                        itDate = planEndDate;
                    }
                    return {
                        activity: it.activity || it.text || it.name || '',
                        targetDate: itDate,
                        status: it.status || 'PENDING',
                        percentage: it.percentage !== undefined ? it.percentage : 0,
                        assigned: !!it.assigned,
                        assignmentId: it.assignmentId || null,
                        projectId: it.projectId || null,
                        projectItemIndex: it.projectItemIndex !== undefined ? it.projectItemIndex : null
                    };
                }));
            } else {
                setUserId(initialStaff ? initialStaff.id : (currentUser?.id || staffList[0]?.id || ''));
                setTitle('');
                setPlanType('WEEKLY');
                setCategory('UMUM');
                setPriority('SEDANG');
                // Rencana pekan depan otomatis diambil tanggal pekan depan
                setStartDate(defaultNextWeekStart);
                setEndDate(defaultNextWeekEnd);
                setNotes('');
                setItems([
                    { activity: '', targetDate: defaultNextWeekEnd, status: 'PENDING', percentage: 0 }
                ]);
            }
        }
    }, [isOpen, initialPlan, initialStaff, staffList]);

    const applyDatePreset = (presetKey) => {
        if (presetKey === 'NEXT_WEEK_5') {
            const s = dayjs().add(1, 'week').startOf('isoWeek').format('YYYY-MM-DD');
            const e = dayjs().add(1, 'week').startOf('isoWeek').add(4, 'day').format('YYYY-MM-DD');
            setStartDate(s);
            handleEndDateChange(e);
        } else if (presetKey === 'NEXT_WEEK_6') {
            const s = dayjs().add(1, 'week').startOf('isoWeek').format('YYYY-MM-DD');
            const e = dayjs().add(1, 'week').startOf('isoWeek').add(5, 'day').format('YYYY-MM-DD');
            setStartDate(s);
            handleEndDateChange(e);
        } else if (presetKey === 'THIS_WEEK') {
            const s = dayjs().startOf('isoWeek').format('YYYY-MM-DD');
            const e = dayjs().startOf('isoWeek').add(4, 'day').format('YYYY-MM-DD');
            setStartDate(s);
            handleEndDateChange(e);
        } else if (presetKey === 'ONE_MONTH') {
            const s = dayjs().format('YYYY-MM-DD');
            const e = dayjs().add(30, 'day').format('YYYY-MM-DD');
            setStartDate(s);
            handleEndDateChange(e);
        }
    };

    const handleStartDateChange = (newStartDate) => {
        setStartDate(newStartDate);
        if (newStartDate && endDate && dayjs(newStartDate).isAfter(dayjs(endDate), 'day')) {
            handleEndDateChange(dayjs(newStartDate).add(4, 'day').format('YYYY-MM-DD'));
        }
    };

    const handlePlanTypeChange = (type) => {
        setPlanType(type);
        if (!initialPlan) {
            if (type === 'WEEKLY') {
                applyDatePreset('NEXT_WEEK_5');
            } else if (type === 'PROJECT') {
                applyDatePreset('ONE_MONTH');
            }
        }
    };

    // Ekstrak butir-butir rencana yang pernah dibuat sebelumnya
    const effectiveStaffData = (staffPlansData && staffPlansData.length > 0) ? staffPlansData : loadedStaffPlans;

    const { candidateItems, matchingRangeItems, otherProjectItems } = useMemo(() => {
        const list = [];
        const seenKeys = new Set();

        const currentStaffRecord = effectiveStaffData.find(s => s.id === parseInt(userId, 10));
        const staffPlans = currentStaffRecord?.plans || [];

        const allActiveProjects = [];
        effectiveStaffData.forEach(st => {
            (st.plans || []).forEach(p => {
                if ((p.isProject || p.planType === 'PROJECT') && !allActiveProjects.some(ap => ap.id === p.id)) {
                    allActiveProjects.push(p);
                }
            });
        });

        const combinedPlans = [
            ...staffPlans,
            ...allActiveProjects.filter(ap => !staffPlans.some(sp => sp.id === ap.id))
        ];

        combinedPlans.forEach(plan => {
            if (initialPlan?.id && plan.id === initialPlan.id) return;

            const pItems = Array.isArray(plan.items) ? plan.items : [];
            const isProject = !!plan.isProject || plan.planType === 'PROJECT';
            const planTitle = plan.title || (isProject ? 'Project' : 'Rencana');

            pItems.forEach((it, idx) => {
                const key = `${plan.id}-${idx}-${it.activity || it.text || idx}`;
                if (seenKeys.has(key)) return;
                seenKeys.add(key);

                const isDone = it.percentage === 100 || it.status === 'SELESAI';
                if (isDone) return;

                list.push({
                    key,
                    planId: plan.id,
                    planTitle,
                    isProject,
                    categoryTag: plan.categoryTag || 'UMUM',
                    planStartDate: plan.startDate ? dayjs(plan.startDate).format('YYYY-MM-DD') : null,
                    planEndDate: plan.endDate ? dayjs(plan.endDate).format('YYYY-MM-DD') : null,
                    itemIndex: idx,
                    activity: it.activity || it.text || '',
                    targetDate: it.targetDate ? dayjs(it.targetDate).format('YYYY-MM-DD') : '',
                    percentage: it.percentage || 0,
                    status: it.status || 'PENDING'
                });
            });
        });

        // Saring butir yang sesuai dengan rentang tanggal mulainya [startDate, endDate]
        const startD = startDate ? dayjs(startDate) : null;
        const endD = endDate ? dayjs(endDate) : (startD ? startD.add(4, 'day') : null);

        const rangeMatches = list.filter(it => {
            if (!it.activity || !it.activity.trim()) return false;
            if (!startD) return false;

            // 1. Target date jatuh dalam rentang [startDate, endDate]
            if (it.targetDate) {
                const tDate = dayjs(it.targetDate);
                if (!tDate.isBefore(startD, 'day') && !tDate.isAfter(endD, 'day')) {
                    return true;
                }
            }

            // 2. Tanggal mulai rencana induknya berada dalam rentang [startDate, endDate]
            if (it.planStartDate) {
                const pStart = dayjs(it.planStartDate);
                if (!pStart.isBefore(startD, 'day') && !pStart.isAfter(endD, 'day')) {
                    return true;
                }
            }

            // 3. Project induk berjalan / overlap dengan rentang [startDate, endDate]
            if (it.isProject && it.planStartDate && it.planEndDate) {
                const pStart = dayjs(it.planStartDate);
                const pEnd = dayjs(it.planEndDate);
                if (!pStart.isAfter(endD, 'day') && !pEnd.isBefore(startD, 'day')) {
                    return true;
                }
            }

            return false;
        });

        const others = list.filter(it => it.isProject && !rangeMatches.some(rm => rm.key === it.key));

        return { candidateItems: list, matchingRangeItems: rangeMatches, otherProjectItems: others };
    }, [effectiveStaffData, userId, startDate, endDate, initialPlan?.id]);

    const isItemAlreadyAdded = (act) => {
        if (!act) return false;
        return items.some(it => it.activity && it.activity.trim().toLowerCase() === act.trim().toLowerCase());
    };

    const handleImportCandidateItem = (candidate) => {
        let importedTarget = candidate.targetDate;
        if (!importedTarget || (endDate && dayjs(importedTarget).isAfter(dayjs(endDate), 'day'))) {
            importedTarget = endDate || startDate;
        }
        if (importedTarget && startDate && dayjs(importedTarget).isBefore(dayjs(startDate), 'day')) {
            importedTarget = startDate;
        }

        const newItem = {
            activity: candidate.activity,
            targetDate: importedTarget,
            status: candidate.status || 'PENDING',
            percentage: candidate.percentage || 0,
            projectId: candidate.isProject ? candidate.planId : null,
            projectItemIndex: candidate.isProject ? candidate.itemIndex : null,
            isFromProject: candidate.isProject
        };

        setItems(prev => {
            if (prev.length === 1 && (!prev[0].activity || !prev[0].activity.trim())) {
                return [newItem];
            }
            return [...prev, newItem];
        });
    };

    const handleImportAllMatchingItems = () => {
        const toImport = matchingRangeItems.filter(m => !isItemAlreadyAdded(m.activity));
        if (toImport.length === 0) return;

        const newItems = toImport.map(m => {
            let importedTarget = m.targetDate;
            if (!importedTarget || (endDate && dayjs(importedTarget).isAfter(dayjs(endDate), 'day'))) {
                importedTarget = endDate || startDate;
            }
            if (importedTarget && startDate && dayjs(importedTarget).isBefore(dayjs(startDate), 'day')) {
                importedTarget = startDate;
            }
            return {
                activity: m.activity,
                targetDate: importedTarget,
                status: m.status || 'PENDING',
                percentage: m.percentage || 0,
                projectId: m.isProject ? m.planId : null,
                projectItemIndex: m.isProject ? m.itemIndex : null,
                isFromProject: m.isProject
            };
        });

        setItems(prev => {
            const filteredPrev = prev.filter(it => it.activity && it.activity.trim().length > 0);
            return [...filteredPrev, ...newItems];
        });
    };

    if (!isOpen) return null;

    const handleAddItem = () => {
        setItems(prev => [
            ...prev,
            { activity: '', targetDate: endDate || dayjs().add(7, 'day').format('YYYY-MM-DD'), status: 'PENDING', percentage: 0 }
        ]);
    };

    const handleRemoveItem = (index) => {
        if (items.length === 1) {
            setItems([{ activity: '', targetDate: '', status: 'PENDING', percentage: 0 }]);
            return;
        }
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleEndDateChange = (newEndDate) => {
        setEndDate(newEndDate);
        if (newEndDate) {
            setItems(prev => prev.map(it => {
                if (it.targetDate && dayjs(it.targetDate).isAfter(dayjs(newEndDate), 'day')) {
                    return { ...it, targetDate: newEndDate };
                }
                return it;
            }));
        }
    };

    const handleItemChange = (index, field, value) => {
        if (field === 'targetDate') {
            if (value && endDate && dayjs(value).isAfter(dayjs(endDate), 'day')) {
                alert(`Target selesai butir pekerjaan tidak boleh lebih dari target utama (${dayjs(endDate).format('DD/MM/YYYY')}).`);
                value = endDate;
            }
        }
        setItems(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const handleAiBreakdown = async () => {
        if (!title || !title.trim()) {
            alert('Silakan isi "Nama / Target Pokok Rencana Kerja" terlebih dahulu agar AI dapat merinci butir pekerjaan yang relevan.');
            return;
        }

        const selectedStaff = staffList.find(s => s.id === userId) || (userId === currentUser?.id ? currentUser : null);
        const staffPosition = selectedStaff?.position || '';

        try {
            setLoadingAi(true);
            const res = await api.post('/laporan/ai/breakdown-plan', {
                title: title.trim(),
                position: staffPosition || category || 'Staff Sarpras',
                category: category,
                startDate: startDate || dayjs().format('YYYY-MM-DD'),
                endDate: endDate || dayjs().add(7, 'day').format('YYYY-MM-DD'),
                priority: priority
            });

            if (res.data?.success && res.data?.data) {
                const aiData = res.data.data;
                const newSteps = Array.isArray(aiData.steps) ? aiData.steps : [];

                if (newSteps.length === 0) {
                    alert('AI belum dapat menghasilkan butir pekerjaan untuk target ini. Silakan buat judul lebih spesifik.');
                    return;
                }

                const mappedItems = newSteps.map((s, idx) => {
                    let stepTargetDate = s.targetDate || endDate || dayjs().add(idx + 1, 'day').format('YYYY-MM-DD');
                    if (endDate && dayjs(stepTargetDate).isAfter(dayjs(endDate), 'day')) {
                        stepTargetDate = endDate;
                    }
                    if (startDate && dayjs(stepTargetDate).isBefore(dayjs(startDate), 'day')) {
                        stepTargetDate = startDate;
                    }
                    return {
                        activity: s.activity || `Langkah ${idx + 1}`,
                        targetDate: stepTargetDate,
                        status: 'PENDING',
                        percentage: 0
                    };
                });

                const hasExistingFilledItems = items.some(it => it.activity && it.activity.trim().length > 0);

                if (hasExistingFilledItems) {
                    if (window.confirm(`✨ AI berhasil merinci ${mappedItems.length} butir pekerjaan!\n\nKlik "OK" untuk menggantikan butir saat ini, atau "Cancel" untuk menggabungkan/menambahkan ke butir yang sudah ada.`)) {
                        setItems(mappedItems);
                    } else {
                        setItems(prev => [...prev.filter(it => it.activity.trim().length > 0), ...mappedItems]);
                    }
                } else {
                    setItems(mappedItems);
                }

                if (aiData.priority && !initialPlan) {
                    setPriority(aiData.priority);
                }

                if (aiData.scopeNote && (!notes || !notes.trim())) {
                    setNotes(aiData.scopeNote);
                }
            }
        } catch (err) {
            console.error('AI Breakdown Error:', err);
            alert(err.response?.data?.error || 'Gagal merinci butir pekerjaan dengan AI. Silakan coba lagi.');
        } finally {
            setLoadingAi(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!userId || !title.trim()) {
            alert('Pilih staf penanggung jawab dan isi judul rencana kerja.');
            return;
        }

        const validItems = items.filter(it => it.activity && it.activity.trim().length > 0);
        if (validItems.length === 0) {
            alert('Mohon cantumkan minimal 1 butir kegiatan pekerjaan.');
            return;
        }

        if (endDate) {
            const exceedsItems = validItems.filter(it => it.targetDate && dayjs(it.targetDate).isAfter(dayjs(endDate), 'day'));
            if (exceedsItems.length > 0) {
                alert(`Target selesai butir pekerjaan tidak boleh lebih dari target utama (${dayjs(endDate).format('DD/MM/YYYY')}). Mohon sesuaikan tanggal butir pekerjaan.`);
                return;
            }
        }

        try {
            setSaving(true);
            const isProject = planType === 'PROJECT';
            const payload = {
                userId,
                title: title.trim(),
                planType,
                isProject,
                category,
                priority,
                startDate,
                endDate,
                notes: notes.trim(),
                items: validItems
            };

            let res;
            if (initialPlan?.id) {
                res = await api.put(`/kinerja-manajemen/plans/${initialPlan.id}`, payload);
            } else {
                res = await api.post('/kinerja-manajemen/plans', payload);
            }

            if (res.data.success) {
                alert(res.data.message || 'Rencana kerja berhasil disimpan!');
                if (onSuccess) onSuccess();
                onClose();
            }
        } catch (err) {
            console.error('Error saving plan:', err);
            alert(err.response?.data?.error || 'Gagal menyimpan rencana kerja.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header (Pinned at top) */}
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0 bg-white">
                    <div className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold shrink-0">
                            <Target size={20} />
                        </span>
                        <div>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                {initialPlan ? '✏️ Edit Rencana Kerja Staf' : '📋 Susun Rencana Kerja Mandiri Staf'}
                            </h3>
                            <p className="text-[11px] text-slate-400 font-medium">
                                Single Source of Work • Langsung sinkron ke database operasional
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl transition-colors cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form id="plan-modal-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar">
                    {/* Tipe Perencanaan: Pekanan vs Project */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                            Tipe Perencanaan
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => handlePlanTypeChange('WEEKLY')}
                                className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                                    planType !== 'PROJECT'
                                        ? 'bg-violet-50/80 border-violet-400 ring-2 ring-violet-500/20 shadow-2xs'
                                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                                }`}
                            >
                                <span className="text-xs font-black text-violet-700 block">📋 Rencana Pekanan</span>
                                <span className="text-[10px] text-slate-500">Target operasional mingguan staf</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handlePlanTypeChange('PROJECT')}
                                className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                                    planType === 'PROJECT'
                                        ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-500/20 shadow-2xs'
                                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                                }`}
                            >
                                <span className="text-xs font-black text-emerald-700 block">📁 Rencana Umum (Project)</span>
                                <span className="text-[10px] text-slate-500">Master plan / inisiatif besar jangka panjang</span>
                            </button>
                        </div>
                    </div>

                    {/* Staf Penanggung Jawab */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1">
                            <User size={13} /> Staf Penanggung Jawab Rencana
                        </label>
                        <select
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            required
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:border-violet-500 cursor-pointer"
                        >
                            <option value="" disabled>-- Pilih Penanggung Jawab Rencana --</option>
                            {currentUser?.id && (
                                <option value={currentUser.id}>
                                    👑 {currentUser.name || 'Saya Sendiri'} ({currentUser.position || 'Kepala Bidang Sarana'})
                                </option>
                            )}
                            {staffList.filter(st => st.id !== currentUser?.id).map((st) => (
                                <option key={st.id} value={st.id}>
                                    {st.name} ({st.position || 'Staff'})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Judul Rencana Kerja */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                                Nama / Target Pokok Rencana Kerja
                            </label>
                            <button
                                type="button"
                                disabled={loadingAi || !title.trim()}
                                onClick={handleAiBreakdown}
                                className="px-2.5 py-1 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 shadow-sm shadow-violet-500/20 active:scale-95 cursor-pointer disabled:opacity-40"
                                title="Gunakan AI untuk merinci butir pekerjaan secara otomatis"
                            >
                                {loadingAi ? (
                                    <>
                                        <Loader2 size={12} className="animate-spin text-white" />
                                        <span>AI Merinci...</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={12} className="text-amber-300 fill-amber-300" />
                                        <span>Rinci Butir dg AI</span>
                                    </>
                                )}
                            </button>
                        </div>
                        <input
                            type="text"
                            placeholder="Contoh: Perawatan Rutin AC Sentral & Kalibrasi Panel Listrik..."
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:border-violet-500"
                        />
                    </div>

                    {/* Grid Kategori, Prioritas, & Tanggal */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                                Kategori Bidang
                            </label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
                            >
                                <option value="ASET">ASET</option>
                                <option value="TEKNISI">TEKNISI</option>
                                <option value="KENDARAAN">KENDARAAN</option>
                                <option value="GUDANG">GUDANG</option>
                                <option value="KEUANGAN">KEUANGAN</option>
                                <option value="UMUM">UMUM</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                                Tingkat Prioritas
                            </label>
                            <select
                                value={priority}
                                onChange={(e) => setPriority(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
                            >
                                <option value="RENDAH">Rendah (Dikerjakan jika waktu luang)</option>
                                <option value="SEDANG">Sedang (Prioritas operasional reguler)</option>
                                <option value="TINGGI">Tinggi (Krusial / Berdampak langsung)</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1">
                                <Calendar size={13} /> Tanggal Mulai
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => handleStartDateChange(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1">
                                <Clock size={13} /> Target Selesai (Deadline)
                            </label>
                            <input
                                type="date"
                                value={endDate}
                                min={startDate || undefined}
                                onChange={(e) => handleEndDateChange(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none"
                            />
                        </div>

                        {/* Pilihan Cepat Rentang Tanggal */}
                        <div className="sm:col-span-2 flex items-center gap-1.5 flex-wrap pt-0.5">
                            <span className="text-[10px] font-bold text-slate-400">Pilihan Cepat Rentang:</span>
                            <button
                                type="button"
                                onClick={() => applyDatePreset('NEXT_WEEK_5')}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                    startDate === dayjs().add(1, 'week').startOf('isoWeek').format('YYYY-MM-DD') &&
                                    endDate === dayjs().add(1, 'week').startOf('isoWeek').add(4, 'day').format('YYYY-MM-DD')
                                        ? 'bg-violet-600 text-white shadow-2xs font-black'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                ⚡ Pekan Depan (Sen-Jum)
                            </button>
                            <button
                                type="button"
                                onClick={() => applyDatePreset('NEXT_WEEK_6')}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                    startDate === dayjs().add(1, 'week').startOf('isoWeek').format('YYYY-MM-DD') &&
                                    endDate === dayjs().add(1, 'week').startOf('isoWeek').add(5, 'day').format('YYYY-MM-DD')
                                        ? 'bg-violet-600 text-white shadow-2xs font-black'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                Pekan Depan (Sen-Sab)
                            </button>
                            <button
                                type="button"
                                onClick={() => applyDatePreset('THIS_WEEK')}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                    startDate === dayjs().startOf('isoWeek').format('YYYY-MM-DD') &&
                                    endDate === dayjs().startOf('isoWeek').add(4, 'day').format('YYYY-MM-DD')
                                        ? 'bg-violet-600 text-white shadow-2xs font-black'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                Pekan Ini
                            </button>
                            <button
                                type="button"
                                onClick={() => applyDatePreset('ONE_MONTH')}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                    planType === 'PROJECT' ? 'bg-emerald-600 text-white shadow-2xs font-black' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                1 Bulan (Project)
                            </button>
                        </div>
                    </div>

                    {/* PILIHAN BUTIR RENCANA YANG PERNAH DIBUAT SESUAI RENTANG TANGGAL */}
                    <div className="p-3.5 bg-gradient-to-br from-violet-50/70 via-indigo-50/40 to-slate-50 border border-violet-200/80 rounded-2xl space-y-2.5">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-violet-600 text-white flex items-center justify-center font-black shadow-xs">
                                    <Layers size={14} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <h5 className="text-xs font-black text-violet-950 uppercase tracking-wider">
                                            Pilihan Butir Rencana yang Tersedia
                                        </h5>
                                        <span className="px-1.5 py-0.2 rounded-full bg-violet-600 text-white text-[9px] font-black">
                                            {matchingRangeItems.length} Sesuai Periode
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-violet-700 font-medium">
                                        Butir dari Master Project & Rencana yang terjadwal mulai pada rentang {startDate ? dayjs(startDate).format('DD MMM') : '-'} s.d. {endDate ? dayjs(endDate).format('DD MMM YYYY') : '-'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                                {matchingRangeItems.length > 0 && matchingRangeItems.some(m => !isItemAlreadyAdded(m.activity)) && (
                                    <button
                                        type="button"
                                        onClick={handleImportAllMatchingItems}
                                        className="px-2.5 py-1 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs active:scale-95"
                                        title="Tarik semua butir periode ini ke dalam rencana"
                                    >
                                        <Plus size={11} /> Ambil Semua ({matchingRangeItems.filter(m => !isItemAlreadyAdded(m.activity)).length})
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setIsCandidateDrawerOpen(!isCandidateDrawerOpen)}
                                    className="p-1 text-violet-700 hover:bg-violet-100 rounded-lg transition-colors cursor-pointer"
                                    title={isCandidateDrawerOpen ? 'Ciutkan' : 'Buka pilihan'}
                                >
                                    {isCandidateDrawerOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                            </div>
                        </div>

                        {isCandidateDrawerOpen && (
                            <div className="space-y-2 pt-1 border-t border-violet-100">
                                {/* Filter Segment: Sesuai Rentang Tanggal vs Semua Butir Project */}
                                <div className="flex items-center gap-1 text-[10px] font-bold">
                                    <button
                                        type="button"
                                        onClick={() => setCandidateTab('RANGE')}
                                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                                            candidateTab === 'RANGE' 
                                                ? 'bg-violet-600 text-white shadow-2xs font-black' 
                                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        🎯 Sesuai Rentang Tanggal ({matchingRangeItems.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCandidateTab('ALL_PROJECTS')}
                                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                                            candidateTab === 'ALL_PROJECTS' 
                                                ? 'bg-violet-600 text-white shadow-2xs font-black' 
                                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        📁 Semua Butir Project Aktif ({otherProjectItems.length})
                                    </button>
                                </div>

                                {/* List Candidate Items */}
                                {(() => {
                                    const displayList = candidateTab === 'RANGE' ? matchingRangeItems : otherProjectItems;

                                    if (displayList.length === 0) {
                                        return (
                                            <div className="p-3 bg-white/80 rounded-xl border border-dashed border-violet-200 text-center space-y-1">
                                                <p className="text-[11px] text-slate-500 italic">
                                                    {candidateTab === 'RANGE'
                                                        ? `Belum ada butir rencana dengan tanggal target pada rentang ${startDate ? dayjs(startDate).format('DD MMM') : ''} s.d. ${endDate ? dayjs(endDate).format('DD MMM YYYY') : ''}.`
                                                        : 'Tidak ada butir project aktif lainnya.'}
                                                </p>
                                                {candidateTab === 'RANGE' && otherProjectItems.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setCandidateTab('ALL_PROJECTS')}
                                                        className="text-[10px] text-violet-700 hover:underline font-bold"
                                                    >
                                                        Lihat {otherProjectItems.length} butir dari Master Project aktif →
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                                            {displayList.map((cand) => {
                                                const alreadyAdded = isItemAlreadyAdded(cand.activity);
                                                return (
                                                    <div
                                                        key={cand.key}
                                                        className={`p-2 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                                                            alreadyAdded
                                                                ? 'bg-emerald-50/50 border-emerald-200 text-slate-500'
                                                                : 'bg-white border-violet-100 hover:border-violet-300 shadow-2xs'
                                                        }`}
                                                    >
                                                        <div className="min-w-0 flex-1 space-y-0.5">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                                                                    cand.isProject ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                                                                }`}>
                                                                    {cand.isProject ? '📁 Project' : '📋 Rencana'}: {cand.planTitle}
                                                                </span>
                                                                {cand.targetDate ? (
                                                                    <span className="text-[9px] text-violet-700 font-bold bg-violet-100/70 px-1.5 py-0.2 rounded">
                                                                        Target: {dayjs(cand.targetDate).format('DD MMM YYYY')}
                                                                    </span>
                                                                ) : cand.planStartDate && (
                                                                    <span className="text-[9px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.2 rounded">
                                                                        Mulai: {dayjs(cand.planStartDate).format('DD MMM YYYY')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs font-bold text-slate-800 truncate">
                                                                {cand.activity}
                                                            </p>
                                                        </div>

                                                        {alreadyAdded ? (
                                                            <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center gap-1 shrink-0">
                                                                <Check size={11} /> Ditambahkan
                                                            </span>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleImportCandidateItem(cand)}
                                                                className="px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 shadow-2xs active:scale-95"
                                                            >
                                                                <Plus size={11} /> Ambil Butir
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>

                    {/* Rincian Butir Pekerjaan / Sub-Kegiatan */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <CheckCircle2 size={13} className="text-violet-600" /> Butir-Butir Aktivitas Pekerjaan ({items.length})
                            </label>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    disabled={loadingAi}
                                    onClick={handleAiBreakdown}
                                    className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-violet-500/20 active:scale-95 cursor-pointer disabled:opacity-50"
                                    title="Gunakan AI untuk membuat rincian butir pekerjaan otomatis"
                                >
                                    {loadingAi ? (
                                        <>
                                            <Loader2 size={12} className="animate-spin" />
                                            <span>Merinci...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles size={12} className="text-amber-300 fill-amber-300" />
                                            <span>Rinci dg AI</span>
                                        </>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAddItem}
                                    className="px-2.5 py-1 rounded-xl bg-violet-50 text-violet-700 hover:bg-violet-100 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                >
                                    <Plus size={13} /> Tambah Butir
                                </button>
                            </div>
                        </div>
                        <p className="text-[11px] text-slate-400">
                            Setiap butir pekerjaan di bawah ini dapat diangkat langsung menjadi penugasan resmi oleh Kabid. Target selesai butir tidak boleh melebihi batas waktu rencana utama.
                        </p>

                        <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                            {items.map((it, idx) => (
                                <div 
                                    key={idx} 
                                    className="p-3 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-2 relative"
                                >
                                    <div className="flex items-start gap-2">
                                        <span className="w-5 h-5 rounded-full bg-white border border-slate-200 text-slate-600 text-[10px] font-black flex items-center justify-center shrink-0 mt-1">
                                            {idx + 1}
                                        </span>
                                        <div className="flex-1 space-y-2">
                                            <input
                                                type="text"
                                                placeholder={`Aktivitas ${idx + 1}: Contoh: Pengecekan tekanan freon & pencucian indoor...`}
                                                value={it.activity}
                                                onChange={(e) => handleItemChange(idx, 'activity', e.target.value)}
                                                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-violet-500"
                                            />
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                                                    <span>Target:</span>
                                                    <input
                                                        type="date"
                                                        value={it.targetDate}
                                                        min={startDate || undefined}
                                                        max={endDate || undefined}
                                                        onChange={(e) => handleItemChange(idx, 'targetDate', e.target.value)}
                                                        className={`px-2 py-0.5 bg-white border ${
                                                            endDate && it.targetDate && dayjs(it.targetDate).isAfter(dayjs(endDate), 'day')
                                                                ? 'border-rose-400 text-rose-600 ring-1 ring-rose-200 font-black'
                                                                : 'border-slate-200 text-slate-700'
                                                        } rounded-lg text-[10px] font-bold outline-none cursor-pointer`}
                                                        title={endDate ? `Maksimal target utama: ${dayjs(endDate).format('DD/MM/YYYY')}` : undefined}
                                                    />
                                                    {endDate && it.targetDate && dayjs(it.targetDate).isAfter(dayjs(endDate), 'day') && (
                                                        <span className="text-[10px] text-rose-500 font-bold">
                                                            (Melebihi target utama!)
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                                                    <span>Progres:</span>
                                                    <select
                                                        value={it.percentage}
                                                        onChange={(e) => handleItemChange(idx, 'percentage', parseInt(e.target.value, 10))}
                                                        className="px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 outline-none"
                                                    >
                                                        <option value={0}>0%</option>
                                                        <option value={25}>25%</option>
                                                        <option value={50}>50%</option>
                                                        <option value={75}>75%</option>
                                                        <option value={100}>100% (Selesai)</option>
                                                    </select>
                                                </div>
                                                {it.assigned && (
                                                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                                                        ✓ Ditugaskan Resmi
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveItem(idx)}
                                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl transition-colors shrink-0 cursor-pointer"
                                            title="Hapus Butir Ini"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Catatan / Keterangan Tambahan */}
                    <div className="space-y-1.5 pt-1">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                            Catatan / Deskripsi Tambahan (Opsional)
                        </label>
                        <textarea
                            rows={2}
                            placeholder="Keterangan pendukung, lokasi pekerjaan, atau standar operasional..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 outline-none focus:border-violet-500"
                        />
                    </div>

                    {/* Spacer bottom */}
                    <div className="h-2" />
                </form>

                {/* Footer Actions (Pinned at bottom) */}
                <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-slate-100 bg-slate-50 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold transition-colors cursor-pointer"
                    >
                        Batal
                    </button>
                    <button
                        type="submit"
                        form="plan-modal-form"
                        disabled={saving}
                        className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-all shadow-md shadow-violet-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        <span>{initialPlan ? 'Simpan Perubahan' : 'Buat Rencana Kerja'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PlanModal;
