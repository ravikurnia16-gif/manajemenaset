import React, { useState, useEffect } from 'react';
import {
    LayoutDashboard,
    HardHat,
    Cog,
    Clock,
    CheckCircle,
    Activity,
    Plus,
    FileText,
    ArrowRight
} from 'lucide-react';
import api from '../utils/api';
import { Link } from 'react-router-dom';

function WorkshopDashboard() {
    const [stats, setStats] = useState({
        totalOrders: 0,
        inProgress: 0,
        completed: 0,
        byType: { KAYU: 0, BESI: 0 },
        recentOrders: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const res = await api.get('/workshop/dashboard');
            setStats(res.data);
        } catch (error) {
            console.error('Error fetching workshop stats', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-6 text-center text-gray-500">Memuat data dashboard...</div>;

    const statCards = [
        { title: 'Total Pesanan', value: stats.totalOrders, icon: <FileText size={24} className="text-blue-500" />, bg: 'bg-blue-50', border: 'border-blue-100' },
        { title: 'Dalam Pengerjaan', value: stats.inProgress, icon: <Activity size={24} className="text-amber-500" />, bg: 'bg-amber-50', border: 'border-amber-100' },
        { title: 'Selesai', value: stats.completed, icon: <CheckCircle size={24} className="text-green-500" />, bg: 'bg-green-50', border: 'border-green-100' },
    ];

    const typeCards = [
        { type: 'KAYU', title: 'Workshop Kayu', value: stats.byType.KAYU, icon: <HardHat size={28} className="text-orange-600" />, link: '/workshop/orders?type=KAYU', bg: 'bg-orange-50 hover:bg-orange-100 transition-colors' },
        { type: 'BESI', title: 'Workshop Besi', value: stats.byType.BESI, icon: <Cog size={28} className="text-slate-600" />, link: '/workshop/orders?type=BESI', bg: 'bg-slate-50 hover:bg-slate-100 transition-colors' },
    ];

    const getStatusColor = (status) => {
        const colors = {
            DRAFT: 'bg-gray-100 text-gray-800',
            PENDING: 'bg-yellow-100 text-yellow-800',
            IN_PROGRESS: 'bg-blue-100 text-blue-800',
            QUALITY_CHECK: 'bg-purple-100 text-purple-800',
            COMPLETED: 'bg-green-100 text-green-800',
            CANCELLED: 'bg-red-100 text-red-800'
        };
        return colors[status] || 'bg-gray-100 text-gray-800';
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Dashboard Workshop</h1>
                    <p className="text-gray-500 mt-1">Ringkasan aktivitas pekerjaan internal (Kayu & Besi)</p>
                </div>
                <div className="flex space-x-3">
                    <Link to="/workshop/orders" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center shadow-sm">
                        <Plus size={18} className="mr-2" />
                        Buat Pesanan Baru
                    </Link>
                </div>
            </div>

            {/* General Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {statCards.map((card, idx) => (
                    <div key={idx} className={`bg-white rounded-xl border p-6 flex items-center space-x-4 shadow-sm`}>
                        <div className={`p-3 rounded-full ${card.bg}`}>
                            {card.icon}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">{card.title}</p>
                            <h3 className="text-2xl font-bold text-gray-800">{card.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* Type Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {typeCards.map((card, idx) => (
                    <Link key={idx} to={card.link} className={`rounded-xl border p-6 flex items-center justify-between shadow-sm ${card.bg}`}>
                        <div className="flex items-center space-x-4">
                            <div className="p-4 bg-white rounded-full shadow-sm">
                                {card.icon}
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">{card.title}</h3>
                                <p className="text-sm text-gray-500">{card.value} Pesanan terdaftar</p>
                            </div>
                        </div>
                        <ArrowRight size={24} className="text-gray-400" />
                    </Link>
                ))}
            </div>

            {/* Recent Orders */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center">
                        <Clock size={18} className="mr-2 text-gray-500" /> Pesanan Terbaru
                    </h2>
                    <Link to="/workshop/orders" className="text-sm text-emerald-600 hover:text-emerald-800 font-medium flex items-center">
                        Lihat Semua <ArrowRight size={16} className="ml-1" />
                    </Link>
                </div>
                <div className="p-0">
                    {stats.recentOrders.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">Belum ada pesanan workshop.</div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white border-b border-gray-100 text-sm text-gray-500">
                                    <th className="p-4 font-medium">Kode</th>
                                    <th className="p-4 font-medium">Judul</th>
                                    <th className="p-4 font-medium">Tipe</th>
                                    <th className="p-4 font-medium">Pemohon</th>
                                    <th className="p-4 font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {stats.recentOrders.map(order => (
                                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4 text-sm font-medium text-emerald-600">
                                            <Link to={`/workshop/orders/${order.id}`}>{order.code}</Link>
                                        </td>
                                        <td className="p-4 text-sm text-gray-800">{order.title}</td>
                                        <td className="p-4 text-sm">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${order.workshopType === 'KAYU' ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-800'}`}>
                                                {order.workshopType}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-gray-600">
                                            {order.requestedBy?.name || 'Sistem'}
                                            {order.unit && <span className="block text-xs text-gray-400">{order.unit.name}</span>}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                                {order.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

        </div>
    );
}

export default WorkshopDashboard;
