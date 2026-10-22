import React, { useState } from 'react';
import { 
    Users, User, CheckCircle2, Clock, AlertTriangle, 
    Plus, ArrowRight, ChevronDown, ChevronRight, 
    Calendar, CheckSquare, Search, Award, ShieldAlert, Sparkles,
    Edit3, Trash2, Target, ExternalLink, Filter, Check
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import api from '../../../lib/axios';

dayjs.locale('id');

const StaffPlansTab = ({ 
    staffPlansData = [], 
    loading, 
    onOpenAssignModal, 
    onOpenPlanModal,
    onRefresh 
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDivision, setSelectedDivision] = useState('ALL');
    const [expandedStaffId, setExpandedStaffId] = useState(null);
    const [updatingItemId, setUpdatingItemId] = useState(null);

    if (loading) {
        return (
            <div className="py-16 text-center space-y-3">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm font-bold text-slate-500">Memuat rencana kerja dan penugasan seluruh staf...</p>
            </div>
        );
    }

    const divisions = [
        { key: 'ALL', label: 'Semua Bidang' },
        { key: 'TEKNISI', label: 'Teknisi' },
        { key: 'KENDARAAN', label: 'Kendaraan' },
        { key: 'GUDANG', label: 'Gudang' },
        { key: 'ASET', label: 'Aset' },
        { key: 'KEUANGAN', label: 'Keuangan' },
        { key: 'UMUM', label: 'Umum' }
    ];

    const filteredStaff = staffPlansData.filter(st => {
        const q = searchQuery.toLowerCase();
        const matchesQuery = (
            (st.name || '').toLowerCase().includes(q) ||
            (st.position || '').toLowerCase().includes(q) ||
            st.plans.some(p => (p.title || '').toLowerCase().includes(q)) ||
            st.assignments.some(a => (a.title || '').toLowerCase().includes(q))
        );

        if (!matchesQuery) return false;
        if (selectedDivision === 'ALL') return true;

        const pos = (st.position || '').toUpperCase();
        return pos.includes(selectedDivision);
    });

    // Quick Update Butir Rencana
    const handleQuickUpdateItemProgress = async (planId, itemIndex, newPct) => {
        try {
            setUpdatingItemId(`${planId}_${itemIndex}`);
            await api.put(`/kinerja-manajemen/plans/${planId}/item`, {
                itemIndex,
                percentage: newPct,
                status: newPct === 100 ? 'SELESAI' : 'PENDING'
            });
            if (onRefresh) onRefresh();
        } catch (err) {
            console.error('Error updating plan item:', err);
            alert('Gagal memperbarui progres butir kegiatan.');
        } finally {
            setUpdatingItemId(null);
        }
    };

    // Hapus Plan
    const handleDeletePlan = async (planId, title) => {
        if (!window.confirm(`Yakin ingin menghapus rencana kerja: "${title}"?`)) return;
        try {
            await api.delete(`/kinerja-manajemen/plans/${planId}`);
            alert('Rencana kerja berhasil dihapus.');
            if (onRefresh) onRefresh();
        } catch (err) {
            console.error('Error deleting plan:', err);
            alert('Gagal menghapus rencana kerja.');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* 1. Header Toolbar */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-wider">
                            Rencana Staf & Penugasan Kabid
                        </span>
                        <span className="text-xs text-slate-400 font-medium">• Single Source of Work</span>
                    </div>
                    <h3 className="text-base font-black text-slate-800">
                        Monitoring Rencana Kerja Mandiri & Penugasan Resmi per Staf
                    </h3>
                </div>

                {/* Search & Actions */}
                <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="relative min-w-[200px]">
                        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Cari staf atau pekerjaan..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={() => onOpenPlanModal && onOpenPlanModal()}
                        className="px-3.5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                        title="Buat Rencana Kerja Mandiri untuk Staf"
                    >
                        <Target size={14} /> + Buat Rencana Staf
                    </button>

                    <button
                        type="button"
                        onClick={() => onOpenAssignModal && onOpenAssignModal()}
                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                        title="Berikan Instruksi Penugasan Resmi"
                    >
                        <Plus size={14} /> Beri Tugas Kabid
                    </button>
                </div>
            </div>

            {/* Division Filter Badges */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {divisions.map((div) => (
                    <button
                        key={div.key}
                        onClick={() => setSelectedDivision(div.key)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                            selectedDivision === div.key
                                ? 'bg-slate-800 text-white shadow-xs'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        {div.label}
                    </button>
                ))}
            </div>

            {/* 2. List of Staff Cards */}
            <div className="space-y-4">
                {filteredStaff.length === 0 ? (
                    <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                        <Users size={32} className="text-slate-300 mx-auto mb-2" />
                        <p className="text-sm font-bold text-slate-600">Tidak ada staf yang sesuai dengan kriteria pencarian.</p>
                        <p className="text-xs text-slate-400">Silakan ubah filter bidang atau kata kunci pencarian.</p>
                    </div>
                ) : (
                    filteredStaff.map((staff) => {
                        const isExpanded = expandedStaffId === staff.id;

                        return (
                            <div 
                                key={staff.id} 
                                className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden transition-all hover:border-blue-200"
                            >
                                {/* Card Header / Summary Row */}
                                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-50/50 to-white">
                                    <div className="flex items-center gap-3.5 min-w-0">
                                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
                                            {(staff.name || 'S').substring(0, 1).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="text-sm font-black text-slate-800 truncate">
                                                {staff.name}
                                            </h4>
                                            <p className="text-xs text-slate-500 font-semibold truncate">
                                                {staff.position || 'Staff Sarana & Prasarana'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Stats Badges & Quick Action Buttons */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="px-3 py-1 bg-violet-50 text-violet-800 rounded-xl text-xs font-bold border border-violet-200/60">
                                            📋 {staff.stats.activePlansCount} Rencana Aktif
                                        </span>
                                        <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${
                                            staff.stats.overdueAssignmentsCount > 0 
                                                ? 'bg-rose-50 text-rose-800 border-rose-200 animate-pulse' 
                                                : 'bg-emerald-50 text-emerald-800 border-emerald-200/60'
                                        }`}>
                                            📌 {staff.stats.activeAssignmentsCount} Penugasan 
                                            {staff.stats.overdueAssignmentsCount > 0 && ` (${staff.stats.overdueAssignmentsCount} Overdue)`}
                                        </span>

                                        <button
                                            type="button"
                                            onClick={() => onOpenPlanModal && onOpenPlanModal(staff)}
                                            className="px-2.5 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                            title="Susun Rencana Kerja untuk Staf Ini"
                                        >
                                            <Plus size={13} /> Rencana
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => onOpenAssignModal && onOpenAssignModal(staff)}
                                            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-2xs active:scale-95 cursor-pointer"
                                            title="Berikan Penugasan Resmi untuk Staf Ini"
                                        >
                                            <Plus size={13} /> Tugas
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setExpandedStaffId(isExpanded ? null : staff.id)}
                                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                                            title={isExpanded ? 'Tutup Rincian' : 'Buka Rincian Plan & Tugas'}
                                        >
                                            <ChevronDown size={16} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded Section: Rencana Kerja Mandiri & Penugasan Resmi */}
                                {isExpanded && (
                                    <div className="p-5 border-t border-slate-100 bg-slate-50/40 space-y-5 animate-in fade-in duration-200">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                            
                                            {/* Sub-Kolom 1: Rencana Kerja Mandiri Staf (Plans) */}
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                                        <Target size={14} className="text-violet-600" /> Rencana Kerja Mandiri Staf ({staff.plans.length})
                                                    </h5>
                                                    <button
                                                        type="button"
                                                        onClick={() => onOpenPlanModal && onOpenPlanModal(staff)}
                                                        className="text-[10px] text-violet-600 hover:text-violet-800 font-bold flex items-center gap-1 cursor-pointer"
                                                    >
                                                        <Plus size={11} /> Tambah Plan
                                                    </button>
                                                </div>

                                                {staff.plans.length === 0 ? (
                                                    <div className="text-center p-6 bg-white rounded-2xl border border-slate-200/60 space-y-2">
                                                        <p className="text-xs text-slate-400 italic">
                                                            Staf ini belum memiliki rencana kerja mandiri aktif.
                                                        </p>
                                                        <button
                                                            type="button"
                                                            onClick={() => onOpenPlanModal && onOpenPlanModal(staff)}
                                                            className="px-3 py-1 bg-violet-50 text-violet-700 hover:bg-violet-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                                                        >
                                                            + Buat Rencana Kerja Sekarang
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {staff.plans.map((p) => {
                                                            const priorityColor = p.priority === 'TINGGI' 
                                                                ? 'bg-rose-50 text-rose-700 border-rose-200' 
                                                                : (p.priority === 'RENDAH' ? 'bg-slate-50 text-slate-600 border-slate-200' : 'bg-amber-50 text-amber-700 border-amber-200');

                                                            return (
                                                                <div key={p.id} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                                                                    {/* Plan Header */}
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <div className="space-y-1 flex-1 min-w-0">
                                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                                <span className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 text-[9px] font-black uppercase">
                                                                                    {p.categoryTag}
                                                                                </span>
                                                                                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${priorityColor}`}>
                                                                                    {p.priority || 'SEDANG'}
                                                                                </span>
                                                                                <span className="text-[10px] text-slate-400 font-medium">
                                                                                    {p.startDate ? dayjs(p.startDate).format('DD MMM') : ''} - {p.endDate ? dayjs(p.endDate).format('DD MMM YYYY') : 'Minggu ini'}
                                                                                </span>
                                                                            </div>
                                                                            <h6 className="text-xs font-black text-slate-800 leading-snug">{p.title}</h6>
                                                                            {p.targetOutput && (
                                                                                <div className="flex items-center gap-1.5 text-[11px] text-violet-900 bg-violet-50/80 border border-violet-100 rounded-lg px-2 py-0.5 mt-1 max-w-full">
                                                                                    <Target size={11} className="text-violet-600 shrink-0" />
                                                                                    <span className="font-bold text-violet-700 shrink-0">Target:</span>
                                                                                    <span className="font-medium text-slate-700 truncate">{p.targetOutput}</span>
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* Edit / Delete Actions */}
                                                                        <div className="flex items-center gap-1 shrink-0">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => onOpenPlanModal && onOpenPlanModal(staff, p)}
                                                                                className="p-1 text-slate-400 hover:text-violet-600 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                                                                                title="Edit Rencana Kerja Ini"
                                                                            >
                                                                                <Edit3 size={13} />
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleDeletePlan(p.id, p.title)}
                                                                                className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                                                                                title="Hapus Rencana Kerja Ini"
                                                                            >
                                                                                <Trash2 size={13} />
                                                                            </button>
                                                                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ml-1 ${
                                                                                p.isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                                                            }`}>
                                                                                {p.avgPct}%
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    {/* Progress Bar */}
                                                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                                        <div 
                                                                            className={`h-full rounded-full transition-all duration-300 ${
                                                                                p.avgPct === 100 ? 'bg-emerald-500' : 'bg-violet-500'
                                                                            }`}
                                                                            style={{ width: `${p.avgPct}%` }}
                                                                        />
                                                                    </div>

                                                                    {/* Butir-butir aktivitas di dalam plan */}
                                                                    {p.items && p.items.length > 0 && (
                                                                        <div className="space-y-1.5 pt-2 border-t border-slate-100">
                                                                            <span className="text-[10px] font-bold text-slate-400 block">
                                                                                Rincian Butir Pekerjaan ({p.items.length}):
                                                                            </span>
                                                                            <div className="space-y-1.5">
                                                                                {p.items.map((it, itIdx) => {
                                                                                    const isUpdating = updatingItemId === `${p.id}_${itIdx}`;
                                                                                    const itName = it.activity || it.text || it.name;
                                                                                    const isItemAssigned = !!it.assigned || !!it.assignmentId;

                                                                                    return (
                                                                                        <div 
                                                                                            key={itIdx} 
                                                                                            className="p-2 bg-slate-50/80 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-slate-100"
                                                                                        >
                                                                                            <div className="space-y-0.5 min-w-0 flex-1">
                                                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                                                    <span className="font-semibold text-slate-700 truncate">
                                                                                                        {itName}
                                                                                                    </span>
                                                                                                    {isItemAssigned && (
                                                                                                        <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase">
                                                                                                            ✓ Ditugaskan Resmi
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>
                                                                                                {it.targetDate && (
                                                                                                    <span className="text-[10px] text-slate-400 block">
                                                                                                        Target: {dayjs(it.targetDate).format('DD MMM YYYY')}
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                            
                                                                                            {/* Actions per item: Status slider & Angkat Jadi Tugas */}
                                                                                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                                                                                                {/* Quick Progres Dropdown */}
                                                                                                <select
                                                                                                    value={it.percentage || 0}
                                                                                                    disabled={isUpdating}
                                                                                                    onChange={(e) => handleQuickUpdateItemProgress(p.id, itIdx, parseInt(e.target.value, 10))}
                                                                                                    className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-bold text-slate-700 outline-none cursor-pointer"
                                                                                                >
                                                                                                    <option value={0}>0%</option>
                                                                                                    <option value={50}>50%</option>
                                                                                                    <option value={100}>100%</option>
                                                                                                </select>

                                                                                                {/* Tombol Angkat Menjadi Penugasan Resmi */}
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={() => onOpenAssignModal(staff, {
                                                                                                        title: itName,
                                                                                                        description: `Diangkat dari Rencana Kerja: "${p.title}"`,
                                                                                                        planTitle: p.title,
                                                                                                        category: p.categoryTag || 'UMUM',
                                                                                                        priority: p.priority || 'SEDANG',
                                                                                                        dueDate: it.targetDate || p.endDate || '',
                                                                                                        planId: p.id,
                                                                                                        planItemIndex: itIdx
                                                                                                    })}
                                                                                                    className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white text-[10px] font-bold transition-all shrink-0 cursor-pointer shadow-2xs active:scale-95"
                                                                                                    title="Jadikan Penugasan Resmi Kabid untuk butir ini"
                                                                                                >
                                                                                                    📌 Angkat Jadi Tugas
                                                                                                </button>
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {/* Tombol Angkat Master Plan Jika Tidak Ada Butir */}
                                                                    {(!p.items || p.items.length === 0) && (
                                                                        <div className="pt-2 border-t border-slate-100 flex justify-end">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => onOpenAssignModal(staff, {
                                                                                    title: p.title,
                                                                                    description: `Diangkat langsung dari Rencana Kerja Staf: "${p.title}"`,
                                                                                    planTitle: p.title,
                                                                                    category: p.categoryTag || 'UMUM',
                                                                                    priority: p.priority || 'SEDANG',
                                                                                    dueDate: p.endDate || '',
                                                                                    planId: p.id
                                                                                })}
                                                                                className="px-3 py-1 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white text-[11px] font-bold transition-all cursor-pointer"
                                                                            >
                                                                                📌 Angkat Seluruh Plan Jadi Penugasan
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Sub-Kolom 2: Penugasan Resmi dari Kabid (Assignments) */}
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                                        <CheckSquare size={14} className="text-emerald-600" /> Penugasan Resmi Kabid ({staff.assignments.length})
                                                    </h5>
                                                    <button
                                                        type="button"
                                                        onClick={() => onOpenAssignModal(staff)}
                                                        className="text-[10px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
                                                    >
                                                        <Plus size={11} /> Tugas Baru
                                                    </button>
                                                </div>

                                                {staff.assignments.length === 0 ? (
                                                    <div className="text-center p-6 bg-white rounded-2xl border border-slate-200/60 space-y-2">
                                                        <p className="text-xs text-slate-400 italic">
                                                            Belum ada penugasan resmi aktif untuk staf ini.
                                                        </p>
                                                        <button
                                                            type="button"
                                                            onClick={() => onOpenAssignModal(staff)}
                                                            className="px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                                                        >
                                                            + Berikan Penugasan Baru
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {staff.assignments.map((a) => (
                                                            <div key={a.id} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5">
                                                                <div className="flex items-start justify-between gap-2">
                                                                    <div className="space-y-1 flex-1 min-w-0">
                                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                                                                a.isOverdue ? 'bg-rose-100 text-rose-800 font-black' : 'bg-slate-100 text-slate-700'
                                                                            }`}>
                                                                                {a.isOverdue ? '⚠️ Overdue' : (a.category || 'UMUM')}
                                                                            </span>
                                                                            {a.isFromPlan && (
                                                                                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[9px] font-black uppercase flex items-center gap-1">
                                                                                    <Sparkles size={9} /> Sumber Plan
                                                                                </span>
                                                                            )}
                                                                            <span className="text-[10px] text-slate-400 font-medium">
                                                                                Deadline: {a.dueDate ? dayjs(a.dueDate).format('DD MMM YYYY') : 'Fleksibel'}
                                                                            </span>
                                                                        </div>
                                                                        <h6 className="text-xs font-black text-slate-800 leading-snug">{a.title}</h6>
                                                                    </div>
                                                                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase shrink-0 ${
                                                                        a.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                                                                    }`}>
                                                                        {a.progressPercentage || 0}%
                                                                    </span>
                                                                </div>

                                                                {a.description && (
                                                                    <p className="text-[11px] text-slate-500 line-clamp-2 italic bg-slate-50/70 p-2 rounded-xl">
                                                                        "{a.description}"
                                                                    </p>
                                                                )}

                                                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                                    <div 
                                                                        className={`h-full rounded-full transition-all duration-300 ${
                                                                            a.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-blue-500'
                                                                        }`}
                                                                        style={{ width: `${a.progressPercentage || 0}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default StaffPlansTab;
