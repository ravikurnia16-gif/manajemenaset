import React, { useState, useMemo } from 'react';
import { 
    Calendar, CheckCircle2, Clock, AlertTriangle, 
    Layers, ChevronLeft, ChevronRight, Eye, Wrench, 
    FileText, User, Camera, Sparkles, Filter, RotateCw 
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import { getMediaUrl } from '../../../lib/media';

dayjs.locale('id');

// Helper to safely render text without throwing "Objects are not valid as a React child"
const renderSafeText = (val, fallback = '') => {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'string' || typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? 'Ya' : 'Tidak';
    if (typeof val === 'object') {
        if (typeof val.text === 'string') return val.text;
        if (typeof val.note === 'string') return val.note;
        if (typeof val.title === 'string') return val.title;
        if (typeof val.output === 'string') return val.output;
        if (typeof val.name === 'string') return val.name;
        if (typeof val.label === 'string') return val.label;
        try {
            return JSON.stringify(val);
        } catch {
            return fallback;
        }
    }
    return String(val);
};

// Helper to resolve media URL safely from string or object
const getPhotoSrc = (ph) => {
    if (!ph) return null;
    let raw = null;
    if (typeof ph === 'string') {
        raw = ph;
    } else if (typeof ph === 'object') {
        raw = ph.url || ph.path || ph.uri || null;
    }
    return raw ? getMediaUrl(raw) : null;
};

// Helper to extract staff display name safely
const getStaffDisplayName = (user, fallback = 'Staf') => {
    if (!user) return fallback;
    if (typeof user === 'string') return user;
    if (typeof user === 'object') {
        return user.name || user.fullName || user.username || fallback;
    }
    return fallback;
};

// Helper to extract photos array safely from item
const extractSafePhotos = (photos) => {
    if (!photos) return [];
    if (Array.isArray(photos)) {
        return photos.map(getPhotoSrc).filter(Boolean);
    }
    if (typeof photos === 'string') {
        try {
            const parsed = JSON.parse(photos);
            if (Array.isArray(parsed)) {
                return parsed.map(getPhotoSrc).filter(Boolean);
            }
        } catch {
            const resolved = getPhotoSrc(photos);
            return resolved ? [resolved] : [];
        }
    }
    return [];
};

const DailyPppTab = ({ 
    selectedDate = dayjs().format('YYYY-MM-DD'), 
    setSelectedDate = () => {}, 
    pppData = null, 
    loading = false, 
    staffList = [],
    onRefresh = () => {},
    setLightboxPhoto = () => {}
}) => {
    const [filterStaff, setFilterStaff] = useState('ALL');
    const [filterWorkType, setFilterWorkType] = useState('ALL'); // ALL, PLANNED, INCIDENTAL

    // Safe extraction of summary and ppp collections
    const summary = pppData?.summary || {};
    const ppp = pppData?.ppp || {};
    const progress = Array.isArray(ppp.progress) ? ppp.progress : [];
    const plans = Array.isArray(ppp.plans) ? ppp.plans : [];
    const problems = Array.isArray(ppp.problems) ? ppp.problems : [];

    // Safe available staff computation
    const availableStaff = useMemo(() => {
        if (Array.isArray(staffList) && staffList.length > 0) {
            return staffList.filter(Boolean);
        }
        const map = new Map();
        [...progress, ...plans, ...problems].forEach(it => {
            if (!it || !it.user) return;
            const u = it.user;
            const uId = u.id || it.userId || (typeof u === 'string' ? u : u.name);
            const uName = getStaffDisplayName(u, 'Staf');
            if (uId && !map.has(String(uId))) {
                map.set(String(uId), { 
                    id: String(uId), 
                    name: uName, 
                    position: typeof u === 'object' && u.position ? u.position : 'Staff' 
                });
            }
        });
        return Array.from(map.values());
    }, [staffList, progress, plans, problems]);

    // Safe filtering logic
    const filterItem = (item) => {
        if (!item || typeof item !== 'object') return false;

        if (filterStaff !== 'ALL') {
            const target = String(filterStaff).toLowerCase().trim();
            const uId = item.userId ? String(item.userId).toLowerCase().trim() : null;
            const uObjId = item.user?.id ? String(item.user.id).toLowerCase().trim() : null;
            const uName = getStaffDisplayName(item.user, '').toLowerCase().trim();

            const isMatch = (uId && uId === target) || 
                            (uObjId && uObjId === target) || 
                            (uName && uName === target);

            if (!isMatch) return false;
        }

        if (filterWorkType === 'PLANNED' && !item.isPlanned) return false;
        if (filterWorkType === 'INCIDENTAL' && item.isPlanned) return false;
        return true;
    };

    const filteredProgress = useMemo(() => progress.filter(filterItem), [progress, filterStaff, filterWorkType]);
    const filteredPlans = useMemo(() => plans.filter(filterItem), [plans, filterStaff, filterWorkType]);
    const filteredProblems = useMemo(() => problems.filter(filterItem), [problems, filterStaff, filterWorkType]);

    // Safe metric ratios calculation
    const isFiltered = filterStaff !== 'ALL' || filterWorkType !== 'ALL';
    const filteredTotal = filteredProgress.length + filteredPlans.length;
    const filteredPlannedCount = filteredProgress.filter(i => i && i.isPlanned).length + 
                                 filteredPlans.filter(i => i && i.isPlanned).length;
    const filteredPlannedRatio = filteredTotal > 0 ? Math.round((filteredPlannedCount / filteredTotal) * 100) : 100;
    const filteredUnplannedRatio = 100 - filteredPlannedRatio;

    // Safe date helpers
    const safeDate = dayjs(selectedDate).isValid() ? dayjs(selectedDate) : dayjs();

    if (loading) {
        return (
            <div className="py-20 text-center space-y-4 bg-white rounded-3xl border border-slate-100 shadow-sm animate-pulse">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <div className="space-y-1">
                    <p className="text-sm font-black text-slate-700">Memuat Papan Operasional Harian (PPP)...</p>
                    <p className="text-xs text-slate-400">Sinkronisasi aktivitas Progress, Plans, dan Problems</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* 1. Date Selector & Metrics Header */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Date Navigation */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={() => setSelectedDate(safeDate.subtract(1, 'day').format('YYYY-MM-DD'))}
                            className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors cursor-pointer"
                            title="Hari Sebelumnya"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <div className="flex items-center gap-2.5 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-200/80">
                            <Calendar size={18} className="text-blue-600" />
                            <input
                                type="date"
                                value={selectedDate || dayjs().format('YYYY-MM-DD')}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent text-sm font-black text-slate-800 outline-none cursor-pointer"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => setSelectedDate(safeDate.add(1, 'day').format('YYYY-MM-DD'))}
                            className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors cursor-pointer"
                            title="Hari Berikutnya"
                        >
                            <ChevronRight size={18} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedDate(dayjs().format('YYYY-MM-DD'))}
                            className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors cursor-pointer"
                        >
                            Hari Ini
                        </button>
                        <button
                            type="button"
                            onClick={onRefresh}
                            className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors cursor-pointer"
                            title="Segarkan Data"
                        >
                            <RotateCw size={16} />
                        </button>
                    </div>

                    {/* Filter Dropdowns */}
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
                            value={filterStaff}
                            onChange={(e) => setFilterStaff(e.target.value)}
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer max-w-[240px]"
                        >
                            <option value="ALL">Semua Staf (Admin Aset)</option>
                            {availableStaff.map((st, idx) => {
                                const sId = st?.id || st?.userId || st?.name || `staff-${idx}`;
                                const sName = st?.name || st?.fullName || 'Staf';
                                return (
                                    <option key={sId} value={sId}>
                                        {sName} {st?.position ? `(${st.position})` : ''}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                </div>

                {/* Scorecard Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
                    <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">Progress (Tuntas)</span>
                        <div className="flex items-baseline gap-1.5 pt-0.5">
                            <span className="text-xl font-black text-emerald-950">
                                {isFiltered ? filteredProgress.length : (summary?.totalCompleted ?? filteredProgress.length)}
                            </span>
                            <span className="text-[10px] text-emerald-700 font-bold">Pekerjaan</span>
                        </div>
                    </div>

                    <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-2xl">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">Plans (On Progress)</span>
                        <div className="flex items-baseline gap-1.5 pt-0.5">
                            <span className="text-xl font-black text-amber-950">
                                {isFiltered ? filteredPlans.length : (summary?.totalInProgress ?? filteredPlans.length)}
                            </span>
                            <span className="text-[10px] text-amber-700 font-bold">Pekerjaan</span>
                        </div>
                    </div>

                    <div className="p-3 bg-rose-50/70 border border-rose-100 rounded-2xl">
                        <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 block">Problems (Kendala)</span>
                        <div className="flex items-baseline gap-1.5 pt-0.5">
                            <span className="text-xl font-black text-rose-950">
                                {isFiltered ? filteredProblems.length : (summary?.totalProblems ?? filteredProblems.length)}
                            </span>
                            <span className="text-[10px] text-rose-700 font-bold">Hambatan</span>
                        </div>
                    </div>

                    <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-2xl">
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-800 block">Rasio Terencana</span>
                        <div className="flex items-baseline gap-1.5 pt-0.5">
                            <span className="text-xl font-black text-blue-950">
                                {isFiltered ? filteredPlannedRatio : (summary?.plannedRatio ?? 100)}%
                            </span>
                            <span className="text-[10px] text-blue-700 font-bold">
                                ({isFiltered ? filteredUnplannedRatio : (summary?.unplannedRatio ?? 0)}% Insidental)
                            </span>
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
                            {filteredProgress.map((item, idx) => {
                                const photos = extractSafePhotos(item.photos);
                                const staffName = getStaffDisplayName(item.user);
                                return (
                                    <div key={idx} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-2xs space-y-2.5 hover:border-emerald-200 transition-colors">
                                        <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                            <div className="flex items-center gap-1.5">
                                                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black uppercase">
                                                    {renderSafeText(item.categoryTag, 'UMUM')}
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
                                                PJ: <b>{staffName}</b>
                                            </span>
                                        </div>

                                        <h4 className="text-xs font-bold text-slate-800 leading-snug">
                                            {renderSafeText(item.title, 'Aktivitas Operasional')}
                                        </h4>

                                        {item.output && (
                                            <div className="p-2.5 bg-slate-50 rounded-xl text-xs text-slate-700 border border-slate-100">
                                                <span className="font-bold text-emerald-700 block text-[10px] uppercase">Wujud Hasil / Output:</span>
                                                <p className="font-medium pt-0.5">{renderSafeText(item.output)}</p>
                                            </div>
                                        )}

                                        {/* Photos Preview */}
                                        {photos.length > 0 && (
                                            <div className="flex items-center gap-1.5 pt-1 overflow-x-auto">
                                                {photos.map((src, pIdx) => (
                                                    <img
                                                        key={pIdx}
                                                        src={src}
                                                        alt="Bukti Selesai"
                                                        onClick={() => setLightboxPhoto && setLightboxPhoto(src)}
                                                        className="w-11 h-11 rounded-lg object-cover border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
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
                            {filteredPlans.map((item, idx) => {
                                const staffName = getStaffDisplayName(item.user);
                                const progressPct = Math.min(100, Math.max(0, Number(item.progressPercentage) || 50));
                                return (
                                    <div key={idx} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-2xs space-y-2.5 hover:border-amber-200 transition-colors">
                                        <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                            <div className="flex items-center gap-1.5">
                                                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-black uppercase">
                                                    {renderSafeText(item.categoryTag, 'UMUM')}
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
                                                PJ: <b>{staffName}</b>
                                            </span>
                                        </div>

                                        <h4 className="text-xs font-bold text-slate-800 leading-snug">
                                            {renderSafeText(item.title, 'Rencana Pekerjaan')}
                                        </h4>

                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-600">
                                                <span>Target Selesai: {renderSafeText(item.targetDate, 'Sesuai Jadwal')}</span>
                                                <span>{progressPct}%</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-amber-500 rounded-full transition-all" 
                                                    style={{ width: `${progressPct}%` }} 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
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
                            {filteredProblems.map((item, idx) => {
                                const staffName = getStaffDisplayName(item.user);
                                return (
                                    <div key={idx} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-2xs space-y-2.5 hover:border-rose-200 transition-colors">
                                        <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                            <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-black uppercase">
                                                {renderSafeText(item.categoryTag, 'KENDALA')}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-medium">
                                                PJ: <b>{staffName}</b>
                                            </span>
                                        </div>

                                        <h4 className="text-xs font-medium text-slate-700 leading-snug">
                                            <span className="font-bold text-slate-900">Aktivitas:</span> {renderSafeText(item.title, 'Aktivitas Terkait')}
                                        </h4>

                                        <div className="p-2.5 bg-rose-50/70 border border-rose-100 rounded-xl space-y-1">
                                            <span className="text-[10px] font-black uppercase text-rose-800 block">Uraian Hambatan:</span>
                                            <p className="text-xs font-bold text-rose-900">
                                                {renderSafeText(item.obstacleNote, 'Kendala teknis lapangan')}
                                            </p>
                                        </div>

                                        {item.actionPlan && (
                                            <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-xl space-y-0.5">
                                                <span className="text-[10px] font-black uppercase text-blue-800 block">Tindak Lanjut / Butuh Arahan:</span>
                                                <p className="text-xs font-semibold text-blue-900">
                                                    {renderSafeText(item.actionPlan)}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default DailyPppTab;
