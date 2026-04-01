import { useState, useEffect } from 'react';
import { 
    Trophy, Award, Target, Timer, FileText, ChevronUp, ChevronDown, 
    Zap, Star, TrendingUp, Filter, Calendar, User, Search, 
    Medal, Crown, Activity
} from 'lucide-react';
import api from '../lib/axios';

const ScoreBar = ({ label, score, color, icon: Icon }) => (
    <div className="space-y-2">
        <div className="flex justify-between items-center px-1">
            <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${color.replace('bg-', 'bg-').replace('-500', '-50')} border ${color.replace('bg-', 'border-').replace('-500', '-100')}`}>
                    <Icon size={12} className={color.replace('bg-', 'text-')} />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
            </div>
            <span className={`text-[11px] font-black ${color.replace('bg-', 'text-')}`}>{score}%</span>
        </div>
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner flex">
            <div 
                className={`h-full transition-all duration-1000 ease-out fill-mode-forwards ${color} shadow-[0_0_8px_rgba(0,0,0,0.1)]`} 
                style={{ width: `${score}%` }} 
            />
        </div>
    </div>
);

const RankBadge = ({ rank }) => {
    if (rank === 0) return <Crown className="text-amber-400 drop-shadow-lg" size={28} strokeWidth={2.5} />;
    if (rank === 1) return <Medal className="text-slate-400 drop-shadow-md" size={24} strokeWidth={2.5} />;
    if (rank === 2) return <Medal className="text-amber-700/60 drop-shadow-sm" size={20} strokeWidth={2.5} />;
    return <span className="text-sm font-black text-slate-300 italic">#{rank + 1}</span>;
};

const PersonnelKPI = () => {
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
    });

    const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    useEffect(() => {
        fetchKPI();
    }, [period]);

    const fetchKPI = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/personnel/kpi-leaderboard?month=${period.month}&year=${period.year}`);
            setLeaderboard(res.data.leaderboard);
        } catch (err) {
            console.error('Failed to fetch KPI:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 bg-[#F8FAFC] min-h-screen pt-20 pb-24">
            <div className="max-w-7xl mx-auto space-y-10">
                
                {/* Header & Filter */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div className="space-y-2">
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-slate-900 rounded-[24px] shadow-2xl shadow-slate-200 flex items-center justify-center">
                                <Trophy className="text-amber-400" size={32} />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">
                                    PAPAN PERINGKAT <span className="text-indigo-600 tracking-widest"> KPI</span>
                                </h1>
                                <p className="text-xs font-bold text-slate-400 tracking-widest uppercase mt-1">HALL OF FAME SARANA DAN PRASARANA</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 bg-white p-2 rounded-[28px] shadow-xl shadow-slate-100/50 border border-slate-50">
                        <select 
                            className="bg-transparent border-0 py-3 px-6 text-xs font-black text-slate-600 outline-none cursor-pointer hover:text-indigo-600 transition-colors uppercase tracking-widest"
                            value={period.month}
                            onChange={(e) => setPeriod({...period, month: parseInt(e.target.value)})}
                        >
                            {months.map((m, idx) => <option key={m} value={idx + 1}>{m}</option>)}
                        </select>
                        <div className="w-px h-6 bg-slate-100" />
                        <select 
                            className="bg-transparent border-0 py-3 px-6 text-xs font-black text-slate-600 outline-none cursor-pointer hover:text-indigo-600 transition-colors uppercase tracking-widest"
                            value={period.year}
                            onChange={(e) => setPeriod({...period, year: parseInt(e.target.value)})}
                        >
                            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="py-40 flex flex-col items-center gap-6">
                        <Activity className="animate-spin text-indigo-500" size={48} strokeWidth={3} />
                        <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Mengkalkulasi Performa...</p>
                    </div>
                ) : leaderboard.length === 0 ? (
                    <div className="py-40 bg-white rounded-[40px] shadow-xl flex flex-col items-center justify-center opacity-40 grayscale">
                        <Award size={64} className="text-slate-200" />
                        <p className="text-sm font-black text-slate-300 uppercase tracking-[0.3em] mt-4">Belum ada data KPI untuk periode ini</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Top 3 Section */}
                        <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                            {leaderboard.slice(0, 3).map((item, idx) => (
                                <div key={item.userId} className={`relative bg-white rounded-[48px] p-8 shadow-2xl transition-all hover:scale-[1.03] overflow-hidden border-2 ${idx === 0 ? 'border-amber-100 ring-4 ring-amber-50 shadow-amber-100/50' : 'border-slate-50'}`}>
                                    {idx === 0 && (
                                        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-amber-500/10 to-transparent pointer-events-none" />
                                    )}
                                    
                                    <div className="flex justify-between items-start mb-8">
                                        <div className="p-4 bg-slate-50 rounded-[28px] shadow-inner">
                                            <RankBadge rank={idx} />
                                        </div>
                                        <div className={`px-5 py-2 rounded-2xl text-[14px] font-black shadow-lg ${
                                            item.grade === 'A' ? 'bg-indigo-600 text-white shadow-indigo-200' :
                                            item.grade === 'B' ? 'bg-emerald-500 text-white shadow-emerald-200' :
                                            'bg-slate-900 text-white'
                                        }`}>
                                            GRADE {item.grade}
                                        </div>
                                    </div>

                                    <div className="space-y-2 mb-10">
                                        <h3 className="text-2xl font-black text-slate-900 leading-tight uppercase italic tracking-tighter">{item.name}</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Zap size={10} className="text-indigo-500" /> {item.position || 'STAF SARPRAS'}
                                        </p>
                                    </div>

                                    <div className="space-y-6">
                                        <ScoreBar label="Penyelesaian" score={item.scores.completion} color="bg-indigo-500" icon={Target} />
                                        <ScoreBar label="Ketepatan Waktu" score={item.scores.punctuality} color="bg-emerald-500" icon={Timer} />
                                        <ScoreBar label="Konsistensi Laporan" score={item.scores.report} color="bg-amber-500" icon={FileText} />
                                    </div>

                                    <div className="mt-10 pt-8 border-t border-slate-50 flex items-center justify-between">
                                        <div>
                                            <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1 text-center bg-slate-50 border border-slate-100 rounded-full px-2 py-0.5">SKOR RATA-RATA</p>
                                            <p className="text-4xl font-black text-slate-900 tracking-tighter italic">{item.averageScore}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center gap-2 justify-end mb-1">
                                                <TrendingUp size={14} className="text-indigo-500" />
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">AKTIVITAS</span>
                                            </div>
                                            <p className="text-xs font-black text-slate-700 uppercase tracking-widest">{item.stats.total} PENUGASAN</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Remainder Leaders Table Style */}
                        <div className="lg:col-span-12 space-y-4">
                            <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.3em] ml-10 mb-6 flex items-center gap-3">
                                <Activity size={18} /> PERINGKAT LAINNYA
                            </h2>
                            {leaderboard.slice(3).map((item, idx) => (
                                <div key={item.userId} className="bg-white rounded-[32px] p-6 shadow-lg shadow-slate-100/50 border border-slate-50 flex items-center gap-8 transition-all hover:translate-x-2">
                                    <div className="w-12 h-12 flex items-center justify-center bg-slate-50 rounded-2xl">
                                        <span className="text-sm font-black text-slate-400 italic">#{idx + 4}</span>
                                    </div>

                                    <div className="flex-1">
                                        <h4 className="text-sm font-black text-slate-700 uppercase italic tracking-tight">{item.name}</h4>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.position}</p>
                                    </div>

                                    <div className="hidden md:flex gap-10">
                                        <div className="text-center">
                                            <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">SKOR</p>
                                            <p className="text-lg font-black text-slate-700 tracking-tighter">{item.averageScore}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">GRADE</p>
                                            <p className="text-lg font-black text-indigo-600 tracking-tighter uppercase">{item.grade}</p>
                                        </div>
                                    </div>

                                    <div className="w-px h-10 bg-slate-50" />

                                    <div className="text-right">
                                        <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">{item.stats.completed}/{item.stats.total} SELESAI</p>
                                        <div className="h-1.5 w-24 bg-slate-50 rounded-full overflow-hidden shadow-inner">
                                            <div className="h-full bg-indigo-500" style={{ width: `${item.scores.completion}%` }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PersonnelKPI;
