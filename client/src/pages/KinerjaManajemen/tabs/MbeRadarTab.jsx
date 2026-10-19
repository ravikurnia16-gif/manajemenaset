import React from 'react';
import { 
    AlertTriangle, Clock, CheckCircle2, AlertCircle, 
    ArrowRight, MessageCircle, Wrench, Car, UserCheck, 
    ShieldAlert, ExternalLink, Calendar, ChevronRight 
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import { Link } from 'react-router-dom';

dayjs.locale('id');

const MbeRadarTab = ({ radarData, loading, onRefresh }) => {
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
        unresolvedObstacles = []
    } = radarData || {};

    const totalExceptions = 
        overdueAssignments.length + 
        pendingExtensions.length + 
        criticalMaintenance.length + 
        overdueVehicleReminders.length + 
        pendingVehicleServices.length + 
        unresolvedObstacles.length;

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
                                    <span>Terdeteksi {totalExceptions} Hal Kritis yang Memerlukan Perhatian / Keputusan</span>
                                </>
                            )}
                        </h2>
                        <p className="text-xs text-white/90 max-w-2xl leading-relaxed">
                            {totalExceptions === 0
                                ? 'Seluruh penugasan berjalan sesuai batas waktu, tidak ada perbaikan sarana yang macet, dan armada kendaraan dalam kondisi prima.'
                                : 'Sistem menyaring ratusan pekerjaan normal dan otomatis mengangkat hanya tugas yang melewati batas waktu, tiket pemeliharaan tertunda, serta kendala lapangan yang butuh arahan Anda.'}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={onRefresh}
                            className="px-4 py-2 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-xl text-xs font-bold transition-all border border-white/20 cursor-pointer shadow-xs"
                        >
                            🔄 Pindai Ulang Sistem
                        </button>
                    </div>
                </div>

                {/* Exception Stat Counters */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-6 pt-5 border-t border-white/15">
                    <div className="bg-black/15 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
                        <span className="text-[10px] font-bold text-white/75 block">Penugasan Overdue</span>
                        <span className="text-xl font-black text-white">{overdueAssignments.length}</span>
                    </div>
                    <div className="bg-black/15 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
                        <span className="text-[10px] font-bold text-white/75 block">Perbaikan Tertunda</span>
                        <span className="text-xl font-black text-white">{criticalMaintenance.length}</span>
                    </div>
                    <div className="bg-black/15 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
                        <span className="text-[10px] font-bold text-white/75 block">Armada Perlu Servis</span>
                        <span className="text-xl font-black text-white">{overdueVehicleReminders.length + pendingVehicleServices.length}</span>
                    </div>
                    <div className="bg-black/15 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
                        <span className="text-[10px] font-bold text-white/75 block">Kendala Butuh Arahan</span>
                        <span className="text-xl font-black text-white">{unresolvedObstacles.length}</span>
                    </div>
                </div>
            </div>

            {/* 2. Grid Exceptions */}
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
                                <p className="text-[11px] text-slate-400 font-medium">Tugas yang belum tuntas melewati dueDate</p>
                            </div>
                        </div>
                        <Link 
                            to="/laporan/penugasan"
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                            Kelola Penugasan <ChevronRight size={13} />
                        </Link>
                    </div>

                    {overdueAssignments.length === 0 ? (
                        <div className="py-8 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
                            <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-1.5" />
                            <p className="text-xs font-bold text-slate-600">Nihil Tugas Terlambat</p>
                            <p className="text-[11px] text-slate-400">Seluruh staf menyelesaikan tugas sesuai jadwal.</p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                            {overdueAssignments.map((task) => {
                                const daysOverdue = Math.max(1, dayjs().diff(dayjs(task.dueDate), 'day'));
                                const cleanPhone = (task.assignee?.phone || '').replace(/[^0-9]/g, '');
                                const waUrl = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone}?text=${encodeURIComponent(`Halo ${task.assignee?.name}, terkait penugasan "${task.title}" yang melewati batas waktu...`)}` : null;

                                return (
                                    <div key={task.id} className="p-3.5 bg-rose-50/40 border border-rose-100 rounded-2xl space-y-2 hover:bg-rose-50/70 transition-colors">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="space-y-0.5 flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-black uppercase">
                                                        Terlambat {daysOverdue} Hari
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 text-[10px] font-bold">
                                                        {task.category || 'UMUM'}
                                                    </span>
                                                </div>
                                                <h4 className="text-xs font-black text-slate-800 truncate pt-1">{task.title}</h4>
                                                <p className="text-[11px] text-slate-500 font-medium">
                                                    PJ: <b>{task.assignee?.name}</b> ({task.assignee?.position || 'Staff'})
                                                </p>
                                            </div>
                                            {waUrl && (
                                                <a 
                                                    href={waUrl} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors shrink-0"
                                                    title="Hubungi Penanggung Jawab via WhatsApp"
                                                >
                                                    <MessageCircle size={15} />
                                                </a>
                                            )}
                                        </div>

                                        <div className="space-y-1 pt-1">
                                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-600">
                                                <span>Progres Saat Ini</span>
                                                <span>{task.progressPercentage || 0}%</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-rose-500 rounded-full" 
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

                {/* BLOK B: Pemeliharaan Tertunda / Darurat (Critical Maintenance) */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                                <Wrench size={18} />
                            </span>
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                    Pemeliharaan Butuh Respon ({criticalMaintenance.length})
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium">Tiket darurat atau belum direspon &gt; 24 jam</p>
                            </div>
                        </div>
                        <Link 
                            to="/pemeliharaan"
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                            Semua Tiket <ChevronRight size={13} />
                        </Link>
                    </div>

                    {criticalMaintenance.length === 0 ? (
                        <div className="py-8 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
                            <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-1.5" />
                            <p className="text-xs font-bold text-slate-600">Semua Tiket Terkendali</p>
                            <p className="text-[11px] text-slate-400">Tidak ada tiket perbaikan sarana yang macet atau terlantar.</p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                            {criticalMaintenance.map((m) => (
                                <div key={m.id} className="p-3.5 bg-amber-50/40 border border-amber-100 rounded-2xl space-y-2 hover:bg-amber-50/70 transition-colors">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="space-y-0.5 flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                                    m.urgency === 'EMERGENCY' ? 'bg-rose-600 text-white animate-pulse' :
                                                    m.urgency === 'URGENT' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700'
                                                }`}>
                                                    {m.urgency}
                                                </span>
                                                <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 text-[10px] font-bold">
                                                    {m.code || `MT-${m.id}`}
                                                </span>
                                                <span className="text-[10px] text-slate-400">
                                                    Masuk: {dayjs(m.createdAt).format('DD/MM HH:mm')}
                                                </span>
                                            </div>
                                            <h4 className="text-xs font-black text-slate-800 truncate pt-1">{m.title}</h4>
                                            <p className="text-[11px] text-slate-500 font-medium">
                                                Unit: <b>{m.unit?.name || 'Umum'}</b> {m.location ? `• ${m.location}` : ''}
                                            </p>
                                        </div>
                                        <Link 
                                            to={`/pemeliharaan/${m.id}`}
                                            className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 transition-colors shrink-0 shadow-2xs"
                                            title="Buka Tiket Perbaikan"
                                        >
                                            <ExternalLink size={14} />
                                        </Link>
                                    </div>
                                    {m.description && (
                                        <p className="text-[11px] text-slate-600 italic bg-white/70 p-2 rounded-xl border border-amber-200/50 line-clamp-2">
                                            "{m.description}"
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* BLOK C: Armada Kendaraan Jatuh Tempo Servis */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                <Car size={18} />
                            </span>
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                    Servis Armada Jatuh Tempo ({overdueVehicleReminders.length + pendingVehicleServices.length})
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium">Peringatan ganti oli, servis berkala, atau pengajuan bengkel</p>
                            </div>
                        </div>
                        <Link 
                            to="/kendaraan/pemeliharaan"
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                            Modul Kendaraan <ChevronRight size={13} />
                        </Link>
                    </div>

                    {(overdueVehicleReminders.length === 0 && pendingVehicleServices.length === 0) ? (
                        <div className="py-8 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
                            <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-1.5" />
                            <p className="text-xs font-bold text-slate-600">Seluruh Armada Prima</p>
                            <p className="text-[11px] text-slate-400">Tidak ada mobil/motor dinas yang melewati jadwal servis rutin.</p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                            {/* Pending Service Requests */}
                            {pendingVehicleServices.map((srv) => (
                                <div key={`srv-${srv.id}`} className="p-3.5 bg-indigo-50/40 border border-indigo-100 rounded-2xl space-y-1.5 hover:bg-indigo-50/70 transition-colors">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5">
                                            <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase">
                                                Pengajuan Bengkel Menunggu Approval
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-700">
                                                {srv.vehicle?.plateNumber} ({srv.vehicle?.name})
                                            </span>
                                        </div>
                                        <Link 
                                            to="/kendaraan/pemeliharaan"
                                            className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-0.5"
                                        >
                                            Proses <ArrowRight size={11} />
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
                                        <span>Odometer Saat Ini: {rem.vehicle?.currentOdometer ? `${rem.vehicle.currentOdometer.toLocaleString('id-ID')} KM` : '-'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* BLOK D: Kendala Lapangan Butuh Arahan Kabid */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                                <AlertCircle size={18} />
                            </span>
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                    Kendala Lapangan Butuh Arahan ({unresolvedObstacles.length})
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
                        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
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
