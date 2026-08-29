import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, RefreshCw, Layers } from 'lucide-react';
import api from '../../../lib/axios';
import { DashboardTab } from '../DashboardTab';

export default function DashboardPage() {
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');

    const fetchStats = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);

        try {
            const params = {};
            if (selectedWarehouseId) params.warehouseId = selectedWarehouseId;

            const res = await api.get('/uniforms/dashboard', { params });
            setStats(res.data || {});
        } catch (err) {
            console.error('Failed to load uniform dashboard stats:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedWarehouseId]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

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
                            Monitoring eksekutif stok fisik, pergerakan pesanan, dan kebutuhan pengadaan konveksi
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
                    onRefresh={() => fetchStats(true)}
                />
            )}
        </div>
    );
}
