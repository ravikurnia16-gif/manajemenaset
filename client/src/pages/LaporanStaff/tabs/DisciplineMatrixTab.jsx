import React, { useState } from 'react';
import { Download, CheckCircle2, Clock, AlertTriangle, X, FileText, Calendar, User, Image as ImageIcon, Info, ShieldCheck } from 'lucide-react';
import dayjs from 'dayjs';

export default function DisciplineMatrixTab({
    matrixMonth,
    setMatrixMonth,
    handleExportExcelMatrix,
    matrixSummary = [],
    matrixDateRange = []
}) {
    const [selectedCell, setSelectedCell] = useState(null);

    // Hitung ringkasan kedisiplinan bulan berjalan
    let totalWorkDays = 0;
    let totalCompleteOnWorkDays = 0;
    let totalReportsSubmitted = 0;

    matrixDateRange.forEach(d => {
        const dayOfWeek = dayjs(d).day();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        if (!isWeekend) {
            totalWorkDays++;
        }
    });

    const totalPossibleSubmissions = totalWorkDays * matrixSummary.length;

    matrixSummary.forEach(st => {
        matrixDateRange.forEach(d => {
            const dayOfWeek = dayjs(d).day();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const stat = st.summaryByDate?.[d]?.status;
            if (stat === 'LENGKAP' || stat === 'PARSIAL') {
                totalReportsSubmitted++;
                if (!isWeekend) {
                    totalCompleteOnWorkDays += (stat === 'LENGKAP' ? 1 : 0.5);
                }
            }
        });
    });

    const complianceRate = totalPossibleSubmissions > 0
        ? Math.min(100, Math.round((totalCompleteOnWorkDays / totalPossibleSubmissions) * 100))
        : 0;

    const renderPppItemsList = (title, items, badgeColor, iconEmoji) => {
        if (!items || items.length === 0) return null;
        return (
            <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-700">
                    <span>{iconEmoji}</span>
                    <span>{title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold">
                        {items.length}
                    </span>
                </div>
                <div className="space-y-2 pl-2 border-l-2 border-slate-100">
                    {items.map((it, idx) => {
                        const titleText = typeof it === 'string' ? it : (it.title || it.text || 'Kegiatan');
                        const tag = it.categoryTag ? `[${it.categoryTag}] ` : '';
                        const photos = Array.isArray(it.photos) ? it.photos : [];
                        return (
                            <div key={idx} className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 text-xs space-y-1.5">
                                <div className="flex items-start justify-between gap-2">
                                    <span className="font-bold text-slate-800 leading-snug">
                                        {idx + 1}. <span className="text-emerald-700 font-black">{tag}</span>{titleText}
                                    </span>
                                    {it.progressPercentage !== undefined && (
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black shrink-0 ${badgeColor}`}>
                                            {it.progressPercentage}%
                                        </span>
                                    )}
                                </div>
                                {it.output && (
                                    <p className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-100">
                                        <strong className="text-slate-700 font-bold">Output/Hasil:</strong> {it.output}
                                    </p>
                                )}
                                {it.obstacleNote && (
                                    <p className="text-[11px] text-rose-700 bg-rose-50/80 p-2 rounded-lg border border-rose-100">
                                        <strong className="text-rose-800 font-bold">Kendala:</strong> {it.obstacleNote}
                                    </p>
                                )}
                                {it.actionPlan && (
                                    <p className="text-[11px] text-amber-700 bg-amber-50/80 p-2 rounded-lg border border-amber-100">
                                        <strong className="text-amber-800 font-bold">Rencana Solusi:</strong> {it.actionPlan}
                                    </p>
                                )}
                                {photos.length > 0 && (
                                    <div className="pt-1">
                                        <div className="text-[10px] text-slate-400 font-bold mb-1 flex items-center gap-1">
                                            <ImageIcon size={10} /> Foto Dokumentasi ({photos.length})
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {photos.map((ph, pIdx) => {
                                                const url = ph.url || ph;
                                                return (
                                                    <a key={pIdx} href={url} target="_blank" rel="noreferrer" className="block w-16 h-16 rounded-lg overflow-hidden border border-slate-200 hover:opacity-80 transition-opacity">
                                                        <img src={url} alt={`Dokumentasi ${idx + 1}-${pIdx + 1}`} className="w-full h-full object-cover" />
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header Controls */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                        <ShieldCheck size={20} className="text-emerald-600" />
                        Matriks Rekapitulasi Kedisiplinan Staf
                    </h3>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                        Rekapitulasi kepatuhan pelaporan harian staf Divisi Sarana dan Prasarana (Metode PPP).
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <input 
                        type="month" 
                        value={matrixMonth}
                        onChange={(e) => setMatrixMonth(e.target.value)}
                        className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-inner"
                    />
                    <button
                        onClick={handleExportExcelMatrix}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 cursor-pointer hover:shadow"
                    >
                        <Download size={14} /> Ekspor Excel
                    </button>
                </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <User size={18} />
                    </div>
                    <div>
                        <div className="text-lg font-black text-slate-800 leading-tight">{matrixSummary.length} Staf</div>
                        <div className="text-[11px] text-slate-400 font-semibold">Total Staf Terdaftar</div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                        <CheckCircle2 size={18} />
                    </div>
                    <div>
                        <div className="text-lg font-black text-emerald-700 leading-tight">{complianceRate}%</div>
                        <div className="text-[11px] text-slate-400 font-semibold">Tingkat Kedisiplinan Hari Kerja</div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                        <FileText size={18} />
                    </div>
                    <div>
                        <div className="text-lg font-black text-purple-700 leading-tight">{totalReportsSubmitted} Laporan</div>
                        <div className="text-[11px] text-slate-400 font-semibold">Total Laporan Bulan Ini</div>
                    </div>
                </div>
            </div>

            {/* Table Container */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase border-b border-slate-100">
                                <th className="p-4 sticky left-0 bg-slate-50 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.03)] min-w-[180px]">
                                    Nama Staf
                                </th>
                                <th className="p-4 min-w-[140px]">Jabatan</th>
                                {matrixDateRange.map(d => {
                                    const dayNum = dayjs(d).format('DD');
                                    const dayOfWeek = dayjs(d).day();
                                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                                    const isSunday = dayOfWeek === 0;
                                    return (
                                        <th 
                                            key={d} 
                                            className={`p-2 text-center min-w-[38px] ${
                                                isWeekend ? 'bg-slate-100/70 text-slate-400' : ''
                                            }`}
                                            title={dayjs(d).format('dddd, DD MMMM YYYY')}
                                        >
                                            <span className={`${isSunday ? 'text-rose-500 font-black' : isWeekend ? 'text-amber-600 font-bold' : ''}`}>
                                                {dayNum}
                                            </span>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                            {matrixSummary.map(st => (
                                <tr key={st.id} className="hover:bg-slate-50/70 transition-colors">
                                    <td className="p-4 font-bold text-slate-800 sticky left-0 bg-white z-10 shadow-[2px_0_5px_rgba(0,0,0,0.03)]">
                                        {st.name}
                                    </td>
                                    <td className="p-4 text-slate-500 text-[11px] whitespace-nowrap">
                                        {st.position || 'Staf Sarana'}
                                    </td>
                                    {matrixDateRange.map(d => {
                                        const cell = st.summaryByDate?.[d];
                                        const stat = cell?.status || 'BELUM';
                                        const dayOfWeek = dayjs(d).day();
                                        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                                        return (
                                            <td 
                                                key={d} 
                                                className={`p-1 text-center ${isWeekend ? 'bg-slate-50/40' : ''}`}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedCell({ staff: st, date: d, data: cell })}
                                                    className={`w-7 h-7 rounded-lg text-[11px] font-black transition-all flex items-center justify-center mx-auto cursor-pointer ${
                                                        stat === 'LENGKAP' 
                                                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 hover:scale-110 shadow-sm shadow-emerald-500/10' 
                                                            : stat === 'PARSIAL' 
                                                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 hover:scale-110 shadow-sm shadow-amber-500/10' 
                                                            : isWeekend
                                                            ? 'bg-slate-100/60 text-slate-300 hover:bg-slate-200/60'
                                                            : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
                                                    }`} 
                                                    title={`${st.name} (${dayjs(d).format('DD MMM')}): ${stat === 'LENGKAP' ? 'Laporan Lengkap (Metode PPP)' : stat === 'PARSIAL' ? 'Parsial (Sesi Lama)' : 'Belum Lapor / Libur'}. Klik untuk detail.`}
                                                >
                                                    {stat === 'LENGKAP' ? '✓' : stat === 'PARSIAL' ? '½' : '—'}
                                                </button>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                            {matrixSummary.length === 0 && (
                                <tr>
                                    <td colSpan={matrixDateRange.length + 2} className="p-8 text-center text-slate-400 font-medium">
                                        Tidak ada data staf untuk periode ini.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Legend Bar */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs font-medium text-slate-600">
                    <div className="flex items-center gap-4 flex-wrap">
                        <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                            <Info size={13} className="text-blue-500" />
                            Keterangan Status:
                        </span>
                        <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded bg-emerald-100 text-emerald-700 font-black text-[10px] flex items-center justify-center">✓</span>
                            <span className="text-[11px] font-bold text-slate-700">Laporan Lengkap (Format Baru PPP)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded bg-amber-100 text-amber-700 font-black text-[10px] flex items-center justify-center">½</span>
                            <span className="text-[11px] text-slate-600">Parsial (Arsip Sesi Lama)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded bg-slate-100 text-slate-400 font-bold text-[10px] flex items-center justify-center">—</span>
                            <span className="text-[11px] text-slate-500">Belum Lapor / Hari Libur</span>
                        </div>
                    </div>
                    <div className="text-[11px] text-slate-400 italic">
                        💡 Klik ikon tanggal untuk melihat rincian laporan dan foto dokumentasi kegiatan.
                    </div>
                </div>
            </div>

            {/* Quick Inspection Modal */}
            {selectedCell && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 max-h-[85vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="flex items-start justify-between pb-4 border-b border-slate-100 shrink-0">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h4 className="text-base font-black text-slate-800">
                                        {selectedCell.staff.name}
                                    </h4>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
                                        {selectedCell.staff.position || 'Staf Sarana'}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400 font-medium flex items-center gap-1 mt-1">
                                    <Calendar size={13} className="text-blue-500" />
                                    {dayjs(selectedCell.date).format('dddd, DD MMMM YYYY')}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedCell(null)}
                                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="overflow-y-auto custom-scrollbar py-4 space-y-4 flex-1">
                            {/* Status Pill */}
                            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                <span className="text-xs font-bold text-slate-600">Status Kedisiplinan:</span>
                                {selectedCell.data?.status === 'LENGKAP' ? (
                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                        <CheckCircle2 size={13} /> Laporan Lengkap (Metode PPP)
                                    </span>
                                ) : selectedCell.data?.status === 'PARSIAL' ? (
                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200">
                                        <Clock size={13} /> Parsial (Arsip Sesi Lama)
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-slate-200 text-slate-600">
                                        Belum Ada Laporan Masuk
                                    </span>
                                )}
                            </div>

                            {/* Report Details */}
                            {selectedCell.data?.reportData ? (
                                <div className="space-y-4">
                                    {/* Format PPP */}
                                    {renderPppItemsList(
                                        'Pekerjaan Selesai (Progress 100%)',
                                        selectedCell.data.reportData.completedItems,
                                        'bg-emerald-100 text-emerald-800',
                                        '🟢'
                                    )}

                                    {renderPppItemsList(
                                        'Sedang Dikerjakan (In-Progress)',
                                        selectedCell.data.reportData.inProgressItems,
                                        'bg-amber-100 text-amber-800',
                                        '🟡'
                                    )}

                                    {renderPppItemsList(
                                        'Kendala Lapangan (Problems)',
                                        selectedCell.data.reportData.obstacleItems,
                                        'bg-rose-100 text-rose-800',
                                        '🔴'
                                    )}

                                    {renderPppItemsList(
                                        'Rencana Pekerjaan Lanjutan',
                                        selectedCell.data.reportData.tomorrowPlans,
                                        'bg-blue-100 text-blue-800',
                                        '🎯'
                                    )}

                                    {/* Legacy Morning / Afternoon (if only legacy exists) */}
                                    {(!selectedCell.data.reportData.completedItems?.length &&
                                      !selectedCell.data.reportData.inProgressItems?.length &&
                                      !selectedCell.data.reportData.obstacleItems?.length &&
                                      !selectedCell.data.reportData.tomorrowPlans?.length) && (
                                        <>
                                            {renderPppItemsList(
                                                'Kegiatan Pagi (Arsip Lama)',
                                                selectedCell.data.reportData.morning,
                                                'bg-blue-100 text-blue-800',
                                                '☀️'
                                            )}
                                            {renderPppItemsList(
                                                'Kegiatan Siang (Arsip Lama)',
                                                selectedCell.data.reportData.afternoon,
                                                'bg-amber-100 text-amber-800',
                                                '🌙'
                                            )}
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-slate-400 space-y-2">
                                    <AlertTriangle size={32} className="mx-auto text-slate-300" />
                                    <p className="text-xs font-semibold">Tidak ada data rincian kegiatan pada tanggal ini.</p>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="pt-3 border-t border-slate-100 flex justify-end shrink-0">
                            <button
                                onClick={() => setSelectedCell(null)}
                                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
