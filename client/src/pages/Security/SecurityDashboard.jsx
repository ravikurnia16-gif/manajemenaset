import { useState, useEffect } from 'react';
import { Users, ShieldCheck, MapPin, Zap, CheckCircle2, Clock, Map } from 'lucide-react';
import api from '../../../lib/axios';

const SecurityDashboard = () => {
    const [stats, setStats] = useState({
        totalPosts: 0,
        totalGuards: 0,
        totalSchedulesToday: 0,
        presentToday: 0,
        schedulesToday: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboard();
    }, []);

    const fetchDashboard = async () => {
        try {
            const res = await api.get('/security/dashboard');
            setStats(res.data);
        } catch (error) {
            console.error('Failed to fetch dashboard', error);
        } finally {
            setLoading(false);
        }
    };

    const getShiftIcon = (shift) => {
        if (shift === 'SIANG') return <Zap size={14} className="text-amber-500" />;
        return <Clock size={14} className="text-indigo-400" />;
    };

    if (loading) {
        return (
            <div className="p-8 flex justify-center items-center h-screen bg-[#F8FAFC]">
                <div className="animate-spin text-indigo-600"><ShieldCheck size={40} /></div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 bg-[#F8FAFC] min-h-screen pt-20 pb-24">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100 flex items-center justify-center">
                                <ShieldCheck className="text-white" size={24} />
                            </div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">
                                MANAJEMEN <span className="text-indigo-600 italic">SECURITY</span>
                            </h1>
                        </div>
                        <p className="text-sm font-medium text-slate-400 pl-14">
                            Sistem Informasi Penjagaan, Shift & Pos Keamanan
                        </p>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-50 flex items-center gap-4 group hover:scale-[1.02] transition-all">
                        <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <MapPin size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Pos Aktif</p>
                            <p className="text-2xl font-black text-slate-800">{stats.totalPosts}</p>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-50 flex items-center gap-4 group hover:scale-[1.02] transition-all">
                        <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                            <Users size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Anggota Aktif</p>
                            <p className="text-2xl font-black text-slate-800">{stats.totalGuards}</p>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-50 flex items-center gap-4 group hover:scale-[1.02] transition-all">
                        <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            <Map size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Total Shift Hari Ini</p>
                            <p className="text-2xl font-black text-slate-800">{stats.totalSchedulesToday}</p>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-50 flex items-center gap-4 group hover:scale-[1.02] transition-all">
                        <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl group-hover:bg-amber-600 group-hover:text-white transition-colors">
                            <CheckCircle2 size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Hadir Hari Ini</p>
                            <p className="text-2xl font-black text-slate-800">{stats.presentToday}</p>
                        </div>
                    </div>
                </div>

                {/* Schedules Today */}
                <div className="bg-white rounded-[32px] p-6 md:p-8 shadow-xl shadow-slate-100/40 border border-slate-50">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-lg font-black text-slate-900 uppercase italic tracking-tight">JADWAL HARI INI</h2>
                            <p className="text-xs font-bold text-slate-400 mt-1">Daftar penempatan pos per shift hari ini</p>
                        </div>
                    </div>

                    {stats.schedulesToday.length === 0 ? (
                        <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            <ShieldCheck size={40} className="mx-auto text-slate-300 mb-3" />
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Belum ada jadwal hari ini</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {stats.schedulesToday.map((schedule) => (
                                <div key={schedule.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col gap-3 group hover:border-indigo-200 hover:bg-white hover:shadow-lg transition-all">
                                    <div className="flex justify-between items-center border-b border-slate-200/60 pb-3">
                                        <div className="flex items-center gap-2">
                                            <MapPin size={16} className="text-slate-400" />
                                            <span className="text-xs font-black text-slate-700 uppercase">{schedule.post.name}</span>
                                        </div>
                                        <div className={`px-2 py-1 rounded text-[9px] font-black tracking-widest flex items-center gap-1 ${schedule.shift === 'SIANG' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                            {getShiftIcon(schedule.shift)}
                                            {schedule.shift}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 pt-1">
                                        {schedule.guard.photo ? (
                                            <img src={schedule.guard.photo} alt={schedule.guard.name} className="w-10 h-10 rounded-full object-cover shadow-sm" />
                                        ) : (
                                            <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 font-bold">
                                                {schedule.guard.name.charAt(0)}
                                            </div>
                                        )}
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-800">{schedule.guard.name}</span>
                                            <span className="text-[10px] font-black text-slate-400 tracking-widest">{schedule.isOvertime ? 'LEMBUR' : 'REGULER'}</span>
                                        </div>
                                        <div className="ml-auto">
                                            {schedule.status === 'HADIR' ? (
                                                <div className="px-2 py-1 bg-emerald-100 text-emerald-600 rounded text-[9px] font-black">HADIR</div>
                                            ) : schedule.status === 'SCHEDULED' ? (
                                                <div className="px-2 py-1 bg-slate-200 text-slate-500 rounded text-[9px] font-black">BELUM ABSEN</div>
                                            ) : (
                                                <div className="px-2 py-1 bg-rose-100 text-rose-600 rounded text-[9px] font-black">{schedule.status}</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SecurityDashboard;
