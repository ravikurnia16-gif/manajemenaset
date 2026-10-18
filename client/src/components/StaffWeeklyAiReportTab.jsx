import React, { useState, useEffect, useCallback } from 'react';
import { 
    Calendar, RefreshCw, Sparkles, Bot, Loader2, CheckCircle2, 
    FileText, ChevronRight, AlertCircle, CalendarRange, Clock
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import api from '../lib/axios';
import WeeklyPdfTab from '../pages/LaporanStaff/tabs/WeeklyPdfTab';
import LightboxModal from '../pages/LaporanStaff/modals/LightboxModal';
import { cn } from '../lib/utils';

dayjs.locale('id');

const computeStaffDateRange = (preset) => {
    const now = dayjs();
    if (preset === 'THIS_WEEK') {
        const monday = now.startOf('week').add(1, 'day');
        const sunday = monday.add(6, 'day');
        return {
            startDate: monday.format('YYYY-MM-DD'),
            endDate: sunday.format('YYYY-MM-DD')
        };
    }
    if (preset === 'LAST_WEEK') {
        const lastMonday = now.subtract(1, 'week').startOf('week').add(1, 'day');
        const lastSunday = lastMonday.add(6, 'day');
        return {
            startDate: lastMonday.format('YYYY-MM-DD'),
            endDate: lastSunday.format('YYYY-MM-DD')
        };
    }
    if (preset === 'THIS_MONTH') {
        return {
            startDate: now.startOf('month').format('YYYY-MM-DD'),
            endDate: now.endOf('month').format('YYYY-MM-DD')
        };
    }
    return {
        startDate: now.startOf('week').add(1, 'day').format('YYYY-MM-DD'),
        endDate: now.endOf('week').add(1, 'day').format('YYYY-MM-DD')
    };
};

export default function StaffWeeklyAiReportTab({ currentUser = {} }) {
    const [preset, setPreset] = useState('THIS_WEEK');
    const initialRange = computeStaffDateRange('THIS_WEEK');
    const [weeklyStartDate, setWeeklyStartDate] = useState(initialRange.startDate);
    const [weeklyEndDate, setWeeklyEndDate] = useState(initialRange.endDate);
    const [weeklyData, setWeeklyData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [customKabidNiy, setCustomKabidNiy] = useState(currentUser?.nip || currentUser?.username || '');
    const [lightboxPhoto, setLightboxPhoto] = useState(null);

    const fetchWeeklySummary = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/laporan/weekly-summary', {
                params: { startDate: weeklyStartDate, endDate: weeklyEndDate }
            });
            if (res.data?.success || res.data) {
                setWeeklyData(res.data);
                if (res.data.kabid?.niy) {
                    setCustomKabidNiy(res.data.kabid.niy);
                } else if (currentUser?.nip || currentUser?.username) {
                    setCustomKabidNiy(currentUser.nip || currentUser.username);
                }
            }
        } catch (error) {
            console.error('Error fetching weekly summary for staff AI report:', error);
        } finally {
            setLoading(false);
        }
    }, [weeklyStartDate, weeklyEndDate, currentUser]);

    useEffect(() => {
        fetchWeeklySummary();
    }, [fetchWeeklySummary]);

    const handlePresetChange = (newPreset) => {
        setPreset(newPreset);
        if (newPreset !== 'CUSTOM') {
            const range = computeStaffDateRange(newPreset);
            setWeeklyStartDate(range.startDate);
            setWeeklyEndDate(range.endDate);
        }
    };

    return (
        <div className="space-y-6">
            {/* Top Control Bar with Presets & Date Pickers */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-violet-200">
                        <Bot size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
                                Laporan Staff & Rangkuman Analisis AI
                            </h2>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-violet-50 text-violet-700 border border-violet-200 flex items-center gap-1">
                                <Sparkles size={11} className="text-violet-600" /> AI Executive
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                            Rangkuman naratif berkala staf berdasarkan posisi tanpa persentase angka, terintegrasi Kop Resmi & Analisis AI.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Preset Buttons */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/60">
                        <button
                            type="button"
                            onClick={() => handlePresetChange('THIS_WEEK')}
                            className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                                preset === 'THIS_WEEK'
                                    ? "bg-white text-violet-700 shadow-sm"
                                    : "text-slate-600 hover:text-slate-900"
                            )}
                        >
                            Minggu Ini
                        </button>
                        <button
                            type="button"
                            onClick={() => handlePresetChange('LAST_WEEK')}
                            className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                                preset === 'LAST_WEEK'
                                    ? "bg-white text-violet-700 shadow-sm"
                                    : "text-slate-600 hover:text-slate-900"
                            )}
                        >
                            Pekan Lalu
                        </button>
                        <button
                            type="button"
                            onClick={() => handlePresetChange('THIS_MONTH')}
                            className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                                preset === 'THIS_MONTH'
                                    ? "bg-white text-violet-700 shadow-sm"
                                    : "text-slate-600 hover:text-slate-900"
                            )}
                        >
                            Bulan Ini
                        </button>
                        <button
                            type="button"
                            onClick={() => setPreset('CUSTOM')}
                            className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                                preset === 'CUSTOM'
                                    ? "bg-white text-violet-700 shadow-sm"
                                    : "text-slate-600 hover:text-slate-900"
                            )}
                        >
                            Kustom
                        </button>
                    </div>

                    {/* Date Inputs */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-2xl text-xs font-semibold text-slate-700">
                        <Calendar size={14} className="text-violet-600" />
                        <input
                            type="date"
                            value={weeklyStartDate}
                            onChange={(e) => {
                                setPreset('CUSTOM');
                                setWeeklyStartDate(e.target.value);
                            }}
                            className="bg-transparent outline-none cursor-pointer text-xs"
                        />
                        <span className="text-slate-400">s/d</span>
                        <input
                            type="date"
                            value={weeklyEndDate}
                            onChange={(e) => {
                                setPreset('CUSTOM');
                                setWeeklyEndDate(e.target.value);
                            }}
                            className="bg-transparent outline-none cursor-pointer text-xs"
                        />
                    </div>

                    {/* Refresh Button */}
                    <button
                        type="button"
                        onClick={fetchWeeklySummary}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl text-xs font-bold shadow-sm shadow-violet-200 transition disabled:opacity-50 cursor-pointer"
                        title="Perbarui Data Laporan"
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        <span>{loading ? 'Memuat...' : 'Sinkronkan'}</span>
                    </button>
                </div>
            </div>

            {/* WeeklyPdfTab Content */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-2 sm:p-4">
                <WeeklyPdfTab
                    weeklyStartDate={weeklyStartDate}
                    setWeeklyStartDate={setWeeklyStartDate}
                    weeklyEndDate={weeklyEndDate}
                    setWeeklyEndDate={setWeeklyEndDate}
                    customKabidNiy={customKabidNiy}
                    setCustomKabidNiy={setCustomKabidNiy}
                    weeklyData={weeklyData}
                    loading={loading}
                    user={currentUser}
                    setLightboxPhoto={setLightboxPhoto}
                />
            </div>

            {/* Lightbox for Photos */}
            {lightboxPhoto && (
                <LightboxModal
                    photoUrl={lightboxPhoto}
                    onClose={() => setLightboxPhoto(null)}
                />
            )}
        </div>
    );
}
