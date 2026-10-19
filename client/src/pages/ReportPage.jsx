import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
    FileSpreadsheet, Truck, Sparkles, Building2, CalendarRange,
    Layers, Award, ShieldCheck, Shirt, Warehouse, Bot, Target,
    ShieldAlert, ArrowLeft
} from 'lucide-react';
import AssetDateRangeReport from '../components/AssetDateRangeReport';
import VehicleWeeklySevenReportsTab from '../components/VehicleWeeklySevenReportsTab';
import UniformDashboardPage from '../pages/ManajemenSeragam/pages/DashboardPage';
import InventoryDashboard from '../pages/Inventory/InventoryDashboard';
import StaffWeeklyAiReportTab from '../components/StaffWeeklyAiReportTab';
import WorkPlanReportTab from '../components/WorkPlanReportTab';
import { cn } from '../lib/utils';

const VALID_TABS = ['asset', 'vehicle_seven', 'uniform', 'warehouse', 'inventory', 'staff_ai', 'workplan'];

const TABS = [
    {
        id: 'asset',
        label: 'Laporan Manajemen Aset',
        tag: 'Pengadaan & Sarpras',
        icon: FileSpreadsheet,
        iconActiveClass: 'text-indigo-600',
        badgeActiveClass: 'bg-indigo-100 text-indigo-800',
        badgeInactiveClass: 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30'
    },
    {
        id: 'vehicle_seven',
        label: '7 Laporan Utama Armada',
        tag: 'Statistik & AI Kendaraan',
        icon: Truck,
        iconActiveClass: 'text-emerald-600',
        badgeActiveClass: 'bg-emerald-100 text-emerald-800',
        badgeInactiveClass: 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
    },
    {
        id: 'uniform',
        label: 'Laporan Manajemen Seragam',
        tag: 'Stok & Distribusi',
        icon: Shirt,
        iconActiveClass: 'text-blue-600',
        badgeActiveClass: 'bg-blue-100 text-blue-800',
        badgeInactiveClass: 'bg-blue-500/20 text-blue-200 border border-blue-400/30'
    },
    {
        id: 'warehouse',
        label: 'Laporan Manajemen Gudang',
        tag: 'Logistik & Valuasi',
        icon: Warehouse,
        iconActiveClass: 'text-amber-600',
        badgeActiveClass: 'bg-amber-100 text-amber-800',
        badgeInactiveClass: 'bg-amber-500/20 text-amber-200 border border-amber-400/30'
    },
    {
        id: 'staff_ai',
        label: 'Laporan Staff (Analisis AI)',
        tag: 'Rangkuman Narasi AI',
        icon: Bot,
        iconActiveClass: 'text-violet-600',
        badgeActiveClass: 'bg-violet-100 text-violet-800',
        badgeInactiveClass: 'bg-violet-500/20 text-violet-200 border border-violet-400/30'
    },
    {
        id: 'workplan',
        label: 'Perencanaan Kerja (Workplan)',
        tag: 'Target & Progress',
        icon: Target,
        iconActiveClass: 'text-rose-600',
        badgeActiveClass: 'bg-rose-100 text-rose-800',
        badgeInactiveClass: 'bg-rose-500/20 text-rose-200 border border-rose-400/30'
    }
];

const ReportPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const tabFromUrl = searchParams.get('tab');
    
    const [activeTab, setActiveTab] = useState(() => {
        if (tabFromUrl && VALID_TABS.includes(tabFromUrl)) {
            return tabFromUrl === 'inventory' ? 'warehouse' : tabFromUrl;
        }
        return 'asset';
    });

    useEffect(() => {
        if (tabFromUrl && VALID_TABS.includes(tabFromUrl)) {
            const resolved = tabFromUrl === 'inventory' ? 'warehouse' : tabFromUrl;
            if (resolved !== activeTab) {
                setActiveTab(resolved);
            }
        }
    }, [tabFromUrl]);

    const navigate = useNavigate();
    let user = {};
    try {
        user = JSON.parse(localStorage.getItem('user')) || {};
    } catch (e) {
        console.error('Failed to parse user from localStorage', e);
    }

    const userPos = (user?.position || '').toLowerCase();
    const isKabidSaranaPosition = userPos.includes('kepala bidang sarana');

    const handleTabChange = (newTab) => {
        setActiveTab(newTab);
        setSearchParams(newTab === 'asset' ? {} : { tab: newTab });
    };

    if (!isKabidSaranaPosition) {
        return (
            <div className="min-h-[65vh] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
                <div className="w-20 h-20 bg-rose-50 border border-rose-200 text-rose-600 rounded-3xl flex items-center justify-center shadow-lg shadow-rose-500/10 mb-5">
                    <ShieldAlert size={40} />
                </div>
                <span className="px-3 py-1 rounded-full text-[11px] font-black tracking-wider uppercase bg-rose-100 text-rose-700 border border-rose-200 mb-3">
                    Akses Dibatasi
                </span>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight mb-2">
                    Laporan Mingguan Kepala Bidang Sarana
                </h1>
                <p className="text-sm text-slate-500 max-w-md font-medium leading-relaxed mb-6">
                    Halaman ini dikhususkan secara eksklusif untuk pengguna dengan jabatan <strong>Kepala Bidang Sarana</strong>. Jabatan akun Anda saat ini: <span className="font-bold text-slate-700">{user?.position || 'Tidak Ditentukan'}</span>.
                </p>
                <button
                    onClick={() => navigate('/dashboard')}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold transition-all shadow-md hover:shadow-lg cursor-pointer"
                >
                    <ArrowLeft size={16} /> Kembali ke Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-12">
            {/* Header Laporan Mingguan Kepala Bidang Sarana */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-7 rounded-3xl shadow-xl relative overflow-hidden">
                {/* Decorative background accent */}
                <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute top-0 right-1/4 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                                YAYASAN DAR EL IMAN
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-400/30">
                                BIDANG SARANA
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                                LAPORAN EKSEKUTIF RESMI
                            </span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
                            Laporan Mingguan Kepala Bidang Sarana
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl font-medium leading-relaxed">
                            Pusat pengawasan dan rekapitulasi berkala 6 pilar sarana: Audit Aset (Pengadaan & Sarpras), 7 Laporan Utama Armada Kendaraan, Manajemen Seragam, Logistik Gudang, Rangkuman Kinerja Staf (Analisis AI), serta Perencanaan Kerja (Workplan).
                        </p>
                    </div>

                    <div className="shrink-0 flex items-center gap-3 bg-white/5 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/30 flex items-center justify-center text-amber-300 shadow-inner">
                            <ShieldCheck size={22} />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Akses Khusus</p>
                            <p className="text-xs font-black text-white">{user?.name || 'Kepala Bidang Sarana'}</p>
                            <p className="text-[10px] text-indigo-300 font-semibold">{user?.position || 'Bidang Sarana'}</p>
                        </div>
                    </div>
                </div>

                {/* Tab Switcher (6 Executive Tabs) */}
                <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center gap-2">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs transition-all shadow-sm cursor-pointer",
                                    isActive
                                        ? "bg-white text-slate-900 shadow-lg shadow-black/20 ring-2 ring-white/40"
                                        : "bg-white/10 hover:bg-white/20 text-white/90 border border-white/10"
                                )}
                            >
                                <Icon size={16} className={isActive ? tab.iconActiveClass : "text-white/70"} />
                                <span>{tab.label}</span>
                                <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1",
                                    isActive
                                        ? tab.badgeActiveClass
                                        : tab.badgeInactiveClass
                                )}>
                                    {tab.tag}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tab Contents */}
            <div>
                {activeTab === 'asset' && (
                    <AssetDateRangeReport currentUser={user} />
                )}
                {activeTab === 'vehicle_seven' && (
                    <VehicleWeeklySevenReportsTab currentUser={user} />
                )}
                {activeTab === 'uniform' && (
                    <UniformDashboardPage />
                )}
                {activeTab === 'warehouse' && (
                    <InventoryDashboard />
                )}
                {activeTab === 'staff_ai' && (
                    <StaffWeeklyAiReportTab currentUser={user} />
                )}
                {activeTab === 'workplan' && (
                    <WorkPlanReportTab currentUser={user} />
                )}
            </div>
        </div>
    );
};

export default ReportPage;
