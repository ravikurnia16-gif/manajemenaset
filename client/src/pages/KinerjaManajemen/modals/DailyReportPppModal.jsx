import React, { useState, useEffect } from 'react';
import { 
    X, CheckCircle2, Clock, AlertTriangle, 
    Plus, Trash2, Save, Loader2, Calendar, 
    User, Sparkles, Layers, CheckSquare 
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
    const [selectedStaffId, setSelectedStaffId] = useState('');
    const [reportDate, setReportDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [category, setCategory] = useState('UMUM');

    // 4 Pilar Laporan Harian Terpadu
    const [completedItems, setCompletedItems] = useState([
        { title: '', output: '', categoryTag: 'UMUM', isPlanned: false }
    ]);
    const [inProgressItems, setInProgressItems] = useState([]);
    const [hasObstacle, setHasObstacle] = useState(false);
    const [obstacleNote, setObstacleNote] = useState('');
    const [actionPlan, setActionPlan] = useState('');
    const [tomorrowPlans, setTomorrowPlans] = useState([
        { title: '', categoryTag: 'UMUM', priority: 'SEDANG' }
    ]);

    const [saving, setSaving] = useState(false);

    // Set default staff
    useEffect(() => {
        if (isOpen && staffList.length > 0 && !selectedStaffId) {
            setSelectedStaffId(staffList[0].id);
        }
    }, [isOpen, staffList]);

    if (!isOpen) return null;

    // Ambil rencana & penugasan staf yang sedang dipilih
    const currentStaffProfile = staffPlansData.find(s => s.id === parseInt(selectedStaffId));
    const activeStaffPlans = currentStaffProfile?.plans || [];
    const activeStaffAssignments = currentStaffProfile?.assignments || [];

    // Quick add from plan/assignment
    const handleAddFromPlanOrAssignment = (item, type = 'PLAN') => {
        const titleText = item.title || item.name || '';
        const catTag = item.categoryTag || item.category || 'UMUM';

        setCompletedItems(prev => [
            ...prev.filter(i => i.title.trim()),
            {
                title: titleText,
                output: 'Tuntas dilaksanakan sesuai target jadwal.',
                categoryTag: catTag,
                isPlanned: true,
                sourceType: type,
                sourceId: item.id
            }
        ]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const validCompleted = completedItems.filter(i => i.title.trim());
        const validInProgress = inProgressItems.filter(i => i.title.trim());
        const validTomorrowPlans = tomorrowPlans.filter(i => i.title && i.title.trim());

        if (validCompleted.length === 0 && validInProgress.length === 0 && !hasObstacle && validTomorrowPlans.length === 0) {
            alert('Mohon isi minimal satu butir pekerjaan (selesai, dalam proses, kendala, atau rencana besok).');
            return;
        }

        const obstacleItems = hasObstacle && obstacleNote.trim() ? [{
            title: 'Hambatan Lapangan',
            obstacleNote: obstacleNote.trim(),
            actionPlan: actionPlan.trim(),
            categoryTag: category
        }] : [];

        try {
            setSaving(true);
            const res = await api.post('/kinerja-manajemen/daily-report', {
                userId: parseInt(selectedStaffId),
                date: reportDate,
                category,
                completedItems: validCompleted,
                inProgressItems: validInProgress,
                obstacleItems,
                tomorrowPlans: validTomorrowPlans
            });

            if (res.data.success) {
                alert('Laporan harian terpadu berhasil dicatat!');
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-5 max-h-[90vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                            <CheckCircle2 size={18} />
                        </span>
                        <div>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                📝 Input Laporan Harian Terpadu (PPP)
                            </h3>
                            <p className="text-[11px] text-slate-400 font-medium">Progress, Plans, & Problems</p>
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

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Baris Pilihan Staf & Tanggal */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-600 tracking-wider flex items-center gap-1">
                                <User size={12} /> Staf Pelapor
                            </label>
                            <select
                                value={selectedStaffId}
                                onChange={(e) => setSelectedStaffId(e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
                            >
                                {staffList.map((st) => (
                                    <option key={st.id} value={st.id}>
                                        {st.name} ({st.position || 'Staff'})
                                    </option>
                                ))}
                            </select>
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

                    {/* Quick Pull from Staff Plans & Assignments */}
                    {(activeStaffPlans.length > 0 || activeStaffAssignments.length > 0) && (
                        <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-100 space-y-2">
                            <span className="text-[10px] font-black uppercase text-blue-800 tracking-wider flex items-center gap-1.5">
                                💡 Tarik Cepat dari Rencana / Penugasan Aktif Staf Ini:
                            </span>
                            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                                {activeStaffPlans.map(p => (
                                    <button
                                        key={`pl-${p.id}`}
                                        type="button"
                                        onClick={() => handleAddFromPlanOrAssignment(p, 'PLAN')}
                                        className="px-2.5 py-1 bg-white hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-200 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                                        title="Tambahkan butir rencana ini ke laporan selesai"
                                    >
                                        <Plus size={12} /> {p.title}
                                    </button>
                                ))}
                                {activeStaffAssignments.map(a => (
                                    <button
                                        key={`as-${a.id}`}
                                        type="button"
                                        onClick={() => handleAddFromPlanOrAssignment(a, 'ASSIGNMENT')}
                                        className="px-2.5 py-1 bg-white hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-200 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                                        title="Tambahkan penugasan ini ke laporan selesai"
                                    >
                                        <Plus size={12} /> [Tugas] {a.title}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* PILAR A: Tugas Selesai (Completed) */}
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
                                <Plus size={12} /> Tambah Butir
                            </button>
                        </div>

                        <div className="space-y-2.5">
                            {completedItems.map((item, idx) => (
                                <div key={idx} className="p-3 bg-white rounded-xl border border-emerald-100 shadow-2xs space-y-2">
                                    <div className="flex items-center justify-between gap-2">
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
                                        <select
                                            value={item.categoryTag}
                                            onChange={(e) => {
                                                const updated = [...completedItems];
                                                updated[idx].categoryTag = e.target.value;
                                                setCompletedItems(updated);
                                            }}
                                            className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 outline-none"
                                        >
                                            <option value="ASET">ASET</option>
                                            <option value="TEKNISI">TEKNISI</option>
                                            <option value="KENDARAAN">KENDARAAN</option>
                                            <option value="GUDANG">GUDANG</option>
                                            <option value="UMUM">UMUM</option>
                                        </select>
                                        {completedItems.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => setCompletedItems(completedItems.filter((_, i) => i !== idx))}
                                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Wujud hasil / output (misal: Unit normal, filter bersih...)"
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
                                onClick={() => setInProgressItems([...inProgressItems, { title: '', progressPercentage: 50, targetDate: 'Besok', categoryTag: 'UMUM' }])}
                                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                            >
                                <Plus size={12} /> Tambah Butir
                            </button>
                        </div>

                        {inProgressItems.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic">Tidak ada pekerjaan on-progress (opsional).</p>
                        ) : (
                            <div className="space-y-2.5">
                                {inProgressItems.map((item, idx) => (
                                    <div key={idx} className="p-3 bg-white rounded-xl border border-amber-100 shadow-2xs space-y-2">
                                        <div className="flex items-center justify-between gap-2">
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
                                            <button
                                                type="button"
                                                onClick={() => setInProgressItems(inProgressItems.filter((_, i) => i !== idx))}
                                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
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

                    {/* PILAR D: Rencana Kerja Besok (Tomorrow's Plan) */}
                    <div className="p-4 bg-indigo-50/40 border border-indigo-200/80 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                                    <Sparkles size={15} className="text-indigo-600" /> D. Rencana Kerja Besok (Tomorrow's Plan)
                                </h4>
                                <p className="text-[10px] text-indigo-700 font-medium">
                                    Komitmen agenda kerja untuk hari kerja berikutnya (otomatis masuk ke Kolom Plans)
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setTomorrowPlans([...tomorrowPlans, { title: '', categoryTag: 'UMUM', priority: 'SEDANG' }])}
                                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
                            >
                                <Plus size={12} /> Tambah Plan
                            </button>
                        </div>

                        {tomorrowPlans.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic">Belum ada butir rencana besok (opsional).</p>
                        ) : (
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
                                                value={item.categoryTag}
                                                onChange={(e) => {
                                                    const updated = [...tomorrowPlans];
                                                    updated[idx].categoryTag = e.target.value;
                                                    setTomorrowPlans(updated);
                                                }}
                                                className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 outline-none cursor-pointer"
                                            >
                                                <option value="ASET">ASET</option>
                                                <option value="TEKNISI">TEKNISI</option>
                                                <option value="KENDARAAN">KENDARAAN</option>
                                                <option value="GUDANG">GUDANG</option>
                                                <option value="UMUM">UMUM</option>
                                            </select>
                                            <select
                                                value={item.priority || 'SEDANG'}
                                                onChange={(e) => {
                                                    const updated = [...tomorrowPlans];
                                                    updated[idx].priority = e.target.value;
                                                    setTomorrowPlans(updated);
                                                }}
                                                className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 outline-none cursor-pointer"
                                            >
                                                <option value="TINGGI">Prioritas Tinggi</option>
                                                <option value="SEDANG">Prioritas Sedang</option>
                                                <option value="RENDAH">Prioritas Rendah</option>
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => setTomorrowPlans(tomorrowPlans.filter((_, i) => i !== idx))}
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
