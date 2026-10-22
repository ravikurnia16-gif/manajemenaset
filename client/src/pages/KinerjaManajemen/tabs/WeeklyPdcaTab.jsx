import React, { useState } from 'react';
import { 
    Calendar, CheckCircle2, Clock, AlertTriangle, 
    ArrowRight, Sparkles, TrendingUp, ChevronRight, 
    Activity, FileText, CheckSquare, Target, Wrench,
    Layers, Zap, AlertCircle, Share2, Send, ShieldCheck
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/id';

dayjs.locale('id');

const WeeklyPdcaTab = ({
    pdcaData,
    loading,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    onRefresh
}) => {
    const [planTab, setPlanTab] = useState('ALL'); // 'ALL' | 'ASSIGNMENTS' | 'PLANS'

    if (loading) {
        return (
            <div className="py-16 text-center space-y-3">
                <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm font-bold text-slate-500">Menganalisis siklus mutu mingguan (PDCA)...</p>
            </div>
        );
    }

    const { pdca = {}, period = {} } = pdcaData || {};
    const { plan = {}, do: doData = {}, check = {}, act = {} } = pdca;

    const plannedTasks = plan.tasks || [];
    const plannedWorkPlanItems = plan.workPlanItems || [];

    const displayPlanItems = planTab === 'ASSIGNMENTS' 
        ? plannedTasks.map(t => ({ ...t, isAssignment: true }))
        : planTab === 'PLANS'
            ? plannedWorkPlanItems.map(p => ({ ...p, isAssignment: false }))
            : [
                ...plannedTasks.map(t => ({ ...t, isAssignment: true })),
                ...plannedWorkPlanItems.map(p => ({ ...p, isAssignment: false }))
            ];

    // Buat ringkasan teks Kaizen untuk dibagikan ke WhatsApp
    const kaizenShareText = encodeURIComponent(
        `📌 *RINGKASAN SIKLUS MUTU PDCA SARPRAS* 📌\n` +
        `Periode: ${dayjs(period.startDate).format('DD MMM')} - ${dayjs(period.endDate).format('DD MMM YYYY')}\n\n` +
        `📊 *Capaian Target:*\n` +
        `• Penugasan Resmi: ${check.assignmentCompletionRate || 0}%\n` +
        `• Rencana Kerja Staf: ${check.planCompletionRate || 0}%\n` +
        `• Capaian Keseluruhan: ${check.overallCompletionRate || 0}%\n` +
        `• Rasio Terencana: ${check.plannedPercentage || 0}% (Insidental: ${check.incidentalPercentage || 0}%)\n` +
        `• Respon SLA: ${check.avgSlaHours || 1.5} Jam\n\n` +
        `🛠️ *Tindakan Perbaikan (Kaizen):*\n` +
        (act.kaizenActions || []).map((kz, i) => `${i + 1}. [${kz.urgency}] ${kz.title}: ${kz.description}`).join('\n\n') +
        `\n\n_Evaluasi Siklus Mutu Sarana & Prasarana Pondok_`
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* 1. Header Toolbar with Date Range */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider">
                            Plan - Do - Check - Act
                        </span>
                        <span className="text-xs text-slate-400 font-medium">• Siklus Mutu Mingguan Terpadu</span>
                    </div>
                    <h3 className="text-base font-black text-slate-800">
                        Evaluasi Kinerja Sarpras: {dayjs(period.startDate).format('DD MMMM')} – {dayjs(period.endDate).format('DD MMMM YYYY')}
                    </h3>
                </div>

                {/* Range Filter */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                        />
                        <span className="text-xs text-slate-400 font-bold">s.d.</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={onRefresh}
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                    >
                        Terapkan
                    </button>
                    {kaizenShareText && (
                        <a
                            href={`https://wa.me/?text=${kaizenShareText}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-xs"
                            title="Bagikan Ringkasan PDCA ke WhatsApp"
                        >
                            <Send size={13} />
                            <span>Share WA</span>
                        </a>
                    )}
                </div>
            </div>

            {/* 2. Top Summary KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* PLAN Card */}
                <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50/50 border border-blue-100 rounded-3xl space-y-1">
                    <span className="text-[10px] font-black uppercase text-blue-700 tracking-wider">Plan (Target Rencana)</span>
                    <div className="flex items-baseline gap-1.5 pt-1">
                        <span className="text-2xl font-black text-blue-950">{plan.totalPlannedTasks || 0}</span>
                        <span className="text-xs text-blue-700 font-bold">Target Terjadwal</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                        {plannedTasks.length} tugas resmi + {plannedWorkPlanItems.length} butir rencana staf
                    </p>
                </div>

                {/* DO Card */}
                <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-100 rounded-3xl space-y-1">
                    <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">Do (Realisasi Kerja)</span>
                    <div className="flex items-baseline gap-1.5 pt-1">
                        <span className="text-2xl font-black text-emerald-950">{doData.totalActivitiesDone || 0}</span>
                        <span className="text-xs text-emerald-700 font-bold">Aktivitas Dilaksanakan</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                        {doData.resolvedMaintenanceCount || 0} tiket tuntas • {doData.reportsCount || 0} laporan
                    </p>
                </div>

                {/* CHECK Card */}
                <div className="p-4 bg-gradient-to-br from-purple-50 to-violet-50/50 border border-purple-100 rounded-3xl space-y-1">
                    <span className="text-[10px] font-black uppercase text-purple-700 tracking-wider">Check (Capaian Target)</span>
                    <div className="flex items-baseline gap-1.5 pt-1">
                        <span className="text-2xl font-black text-purple-950">{check.overallCompletionRate ?? check.assignmentCompletionRate ?? 0}%</span>
                        <span className="text-xs text-purple-700 font-bold">Capaian Mutu</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                        Tugas: {check.assignmentCompletionRate || 0}% • Rencana: {check.planCompletionRate || 0}%
                    </p>
                </div>

                {/* ACT Card */}
                <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50/50 border border-amber-100 rounded-3xl space-y-1">
                    <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider">Act (Rasio Terencana)</span>
                    <div className="flex items-baseline gap-1.5 pt-1">
                        <span className="text-2xl font-black text-amber-950">{check.plannedPercentage || 75}%</span>
                        <span className="text-xs text-amber-700 font-bold">Terencana</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">{check.incidentalPercentage || 25}% beban kerja mendadak</p>
                </div>
            </div>

            {/* 3. 4 Kuadran PDCA */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* KUADRAN 1: PLAN (Rencana Kerja Terpadu) */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-2">
                        <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm">
                                P
                            </span>
                            <div>
                                <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                    1. Plan (Target Kerja Terencana)
                                </h4>
                                <p className="text-[11px] text-slate-400 font-medium">Beban kerja resmi & butir rencana staf minggu ini</p>
                            </div>
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                            <button
                                type="button"
                                onClick={() => setPlanTab('ALL')}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                    planTab === 'ALL' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                Semua ({displayPlanItems.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setPlanTab('ASSIGNMENTS')}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                    planTab === 'ASSIGNMENTS' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                Penugasan ({plannedTasks.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setPlanTab('PLANS')}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                    planTab === 'PLANS' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                Rencana ({plannedWorkPlanItems.length})
                            </button>
                        </div>
                    </div>

                    {displayPlanItems.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-8 text-center">Belum ada target penugasan atau rencana terdaftar di minggu ini.</p>
                    ) : (
                        <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                            {displayPlanItems.map((item, idx) => {
                                const isAssign = item.isAssignment;
                                const title = isAssign ? item.title : item.activity;
                                const subtitle = isAssign ? `Penugasan Resmi • PJ: ${item.assignee?.name || 'Staf'}` : `Rencana: ${item.planTitle} • PJ: ${item.user?.name || 'Staf'}`;
                                const targetDate = isAssign ? item.dueDate : item.targetDate;
                                const isDone = isAssign ? item.status === 'COMPLETED' : item.isDone;
                                const pct = item.progressPercentage ?? item.percentage ?? 0;

                                return (
                                    <div key={idx} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center justify-between gap-2 hover:bg-slate-100/60 transition-colors">
                                        <div className="space-y-0.5 flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                                    isAssign ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                                                }`}>
                                                    {isAssign ? 'TUGAS' : 'RENCANA'}
                                                </span>
                                                <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 text-[9px] font-bold uppercase">
                                                    {item.category || 'UMUM'}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-medium">
                                                    {targetDate ? dayjs(targetDate).format('DD MMM') : 'Minggu ini'}
                                                </span>
                                            </div>
                                            <h5 className="text-xs font-bold text-slate-800 truncate">{title}</h5>
                                            {item.targetOutput && (
                                                <p className="text-[10px] text-violet-700 font-medium truncate flex items-center gap-1">
                                                    <span className="font-bold shrink-0">🎯 Target:</span>
                                                    <span className="text-slate-600 truncate">{item.targetOutput}</span>
                                                </p>
                                            )}
                                            <p className="text-[10px] text-slate-500 font-medium truncate">{subtitle}</p>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase shrink-0 ${
                                            isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                        }`}>
                                            {isDone ? 'Tuntas' : `${pct}%`}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* KUADRAN 2: DO (Eksekusi Nyata di Lapangan) */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                        <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm">
                            D
                        </span>
                        <div>
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                2. Do (Eksekusi & Aktivitas Nyata)
                            </h4>
                            <p className="text-[11px] text-slate-400 font-medium">Akumulasi pekerjaan riil yang diselesaikan tim sepanjang minggu</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {/* Composition Progress Bar */}
                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-2">
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Komposisi Pekerjaan:</span>
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-blue-700">📌 Terencana: {doData.plannedActivitiesDone || 0}</span>
                                <span className="text-amber-700">⚡ Mendadak/Insidental: {doData.incidentalActivitiesDone || 0}</span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
                                <div 
                                    className="h-full bg-blue-600 transition-all" 
                                    style={{ width: `${check.plannedPercentage || 75}%` }} 
                                    title={`Terencana: ${check.plannedPercentage || 75}%`}
                                />
                                <div 
                                    className="h-full bg-amber-500 transition-all" 
                                    style={{ width: `${check.incidentalPercentage || 25}%` }} 
                                    title={`Insidental: ${check.incidentalPercentage || 25}%`}
                                />
                            </div>
                        </div>

                        {/* KPI Highlights */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-2xl">
                                <span className="text-[10px] font-bold text-emerald-800 block">Laporan Harian</span>
                                <span className="text-base font-black text-emerald-950">{doData.reportsCount || 0} Laporan</span>
                            </div>
                            <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-2xl">
                                <span className="text-[10px] font-bold text-blue-800 block">Tiket Pemeliharaan</span>
                                <span className="text-base font-black text-blue-950">{doData.resolvedMaintenanceCount || 0} Tuntas</span>
                            </div>
                            <div className="p-3 bg-purple-50/60 border border-purple-100 rounded-2xl col-span-2 sm:col-span-1">
                                <span className="text-[10px] font-bold text-purple-800 block">Target Selesai</span>
                                <span className="text-base font-black text-purple-950">{(doData.completedAssignmentsCount || 0) + (doData.completedPlanItemsCount || 0)} Butir</span>
                            </div>
                        </div>

                        {/* Category Execution Breakdown */}
                        {doData.categoryExecution && Object.keys(doData.categoryExecution).length > 0 && (
                            <div className="space-y-1.5 pt-1">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Sebaran Aktivitas Bidang:</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(doData.categoryExecution).map(([cat, count]) => (
                                        <span key={cat} className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                                            {cat}: <b>{count}</b>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* KUADRAN 3: CHECK (Evaluasi & Gap Analysis) */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                        <span className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-sm">
                            C
                        </span>
                        <div>
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                3. Check (Evaluasi & Gap Analysis)
                            </h4>
                            <p className="text-[11px] text-slate-400 font-medium">Analisis kesenjangan antara rencana vs realisasi & kendala</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {/* Metrics Group */}
                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                                <span>Capaian Keseluruhan Target:</span>
                                <span className="text-purple-700 font-black text-sm">{check.overallCompletionRate ?? check.assignmentCompletionRate ?? 0}%</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium">
                                <span>• Ketercapaian Penugasan Resmi:</span>
                                <span className="font-bold text-slate-800">{check.assignmentCompletionRate || 0}%</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium">
                                <span>• Ketercapaian Rencana Kerja Staf:</span>
                                <span className="font-bold text-slate-800">{check.planCompletionRate || 0}%</span>
                            </div>
                            <div className="flex items-center justify-between text-xs font-bold text-slate-700 pt-1 border-t border-slate-200/60">
                                <span>Rata-Rata Respon Perbaikan (SLA):</span>
                                <span className="text-indigo-700 font-black">{check.avgSlaHours || 1.5} Jam</span>
                            </div>
                            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                                <span>Total Hambatan Lapangan:</span>
                                <span className="text-rose-700 font-black">{check.totalObstacles || 0} Kendala</span>
                            </div>
                        </div>

                        {/* Root Cause Obstacle Breakdown */}
                        {check.obstacleCategories && Object.values(check.obstacleCategories).some(v => v > 0) && (
                            <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100 space-y-1.5">
                                <span className="text-[10px] font-black uppercase text-rose-800 tracking-wider">Akar Penyebab Hambatan Lapangan:</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {check.obstacleCategories.SUKU_CADANG > 0 && (
                                        <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 text-[10px] font-bold">
                                            Suku Cadang/Logistik: {check.obstacleCategories.SUKU_CADANG}
                                        </span>
                                    )}
                                    {check.obstacleCategories.ANGGARAN_BIAYA > 0 && (
                                        <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 text-[10px] font-bold">
                                            Anggaran/Kas: {check.obstacleCategories.ANGGARAN_BIAYA}
                                        </span>
                                    )}
                                    {check.obstacleCategories.TEKNIS_KERUSAKAN > 0 && (
                                        <span className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-800 text-[10px] font-bold">
                                            Kerusakan Teknis: {check.obstacleCategories.TEKNIS_KERUSAKAN}
                                        </span>
                                    )}
                                    {check.obstacleCategories.AKSES_CUACA > 0 && (
                                        <span className="px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800 text-[10px] font-bold">
                                            Cuaca / Akses: {check.obstacleCategories.AKSES_CUACA}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Delayed Tasks */}
                        {check.delayedTasks && check.delayedTasks.length > 0 && (
                            <div className="space-y-1.5">
                                <span className="text-[10px] font-black uppercase text-rose-700 tracking-wider">
                                    Target Tertunda / Belum Tuntas ({check.delayedTasks.length}):
                                </span>
                                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                    {check.delayedTasks.map((dt, idx) => (
                                        <div key={idx} className="p-2 bg-rose-50/60 rounded-xl border border-rose-100 text-xs flex items-center justify-between gap-2">
                                            <div className="truncate flex-1">
                                                <span className="font-bold text-slate-800 truncate block">{dt.title}</span>
                                                <span className="text-[10px] text-slate-400">PJ: {dt.assignee?.name || 'Staf'}</span>
                                            </div>
                                            <span className="text-[10px] font-black text-rose-700 shrink-0 bg-white px-2 py-0.5 rounded-md border border-rose-200">
                                                {dt.percentage || 0}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* KUADRAN 4: ACT (Tindak Lanjut & Rekomendasi Kaizen) */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                        <span className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center font-black text-sm">
                            A
                        </span>
                        <div>
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                4. Act (Tindak Lanjut & Rekomendasi Kaizen)
                            </h4>
                            <p className="text-[11px] text-slate-400 font-medium">Keputusan dan tindakan perbaikan untuk siklus berikutnya</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {/* Kaizen Action Cards */}
                        {act.kaizenActions && act.kaizenActions.length > 0 ? (
                            <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                                {act.kaizenActions.map((kz, idx) => (
                                    <div key={kz.id || idx} className="p-3.5 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-1.5 hover:bg-amber-50/80 transition-colors">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                                    kz.urgency === 'TINGGI' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                                                }`}>
                                                    Urgensi: {kz.urgency}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-500">
                                                    PIC: <b>{kz.targetDept}</b>
                                                </span>
                                            </div>
                                        </div>
                                        <h5 className="text-xs font-bold text-slate-900">{kz.title}</h5>
                                        <p className="text-xs text-slate-700 leading-relaxed font-medium">{kz.description}</p>
                                        {kz.impact && (
                                            <p className="text-[10px] text-amber-900 italic bg-amber-100/60 px-2 py-1 rounded-lg">
                                                💡 Dampak: {kz.impact}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {(!act.recommendations || act.recommendations.length === 0) ? (
                                    <p className="text-xs text-slate-400 italic py-4 text-center">Belum ada catatan rekomendasi.</p>
                                ) : (
                                    act.recommendations.map((rec, idx) => (
                                        <div key={idx} className="p-3 bg-amber-50/60 border border-amber-200/70 rounded-2xl flex items-start gap-2.5">
                                            <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                                                {idx + 1}
                                            </span>
                                            <p className="text-xs font-semibold text-slate-800 leading-relaxed">{rec}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default WeeklyPdcaTab;
