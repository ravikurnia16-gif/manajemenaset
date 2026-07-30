import { useState, useEffect } from 'react';
import { BarChart3 } from 'lucide-react';
import api from '../../../../lib/axios';
import { DashboardTab } from '../DashboardTab';

export default function DashboardPage() {
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/uniforms/dashboard')
            .then(res => setStats(res.data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                    <BarChart3 size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Dashboard Seragam</h1>
                    <p className="text-slate-500">Ringkasan statistik stok dan penjualan seragam</p>
                </div>
            </div>

            {loading ? (
                <div className="text-slate-500">Memuat dashboard...</div>
            ) : (
                <DashboardTab stats={stats} />
            )}
        </div>
    );
}
