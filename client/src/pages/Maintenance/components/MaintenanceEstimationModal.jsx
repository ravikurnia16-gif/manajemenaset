import React, { useState, useEffect } from 'react';
import { 
    X, 
    CalendarClock, 
    Clock, 
    Calendar, 
    CheckCircle2, 
    AlertTriangle, 
    FileText, 
    Sparkles
} from 'lucide-react';
import dayjs from 'dayjs';

export default function MaintenanceEstimationModal({
    show,
    onClose,
    onSave,
    saving = false,
    report,
    initialStartDate = '',
    initialCompletionDate = '',
    initialNote = ''
}) {
    const [startDate, setStartDate] = useState('');
    const [completionDate, setCompletionDate] = useState('');
    const [note, setNote] = useState('');

    useEffect(() => {
        if (show) {
            const defaultStart = initialStartDate 
                ? dayjs(initialStartDate).format('YYYY-MM-DDTHH:mm') 
                : dayjs().format('YYYY-MM-DDTHH:mm');
            
            // Estimasi selesai hanya tanggal (tanpa jam)
            const defaultEnd = initialCompletionDate 
                ? dayjs(initialCompletionDate).format('YYYY-MM-DD') 
                : dayjs(defaultStart).add(1, 'day').format('YYYY-MM-DD');

            setStartDate(defaultStart);
            setCompletionDate(defaultEnd);
            setNote(initialNote || '');
        }
    }, [show, initialStartDate, initialCompletionDate, initialNote]);

    if (!show) return null;

    // Hitung durasi estimasi (berdasarkan tanggal selesai)
    let durationText = '';
    let isInvalidRange = false;
    if (startDate && completionDate) {
        const start = dayjs(startDate);
        const end = dayjs(completionDate).endOf('day');
        if (end.isBefore(start)) {
            isInvalidRange = true;
        } else {
            const diffDays = dayjs(completionDate).startOf('day').diff(dayjs(startDate).startOf('day'), 'day');
            if (diffDays === 0) {
                durationText = 'Target selesai hari ini';
            } else if (diffDays === 1) {
                durationText = 'Target selesai 1 hari (besok)';
            } else {
                durationText = `Target selesai dalam ${diffDays} hari kalender`;
            }
        }
    }

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!startDate || !completionDate) return;
        if (isInvalidRange) return;
        onSave({
            estimatedStartDate: startDate,
            estimatedCompletionDate: completionDate, // Tanggal saja YYYY-MM-DD
            estimationNote: note
        });
    };

    // Quick chip handlers untuk Mulai
    const setQuickStart = (type) => {
        if (type === 'NOW') {
            setStartDate(dayjs().format('YYYY-MM-DDTHH:mm'));
        } else if (type === 'TODAY_NOON') {
            setStartDate(dayjs().hour(13).minute(0).format('YYYY-MM-DDTHH:mm'));
        } else if (type === 'TOMORROW_MORNING') {
            setStartDate(dayjs().add(1, 'day').hour(8).minute(30).format('YYYY-MM-DDTHH:mm'));
        } else if (type === 'DAY_AFTER') {
            setStartDate(dayjs().add(2, 'day').hour(8).minute(30).format('YYYY-MM-DDTHH:mm'));
        }
    };

    // Quick chip handlers untuk Selesai (Hari)
    const setQuickEndDays = (days) => {
        const base = startDate ? dayjs(startDate) : dayjs();
        setCompletionDate(base.add(days, 'day').format('YYYY-MM-DD'));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 w-full max-w-lg space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 border border-slate-100">
                {/* Header */}
                <div className="flex justify-between items-start border-b border-slate-100 pb-3.5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/20">
                            <CalendarClock size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm sm:text-base font-extrabold text-slate-800">
                                Atur Estimasi Pengerjaan Teknisi
                            </h3>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                Tentukan perkiraan waktu mulai & tanggal target selesai perbaikan.
                            </p>
                        </div>
                    </div>
                    <button 
                        type="button"
                        onClick={onClose} 
                        className="text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Ringkasan Laporan */}
                {report && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span className="font-mono font-bold text-blue-700">{report.code}</span>
                            <span className="font-semibold text-slate-600">{report.unit?.name || 'Unit Sarpras'}</span>
                        </div>
                        <h4 className="font-bold text-slate-800 line-clamp-1">{report.title}</h4>
                        {report.technician && (
                            <div className="text-[11px] text-amber-800 font-medium">
                                Pelaksana: <strong>{report.technician}</strong>
                            </div>
                        )}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* 1. ESTIMASI MULAI */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <Calendar size={13} className="text-blue-600" />
                            <span>1. Estimasi Mulai Pengerjaan (Tanggal & Jam) *</span>
                        </label>
                        <input
                            type="datetime-local"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            required
                            className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
                        />
                        {/* Quick Start Chips */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            <button
                                type="button"
                                onClick={() => setQuickStart('NOW')}
                                className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 border border-slate-200 transition-colors cursor-pointer"
                            >
                                Sekarang
                            </button>
                            <button
                                type="button"
                                onClick={() => setQuickStart('TODAY_NOON')}
                                className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 border border-slate-200 transition-colors cursor-pointer"
                            >
                                Hari ini (13:00)
                            </button>
                            <button
                                type="button"
                                onClick={() => setQuickStart('TOMORROW_MORNING')}
                                className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 border border-slate-200 transition-colors cursor-pointer"
                            >
                                Besok Pagi (08:30)
                            </button>
                            <button
                                type="button"
                                onClick={() => setQuickStart('DAY_AFTER')}
                                className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 border border-slate-200 transition-colors cursor-pointer"
                            >
                                Lusa Pagi
                            </button>
                        </div>
                    </div>

                    {/* 2. ESTIMASI SELESAI (TANGGAL SAJA - TANPA JAM) */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <Clock size={13} className="text-emerald-600" />
                                <span>2. Estimasi Target Selesai (Tanggal Saja) *</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold lowercase">
                                (tanpa jam)
                            </span>
                        </label>
                        <input
                            type="date"
                            value={completionDate}
                            onChange={(e) => setCompletionDate(e.target.value)}
                            required
                            className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-emerald-500 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all cursor-pointer"
                        />
                        {/* Quick Duration Chips (Hari) */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            <span className="text-[10px] text-slate-400 font-semibold py-0.5 self-center">Pilihan Hari:</span>
                            <button
                                type="button"
                                onClick={() => setCompletionDate(dayjs().format('YYYY-MM-DD'))}
                                className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 border border-slate-200 transition-colors cursor-pointer"
                            >
                                Hari Ini
                            </button>
                            <button
                                type="button"
                                onClick={() => setCompletionDate(dayjs().add(1, 'day').format('YYYY-MM-DD'))}
                                className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 border border-slate-200 transition-colors cursor-pointer"
                            >
                                Besok
                            </button>
                            <button
                                type="button"
                                onClick={() => setQuickEndDays(2)}
                                className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 border border-slate-200 transition-colors cursor-pointer"
                            >
                                +2 Hari
                            </button>
                            <button
                                type="button"
                                onClick={() => setQuickEndDays(3)}
                                className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 border border-slate-200 transition-colors cursor-pointer"
                            >
                                +3 Hari
                            </button>
                            <button
                                type="button"
                                onClick={() => setQuickEndDays(7)}
                                className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 border border-slate-200 transition-colors cursor-pointer"
                            >
                                +1 Pekan
                            </button>
                            <button
                                type="button"
                                onClick={() => setQuickEndDays(14)}
                                className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 border border-slate-200 transition-colors cursor-pointer"
                            >
                                +2 Pekan
                            </button>
                        </div>
                    </div>

                    {/* Durasi Info / Error Alert */}
                    {isInvalidRange ? (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                            <AlertTriangle size={15} className="shrink-0" />
                            <span>Perhatian: Tanggal target selesai tidak boleh sebelum tanggal mulai!</span>
                        </div>
                    ) : durationText ? (
                        <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200/90 text-emerald-900 text-xs flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles size={14} className="text-emerald-600 shrink-0" />
                                <span>Perkiraan Target Selesai:</span>
                            </div>
                            <span className="font-black text-emerald-800">{durationText}</span>
                        </div>
                    ) : null}

                    {/* 3. CATATAN RENCANA TINDAKAN (OPSIONAL) */}
                    <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <FileText size={13} className="text-slate-500" />
                            <span>3. Catatan Rencana / Tahapan Awal (Opsional)</span>
                        </label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Contoh: Menunggu suku cadang kapasitor datang besok pagi, pengerjaan dilakukan di luar jam belajar..."
                            rows={2}
                            className="w-full p-3 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-xs text-slate-700 resize-none outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                        />
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex gap-3 pt-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={saving || !startDate || !completionDate || isInvalidRange}
                            className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                        >
                            {saving ? (
                                <>
                                    <span className="w-3.5 h-3.5 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                                    <span>Menyimpan...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={15} />
                                    <span>Simpan Estimasi</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
