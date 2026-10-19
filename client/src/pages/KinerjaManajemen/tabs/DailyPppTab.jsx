import React, { useState } from 'react';
import { 
    Calendar, CheckCircle2, Clock, AlertTriangle, 
    Layers, ChevronLeft, ChevronRight, Eye, Wrench, 
    FileText, User, Camera, Sparkles, Filter 
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/id';

dayjs.locale('id');

const DailyPppTab = ({ 
    selectedDate, 
    setSelectedDate, 
    pppData, 
    loading, 
    onRefresh,
    setLightboxPhoto 
}) => {
    const [filterCategory, setFilterCategory] = useState('ALL');
    const [filterWorkType, setFilterWorkType] = useState('ALL'); // ALL, PLANNED, INCIDENTAL

    if (loading) {
        return (
            <div className="py-16 text-center space-y-3">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm font-bold text-slate-500">Memuat papan operasional harian (PPP)...</p>
            </div>
        );
    }

    const { summary, ppp = {} } = pppData || {};
    const { progress = [], plans = [], problems = [] } = ppp;

    // Filter Helper
    const filterItem = (item) => {
        if (filterCategory !== 'ALL' && item.categoryTag !== filterCategory) return false;
        if (filterWorkType === 'PLANNED' && !item.isPlanned) return false;
        if (filterWorkType === 'INCIDENTAL' && item.isPlanned) return false;
        return true;
    };

    const filteredProgress = progress.filter(filterItem);
    const filteredPlans = plans.filter(filterItem);
    const filteredProblems = problems.filter(filterItem);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* 1. Date Selector & Metrics Header */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Date Navigation */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setSelectedDate(dayjs(selectedDate).subtract(1, 'day').format('YYYY-MM-DD'))}
                            className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors cursor-pointer"
                            title="Hari Sebelumnya"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <div className="flex items-center gap-2.5 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-200/80">
                            <Calendar size={18} className="text-blue-600" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent text-sm font-black text-slate-800 outline-none cursor-pointer"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => setSelectedDate(dayjs(selectedDate).add(1, 'day').format('YYYY-MM-DD'))}
                            className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors cursor-pointer"
                            title="Hari Berikutnya"
                        >
                            <ChevronRight size={18} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedDate(dayjs().format('YYYY-MM-DD'))}
                            className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors"
                        >
                            Hari Ini
                        </button>
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <select
                            value={filterWorkType}
                            onChange={(e) => setFilterWorkType(e.target.value)}
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
                        >
                            <option value="ALL">Semua Tipe Kerja</option>
                            <option value="PLANNED">📌 Terencana Saja</option>
                            <option value="INCIDENTAL">⚡ Mendadak / Insidental</option>
                        </select>
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
                        >
                            <option value="ALL">Semua Divisi / Tag</option>
                            <option value="ASET">ASET</option>
                            <option value="TEKNISI">TEKNISI</option>
                            <option value="KENDARAAN">KENDARAAN</option>
                            <option value="RUMGA">RUMGA</option>
                            <option value="KEUANGAN">KEUANGAN</option>
                            <option value="UMUM">UMUM</option>
                        </select>
                    </div>
                </div>

                {/* Scorecard Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
                    <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">Progress (Tuntas)</span>
                        <div className="flex items-baseline gap-1.5 pt-0.5">
                            <span className="text-xl font-black text-emerald-950">{summary?.totalCompleted || 0}</span>
                            <span className="text-[10px] text-emerald-700 font-bold">Pekerjaan</span>
                        </div>
                    </div>

                    <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-2xl">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">Plans (On Progress)</span>
                        <div className="flex items-baseline gap-1.5 pt-0.5">
                            <span className="text-xl font-black text-amber-950">{summary?.totalInProgress || 0}</span>
                            <span className="text-[10px] text-amber-700 font-bold">Pekerjaan</span>
                        </div>
                    </div>

                    <div className="p-3 bg-rose-50/70 border border-rose-100 rounded-2xl">
                        <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 block">Problems (Kendala)</span>
                        <div className="flex items-baseline gap-1.5 pt-0.5">
                            <span className="text-xl font-black text-rose-950">{summary?.totalProblems || 0}</span>
                            <span className="text-[10px] text-rose-700 font-bold">Hambatan</span>
                        </div>
                    </div>

                    <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-2xl">
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-800 block">Rasio Terencana</span>
                        <div className="flex items-baseline gap-1.5 pt-0.5">
                            <span className="text-xl font-black text-blue-950">{summary?.plannedRatio || 100}%</span>
                            <span className="text-[10px] text-blue-700 font-bold">({summary?.unplannedRatio || 0}% Insidental)</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. 3-Kolom Kanban PPP */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* KOLOM A: Progress (Pekerjaan Selesai Hari Ini) */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-3.5 bg-emerald-600 text-white rounded-2xl shadow-xs">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 size={18} />
                            <h3 className="text-xs font-black uppercase tracking-wider">A. Progress (Selesai 100%)</h3>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-black">
                            {filteredProgress.length}
                        </span>
                    </div>

                    {filteredProgress.length === 0 ? (
                        <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                            <p className="text-xs text-slate-400 italic">Belum ada pekerjaan selesai yang tercatat pada tanggal ini.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredProgress.map((item, idx) => (
                                <div key={idx} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-2xs space-y-2.5 hover:border-emerald-200 transition-colors">
                                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                        <div className="flex items-center gap-1.5">
                                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black uppercase">
                                                {item.categoryTag}
                                            </span>
                                            {item.isPlanned ? (
                                                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[9px] font-bold" title="Berasal dari perencanaan / penugasan">
                                                    📌 Terencana
                                                </span>
                                            ) : (
                                                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[9px] font-bold" title="Pekerjaan mendadak / insidental lapangan">
                                                    ⚡ Insidental
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-medium">
                                            PJ: <b>{item.user?.name}</b>
                                        </span>
                                    </div>

                                    <h4 className="text-xs font-bold text-slate-800 leading-snug">{item.title}</h4>

                                    {item.output && (
                                        <div className="p-2.5 bg-slate-50 rounded-xl text-xs text-slate-700 border border-slate-100">
                                            <span className="font-bold text-emerald-700 block text-[10px] uppercase">Wujud Hasil / Output:</span>
                                            <p className="font-medium pt-0.5">{item.output}</p>
                                        </div>
                                    )}

                                    {/* Photos */}
                                    {item.photos && item.photos.length > 0 && (
                                        <div className="flex items-center gap-1.5 pt-1 overflow-x-auto">
                                            {item.photos.map((ph, pIdx) => (
                                                <img
                                                    key={pIdx}
                                                    src={typeof ph === 'string' ? ph : ph.url}
                                                    alt="Bukti Selesai"
                                                    onClick={() => setLightboxPhoto && setLightboxPhoto(typeof ph === 'string' ? ph : ph.url)}
                                                    className="w-11 h-11 rounded-lg object-cover border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* KOLOM B: Plans (Pekerjaan Dalam Proses / Target) */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-3.5 bg-amber-500 text-white rounded-2xl shadow-xs">
                        <div className="flex items-center gap-2">
                            <Clock size={18} />
                            <h3 className="text-xs font-black uppercase tracking-wider">B. Plans (Dalam Proses)</h3>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-black">
                            {filteredPlans.length}
                        </span>
                    </div>

                    {filteredPlans.length === 0 ? (
                        <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                            <p className="text-xs text-slate-400 italic">Tidak ada pekerjaan on-progress pada tanggal ini.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredPlans.map((item, idx) => (
                                <div key={idx} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-2xs space-y-2.5 hover:border-amber-200 transition-colors">
                                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                        <div className="flex items-center gap-1.5">
                                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-black uppercase">
                                                {item.categoryTag}
                                            </span>
                                            {item.isPlanned ? (
                                                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[9px] font-bold">
                                                    📌 Terencana
                                                </span>
                                            ) : (
                                                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[9px] font-bold">
                                                    ⚡ Insidental
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-medium">
                                            PJ: <b>{item.user?.name}</b>
                                        </span>
                                    </div>

                                    <h4 className="text-xs font-bold text-slate-800 leading-snug">{item.title}</h4>

                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-600">
                                            <span>Target Selesai: {item.targetDate}</span>
                                            <span>{item.progressPercentage || 50}%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-amber-500 rounded-full" 
                                                style={{ width: `${item.progressPercentage || 50}%` }} 
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* KOLOM C: Problems (Kendala & Kebutuhan Dukungan) */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-3.5 bg-rose-600 text-white rounded-2xl shadow-xs">
                        <div className="flex items-center gap-2">
                            <AlertTriangle size={18} />
                            <h3 className="text-xs font-black uppercase tracking-wider">C. Problems (Kendala)</h3>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-black">
                            {filteredProblems.length}
                        </span>
                    </div>

                    {filteredProblems.length === 0 ? (
                        <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                            <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-1.5" />
                            <p className="text-xs font-bold text-slate-600">Nihil Kendala Hari Ini</p>
                            <p className="text-[11px] text-slate-400">Seluruh pekerjaan terlaksana tanpa hambatan berarti.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredProblems.map((item, idx) => (
                                <div key={idx} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-2xs space-y-2.5 hover:border-rose-200 transition-colors">
                                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                        <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-black uppercase">
                                            {item.categoryTag}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-medium">
                                            PJ: <b>{item.user?.name}</b>
                                        </span>
                                    </div>

                                    <h4 className="text-xs font-medium text-slate-700 leading-snug">
                                        <span className="font-bold text-slate-900">Aktivitas:</span> {item.title}
                                    </h4>

                                    <div className="p-2.5 bg-rose-50/70 border border-rose-100 rounded-xl space-y-1">
                                        <span className="text-[10px] font-black uppercase text-rose-800 block">Uraian Hambatan:</span>
                                        <p className="text-xs font-bold text-rose-900">{item.obstacleNote}</p>
                                    </div>

                                    {item.actionPlan && (
                                        <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-xl space-y-0.5">
                                            <span className="text-[10px] font-black uppercase text-blue-800 block">Tindak Lanjut / Butuh Arahan:</span>
                                            <p className="text-xs font-semibold text-blue-900">{item.actionPlan}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default DailyPppTab;
