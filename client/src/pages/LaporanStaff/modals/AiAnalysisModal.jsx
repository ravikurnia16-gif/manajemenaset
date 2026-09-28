import React from 'react';
import { Sparkles, Calendar, RefreshCw, Loader2, Copy, Check, X } from 'lucide-react';

export default function AiAnalysisModal({
    isOpen,
    onClose,
    aiAnalysisType,
    setAiAnalysisType,
    aiStartDate,
    setAiStartDate,
    aiEndDate,
    setAiEndDate,
    runAiAnalysis,
    loadingAi,
    aiAnalysisMeta,
    aiAnalysisResult,
    copiedAi,
    setCopiedAi
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full p-6 space-y-4 border border-slate-100 max-h-[90vh] flex flex-col">
                {/* MODAL HEADER */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 to-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-amber-500/20">
                            <Sparkles size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-800">
                                {aiAnalysisType === 'OBSTACLE_SOLUTIONS' 
                                    ? '✨ Rekomendasi Solusi AI Kendala Lapangan' 
                                    : (aiAnalysisType === 'TEAM_PERFORMANCE' 
                                        ? '✨ Evaluasi Produktivitas & Kinerja Tim' 
                                        : '✨ Ringkasan Eksekutif & Analitik Kinerja Tim')}
                            </h3>
                            <p className="text-xs text-slate-400 font-medium">Didukung Google Gemini AI - Analisis multi-hari terintegrasi</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-xl transition-all cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                {/* MODAL DATE RANGE & FILTER TOOLBAR */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                            <Calendar size={14} className="text-slate-400" />
                            <span>Rentang Tanggal:</span>
                            <input 
                                type="date"
                                value={aiStartDate}
                                onChange={(e) => setAiStartDate(e.target.value)}
                                className="bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-slate-400">s.d.</span>
                            <input 
                                type="date"
                                value={aiEndDate}
                                onChange={(e) => setAiEndDate(e.target.value)}
                                className="bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div className="flex items-center gap-1.5">
                            <select
                                value={aiAnalysisType}
                                onChange={(e) => setAiAnalysisType(e.target.value)}
                                className="bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
                            >
                                <option value="DAILY_DIGEST">🎯 Ringkasan Eksekutif</option>
                                <option value="TEAM_PERFORMANCE">📊 Evaluasi Tim</option>
                                <option value="OBSTACLE_SOLUTIONS">⚠️ Solusi Kendala</option>
                            </select>
                            <button
                                onClick={() => runAiAnalysis(aiAnalysisType, aiStartDate, aiEndDate)}
                                disabled={loadingAi}
                                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                            >
                                {loadingAi ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                                Analisis Ulang
                            </button>
                        </div>
                    </div>

                    {/* ANALYSIS METADATA PILLS */}
                    {aiAnalysisMeta && !loadingAi && (
                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/60 text-[11px] font-bold text-slate-600">
                            <span className="bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-lg">
                                📅 {aiAnalysisMeta.period}
                            </span>
                            <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-lg">
                                📋 {aiAnalysisMeta.totalActivities} Butir Pekerjaan Teranalisis
                            </span>
                            {aiAnalysisMeta.totalObstacles > 0 && (
                                <span className="bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded-lg">
                                    ⚠️ {aiAnalysisMeta.totalObstacles} Kendala Lapangan
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* MODAL CONTENT BODY */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar text-xs sm:text-sm text-slate-700 leading-relaxed">
                    {loadingAi ? (
                        <div className="h-56 flex flex-col items-center justify-center gap-3 text-slate-400">
                            <Loader2 className="animate-spin text-amber-500" size={36} />
                            <span className="font-bold text-slate-600">Gemini AI sedang memproses laporan seluruh staf pada rentang tanggal terpilih...</span>
                            <span className="text-[11px] text-slate-400">Mengevaluasi pembagian beban kerja, efisiensi tugas, dan solusi kendala...</span>
                        </div>
                    ) : (
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 whitespace-pre-line font-medium leading-relaxed shadow-2xs">
                            {aiAnalysisResult}
                        </div>
                    )}
                </div>

                {/* MODAL FOOTER */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                        onClick={() => {
                            if (aiAnalysisResult) {
                                navigator.clipboard.writeText(aiAnalysisResult);
                                setCopiedAi(true);
                                setTimeout(() => setCopiedAi(false), 2000);
                            }
                        }}
                        disabled={loadingAi || !aiAnalysisResult}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                        {copiedAi ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        {copiedAi ? 'Tersalin ke Clipboard!' : 'Salin Teks Analisis'}
                    </button>

                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer shadow-sm"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    );
}
