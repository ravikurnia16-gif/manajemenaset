import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FileText, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import api from '../lib/axios';

const DashboardSarpras = () => {
    const [stats, setStats] = useState({
        totalOutgoing: 0,
        pendingApproval: 0,
        completedBAST: 0,
        sopReviewSoon: 0,
        documentsByMonth: [],
        documentTypes: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // In a real app, this would be an aggregate endpoint like /api/dashboard/sarpras
                // For demonstration, we fetch documents and compute client-side or assume a mock if no endpoint
                const res = await api.get('/documents');
                const docs = Array.isArray(res.data) ? res.data : [];

                const outgoing = docs.filter(d => d.type === 'SURAT_KELUAR' || d.categoryId === 1).length;
                const pending = docs.filter(d => ['WAITING_PARAF', 'WAITING_SIGN'].includes(d.status)).length;
                const bast = docs.filter(d => (d.type === 'BAST' || d.categoryId === 2) && d.status === 'SIGNED').length;
                
                const now = new Date();
                const nextMonth = new Date();
                nextMonth.setMonth(now.getMonth() + 1);
                
                const sopReview = docs.filter(d => {
                    if ((d.type !== 'SOP' && d.categoryId !== 3) || !d.reviewDate) return false;
                    const rDate = new Date(d.reviewDate);
                    return rDate <= nextMonth && rDate >= now;
                }).length;

                // Mocking monthly data for chart
                const monthlyData = [
                    { name: 'Jan', count: 12 }, { name: 'Feb', count: 19 }, { name: 'Mar', count: 15 },
                    { name: 'Apr', count: outgoing || 5 }, { name: 'May', count: 0 }, { name: 'Jun', count: 0 }
                ];

                const typeData = [
                    { name: 'Surat Keluar', value: outgoing || 1 },
                    { name: 'BAST', value: bast || 1 },
                    { name: 'SOP', value: docs.filter(d => d.type === 'SOP').length || 1 },
                    { name: 'Lainnya', value: docs.filter(d => !['SURAT_KELUAR', 'BAST', 'SOP'].includes(d.type)).length || 1 }
                ];

                setStats({
                    totalOutgoing: outgoing,
                    pendingApproval: pending,
                    completedBAST: bast,
                    sopReviewSoon: sopReview,
                    documentsByMonth: monthlyData,
                    documentTypes: typeData
                });
            } catch (err) {
                console.error("Failed to load dashboard data", err);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#64748b'];

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-screen bg-slate-50/50">
            <div className="mb-8">
                <h1 className="text-3xl font-black text-slate-800">Dashboard E-Office Sarpras</h1>
                <p className="text-slate-500 font-medium">Ringkasan aktivitas dan status dokumen naskah dinas.</p>
            </div>

            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <FileText size={28} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Surat Keluar Bulan Ini</p>
                        <h2 className="text-3xl font-black text-slate-800 mt-1">{stats.totalOutgoing}</h2>
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500">
                        <Clock size={28} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pending Approval</p>
                        <h2 className="text-3xl font-black text-slate-800 mt-1">{stats.pendingApproval}</h2>
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                        <CheckCircle size={28} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">BAST Selesai</p>
                        <h2 className="text-3xl font-black text-slate-800 mt-1">{stats.completedBAST}</h2>
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500">
                        <AlertTriangle size={28} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">SOP Mendekati Review</p>
                        <h2 className="text-3xl font-black text-slate-800 mt-1">{stats.sopReviewSoon}</h2>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Statistik Surat Keluar</h3>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.documentsByMonth} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <RechartsTooltip 
                                    cursor={{fill: '#f8fafc'}}
                                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="count" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Distribusi Tipe Dokumen</h3>
                    <div className="h-64 w-full flex justify-center items-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.documentTypes}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={90}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {stats.documentTypes.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap justify-center gap-4 mt-2">
                        {stats.documentTypes.map((entry, index) => (
                            <div key={entry.name} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                <span className="text-xs font-semibold text-slate-600">{entry.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardSarpras;
