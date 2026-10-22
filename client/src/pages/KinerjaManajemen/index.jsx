import React, { useState, useEffect } from 'react';
import { 
    Target, AlertTriangle, Calendar, Layers, 
    Clock, CheckCircle2, RefreshCw, Award, 
    TrendingUp, ShieldCheck, X, Plus, FileText, 
    Users, CheckSquare 
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import api from '../../lib/axios';

// Sub Tabs
import MbeRadarTab from './tabs/MbeRadarTab';
import DailyPppTab from './tabs/DailyPppTab';
import WeeklyPdcaTab from './tabs/WeeklyPdcaTab';
import OkrDashboardTab from './tabs/OkrDashboardTab';
import StaffPlansTab from './tabs/StaffPlansTab';

// Modals
import AssignmentModal from './modals/AssignmentModal';
import PlanModal from './modals/PlanModal';
import DailyReportPppModal from './modals/DailyReportPppModal';

dayjs.locale('id');

const KinerjaManajemen = () => {
    // Current User
    let currentUser = {};
    try {
        const stored = localStorage.getItem('user');
        if (stored && stored !== 'undefined') {
            currentUser = JSON.parse(stored);
        }
    } catch (e) {
        console.error('Error parsing user:', e);
    }

    const pos = (currentUser?.position || '').toLowerCase();
    const isKabidSarana = pos.includes('kepala bidang sarana') || currentUser?.role === 'KABID_SARPRAS' || currentUser?.role === 'SUPER_ADMIN';

    // Tabs: MBE, PPP, PDCA, PLANS, OKR
    const [activeTab, setActiveTab] = useState('MBE');

    // States for MBE Radar
    const [radarData, setRadarData] = useState(null);
    const [loadingRadar, setLoadingRadar] = useState(false);
    const [mbeStartDate, setMbeStartDate] = useState('');
    const [mbeEndDate, setMbeEndDate] = useState('');

    // States for Daily PPP
    const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [pppData, setPppData] = useState(null);
    const [loadingPpp, setLoadingPpp] = useState(false);

    // States for Weekly PDCA
    const [pdcaStartDate, setPdcaStartDate] = useState(dayjs().startOf('week').add(1, 'day').format('YYYY-MM-DD')); // Senin
    const [pdcaEndDate, setPdcaEndDate] = useState(dayjs().startOf('week').add(6, 'day').format('YYYY-MM-DD')); // Sabtu
    const [pdcaData, setPdcaData] = useState(null);
    const [loadingPdca, setLoadingPdca] = useState(false);

    // States for OKR
    const [okrData, setOkrData] = useState(null);
    const [loadingOkr, setLoadingOkr] = useState(false);

    // States for Staff Plans & Assignments
    const [staffList, setStaffList] = useState([]);
    const [staffPlansData, setStaffPlansData] = useState([]);
    const [loadingStaffPlans, setLoadingStaffPlans] = useState(false);

    // Modals state
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [selectedStaffForAssign, setSelectedStaffForAssign] = useState(null);
    const [initialDataForAssign, setInitialDataForAssign] = useState(null);
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [selectedStaffForPlan, setSelectedStaffForPlan] = useState(null);
    const [initialDataForPlan, setInitialDataForPlan] = useState(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);

    // Lightbox modal for photo preview
    const [lightboxPhoto, setLightboxPhoto] = useState(null);

    // Fetchers
    const fetchMbeRadar = async (overrideStart, overrideEnd) => {
        try {
            setLoadingRadar(true);
            const start = overrideStart !== undefined ? overrideStart : mbeStartDate;
            const end = overrideEnd !== undefined ? overrideEnd : mbeEndDate;
            const params = {};
            if (start) params.startDate = start;
            if (end) params.endDate = end;

            const res = await api.get('/kinerja-manajemen/mbe-radar', { params });
            if (res.data.success) {
                setRadarData(res.data.radar);
            }
        } catch (err) {
            console.error('Failed to fetch MBE radar:', err);
        } finally {
            setLoadingRadar(false);
        }
    };

    const fetchDailyPpp = async () => {
        try {
            setLoadingPpp(true);
            const res = await api.get('/kinerja-manajemen/daily-ppp', {
                params: { date: selectedDate }
            });
            if (res.data.success) {
                setPppData(res.data);
            }
        } catch (err) {
            console.error('Failed to fetch daily PPP:', err);
        } finally {
            setLoadingPpp(false);
        }
    };

    const fetchWeeklyPdca = async () => {
        try {
            setLoadingPdca(true);
            const res = await api.get('/kinerja-manajemen/weekly-pdca', {
                params: { startDate: pdcaStartDate, endDate: pdcaEndDate }
            });
            if (res.data.success) {
                setPdcaData(res.data);
            }
        } catch (err) {
            console.error('Failed to fetch weekly PDCA:', err);
        } finally {
            setLoadingPdca(false);
        }
    };

    const fetchOkrDashboard = async () => {
        try {
            setLoadingOkr(true);
            const res = await api.get('/kinerja-manajemen/okr');
            if (res.data.success) {
                setOkrData(res.data);
            }
        } catch (err) {
            console.error('Failed to fetch OKR dashboard:', err);
        } finally {
            setLoadingOkr(false);
        }
    };

    const fetchStaffPlans = async () => {
        try {
            setLoadingStaffPlans(true);
            const res = await api.get('/kinerja-manajemen/staff-plans');
            if (res.data.success) {
                setStaffPlansData(res.data.staff || []);
            }
        } catch (err) {
            console.error('Failed to fetch staff plans:', err);
        } finally {
            setLoadingStaffPlans(false);
        }
    };

    const fetchStaffList = async () => {
        try {
            const res = await api.get('/personnel/staff');
            if (res.data.success || res.data.staff) {
                setStaffList(res.data.staff || []);
            }
        } catch (e) {
            console.error('Error fetching staff list:', e);
        }
    };

    const handleSaveOkr = async (updatedOkrs) => {
        try {
            const res = await api.post('/kinerja-manajemen/okr', { okrs: updatedOkrs });
            if (res.data.success) {
                await fetchOkrDashboard();
                alert('Target sasaran strategis OKR berhasil diperbarui.');
            }
        } catch (err) {
            console.error('Failed to save OKR:', err);
            alert('Gagal menyimpan perubahan OKR.');
        }
    };

    const handleOpenAssignModal = (staff = null, initialData = null) => {
        setSelectedStaffForAssign(staff);
        setInitialDataForAssign(initialData);
        setIsAssignModalOpen(true);
    };

    const handleOpenPlanModal = (staff = null, initialPlan = null) => {
        setSelectedStaffForPlan(staff);
        setInitialDataForPlan(initialPlan);
        setIsPlanModalOpen(true);
    };

    // Auto-fetch on tab change or parameter change
    useEffect(() => {
        if (activeTab === 'MBE') {
            fetchMbeRadar();
        } else if (activeTab === 'PPP') {
            fetchDailyPpp();
        } else if (activeTab === 'PDCA') {
            fetchWeeklyPdca();
        } else if (activeTab === 'PLANS') {
            fetchStaffPlans();
        } else if (activeTab === 'OKR') {
            fetchOkrDashboard();
        }
    }, [activeTab, selectedDate, pdcaStartDate, pdcaEndDate]);

    // Initial setup
    useEffect(() => {
        fetchMbeRadar();
        fetchStaffList();
        fetchStaffPlans();
    }, []);

    // Total Exception Count for badge
    const totalExceptions = radarData ? (
        (radarData.overdueAssignments?.length || 0) +
        (radarData.pendingExtensions?.length || 0) +
        (radarData.criticalMaintenance?.length || 0) +
        (radarData.overdueVehicleReminders?.length || 0) +
        (radarData.pendingVehicleServices?.length || 0) +
        (radarData.unresolvedObstacles?.length || 0)
    ) : 0;

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            {/* Header Cockpit Eksekutif */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
                            <Target size={18} />
                        </span>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                                Cockpit Eksekutif • Kepala Bidang Sarana
                            </span>
                            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                                Manajemen Kinerja & Strategis (OKR)
                            </h1>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 font-medium max-w-2xl">
                        Pusat kendali evaluasi operasional terintegrasi: <b>PPP</b> (Harian), <b>PDCA</b> (Mingguan), <b>MBE</b> (Radar Pengecualian), dan <b>OKR</b> (Sasaran Strategis).
                    </p>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={() => handleOpenPlanModal()}
                        className="px-3.5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                        title="Buat Rencana Kerja untuk Diri Sendiri atau Staf"
                    >
                        <Target size={14} /> + Buat Rencana Kerja
                    </button>

                    <button
                        type="button"
                        onClick={() => handleOpenAssignModal()}
                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                    >
                        <Plus size={14} /> Beri Penugasan
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsReportModalOpen(true)}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                        title="Input Laporan Harian Kegiatan (Sesi Pagi & Siang)"
                    >
                        <FileText size={14} /> Input Laporan Harian
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            if (activeTab === 'MBE') fetchMbeRadar();
                            else if (activeTab === 'PPP') fetchDailyPpp();
                            else if (activeTab === 'PDCA') fetchWeeklyPdca();
                            else if (activeTab === 'PLANS') fetchStaffPlans();
                            else if (activeTab === 'OKR') fetchOkrDashboard();
                        }}
                        className="p-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl text-slate-600 transition-all shadow-2xs active:scale-95 cursor-pointer"
                        title="Segarkan Data"
                    >
                        <RefreshCw size={15} />
                    </button>
                </div>
            </div>

            {/* TAB NAVIGATOR (5 TABS) */}
            <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 overflow-x-auto">
                <button
                    type="button"
                    onClick={() => setActiveTab('MBE')}
                    className={`flex-1 py-2.5 px-3.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        activeTab === 'MBE'
                            ? 'bg-white text-rose-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <AlertTriangle size={15} className={activeTab === 'MBE' ? 'text-rose-600' : 'text-slate-400'} />
                    <span>🚨 Radar MBE (Anomali)</span>
                    {totalExceptions > 0 && (
                        <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center animate-pulse">
                            {totalExceptions}
                        </span>
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('PPP')}
                    className={`flex-1 py-2.5 px-3.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        activeTab === 'PPP'
                            ? 'bg-white text-blue-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <Calendar size={15} className={activeTab === 'PPP' ? 'text-blue-600' : 'text-slate-400'} />
                    <span>📅 Harian (PPP Hub)</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('PDCA')}
                    className={`flex-1 py-2.5 px-3.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        activeTab === 'PDCA'
                            ? 'bg-white text-indigo-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <Layers size={15} className={activeTab === 'PDCA' ? 'text-indigo-600' : 'text-slate-400'} />
                    <span>🔄 Mingguan (PDCA)</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('PLANS')}
                    className={`flex-1 py-2.5 px-3.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        activeTab === 'PLANS'
                            ? 'bg-white text-indigo-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <Users size={15} className={activeTab === 'PLANS' ? 'text-indigo-600' : 'text-slate-400'} />
                    <span>📋 Rencana & Penugasan Staf</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('OKR')}
                    className={`flex-1 py-2.5 px-3.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        activeTab === 'OKR'
                            ? 'bg-white text-emerald-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <Target size={15} className={activeTab === 'OKR' ? 'text-emerald-600' : 'text-slate-400'} />
                    <span>🎯 Sasaran Strategis (OKR)</span>
                </button>
            </div>

            {/* TAB CONTENTS */}
            {activeTab === 'MBE' && (
                <MbeRadarTab 
                    radarData={radarData} 
                    loading={loadingRadar} 
                    onRefresh={() => fetchMbeRadar()} 
                    onNavigateTab={setActiveTab}
                    startDate={mbeStartDate}
                    setStartDate={setMbeStartDate}
                    endDate={mbeEndDate}
                    setEndDate={setMbeEndDate}
                    onApplyDateFilter={(s, e) => fetchMbeRadar(s, e)}
                />
            )}

            {activeTab === 'PPP' && (
                <DailyPppTab 
                    selectedDate={selectedDate}
                    setSelectedDate={setSelectedDate}
                    pppData={pppData}
                    loading={loadingPpp}
                    staffList={staffList}
                    onRefresh={fetchDailyPpp}
                    setLightboxPhoto={setLightboxPhoto}
                />
            )}

            {activeTab === 'PDCA' && (
                <WeeklyPdcaTab 
                    pdcaData={pdcaData}
                    loading={loadingPdca}
                    startDate={pdcaStartDate}
                    setStartDate={setPdcaStartDate}
                    endDate={pdcaEndDate}
                    setEndDate={setPdcaEndDate}
                    onRefresh={fetchWeeklyPdca}
                />
            )}

            {activeTab === 'PLANS' && (
                <StaffPlansTab
                    staffPlansData={staffPlansData}
                    loading={loadingStaffPlans}
                    onOpenAssignModal={handleOpenAssignModal}
                    onOpenPlanModal={handleOpenPlanModal}
                    onRefresh={fetchStaffPlans}
                />
            )}

            {activeTab === 'OKR' && (
                <OkrDashboardTab 
                    okrData={okrData}
                    loading={loadingOkr}
                    onSaveOkr={handleSaveOkr}
                    onRefresh={fetchOkrDashboard}
                />
            )}

            {/* MODAL 1: Berikan Penugasan Resmi (Bisa dari Plan Staf) */}
            <AssignmentModal
                isOpen={isAssignModalOpen}
                onClose={() => setIsAssignModalOpen(false)}
                onSuccess={() => {
                    fetchStaffPlans();
                    fetchMbeRadar();
                    fetchWeeklyPdca();
                }}
                staffList={staffList}
                initialStaff={selectedStaffForAssign}
                initialData={initialDataForAssign}
            />

            {/* MODAL 2: Input Laporan Harian Terpadu (PPP) */}
            <DailyReportPppModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                onSuccess={() => {
                    fetchDailyPpp();
                    fetchMbeRadar();
                    fetchWeeklyPdca();
                    fetchStaffPlans();
                }}
                staffList={staffList}
                staffPlansData={staffPlansData}
            />

            {/* MODAL 3: Buat / Edit Rencana Kerja Staf */}
            <PlanModal
                isOpen={isPlanModalOpen}
                onClose={() => setIsPlanModalOpen(false)}
                onSuccess={() => {
                    fetchStaffPlans();
                    fetchDailyPpp();
                    fetchWeeklyPdca();
                }}
                staffList={staffList}
                initialStaff={selectedStaffForPlan}
                initialPlan={initialDataForPlan}
                staffPlansData={staffPlansData}
            />

            {/* LIGHTBOX MODAL FOR IMAGES */}
            {lightboxPhoto && (
                <div 
                    className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setLightboxPhoto(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
                        <button
                            type="button"
                            onClick={() => setLightboxPhoto(null)}
                            className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white bg-white/10 rounded-full transition-colors cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                        <img
                            src={lightboxPhoto}
                            alt="Pratinjau Foto Bukti"
                            className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl border border-white/10"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default KinerjaManajemen;
