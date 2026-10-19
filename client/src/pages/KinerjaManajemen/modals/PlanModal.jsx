import React, { useState, useEffect } from 'react';
import { 
    X, Calendar, User, Tag, AlertCircle, 
    Plus, Trash2, CheckCircle2, Save, Loader2, Target, Clock 
} from 'lucide-react';
import api from '../../../lib/axios';
import dayjs from 'dayjs';

const PlanModal = ({ 
    isOpen, 
    onClose, 
    onSuccess, 
    staffList = [], 
    initialStaff = null, 
    initialPlan = null 
}) => {
    const [userId, setUserId] = useState('');
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('UMUM');
    const [priority, setPriority] = useState('SEDANG');
    const [startDate, setStartDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [endDate, setEndDate] = useState(dayjs().add(7, 'day').format('YYYY-MM-DD'));
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState([
        { activity: '', targetDate: dayjs().add(3, 'day').format('YYYY-MM-DD'), status: 'PENDING', percentage: 0 }
    ]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (initialPlan) {
                setUserId(initialPlan.userId || (initialStaff ? initialStaff.id : ''));
                setTitle(initialPlan.title || '');
                setCategory(initialPlan.categoryTag || initialPlan.category || 'UMUM');
                setPriority(initialPlan.priority || 'SEDANG');
                setStartDate(initialPlan.startDate ? dayjs(initialPlan.startDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'));
                setEndDate(initialPlan.endDate ? dayjs(initialPlan.endDate).format('YYYY-MM-DD') : dayjs().add(7, 'day').format('YYYY-MM-DD'));
                setNotes(initialPlan.content || '');
                const rawItems = Array.isArray(initialPlan.items) && initialPlan.items.length > 0 
                    ? initialPlan.items 
                    : [{ activity: '', targetDate: dayjs().add(3, 'day').format('YYYY-MM-DD'), status: 'PENDING', percentage: 0 }];
                setItems(rawItems.map(it => ({
                    activity: it.activity || it.text || it.name || '',
                    targetDate: it.targetDate ? dayjs(it.targetDate).format('YYYY-MM-DD') : '',
                    status: it.status || 'PENDING',
                    percentage: it.percentage !== undefined ? it.percentage : 0,
                    assigned: !!it.assigned,
                    assignmentId: it.assignmentId || null
                })));
            } else {
                setUserId(initialStaff ? initialStaff.id : (staffList[0]?.id || ''));
                setTitle('');
                setCategory('UMUM');
                setPriority('SEDANG');
                setStartDate(dayjs().format('YYYY-MM-DD'));
                setEndDate(dayjs().add(7, 'day').format('YYYY-MM-DD'));
                setNotes('');
                setItems([
                    { activity: '', targetDate: dayjs().add(3, 'day').format('YYYY-MM-DD'), status: 'PENDING', percentage: 0 }
                ]);
            }
        }
    }, [isOpen, initialPlan, initialStaff, staffList]);

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

    const handleItemChange = (index, field, value) => {
        setItems(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
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

        try {
            setSaving(true);
            const payload = {
                userId,
                title: title.trim(),
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-5 my-8 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
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

                <form onSubmit={handleSubmit} className="space-y-4">
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
                            <option value="" disabled>-- Pilih Staf Sarpras --</option>
                            {staffList.map((st) => (
                                <option key={st.id} value={st.id}>
                                    {st.name} ({st.position || 'Staff'})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Judul Rencana Kerja */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                            Nama / Target Pokok Rencana Kerja
                        </label>
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
                                onChange={(e) => setStartDate(e.target.value)}
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
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none"
                            />
                        </div>
                    </div>

                    {/* Rincian Butir Pekerjaan / Sub-Kegiatan */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <CheckCircle2 size={13} className="text-violet-600" /> Butir-Butir Aktivitas Pekerjaan ({items.length})
                            </label>
                            <button
                                type="button"
                                onClick={handleAddItem}
                                className="px-2.5 py-1 rounded-xl bg-violet-50 text-violet-700 hover:bg-violet-100 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            >
                                <Plus size={13} /> Tambah Butir
                            </button>
                        </div>
                        <p className="text-[11px] text-slate-400">
                            Setiap butir pekerjaan di bawah ini dapat diangkat langsung menjadi penugasan resmi oleh Kabid.
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
                                                        onChange={(e) => handleItemChange(idx, 'targetDate', e.target.value)}
                                                        className="px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 outline-none"
                                                    />
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

                    {/* Footer Actions */}
                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
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
                            className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-all shadow-md shadow-violet-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                        >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            <span>{initialPlan ? 'Simpan Perubahan' : 'Buat Rencana Kerja'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PlanModal;
