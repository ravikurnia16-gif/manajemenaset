import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, RefreshCw, Layers } from 'lucide-react';
import api from '../../../lib/axios';
import { DashboardTab } from '../DashboardTab';

export const computeUniformDateRange = (preset) => {
    const now = new Date();
    const toYMD = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const todayStr = toYMD(now);

    if (preset === 'TODAY') {
        return { startDate: todayStr, endDate: todayStr };
    }
    if (preset === 'THIS_WEEK') {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(new Date().setDate(diff));
        return { startDate: toYMD(monday), endDate: todayStr };
    }
    if (preset === 'LAST_7_DAYS') {
        const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
        return { startDate: toYMD(sevenDaysAgo), endDate: todayStr };
    }
    if (preset === 'THIS_MONTH') {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        return { startDate: toYMD(firstDay), endDate: todayStr };
    }
    if (preset === 'LAST_30_DAYS') {
        const thirtyDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
        return { startDate: toYMD(thirtyDaysAgo), endDate: todayStr };
    }
    return { startDate: '', endDate: '' };
};

export default function DashboardPage() {
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
    const [datePreset, setDatePreset] = useState('ALL');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const fetchStats = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);

        try {
            const params = {};
            if (selectedWarehouseId) params.warehouseId = selectedWarehouseId;
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;

            const res = await api.get('/uniforms/dashboard', { params });
            setStats(res.data || {});
        } catch (err) {
            console.error('Failed to load uniform dashboard stats:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedWarehouseId, startDate, endDate]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const handlePresetChange = (preset) => {
        setDatePreset(preset);
        if (preset === 'ALL') {
            setStartDate('');
            setEndDate('');
        } else if (preset !== 'CUSTOM') {
            const range = computeUniformDateRange(preset);
            setStartDate(range.startDate);
            setEndDate(range.endDate);
        }
    };

    const handleCustomDateChange = (start, end) => {
        setDatePreset('CUSTOM');
        setStartDate(start);
        setEndDate(end);
    };

    return (
        <div className="space-y-6">
            {/* Header Title */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-md shadow-blue-600/20">
                        <BarChart3 size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Dashboard Seragam</h1>
                        <p className="text-xs sm:text-sm text-slate-500 font-medium">
                            Monitoring eksekutif stok fisik, pergerakan pesanan, dan laporan periodik mingguan / per tanggal
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => fetchStats(true)}
                        disabled={refreshing || loading}
                        className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 shadow-sm transition disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={refreshing ? 'animate-spin text-blue-600' : 'text-slate-500'} />
                        <span>{refreshing ? 'Memperbarui...' : 'Sinkronkan Data'}</span>
                    </button>
                </div>
            </div>

            {/* Dashboard Body */}
            {loading ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm space-y-3">
                    <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <div className="text-sm font-bold text-slate-700">Menghitung analitik & statistik seragam...</div>
                    <p className="text-xs text-slate-400">Menghubungkan data stok, pesanan SPMB, dan riwayat mutasi.</p>
                </div>
            ) : (
                <DashboardTab 
                    stats={stats} 
                    selectedWarehouseId={selectedWarehouseId}
                    onSelectWarehouse={setSelectedWarehouseId}
                    datePreset={datePreset}
                    startDate={startDate}
                    endDate={endDate}
                    onPresetChange={handlePresetChange}
                    onCustomDateChange={handleCustomDateChange}
                    onRefresh={() => fetchStats(true)}
                />
            )}
        </div>
    );
}

