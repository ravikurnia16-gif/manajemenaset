import React, { useState, useEffect } from 'react';
import {
    Wrench,
    HardHat,
    Cog,
    Clock,
    CheckCircle2,
    Activity,
    Plus,
    FileText,
    ArrowRight,
    AlertTriangle,
    Kanban,
    Calendar,
    Users,
    ChevronRight,
    Sparkles,
    ShieldAlert,
    Boxes,
    FileSpreadsheet
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../lib/axios';

function WorkshopBaruDashboard() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalOrders: 0,
        inProgress: 0,
        completed: 0,
        byType: { KAYU: 0, BESI: 0 },
        recentOrders: []
    });
    const [allOrders, setAllOrders] = useState([]);

    const userStr = localStorage.getItem('user');
    const userObj = userStr ? JSON.parse(userStr) : null;
    const isUnit21 = userObj?.unitId === 21;

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [statsRes, ordersRes] = await Promise.all([
                api.get('/workshop/dashboard'),
                api.get('/workshop/orders')
            ]);
            setStats(statsRes.data || {});
            setAllOrders(ordersRes.data || []);
        } catch (error) {
            console.error('Error fetching workshop data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Derived statistics
    const pendingOrders = allOrders.filter(o => o.status === 'PENDING' || o.status === 'DRAFT');
    const inProgressOrders = allOrders.filter(o => o.status === 'IN_PROGRESS');
    const qcOrders = allOrders.filter(o => o.status === 'QUALITY_CHECK');
    const completedOrders = allOrders.filter(o => o.status === 'COMPLETED');

    // Deadline warnings (due in <= 3 days and not completed/cancelled)
    const urgentOrNearDeadline = allOrders.filter(o => {
        if (['COMPLETED', 'CANCELLED'].includes(o.status)) return false;
        if (o.priority === 'URGENT' || o.priority === 'HIGH') return true;
        if (o.deadline) {
            const diffDays = (new Date(o.deadline) - new Date()) / (1000 * 60 * 60 * 24);
            return diffDays <= 3;
        }
        return false;
    });

    const getStatusBadge = (status) => {
        const config = {
            DRAFT: { label: 'Draft', bg: 'bg-slate-100 text-slate-700 border-slate-200' },
            PENDING: { label: 'Antrean Masuk', bg: 'bg-amber-100 text-amber-800 border-amber-200' },
            IN_PROGRESS: { label: 'Dikerjakan', bg: 'bg-blue-100 text-blue-800 border-blue-200' },
            QUALITY_CHECK: { label: 'Pemeriksaan QC', bg: 'bg-purple-100 text-purple-800 border-purple-200' },
            COMPLETED: { label: 'Selesai', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
            CANCELLED: { label: 'Dibatalkan', bg: 'bg-rose-100 text-rose-800 border-rose-200' },
        };
        const item = config[status] || { label: status, bg: 'bg-slate-100 text-slate-700 border-slate-200' };
        return (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${item.bg}`}>
                {item.label}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="p-8 flex flex-col items-center justify-center min-h-[400px] text-slate-500">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-sm font-medium">Memuat Dashboard Workshop Unit 21...</p>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
            {/* Header Unit 21 Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-emerald-900/40">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold tracking-wider uppercase mb-2 border border-emerald-500/30">
                            <Sparkles size={14} /> Unit 21 • Workshop & Produksi
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                            Pusat Kendali Workshop
                        </h1>
                        <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
                            Manajemen alur kerja bengkel pengerjaan kayu dan besi, antrean pemesanan dari seluruh unit, pemantauan progres pengerjaan, hingga serah terima fisik.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        <Link
                            to="/workshop-baru/board"
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold backdrop-blur-sm border border-white/10 transition-all shadow-sm"
                        >
                            <Kanban size={15} /> Papan Kerja
                        </Link>
                        <Link
                            to="/workshop-baru/catalog"
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold backdrop-blur-sm border border-white/10 transition-all shadow-sm"
                        >
                            <Boxes size={15} /> Katalog Workshop
                        </Link>
                        <Link
                            to="/workshop-baru/export"
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold backdrop-blur-sm border border-white/10 transition-all shadow-sm"
                        >
                            <FileSpreadsheet size={15} /> Ekspor
                        </Link>
                        <Link
                            to="/workshop-baru/orders/new"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs sm:text-sm font-semibold transition-all shadow-md hover:shadow-emerald-500/30 hover:scale-105"
                        >
                            <Plus size={15} /> Pesanan Baru
                        </Link>
                    </div>
                </div>

                {/* Subtle decorative background glow */}
                <div className="absolute -right-16 -top-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
            </div>

            {/* Metric Overview Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Antrean Masuk</span>
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                            <Clock size={20} />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl sm:text-3xl font-black text-slate-800">{pendingOrders.length}</div>
                        <p className="text-xs text-slate-500 mt-1">Perlu diverifikasi & dijadwalkan</p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sedang Pengerjaan</span>
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Activity size={20} />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl sm:text-3xl font-black text-slate-800">{inProgressOrders.length}</div>
                        <p className="text-xs text-slate-500 mt-1">Dalam proses tukang bengkel</p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pemeriksaan QC</span>
                        <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                            <CheckCircle2 size={20} />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl sm:text-3xl font-black text-slate-800">{qcOrders.length}</div>
                        <p className="text-xs text-slate-500 mt-1">Finishing & cek kualitas fisik</p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Selesai</span>
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <CheckCircle2 size={20} />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl sm:text-3xl font-black text-slate-800">{completedOrders.length}</div>
                        <p className="text-xs text-slate-500 mt-1">Pekerjaan telah rampung</p>
                    </div>
                </div>
            </div>

            {/* Split Section: Spesialisasi Workshop Kayu & Besi */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Workshop Kayu Card */}
                <div className="bg-gradient-to-br from-amber-50/70 to-orange-50/40 p-6 rounded-2xl border border-amber-200/70 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20">
                                    <HardHat size={24} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">Workshop Kayu (Carpentry)</h2>
                                    <p className="text-xs text-slate-500">Mebel, kusen, partisi, meja-kursi & pekerjaan kayu</p>
                                </div>
                            </div>
                            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-orange-200 text-orange-800">
                                {stats.byType?.KAYU || 0} Order
                            </span>
                        </div>
                        <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                            Pusat fabrikasi dan perbaikan barang inventaris berbasis kayu untuk kebutuhan operasional sekolah dan kantor.
                        </p>
                    </div>

                    <div className="pt-4 border-t border-amber-200/60 flex items-center justify-between">
                        <span className="text-xs text-slate-500">Divisi Kayu Unit 21</span>
                        <Link
                            to="/workshop-baru/board?type=KAYU"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-700 hover:text-orange-900 transition-colors"
                        >
                            Buka Antrean Kayu <ArrowRight size={14} />
                        </Link>
                    </div>
                </div>

                {/* Workshop Besi Card */}
                <div className="bg-gradient-to-br from-slate-100/90 to-blue-50/40 p-6 rounded-2xl border border-slate-300/70 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-slate-800 text-white flex items-center justify-center shadow-md shadow-slate-800/20">
                                    <Cog size={24} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">Workshop Besi (Welding & Las)</h2>
                                    <p className="text-xs text-slate-500">Pagar, tralis, kanopi, rangka besi & pengelasan</p>
                                </div>
                            </div>
                            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-slate-200 text-slate-800">
                                {stats.byType?.BESI || 0} Order
                            </span>
                        </div>
                        <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                            Fabrikasi struktur besi, pengelasan konstruksi ringan, dan pemeliharaan sarana pengaman gedung.
                        </p>
                    </div>

                    <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-xs text-slate-500">Divisi Besi Unit 21</span>
                        <Link
                            to="/workshop-baru/board?type=BESI"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 hover:text-slate-950 transition-colors"
                        >
                            Buka Antrean Besi <ArrowRight size={14} />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Section: Prioritas Mendesak / Mendekati Deadline */}
            {urgentOrNearDeadline.length > 0 && (
                <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
                            <AlertTriangle size={18} className="text-rose-600" />
                            Perhatian: Pesanan Prioritas & Mendekati Batas Waktu ({urgentOrNearDeadline.length})
                        </div>
                        <Link to="/workshop-baru/board?priority=URGENT" className="text-xs font-semibold text-rose-700 hover:underline">
                            Lihat Semua
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {urgentOrNearDeadline.slice(0, 3).map(order => (
                            <div
                                key={order.id}
                                onClick={() => navigate(`/workshop-baru/orders/${order.id}`)}
                                className="bg-white p-3.5 rounded-xl border border-rose-200/80 shadow-xs hover:shadow-md cursor-pointer transition-all flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                                        <span className="font-mono font-bold text-slate-700">{order.code}</span>
                                        <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-md font-extrabold uppercase text-[10px]">
                                            {order.priority}
                                        </span>
                                    </div>
                                    <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{order.title}</h4>
                                    <p className="text-[11px] text-slate-500 mt-1">
                                        Unit: <span className="font-medium text-slate-700">{order.unit?.name || '-'}</span>
                                    </p>
                                </div>
                                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                                    <span className="flex items-center gap-1">
                                        <Calendar size={12} /> {order.deadline ? new Date(order.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : 'Tidak ada'}
                                    </span>
                                    {getStatusBadge(order.status)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Section: Pesanan Terbaru di Bengkel */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-slate-800 text-base">Antrean Pesanan Workshop Terbaru</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Daftar order yang masuk dan sedang berjalan di Unit 21</p>
                    </div>
                    <Link
                        to="/workshop-baru/board"
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                    >
                        Buka Semua <ChevronRight size={14} />
                    </Link>
                </div>

                <div className="divide-y divide-slate-100">
                    {allOrders.slice(0, 6).map((order) => (
                        <div
                            key={order.id}
                            onClick={() => navigate(`/workshop-baru/orders/${order.id}`)}
                            className="p-4 hover:bg-slate-50/80 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                            <div className="flex items-start gap-3.5">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                    order.workshopType === 'KAYU'
                                        ? 'bg-orange-100 text-orange-700'
                                        : 'bg-slate-100 text-slate-700'
                                }`}>
                                    {order.workshopType === 'KAYU' ? <HardHat size={20} /> : <Cog size={20} />}
                                </div>
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-mono text-xs font-bold text-slate-700">{order.code}</span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                            order.workshopType === 'KAYU' ? 'bg-orange-50 text-orange-700' : 'bg-slate-100 text-slate-700'
                                        }`}>
                                            {order.workshopType || 'UMUM'}
                                        </span>
                                        {order.priority === 'URGENT' && (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                                                URGENT
                                            </span>
                                        )}
                                    </div>
                                    <h4 className="text-sm font-semibold text-slate-900 mt-1">{order.title}</h4>
                                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                                        <span>Pemesan: <strong className="text-slate-700">{order.requestedBy?.name || '-'}</strong> ({order.unit?.name || '-'})</span>
                                        {order.picName && <span>• PIC: <strong className="text-slate-700">{order.picName}</strong></span>}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                                <div className="text-right hidden sm:block">
                                    <div className="text-xs text-slate-500">Target Selesai</div>
                                    <div className="text-xs font-medium text-slate-700">
                                        {order.deadline ? new Date(order.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                    </div>
                                </div>
                                {getStatusBadge(order.status)}
                                <ChevronRight size={18} className="text-slate-400" />
                            </div>
                        </div>
                    ))}

                    {allOrders.length === 0 && (
                        <div className="p-12 text-center text-slate-400 text-sm">
                            Belum ada pesanan workshop yang terdaftar.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default WorkshopBaruDashboard;
