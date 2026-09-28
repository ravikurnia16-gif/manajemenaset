import React, { useMemo } from 'react';
import { 
    Search, Filter, Clock, CheckCircle, CheckCircle2, AlertTriangle, 
    AlertCircle, MessageSquare, Save, X, BellRing, Loader2, Camera,
    User, Calendar, ChevronRight, MessageCircle, Send, Sparkles, Phone
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import { getMediaUrl } from '../../../lib/media';
import { DIVISION_TAGS } from '../constants';

dayjs.locale('id');

const TeamMonitoringTab = ({
    reportsFeed = [],
    setReportsFeed,
    fetchReportsFeed,
    monitoringPreset = 'TODAY',
    setMonitoringPreset,
    monitoringStartDate,
    setMonitoringStartDate,
    monitoringEndDate,
    setMonitoringEndDate,
    selectedStaffId = '',
    setSelectedStaffId,
    staffList = [],
    searchQuery,
    setSearchQuery,
    filterStatus,
    setFilterStatus,
    filterCategory,
    setFilterCategory,
    handleRemindStaff,
    remindingStaff,
    setLightboxPhoto,
    isKabid,
    // Point review
    activePointReview,
    setActivePointReview,
    pointReviewForm,
    setPointReviewForm,
    savingPointReview,
    openPointReviewForm,
    handleSavePointReview,
    handleDeletePointReview,
    // Verification
    verifyingReportId,
    setVerifyingReportId,
    verificationForm,
    setVerificationForm,
    handleVerifyReport
}) => {
    // Preset handler
    const applyDatePreset = (preset) => {
        setMonitoringPreset(preset);
        const now = dayjs();
        if (preset === 'TODAY') {
            const todayStr = now.format('YYYY-MM-DD');
            setMonitoringStartDate(todayStr);
            setMonitoringEndDate(todayStr);
        } else if (preset === 'LAST_7_DAYS') {
            setMonitoringStartDate(now.subtract(6, 'day').format('YYYY-MM-DD'));
            setMonitoringEndDate(now.format('YYYY-MM-DD'));
        } else if (preset === 'THIS_WEEK') {
            setMonitoringStartDate(now.startOf('week').add(1, 'day').format('YYYY-MM-DD'));
            setMonitoringEndDate(now.format('YYYY-MM-DD'));
        } else if (preset === 'THIS_MONTH') {
            setMonitoringStartDate(now.startOf('month').format('YYYY-MM-DD'));
            setMonitoringEndDate(now.format('YYYY-MM-DD'));
        }
    };

    // Calculate aggregated metrics for the current feed
    const feedMetrics = useMemo(() => {
        let totalActivities = 0;
        let totalObstacles = 0;
        let totalPhotos = 0;

        reportsFeed.forEach(r => {
            const pts = r.metadata?.manualPoints;
            const morning = pts?.morning || pts?.morningPoints || [];
            const afternoon = pts?.afternoon || pts?.afternoonPoints || [];
            const allPts = [...morning, ...afternoon];
            
            totalActivities += allPts.length;
            totalObstacles += allPts.filter(p => p.status === 'OBSTACLE' || p.obstacleNote).length;
            allPts.forEach(p => {
                totalPhotos += (p.photos || []).length;
            });
        });

        return {
            totalReports: reportsFeed.length,
            totalActivities,
            totalObstacles,
            totalPhotos
        };
    }, [reportsFeed]);

    const isMultiDay = monitoringStartDate !== monitoringEndDate;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* 1. DATE RANGE & TIMELINE TOOLBAR (Fitur Baru) */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                <Calendar size={18} />
                            </span>
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                    Rentang Tanggal & Timeline Aktivitas Staf
                                </h3>
                                <p className="text-xs text-slate-400 font-medium">
                                    Pantau kronologi laporan staf secara harian atau mingguan.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Presets and Custom Inputs */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
                            <button
                                type="button"
                                onClick={() => applyDatePreset('TODAY')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    monitoringPreset === 'TODAY' 
                                        ? 'bg-blue-600 text-white shadow-xs' 
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Hari Ini
                            </button>
                            <button
                                type="button"
                                onClick={() => applyDatePreset('LAST_7_DAYS')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    monitoringPreset === 'LAST_7_DAYS' 
                                        ? 'bg-blue-600 text-white shadow-xs' 
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                7 Hari
                            </button>
                            <button
                                type="button"
                                onClick={() => applyDatePreset('THIS_WEEK')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    monitoringPreset === 'THIS_WEEK' 
                                        ? 'bg-blue-600 text-white shadow-xs' 
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Pekan Ini
                            </button>
                            <button
                                type="button"
                                onClick={() => applyDatePreset('THIS_MONTH')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    monitoringPreset === 'THIS_MONTH' 
                                        ? 'bg-blue-600 text-white shadow-xs' 
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Bulan Ini
                            </button>
                            <button
                                type="button"
                                onClick={() => setMonitoringPreset('CUSTOM')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    monitoringPreset === 'CUSTOM' 
                                        ? 'bg-blue-600 text-white shadow-xs' 
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Kustom
                            </button>
                        </div>

                        {/* Date Inputs */}
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-2xl text-xs font-bold text-slate-700">
                            <span className="text-slate-400">Dari</span>
                            <input 
                                type="date" 
                                value={monitoringStartDate}
                                onChange={(e) => {
                                    setMonitoringStartDate(e.target.value);
                                    setMonitoringPreset('CUSTOM');
                                }}
                                className="bg-transparent outline-none cursor-pointer text-slate-800"
                            />
                            <span className="text-slate-400">s.d.</span>
                            <input 
                                type="date" 
                                value={monitoringEndDate}
                                onChange={(e) => {
                                    setMonitoringEndDate(e.target.value);
                                    setMonitoringPreset('CUSTOM');
                                }}
                                className="bg-transparent outline-none cursor-pointer text-slate-800"
                            />
                        </div>
                    </div>
                </div>

                {/* Second row: Staff Dropdown, Universal Search, Status & Remind */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 pt-1 border-t border-slate-100">
                    {/* Staff Selector Dropdown */}
                    <div className="md:col-span-3">
                        <select
                            value={selectedStaffId}
                            onChange={(e) => setSelectedStaffId(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 truncate"
                        >
                            <option value="">Semua Staf ({staffList.length})</option>
                            {staffList.map(st => (
                                <option key={st.id} value={st.id}>
                                    {st.name} ({st.position || 'Staff'})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Universal Search */}
                    <div className="md:col-span-5 relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                        <input 
                            type="text"
                            placeholder="Cari aktivitas, kata kunci kendala, atau staf..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && fetchReportsFeed()}
                            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Status Filter */}
                    <div className="md:col-span-4 flex items-center justify-between gap-1.5 flex-wrap sm:flex-nowrap">
                        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl shrink-0">
                            {['ALL', 'LENGKAP', 'PARSIAL', 'BELUM'].map(st => (
                                <button
                                    key={st}
                                    type="button"
                                    onClick={() => setFilterStatus(st)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                                        filterStatus === st ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    {st === 'ALL' ? 'Semua' : st}
                                </button>
                            ))}
                        </div>

                        {/* Remind Button */}
                        <button
                            type="button"
                            disabled={remindingStaff}
                            onClick={() => handleRemindStaff(null)}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-900 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
                            title="Kirim pengingat WhatsApp ke staf yang belum melengkapi laporan hari ini"
                        >
                            {remindingStaff ? <Loader2 size={13} className="animate-spin" /> : <BellRing size={13} />}
                            <span className="hidden sm:inline">Ingatkan Staf</span>
                        </button>
                    </div>
                </div>

                {/* Third row: Division Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar pt-1">
                    <button
                        onClick={() => setFilterCategory('ALL')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                            filterCategory === 'ALL' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        Semua Divisi
                    </button>
                    {DIVISION_TAGS.map(div => {
                        const Icon = div.icon;
                        return (
                            <button
                                key={div.key}
                                onClick={() => setFilterCategory(div.key)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                                    filterCategory === div.key ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                <Icon size={13} /> {div.label}
                            </button>
                        );
                    })}
                </div>

                {/* Fourth row: Fast Summary Strip for selected filter */}
                <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-3">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">
                            {isMultiDay ? (
                                <>Rentang: <span className="text-blue-600">{dayjs(monitoringStartDate).format('DD MMM YYYY')} s.d. {dayjs(monitoringEndDate).format('DD MMM YYYY')}</span></>
                            ) : (
                                <>Tanggal: <span className="text-blue-600">{dayjs(monitoringStartDate).format('dddd, DD MMMM YYYY')}</span></>
                            )}
                        </span>
                        {selectedStaffId && (
                            <span className="bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-md text-[10px]">
                                Filter Staf Aktif
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-4 text-[11px] font-bold">
                        <span>Total: <b className="text-slate-800">{feedMetrics.totalReports} Laporan</b></span>
                        <span className="text-emerald-700">Aktivitas: <b>{feedMetrics.totalActivities} Butir</b></span>
                        {feedMetrics.totalObstacles > 0 && (
                            <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                                ⚠️ {feedMetrics.totalObstacles} Kendala
                            </span>
                        )}
                        <span className="text-violet-700">Foto: <b>{feedMetrics.totalPhotos}</b></span>
                    </div>
                </div>
            </div>

            {/* 2. TIMELINE FEED LIST CARDS */}
            {reportsFeed.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400 italic text-sm space-y-2">
                    <Calendar size={36} className="mx-auto text-slate-300" />
                    <p>Tidak ada laporan kegiatan yang sesuai dengan filter rentang tanggal atau kata kunci ini.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {reportsFeed.map(report => {
                        const pts = report.metadata?.manualPoints;
                        const morning = pts?.morning || pts?.morningPoints || [];
                        const afternoon = pts?.afternoon || pts?.afternoonPoints || [];
                        const verification = report.metadata?.verification;
                        const reportDateStr = report.targetDate || report.date || report.createdAt;
                        const cleanPhone = (report.user?.phone || '').replace(/[^0-9]/g, '');
                        const waUrl = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone}?text=${encodeURIComponent(`Halo ${report.user?.name}, terkait laporan kerja tanggal ${dayjs(reportDateStr).format('DD/MM/YYYY')}...`)}` : null;

                        return (
                            <div key={report.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-4">
                                <div className="space-y-4">
                                    {/* Header Card with Date Badge & WA follow up */}
                                    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                                        <div className="space-y-1">
                                            {/* Date Badge in Multi-Day Mode */}
                                            {isMultiDay && (
                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-wider mb-0.5">
                                                    <Calendar size={11} /> {dayjs(reportDateStr).format('dddd, DD MMMM YYYY')}
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-base font-black text-slate-800 leading-tight">
                                                    {report.user?.name}
                                                </h3>
                                                {waUrl && (
                                                    <a 
                                                        href={waUrl} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="p-1 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors shadow-2xs"
                                                        title={`Hubungi ${report.user?.name} via WhatsApp`}
                                                    >
                                                        <MessageCircle size={14} />
                                                    </a>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-400 font-bold uppercase">{report.user?.position}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-black flex items-center gap-1">
                                                <Clock size={10} /> Submit: {dayjs(report.metadata?.lastSubmittedAt || report.updatedAt).format('HH:mm')} WIB
                                            </span>
                                            {verification && (
                                                <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase ${
                                                    verification.status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                    {verification.status === 'VERIFIED' ? 'Terverifikasi ✅' : 'Perlu Dilengkapi ⚠️'}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Sesi Pagi */}
                                    <div>
                                        <h4 className="text-[11px] font-black text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                            <Clock size={12} /> Sesi Pagi (07.15 - 12.00)
                                        </h4>
                                        {morning.length === 0 ? (
                                            <span className="text-xs text-slate-400 italic block pl-2">- Belum ada butir kegiatan -</span>
                                        ) : (
                                            <div className="space-y-3">
                                                {morning.map((p, idx) => (
                                                    <div key={idx} className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100 space-y-2">
                                                        <div className="flex items-start gap-2">
                                                            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[9px] font-black uppercase text-slate-600">
                                                                        {p.categoryTag || 'UMUM'}
                                                                    </span>
                                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                                                        p.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                                                                        p.status === 'OBSTACLE' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                                                                    }`}>
                                                                        {p.status === 'COMPLETED' ? 'Selesai 100%' : p.status === 'OBSTACLE' ? 'Kendala' : 'Dalam Proses'}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-slate-700 font-medium leading-relaxed">{p.text}</p>
                                                                {p.obstacleNote && (
                                                                    <div className="mt-1.5 p-2 bg-rose-50 border border-rose-100 rounded-xl text-[11px] text-rose-800 font-bold">
                                                                        ⚠️ Kendala: {p.obstacleNote}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Photos */}
                                                        {p.photos && p.photos.length > 0 && (
                                                            <div className="flex gap-2 pt-1 overflow-x-auto pl-7">
                                                                {p.photos.map((ph, pIdx) => (
                                                                    <img 
                                                                        key={pIdx} 
                                                                        src={getMediaUrl(ph.url || ph)} 
                                                                        alt="Bukti foto"
                                                                        onClick={() => setLightboxPhoto(getMediaUrl(ph.url || ph))}
                                                                        className="w-16 h-16 rounded-xl object-cover border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity shrink-0" 
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Display Existing Review */}
                                                        {p.review && (
                                                            <div className={`mt-2 p-2.5 rounded-xl border text-xs space-y-1 ${
                                                                p.review.status === 'APPROVED' ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900' :
                                                                p.review.status === 'REVISION' ? 'bg-amber-50/90 border-amber-200 text-amber-900' :
                                                                'bg-blue-50/90 border-blue-200 text-blue-900'
                                                            }`}>
                                                                <div className="flex items-center justify-between gap-1">
                                                                    <span className="font-bold flex items-center gap-1.5 text-[11px]">
                                                                        {p.review.status === 'APPROVED' ? '✅ Disetujui' :
                                                                         p.review.status === 'REVISION' ? '⚠️ Perlu Perbaikan' : '💡 Catatan Arahan'}
                                                                        <span className="text-[10px] opacity-75 font-normal">
                                                                            oleh {p.review.reviewerName || 'Kabid'} • {dayjs(p.review.reviewedAt).format('HH:mm')}
                                                                        </span>
                                                                    </span>
                                                                    {isKabid && (
                                                                        <button 
                                                                            type="button"
                                                                            onClick={() => openPointReviewForm(report.id, 'morning', idx, p.review)}
                                                                            className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                                                                        >
                                                                            Ubah
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                {p.review.feedbackNote && (
                                                                    <p className="text-xs font-semibold italic pl-1 leading-snug">
                                                                        "{p.review.feedbackNote}"
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Inline Review Form (Khusus Kabid saat aktif) */}
                                                        {isKabid && activePointReview?.reportId === report.id && activePointReview?.period === 'morning' && activePointReview?.pointIndex === idx && (
                                                            <div className="mt-2.5 p-3.5 bg-blue-50/70 rounded-2xl border border-blue-200 space-y-2.5">
                                                                <div className="flex items-center justify-between">
                                                                    <h5 className="text-[11px] font-black text-blue-950 uppercase flex items-center gap-1">
                                                                        <MessageSquare size={13} className="text-blue-600" /> Ulas Butir #{idx + 1} (Sesi Pagi)
                                                                    </h5>
                                                                    <button type="button" onClick={() => setActivePointReview(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={14} /></button>
                                                                </div>

                                                                {/* Status Selection Buttons */}
                                                                <div className="grid grid-cols-3 gap-1.5">
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={() => setPointReviewForm(prev => ({ ...prev, status: 'APPROVED' }))}
                                                                        className={`py-1.5 px-1 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                                                                            pointReviewForm.status === 'APPROVED' 
                                                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' 
                                                                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                                                        }`}
                                                                    >
                                                                        ✅ Sesuai
                                                                    </button>
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={() => setPointReviewForm(prev => ({ ...prev, status: 'REVISION' }))}
                                                                        className={`py-1.5 px-1 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                                                                            pointReviewForm.status === 'REVISION' 
                                                                                ? 'bg-amber-500 text-white border-amber-500 shadow-xs' 
                                                                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                                                        }`}
                                                                    >
                                                                        ⚠️ Revisi
                                                                    </button>
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={() => setPointReviewForm(prev => ({ ...prev, status: 'NOTE' }))}
                                                                        className={`py-1.5 px-1 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                                                                            pointReviewForm.status === 'NOTE' 
                                                                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                                                                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                                                        }`}
                                                                    >
                                                                        💡 Catatan
                                                                    </button>
                                                                </div>

                                                                <textarea 
                                                                    rows="2" 
                                                                    placeholder="Tulis ulasan, arahan, atau catatan perbaikan untuk staf..."
                                                                    value={pointReviewForm.feedbackNote}
                                                                    onChange={(e) => setPointReviewForm(prev => ({ ...prev, feedbackNote: e.target.value }))}
                                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
                                                                />

                                                                <div className="flex items-center gap-2 pt-0.5">
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => handleSavePointReview(report.id, 'morning', idx)}
                                                                        disabled={savingPointReview}
                                                                        className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                                                                    >
                                                                        {savingPointReview ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                                                        <span>Kirim Ulasan</span>
                                                                    </button>
                                                                    {p.review && (
                                                                        <button 
                                                                            type="button"
                                                                            onClick={() => handleDeletePointReview(report.id, 'morning', idx)}
                                                                            disabled={savingPointReview}
                                                                            className="py-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-xl border border-rose-200 transition-all cursor-pointer"
                                                                            title="Hapus ulasan butir ini"
                                                                        >
                                                                            Hapus
                                                                        </button>
                                                                    )}
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => setActivePointReview(null)}
                                                                        className="py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-xl border border-slate-200 transition-all cursor-pointer"
                                                                    >
                                                                        Batal
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Tombol Ulas Butir Ini jika belum diulas */}
                                                        {isKabid && !p.review && !(activePointReview?.reportId === report.id && activePointReview?.period === 'morning' && activePointReview?.pointIndex === idx) && (
                                                            <div className="flex justify-end pt-0.5">
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => openPointReviewForm(report.id, 'morning', idx, null)}
                                                                    className="px-2.5 py-1 bg-white hover:bg-blue-50 hover:text-blue-600 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95"
                                                                >
                                                                    <MessageSquare size={11} /> Ulas Butir Ini
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Sesi Siang */}
                                    <div>
                                        <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                            <Clock size={12} /> Sesi Siang (13.00 - 16.15)
                                        </h4>
                                        {afternoon.length === 0 ? (
                                            <span className="text-xs text-slate-400 italic block pl-2">- Belum ada butir kegiatan -</span>
                                        ) : (
                                            <div className="space-y-3">
                                                {afternoon.map((p, idx) => (
                                                    <div key={idx} className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100 space-y-2">
                                                        <div className="flex items-start gap-2">
                                                            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[9px] font-black uppercase text-slate-600">
                                                                        {p.categoryTag || 'UMUM'}
                                                                    </span>
                                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                                                        p.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                                                                        p.status === 'OBSTACLE' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                                                                    }`}>
                                                                        {p.status === 'COMPLETED' ? 'Selesai 100%' : p.status === 'OBSTACLE' ? 'Kendala' : 'Dalam Proses'}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-slate-700 font-medium leading-relaxed">{p.text}</p>
                                                                {p.obstacleNote && (
                                                                    <div className="mt-1.5 p-2 bg-rose-50 border border-rose-100 rounded-xl text-[11px] text-rose-800 font-bold">
                                                                        ⚠️ Kendala: {p.obstacleNote}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Photos */}
                                                        {p.photos && p.photos.length > 0 && (
                                                            <div className="flex gap-2 pt-1 overflow-x-auto pl-7">
                                                                {p.photos.map((ph, pIdx) => (
                                                                    <img 
                                                                        key={pIdx} 
                                                                        src={getMediaUrl(ph.url || ph)} 
                                                                        alt="Bukti foto"
                                                                        onClick={() => setLightboxPhoto(getMediaUrl(ph.url || ph))}
                                                                        className="w-16 h-16 rounded-xl object-cover border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity shrink-0" 
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Display Existing Review */}
                                                        {p.review && (
                                                            <div className={`mt-2 p-2.5 rounded-xl border text-xs space-y-1 ${
                                                                p.review.status === 'APPROVED' ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900' :
                                                                p.review.status === 'REVISION' ? 'bg-amber-50/90 border-amber-200 text-amber-900' :
                                                                'bg-blue-50/90 border-blue-200 text-blue-900'
                                                            }`}>
                                                                <div className="flex items-center justify-between gap-1">
                                                                    <span className="font-bold flex items-center gap-1.5 text-[11px]">
                                                                        {p.review.status === 'APPROVED' ? '✅ Disetujui' :
                                                                         p.review.status === 'REVISION' ? '⚠️ Perlu Perbaikan' : '💡 Catatan Arahan'}
                                                                        <span className="text-[10px] opacity-75 font-normal">
                                                                            oleh {p.review.reviewerName || 'Kabid'} • {dayjs(p.review.reviewedAt).format('HH:mm')}
                                                                        </span>
                                                                    </span>
                                                                    {isKabid && (
                                                                        <button 
                                                                            type="button"
                                                                            onClick={() => openPointReviewForm(report.id, 'afternoon', idx, p.review)}
                                                                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                                                                        >
                                                                            Ubah
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                {p.review.feedbackNote && (
                                                                    <p className="text-xs font-semibold italic pl-1 leading-snug">
                                                                        "{p.review.feedbackNote}"
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Inline Review Form (Khusus Kabid saat aktif) */}
                                                        {isKabid && activePointReview?.reportId === report.id && activePointReview?.period === 'afternoon' && activePointReview?.pointIndex === idx && (
                                                            <div className="mt-2.5 p-3.5 bg-indigo-50/70 rounded-2xl border border-indigo-200 space-y-2.5">
                                                                <div className="flex items-center justify-between">
                                                                    <h5 className="text-[11px] font-black text-indigo-950 uppercase flex items-center gap-1">
                                                                        <MessageSquare size={13} className="text-indigo-600" /> Ulas Butir #{idx + 1} (Sesi Siang)
                                                                    </h5>
                                                                    <button type="button" onClick={() => setActivePointReview(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={14} /></button>
                                                                </div>

                                                                {/* Status Selection Buttons */}
                                                                <div className="grid grid-cols-3 gap-1.5">
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={() => setPointReviewForm(prev => ({ ...prev, status: 'APPROVED' }))}
                                                                        className={`py-1.5 px-1 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                                                                            pointReviewForm.status === 'APPROVED' 
                                                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' 
                                                                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                                                        }`}
                                                                    >
                                                                        ✅ Sesuai
                                                                    </button>
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={() => setPointReviewForm(prev => ({ ...prev, status: 'REVISION' }))}
                                                                        className={`py-1.5 px-1 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                                                                            pointReviewForm.status === 'REVISION' 
                                                                                ? 'bg-amber-500 text-white border-amber-500 shadow-xs' 
                                                                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                                                        }`}
                                                                    >
                                                                        ⚠️ Revisi
                                                                    </button>
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={() => setPointReviewForm(prev => ({ ...prev, status: 'NOTE' }))}
                                                                        className={`py-1.5 px-1 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                                                                            pointReviewForm.status === 'NOTE' 
                                                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                                                                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                                                        }`}
                                                                    >
                                                                        💡 Catatan
                                                                    </button>
                                                                </div>

                                                                <textarea 
                                                                    rows="2" 
                                                                    placeholder="Tulis ulasan, arahan, atau catatan perbaikan untuk staf..."
                                                                    value={pointReviewForm.feedbackNote}
                                                                    onChange={(e) => setPointReviewForm(prev => ({ ...prev, feedbackNote: e.target.value }))}
                                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
                                                                />

                                                                <div className="flex items-center gap-2 pt-0.5">
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => handleSavePointReview(report.id, 'afternoon', idx)}
                                                                        disabled={savingPointReview}
                                                                        className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                                                                    >
                                                                        {savingPointReview ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                                                        <span>Kirim Ulasan</span>
                                                                    </button>
                                                                    {p.review && (
                                                                        <button 
                                                                            type="button"
                                                                            onClick={() => handleDeletePointReview(report.id, 'afternoon', idx)}
                                                                            disabled={savingPointReview}
                                                                            className="py-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-xl border border-rose-200 transition-all cursor-pointer"
                                                                            title="Hapus ulasan butir ini"
                                                                        >
                                                                            Hapus
                                                                        </button>
                                                                    )}
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => setActivePointReview(null)}
                                                                        className="py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-xl border border-slate-200 transition-all cursor-pointer"
                                                                    >
                                                                        Batal
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Tombol Ulas Butir Ini jika belum diulas */}
                                                        {isKabid && !p.review && !(activePointReview?.reportId === report.id && activePointReview?.period === 'afternoon' && activePointReview?.pointIndex === idx) && (
                                                            <div className="flex justify-end pt-0.5">
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => openPointReviewForm(report.id, 'afternoon', idx, null)}
                                                                    className="px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95"
                                                                >
                                                                    <MessageSquare size={11} /> Ulas Butir Ini
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Verification / Feedback Form for Kabid */}
                                <div className="pt-4 border-t border-slate-100">
                                    {verifyingReportId === report.id ? (
                                        <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-black text-blue-900 uppercase">Verifikasi & Beri Arahan</h4>
                                                <button onClick={() => setVerifyingReportId(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
                                            </div>
                                            <div className="flex gap-2">
                                                <button 
                                                    type="button" 
                                                    onClick={() => setVerificationForm({ ...verificationForm, status: 'VERIFIED' })}
                                                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${verificationForm.status === 'VERIFIED' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}
                                                >
                                                    ✅ Terverifikasi Lengkap
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={() => setVerificationForm({ ...verificationForm, status: 'NEEDS_REVISION' })}
                                                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${verificationForm.status === 'NEEDS_REVISION' ? 'bg-amber-500 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}
                                                >
                                                    ⚠️ Perlu Dilengkapi
                                                </button>
                                            </div>
                                            <textarea 
                                                rows="2" 
                                                placeholder="Tuliskan catatan atau arahan pimpinan untuk staf..."
                                                value={verificationForm.feedbackNote}
                                                onChange={(e) => setVerificationForm({ ...verificationForm, feedbackNote: e.target.value })}
                                                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <button 
                                                onClick={() => handleVerifyReport(report.id)}
                                                className="w-full py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                                            >
                                                <Save size={14} /> Simpan Verifikasi & Feedback
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            {verification?.feedbackNote ? (
                                                <div className="text-xs text-slate-600 font-medium">
                                                    <span className="font-bold text-blue-600">Arahan Kabid:</span> "{verification.feedbackNote}"
                                                </div>
                                            ) : (
                                                <span className="text-[11px] text-slate-400 italic">Belum ada arahan</span>
                                            )}
                                            <button 
                                                onClick={() => {
                                                    setVerifyingReportId(report.id);
                                                    setVerificationForm({
                                                        status: verification?.status || 'VERIFIED',
                                                        feedbackNote: verification?.feedbackNote || ''
                                                    });
                                                }}
                                                className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
                                            >
                                                <MessageSquare size={13} /> {verification ? 'Ubah Verifikasi' : 'Verifikasi / Beri Arahan'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default TeamMonitoringTab;
