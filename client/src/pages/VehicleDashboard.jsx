import { useState, useEffect } from 'react';
import { Car, Calendar, Wrench, AlertOctagon, TrendingUp, Loader2, Fuel, DollarSign, Activity, AlertCircle, Gauge, Filter, ChevronDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import api from '../lib/axios';

const StatCard = ({ title, value, icon: Icon, color, desc }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start justify-between hover:shadow-md transition-all">
        <div>
            <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-1">{title}</p>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">{value}</h3>
            {desc && <p className="text-[10px] font-bold text-slate-400 mt-2 bg-slate-50 px-2 py-0.5 rounded-full inline-block">{desc}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color} text-white shadow-lg`}>
            <Icon size={24} />
        </div>
    </div>
);

const VehicleDashboard = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({ month: '', year: '' }); // '' means Summary

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const query = filter.month && filter.year ? `?month=${filter.month}&year=${filter.year}` : '';
                const res = await api.get(`/vehicles/dashboard${query}`);
                setData(res.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [filter]);

    const handleFilterChange = (val) => {
        if (val === 'summary') {
            setFilter({ month: '', year: '' });
        } else {
            const [y, m] = val.split('-');
            setFilter({ month: m, year: y });
        }
    };

    if (loading && !data) return (
        <div className="flex h-96 items-center justify-center">
            <Loader2 className="animate-spin text-indigo-600" size={40} />
        </div>
    );

    const stats = [
        { title: "Total Armada", value: data?.stats?.totalVehicles || 0, icon: Car, color: "bg-slate-800", desc: "Unit aktif terdaftar" },
        { title: "Efisiensi Armada", value: `${data?.stats?.fleetKml?.toFixed(1) || 0} KM/L`, icon: Gauge, color: "bg-emerald-600", desc: data?.isSummary ? "Rata-rata 30 hari" : `Periode ${data?.period}` },
        { title: "Biaya Operasional", value: `Rp ${Math.round(data?.stats?.fleetCostPerKm || 0).toLocaleString('id-ID')}/KM`, icon: TrendingUp, color: "bg-indigo-600", desc: `Biaya BBM & Servis` },
        { title: "Peminjaman", value: data?.stats?.activeBookings || 0, icon: Activity, color: "bg-blue-600", desc: "Sedang berjalan" },
        { title: "Jadwal Servis", value: data?.stats?.needingService || 0, icon: Wrench, color: "bg-orange-500", desc: "Odometer Overdue" },
        { title: "Pajak & Dokumen", value: data?.stats?.taxWarnings || 0, icon: AlertOctagon, color: "bg-red-600", desc: "Jatuh tempo < 30 Hari" },
    ];

    const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
            {/* Header with Filter */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3 italic">
                        <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100"><Activity size={24}/></div> DASHBOARD ARMADA
                    </h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">Monitoring proaktif efisiensi dan kepatuhan unit kendaraan.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                        <Filter size={16} className="text-slate-400" />
                        <select 
                            className="bg-transparent text-sm font-black text-slate-700 outline-none cursor-pointer"
                            value={filter.month ? `${filter.year}-${filter.month}` : 'summary'}
                            onChange={(e) => handleFilterChange(e.target.value)}
                        >
                            <option value="summary">📊 Ringkasan Semua Bulan</option>
                            {data?.availableMonths?.map(m => (
                                <option key={m} value={m}>
                                    📅 {new Date(m + '-01').toLocaleString('id-ID', { month: 'long', year: 'numeric' })}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Alerts - Always Real-time */}
            {data?.urgentActions?.length > 0 && (
                <div className="bg-white rounded-3xl border border-red-100 shadow-xl shadow-red-50/50 overflow-hidden animate-in slide-in-from-top-4 duration-700">
                    <div className="p-5 bg-gradient-to-r from-red-50 to-white flex items-center justify-between">
                        <h3 className="text-sm font-black text-red-800 flex items-center gap-2 uppercase tracking-widest">
                            <AlertCircle size={18} className="animate-bounce" /> Pusat Tindakan Segera (Urgent)
                        </h3>
                        <div className="px-3 py-1 bg-red-600 text-white text-[10px] font-black rounded-full uppercase tracking-tighter shadow-md shadow-red-200">
                            {data.urgentActions.length} Peringatan Aktif
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50 border-b border-slate-100">
                                <tr>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit Armada</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Aksi Dibutuhkan</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Deadline / Status</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Navigasi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {data.urgentActions.map((alert, i) => (
                                    <tr key={i} className="hover:bg-red-50/10 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-700 text-sm group-hover:text-red-700 transition-colors">{alert.vehicle}</span>
                                                <span className="text-[10px] text-slate-400 font-mono font-bold">{alert.plate}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight shadow-sm ${
                                                alert.type === 'SERVICE' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                                {alert.action}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="text-sm font-black text-slate-600">
                                                {alert.date ? new Date(alert.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : `Odometer > ${alert.km} KM`}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <button className="text-xs font-black text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-4 py-1.5 rounded-xl transition-all">PROSES</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* KPI Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                {stats.map((s, i) => <StatCard key={i} {...s} />)}
            </div>

            {/* Performance Matrix */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight italic">Matriks Performa Armada</h3>
                        <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">
                            {data?.isSummary ? "Analisa Rata-Rata 30 Hari Terakhir" : `Analisa Bulan ${new Date(filter.year, filter.month-1).toLocaleString('id-ID', {month: 'long', year: 'numeric'})}`}
                        </p>
                    </div>
                </div>
                <div className="overflow-x-auto -mx-8">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50/50">
                            <tr>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Kendaraan</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Efisiensi (KM/L)</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Utilisasi (%)</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Cost / KM</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total Jarak</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-600">
                            {data?.vStats?.map((v, i) => (
                                <tr key={i} className="hover:bg-slate-50/30 transition-colors group">
                                    <td className="px-8 py-5">
                                        <div className="flex flex-col">
                                            <span className="font-black text-slate-800 text-sm">{v.name}</span>
                                            <span className="text-[10px] text-slate-400 font-mono font-bold">{v.plate}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-center">
                                        <div className="flex items-center justify-center gap-3">
                                            <span className={`text-sm font-black ${v.kml > 10 ? 'text-emerald-600' : 'text-slate-700'}`}>{v.kml?.toFixed(1) || '-'}</span>
                                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                                <div className={`h-full ${v.kml > 10 ? 'bg-emerald-500' : 'bg-orange-400'}`} style={{ width: `${Math.min(v.kml * 5, 100)}%` }}></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-center">
                                        <div className="flex flex-col items-center gap-1.5">
                                            <span className="text-xs font-black text-slate-800">{v.utilization?.toFixed(0)}%</span>
                                            <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                                <div className={`h-full shadow-lg ${v.utilization > 50 ? 'bg-indigo-500' : 'bg-slate-300'}`} style={{ width: `${v.utilization}%` }}></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-center font-bold text-sm">
                                        <span className="bg-slate-100 px-3 py-1 rounded-lg text-slate-700">Rp {Math.round(v.cpkm).toLocaleString('id-ID')}</span>
                                    </td>
                                    <td className="px-8 py-5 text-right font-black text-indigo-600 text-sm italic">
                                        {v.totalKm?.toLocaleString('id-ID')} KM
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tren Jarak Tempuh - ALL VEHICLES */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 lg:col-span-2">
                    <h3 className="text-lg font-black text-slate-800 mb-8 flex items-center gap-3 uppercase tracking-tight italic">
                        <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><TrendingUp size={20} /></div> Tren Jarak Tempuh Bulanan (KM) - Seluruh Armada
                    </h3>
                    <div className="h-96">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <LineChart data={data?.mileageTrends} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(value) => value.toLocaleString('id-ID')} />
                                <Tooltip formatter={(value) => `${value.toLocaleString('id-ID')} km`} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '20px', fontWeight: 'bold' }} iconType="circle" />
                                {(data?.allVehicleNames || []).map((vName, idx) => (
                                    <Line key={vName} type="monotone" dataKey={vName} stroke={COLORS[idx % COLORS.length]} strokeWidth={4} dot={{ r: 5, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 8, strokeWidth: 0 }} animationDuration={1500} />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Tren Peminjaman */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-black text-slate-800 mb-8 uppercase tracking-tight italic">Tren Peminjaman Bulanan (Total)</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <BarChart data={data?.bookingTrends}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ fill: '#f8fafc' }}
                                />
                                <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} barSize={45}>
                                    {data?.bookingTrends?.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === data.bookingTrends.length - 1 ? '#4f46e5' : '#c7d2fe'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Destinasi Ringkasan */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center">
                    <div className="text-center">
                         <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Calendar size={32} />
                         </div>
                         <h4 className="text-slate-800 font-black uppercase tracking-widest text-sm italic">Summary Report</h4>
                         <p className="text-slate-400 text-xs font-bold mt-2">Pilih bulan di atas untuk analisa detail performa & efisiensi armada ustadz.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VehicleDashboard;
