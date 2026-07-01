import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Plus, Trash2, Edit2, ShieldCheck, X, ChevronLeft, ChevronRight, Zap, Clock, MapPin, RefreshCw } from 'lucide-react';
import api from '../../lib/axios';

const SecuritySchedule = () => {
    const [schedules, setSchedules] = useState([]);
    const [posts, setPosts] = useState([]);
    const [guards, setGuards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showAutoGenerate, setShowAutoGenerate] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState(null);
    const [currentDate, setCurrentDate] = useState(new Date());

    const [formData, setFormData] = useState({
        date: '',
        shift: 'SIANG',
        postId: '',
        guardId: '',
        isOvertime: false,
        overtimeHours: '',
        status: 'SCHEDULED',
        note: ''
    });

    const [genData, setGenData] = useState({
        startDate: '',
        endDate: ''
    });

    useEffect(() => {
        fetchData();
    }, [currentDate]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch posts and guards for the forms
            const [postsRes, guardsRes] = await Promise.all([
                api.get('/security/posts'),
                api.get('/security/guards')
            ]);
            setPosts(postsRes.data.filter(p => p.isActive));
            setGuards(guardsRes.data.filter(g => g.status === 'ACTIVE'));

            // Fetch schedules for the current month
            const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
            
            const schedulesRes = await api.get('/security/schedules', {
                params: {
                    start: firstDay.toISOString(),
                    end: lastDay.toISOString()
                }
            });
            setSchedules(schedulesRes.data);
        } catch (error) {
            console.error('Failed to fetch schedules data', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePreviousMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingSchedule) {
                await api.put(`/security/schedules/${editingSchedule.id}`, formData);
            } else {
                await api.post('/security/schedules', formData);
            }
            setShowModal(false);
            fetchData();
            resetForm();
        } catch (error) {
            alert('Failed to save schedule: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleAutoGenerate = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/security/schedules/generate', genData);
            alert(res.data.message);
            setShowAutoGenerate(false);
            fetchData();
        } catch (error) {
            alert('Failed to generate schedule: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Yakin ingin menghapus jadwal ini?')) return;
        try {
            await api.delete(`/security/schedules/${id}`);
            fetchData();
        } catch (error) {
            alert('Failed to delete schedule: ' + error.message);
        }
    };

    const updateAttendance = async (id, status) => {
        try {
            await api.put(`/security/schedules/${id}/attendance`, { status });
            fetchData();
        } catch (error) {
            alert('Gagal update kehadiran: ' + error.message);
        }
    };

    const resetForm = () => {
        setFormData({
            date: '',
            shift: 'SIANG',
            postId: '',
            guardId: '',
            isOvertime: false,
            overtimeHours: '',
            status: 'SCHEDULED',
            note: ''
        });
        setEditingSchedule(null);
    };

    const openEdit = (schedule) => {
        setEditingSchedule(schedule);
        setFormData({
            date: new Date(schedule.date).toISOString().split('T')[0],
            shift: schedule.shift,
            postId: schedule.postId,
            guardId: schedule.guardId,
            isOvertime: schedule.isOvertime,
            overtimeHours: schedule.overtimeHours || '',
            status: schedule.status,
            note: schedule.note || ''
        });
        setShowModal(true);
    };

    const getDaysInMonth = (year, month) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
    
    // Group schedules by date
    const schedulesByDate = {};
    schedules.forEach(s => {
        const d = new Date(s.date).getDate();
        if (!schedulesByDate[d]) schedulesByDate[d] = [];
        schedulesByDate[d].push(s);
    });

    const getShiftIcon = (shift) => {
        if (shift === 'SIANG') return <Zap size={10} className="text-amber-500" />;
        return <Clock size={10} className="text-indigo-400" />;
    };

    return (
        <div className="p-4 md:p-8 bg-[#F8FAFC] min-h-screen pt-20 pb-24">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100 flex items-center justify-center">
                                <CalendarIcon className="text-white" size={24} />
                            </div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight italic uppercase">
                                JADWAL <span className="text-indigo-600">PIKET</span>
                            </h1>
                        </div>
                        <p className="text-sm font-medium text-slate-400 pl-14">
                            Manajemen penempatan anggota per shift
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button 
                            onClick={() => setShowAutoGenerate(true)}
                            className="flex items-center justify-center gap-2 px-6 py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-black text-xs tracking-widest shadow-sm hover:bg-slate-50 transition-all active:scale-95"
                        >
                            <RefreshCw size={16} />
                            AUTO-GENERATE
                        </button>
                        <button 
                            onClick={() => { resetForm(); setShowModal(true); }}
                            className="flex items-center justify-center gap-2 px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95"
                        >
                            <Plus size={16} />
                            BUAT JADWAL
                        </button>
                    </div>
                </div>

                {/* Calendar View */}
                <div className="bg-white rounded-[32px] p-6 shadow-xl shadow-slate-100/40 border border-slate-50">
                    <div className="flex justify-between items-center mb-8">
                        <button onClick={handlePreviousMonth} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                            <ChevronLeft size={24} className="text-slate-600" />
                        </button>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest">
                            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                        </h2>
                        <button onClick={handleNextMonth} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                            <ChevronRight size={24} className="text-slate-600" />
                        </button>
                    </div>

                    {loading ? (
                        <div className="py-20 flex flex-col items-center gap-4">
                            <CalendarIcon className="animate-pulse text-indigo-200" size={48} />
                            <p className="text-[10px] font-black tracking-widest text-slate-300 uppercase">Memuat Jadwal...</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {[...Array(daysInMonth)].map((_, i) => {
                                const dayNum = i + 1;
                                const daySchedules = schedulesByDate[dayNum] || [];
                                const isToday = new Date().getDate() === dayNum && new Date().getMonth() === currentDate.getMonth() && new Date().getFullYear() === currentDate.getFullYear();
                                
                                return (
                                    <div key={dayNum} className={`flex flex-col md:flex-row border border-slate-100 rounded-2xl overflow-hidden ${isToday ? 'ring-2 ring-indigo-500/50 shadow-md' : ''}`}>
                                        {/* Date Column */}
                                        <div className={`p-4 w-full md:w-32 flex-shrink-0 flex items-center justify-center flex-col border-b md:border-b-0 md:border-r border-slate-100 ${isToday ? 'bg-indigo-50' : 'bg-slate-50'}`}>
                                            <span className="text-3xl font-black text-slate-800">{dayNum}</span>
                                            <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">
                                                {new Date(currentDate.getFullYear(), currentDate.getMonth(), dayNum).toLocaleDateString('id-ID', { weekday: 'short' })}
                                            </span>
                                            {isToday && <span className="mt-1 px-2 py-0.5 bg-indigo-600 text-white rounded text-[8px] font-black tracking-widest">HARI INI</span>}
                                        </div>

                                        {/* Schedules Column */}
                                        <div className="p-4 flex-1">
                                            {daySchedules.length === 0 ? (
                                                <div className="h-full flex items-center text-xs font-bold text-slate-300 uppercase tracking-widest">
                                                    Kosong
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {daySchedules.map(s => (
                                                        <div key={s.id} className="bg-white border border-slate-100 p-3 rounded-xl shadow-sm hover:shadow-md transition-all group relative">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <div className={`px-2 py-0.5 rounded text-[8px] font-black tracking-widest flex items-center gap-1 ${s.shift === 'SIANG' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                                                    {getShiftIcon(s.shift)} {s.shift}
                                                                </div>
                                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button onClick={() => openEdit(s)} className="p-1 text-slate-400 hover:text-indigo-600"><Edit2 size={12}/></button>
                                                                    <button onClick={() => handleDelete(s.id)} className="p-1 text-slate-400 hover:text-rose-600"><Trash2 size={12}/></button>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <MapPin size={12} className="text-slate-400" />
                                                                <span className="text-xs font-bold text-slate-700 line-clamp-1">{s.post.name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-[8px] font-bold text-slate-600">
                                                                    {s.guard.name.charAt(0)}
                                                                </div>
                                                                <span className="text-xs font-medium text-slate-600 truncate">{s.guard.name}</span>
                                                                {s.isOvertime && (
                                                                    <span className="px-1.5 py-0.5 bg-rose-100 text-rose-600 rounded text-[8px] font-black tracking-wider ml-auto">LEMBUR</span>
                                                                )}
                                                            </div>

                                                            {/* Kehadiran Actions */}
                                                            {s.status === 'SCHEDULED' ? (
                                                                <div className="mt-3 flex gap-1 border-t border-slate-50 pt-2">
                                                                    <button onClick={() => updateAttendance(s.id, 'HADIR')} className="flex-1 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded text-[9px] font-black transition-colors">HADIR</button>
                                                                    <button onClick={() => updateAttendance(s.id, 'TIDAK_HADIR')} className="flex-1 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded text-[9px] font-black transition-colors">ALPA</button>
                                                                </div>
                                                            ) : (
                                                                <div className="mt-3 border-t border-slate-50 pt-2 flex justify-end">
                                                                    <span className={`text-[9px] font-black tracking-widest ${s.status === 'HADIR' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                        {s.status}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Form Jadwal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowModal(false)} />
                    <div className="bg-white rounded-[40px] w-full max-w-lg max-h-[90vh] overflow-hidden relative shadow-2xl animate-in zoom-in slide-in-from-bottom-10 duration-300">
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">
                                    {editingSchedule ? 'EDIT' : 'BUAT'} <span className="text-indigo-600 tracking-widest">JADWAL</span>
                                </h2>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-3 hover:bg-white rounded-2xl text-slate-400 transition-all shadow-sm">
                                <X size={20} strokeWidth={3} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto max-h-[calc(90vh-140px)] custom-scrollbar space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 tracking-[0.2em] ml-2">TANGGAL</label>
                                    <input 
                                        type="date" required
                                        className="w-full px-6 py-4 bg-slate-50 border-0 rounded-2xl text-[13px] font-bold text-slate-700 focus:ring-4 focus:ring-indigo-100 transition-all outline-none"
                                        value={formData.date}
                                        onChange={(e) => setFormData({...formData, date: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 tracking-[0.2em] ml-2">SHIFT</label>
                                    <select 
                                        className="w-full px-6 py-4 bg-slate-50 border-0 rounded-2xl text-[13px] font-bold text-slate-700 focus:ring-4 focus:ring-indigo-100 transition-all outline-none appearance-none"
                                        value={formData.shift}
                                        onChange={(e) => setFormData({...formData, shift: e.target.value})}
                                    >
                                        <option value="SIANG">SIANG (07:00 - 19:00)</option>
                                        <option value="MALAM">MALAM (19:00 - 07:00)</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 tracking-[0.2em] ml-2">POS PENJAGAAN</label>
                                <select 
                                    required
                                    className="w-full px-6 py-4 bg-slate-50 border-0 rounded-2xl text-[13px] font-bold text-slate-700 focus:ring-4 focus:ring-indigo-100 transition-all outline-none appearance-none"
                                    value={formData.postId}
                                    onChange={(e) => setFormData({...formData, postId: e.target.value})}
                                >
                                    <option value="">Pilih Pos...</option>
                                    {posts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 tracking-[0.2em] ml-2">ANGGOTA (GUARD)</label>
                                <select 
                                    required
                                    className="w-full px-6 py-4 bg-slate-50 border-0 rounded-2xl text-[13px] font-bold text-slate-700 focus:ring-4 focus:ring-indigo-100 transition-all outline-none appearance-none"
                                    value={formData.guardId}
                                    onChange={(e) => setFormData({...formData, guardId: e.target.value})}
                                >
                                    <option value="">Pilih Anggota...</option>
                                    {guards.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                </select>
                            </div>

                            <div className="p-4 bg-rose-50/50 border border-rose-100 rounded-2xl space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-black text-slate-700 tracking-wider">PENUGASAN LEMBUR?</label>
                                    <input 
                                        type="checkbox" 
                                        className="w-5 h-5 accent-rose-500 rounded"
                                        checked={formData.isOvertime}
                                        onChange={(e) => setFormData({...formData, isOvertime: e.target.checked})}
                                    />
                                </div>
                                {formData.isOvertime && (
                                    <div className="space-y-1.5 animate-in slide-in-from-top-2">
                                        <label className="text-[10px] font-black text-slate-400 tracking-[0.2em] ml-2">DURASI LEMBUR (JAM)</label>
                                        <input 
                                            type="number" step="0.5"
                                            className="w-full px-6 py-4 bg-white border-0 rounded-2xl text-[13px] font-bold text-slate-700 focus:ring-4 focus:ring-rose-100 transition-all outline-none"
                                            placeholder="Contoh: 4"
                                            value={formData.overtimeHours}
                                            onChange={(e) => setFormData({...formData, overtimeHours: e.target.value})}
                                        />
                                    </div>
                                )}
                            </div>

                            <button type="submit" className="w-full py-5 mt-4 bg-slate-900 text-white rounded-[24px] font-black text-xs tracking-[0.3em] shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95">
                                SIMPAN JADWAL
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Auto Generate */}
            {showAutoGenerate && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowAutoGenerate(false)} />
                    <div className="bg-white rounded-[40px] w-full max-w-md max-h-[90vh] overflow-hidden relative shadow-2xl animate-in zoom-in slide-in-from-bottom-10 duration-300">
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">
                                    GENERATE <span className="text-indigo-600 tracking-widest">OTOMATIS</span>
                                </h2>
                            </div>
                            <button onClick={() => setShowAutoGenerate(false)} className="p-3 hover:bg-white rounded-2xl text-slate-400 transition-all shadow-sm">
                                <X size={20} strokeWidth={3} />
                            </button>
                        </div>

                        <form onSubmit={handleAutoGenerate} className="p-8 space-y-6">
                            <p className="text-xs text-slate-500 leading-relaxed mb-6">
                                Fitur ini akan membuatkan jadwal piket otomatis secara merata untuk semua anggota aktif ke semua pos yang aktif berdasarkan kapasitas shift.
                            </p>
                            
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 tracking-[0.2em] ml-2">DARI TANGGAL</label>
                                <input 
                                    type="date" required
                                    className="w-full px-6 py-4 bg-slate-50 border-0 rounded-2xl text-[13px] font-bold text-slate-700 focus:ring-4 focus:ring-indigo-100 transition-all outline-none"
                                    value={genData.startDate}
                                    onChange={(e) => setGenData({...genData, startDate: e.target.value})}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 tracking-[0.2em] ml-2">SAMPAI TANGGAL</label>
                                <input 
                                    type="date" required
                                    className="w-full px-6 py-4 bg-slate-50 border-0 rounded-2xl text-[13px] font-bold text-slate-700 focus:ring-4 focus:ring-indigo-100 transition-all outline-none"
                                    value={genData.endDate}
                                    onChange={(e) => setGenData({...genData, endDate: e.target.value})}
                                />
                            </div>

                            <button type="submit" className="w-full py-5 mt-4 bg-indigo-600 text-white rounded-[24px] font-black text-xs tracking-[0.3em] shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2">
                                <RefreshCw size={16} /> GENERATE SEKARANG
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SecuritySchedule;
