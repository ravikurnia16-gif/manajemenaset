import { useState, useEffect } from 'react';
import { Car, Calendar, Wrench, AlertOctagon, TrendingUp, Loader2, Fuel, DollarSign, Activity, AlertCircle, Gauge } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import api from '../lib/axios';

const StatCard = ({ title, value, icon: Icon, color, desc }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between">
        <div>
            <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
            <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
            {desc && <p className="text-xs text-slate-400 mt-2">{desc}</p>}
        </div>
        <div className={`p-3 rounded-lg ${color} text-white shadow-md`}>
            <Icon size={24} />
        </div>
    </div>
);

const VehicleDashboard = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await api.get('/vehicles/dashboard');
                setData(res.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return (
        <div className="flex h-96 items-center justify-center">
            <Loader2 className="animate-spin text-purple-600" size={40} />
        </div>
    );

    const stats = [
        { title: "Total Armada", value: data?.stats?.totalVehicles || 0, icon: Car, color: "bg-slate-800", desc: "Unit aktif" },
        { title: "Peminjaman Aktif", value: data?.stats?.activeBookings || 0, icon: Activity, color: "bg-blue-600", desc: "Sedang beroperasi" },
        { title: "Perlu Servis", value: data?.stats?.needingService || 0, icon: Wrench, color: "bg-orange-500", desc: "Berdasarkan Odometer" },
        { title: "Pajak/KIR/STNK", value: data?.stats?.taxWarnings || 0, icon: AlertOctagon, color: "bg-red-600", desc: "Jatuh tempo < 30 hari" },
        { title: "Efisiensi Armada", value: `${data?.stats?.fleetKml?.toFixed(1) || 0} KM/L`, icon: Gauge, color: "bg-emerald-600", desc: "Rata-rata penggunaan BBM" },
        { title: "Biaya per KM", value: `Rp ${Math.round(data?.stats?.fleetCostPerKm || 0).toLocaleString('id-ID')}`, icon: TrendingUp, color: "bg-indigo-600", desc: "Estimasi biaya op. per KM" },
    ];

    const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">DASHBOARD ARMADA & ANALITIK</h1>
                    <p className="text-slate-500 text-sm font-medium">Monitoring operasional harian dan efisiensi biaya kendaraan</p>
                </div>
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Real-time Operations</span>
                </div>
            </div>

            {/* NEW: Action Required Alerts Section */}
            {data?.urgentActions?.length > 0 && (
                <div className="bg-white rounded-2xl border-2 border-red-50 shadow-xl overflow-hidden animate-in zoom-in-95 duration-500">
                    <div className="p-4 bg-red-50 border-b border-red-100 flex items-center justify-between">
                        <h3 className="text-sm font-black text-red-800 flex items-center gap-2 uppercase tracking-widest">
                            <AlertCircle size={18} /> Pusat Tindakan Segera (Alerts)
                        </h3>
                        <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded-full">{data.urgentActions.length} Peringatan</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50">
                                <tr>
                                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kendaraan</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tindakan</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Keterangan / Deadline</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {data.urgentActions.map((alert, i) => (
                                    <tr key={i} className="hover:bg-red-50/10 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700 text-sm">{alert.vehicle}</span>
                                                <span className="text-[10px] text-slate-400 font-mono">{alert.plate}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${
                                                alert.type === 'SERVICE' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                                {alert.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-medium text-slate-600">
                                                {alert.date ? new Date(alert.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : `Odometer > ${alert.km} KM`}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="text-xs font-bold text-blue-600 hover:underline">Proses Sekarang</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stats.map((s, i) => <StatCard key={i} {...s} />)}
            </div>

            {/* NEW: Vehicle Performance Matrix */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 tracking-tight">Matriks Performa Per Armada</h3>
                        <p className="text-xs text-slate-400">Analisa efisiensi dan utilisasi 30 hari terakhir</p>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50">
                            <tr>
                                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nama Kendaraan</th>
                                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Efisiensi (KM/L)</th>
                                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Utilisasi (%)</th>
                                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Biaya / KM</th>
                                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Total Jarak (30d)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {data?.vStats?.map((v, i) => (
                                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-4 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-700 text-sm">{v.name}</span>
                                            <span className="text-[10px] text-slate-400 font-mono tracking-tight">{v.plate}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <span className={`text-sm font-black ${v.kml > 10 ? 'text-green-600' : 'text-slate-600'}`}>{v.kml?.toFixed(1) || '-'}</span>
                                            <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500" style={{ width: `${Math.min(v.kml * 5, 100)}%` }}></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-xs font-bold text-slate-700">{v.utilization?.toFixed(0)}%</span>
                                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className={`h-full ${v.utilization > 50 ? 'bg-blue-500' : 'bg-slate-300'}`} style={{ width: `${v.utilization}%` }}></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <span className="text-xs font-bold text-slate-600 text-sm">
                                            Rp {Math.round(v.cpkm).toLocaleString('id-ID')}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-black text-slate-600">
                                            {v.totalKm?.toLocaleString('id-ID')} KM
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Tren Peminjaman */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Tren Peminjaman Bulanan</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <BarChart data={data?.bookingTrends}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ fill: '#f8fafc' }}
                                />
                                <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={35} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3. Jarak Tempuh per Armada */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 text-indigo-600">
                        <TrendingUp size={18} /> Tren Jarak Tempuh Bulanan (KM)
                    </h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <LineChart data={data?.mileageTrends} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(value) => value.toLocaleString('id-ID')} />
                                <Tooltip formatter={(value) => `${value.toLocaleString('id-ID')} km`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} iconType="circle" />
                                {(data?.allVehicleNames || []).slice(0, 5).map((vName, idx) => (
                                    <Line key={vName} type="monotone" dataKey={vName} stroke={COLORS[idx % COLORS.length]} strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 4. Destinasi Terpopuler */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        Top Destinasi
                    </h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <BarChart data={data?.topDestinations} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} width={80} />
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} cursor={{ fill: '#f8fafc' }} />
                                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={25} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 5. Armada Paling Sering Digunakan */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        Armada Teraktif
                    </h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <BarChart data={data?.topVehicles} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} width={100} />
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} cursor={{ fill: '#f8fafc' }} />
                                <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} barSize={25} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VehicleDashboard;
