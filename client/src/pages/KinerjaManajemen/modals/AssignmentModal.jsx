import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Calendar, User, AlertCircle, Save, Loader2, Sparkles, Target, Plus, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';
import api from '../../../lib/axios';

const AssignmentModal = ({ 
    isOpen, 
    onClose, 
    onSuccess, 
    staffList = [], 
    initialStaff = null, 
    initialData = null 
}) => {
    const [assigneeId, setAssigneeId] = useState('');
    const [title, setTitle] = useState('');
    const [targetOutput, setTargetOutput] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('UMUM');
    const [priority, setPriority] = useState('MEDIUM');
    const [dueDate, setDueDate] = useState('');
    const [planId, setPlanId] = useState(null);
    const [planItemIndex, setPlanItemIndex] = useState(null);
    const [items, setItems] = useState([
        { activity: '', targetDate: '', status: 'PENDING', percentage: 0 }
    ]);
    const [saving, setSaving] = useState(false);
    const [loadingAi, setLoadingAi] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (initialStaff) {
                setAssigneeId(initialStaff.id);
            } else if (staffList.length > 0) {
                setAssigneeId(staffList[0].id);
            }
            if (initialData) {
                setTitle(initialData.title || '');
                setTargetOutput(initialData.targetOutput || initialData.targetPencapaian || '');
                setDescription(initialData.description || '');
                setCategory(initialData.category || 'UMUM');
                setPriority(initialData.priority === 'TINGGI' ? 'HIGH' : (initialData.priority === 'RENDAH' ? 'LOW' : 'MEDIUM'));
                const dDate = initialData.dueDate || '';
                setDueDate(dDate);
                setPlanId(initialData.planId || null);
                setPlanItemIndex(initialData.planItemIndex !== undefined ? initialData.planItemIndex : null);

                // Inisialisasi butir pekerjaan dari initialData jika ada
                if (Array.isArray(initialData.items) && initialData.items.length > 0) {
                    setItems(initialData.items.map(it => ({
                        activity: it.activity || it.text || it.name || '',
                        targetDate: it.targetDate || dDate || '',
                        status: it.status || 'PENDING',
                        percentage: it.percentage !== undefined ? it.percentage : 0
                    })));
                } else if (initialData.activity) {
                    setItems([{
                        activity: initialData.activity,
                        targetDate: dDate || '',
                        status: 'PENDING',
                        percentage: 0
                    }]);
                } else {
                    setItems([{
                        activity: '',
                        targetDate: dDate || '',
                        status: 'PENDING',
                        percentage: 0
                    }]);
                }
            } else {
                setTitle('');
                setTargetOutput('');
                setDescription('');
                setCategory('UMUM');
                setPriority('MEDIUM');
                setDueDate('');
                setPlanId(null);
                setPlanItemIndex(null);
                setItems([{ activity: '', targetDate: '', status: 'PENDING', percentage: 0 }]);
            }
        }
    }, [isOpen, initialStaff, initialData, staffList]);

    if (!isOpen) return null;

    const handleAddItem = () => {
        setItems(prev => [...prev, { activity: '', targetDate: dueDate || '', status: 'PENDING', percentage: 0 }]);
    };

    const handleRemoveItem = (index) => {
        if (items.length <= 1) return;
        setItems(prev => prev.filter((_, idx) => idx !== index));
    };

    const handleItemChange = (index, field, value) => {
        setItems(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const handleAiBreakdown = async () => {
        if (!title || !title.trim()) {
            alert('Silakan isi "Judul Penugasan" terlebih dahulu agar AI dapat merinci butir pekerjaan yang relevan.');
            return;
        }

        const selectedStaff = staffList.find(s => s.id === parseInt(assigneeId, 10));
        const staffPosition = selectedStaff?.position || category || 'Staff Sarpras';

        try {
            setLoadingAi(true);
            const res = await api.post('/laporan/ai/breakdown-plan', {
                title: title.trim(),
                position: staffPosition,
                category: category,
                startDate: dayjs().format('YYYY-MM-DD'),
                endDate: dueDate || dayjs().add(7, 'day').format('YYYY-MM-DD'),
                priority: priority === 'HIGH' ? 'TINGGI' : (priority === 'LOW' ? 'RENDAH' : 'SEDANG')
            });

            if (res.data?.success && res.data?.data) {
                const aiData = res.data.data;
                const newSteps = Array.isArray(aiData.steps) ? aiData.steps : [];

                if (newSteps.length === 0) {
                    alert('AI belum dapat menghasilkan butir pekerjaan untuk tugas ini. Silakan buat judul lebih spesifik.');
                    return;
                }

                const mappedItems = newSteps.map((s, idx) => {
                    let stepTargetDate = s.targetDate || dueDate || dayjs().add(idx + 1, 'day').format('YYYY-MM-DD');
                    if (dueDate && dayjs(stepTargetDate).isAfter(dayjs(dueDate), 'day')) {
                        stepTargetDate = dueDate;
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
                    if (window.confirm(`✨ AI berhasil merinci ${mappedItems.length} butir pekerjaan penugasan!\n\nKlik "OK" untuk menggantikan butir saat ini, atau "Cancel" untuk menggabungkan/menambahkan ke butir yang sudah ada.`)) {
                        setItems(mappedItems);
                    } else {
                        setItems(prev => [...prev.filter(it => it.activity && it.activity.trim().length > 0), ...mappedItems]);
                    }
                } else {
                    setItems(mappedItems);
                }

                if ((aiData.targetOutput || aiData.expectedOutput) && (!targetOutput || !targetOutput.trim())) {
                    setTargetOutput(aiData.targetOutput || aiData.expectedOutput);
                }

                if (aiData.scopeNote && (!description || !description.trim())) {
                    setDescription(aiData.scopeNote);
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
        if (!assigneeId || !title.trim()) {
            alert('Mohon pilih staf penanggung jawab dan isi judul penugasan.');
            return;
        }

        try {
            setSaving(true);
            const validItems = items
                .filter(it => it.activity && it.activity.trim())
                .map(it => ({
                    activity: it.activity.trim(),
                    targetDate: it.targetDate || dueDate || null,
                    status: it.status || 'PENDING',
                    percentage: it.percentage !== undefined ? parseInt(it.percentage, 10) : 0
                }));

            const res = await api.post('/kinerja-manajemen/assign', {
                assigneeId,
                title: title.trim(),
                targetOutput: targetOutput.trim(),
                description,
                category,
                priority,
                dueDate: dueDate || null,
                items: validItems,
                planId,
                planItemIndex
            });

            if (res.data.success) {
                alert(res.data.message || 'Penugasan resmi berhasil diberikan!');
                if (onSuccess) onSuccess();
                onClose();
            }
        } catch (err) {
            console.error('Error creating assignment:', err);
            alert(err.response?.data?.error || 'Gagal memberikan penugasan.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0 bg-white">
                    <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                            <CheckSquare size={18} />
                        </span>
                        <div>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                {planId ? '📌 Angkat Plan Menjadi Penugasan' : '➕ Berikan Penugasan Resmi Kabid'}
                            </h3>
                            <p className="text-[11px] text-slate-400 font-medium">Instruksi langsung untuk staf sarpras</p>
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

                {/* Form Body */}
                <form id="assignment-modal-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar">
                    {/* Banner Rujukan Plan */}
                    {planId && (
                        <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-2xl flex items-start gap-2.5">
                            <Sparkles size={16} className="text-blue-600 shrink-0 mt-0.5" />
                            <div className="text-xs">
                                <span className="font-bold text-blue-900 block">Mengangkat Rencana Kerja Staf:</span>
                                <span className="text-blue-700 font-medium">
                                    {initialData?.planTitle ? `"${initialData.planTitle}"` : 'Rencana Kerja Terpilih'}
                                    {planItemIndex !== null && ` • Butir Kegiatan #${planItemIndex + 1}`}
                                </span>
                                <p className="text-[10px] text-blue-600 mt-1">
                                    Penugasan ini otomatis terhubung dengan butir rencana kerja staf dan akan memantau progresnya.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Staf Penerima Tugas */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1">
                            <User size={13} /> Pilih Staf Penanggung Jawab
                        </label>
                        <select
                            value={assigneeId}
                            onChange={(e) => setAssigneeId(e.target.value)}
                            required
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 cursor-pointer"
                        >
                            <option value="" disabled>-- Pilih Staf Sarpras --</option>
                            {staffList.map((st) => (
                                <option key={st.id} value={st.id}>
                                    {st.name} ({st.position || 'Staff'})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Judul Penugasan */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                            Judul Penugasan
                        </label>
                        <input
                            type="text"
                            placeholder="Contoh: Perbaikan & Perawatan AC Ruang Rapat Utama..."
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                        />
                    </div>

                    {/* Target Pencapaian / Output */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <Target size={13} className="text-blue-600" />
                            Target Pencapaian / Output
                        </label>
                        <input
                            type="text"
                            placeholder="Contoh: Seluruh unit AC selesai diservis dan berfungsi dingin maksimal..."
                            value={targetOutput}
                            onChange={(e) => setTargetOutput(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-blue-50/40 border border-blue-200/80 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 placeholder:text-slate-400 placeholder:font-normal"
                        />
                    </div>

                    {/* Kategori & Prioritas */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                                Kategori
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
                                <option value="UMUM">UMUM</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                                Prioritas
                            </label>
                            <select
                                value={priority}
                                onChange={(e) => setPriority(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
                            >
                                <option value="LOW">Rendah (Fleksibel)</option>
                                <option value="MEDIUM">Normal / Sedang</option>
                                <option value="HIGH">Tinggi (Penting)</option>
                                <option value="URGENT">Mendesak / Darurat</option>
                            </select>
                        </div>
                    </div>

                    {/* Tenggat Waktu (DueDate) */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1">
                            <Calendar size={13} /> Batas Waktu Penyelesaian (Deadline)
                        </label>
                        <input
                            type="date"
                            value={dueDate}
                            onChange={(e) => {
                                const newDate = e.target.value;
                                setDueDate(newDate);
                                setItems(prev => prev.map(it => ({ ...it, targetDate: it.targetDate || newDate })));
                            }}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 cursor-pointer"
                        />
                    </div>

                    {/* Rincian Butir Pekerjaan (Checklist & Langkah Aktivitas) */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <CheckSquare size={13} className="text-blue-600" />
                                Rincian Butir Pekerjaan ({items.length})
                            </label>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleAddItem}
                                    className="px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                >
                                    <Plus size={13} /> Tambah Butir
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {items.map((it, idx) => (
                                <div key={idx} className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-black text-[10px] flex items-center justify-center shrink-0">
                                            {idx + 1}
                                        </span>
                                        <input
                                            type="text"
                                            placeholder={`Aktivitas butir pekerjaan #${idx + 1}...`}
                                            value={it.activity}
                                            onChange={(e) => handleItemChange(idx, 'activity', e.target.value)}
                                            className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                                        />
                                        {items.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveItem(idx)}
                                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                                                title="Hapus butir ini"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 pl-7">
                                        <span className="text-[10px] font-bold text-slate-400">Target Selesai:</span>
                                        <input
                                            type="date"
                                            value={it.targetDate || dueDate || ''}
                                            onChange={(e) => handleItemChange(idx, 'targetDate', e.target.value)}
                                            className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 outline-none focus:border-blue-400 cursor-pointer"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Instruksi Khusus */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                            Instruksi / Catatan Khusus Kabid (Opsional)
                        </label>
                        <textarea
                            rows={3}
                            placeholder="Tuliskan arahan teknis, standar keselamatan, atau rincian pekerjaan..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 outline-none focus:border-blue-500 leading-relaxed"
                        />
                    </div>

                </form>

                {/* Footer Actions */}
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
                        form="assignment-modal-form"
                        disabled={saving}
                        className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        <span>Simpan & Tugaskan</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AssignmentModal;
