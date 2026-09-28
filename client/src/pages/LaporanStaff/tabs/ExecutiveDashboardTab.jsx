import React, { useMemo } from 'react';
import { 
    CheckCircle2, AlertCircle, FileText, Camera, Sparkles, TrendingUp, 
    Wrench, AlertTriangle, Send, Award, User, Loader2, BellRing, Bell 
} from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
    CartesianGrid, PieChart, Pie, Cell, Legend 
} from 'recharts';
import api from '../../../lib/axios';
import { getMediaUrl } from '../../../lib/media';
import { CHART_COLORS } from '../constants';

const ExecutiveDashboardTab = ({
    dashboardData,
    selectedDate,
    setSelectedDate,
    aiRangePreset,
    setAiRangePreset,
    setAiPreset,
    aiStartDate,
    setAiStartDate,
    aiEndDate,
    setAiEndDate,
    runAiAnalysis,
    handleRemindStaff,
    remindingStaff,
    setLightboxPhoto,
    fetchDashboardAnalytics
}) => {
    // Category chart data
    const categoryPieData = useMemo(() => {
        if (!dashboardData?.categoryCounts) return [];
        return Object.entries(dashboardData.categoryCounts)
            .filter(([_, val]) => val > 0)
            .map(([key, val]) => ({ name: key, value: val }));
    }, [dashboardData]);

    if (!dashboardData) return null;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kepatuhan Hari Ini</p>
                        <h3 className="text-2xl font-black text-slate-800 mt-1">{dashboardData.summary?.complianceRate}%</h3>
                        <p className="text-xs text-emerald-600 font-bold mt-0.5">{dashboardData.summary?.lengkapCount} dari {dashboardData.summary?.totalStaff} staf lengkap</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                        <CheckCircle2 size={24} />
                    </div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Belum Lapor</p>
                        <h3 className="text-2xl font-black text-rose-600 mt-1">{dashboardData.summary?.belumCount} Staf</h3>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">Parsial: {dashboardData.summary?.parsialCount} staf</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                        <AlertCircle size={24} />
                    </div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Butir Pekerjaan</p>
                        <h3 className="text-2xl font-black text-slate-800 mt-1">{dashboardData.summary?.totalActivitiesToday}</h3>
                        <p className="text-xs text-blue-600 font-bold mt-0.5">Tercatat hari ini</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <FileText size={24} />
                    </div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Foto Dokumentasi</p>
                        <h3 className="text-2xl font-black text-slate-800 mt-1">{dashboardData.summary?.totalPhotosToday} Foto</h3>
                        <p className="text-xs text-violet-600 font-bold mt-0.5">Tersimpan di MinIO</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
                        <Camera size={24} />
                    </div>
                </div>
            </div>

            {/* AI BANNER & DATE RANGE ANALYSIS */}
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-xl space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-amber-400 font-black text-xs uppercase tracking-widest">
                            <Sparkles size={16} /> Analitik Cerdas AI (Google Gemini)
                        </div>
                        <h3 className="text-lg font-bold">Ringkasan Eksekutif & Evaluasi Kinerja Tim Berdasarkan Rentang Tanggal</h3>
                        <p className="text-xs text-slate-300">Pilih rentang tanggal untuk menganalisis pencapaian staf, evaluasi beban kerja, atau solusi kendala.</p>
                    </div>
                </div>

                {/* DATE RANGE SELECTOR & PRESETS */}
                <div className="flex flex-wrap items-center gap-3 bg-white/10 p-3.5 rounded-2xl border border-white/10 backdrop-blur-xs">
                    <div className="flex items-center gap-1 bg-black/20 p-1 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setAiPreset('TODAY')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                aiRangePreset === 'TODAY' ? 'bg-amber-500 text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white'
                            }`}
                        >
                            Hari Ini
                        </button>
                        <button
                            type="button"
                            onClick={() => setAiPreset('WEEK')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                aiRangePreset === 'WEEK' ? 'bg-amber-500 text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white'
                            }`}
                        >
                            Pekan Ini
                        </button>
                        <button
                            type="button"
                            onClick={() => setAiPreset('MONTH')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                aiRangePreset === 'MONTH' ? 'bg-amber-500 text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white'
                            }`}
                        >
                            Bulan Ini
                        </button>
                        <button
                            type="button"
                            onClick={() => setAiRangePreset('CUSTOM')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                aiRangePreset === 'CUSTOM' ? 'bg-amber-500 text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white'
                            }`}
                        >
                            Kustom
                        </button>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-bold">
                        <span className="text-slate-300">Dari:</span>
                        <input 
                            type="date"
                            value={aiStartDate}
                            onChange={(e) => {
                                setAiStartDate(e.target.value);
                                setAiRangePreset('CUSTOM');
                            }}
                            className="bg-black/30 border border-white/20 px-2.5 py-1.5 rounded-xl text-white text-xs outline-none cursor-pointer focus:border-amber-400"
                        />
                        <span className="text-slate-300">s.d.</span>
                        <input 
                            type="date"
                            value={aiEndDate}
                            onChange={(e) => {
                                setAiEndDate(e.target.value);
                                setAiRangePreset('CUSTOM');
                            }}
                            className="bg-black/30 border border-white/20 px-2.5 py-1.5 rounded-xl text-white text-xs outline-none cursor-pointer focus:border-amber-400"
                        />
                    </div>

                    <div className="ml-auto flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => runAiAnalysis('DAILY_DIGEST')}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
                        >
                            <Sparkles size={14} /> ✨ Ringkasan Eksekutif
                        </button>
                        <button
                            onClick={() => runAiAnalysis('TEAM_PERFORMANCE')}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-indigo-400/30 cursor-pointer"
                        >
                            <TrendingUp size={14} /> Evaluasi Tim
                        </button>
                        <button
                            onClick={() => runAiAnalysis('OBSTACLE_SOLUTIONS')}
                            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-white/20 cursor-pointer"
                        >
                            <Wrench size={14} /> Solusi Kendala
                        </button>
                    </div>
                </div>
            </div>

            {/* OBSTACLE ESCALATION HUB */}
            {dashboardData.activeObstacles && dashboardData.activeObstacles.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 p-6 rounded-3xl space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold shrink-0">
                                <AlertTriangle size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-rose-900 uppercase tracking-wider">Pusat Kendala Lapangan Hari Ini ({dashboardData.activeObstacles.length})</h3>
                                <p className="text-xs text-rose-700">Pekerjaan staf yang membutuhkan perhatian khusus atau penugasan solusi dari Kabid.</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {dashboardData.activeObstacles.map((obs, oIdx) => (
                            <div key={oIdx} className="bg-white p-4 rounded-2xl border border-rose-200 shadow-2xs space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <span className="text-xs font-bold text-slate-800">{obs.staffName}</span>
                                        <span className="text-[10px] text-slate-400 block font-medium">{obs.position}</span>
                                    </div>
                                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-rose-100 text-rose-700">
                                        {obs.categoryTag}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-700 font-medium"><b>Pekerjaan:</b> {obs.activity}</p>
                                <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-100 text-xs text-rose-800 font-bold">
                                    ⚠️ Kendala: {obs.obstacleNote}
                                </div>
                                {obs.photos && obs.photos.length > 0 && (
                                    <div className="flex gap-2 pt-1 overflow-x-auto">
                                        {obs.photos.map((ph, pIdx) => (
                                            <img 
                                                key={pIdx} 
                                                src={getMediaUrl(ph.url || ph)} 
                                                alt="Bukti kendala" 
                                                onClick={() => setLightboxPhoto(getMediaUrl(ph.url || ph))}
                                                className="w-12 h-12 rounded-lg object-cover border border-rose-200 cursor-pointer hover:opacity-80 shrink-0" 
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 2-WORKING-DAYS INACTIVITY ALERT (MONDAY - FRIDAY) */}
            {dashboardData.consecutiveMissingStaff && dashboardData.consecutiveMissingStaff.length > 0 && (
                <div className="bg-amber-50 border border-amber-300 p-6 rounded-3xl space-y-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center font-bold shrink-0">
                                <AlertCircle size={22} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-amber-950 uppercase tracking-wider">
                                    Peringatan Kedisiplinan: {dashboardData.consecutiveMissingStaff.length} Staf Tidak Lapor 2 Hari Kerja Berturut-turut
                                </h3>
                                <p className="text-xs text-amber-800 font-medium">
                                    Staf berikut tidak mengisi laporan kegiatan pada 2 hari kerja (Senin - Jumat) terakhir.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={async () => {
                                try {
                                    const res = await api.post('/laporan/notify-inactive');
                                    alert(res.data.message || 'Peringatan berhasil dikirim ke WhatsApp Kabid!');
                                } catch (e) {
                                    alert('Gagal mengirim peringatan.');
                                }
                            }}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0 self-start sm:self-auto"
                        >
                            <Send size={14} /> Kirim Peringatan WhatsApp
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                        {dashboardData.consecutiveMissingStaff.map((st, sIdx) => (
                            <div key={sIdx} className="bg-white p-4 rounded-2xl border border-amber-200 space-y-1.5 shadow-2xs">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-slate-800">{st.name}</h4>
                                    <span className="text-[9px] font-black uppercase text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                                        2 Hari Kosong
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-400 font-medium">{st.position}</p>
                                <div className="text-[11px] text-rose-600 font-bold bg-rose-50 p-2 rounded-xl border border-rose-100">
                                    ⚠️ {st.missedDays?.join(' & ')}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* CHARTS & LEADERBOARD GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart 1: 7-Day Trend */}
                <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Tren Kepatuhan 7 Hari Terakhir</h3>
                            <p className="text-xs text-slate-400">Komparasi jumlah staf Lengkap, Parsial, dan Belum melapor.</p>
                        </div>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dashboardData.trend7Days || []}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="date" tick={{ fontSize: 11, fontWeight: 'bold' }} stroke="#94a3b8" />
                                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                                <Legend wrapperStyle={{ fontSize: 12, fontWeight: 'bold', paddingTop: '10px' }} />
                                <Bar dataKey="Lengkap" fill="#10b981" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Parsial" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Belum" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Chart 2: Division Breakdown Pie */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Distribusi Beban Kerja</h3>
                        <p className="text-xs text-slate-400">Aktivitas per divisi hari ini.</p>
                    </div>
                    <div className="h-64 flex items-center justify-center">
                        {categoryPieData.length === 0 ? (
                            <span className="text-slate-400 text-xs italic">Belum ada aktivitas tercatat</span>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={categoryPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={4} dataKey="value">
                                        {categoryPieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                                    <Legend wrapperStyle={{ fontSize: 10, fontWeight: 'bold' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>

            {/* LEADERBOARD & REALTIME STAFF STATUS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Leaderboard */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <Award size={18} className="text-amber-500" /> Leaderboard Kedisiplinan Staf (30 Hari)
                        </h3>
                    </div>
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                        {dashboardData.leaderboard?.map((st, idx) => (
                            <div key={st.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black ${idx === 0 ? 'bg-amber-400 text-slate-900' : idx === 1 ? 'bg-slate-300 text-slate-800' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                        {idx + 1}
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-800">{st.name}</h4>
                                        <p className="text-[10px] text-slate-400">{st.position}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs font-black text-blue-600">{st.score}% Disiplin</span>
                                    <span className="text-[10px] text-slate-400 block">{st.completeDays} hari lengkap</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Realtime Status List */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                <User size={18} className="text-blue-600" /> Status Kehadiran Laporan Hari Ini
                            </h3>
                            <p className="text-[11px] text-slate-400 font-medium">Pantau kelengkapan laporan staf hari ini</p>
                        </div>
                        {dashboardData.staffStatusList?.some(st => st.status !== 'LENGKAP') && (
                            <button
                                type="button"
                                disabled={remindingStaff}
                                onClick={() => handleRemindStaff(null)}
                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-900 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
                                title="Kirimkan pengingat WhatsApp & Notifikasi ke semua staf yang belum lengkap"
                            >
                                {remindingStaff ? <Loader2 size={13} className="animate-spin" /> : <BellRing size={13} />}
                                <span>Ingatkan Semua ({dashboardData.staffStatusList.filter(st => st.status !== 'LENGKAP').length} Staf)</span>
                            </button>
                        )}
                    </div>
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                        {dashboardData.staffStatusList?.map(st => (
                            <div key={st.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 gap-2">
                                <div className="min-w-0 flex-1">
                                    <h4 className="text-xs font-bold text-slate-800 truncate">{st.name}</h4>
                                    <p className="text-[10px] text-slate-400 truncate">{st.position}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase ${
                                        st.status === 'LENGKAP' ? 'bg-emerald-100 text-emerald-700' :
                                        st.status === 'PARSIAL' ? 'bg-amber-100 text-amber-700' :
                                        'bg-rose-100 text-rose-700'
                                    }`}>
                                        {st.status === 'LENGKAP' ? 'Lengkap ✅' : st.status === 'PARSIAL' ? 'Parsial ⏳' : 'Belum Lapor ❌'}
                                    </span>
                                    {st.status !== 'LENGKAP' && (
                                        <button
                                            type="button"
                                            disabled={remindingStaff}
                                            onClick={() => handleRemindStaff(st.id, st.name)}
                                            className="px-2.5 py-1 bg-white hover:bg-amber-50 hover:text-amber-800 text-slate-600 border border-slate-200 rounded-xl text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs disabled:opacity-50"
                                            title={`Kirimkan pengingat ke ${st.name} via WA & Notifikasi`}
                                        >
                                            <Bell size={11} className="text-amber-600" /> Ingatkan
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExecutiveDashboardTab;
