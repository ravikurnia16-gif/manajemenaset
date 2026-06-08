import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { MessageSquare, Users, Star, TrendingUp, User, Clock, Building2 } from 'lucide-react';
import api from '../lib/axios';

const COLORS = ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#22c55e'];
const RATING_LABELS = { 1: 'Sangat Kurang', 2: 'Kurang', 3: 'Cukup', 4: 'Baik', 5: 'Sangat Baik' };

const SurveyDashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await api.get('/surveys/stats');
                setStats(res.data);
            } catch (error) {
                console.error('Fetch survey stats error:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) {
        return <div className="text-center py-12 text-slate-500">Memuat dashboard hasil survey...</div>;
    }

    if (!stats) {
        return <div className="text-center py-12 text-red-500">Gagal memuat data survey.</div>;
    }

    // Format distribution for PieChart
    const distributionData = [1, 2, 3, 4, 5].map(val => {
        const found = stats.distribution.find(d => d.ratingValue === val);
        return {
            name: `${val} Bintang (${RATING_LABELS[val]})`,
            value: found ? found._count.ratingValue : 0,
            rating: val
        };
    }).filter(d => d.value > 0);

    // Calculate Overall Satisfaction Index (IKM)
    // Formula: (Total Sum of all ratings) / (Total responses * number of questions * 5) * 100
    // Simplified: Average of all averages / 5 * 100
    let overallIndex = 0;
    if (stats.stats.length > 0) {
        const sumAvg = stats.stats.reduce((acc, curr) => acc + curr.average, 0);
        overallIndex = ((sumAvg / stats.stats.length) / 5) * 100;
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <TrendingUp className="text-blue-500" />
                    Dashboard Hasil Survey
                </h1>
                <p className="text-slate-500 text-sm">Analisis tingkat kepuasan pengguna terhadap layanan Bidang Sarana.</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">Total Responden</p>
                        <h3 className="text-2xl font-bold text-slate-800">{stats.totalResponses}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                        <Star size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">Indeks Kepuasan</p>
                        <h3 className="text-2xl font-bold text-slate-800">{overallIndex.toFixed(1)}%</h3>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Average Rating Per Question Chart */}
                <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-6">Rata-rata Nilai per Kategori</h3>
                    {stats.stats.length > 0 ? (
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.stats} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                    <XAxis type="number" domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} />
                                    <YAxis dataKey="text" type="category" width={150} tick={{ fontSize: 11 }} />
                                    <Tooltip 
                                        formatter={(value) => [value.toFixed(2), 'Rata-rata']}
                                    />
                                    <Bar dataKey="average" radius={[0, 4, 4, 0]} barSize={20}>
                                        {stats.stats.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill="#3b82f6" />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-slate-400">Belum ada data rating.</div>
                    )}
                </div>

                {/* Distribution Chart */}
                <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-6">Distribusi Rating Keseluruhan</h3>
                    {distributionData.length > 0 ? (
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={distributionData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {distributionData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[entry.rating - 1]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-slate-400">Belum ada data rating.</div>
                    )}
                </div>
            </div>

            {/* Feedbacks List */}
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <MessageSquare size={18} className="text-blue-500" />
                    Umpan Balik & Saran Terbaru
                </h3>
                
                {stats.feedbacks.length > 0 ? (
                    <div className="space-y-4">
                        {stats.feedbacks.map(fb => (
                            <div key={fb.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                                            <User size={14} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-slate-800">{fb.respondentName || 'Anonim'}</p>
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <span className="flex items-center gap-1"><Building2 size={12}/> {fb.respondentUnit || '-'}</span>
                                                <span>•</span>
                                                <span className="flex items-center gap-1"><Clock size={12}/> {new Date(fb.createdAt).toLocaleString('id-ID')}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded uppercase">
                                        Kritik & Saran
                                    </span>
                                </div>
                                <p className="text-sm text-slate-700 mt-3 whitespace-pre-wrap pl-11">
                                    "{fb.feedback}"
                                </p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                        <MessageSquare size={48} className="mx-auto text-slate-300 mb-3" />
                        <h3 className="text-lg font-bold text-slate-700">Belum ada saran/masukan</h3>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SurveyDashboard;
