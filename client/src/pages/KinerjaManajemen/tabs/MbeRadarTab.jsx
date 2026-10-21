import React, { useState } from 'react';
import { 
    AlertTriangle, Clock, CheckCircle2, AlertCircle, 
    ArrowRight, Wrench, Car, UserCheck, 
    ShieldAlert, ExternalLink, Calendar, ChevronRight,
    MessageSquare, Send, ListTodo, AlertOctagon, UserX
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import { Link } from 'react-router-dom';

dayjs.locale('id');

const MbeRadarTab = ({ radarData, loading, onRefresh, onNavigateTab }) => {
    const [filterCategory, setFilterCategory] = useState('ALL');

    if (loading) {
        return (
            <div className="py-16 text-center space-y-3">
                <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm font-bold text-slate-500">Memindai seluruh sistem untuk mendeteksi anomali (MBE)...</p>
            </div>
        );
    }

    const {
        overdueAssignments = [],
        pendingExtensions = [],
        criticalMaintenance = [],
        overdueVehicleReminders = [],
        pendingVehicleServices = [],
        unresolvedObstacles = [],
        overduePlans = [],
        missingWeeklyPlans = []
    } = radarData || {};

    const totalExceptions = 
        overdueAssignments.length + 
        pendingExtensions.length + 
        criticalMaintenance.length + 
        overdueVehicleReminders.length + 
        pendingVehicleServices.length + 
        unresolvedObstacles.length +
        overduePlans.length +
        missingWeeklyPlans.length;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* 1. Executive Summary Banner */}
            <div className={`p-6 rounded-3xl border text-white shadow-sm transition-all ${
                totalExceptions === 0 
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-700 border-emerald-500' 
                    : 'bg-gradient-to-r from-rose-600 via-rose-700 to-red-800 border-rose-500'
            }`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-black tracking-wider uppercase backdrop-blur-xs">
                                Management by Exception (MBE)
                            </span>
                            <span className="text-xs text-rose-100 font-medium">• Radar Anomali Pimpinan</span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2.5">
                            {totalExceptions === 0 ? (
                                <>
                                    <CheckCircle2 size={26} className="text-emerald-200" />
                                    <span>Operasional Sarpras Prima: 0 Anomali / Kendala Kritis</span>
                                </>
                            ) : (
                                <>
                                    <ShieldAlert size={26} className="text-amber-300 animate-pulse" />
                                    <span>Terdeteksi {totalExceptions} Anomali & Hal Kritis yang Memerlukan Tindakan</span>
                                </>
                            )}
                        </h2>
                        <p className="text-xs text-white/90 max-w-2xl leading-relaxed">
                            {totalExceptions === 0
                                ? 'Seluruh penugasan berjalan tepat waktu, rencana kerja tersusun rapi, tidak ada perbaikan sarana macet, dan armada kendaraan prima.'
                                : 'Sistem otomatis menyaring pekerjaan rutin dan mengangkat tugas melewati batas waktu, rencana kerja tertunda, staf belum menyusun rencana, serta kendala lapangan yang butuh keputusan Anda.'}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={onRefresh}
                            className="px-4 py-2 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-xl text-xs font-bold transition-all border border-white/20 cursor-pointer shadow-xs flex items-center gap-1.5"
                        >
                            <span>🔄 Pindai Ulang</span>
                        </button>
                    </div>
                </div>

                {/* Exception Stat Counters */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 mt-6 pt-5 border-t border-white/15">
                    <div className="bg-black/15 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
                        <span className="text-[10px] font-bold text-white/75 block">Tugas Overdue</span>
                        <span className="text-xl font-black text-white">{overdueAssignments.length}</span>
                    </div>
                    <div className="bg-black/15 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
                        <span className="text-[10px] font-bold text-white/75 block">Rencana Overdue</span>
                        <span className="text-xl font-black text-white">{overduePlans.length}</span>
                    </div>
                    <div className="bg-black/15 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
                        <span className="text-[10px] font-bold text-white/75 block">Belum Buat Rencana</span>
                        <span className="text-xl font-black text-white">{missingWeeklyPlans.length}</span>
                    </div>
                    <div className="bg-black/15 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
                        <span className="text-[10px] font-bold text-white/75 block">Perbaikan Tertunda</span>
                        <span className="text-xl font-black text-white">{criticalMaintenance.length}</span>
                    </div>
                    <div className="bg-black/15 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
                        <span className="text-[10px] font-bold text-white/75 block">Armada Servis</span>
                        <span className="text-xl font-black text-white">{overdueVehicleReminders.length + pendingVehicleServices.length}</span>
                    </div>
                    <div className="bg-black/15 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
                        <span className="text-[10px] font-bold text-white/75 block">Kendala Lapangan</span>
                        <span className="text-xl font-black text-white">{unresolvedObstacles.length}</span>
                    </div>
                </div>
            </div>

            {/* 2. SECTION: KEPATUHAN PENYUSUNAN RENCANA KERJA STAF */}
            {missingWeeklyPlans.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-300/80 rounded-3xl p-5 space-y-3.5 animate-in fade-in">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-3">
                        <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shrink-0">
                                <UserX size={18} />
                            </span>
                            <div>
                                <h3 className="text-sm font-black text-amber-950 uppercase tracking-wider flex items-center gap-2">
                                    <span>Kepatuhan Rencana Kerja Staf ({missingWeeklyPlans.length} Staf Belum Menyusun)</span>
                                    <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-bold">
                                        {missingWeeklyPlans[0]?.isNextWeek ? 'Target Pekan Depan' : 'Target Pekan Berjalan'}
                                    </span>
                                </h3>
                                <p className="text-[11px] text-amber-800 font-medium">
                                    Periode: <b>{missingWeeklyPlans[0]?.missingPeriod || '-'}</b> • Ingatkan staf sebelum periode kerja dimulai
                                </p>
                            </div>
                        </div>

                        {onNavigateTab && (
                            <button
                                type="button"
                                onClick={() => onNavigateTab('PLANS')}
                                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shrink-0 flex items-center gap-1 shadow-2xs cursor-pointer"
                            >
                                <ListTodo size={14} />
                                <span>Buka Rencana Staf</span>
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {missingWeeklyPlans.map((st) => (
                            <div key={`missing-${st.userId}`} className="p-3 bg-white rounded-2xl border border-amber-200 shadow-2xs flex items-center justify-between gap-3 hover:border-amber-300 transition-all">
                                <div className="min-w-0 space-y-0.5">
                                    <h5 className="text-xs font-bold text-slate-800 truncate">{st.name}</h5>
                                    <p className="text-[10px] text-slate-500 truncate">{st.position || 'Staf Sarpras'}</p>
                                </div>
                                <div className="shrink-0 flex items-center gap-1.5">
                                    {st.waLink ? (
                                        <a
                                            href={st.waLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                                            title="Kirim pengingat WhatsApp"
                                        >
                                            <Send size={12} />
                                            <span>Ingatkan</span>
                                        </a>
                                    ) : (
                                        <span className="text-[10px] text-slate-400 italic">No HP (-)</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 3. Grid Exceptions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* BLOK A: Penugasan Terlambat (Overdue Tasks) */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                                <Clock size={18} />
                            </span>
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                    Penugasan Melewati Batas Waktu ({overdueAssignments.length})
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium">Penugasan resmi Kabid yang belum tuntas melewati deadline</p>
                            </div>
                        </div>
                        <Link 
                            to="/penugasan"
                            className="text-[11px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1"
                        >
                            Kelola Penugasan <ChevronRight size={13} />
                        </Link>
                    </div>

                    {overdueAssignments.length === 0 ? (
                        <div className="py-8 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
                            <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-1.5" />
                            <p className="text-xs font-bold text-slate-600">Nihil Penugasan Terlambat</p>
                            <p className="text-[11px] text-slate-400">Seluruh tugas staf berjalan sesuai batas waktu target.</p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                            {overdueAssignments.map((task) => {
                                const daysOver = Math.max(1, dayjs().diff(dayjs(task.dueDate), 'day'));
                                const cleanPhone = (task.assignee?.phone || '').replace(/^0/, '62').replace(/\D/g, '');
                                const waMsg = encodeURIComponent(
                                    `Assalamu'alaikum Akhi ${task.assignee?.name || 'Staf'},\n\n` +
                                    `Mengingatkan penugasan: *"${task.title}"* telah melewati batas waktu (${dayjs(task.dueDate).format('DD MMM YYYY')}, terlambat ${daysOver} hari).\n` +
                                    `📊 Progres saat ini: ${task.progressPercentage || 0}%.\n\n` +
                                    `Mohon segera ditindaklanjuti. Syukron.`
                                );

                                return (
                                    <div key={task.id} className="p-3.5 bg-rose-50/40 border border-rose-100 rounded-2xl space-y-2 hover:bg-rose-50/70 transition-colors">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="space-y-0.5 flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-black uppercase tracking-wider">
                                                        Terlambat {daysOver} Hari
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded bg-white text-slate-600 text-[10px] font-bold border border-slate-200">
                                                        {task.category || 'UMUM'}
                                                    </span>
                                                </div>
                                                <h4 className="text-xs font-bold text-slate-900 pt-0.5 truncate">{task.title}</h4>
                                                <p className="text-[11px] text-slate-500">
                                                    Pelaksana: <b>{task.assignee?.name}</b> ({task.assignee?.position || 'Staf'})
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {cleanPhone && (
                                                    <a
                                                        href={`https://wa.me/${cleanPhone}?text=${waMsg}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-2xs"
                                                        title="Ingatkan via WhatsApp"
                                                    >
                                                        <Send size={11} />
                                                        <span>WA</span>
                                                    </a>
                                                )}
                                                <Link 
                                                    to={`/penugasan`}
                                                    className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-bold hover:bg-rose-700 transition-colors shadow-2xs"
                                                >
                                                    Detail
                                                </Link>
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                                                <span>Progres Penyelesaian</span>
                                                <span className="text-rose-700">{task.progressPercentage || 0}%</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-rose-100 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-rose-600 rounded-full transition-all"
                                                    style={{ width: `${task.progressPercentage || 0}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* BLOK B: Rencana Kerja Melewati Batas Waktu (Overdue Plans) */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
                                <AlertOctagon size={18} />
                            </span>
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                    Rencana Kerja Melewati Batas Waktu ({overduePlans.length})
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium">Rencana kerja staf belum tuntas melewati target selesai</p>
                            </div>
                        </div>
                        {onNavigateTab && (
                            <button
                                type="button"
                                onClick={() => onNavigateTab('PLANS')}
                                className="text-[11px] font-bold text-orange-600 hover:text-orange-800 flex items-center gap-1 cursor-pointer"
                            >
                                Rencana Staf <ChevronRight size={13} />
                            </button>
                        )}
                    </div>

                    {overduePlans.length === 0 ? (
                        <div className="py-8 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
                            <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-1.5" />
                            <p className="text-xs font-bold text-slate-600">Nihil Rencana Kerja Overdue</p>
                            <p className="text-[11px] text-slate-400">Seluruh rencana kerja mingguan staf terselesaikan sesuai tenggat waktu.</p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                            {overduePlans.map((plan) => (
                                <div key={plan.id} className="p-3.5 bg-orange-50/40 border border-orange-100 rounded-2xl space-y-2 hover:bg-orange-50/70 transition-colors">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="space-y-0.5 flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800 text-[10px] font-black uppercase tracking-wider">
                                                    Terlambat {plan.daysOverdue} Hari
                                                </span>
                                                <span className="px-2 py-0.5 rounded bg-white text-slate-600 text-[10px] font-bold border border-slate-200">
                                                    {plan.category || 'UMUM'}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-medium">
                                                    Target: {dayjs(plan.endDate).format('DD MMM YYYY')}
                                                </span>
                                            </div>
                                            <h4 className="text-xs font-bold text-slate-900 pt-0.5 truncate">{plan.title}</h4>
                                            <p className="text-[11px] text-slate-500">
                                                Penanggung Jawab: <b>{plan.user?.name}</b> ({plan.user?.position || 'Staf'})
                                            </p>
                                        </div>

                                        <div className="shrink-0 flex items-center gap-1.5">
                                            {plan.waLink && (
                                                <a
                                                    href={plan.waLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                                                    title="Ingatkan Staf via WA"
                                                >
                                                    <Send size={11} />
                                                    <span>WA</span>
                                                </a>
                                            )}
                                            {onNavigateTab && (
                                                <button
                                                    type="button"
                                                    onClick={() => onNavigateTab('PLANS')}
                                                    className="px-2 py-1 rounded-lg bg-orange-600 text-white text-[10px] font-bold hover:bg-orange-700 transition-colors shadow-2xs cursor-pointer"
                                                >
                                                    Tinjau
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Progress Bar & Items Done */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                                            <span>Terselesaikan: {plan.doneItems || 0} / {plan.totalItems || 0} Butir</span>
                                            <span className="text-orange-700">{plan.percentage || 0}%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-orange-100 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-orange-600 rounded-full transition-all"
                                                style={{ width: `${plan.percentage || 0}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* BLOK C: Permintaan Perpanjangan Waktu & Perbaikan Sarana Kritis */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                                <AlertTriangle size={18} />
                            </span>
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                    Pengajuan Perpanjangan & Sarana Kritis ({pendingExtensions.length + criticalMaintenance.length})
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium">Permintaan perpanjangan tugas dan perbaikan fasilitas macet</p>
                            </div>
                        </div>
                        <Link 
                            to="/pemeliharaan"
                            className="text-[11px] font-bold text-amber-600 hover:text-amber-800 flex items-center gap-1"
                        >
                            Monitoring Pemeliharaan <ChevronRight size={13} />
                        </Link>
                    </div>

                    {pendingExtensions.length === 0 && criticalMaintenance.length === 0 ? (
                        <div className="py-8 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
                            <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-1.5" />
                            <p className="text-xs font-bold text-slate-600">Nihil Eskalasi Perpanjangan & Tiket Kritis</p>
                            <p className="text-[11px] text-slate-400">Tidak ada tiket pemeliharaan tertunda maupun pengajuan perpanjangan waktu.</p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                            {/* Pending Extensions */}
                            {pendingExtensions.map((ext) => (
                                <div key={`ext-${ext.id}`} className="p-3.5 bg-amber-50/50 border border-amber-200/70 rounded-2xl space-y-2 hover:bg-amber-50/80 transition-colors">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="space-y-0.5">
                                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-black uppercase">
                                                Usulan Perpanjangan Tugas
                                            </span>
                                            <h4 className="text-xs font-bold text-slate-900 pt-0.5">{ext.title}</h4>
                                            <p className="text-[11px] text-slate-500">Oleh: <b>{ext.assignee?.name}</b></p>
                                        </div>
                                        <Link 
                                            to="/penugasan"
                                            className="px-2 py-1 rounded-lg bg-amber-600 text-white text-[10px] font-bold hover:bg-amber-700 transition-colors shrink-0 shadow-2xs"
                                        >
                                            Tinjau
                                        </Link>
                                    </div>
                                    <p className="text-xs text-amber-900 bg-white/80 p-2 rounded-xl border border-amber-100 font-medium">
                                        <span className="font-bold">Alasan:</span> {ext.extensionReason || 'Tidak disertakan alasan'}
                                    </p>
                                </div>
                            ))}

                            {/* Critical / Stalled Maintenance */}
                            {criticalMaintenance.map((maint) => (
                                <div key={`maint-${maint.id}`} className="p-3.5 bg-rose-50/40 border border-rose-100 rounded-2xl space-y-2 hover:bg-rose-50/70 transition-colors">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="space-y-0.5 flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                                    maint.urgency === 'EMERGENCY' ? 'bg-red-600 text-white' : 'bg-rose-100 text-rose-800'
                                                }`}>
                                                    {maint.urgency}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-medium">
                                                    Status: {maint.status}
                                                </span>
                                            </div>
                                            <h4 className="text-xs font-bold text-slate-900 pt-0.5 truncate">{maint.title}</h4>
                                            <p className="text-[11px] text-slate-500">
                                                Lokasi: <b>{maint.unit?.name || 'Pondok Pusat'}</b> • Pemohon: {maint.user?.name}
                                            </p>
                                        </div>
                                        <Link 
                                            to="/pemeliharaan"
                                            className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-bold hover:bg-rose-700 transition-colors shrink-0 shadow-2xs"
                                        >
                                            Atensi
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* BLOK D: Armada Kendaraan Perlu Servis / Pengajuan Bengkel */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                <Car size={18} />
                            </span>
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                    Armada Butuh Servis ({overdueVehicleReminders.length + pendingVehicleServices.length})
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium">Pengingat KM/Waktu servis jatuh tempo & pengajuan bengkel</p>
                            </div>
                        </div>
                        <Link 
                            to="/kendaraan"
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                            Monitoring Kendaraan <ChevronRight size={13} />
                        </Link>
                    </div>

                    {overdueVehicleReminders.length === 0 && pendingVehicleServices.length === 0 ? (
                        <div className="py-8 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
                            <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-1.5" />
                            <p className="text-xs font-bold text-slate-600">Armada Prima</p>
                            <p className="text-[11px] text-slate-400">Tidak ada kendaraan yang terlambat servis atau butuh perbaikan darurat.</p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                            {/* Pending Services */}
                            {pendingVehicleServices.map((srv) => (
                                <div key={`srv-${srv.id}`} className="p-3.5 bg-blue-50/40 border border-blue-100 rounded-2xl space-y-1.5 hover:bg-blue-50/70 transition-colors">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5">
                                            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-black uppercase">
                                                Pengajuan Servis Bengkel
                                            </span>
                                            <span className="text-[11px] font-bold text-slate-800">
                                                {srv.vehicle?.name} ({srv.vehicle?.plateNumber})
                                            </span>
                                        </div>
                                        <Link 
                                            to="/kendaraan"
                                            className="px-2 py-1 rounded-lg bg-blue-600 text-white text-[10px] font-bold hover:bg-blue-700 transition-colors shrink-0 shadow-2xs"
                                        >
                                            Setujui
                                        </Link>
                                    </div>
                                    <p className="text-xs font-bold text-slate-800">{srv.description}</p>
                                    <p className="text-[10px] text-slate-400">Pemohon: {srv.requester?.name || 'Driver / Unit'}</p>
                                </div>
                            ))}

                            {/* Overdue Reminders */}
                            {overdueVehicleReminders.map((rem) => (
                                <div key={`rem-${rem.id}`} className="p-3.5 bg-amber-50/40 border border-amber-100 rounded-2xl space-y-1.5 hover:bg-amber-50/70 transition-colors">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5">
                                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-black uppercase">
                                                Jatuh Tempo: {rem.componentName}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-700">
                                                {rem.vehicle?.plateNumber} ({rem.vehicle?.name})
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium">
                                        <span>Target KM: {rem.targetKm ? `${rem.targetKm.toLocaleString('id-ID')} KM` : '-'}</span>
                                        <span>Odometer Saat Ini: {(rem.vehicle?.odometer ?? rem.vehicle?.currentOdometer) !== undefined && (rem.vehicle?.odometer ?? rem.vehicle?.currentOdometer) !== null ? `${(rem.vehicle.odometer ?? rem.vehicle.currentOdometer).toLocaleString('id-ID')} KM` : '-'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* BLOK E: Kendala Lapangan Butuh Arahan Kabid */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4 lg:col-span-2">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                                <AlertCircle size={18} />
                            </span>
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                    Kendala Lapangan Butuh Arahan Kabid ({unresolvedObstacles.length})
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium">Laporan staf yang menandai hambatan teknis tanpa feedback</p>
                            </div>
                        </div>
                        <Link 
                            to="/laporan/monitoring"
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                            Review Laporan <ChevronRight size={13} />
                        </Link>
                    </div>

                    {unresolvedObstacles.length === 0 ? (
                        <div className="py-8 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
                            <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-1.5" />
                            <p className="text-xs font-bold text-slate-600">Nihil Kendala Kritis</p>
                            <p className="text-[11px] text-slate-400">Tidak ada eskalasi kendala yang belum dijawab oleh Kabid.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                            {unresolvedObstacles.map((obs, idx) => (
                                <div key={idx} className="p-3.5 bg-purple-50/40 border border-purple-100 rounded-2xl space-y-2 hover:bg-purple-50/70 transition-colors">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="space-y-0.5 flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-black uppercase">
                                                    {obs.categoryTag}
                                                </span>
                                                <span className="text-[10px] text-slate-500">
                                                    {dayjs(obs.date).format('dddd, DD MMM YYYY')}
                                                </span>
                                            </div>
                                            <p className="text-[11px] font-bold text-slate-700 pt-0.5 truncate">
                                                Staf: <b>{obs.user?.name}</b> ({obs.user?.position})
                                            </p>
                                        </div>
                                        <Link 
                                            to="/laporan/monitoring"
                                            className="px-2 py-1 rounded-lg bg-purple-600 text-white text-[10px] font-bold hover:bg-purple-700 transition-colors shrink-0 shadow-2xs"
                                        >
                                            Beri Arahan
                                        </Link>
                                    </div>

                                    <div className="p-2.5 bg-white rounded-xl border border-purple-200/60 space-y-1">
                                        <p className="text-xs font-medium text-slate-800">
                                            <span className="font-bold text-slate-500">Aktivitas:</span> {obs.activityText}
                                        </p>
                                        <p className="text-xs font-bold text-rose-700">
                                            ⚠️ Kendala: {obs.obstacleNote}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default MbeRadarTab;
