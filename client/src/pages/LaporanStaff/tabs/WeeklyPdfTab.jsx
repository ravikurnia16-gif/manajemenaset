import React, { useState } from 'react';
import {
    Printer, Camera, Sparkles, Loader2, Bot, Check, Edit3,
    RefreshCw, CheckCircle2, AlertTriangle, FileText, ChevronDown
} from 'lucide-react';
import dayjs from 'dayjs';
import api from '../../../lib/axios';
import { getMediaUrl } from '../../../lib/media';

/**
 * Format markdown lines for print and screen rendering
 */
const formatInlineMarkdown = (str) => {
    return str
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono">$1</code>');
};

const renderFormattedAiText = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    return (
        <div className="space-y-2 text-xs leading-relaxed text-slate-800">
            {lines.map((line, idx) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={idx} className="h-1" />;

                // Headings
                if (trimmed.startsWith('### ') || trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
                    const cleanTitle = trimmed.replace(/^#+\s*/, '');
                    return (
                        <h6 key={idx} className="font-black text-slate-900 text-xs tracking-wide uppercase pt-2.5 border-b border-slate-200 pb-1">
                            {cleanTitle}
                        </h6>
                    );
                }

                // Bullet points
                if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
                    const content = trimmed.substring(2);
                    return (
                        <div key={idx} className="flex items-start gap-2 pl-2">
                            <span className="text-indigo-600 font-bold mt-0.5">•</span>
                            <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(content) }} />
                        </div>
                    );
                }

                // Numbered lists
                const matchNum = trimmed.match(/^(\d+\.)\s*(.*)/);
                if (matchNum) {
                    return (
                        <div key={idx} className="flex items-start gap-2 pl-2">
                            <span className="text-indigo-700 font-black font-mono text-[11px] mt-0.5">{matchNum[1]}</span>
                            <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(matchNum[2]) }} />
                        </div>
                    );
                }

                return (
                    <p key={idx} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed) }} />
                );
            })}
        </div>
    );
};

export default function WeeklyPdfTab({
    weeklyStartDate,
    setWeeklyStartDate,
    weeklyEndDate,
    setWeeklyEndDate,
    customKabidNiy,
    setCustomKabidNiy,
    weeklyData,
    loading,
    user,
    setLightboxPhoto
}) {
    // AI Analysis States
    const [aiAnalysis, setAiAnalysis] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [includeAiInPdf, setIncludeAiInPdf] = useState(true);
    const [includePhotosInPdf, setIncludePhotosInPdf] = useState(false);
    const [aiMode, setAiMode] = useState('WEEKLY_EXECUTIVE'); // 'WEEKLY_EXECUTIVE' | 'TEAM_PERFORMANCE' | 'OBSTACLE_SOLUTIONS'
    const [isEditingAi, setIsEditingAi] = useState(false);

    // Compute or retrieve position-based summary without staff personal names
    const positionSummaries = React.useMemo(() => {
        if (weeklyData?.positionSummary && weeklyData.positionSummary.length > 0) {
            return weeklyData.positionSummary;
        }
        const posMap = {};
        (weeklyData?.dailyDivisionBreakdown || []).forEach(day => {
            (day.activities || []).forEach(act => {
                const pos = act.position || 'Staf Sarana & Prasarana';
                if (!posMap[pos]) {
                    posMap[pos] = {
                        position: pos,
                        totalCompleted: 0,
                        totalInProgress: 0,
                        totalObstacles: 0,
                        totalActivities: 0,
                        keyTasks: new Set(),
                        categories: new Set()
                    };
                }
                posMap[pos].totalActivities++;
                if (act.status === 'COMPLETED') posMap[pos].totalCompleted++;
                else if (act.status === 'IN_PROGRESS') posMap[pos].totalInProgress++;
                else if (act.status === 'OBSTACLE') posMap[pos].totalObstacles++;
                if (act.categoryTag) posMap[pos].categories.add(act.categoryTag);
                if (act.activity && act.activity.trim() && !act.activity.includes('Dokumentasi Foto')) {
                    posMap[pos].keyTasks.add(act.activity.trim());
                }
            });
        });
        return Object.values(posMap).map(p => ({
            ...p,
            keyTasks: Array.from(p.keyTasks),
            categories: Array.from(p.categories),
            completionRate: p.totalActivities > 0 ? Math.round((p.totalCompleted / p.totalActivities) * 100) : 0
        })).sort((a, b) => b.totalActivities - a.totalActivities);
    }, [weeklyData]);

    const handleGenerateAI = async () => {
        try {
            setAiLoading(true);
            const res = await api.post('/laporan/ai/analyze', {
                startDate: weeklyStartDate,
                endDate: weeklyEndDate,
                mode: aiMode
            });
            if (res.data?.analysis) {
                setAiAnalysis(res.data.analysis);
                setIncludeAiInPdf(true);
                return res.data.analysis;
            }
            return null;
        } catch (error) {
            console.error('Failed to generate AI analysis:', error);
            alert(error.response?.data?.error || 'Gagal menghasilkan analisis AI. Pastikan rentang tanggal telah dipilih.');
            return null;
        } finally {
            setAiLoading(false);
        }
    };

    const handlePrintPdf = async () => {
        if (loading) {
            alert('Mohon tunggu sebentar, data laporan mingguan sedang disinkronkan dari server...');
            return;
        }
        if (!weeklyData) {
            alert('Data laporan mingguan belum selesai dimuat. Pastikan tanggal telah dipilih.');
            return;
        }
        if (includeAiInPdf && !aiAnalysis) {
            const confirmGen = window.confirm(
                "Analisis AI belum digenerate. Apakah Anda ingin meng-generate Analisis AI terlebih dahulu sebelum mencetak dokumen PDF?"
            );
            if (confirmGen) {
                const res = await handleGenerateAI();
                if (res) {
                    setTimeout(() => window.print(), 500);
                    return;
                }
            }
        }
        window.print();
    };

    const hasAiSection = includeAiInPdf && Boolean(aiAnalysis);

    return (
        <div className="space-y-6 animate-in fade-in duration-300 print:p-0 print:m-0 print:space-y-0 print:animate-none">
            {/* ISOLATED STRICT PRINT STYLES FOR SAFE BROWSER PRINTING */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    /* Sembunyikan seluruh elemen di luar dokumen PDF cetak */
                    body * {
                        visibility: hidden !important;
                    }
                    /* Tampilkan hanya lembar dokumen laporan mingguan */
                    #weekly-pdf-sheet, #weekly-pdf-sheet * {
                        visibility: visible !important;
                    }
                    #weekly-pdf-sheet {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 10mm 14mm !important;
                        border: none !important;
                        box-shadow: none !important;
                        background: white !important;
                        color: #0f172a !important;
                        display: block !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .no-print, .print-hidden, header, nav, aside, footer {
                        display: none !important;
                    }
                    html, body, #root, main, .flex-1 {
                        height: auto !important;
                        overflow: visible !important;
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .break-inside-avoid {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    @page {
                        size: A4 portrait;
                        margin: 8mm 6mm;
                    }
                }
            `}} />

            {/* Control Bar (Hidden in Print) */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 print:hidden no-print">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                            <Printer className="text-indigo-600" size={20} /> Generator Laporan Mingguan Kepala Bidang Sarana
                        </h3>
                        <p className="text-xs text-slate-400 font-medium">Format resmi siap cetak / simpan PDF untuk laporan ke Pimpinan Yayasan.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                            <span>Dari:</span>
                            <input type="date" value={weeklyStartDate} onChange={(e) => setWeeklyStartDate(e.target.value)} className="bg-transparent outline-none cursor-pointer" />
                            <span>Sampai:</span>
                            <input type="date" value={weeklyEndDate} onChange={(e) => setWeeklyEndDate(e.target.value)} className="bg-transparent outline-none cursor-pointer" />
                        </div>
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                            <span>NIY:</span>
                            <input
                                type="text"
                                value={customKabidNiy}
                                onChange={(e) => setCustomKabidNiy(e.target.value)}
                                placeholder="NIY Kepala..."
                                className="w-28 bg-white px-2 py-0.5 rounded border border-slate-200 font-mono text-xs outline-none"
                                title="Nomor Induk Yayasan (NIY) Kepala Bidang Sarana"
                            />
                        </div>
                        <button
                            onClick={handlePrintPdf}
                            disabled={loading || aiLoading}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20 cursor-pointer"
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                            {loading ? 'Memuat Data...' : 'Cetak / Unduh PDF'}
                        </button>
                    </div>
                </div>

                {/* AI Analysis Toolbar */}
                <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100/60">
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                                <Sparkles size={14} className="text-amber-300" />
                            </div>
                            <div>
                                <span className="text-xs font-black text-slate-800 block">Analisis AI Eksekutif</span>
                                <span className="text-[10px] text-slate-500">Kecerdasan buatan menyusun narasi evaluasi kinerja untuk pimpinan</span>
                            </div>
                        </div>

                        {/* Mode Selector */}
                        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 text-xs">
                            <span className="text-[11px] font-bold text-slate-400">Mode:</span>
                            <select
                                value={aiMode}
                                onChange={(e) => setAiMode(e.target.value)}
                                className="bg-transparent font-bold text-slate-700 text-xs outline-none cursor-pointer"
                            >
                                <option value="WEEKLY_EXECUTIVE">🎯 Ikhtisar Eksekutif & Strategis</option>
                                <option value="TEAM_PERFORMANCE">📊 Evaluasi Produktivitas Tim</option>
                                <option value="OBSTACLE_SOLUTIONS">⚠️ Solusi Kendala & Mitigasi</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none">
                            <input
                                type="checkbox"
                                checked={includeAiInPdf}
                                onChange={(e) => setIncludeAiInPdf(e.target.checked)}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>Sertakan Analisis AI</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none">
                            <input
                                type="checkbox"
                                checked={includePhotosInPdf}
                                onChange={(e) => setIncludePhotosInPdf(e.target.checked)}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>Preview Foto Lapangan ({weeklyData?.documentationPhotos?.length || 0})</span>
                        </label>

                        <button
                            onClick={handleGenerateAI}
                            disabled={aiLoading || loading}
                            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-200 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                            {aiLoading ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" />
                                    <span>Menganalisis Data...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles size={14} className="text-amber-300" />
                                    <span>{aiAnalysis ? 'Perbarui Analisis AI' : 'Generate Analisis AI'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Loading Indicator (Hidden in Print) */}
            {loading && (
                <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 flex items-center justify-center gap-3 text-slate-600 print:hidden animate-pulse">
                    <Loader2 className="animate-spin text-indigo-600" size={24} />
                    <span className="text-xs font-bold">Menyinkronkan data laporan mingguan dari server...</span>
                </div>
            )}

            {/* PRINTABLE DOCUMENT CONTAINER */}
            <div id="weekly-pdf-sheet" className="bg-white p-8 md:p-12 rounded-3xl border border-slate-200 shadow-sm space-y-8 max-w-4xl mx-auto text-slate-800 print:border-none print:shadow-none print:p-0">
                {/* KOP SURAT YAYASAN */}
                <div className="text-center border-b-2 border-slate-800 pb-4 space-y-1">
                    <h2 className="text-xl font-black tracking-wider text-slate-900 uppercase">YAYASAN DAR EL IMAN</h2>
                    <h3 className="text-base font-black text-indigo-950 uppercase tracking-widest">BIDANG SARANA</h3>
                    <p className="text-[11px] text-slate-600">Jl. Gunung Juaro, Kel. Surau Gadang, Kec. Nanggalo, Kota Padang, Sumatera Barat</p>
                </div>

                {/* TITLE */}
                <div className="text-center space-y-1">
                    <h4 className="text-sm font-black uppercase tracking-wider underline">LAPORAN KINERJA & AKTIVITAS MINGGUAN</h4>
                    <p className="text-xs font-bold text-slate-600">Periode: {weeklyData?.period?.formattedPeriod || `${weeklyStartDate} s/d ${weeklyEndDate}`}</p>
                </div>

                {/* I. EXECUTIVE SUMMARY */}
                <div className="space-y-2 break-inside-avoid">
                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">I. Ringkasan Eksekutif Kinerja</h5>
                    <div className="grid grid-cols-3 gap-3 text-center pt-2">
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                            <span className="text-[10px] font-bold text-slate-500 block uppercase">Pekerjaan Selesai</span>
                            <span className="text-xl font-black text-emerald-700">{weeklyData?.stats?.totalCompleted || 0}</span>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                            <span className="text-[10px] font-bold text-slate-500 block uppercase">Dalam Proses</span>
                            <span className="text-xl font-black text-amber-700">{weeklyData?.stats?.totalInProgress || 0}</span>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                            <span className="text-[10px] font-bold text-slate-500 block uppercase">Kendala Ditangani</span>
                            <span className="text-xl font-black text-rose-700">{weeklyData?.stats?.totalObstacles || 0}</span>
                        </div>
                    </div>
                </div>

                {/* II. ANALISIS & EVALUASI STRATEGIS KINERJA (AI EXECUTIVE SUMMARY) */}
                {hasAiSection && (
                    <div className="space-y-3 pt-1 break-inside-avoid">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                            <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-600 print:bg-slate-800"></span>
                                II. Analisis & Evaluasi Strategis Kinerja (AI Executive Summary)
                            </h5>
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded print:hidden flex items-center gap-1">
                                <Sparkles size={11} className="text-amber-500" /> Analisis AI Aktif
                            </span>
                        </div>

                        <div className="bg-slate-50/70 print:bg-transparent p-4 print:p-0 rounded-2xl border border-slate-200 print:border-none space-y-2">
                            {isEditingAi ? (
                                <div className="space-y-2 print:hidden">
                                    <textarea
                                        value={aiAnalysis}
                                        onChange={(e) => setAiAnalysis(e.target.value)}
                                        rows={10}
                                        className="w-full p-3 text-xs bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                                        placeholder="Ketik atau sesuaikan narasi analisis AI..."
                                    />
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => setIsEditingAi(false)}
                                            className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                                        >
                                            <Check size={13} /> Selesai Mengedit
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {renderFormattedAiText(aiAnalysis)}
                                    <div className="pt-2 flex justify-end print:hidden">
                                        <button
                                            onClick={() => setIsEditingAi(true)}
                                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                                        >
                                            <Edit3 size={12} /> Sesuaikan Teks Analisis
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* III. RANGKUMAN KINERJA PER POSISI STAF */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                        <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-slate-800"></span>
                            {hasAiSection ? 'III.' : 'II.'} Rangkuman Kinerja per Posisi Staf Bidang Sarana
                        </h5>
                        <span className="text-[10px] text-slate-500 font-semibold italic">
                            *Rangkuman pencapaian tugas berdasarkan bidang dan posisi staf
                        </span>
                    </div>

                    {(!positionSummaries || positionSummaries.length === 0) ? (
                        <p className="text-xs text-slate-400 italic py-2">Belum ada rangkuman kinerja posisi staf tercatat pada rentang tanggal ini.</p>
                    ) : (
                        <div className="space-y-3">
                            <div className="overflow-hidden border border-slate-200 rounded-xl">
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead className="bg-slate-100/80 font-bold border-b border-slate-200 text-slate-700 text-[11px]">
                                        <tr>
                                            <th className="p-2.5 w-10 text-center border-r border-slate-200">No</th>
                                            <th className="p-2.5 w-48 border-r border-slate-200">Posisi / Jabatan</th>
                                            <th className="p-2.5 border-r border-slate-200">Rangkuman Cakupan & Realisasi Pekerjaan</th>
                                            <th className="p-2.5 w-16 text-center border-r border-slate-200 text-emerald-800">Selesai</th>
                                            <th className="p-2.5 w-16 text-center border-r border-slate-200 text-amber-800">Proses</th>
                                            <th className="p-2.5 w-16 text-center border-r border-slate-200 text-rose-800">Kendala</th>
                                            <th className="p-2.5 w-20 text-center">Capaian</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {positionSummaries.map((pos, pIdx) => (
                                            <tr key={pIdx} className="break-inside-avoid align-top hover:bg-slate-50/50">
                                                <td className="p-2.5 text-center font-bold text-slate-500 border-r border-slate-200">
                                                    {pIdx + 1}
                                                </td>
                                                <td className="p-2.5 font-black text-slate-800 border-r border-slate-200">
                                                    <div className="font-bold text-slate-900 text-xs">{pos.position}</div>
                                                    {pos.categories && pos.categories.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {pos.categories.map((c, cIdx) => (
                                                                <span key={cIdx} className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-slate-100 text-slate-600 border border-slate-200">
                                                                    {c}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-2.5 border-r border-slate-200">
                                                    {pos.keyTasks && pos.keyTasks.length > 0 ? (
                                                        <ul className="space-y-1 text-[11px] leading-relaxed text-slate-700">
                                                            {pos.keyTasks.slice(0, 5).map((task, tIdx) => (
                                                                <li key={tIdx} className="flex items-start gap-1.5">
                                                                    <span className="text-slate-400 font-bold">•</span>
                                                                    <span>{task}</span>
                                                                </li>
                                                            ))}
                                                            {pos.keyTasks.length > 5 && (
                                                                <li className="text-[10px] text-slate-400 italic pl-3">
                                                                    +{pos.keyTasks.length - 5} item pekerjaan operasional lainnya
                                                                </li>
                                                            )}
                                                        </ul>
                                                    ) : (
                                                        <span className="text-slate-400 italic text-[11px]">- Menjalankan tugas pemeliharaan rutin -</span>
                                                    )}
                                                </td>
                                                <td className="p-2.5 text-center font-bold text-emerald-700 border-r border-slate-200">
                                                    {pos.totalCompleted}
                                                </td>
                                                <td className="p-2.5 text-center font-bold text-amber-700 border-r border-slate-200">
                                                    {pos.totalInProgress}
                                                </td>
                                                <td className="p-2.5 text-center font-bold text-rose-700 border-r border-slate-200">
                                                    {pos.totalObstacles}
                                                </td>
                                                <td className="p-2.5 text-center">
                                                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-black ${
                                                        pos.completionRate >= 80 ? 'bg-emerald-100 text-emerald-800' :
                                                        pos.completionRate >= 50 ? 'bg-amber-100 text-amber-800' :
                                                        'bg-slate-100 text-slate-700'
                                                    }`}>
                                                        {pos.completionRate}%
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* IV. REKAP KENDALA */}
                {weeklyData?.obstacleList && weeklyData.obstacleList.length > 0 && (
                    <div className="space-y-2 break-inside-avoid">
                        <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
                            {hasAiSection ? 'IV.' : 'III.'} Rekap Kendala / Hambatan Lapangan
                        </h5>
                        <table className="w-full text-xs text-left border border-slate-200">
                            <thead className="bg-slate-50 font-bold border-b border-slate-200">
                                <tr>
                                    <th className="p-2 border-r">Tgl</th>
                                    <th className="p-2 border-r">Posisi / Bidang Tugas</th>
                                    <th className="p-2 border-r">Pekerjaan</th>
                                    <th className="p-2">Uraian Kendala</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {weeklyData.obstacleList.map((obs, idx) => (
                                    <tr key={idx}>
                                        <td className="p-2 border-r whitespace-nowrap">{obs.date}</td>
                                        <td className="p-2 border-r font-bold text-slate-800">{obs.position || 'Staf Sarpras'}</td>
                                        <td className="p-2 border-r">{obs.activity}</td>
                                        <td className="p-2 text-rose-700 font-medium">{obs.obstacleNote}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* SIGNATURE BLOCK (DIGITAL TTE KEPALA BIDANG SARANA) */}
                <div className="pt-8 flex justify-end break-inside-avoid">
                    <div className="text-center w-72 space-y-2">
                        <div>
                            <p className="text-xs font-medium text-slate-600">Padang, {dayjs().format('DD MMMM YYYY')}</p>
                            <p className="text-xs font-bold uppercase mt-0.5 text-slate-900">Kepala Bidang Sarana</p>
                        </div>
                        
                        {/* TTE Digital Seal / Badge */}
                        <div className="p-3 my-2 rounded-xl border border-emerald-300 bg-emerald-50/60 flex items-center gap-2.5 text-left shadow-2xs">
                            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700 shrink-0">
                                <CheckCircle2 size={24} />
                            </div>
                            <div className="space-y-0.5 leading-tight">
                                <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider block">
                                    Ditandatangani Digital (TTE)
                                </span>
                                <span className="text-[9px] text-slate-600 block">
                                    Dokumen Sah & Terverifikasi
                                </span>
                                <span className="text-[9px] text-slate-500 font-mono block">
                                    E-Office Yayasan Dar el Iman
                                </span>
                            </div>
                        </div>

                        <div className="space-y-0.5 pt-1">
                            <p className="text-xs font-bold text-slate-900 underline">{weeklyData?.kabid?.name || user?.name || 'Ravi Kurnia, S.T.'}</p>
                            <p className="text-[10px] text-slate-600 font-mono">
                                NIY. {customKabidNiy || weeklyData?.kabid?.niy || user?.nip || user?.username || 'Yayasan Dar el Iman'}
                            </p>
                            <p className="text-[10px] font-semibold text-slate-500">
                                Kepala Bidang Sarana
                            </p>
                        </div>
                    </div>
                </div>

                {/* ============================================================== */}
                {/* PREVIEW FOTO DOKUMENTASI (HANYA DITAMPILKAN DI LAYAR BILA DIAKTIFKAN, DISEMBUNYIKAN SAAT DICETAK) */}
                {/* ============================================================== */}
                {includePhotosInPdf && (
                    <div className="pt-10 mt-10 border-t-2 border-dashed border-slate-300 print:hidden no-print">
                        {/* KOP LAMPIRAN */}
                        <div className="text-center border-b-2 border-slate-800 pb-3 space-y-1">
                            <h3 className="text-[10px] font-black tracking-widest text-slate-500 uppercase">LAMPIRAN DOKUMENTASI LAPANGAN (PREVIEW WEB)</h3>
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                                FOTO BUKTI AKTIVITAS HARIAN STAF BIDANG SARANA
                            </h4>
                            <p className="text-xs font-bold text-slate-600">
                                Periode: {weeklyData?.period?.formattedPeriod || `${weeklyStartDate} s/d ${weeklyEndDate}`}
                            </p>
                            <p className="text-[10px] text-amber-600 italic">
                                *Halaman dokumentasi foto ini secara otomatis tidak disertakan dalam cetakan PDF resmi sesuai format ringkasan pimpinan.
                            </p>
                        </div>

                        {/* DAFTAR FOTO DOKUMENTASI */}
                        {weeklyData?.documentationPhotos && weeklyData.documentationPhotos.length > 0 ? (
                            <div className="pt-6 space-y-4">
                                <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100">
                                    <span className="font-bold">Total Foto Terlampir: {weeklyData.documentationPhotos.length} Foto Dokumentasi</span>
                                    <span className="text-[10px] text-slate-400 italic">*Foto diunggah langsung oleh staf sarana saat pelaporan harian</span>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {weeklyData.documentationPhotos.map((doc, pIdx) => (
                                        <div key={pIdx} className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 space-y-2 flex flex-col justify-between break-inside-avoid shadow-2xs">
                                            <div className="w-full h-44 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
                                                <img
                                                    src={getMediaUrl(doc.photoUrl)}
                                                    alt={doc.activity}
                                                    className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                                    onClick={() => setLightboxPhoto(getMediaUrl(doc.photoUrl))}
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.src = 'https://placehold.co/400x300?text=Foto+Dokumentasi';
                                                    }}
                                                />
                                            </div>
                                            <div className="space-y-1 text-left">
                                                <div className="flex items-center justify-between gap-1">
                                                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                                                        {doc.dateShort}
                                                    </span>
                                                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-200/60 text-slate-600">
                                                        {doc.categoryTag}
                                                    </span>
                                                </div>
                                                <p className="text-xs font-black text-slate-800 line-clamp-1">
                                                    {doc.position || doc.staffName}
                                                </p>
                                                <p className="text-[11px] text-slate-600 font-medium line-clamp-2 leading-tight">
                                                    {doc.activity}
                                                </p>
                                                {doc.obstacleNote && (
                                                    <p className="text-[10px] text-rose-600 font-bold bg-rose-50 p-1 rounded">
                                                        ⚠️ {doc.obstacleNote}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="pt-12 pb-12 text-center text-slate-400 space-y-2">
                                <Camera size={36} className="mx-auto text-slate-300" />
                                <p className="text-xs italic">Tidak ada lampiran foto dokumentasi lapangan pada rentang tanggal ini.</p>
                            </div>
                        )}

                        {/* Catatan Kaki Lampiran */}
                        <div className="pt-8 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400 mt-6">
                            <span>Sistem Informasi Manajemen Aset & Sarpras Yayasan Dar El Iman Padang</span>
                            <span>Halaman Dokumentasi Foto Lapangan</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
