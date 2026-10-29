import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
    Trash2, Send, User, Clock, CheckCircle, CheckCircle2, ExternalLink, Wrench, 
    Target, CheckSquare, Sparkles, RotateCcw, Plus, Calendar, Flame, Zap, 
    AlertCircle, ChevronDown, ChevronUp, Loader2, ArrowRight, Layers
} from 'lucide-react';
import dayjs from 'dayjs';
import api from '../../../lib/axios';
import { DIVISION_TAGS } from '../constants';

export default function AssignmentsTab({
    isKabid,
    user,
    assignments = [],
    staffList = [],
    showAssignmentForm,
    setShowAssignmentForm,
    assignmentForm = {
        title: '',
        targetOutput: '',
        description: '',
        assigneeId: '',
        startDate: dayjs().format('YYYY-MM-DD'),
        dueDate: dayjs().add(3, 'day').format('YYYY-MM-DD'),
        category: 'UMUM',
        priority: 'SEDANG',
        items: []
    },
    setAssignmentForm,
    handleCreateAssignment,
    handleUpdateTaskProgress,
    handleUpdateAssignmentItem,
    handlePurgeRoutine,
    routinePurged,
    saving,
    onImportTaskToReport
}) {
    const [loadingAiBreakdown, setLoadingAiBreakdown] = useState(false);
    const [polishingTitle, setPolishingTitle] = useState(false);
    const [filterCategory, setFilterCategory] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'COMPLETED'
    const [searchQuery, setSearchQuery] = useState('');

    // AI Task Breakdown Handler (Mirroring Rencana Kerja)
    const handleAiBreakdown = async () => {
        if (!assignmentForm.title?.trim()) {
            alert('Silakan ketik Judul Penugasan terlebih dahulu agar AI dapat merinci langkah yang sesuai.');
            return;
        }

        try {
            setLoadingAiBreakdown(true);
            const res = await api.post('/laporan/ai/breakdown-plan', {
                title: assignmentForm.title,
                category: assignmentForm.category || 'UMUM',
                startDate: assignmentForm.startDate || dayjs().format('YYYY-MM-DD'),
                endDate: assignmentForm.dueDate || dayjs().add(3, 'day').format('YYYY-MM-DD'),
                priority: assignmentForm.priority || 'SEDANG'
            });

            if (res.data?.success && res.data?.data) {
                const aiData = res.data.data;
                const newItems = Array.isArray(aiData.steps) ? aiData.steps.map(s => ({
                    activity: s.activity || '',
                    text: s.activity || '',
                    targetDate: s.targetDate || assignmentForm.dueDate,
                    status: 'PENDING',
                    percentage: 0
                })) : [];

                setAssignmentForm(prev => ({
                    ...prev,
                    targetOutput: aiData.targetOutput || prev.targetOutput || '',
                    priority: aiData.priority || prev.priority || 'SEDANG',
                    items: newItems,
                    description: prev.description ? prev.description : (aiData.scopeNote || '')
                }));

                alert(`✨ AI Berhasil merinci ${newItems.length} butir langkah teknis, menetapkan target capaian, dan menyarankan prioritas: ${aiData.priority || 'SEDANG'}!`);
            }
        } catch (err) {
            console.error('AI Breakdown error:', err);
            alert(err.response?.data?.error || 'Gagal merinci langkah penugasan dengan AI. Silakan coba lagi.');
        } finally {
            setLoadingAiBreakdown(false);
        }
    };

    // AI Polish Judul Penugasan
    const handlePolishTitle = async () => {
        if (!assignmentForm.title?.trim()) return;
        try {
            setPolishingTitle(true);
            const res = await api.post('/laporan/ai/polish-text', {
                text: assignmentForm.title,
                mode: 'PLAN'
            });
            if (res.data?.success && res.data?.polished) {
                setAssignmentForm(prev => ({ ...prev, title: res.data.polished }));
            }
        } catch (err) {
            console.error('AI Polish title error:', err);
        } finally {
            setPolishingTitle(false);
        }
    };

    // Step item handlers
    const handleAddItemField = () => {
        setAssignmentForm(prev => ({
            ...prev,
            items: [
                ...(prev.items || []),
                {
                    activity: '',
                    text: '',
                    targetDate: prev.dueDate || dayjs().format('YYYY-MM-DD'),
                    percentage: 0,
                    status: 'PENDING'
                }
            ]
        }));
    };

    const handleRemoveItemField = (index) => {
        setAssignmentForm(prev => ({
            ...prev,
            items: (prev.items || []).filter((_, i) => i !== index)
        }));
    };

    const handleItemChange = (index, field, value) => {
        setAssignmentForm(prev => {
            const next = [...(prev.items || [])];
            next[index] = { ...next[index], [field]: value };
            if (field === 'activity') next[index].text = value;
            if (field === 'text') next[index].activity = value;
            return { ...prev, items: next };
        });
    };

    // Toggle individual step done status
    const handleToggleStep = (task, itIdx, currentItem) => {
        const isDone = currentItem.percentage === 100 || currentItem.status === 'COMPLETED';
        const newPct = isDone ? 0 : 100;
        const newStatus = isDone ? 'PENDING' : 'COMPLETED';
        if (handleUpdateAssignmentItem) {
            handleUpdateAssignmentItem(task.id, itIdx, newPct, newStatus);
        }
    };

    // Exclude legacy Maintenance delegations ([MT]) from Penugasan
    const nonMaintenanceAssignments = assignments.filter(task => {
        const isMaint = (task.title && task.title.startsWith('[MT]')) ||
            (typeof task.notes === 'string' && (task.notes.includes('"source":"MAINTENANCE"') || task.notes.includes('"maintenanceId"')));
        return !isMaint;
    });

    // Filter assignments
    const filteredAssignments = nonMaintenanceAssignments.filter(task => {
        const matchesCat = filterCategory === 'ALL' || task.category === filterCategory;
        const isCompleted = task.progressPercentage === 100 || task.status === 'COMPLETED';
        const matchesStatus = filterStatus === 'ALL' 
            ? true 
            : filterStatus === 'COMPLETED' ? isCompleted : !isCompleted;
        const matchesSearch = !searchQuery.trim() || 
            task.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            task.assignee?.name?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCat && matchesStatus && matchesSearch;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* 1. TOP HEADER & KABID ACTION BAR */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                <Target size={18} />
                            </span>
                            <div>
                                <h3 className="text-sm sm:text-base font-black text-slate-800">
                                    Delegasi Penugasan Staf
                                </h3>
                                <p className="text-xs text-slate-400 font-medium">
                                    Kelola instruksi kerja berstruktur target output, tenggat waktu, dan butir tahapan pengerjaan.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {isKabid && !routinePurged && (
                            <button
                                type="button"
                                onClick={handlePurgeRoutine}
                                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                title="Hapus semua tugas rutin otomatis yang menumpuk di database (hanya 1 kali pakai)"
                            >
                                <Trash2 size={13} /> Bersihkan Rutin
                            </button>
                        )}
                        {isKabid && (
                            <button
                                type="button"
                                onClick={() => setShowAssignmentForm(!showAssignmentForm)}
                                className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95 ${
                                    showAssignmentForm 
                                        ? 'bg-slate-800 hover:bg-slate-900 text-white' 
                                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/20'
                                }`}
                            >
                                {showAssignmentForm ? (
                                    <>Tutup Formulir</>
                                ) : (
                                    <>
                                        <Plus size={15} />
                                        <span>Beri Penugasan Baru</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* 2. FORMULIR PENUGASAN BERSTRUKTUR (MODEL RENCANA KERJA DENGAN AI) */}
                {isKabid && showAssignmentForm && (
                    <form 
                        onSubmit={handleCreateAssignment} 
                        className="p-5 sm:p-6 bg-gradient-to-b from-blue-50/40 via-slate-50 to-white border border-blue-100 rounded-3xl space-y-5 animate-in fade-in"
                    >
                        <div className="flex items-center justify-between border-b border-blue-100 pb-3">
                            <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-lg bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider">
                                    Format Rencana Kerja Terstruktur
                                </span>
                                <span className="text-xs font-bold text-slate-500 hidden sm:inline">
                                    Lengkap dengan Target Capaian & Rincian Butir Langkah
                                </span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-medium">
                                Otomatis kirim notifikasi WhatsApp ke staf
                            </span>
                        </div>

                        <div className="space-y-4">
                            {/* A. Judul Penugasan + AI Action Buttons */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                        <span>1. Judul Penugasan</span>
                                        <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <button
                                            type="button"
                                            disabled={polishingTitle || !assignmentForm.title?.trim()}
                                            onClick={handlePolishTitle}
                                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-40 shadow-2xs"
                                            title="Rapikan bahasa judul menggunakan AI"
                                        >
                                            {polishingTitle ? <RotateCcw size={11} className="animate-spin text-blue-600" /> : <Sparkles size={11} className="text-blue-600" />}
                                            <span>Rapikan Judul (AI)</span>
                                        </button>
                                    </div>
                                </div>
                                <input 
                                    required 
                                    placeholder="Contoh: Perbaikan & Pembersihan Kompresor AC Ruang Guru Gedung B"
                                    value={assignmentForm.title}
                                    onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs placeholder:text-slate-400 placeholder:font-normal"
                                />
                            </div>

                            {/* B. Target Penugasan (Output Capaian) */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                    <Target size={14} className="text-blue-600" />
                                    <span>2. Target Penugasan (Hasil Capaian / Output Terukur)</span>
                                </label>
                                <input 
                                    placeholder="Contoh: Suhu pendingin stabil di 20°C, saluran pembuangan lancar tanpa bocor, dan filter bersih terpasang"
                                    value={assignmentForm.targetOutput || ''}
                                    onChange={(e) => setAssignmentForm({ ...assignmentForm, targetOutput: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-blue-900 outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs placeholder:text-slate-400 placeholder:font-normal"
                                />
                                <p className="text-[11px] text-slate-400 font-medium">
                                    Tentukan standar kualitas atau wujud hasil akhir yang harus dicapai staf saat penugasan dinyatakan selesai 100%.
                                </p>
                            </div>

                            {/* C. Delegasi Staf, Divisi & Prioritas */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                                {/* Staf Penerima */}
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">
                                        Ditugaskan Kepada <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        required
                                        value={assignmentForm.assigneeId}
                                        onChange={(e) => setAssignmentForm({ ...assignmentForm, assigneeId: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
                                    >
                                        <option value="">-- Pilih Staf Penerima Tugas --</option>
                                        {staffList.map(s => (
                                            <option key={s.id} value={s.id}>
                                                {s.name} ({s.position || 'Staf'})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Kategori Divisi */}
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">
                                        Kategori Divisi
                                    </label>
                                    <select
                                        value={assignmentForm.category}
                                        onChange={(e) => setAssignmentForm({ ...assignmentForm, category: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
                                    >
                                        {DIVISION_TAGS.map(d => (
                                            <option key={d.key} value={d.key}>{d.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Prioritas Penugasan */}
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">
                                        Tingkat Prioritas
                                    </label>
                                    <div className="grid grid-cols-3 gap-1 bg-slate-200/70 p-1 rounded-2xl">
                                        <button
                                            type="button"
                                            onClick={() => setAssignmentForm({ ...assignmentForm, priority: 'TINGGI' })}
                                            className={`py-1.5 px-1 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                                assignmentForm.priority === 'TINGGI'
                                                    ? 'bg-rose-600 text-white shadow-xs'
                                                    : 'text-slate-700 hover:text-slate-900'
                                            }`}
                                        >
                                            <Flame size={11} /> Tinggi
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAssignmentForm({ ...assignmentForm, priority: 'SEDANG' })}
                                            className={`py-1.5 px-1 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                                assignmentForm.priority === 'SEDANG'
                                                    ? 'bg-amber-500 text-white shadow-xs'
                                                    : 'text-slate-700 hover:text-slate-900'
                                            }`}
                                        >
                                            <Zap size={11} /> Sedang
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAssignmentForm({ ...assignmentForm, priority: 'RENDAH' })}
                                            className={`py-1.5 px-1 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                                assignmentForm.priority === 'RENDAH'
                                                    ? 'bg-emerald-600 text-white shadow-xs'
                                                    : 'text-slate-700 hover:text-slate-900'
                                            }`}
                                        >
                                            <CheckCircle2 size={11} /> Rendah
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* D. Tanggal Mulai & Batas Waktu */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">
                                        Tanggal Mulai Pengerjaan
                                    </label>
                                    <input 
                                        type="date"
                                        required
                                        value={assignmentForm.startDate}
                                        onChange={(e) => setAssignmentForm({ ...assignmentForm, startDate: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none cursor-pointer shadow-2xs"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">
                                        Batas Waktu (Deadline Penugasan) <span className="text-rose-500">*</span>
                                    </label>
                                    <input 
                                        type="date"
                                        required
                                        min={assignmentForm.startDate || dayjs().format('YYYY-MM-DD')}
                                        value={assignmentForm.dueDate}
                                        onChange={(e) => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-indigo-700 outline-none cursor-pointer shadow-2xs"
                                    />
                                </div>
                            </div>

                            {/* E. Butir Langkah Kerja (Checklist Pengerjaan) */}
                            <div className="space-y-2 pt-2 border-t border-slate-200/80">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div>
                                        <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                                            3. Butir-Butir Langkah Penugasan ({assignmentForm.items?.length || 0} Langkah)
                                        </label>
                                        <p className="text-[11px] text-slate-400 font-medium">
                                            Rincikan tahapan agar staf dapat menandai progres per butir secara transparan.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddItemField}
                                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                                    >
                                        <Plus size={13} /> Tambah Butir Langkah
                                    </button>
                                </div>

                                {(!assignmentForm.items || assignmentForm.items.length === 0) ? (
                                    <div className="p-4 bg-white/70 rounded-2xl border border-dashed border-slate-200 text-center space-y-1.5">
                                        <p className="text-xs font-bold text-slate-600">
                                            Belum ada butir langkah ditambahkan.
                                        </p>
                                        <p className="text-[11px] text-slate-400">
                                            Klik tombol <span className="font-bold text-blue-600">"+ Tambah Butir Langkah"</span> untuk merinci pengerjaan secara bertahap.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                        {assignmentForm.items.map((it, idx) => (
                                            <div key={idx} className="p-3 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-2xs">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-5 text-center text-xs font-black text-blue-600 shrink-0">
                                                        {idx + 1}.
                                                    </span>
                                                    <input
                                                        type="text"
                                                        required
                                                        placeholder={`Uraian langkah kerja ke-${idx + 1}...`}
                                                        value={it.activity || it.text || ''}
                                                        onChange={(e) => handleItemChange(idx, 'activity', e.target.value)}
                                                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-blue-500"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveItemField(idx)}
                                                        className="p-2 text-slate-300 hover:text-rose-500 rounded-xl hover:bg-rose-50 transition cursor-pointer shrink-0"
                                                        title="Hapus langkah ini"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>

                                                <div className="flex items-center justify-between pl-7 pr-1">
                                                    <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                                                        <Calendar size={12} className="text-blue-500" /> Target Tanggal Langkah:
                                                    </label>
                                                    <input
                                                        type="date"
                                                        value={it.targetDate || ''}
                                                        min={assignmentForm.startDate || dayjs().format('YYYY-MM-DD')}
                                                        max={assignmentForm.dueDate}
                                                        onChange={(e) => handleItemChange(idx, 'targetDate', e.target.value)}
                                                        className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* F. Catatan Tambahan / Instruksi Spesifik */}
                            <div className="space-y-1 pt-1 border-t border-slate-200/80">
                                <label className="text-xs font-bold text-slate-700 block">
                                    Catatan / Instruksi Khusus (Opsional)
                                </label>
                                <textarea 
                                    rows="2"
                                    placeholder="Tuliskan arahan spesifik, alat/material yang harus disiapkan, atau catatan K3..."
                                    value={assignmentForm.description}
                                    onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                                />
                            </div>
                        </div>

                        {/* Submit & Cancel Buttons */}
                        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-blue-100">
                            <button
                                type="button"
                                onClick={() => setShowAssignmentForm(false)}
                                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                            >
                                Batal
                            </button>
                            <button 
                                type="submit" 
                                disabled={saving}
                                className="px-7 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-2xl text-xs font-black shadow-md shadow-blue-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                            >
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                <span>Kirim Delegasi Penugasan</span>
                            </button>
                        </div>
                    </form>
                )}

                {/* 3. FILTER & SEARCH STRIP */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 custom-scrollbar">
                        <button
                            type="button"
                            onClick={() => setFilterStatus('ALL')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                                filterStatus === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Semua ({nonMaintenanceAssignments.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterStatus('ACTIVE')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                                filterStatus === 'ACTIVE' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Sedang Berjalan
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterStatus('COMPLETED')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                                filterStatus === 'COMPLETED' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Selesai (100%)
                        </button>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
                        >
                            <option value="ALL">Semua Divisi</option>
                            {DIVISION_TAGS.map(d => (
                                <option key={d.key} value={d.key}>{d.label}</option>
                            ))}
                        </select>
                        <input 
                            type="text"
                            placeholder="Cari tugas / nama staf..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none w-full md:w-48"
                        />
                    </div>
                </div>
            </div>

            {/* 4. DAFTAR KARTU PENUGASAN (ASSIGNMENTS LIST) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredAssignments.length === 0 ? (
                    <div className="col-span-full p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400 italic text-xs space-y-1.5">
                        <Target size={32} className="mx-auto text-slate-300 mb-1" />
                        <p>Belum ada daftar penugasan aktif yang sesuai dengan filter.</p>
                        {isKabid && (
                            <button
                                type="button"
                                onClick={() => setShowAssignmentForm(true)}
                                className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                            >
                                + Klik di sini untuk membuat penugasan baru
                            </button>
                        )}
                    </div>
                ) : (
                    filteredAssignments.map(task => {
                        let maintenanceMeta = null;
                        let targetOutput = task.targetOutput || '';
                        let taskItems = Array.isArray(task.items) ? task.items : [];
                        
                        if (task.notes) {
                            try {
                                const parsed = JSON.parse(task.notes);
                                if (parsed.source === 'MAINTENANCE' || parsed.maintenanceId) {
                                    maintenanceMeta = parsed;
                                }
                                if (!targetOutput && parsed.targetOutput) {
                                    targetOutput = parsed.targetOutput;
                                }
                            } catch (e) {
                                const match = task.notes.match(/"maintenanceId":\s*(\d+)/);
                                if (match) maintenanceMeta = { maintenanceId: match[1] };
                            }
                        }

                        const isDone = task.progressPercentage === 100 || task.status === 'COMPLETED';
                        const isOverdue = !isDone && task.dueDate && dayjs().isAfter(dayjs(task.dueDate), 'day');

                        return (
                            <div 
                                key={task.id} 
                                className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow"
                            >
                                <div className="space-y-3">
                                    {/* Header: Divisi, Maintenance link & Status % */}
                                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                                                {task.category || 'UMUM'}
                                            </span>
                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border flex items-center gap-1 ${
                                                task.priority === 'TINGGI'
                                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                    : task.priority === 'RENDAH'
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                            }`}>
                                                {task.priority === 'TINGGI' ? <Flame size={10} /> : <Zap size={10} />}
                                                {task.priority || 'SEDANG'}
                                            </span>
                                            {maintenanceMeta && (
                                                <span className="text-[10px] font-black tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                                    <Wrench size={10} /> #{maintenanceMeta.maintenanceCode || maintenanceMeta.maintenanceId}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <span className={`px-2.5 py-0.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 ${
                                                isDone 
                                                    ? 'bg-emerald-100 text-emerald-700' 
                                                    : isOverdue 
                                                        ? 'bg-rose-100 text-rose-700' 
                                                        : 'bg-amber-100 text-amber-700'
                                            }`}>
                                                {isDone ? 'Selesai 100%' : `${task.progressPercentage}%`}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Title & Deskripsi */}
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-black text-slate-800 leading-snug">
                                            {task.title}
                                        </h4>
                                        {task.description && (
                                            <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                                {task.description}
                                            </p>
                                        )}
                                    </div>

                                    {/* Target Penugasan Badge (Jika ada) */}
                                    {targetOutput && (
                                        <div className="flex items-start gap-2 text-xs bg-blue-50/80 border border-blue-200/70 rounded-2xl p-3 shadow-2xs">
                                            <Target size={14} className="text-blue-600 shrink-0 mt-0.5" />
                                            <div className="flex-1 min-w-0">
                                                <span className="font-bold text-blue-950 uppercase tracking-wider text-[10px] block mb-0.5">
                                                    Target Capaian Penugasan:
                                                </span>
                                                <p className="font-semibold text-slate-800 text-xs leading-relaxed">
                                                    {targetOutput}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Butir-Butir Langkah Checklist Interaktif */}
                                    {taskItems.length > 0 && (
                                        <div className="space-y-2 pt-2 border-t border-slate-100">
                                            <div className="flex items-center justify-between text-[11px] font-bold">
                                                <span className="text-slate-500 uppercase tracking-wider text-[10px] flex items-center gap-1">
                                                    <Layers size={12} className="text-blue-600" />
                                                    Butir Tahapan ({taskItems.filter(i => i.percentage === 100 || i.status === 'COMPLETED').length}/{taskItems.length} Selesai)
                                                </span>
                                                <span className="text-[10px] text-slate-400">
                                                    Klik centang untuk update
                                                </span>
                                            </div>

                                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                                {taskItems.map((it, itIdx) => {
                                                    const itName = it.activity || it.text || it.name;
                                                    const itDone = it.percentage === 100 || it.status === 'COMPLETED' || it.status === 'SELESAI';
                                                    const canEdit = user.id === task.assigneeId || isKabid;

                                                    return (
                                                        <div 
                                                            key={itIdx} 
                                                            onClick={() => canEdit && handleToggleStep(task, itIdx, it)}
                                                            className={`p-2 rounded-xl text-xs flex items-center justify-between gap-2.5 border transition-all ${
                                                                itDone 
                                                                    ? 'bg-emerald-50/60 border-emerald-200/80 text-emerald-950' 
                                                                    : 'bg-slate-50 hover:bg-blue-50/50 border-slate-200 text-slate-800'
                                                            } ${canEdit ? 'cursor-pointer active:scale-98' : ''}`}
                                                            title={canEdit ? (itDone ? 'Tandai belum selesai' : 'Tandai langkah ini selesai 100%') : ''}
                                                        >
                                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                                <span className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border transition-all ${
                                                                    itDone ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-300'
                                                                }`}>
                                                                    {itDone && <CheckCircle2 size={12} />}
                                                                </span>
                                                                <span className={`font-semibold text-xs leading-snug truncate ${itDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                                                    {itIdx + 1}. {itName}
                                                                </span>
                                                            </div>

                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                {it.targetDate && (
                                                                    <span className="text-[10px] text-slate-400 font-bold">
                                                                        {dayjs(it.targetDate).format('DD/MM')}
                                                                    </span>
                                                                )}
                                                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${
                                                                    itDone ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                                                                }`}>
                                                                    {itDone ? '100%' : `${it.percentage || 0}%`}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Link Maintenance Tiket jika terkait */}
                                    {maintenanceMeta?.maintenanceId && (
                                        <div className="pt-1">
                                            <Link 
                                                to={`/pemeliharaan/${maintenanceMeta.maintenanceId}`}
                                                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                                            >
                                                <span>Buka Tiket Pemeliharaan Terkait</span>
                                                <ExternalLink size={12} />
                                            </Link>
                                        </div>
                                    )}
                                </div>

                                {/* Footer: Staf penerima, deadline & Progress Slider */}
                                <div className="space-y-3 pt-3 border-t border-slate-100">
                                    <div className="flex items-center justify-between text-xs text-slate-500 flex-wrap gap-2">
                                        <div className="flex items-center gap-1.5 font-bold text-slate-700">
                                            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">
                                                <User size={11} />
                                            </span>
                                            <span>{task.assignee?.name}</span>
                                        </div>
                                        <div className={`flex items-center gap-1 text-[11px] font-bold ${isOverdue ? 'text-rose-600' : 'text-slate-500'}`}>
                                            <Clock size={12} /> 
                                            <span>Deadline: {task.dueDate ? dayjs(task.dueDate).format('DD MMM YYYY') : '-'}</span>
                                        </div>
                                    </div>

                                    {/* Slider Progress Bar */}
                                    {(user.id === task.assigneeId || isKabid) && (
                                        <div className="space-y-2 bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
                                            <div className="flex items-center justify-between text-[11px] font-black text-slate-500 uppercase">
                                                <span>Capaian Total Penugasan</span>
                                                <div className="flex items-center gap-1">
                                                    <input 
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        value={task.progressPercentage ?? 0}
                                                        onChange={(e) => {
                                                            const raw = e.target.value;
                                                            const val = raw === '' ? 0 : Math.min(100, Math.max(0, parseInt(raw) || 0));
                                                            handleUpdateTaskProgress(task.id, val);
                                                        }}
                                                        className="w-14 px-1.5 py-0.5 bg-blue-100 hover:bg-blue-200/80 focus:bg-white border border-blue-300 focus:border-blue-500 rounded text-center text-blue-900 font-black text-xs outline-none transition-all shadow-2xs"
                                                        placeholder="0"
                                                        title="Ketik angka progres (0 - 100%)"
                                                    />
                                                    <span className="text-blue-700 font-black text-xs">%</span>
                                                </div>
                                            </div>
                                            <input 
                                                type="range"
                                                min="0"
                                                max="100"
                                                step="5"
                                                value={task.progressPercentage}
                                                onChange={(e) => handleUpdateTaskProgress(task.id, e.target.value)}
                                                className="w-full accent-blue-600 cursor-pointer"
                                            />
                                            <div className="flex items-center gap-1.5">
                                                {[25, 50, 75, 100].map(pct => (
                                                    <button
                                                        key={pct}
                                                        type="button"
                                                        onClick={() => handleUpdateTaskProgress(task.id, pct)}
                                                        className={`flex-1 py-1 text-[10px] font-black rounded-lg transition-all cursor-pointer border ${
                                                            task.progressPercentage === pct 
                                                                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs' 
                                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                                        }`}
                                                    >
                                                        {pct === 100 ? '100% Selesai' : `${pct}%`}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Salin Tugas ke Butir Laporan Harian (PPP) - Jangan hubungkan jika penugasan dari maintenance */}
                                            {user.id === task.assigneeId && onImportTaskToReport && !maintenanceMeta && (
                                                <button
                                                    type="button"
                                                    onClick={() => onImportTaskToReport(task)}
                                                    className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer mt-1 active:scale-98 shadow-2xs"
                                                    title="Salin tugas ini ke dalam formulir laporan harian hari ini"
                                                >
                                                    <CheckCircle size={13} className="text-blue-600" />
                                                    <span>Tarik Tugas Ini ke Laporan Harian Hari Ini</span>
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
