import React, { useState, useEffect } from 'react';
import { 
    X, CheckCircle2, Clock, AlertTriangle, 
    Plus, Trash2, Save, Loader2, Calendar, 
    User, Sparkles, Layers, CheckSquare, ArrowRight,
    Check, AlertCircle, FileText, CheckCheck
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import api from '../../../lib/axios';

dayjs.locale('id');

const DailyReportPppModal = ({ 
    isOpen, 
    onClose, 
    onSuccess, 
    staffList = [], 
    staffPlansData = [] 
}) => {
    // Current user context
    const currentUser = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
    const userRole = currentUser?.role || '';
    const userPos = (currentUser?.position || '').toLowerCase();
    const isManager = userRole === 'SUPER_ADMIN' || 
                      userRole === 'KABID_SARPRAS' || 
                      userPos.includes('kepala bidang') ||
                      userPos.includes('kabid sarpras');

    const [selectedStaffId, setSelectedStaffId] = useState('');
    const [reportDate, setReportDate] = useState(dayjs().format('YYYY-MM-DD'));

    // 4 Pilar Laporan Harian Terpadu
    const [completedItems, setCompletedItems] = useState([
        { title: '', output: '', categoryTag: 'UMUM', isPlanned: false, planRefId: null }
    ]);
    const [inProgressItems, setInProgressItems] = useState([]);
    const [hasObstacle, setHasObstacle] = useState(false);
    const [obstacleNote, setObstacleNote] = useState('');
    const [actionPlan, setActionPlan] = useState('');
    const [tomorrowPlans, setTomorrowPlans] = useState([
        { title: '', categoryTag: 'UMUM', priority: 'SEDANG' }
    ]);

    // Tracking item rencana/penugasan yang sudah ditarik { [itemKey]: 'COMPLETED' | 'IN_PROGRESS' | 'OBSTACLE' | 'TOMORROW' }
    const [pulledMap, setPulledMap] = useState({});
    const [pppDrawerFilter, setPppDrawerFilter] = useState('ALL'); // 'ALL' | 'WEEKLY' | 'PROJECT' | 'ASSIGNMENT'
    const [showCompletedInDrawer, setShowCompletedInDrawer] = useState(false);
    const [saving, setSaving] = useState(false);

    // Otomatis tentukan Staf Pelapor
    useEffect(() => {
        if (!isOpen) return;

        if (!selectedStaffId) {
            if (currentUser?.id) {
                setSelectedStaffId(String(currentUser.id));
            } else if (staffList.length > 0) {
                setSelectedStaffId(String(staffList[0].id));
            }
        }
    }, [isOpen, staffList, currentUser?.id, selectedStaffId]);

    // Reset pulled items map when staff changes
    useEffect(() => {
        setPulledMap({});
    }, [selectedStaffId]);

    if (!isOpen) return null;

    // Ambil rencana & penugasan staf yang sedang dipilih
    const currentStaffProfile = staffPlansData.find(s => s.id === parseInt(selectedStaffId));
    const rawPlans = currentStaffProfile?.plans || [];
    const rawAssignments = currentStaffProfile?.assignments || [];

    // Filter pekerjaan & rencana yang benar-benar MASIH AKTIF (kecuali user mengaktifkan toggle tampilkan selesai)
    const activeStaffPlans = rawPlans.filter(p => {
        const isFinished = p.isDone || p.status === 'SELESAI' || (p.avgPct !== undefined && p.avgPct >= 100);
        return showCompletedInDrawer ? true : !isFinished;
    });

    const activeStaffAssignments = rawAssignments.filter(a => {
        const isFinished = a.status === 'COMPLETED' || (a.progressPercentage !== undefined && a.progressPercentage >= 100);
        return showCompletedInDrawer ? true : !isFinished;
    });

    const totalFinishedCount = 
        rawAssignments.filter(a => a.status === 'COMPLETED' || (a.progressPercentage !== undefined && a.progressPercentage >= 100)).length +
        rawPlans.filter(p => p.isDone || p.status === 'SELESAI' || (p.avgPct !== undefined && p.avgPct >= 100)).length;

    // Helper: Tarik Cepat Item atau Sub-Item Langkah ke salah satu dari 4 Pilar
    const handlePullItem = (item, type = 'PLAN', targetPillar = 'COMPLETED', subItemIndex = null, subItemTitle = null) => {
        const itemKey = subItemIndex !== null ? `${type}-${item.id}-step-${subItemIndex}` : `${type}-${item.id}`;
        const titleText = subItemTitle ? `${item.title}: ${subItemTitle}` : (item.title || item.name || '');
        const sourceId = item.id;
        const isProject = !!item.isProject || item.planType === 'PROJECT' || item.metadata?.isProject || item.metadata?.planType === 'PROJECT';
        const subItem = subItemIndex !== null && Array.isArray(item.items) ? item.items[subItemIndex] : null;
        const linkedProjectId = subItem?.projectId || (isProject ? item.id : null);
        const linkedProjectItemIndex = subItem?.projectItemIndex !== undefined ? subItem.projectItemIndex : (isProject ? subItemIndex : null);

        // Tandai status tarikan
        setPulledMap(prev => ({ ...prev, [itemKey]: targetPillar }));

        if (targetPillar === 'COMPLETED') {
            setCompletedItems(prev => {
                const cleaned = prev.filter(i => i.title.trim());
                if (cleaned.some(i => i.planRefId === itemKey)) return prev;
                return [
                    ...cleaned,
                    {
                        title: titleText,
                        output: item.targetOutput || 'Tuntas dilaksanakan sesuai target jadwal.',
                        categoryTag: 'UMUM',
                        isPlanned: true,
                        sourceType: isProject ? 'PROJECT' : type,
                        sourceId,
                        planItemIndex: subItemIndex,
                        projectId: linkedProjectId,
                        projectItemIndex: linkedProjectItemIndex,
                        planRefId: itemKey
                    }
                ];
            });
        } else if (targetPillar === 'IN_PROGRESS') {
            setInProgressItems(prev => {
                const cleaned = prev.filter(i => i.title.trim());
                if (cleaned.some(i => i.planRefId === itemKey)) return prev;
                return [
                    ...cleaned,
                    {
                        title: titleText,
                        progressPercentage: item.progressPercentage || 50,
                        targetDate: 'Hari kerja berikutnya',
                        categoryTag: 'UMUM',
                        isPlanned: true,
                        sourceType: isProject ? 'PROJECT' : type,
                        sourceId,
                        planItemIndex: subItemIndex,
                        projectId: linkedProjectId,
                        projectItemIndex: linkedProjectItemIndex,
                        planRefId: itemKey
                    }
                ];
            });
        } else if (targetPillar === 'OBSTACLE') {
            setHasObstacle(true);
            const obstaclePrefix = `[Kendala ${type === 'ASSIGNMENT' ? 'Penugasan' : (isProject ? 'Project' : 'Rencana')}] ${titleText}: `;
            setObstacleNote(prev => prev ? `${prev}\n${obstaclePrefix}` : obstaclePrefix);
        } else if (targetPillar === 'TOMORROW') {
            setTomorrowPlans(prev => {
                const cleaned = prev.filter(i => i.title.trim());
                if (cleaned.some(i => i.planRefId === itemKey)) return prev;
                return [
                    ...cleaned,
                    {
                        title: titleText,
                        categoryTag: 'UMUM',
                        priority: item.priority || 'SEDANG',
                        sourceType: isProject ? 'PROJECT' : type,
                        sourceId,
                        planItemIndex: subItemIndex,
                        projectId: linkedProjectId,
                        projectItemIndex: linkedProjectItemIndex,
                        planRefId: itemKey
                    }
                ];
            });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const validCompleted = completedItems.filter(i => i.title.trim());
        const validInProgress = inProgressItems.filter(i => i.title.trim());
        const validTomorrowPlans = tomorrowPlans.filter(i => i.title && i.title.trim());

        if (validCompleted.length === 0 && validInProgress.length === 0 && !hasObstacle) {
            alert('Mohon isi minimal satu butir pekerjaan hari ini (Selesai, Dalam Proses, atau Kendala).');
            return;
        }

        // Kewajiban Staf: Wajib membuat rencana kerja besok
        if (validTomorrowPlans.length === 0) {
            alert('⚠️ KEWAJIBAN STAF:\nMohon isi minimal 1 butir pada bagian "D. Rencana Kerja Besok" agar tugas Anda terencana dan otomatis terlacak pada hari berikutnya.');
            return;
        }

        const obstacleItems = hasObstacle && obstacleNote.trim() ? [{
            title: 'Hambatan Lapangan',
            obstacleNote: obstacleNote.trim(),
            actionPlan: actionPlan.trim(),
            categoryTag: 'UMUM'
        }] : [];

        try {
            setSaving(true);
            const res = await api.post('/kinerja-manajemen/daily-report', {
                userId: parseInt(selectedStaffId),
                date: reportDate,
                category: 'UMUM',
                completedItems: validCompleted,
                inProgressItems: validInProgress,
                obstacleItems,
                tomorrowPlans: validTomorrowPlans
            });

            if (res.data.success) {
                alert('Laporan harian berhasil dicatat! Rencana kerja besok otomatis siap ditarik pada laporan berikutnya.');
                if (onSuccess) onSuccess();
                onClose();
            }
        } catch (err) {
            console.error('Error saving daily report:', err);
            alert(err.response?.data?.error || 'Gagal menyimpan laporan harian.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-5 max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                            <CheckCircle2 size={20} />
                        </span>
                        <div>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                📝 Input Laporan Harian Staf & Rencana Kerja
                            </h3>
                            <p className="text-[11px] text-slate-400 font-medium">
                                Laporan Terpadu: Rencana Kerja & Penugasan Pimpinan
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

                <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto pr-1 custom-scrollbar flex-1">
                    {/* Baris Pilihan Staf & Tanggal Laporan */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-600 tracking-wider flex items-center gap-1">
                                <User size={12} /> Staf Pelapor
                            </label>
                            {isManager ? (
                                <select
                                    value={selectedStaffId}
                                    onChange={(e) => setSelectedStaffId(e.target.value)}
                                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
                                >
                                    {currentUser?.id && (
                                        <option value={String(currentUser.id)}>
                                            👑 {currentUser.name || 'Saya Sendiri'} ({currentUser.position || 'Kepala Bidang Sarana'})
                                        </option>
                                    )}
                                    {staffList.filter(st => st.id !== currentUser?.id).map((st) => (
                                        <option key={st.id} value={String(st.id)}>
                                            {st.name} ({st.position || 'Staff'})
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <div className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800">
                                    {currentUser?.name || 'Staf Pelapor'} ({currentUser?.position || 'Staff'})
                                </div>
                            )}
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-600 tracking-wider flex items-center gap-1">
                                <Calendar size={12} /> Tanggal Laporan
                            </label>
                            <input
                                type="date"
                                value={reportDate}
                                onChange={(e) => setReportDate(e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
                            />
                        </div>
                    </div>

                    {/* 1. KOTAK UTAMA: TARIK DARI RENCANA KERJA & PENUGASAN AKTIF */}
                    <div className="p-4 bg-blue-50/70 rounded-2xl border border-blue-200/80 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="space-y-0.5">
                                <span className="text-xs font-black uppercase text-blue-900 tracking-wider flex items-center gap-1.5">
                                    <Sparkles size={14} className="text-blue-600" /> 1. Tarik dari Rencana Kerja / Penugasan Aktif
                                </span>
                                <p className="text-[11px] text-blue-700 font-medium">
                                    Klik tombol status pada setiap rencana untuk melaporkan progresnya hari ini:
                                </p>
                            </div>

                            {/* Filter Segmented Controls */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-blue-200 text-[10px] font-bold">
                                    <button
                                        type="button"
                                        onClick={() => setPppDrawerFilter('ALL')}
                                        className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                                            pppDrawerFilter === 'ALL' ? 'bg-blue-600 text-white shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        Semua ({activeStaffPlans.length + activeStaffAssignments.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPppDrawerFilter('WEEKLY')}
                                        className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                                            pppDrawerFilter === 'WEEKLY' ? 'bg-violet-600 text-white shadow-2xs font-black' : 'text-violet-700 hover:text-violet-900'
                                        }`}
                                    >
                                        📋 Pekanan ({activeStaffPlans.filter(p => !p.isProject).length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPppDrawerFilter('PROJECT')}
                                        className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                                            pppDrawerFilter === 'PROJECT' ? 'bg-emerald-600 text-white shadow-2xs font-black' : 'text-emerald-700 hover:text-emerald-900'
                                        }`}
                                    >
                                        📁 Project ({activeStaffPlans.filter(p => p.isProject).length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPppDrawerFilter('ASSIGNMENT')}
                                        className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                                            pppDrawerFilter === 'ASSIGNMENT' ? 'bg-blue-600 text-white shadow-2xs font-black' : 'text-blue-700 hover:text-blue-900'
                                        }`}
                                    >
                                        🎯 Tugas ({activeStaffAssignments.length})
                                    </button>
                                </div>

                                {totalFinishedCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setShowCompletedInDrawer(prev => !prev)}
                                        className={`px-2 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 border ${
                                            showCompletedInDrawer 
                                                ? 'bg-slate-700 text-white border-slate-700 shadow-2xs font-black' 
                                                : 'bg-white text-slate-500 hover:text-slate-800 border-blue-200'
                                        }`}
                                        title="Beralih untuk melihat pekerjaan yang sudah berstatus selesai"
                                    >
                                        <span>{showCompletedInDrawer ? 'Sembunyikan Selesai' : `Tampilkan Selesai (${totalFinishedCount})`}</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {activeStaffPlans.length === 0 && activeStaffAssignments.length === 0 ? (
                            <div className="p-4 bg-white/80 rounded-xl border border-dashed border-blue-200 text-center">
                                <p className="text-xs text-blue-600 font-medium italic">
                                    Belum ada penugasan atau rencana kerja aktif untuk staf ini. Anda dapat menginput langsung di butir kegiatan lainnya di bawah, dan <b>wajib menyusun Rencana Kerja Besok</b>.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                                {/* Penugasan Langsung dari Pimpinan (Merupakan Rencana User) */}
                                {(pppDrawerFilter === 'ALL' || pppDrawerFilter === 'ASSIGNMENT') && activeStaffAssignments.map(a => {
                                    const itemKey = `ASSIGNMENT-${a.id}`;
                                    const pulledStatus = pulledMap[itemKey];
                                    let assignItems = [];
                                    if (Array.isArray(a.items)) assignItems = a.items;
                                    else if (typeof a.items === 'string') {
                                        try { assignItems = JSON.parse(a.items || '[]'); } catch (e) { assignItems = []; }
                                    }

                                    return (
                                        <div 
                                            key={itemKey} 
                                            className={`p-2.5 rounded-xl border transition-all space-y-2 ${
                                                pulledStatus 
                                                    ? 'bg-blue-100/60 border-blue-300' 
                                                    : 'bg-white border-blue-200 hover:border-blue-400 shadow-2xs'
                                            }`}
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white text-[9px] font-black uppercase">
                                                            Penugasan Pimpinan
                                                        </span>
                                                        {a.priority && (
                                                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px] font-bold">
                                                                {a.priority}
                                                            </span>
                                                        )}
                                                        {pulledStatus && (
                                                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-black flex items-center gap-0.5">
                                                                <CheckCheck size={10} /> Ditarik: {
                                                                    pulledStatus === 'COMPLETED' ? 'Selesai 100%' :
                                                                    pulledStatus === 'IN_PROGRESS' ? 'Dalam Proses' :
                                                                    pulledStatus === 'OBSTACLE' ? 'Kendala' : 'Rencana Besok'
                                                                }
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h5 className="text-xs font-bold text-slate-800">{a.title}</h5>
                                                </div>

                                                {/* 4 Pilihan Tindak Lanjut Instan */}
                                                <div className="flex items-center gap-1 shrink-0 flex-wrap">
                                                    {a.status === 'COMPLETED' ? (
                                                        <span className="px-2.5 py-1 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg text-[10px] font-black flex items-center gap-1">
                                                            <CheckCheck size={12} /> Tugas Sudah Tuntas 100%
                                                        </span>
                                                    ) : (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => handlePullItem(a, 'ASSIGNMENT', 'COMPLETED')}
                                                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-300 rounded-lg text-[10px] font-black transition-all cursor-pointer"
                                                                title="Laporkan seluruh butir penugasan ini tuntas 100%"
                                                            >
                                                                ✅ Selesai
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handlePullItem(a, 'ASSIGNMENT', 'IN_PROGRESS')}
                                                                className="px-2 py-1 bg-amber-50 hover:bg-amber-500 text-amber-700 hover:text-white border border-amber-300 rounded-lg text-[10px] font-black transition-all cursor-pointer"
                                                                title="Laporkan masih dalam proses pengerjaan"
                                                            >
                                                                ⏳ Proses
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handlePullItem(a, 'ASSIGNMENT', 'OBSTACLE')}
                                                                className="px-2 py-1 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-300 rounded-lg text-[10px] font-black transition-all cursor-pointer"
                                                                title="Laporkan menghadapi kendala lapangan"
                                                            >
                                                                ⚠️ Kendala
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handlePullItem(a, 'ASSIGNMENT', 'TOMORROW')}
                                                                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-300 rounded-lg text-[10px] font-black transition-all cursor-pointer"
                                                                title="Jadwalkan lanjut pada hari esok"
                                                            >
                                                                📅 Besok
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Rincian Butir Penugasan jika ada */}
                                            {assignItems && assignItems.length > 0 && (
                                                <div className="pt-2 border-t border-slate-100 space-y-1.5 bg-slate-50/60 p-2 rounded-xl">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                                        📋 Rincian Butir Penugasan ({assignItems.length} butir) - Tarik per butir:
                                                    </span>
                                                    <div className="space-y-1">
                                                        {assignItems.map((sub, sIdx) => {
                                                            const subKey = `ASSIGNMENT-${a.id}-step-${sIdx}`;
                                                            const subPulled = pulledMap[subKey];
                                                            const subTitle = sub.title || sub.name || sub.text || `Butir #${sIdx + 1}`;
                                                            const subIsDone = sub.isDone || sub.status === 'COMPLETED' || sub.percentage === 100 || a.status === 'COMPLETED';

                                                            return (
                                                                <div key={sIdx} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 p-1.5 rounded-lg border text-xs ${
                                                                    subIsDone ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900' : 'bg-white border-slate-200/80'
                                                                }`}>
                                                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                                        <span className="text-slate-400 font-bold text-[10px] shrink-0">#{sIdx + 1}</span>
                                                                        <span className={`font-semibold truncate ${subIsDone ? 'line-through text-slate-500' : 'text-slate-700'}`}>{subTitle}</span>
                                                                        {subIsDone && (
                                                                            <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-black shrink-0">
                                                                                ✓ Sudah Selesai
                                                                            </span>
                                                                        )}
                                                                        {subPulled && (
                                                                            <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-black shrink-0">
                                                                                ✓ {subPulled === 'COMPLETED' ? 'Selesai' : subPulled === 'IN_PROGRESS' ? 'Proses' : subPulled === 'OBSTACLE' ? 'Kendala' : 'Besok'}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {!subIsDone && (
                                                                        <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handlePullItem(a, 'ASSIGNMENT', 'COMPLETED', sIdx, subTitle)}
                                                                                className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded text-[9px] font-bold transition-colors cursor-pointer"
                                                                            >
                                                                                Selesai
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handlePullItem(a, 'ASSIGNMENT', 'IN_PROGRESS', sIdx, subTitle)}
                                                                                className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-500 text-amber-700 hover:text-white rounded text-[9px] font-bold transition-colors cursor-pointer"
                                                                            >
                                                                                Proses
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handlePullItem(a, 'ASSIGNMENT', 'OBSTACLE', sIdx, subTitle)}
                                                                                className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white rounded text-[9px] font-bold transition-colors cursor-pointer"
                                                                            >
                                                                                Kendala
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handlePullItem(a, 'ASSIGNMENT', 'TOMORROW', sIdx, subTitle)}
                                                                                className="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded text-[9px] font-bold transition-colors cursor-pointer"
                                                                                title="Jadwalkan butir ini untuk besok"
                                                                            >
                                                                                Besok
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* Rencana Kerja Staf (Termasuk Rencana Besok yang dibuat kemarin & Project) */}
                                {activeStaffPlans
                                    .filter(p => {
                                        const isProject = !!p.isProject || p.planType === 'PROJECT' || p.metadata?.isProject || p.metadata?.planType === 'PROJECT';
                                        if (pppDrawerFilter === 'WEEKLY' && isProject) return false;
                                        if (pppDrawerFilter === 'PROJECT' && !isProject) return false;
                                        if (pppDrawerFilter === 'ASSIGNMENT') return false;
                                        return true;
                                    })
                                    .map(p => {
                                        const isProject = !!p.isProject || p.planType === 'PROJECT' || p.metadata?.isProject || p.metadata?.planType === 'PROJECT';
                                        const itemKey = `PLAN-${p.id}`;
                                        const pulledStatus = pulledMap[itemKey];
                                        return (
                                            <div 
                                                key={itemKey} 
                                                className={`p-2.5 rounded-xl border transition-all space-y-2 ${
                                                    pulledStatus 
                                                        ? 'bg-blue-100/60 border-blue-300' 
                                                        : isProject
                                                            ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-300 shadow-2xs'
                                                            : 'bg-white border-blue-200 hover:border-blue-400 shadow-2xs'
                                                }`}
                                            >
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                    <div className="space-y-0.5">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            {isProject ? (
                                                                <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-black uppercase">
                                                                    📁 Project (Master Plan)
                                                                </span>
                                                            ) : p.isDailyPlan ? (
                                                                <span className="px-1.5 py-0.5 rounded bg-amber-600 text-white text-[9px] font-black uppercase">
                                                                    ⚡ Rencana Harian
                                                                </span>
                                                            ) : (
                                                                <span className="px-1.5 py-0.5 rounded bg-purple-600 text-white text-[9px] font-black uppercase">
                                                                    📋 Rencana Pekanan
                                                                </span>
                                                            )}
                                                            {pulledStatus && (
                                                                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-black flex items-center gap-0.5">
                                                                    <CheckCheck size={10} /> Ditarik: {
                                                                        pulledStatus === 'COMPLETED' ? 'Selesai 100%' :
                                                                        pulledStatus === 'IN_PROGRESS' ? 'Dalam Proses' :
                                                                        pulledStatus === 'OBSTACLE' ? 'Kendala' : 'Rencana Besok'
                                                                    }
                                                                </span>
                                                            )}
                                                        </div>
                                                        <h5 className="text-xs font-bold text-slate-800">{p.title}</h5>
                                                        {p.targetOutput && (
                                                            <p className="text-[10px] text-violet-700 font-bold flex items-center gap-1">
                                                                <span className="shrink-0">🎯 Target:</span>
                                                                <span className="text-slate-600 font-medium truncate">{p.targetOutput}</span>
                                                            </p>
                                                        )}
                                                    </div>

                                                <div className="flex items-center gap-1 shrink-0 flex-wrap">
                                                    {(p.isDone || p.status === 'SELESAI' || p.avgPct === 100) ? (
                                                        <span className="px-2.5 py-1 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg text-[10px] font-black flex items-center gap-1">
                                                            <CheckCheck size={12} /> {isProject ? 'Project' : 'Rencana'} Tuntas 100%
                                                        </span>
                                                    ) : (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => handlePullItem(p, 'PLAN', 'COMPLETED')}
                                                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-300 rounded-lg text-[10px] font-black transition-all cursor-pointer"
                                                                title="Laporkan seluruh rencana ini tuntas 100%"
                                                            >
                                                                ✅ Selesai
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handlePullItem(p, 'PLAN', 'IN_PROGRESS')}
                                                                className="px-2 py-1 bg-amber-50 hover:bg-amber-500 text-amber-700 hover:text-white border border-amber-300 rounded-lg text-[10px] font-black transition-all cursor-pointer"
                                                                title="Laporkan masih dalam proses"
                                                            >
                                                                ⏳ Proses
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handlePullItem(p, 'PLAN', 'OBSTACLE')}
                                                                className="px-2 py-1 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-300 rounded-lg text-[10px] font-black transition-all cursor-pointer"
                                                                title="Laporkan ada kendala"
                                                            >
                                                                ⚠️ Kendala
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handlePullItem(p, 'PLAN', 'TOMORROW')}
                                                                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-300 rounded-lg text-[10px] font-black transition-all cursor-pointer"
                                                                title="Jadwalkan untuk hari esok"
                                                            >
                                                                📅 Besok
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Rincian Langkah-Langkah (Sub-items) */}
                                            {p.items && p.items.length > 0 && (
                                                <div className="pt-2 border-t border-slate-100 space-y-1.5 bg-slate-50/60 p-2 rounded-xl">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                                        📋 Rincian Langkah Kerja ({p.items.length} butir) - Tarik per langkah:
                                                    </span>
                                                    <div className="space-y-1">
                                                        {p.items.map((sub, sIdx) => {
                                                            const subKey = `PLAN-${p.id}-step-${sIdx}`;
                                                            const subPulled = pulledMap[subKey];
                                                            const subTitle = sub.activity || sub.name || sub.text || `Langkah #${sIdx + 1}`;
                                                            const subIsDone = sub.percentage === 100 || sub.status === 'SELESAI' || sub.isDone || p.isDone || p.status === 'SELESAI';

                                                            return (
                                                                <div key={sIdx} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 p-1.5 rounded-lg border text-xs ${
                                                                    subIsDone ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900' : 'bg-white border-slate-200/80'
                                                                }`}>
                                                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                                        <span className="text-slate-400 font-bold text-[10px] shrink-0">#{sIdx + 1}</span>
                                                                        {sub.projectId && (
                                                                            <span className="px-1 py-0.2 rounded bg-blue-100 text-blue-700 text-[8px] font-bold shrink-0">
                                                                                🔗 Project
                                                                            </span>
                                                                        )}
                                                                        <span className={`font-semibold truncate ${subIsDone ? 'line-through text-slate-500' : 'text-slate-700'}`}>{subTitle}</span>
                                                                        {subIsDone && (
                                                                            <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-black shrink-0">
                                                                                ✓ Sudah Selesai
                                                                            </span>
                                                                        )}
                                                                        {subPulled && (
                                                                            <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-black shrink-0">
                                                                                ✓ {subPulled === 'COMPLETED' ? 'Selesai' : subPulled === 'IN_PROGRESS' ? 'Proses' : subPulled === 'OBSTACLE' ? 'Kendala' : 'Besok'}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {!subIsDone && (
                                                                        <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handlePullItem(p, 'PLAN', 'COMPLETED', sIdx, subTitle)}
                                                                                className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded text-[9px] font-bold transition-colors cursor-pointer"
                                                                            >
                                                                                Selesai
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handlePullItem(p, 'PLAN', 'IN_PROGRESS', sIdx, subTitle)}
                                                                                className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-500 text-amber-700 hover:text-white rounded text-[9px] font-bold transition-colors cursor-pointer"
                                                                            >
                                                                                Proses
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handlePullItem(p, 'PLAN', 'OBSTACLE', sIdx, subTitle)}
                                                                                className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white rounded text-[9px] font-bold transition-colors cursor-pointer"
                                                                            >
                                                                                Kendala
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* PILAR A: Tugas Selesai (Completed - 100%) */}
                    <div className="p-4 bg-emerald-50/40 border border-emerald-200/80 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                                <CheckCircle2 size={15} className="text-emerald-600" /> A. Tugas Selesai (Completed - 100%)
                            </h4>
                            <button
                                type="button"
                                onClick={() => setCompletedItems([...completedItems, { title: '', output: '', categoryTag: 'UMUM', isPlanned: false }])}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                            >
                                <Plus size={12} /> Tambah Kegiatan Lainnya
                            </button>
                        </div>

                        <div className="space-y-2.5">
                            {completedItems.map((item, idx) => (
                                <div key={idx} className="p-3 bg-white rounded-xl border border-emerald-100 shadow-2xs space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex-1 flex items-center gap-1.5">
                                            {item.isPlanned ? (
                                                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-black shrink-0">
                                                    📌 Terencana
                                                </span>
                                            ) : (
                                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[9px] font-bold shrink-0">
                                                    ⚡ Kegiatan Lainnya
                                                </span>
                                            )}
                                            <input
                                                type="text"
                                                placeholder={`Aktivitas selesai #${idx + 1}...`}
                                                value={item.title}
                                                onChange={(e) => {
                                                    const updated = [...completedItems];
                                                    updated[idx].title = e.target.value;
                                                    setCompletedItems(updated);
                                                }}
                                                className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none"
                                            />
                                        </div>
                                        {completedItems.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => setCompletedItems(completedItems.filter((_, i) => i !== idx))}
                                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                                title="Hapus butir"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Wujud hasil / output (misal: Unit normal, filter bersih, plang terpasang...)"
                                        value={item.output}
                                        onChange={(e) => {
                                            const updated = [...completedItems];
                                            updated[idx].output = e.target.value;
                                            setCompletedItems(updated);
                                        }}
                                        className="w-full px-3 py-1.5 bg-slate-50/50 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 outline-none"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* PILAR B: Tugas Dalam Proses (On Progress) */}
                    <div className="p-4 bg-amber-50/40 border border-amber-200/80 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                                <Clock size={15} className="text-amber-600" /> B. Tugas Dalam Proses (On Progress)
                            </h4>
                            <button
                                type="button"
                                onClick={() => setInProgressItems([...inProgressItems, { title: '', progressPercentage: 50, targetDate: 'Besok', categoryTag: 'UMUM', isPlanned: false }])}
                                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                            >
                                <Plus size={12} /> Tambah Kegiatan Dalam Proses
                            </button>
                        </div>

                        {inProgressItems.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic">Tidak ada pekerjaan on-progress (opsional).</p>
                        ) : (
                            <div className="space-y-2.5">
                                {inProgressItems.map((item, idx) => (
                                    <div key={idx} className="p-3 bg-white rounded-xl border border-amber-100 shadow-2xs space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex-1 flex items-center gap-1.5">
                                                {item.isPlanned ? (
                                                    <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-black shrink-0">
                                                        📌 Terencana
                                                    </span>
                                                ) : (
                                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[9px] font-bold shrink-0">
                                                        ⚡ Kegiatan Lainnya
                                                    </span>
                                                )}
                                                <input
                                                    type="text"
                                                    placeholder={`Aktivitas dalam proses #${idx + 1}...`}
                                                    value={item.title}
                                                    onChange={(e) => {
                                                        const updated = [...inProgressItems];
                                                        updated[idx].title = e.target.value;
                                                        setInProgressItems(updated);
                                                    }}
                                                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none"
                                                />
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <input
                                                    type="number"
                                                    min="10"
                                                    max="90"
                                                    placeholder="%"
                                                    value={item.progressPercentage}
                                                    onChange={(e) => {
                                                        const updated = [...inProgressItems];
                                                        updated[idx].progressPercentage = e.target.value;
                                                        setInProgressItems(updated);
                                                    }}
                                                    className="w-16 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-center outline-none"
                                                />
                                                <span className="text-xs font-bold text-slate-500">%</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setInProgressItems(inProgressItems.filter((_, i) => i !== idx))}
                                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                                title="Hapus butir"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* PILAR C: Kendala & Kebutuhan Dukungan (Problems) */}
                    <div className="p-4 bg-rose-50/40 border border-rose-200/80 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase tracking-wider text-rose-900 flex items-center gap-1.5">
                                <AlertTriangle size={15} className="text-rose-600" /> C. Kendala & Kebutuhan Dukungan
                            </h4>
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={!hasObstacle}
                                    onChange={(e) => setHasObstacle(!e.target.checked)}
                                    className="rounded text-emerald-600 focus:ring-0 cursor-pointer"
                                />
                                <span>Nihil / Lancar</span>
                            </label>
                        </div>

                        {hasObstacle && (
                            <div className="space-y-2 pt-1 animate-in fade-in duration-200">
                                <input
                                    type="text"
                                    placeholder="Uraian hambatan teknis/lapangan..."
                                    value={obstacleNote}
                                    onChange={(e) => setObstacleNote(e.target.value)}
                                    className="w-full px-3 py-1.5 bg-white border border-rose-200 rounded-lg text-xs font-bold text-rose-900 outline-none"
                                />
                                <input
                                    type="text"
                                    placeholder="Tindak lanjut / Butuh arahan pimpinan (solusi yang dibutuhkan)..."
                                    value={actionPlan}
                                    onChange={(e) => setActionPlan(e.target.value)}
                                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none"
                                />
                            </div>
                        )}
                    </div>

                    {/* PILAR D: Rencana Kerja Besok (Tomorrow's Plan) - ⭐ WAJIB DIISI */}
                    <div className="p-4 bg-indigo-50/50 border-2 border-indigo-200 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                                        <Sparkles size={15} className="text-indigo-600" /> D. Rencana Kerja Besok (Tomorrow's Plan)
                                    </h4>
                                    <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[9px] font-black uppercase tracking-wider">
                                        ⭐ Wajib Diisi
                                    </span>
                                </div>
                                <p className="text-[11px] text-indigo-700 font-medium">
                                    Kewajiban Staf: Rencana ini otomatis tersimpan dan siap ditarik kembali saat mengisi laporan esok hari.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setTomorrowPlans([...tomorrowPlans, { title: '', categoryTag: 'UMUM', priority: 'SEDANG' }])}
                                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
                            >
                                <Plus size={12} /> Tambah Plan Besok
                            </button>
                        </div>

                        <div className="space-y-2.5">
                            {tomorrowPlans.map((item, idx) => (
                                <div key={idx} className="p-3 bg-white rounded-xl border border-indigo-100 shadow-2xs space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <input
                                            type="text"
                                            placeholder={`Rencana agenda kerja besok #${idx + 1}...`}
                                            value={item.title}
                                            onChange={(e) => {
                                                const updated = [...tomorrowPlans];
                                                updated[idx].title = e.target.value;
                                                setTomorrowPlans(updated);
                                            }}
                                            className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none"
                                        />
                                        <select
                                            value={item.priority || 'SEDANG'}
                                            onChange={(e) => {
                                                const updated = [...tomorrowPlans];
                                                updated[idx].priority = e.target.value;
                                                setTomorrowPlans(updated);
                                            }}
                                            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 outline-none cursor-pointer"
                                        >
                                            <option value="TINGGI">Prioritas Tinggi</option>
                                            <option value="SEDANG">Prioritas Sedang</option>
                                            <option value="RENDAH">Prioritas Rendah</option>
                                        </select>
                                        {tomorrowPlans.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => setTomorrowPlans(tomorrowPlans.filter((_, i) => i !== idx))}
                                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                                title="Hapus butir"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-colors cursor-pointer"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                        >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            <span>Simpan Laporan Harian</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DailyReportPppModal;
