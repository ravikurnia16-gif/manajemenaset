import React, { useState } from 'react';
import { 
    Sparkles, 
    AlertTriangle, 
    CheckCircle2, 
    Wrench, 
    Package, 
    Coins, 
    ShieldCheck, 
    Loader2, 
    Copy, 
    RefreshCw, 
    ChevronDown, 
    ChevronUp 
} from 'lucide-react';

export default function MaintenanceAIDiagnosisCard({
    report,
    onDiagnose,
    loading = false,
    onApplyRecommendation
}) {
    const [collapsed, setCollapsed] = useState(false);
    const analysis = report.aiDiagnosis?.smartAnalysis;
    const isAnalyzed = Boolean(analysis && analysis.summary);

    const severityColors = {
        NORMAL: 'bg-blue-100 text-blue-800 border-blue-200',
        URGENT: 'bg-amber-100 text-amber-800 border-amber-200',
        CRITICAL: 'bg-red-100 text-red-800 border-red-200'
    };

    return (
        <div className="bg-linear-to-br from-indigo-50/70 via-white to-purple-50/50 rounded-2xl border border-indigo-200/80 p-5 space-y-4 shadow-sm relative overflow-hidden">
            {/* Background Decorative Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-200/20 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                        <Sparkles size={18} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-slate-800 tracking-tight">
                                Analisis & Rekomendasi Cerdas AI
                            </h3>
                            <span className="text-[10px] font-extrabold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200 uppercase">
                                Gemini AI
                            </span>
                            {isAnalyzed ? (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                                    <CheckCircle2 size={11} /> Terdiagnosis
                                </span>
                            ) : (
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                    Belum Dianalisis
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            Diagnosis teknis otomatis, estimasi suku cadang & biaya, serta panduan langkah kerja teknisi
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                        onClick={onDiagnose}
                        disabled={loading}
                        className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all ${
                            isAnalyzed 
                                ? 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200' 
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                        title="Jalankan analisis AI untuk laporan pemeliharaan ini"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={14} className="animate-spin text-indigo-500" />
                                <span>Menganalisis...</span>
                            </>
                        ) : isAnalyzed ? (
                            <>
                                <RefreshCw size={13} className="text-slate-500" />
                                <span>Analisis Ulang</span>
                            </>
                        ) : (
                            <>
                                <Sparkles size={14} />
                                <span>Minta Analisis AI</span>
                            </>
                        )}
                    </button>

                    {isAnalyzed && (
                        <button
                            onClick={() => setCollapsed(!collapsed)}
                            className="p-2 hover:bg-white/80 rounded-xl text-slate-500 border border-transparent hover:border-slate-200 transition-colors"
                            title={collapsed ? "Buka rincian" : "Tutup rincian"}
                        >
                            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                        </button>
                    )}
                </div>
            </div>

            {/* Content Body */}
            {isAnalyzed ? (
                !collapsed && (
                    <div className="space-y-4 pt-1 animate-in fade-in duration-200 text-xs text-slate-700">
                        {/* Summary & Root Cause */}
                        <div className="bg-white/90 p-4 rounded-xl border border-indigo-100 shadow-2xs space-y-2">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 block mb-1">
                                        Dugaan Akar Masalah (Root Cause)
                                    </span>
                                    <p className="font-bold text-slate-900 text-sm leading-snug">
                                        {analysis.summary}
                                    </p>
                                </div>
                                {analysis.severity && (
                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase border shrink-0 ${
                                        severityColors[analysis.severity] || severityColors.NORMAL
                                    }`}>
                                        {analysis.severity}
                                    </span>
                                )}
                            </div>
                            <p className="text-slate-600 text-xs leading-relaxed">
                                {analysis.rootCause}
                            </p>
                            {analysis.severityReason && (
                                <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-100">
                                    <strong>Justifikasi Urgensi:</strong> {analysis.severityReason}
                                </p>
                            )}
                        </div>

                        {/* Grid: Actions & Spareparts + Costs */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Langkah Tindakan Rekomendasi */}
                            <div className="bg-white/90 p-4 rounded-xl border border-indigo-100 shadow-2xs space-y-2.5">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                                        <Wrench size={13} className="text-indigo-600" /> Langkah Perbaikan Teknisi
                                    </span>
                                    {onApplyRecommendation && (
                                        <button
                                            onClick={() => onApplyRecommendation(analysis.recommendedActions)}
                                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded-md hover:bg-indigo-100 transition-colors"
                                            title="Salin rekomendasi ke formulir tindakan teknisi"
                                        >
                                            <Copy size={11} /> Terapkan ke Tindakan
                                        </button>
                                    )}
                                </div>
                                <ol className="space-y-1.5 pl-1">
                                    {Array.isArray(analysis.recommendedActions) && analysis.recommendedActions.map((act, i) => (
                                        <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                                            <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-800 font-extrabold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                                                {i + 1}
                                            </span>
                                            <span className="leading-snug">{act}</span>
                                        </li>
                                    ))}
                                </ol>
                                {analysis.recommendedSpecialist && (
                                    <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                                        <strong>Spesialis Disarankan:</strong> <span className="font-semibold text-slate-800">{analysis.recommendedSpecialist}</span>
                                    </div>
                                )}
                            </div>

                            {/* Suku Cadang & Estimasi Biaya */}
                            <div className="bg-white/90 p-4 rounded-xl border border-indigo-100 shadow-2xs space-y-3">
                                <div>
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5 mb-1.5">
                                        <Package size={13} className="text-amber-600" /> Prediksi Suku Cadang / Material
                                    </span>
                                    {Array.isArray(analysis.neededParts) && analysis.neededParts.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5">
                                            {analysis.neededParts.map((part, i) => (
                                                <span key={i} className="bg-slate-100 border border-slate-200 text-slate-800 px-2 py-0.5 rounded-md text-[11px] font-medium">
                                                    {typeof part === 'string' ? part : `${part.name} ${part.estimatedQty ? `(${part.estimatedQty})` : ''}`}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-[11px] text-slate-400 italic">Tidak memerlukan suku cadang khusus (penanganan teknis / servis umum).</p>
                                    )}
                                </div>

                                {analysis.estimatedCost && (
                                    <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="font-bold text-emerald-900 flex items-center gap-1">
                                                <Coins size={13} /> Estimasi Biaya Wajar
                                            </span>
                                            <span className="font-extrabold text-emerald-800 text-sm">
                                                Rp {(analysis.estimatedCost.min || 0).toLocaleString('id-ID')} - Rp {(analysis.estimatedCost.max || 0).toLocaleString('id-ID')}
                                            </span>
                                        </div>
                                        {analysis.estimatedCost.note && (
                                            <p className="text-[10px] text-emerald-700 leading-tight">
                                                {analysis.estimatedCost.note}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {analysis.preventiveAdvice && (
                                    <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex items-start gap-1.5">
                                        <ShieldCheck size={14} className="text-blue-600 shrink-0 mt-0.5" />
                                        <span><strong>Saran Preventif:</strong> {analysis.preventiveAdvice}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {analysis.diagnosedAt && (
                            <div className="text-right text-[10px] text-slate-400 font-mono">
                                Dianalisis oleh Gemini AI pada: {new Date(analysis.diagnosedAt).toLocaleString('id-ID')}
                            </div>
                        )}
                    </div>
                )
            ) : (
                <div className="bg-white/70 rounded-xl border border-indigo-100 p-4 text-center space-y-1">
                    <p className="text-xs font-semibold text-slate-700">
                        Belum ada analisis diagnosis cerdas untuk laporan ini.
                    </p>
                    <p className="text-[11px] text-slate-500">
                        Klik tombol <strong>"Minta Analisis AI"</strong> di atas untuk memperoleh diagnosis akar masalah, perkiraan suku cadang, dan panduan langkah kerja teknisi.
                    </p>
                </div>
            )}
        </div>
    );
}
