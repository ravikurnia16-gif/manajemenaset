import React, { useState } from 'react';
import { 
    Target, CheckCircle2, TrendingUp, Sparkles, 
    Award, Layers, ArrowUpRight, CheckSquare, 
    Edit2, Save, X, RotateCcw, AlertCircle 
} from 'lucide-react';

const OkrDashboardTab = ({ okrData, loading, onSaveOkr, onRefresh }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editableOkrs, setEditableOkrs] = useState([]);

    const { okrs = [], divisionOkrScore = 0 } = okrData || {};

    const startEditing = () => {
        setEditableOkrs(JSON.parse(JSON.stringify(okrs)));
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (onSaveOkr) {
            await onSaveOkr(editableOkrs);
        }
        setIsEditing(false);
    };

    if (loading) {
        return (
            <div className="py-16 text-center space-y-3">
                <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm font-bold text-slate-500">Menghitung progres sasaran strategis OKR...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* 1. Executive OKR Overview Banner */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-indigo-800 text-white p-6 rounded-3xl shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-black uppercase tracking-wider backdrop-blur-xs">
                                Objectives & Key Results (OKR)
                            </span>
                            <span className="text-xs text-emerald-100 font-medium">• Sasaran Strategis Divisi Sarpras</span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                            Cockpit Ketercapaian Sasaran Kuartal Berjalan
                        </h2>
                        <p className="text-xs text-white/90 max-w-2xl leading-relaxed">
                            Setiap pekerjaan teknis, tiket pemeliharaan, servis kendaraan, dan penugasan staf di lapangan secara otomatis menggerakkan skor indikator (Key Results) di bawah ini secara real-time.
                        </p>
                    </div>

                    {/* Overall Division Score Dial */}
                    <div className="bg-white/10 backdrop-blur-md p-4 px-6 rounded-2xl border border-white/20 flex items-center gap-4 shrink-0">
                        <div className="text-right">
                            <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider block">Indeks Capaian Divisi</span>
                            <span className="text-3xl font-black text-white">{divisionOkrScore}%</span>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center font-bold text-emerald-200 shrink-0">
                            <Target size={26} />
                        </div>
                    </div>
                </div>

                {/* Live Data Badge & Action Button */}
                <div className="flex items-center justify-between pt-3 border-t border-white/15 text-xs text-emerald-100">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        <span className="font-semibold text-[11px]">Terhubung Langsung dengan Database Operasional Harian</span>
                    </div>

                    {!isEditing ? (
                        <button
                            type="button"
                            onClick={startEditing}
                            className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white font-bold text-[11px] transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                            <Edit2 size={12} /> Sesuaikan Target OKR
                        </button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-[11px] transition-all cursor-pointer"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                className="px-3.5 py-1.5 rounded-xl bg-white text-emerald-900 hover:bg-emerald-50 font-bold text-[11px] transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                            >
                                <Save size={12} /> Simpan Target
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* 2. Objectives & Key Results Cards */}
            <div className="space-y-6">
                {(isEditing ? editableOkrs : okrs).map((obj, objIdx) => (
                    <div key={obj.id || objIdx} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-5">
                        {/* Objective Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 text-[10px] font-black uppercase">
                                        Objective {objIdx + 1}
                                    </span>
                                    <span className="text-xs font-bold text-slate-400">
                                        Kategori: {obj.category || 'SARPRAS'} • {obj.targetPeriod || 'Kuartal'}
                                    </span>
                                </div>
                                <h3 className="text-base font-black text-slate-800">
                                    {obj.title}
                                </h3>
                            </div>

                            {/* Overall Score for this Objective */}
                            <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                                <div className="text-right">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Capaian Sasaran</span>
                                    <span className="text-xl font-black text-slate-800">{obj.overallScore || 0}%</span>
                                </div>
                                <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full transition-all duration-500 ${
                                            (obj.overallScore || 0) >= 90 ? 'bg-emerald-500' :
                                            (obj.overallScore || 0) >= 75 ? 'bg-blue-500' : 'bg-amber-500'
                                        }`}
                                        style={{ width: `${Math.min(100, obj.overallScore || 0)}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Key Results List */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {obj.keyResults.map((kr, krIdx) => (
                                <div key={kr.id || krIdx} className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/60 space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="space-y-1 flex-1">
                                            <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase">
                                                KR {objIdx + 1}.{krIdx + 1}
                                            </span>
                                            <h4 className="text-xs font-black text-slate-800 leading-snug">
                                                {kr.title}
                                            </h4>
                                        </div>

                                        <span className={`px-2 py-0.5 rounded-lg text-xs font-black shrink-0 ${
                                            (kr.score || 0) >= 90 ? 'bg-emerald-100 text-emerald-800' :
                                            (kr.score || 0) >= 70 ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                                        }`}>
                                            {kr.score || 0}%
                                        </span>
                                    </div>

                                    {kr.description && (
                                        <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                                            {kr.description}
                                        </p>
                                    )}

                                    {/* Progress Bar & Actual vs Target */}
                                    <div className="space-y-1.5 pt-1">
                                        <div className="flex items-center justify-between text-xs font-bold">
                                            <span className="text-slate-600">
                                                Aktual: <b className="text-slate-900">{kr.actual !== undefined ? kr.actual : '-'} {kr.unit}</b>
                                            </span>
                                            {isEditing ? (
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[10px] text-slate-400">Target:</span>
                                                    <input
                                                        type="number"
                                                        value={kr.target}
                                                        onChange={(e) => {
                                                            const updated = [...editableOkrs];
                                                            updated[objIdx].keyResults[krIdx].target = parseFloat(e.target.value) || 0;
                                                            setEditableOkrs(updated);
                                                        }}
                                                        className="w-16 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 text-right outline-none"
                                                    />
                                                    <span className="text-[10px] text-slate-500">{kr.unit}</span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-500">
                                                    Target: <b>{kr.target} {kr.unit}</b>
                                                </span>
                                            )}
                                        </div>

                                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-500 ${
                                                    (kr.score || 0) >= 90 ? 'bg-emerald-500' :
                                                    (kr.score || 0) >= 70 ? 'bg-blue-500' : 'bg-amber-500'
                                                }`}
                                                style={{ width: `${Math.min(100, kr.score || 0)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default OkrDashboardTab;
