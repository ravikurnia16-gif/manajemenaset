import React from 'react';
import { 
    Calendar, CheckCircle2, Clock, AlertTriangle, 
    ArrowRight, Sparkles, TrendingUp, ChevronRight, 
    Activity, FileText, CheckSquare, Target, Wrench 
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
    if (loading) {
        return (
            <div className="py-16 text-center space-y-3">
                <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm font-bold text-slate-500">Menganalisis siklus mingguan (PDCA)...</p>
            </div>
        );
    }

    const { pdca = {}, period = {} } = pdcaData || {};
    const { plan = {}, do: doData = {}, check = {}, act = {} } = pdca;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* 1. Header Toolbar with Date Range */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider">
                            Plan - Do - Check - Act
                        </span>
                        <span className="text-xs text-slate-400 font-medium">• Siklus Mutu Mingguan</span>
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
                </div>
            </div>

            {/* 2. Top Summary KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* PLAN Card */}
                <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50/50 border border-blue-100 rounded-3xl space-y-1">
                    <span className="text-[10px] font-black uppercase text-blue-700 tracking-wider">Plan (Target Rencana)</span>
                    <div className="flex items-baseline gap-1.5 pt-1">
                        <span className="text-2xl font-black text-blue-950">{plan.totalPlannedTasks || 0}</span>
                        <span className="text-xs text-blue-700 font-bold">Penugasan Minggu Ini</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">Beban kerja terencana Kabid</p>
                </div>

                {/* DO Card */}
                <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-100 rounded-3xl space-y-1">
                    <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">Do (Realisasi Kerja)</span>
                    <div className="flex items-baseline gap-1.5 pt-1">
                        <span className="text-2xl font-black text-emerald-950">{doData.totalActivitiesDone || 0}</span>
                        <span className="text-xs text-emerald-700 font-bold">Aktivitas Dilaksanakan</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">{doData.resolvedMaintenanceCount || 0} perbaikan sarana tuntas</p>
                </div>

                {/* CHECK Card */}
                <div className="p-4 bg-gradient-to-br from-purple-50 to-violet-50/50 border border-purple-100 rounded-3xl space-y-1">
                    <span className="text-[10px] font-black uppercase text-purple-700 tracking-wider">Check (Capaian Target)</span>
                    <div className="flex items-baseline gap-1.5 pt-1">
                        <span className="text-2xl font-black text-purple-950">{check.assignmentCompletionRate || 0}%</span>
                        <span className="text-xs text-purple-700 font-bold">On-Time Rate</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">Rata-rata respon SLA: {check.avgSlaHours || 1.5} Jam</p>
                </div>

                {/* ACT Card */}
                <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50/50 border border-amber-100 rounded-3xl space-y-1">
                    <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider">Act (Rasio Terencana)</span>
                    <div className="flex items-baseline gap-1.5 pt-1">
                        <span className="text-2xl font-black text-amber-950">{check.plannedPercentage || 75}%</span>
                        <span className="text-xs text-amber-700 font-bold">Terencana</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">{check.incidentalPercentage || 25}% pekerjaan mendadak</p>
                </div>
            </div>

            {/* 3. 4 Kuadran PDCA */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* KUADRAN 1: PLAN (Rencana Kerja) */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                        <span className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm">
                            P
                        </span>
                        <div>
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                1. Plan (Target Kerja Terencana)
                            </h4>
                            <p className="text-[11px] text-slate-400 font-medium">Daftar penugasan dan rencana mingguan yang ditetapkan</p>
                        </div>
                    </div>

                    {!plan.tasks || plan.tasks.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-6 text-center">Belum ada target penugasan khusus di minggu ini.</p>
                    ) : (
                        <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                            {plan.tasks.map((t) => (
                                <div key={t.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center justify-between gap-2">
                                    <div className="space-y-0.5 flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 text-[9px] font-black uppercase">
                                                {t.category || 'UMUM'}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-medium">
                                                Target: {t.dueDate ? dayjs(t.dueDate).format('DD MMM') : 'Minggu ini'}
                                            </span>
                                        </div>
                                        <h5 className="text-xs font-bold text-slate-800 truncate">{t.title}</h5>
                                        <p className="text-[10px] text-slate-500 font-medium">PJ: <b>{t.assignee?.name}</b></p>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase shrink-0 ${
                                        t.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                    }`}>
                                        {t.status === 'COMPLETED' ? 'Tuntas' : `${t.progressPercentage || 0}%`}
                                    </span>
                                </div>
                            ))}
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
                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-2">
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Komposisi Pekerjaan:</span>
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-blue-700">📌 Terencana: {doData.plannedActivitiesDone || 0}</span>
                                <span className="text-amber-700">⚡ Mendadak/Insidental: {doData.incidentalActivitiesDone || 0}</span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
                                <div 
                                    className="h-full bg-blue-600" 
                                    style={{ width: `${check.plannedPercentage || 75}%` }} 
                                    title={`Terencana: ${check.plannedPercentage || 75}%`}
                                />
                                <div 
                                    className="h-full bg-amber-500" 
                                    style={{ width: `${check.incidentalPercentage || 25}%` }} 
                                    title={`Insidental: ${check.incidentalPercentage || 25}%`}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-2xl">
                                <span className="text-[10px] font-bold text-emerald-800 block">Laporan Harian Staf</span>
                                <span className="text-lg font-black text-emerald-950">{doData.reportsCount || 0} Laporan</span>
                            </div>
                            <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-2xl">
                                <span className="text-[10px] font-bold text-blue-800 block">Tiket Pemeliharaan</span>
                                <span className="text-lg font-black text-blue-950">{doData.resolvedMaintenanceCount || 0} Tuntas</span>
                            </div>
                        </div>
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
                            <p className="text-[11px] text-slate-400 font-medium">Analisis kesenjangan antara rencana vs realisasi</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                                <span>Tingkat Ketercapaian Penugasan:</span>
                                <span className="text-purple-700 font-black">{check.assignmentCompletionRate || 0}%</span>
                            </div>
                            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                                <span>Rata-Rata Respon Perbaikan (SLA):</span>
                                <span className="text-indigo-700 font-black">{check.avgSlaHours || 1.5} Jam</span>
                            </div>
                            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                                <span>Total Hambatan Lapangan:</span>
                                <span className="text-rose-700 font-black">{check.totalObstacles || 0} Kendala</span>
                            </div>
                        </div>

                        {check.delayedTasks && check.delayedTasks.length > 0 && (
                            <div className="space-y-1.5">
                                <span className="text-[10px] font-black uppercase text-rose-700 tracking-wider">
                                    Tugas Tertunda / Belum Tuntas ({check.delayedTasks.length}):
                                </span>
                                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                    {check.delayedTasks.map((dt) => (
                                        <div key={dt.id} className="p-2 bg-rose-50/60 rounded-xl border border-rose-100 text-xs flex items-center justify-between gap-2">
                                            <span className="font-bold text-slate-800 truncate">{dt.title}</span>
                                            <span className="text-[10px] font-bold text-rose-700 shrink-0">PJ: {dt.assignee?.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* KUADRAN 4: ACT (Tindak Lanjut & Rekomendasi Pimpinan) */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                        <span className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center font-black text-sm">
                            A
                        </span>
                        <div>
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                4. Act (Tindak Lanjut & Perbaikan Berkelanjutan)
                            </h4>
                            <p className="text-[11px] text-slate-400 font-medium">Keputusan dan rekomendasi untuk siklus minggu berikutnya</p>
                        </div>
                    </div>

                    <div className="space-y-3">
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
                    </div>
                </div>

            </div>
        </div>
    );
};

export default WeeklyPdcaTab;
