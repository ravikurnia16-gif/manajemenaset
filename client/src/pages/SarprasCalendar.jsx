import { useState, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Pin, MapPin, Clock, Repeat, Trash2, Edit3, X, BarChart3, Wrench, User, Search, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import api from '../lib/axios';

const CATEGORIES = [
    { name: 'Kerja', color: 'bg-indigo-600', text: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-100' },
    { name: 'Pemeliharaan', color: 'bg-emerald-600', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { name: 'Pengadaan', color: 'bg-sky-600', text: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-100' },
    { name: 'Servis', color: 'bg-rose-600', text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-100' },
    { name: 'Rapat', color: 'bg-blue-600', text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-100' },
    { name: 'Lainnya', color: 'bg-slate-400', text: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-100' },
];

const RECURRING_TYPES = [
    { value: '', label: 'Tidak Berulang' },
    { value: 'DAILY', label: 'Setiap Hari' },
    { value: 'WEEKLY', label: 'Setiap Minggu' },
    { value: 'MONTHLY', label: 'Setiap Bulan' },
];

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const SarprasCalendar = () => {
    const user = JSON.parse(localStorage.getItem('user')) || {};
    const canEdit = ['SUPER_ADMIN', 'BIDANG_IT', 'ADMIN_ASET'].includes(user.role);

    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [events, setEvents] = useState([]);
    const [pinnedEvents, setPinnedEvents] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [showSummary, setShowSummary] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [users, setUsers] = useState([]);

    const [form, setForm] = useState({
        title: '', description: '', category: 'Kerja', date: '',
        endDate: '', isPinned: false, location: '', picIds: [],
        isRecurring: false, recurringType: '', recurringInterval: 1, recurringDays: [], recurringEndDate: ''
    });
    const [picSearch, setPicSearch] = useState('');

    useEffect(() => { fetchAll(); }, [currentMonth, currentYear]);
    useEffect(() => { fetchUsers(); }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [evRes, pinRes, sumRes] = await Promise.all([
                api.get(`/calendar?month=${currentMonth}&year=${currentYear}`),
                api.get('/calendar/pinned'),
                api.get(`/calendar/summary?month=${currentMonth}&year=${currentYear}`)
            ]);
            setEvents(evRes.data);
            setPinnedEvents(pinRes.data);
            setSummary(sumRes.data);
        } catch (err) {
            console.error('Calendar fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await api.get('/personnel/staff');
            setUsers(res.data.map(u => ({ id: u.id, name: u.name || u.username })));
        } catch (err) { console.error(err); }
    };

    const calendarDays = useMemo(() => {
        const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
        const days = [];
        for (let i = 0; i < firstDay; i++) days.push(null);
        for (let d = 1; d <= daysInMonth; d++) days.push(d);
        return days;
    }, [currentMonth, currentYear]);

    const getEventsForDay = (day) => {
        if (!day) return [];
        const targetDate = new Date(currentYear, currentMonth - 1, day);
        targetDate.setHours(0, 0, 0, 0);
        const targetTime = targetDate.getTime();

        return events.filter(event => {
            if (!event.date) return false;
            const startDate = new Date(event.date);
            startDate.setHours(0, 0, 0, 0);
            const startTime = startDate.getTime();

            if (event.endDate) {
                const endDate = new Date(event.endDate);
                endDate.setHours(23, 59, 59, 999);
                const endTime = endDate.getTime();
                return targetTime >= startTime && targetTime <= endTime;
            }
            return targetTime === startTime;
        });
    };

    const getCategoryStyle = (cat) => CATEGORIES.find(c => c.name === cat) || CATEGORIES[CATEGORIES.length - 1];

    const prevMonth = () => {
        if (currentMonth === 1) { setCurrentMonth(12); setCurrentYear(y => y - 1); }
        else setCurrentMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (currentMonth === 12) { setCurrentMonth(1); setCurrentYear(y => y + 1); }
        else setCurrentMonth(m => m + 1);
    };
    const goToday = () => { setCurrentMonth(today.getMonth() + 1); setCurrentYear(today.getFullYear()); };

    const openAddModal = (day) => {
        const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        setForm({ title: '', description: '', category: 'Kerja', date: dateStr, endDate: '', isPinned: false, location: '', picIds: [], isRecurring: false, recurringType: '', recurringInterval: 1, recurringDays: [], recurringEndDate: '' });
        setEditingEvent(null);
        setPicSearch('');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.title || !form.date) return alert('Judul dan tanggal wajib diisi');
        try {
            const payload = { ...form, picIds: (form.picIds || []).map(id => parseInt(id)) };
            if (editingEvent) await api.put(`/calendar/${editingEvent.id}`, payload);
            else await api.post('/calendar', payload);
            setShowModal(false);
            alert('Kegiatan telah dijadwalkan');
            fetchAll();
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal menyimpan ke kalender');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Hapus jadwal kegiatan ini?')) return;
        try {
            await api.delete(`/calendar/${id}`);
            fetchAll();
            setSelectedDate(null);
        } catch (err) { alert('Gagal menghapus jadwal'); }
    };

    const isTodayNum = (day) => day === today.getDate() && currentMonth === today.getMonth() + 1 && currentYear === today.getFullYear();

    return (
        <div className="max-w-7xl mx-auto space-y-8 p-2 animate-in fade-in duration-700">
            {/* Header / Intro */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="relative z-10">
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-600/20">
                            <CalendarIcon size={28} />
                        </div>
                        Kalender Operasional
                    </h1>
                    <p className="text-slate-500 text-sm mt-2 font-medium">Visualisasi jadwal kerja, pemeliharaan, dan agenda strategis Sarpras.</p>
                </div>
                <div className="flex flex-wrap gap-3 relative z-10">
                    <button onClick={() => setShowSummary(!showSummary)} className={`px-5 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all ${showSummary ? 'bg-slate-900 text-white shadow-xl' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        <BarChart3 size={18} /> {showSummary ? 'Tutup Ringkasan' : 'Statistik Bulanan'}
                    </button>
                    {canEdit && (
                        <button onClick={() => openAddModal(today.getDate())} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 flex items-center gap-2 transition-all active:scale-95">
                            <Plus size={20} /> Tambah Agenda
                        </button>
                    )}
                </div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full -mr-32 -mt-32 opacity-40"></div>
            </div>

            {/* Stats Summary Modal/Panel */}
            {showSummary && summary && (
                <div className="bg-white rounded-[32px] border border-indigo-100 p-8 shadow-xl shadow-indigo-100/30 animate-in slide-in-from-top-6 duration-500">
                    <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-3">
                        <Sparkles className="text-amber-400" size={20} /> Performa Agenda {MONTH_NAMES[currentMonth - 1]}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg">
                            <div className="text-3xl font-black">{summary.totalEvents}</div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mt-1">Total Agenda</div>
                        </div>
                        {Object.entries(summary.byCategory || {}).map(([cat, count]) => {
                            const style = getCategoryStyle(cat);
                            return (
                                <div key={cat} className={`${style.bg} rounded-2xl p-5 border ${style.border}`}>
                                    <div className={`text-3xl font-black ${style.text}`}>{count}</div>
                                    <div className={`text-[10px] font-black uppercase tracking-widest opacity-60 ${style.text}`}>{cat}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Main Calendar View */}
            <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[600px]">
                {/* Sidebar - Selected Day Detail */}
                <div className="w-full md:w-80 bg-slate-50 border-r border-slate-100 p-8 flex flex-col">
                    <div className="mb-8">
                        <h2 className="text-4xl font-black text-slate-900 leading-none">{selectedDate || today.getDate()}</h2>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2">{MONTH_NAMES[currentMonth - 1]} {currentYear}</p>
                    </div>

                    <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                        {getEventsForDay(selectedDate || today.getDate()).length === 0 ? (
                            <div className="py-10 text-center flex flex-col items-center opacity-40">
                                <AlertCircle size={32} className="mb-2" />
                                <p className="text-xs font-bold uppercase tracking-widest">Tidak ada agenda</p>
                            </div>
                        ) : (
                            getEventsForDay(selectedDate || today.getDate()).map((ev, idx) => {
                                const style = getCategoryStyle(ev.category);
                                return (
                                    <div key={idx} className={`p-4 rounded-2xl border ${style.bg} ${style.border} group relative transition-all hover:scale-[1.02] hover:shadow-md`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className={`w-2 h-2 rounded-full ${style.color}`} />
                                            <h4 className={`text-xs font-black truncate ${style.text}`}>{ev.title}</h4>
                                        </div>
                                        {ev.location && <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 mb-2"><MapPin size={10} /> {ev.location}</p>}
                                        {canEdit && (
                                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleDelete(ev.id)} className="p-1 text-red-500 hover:bg-white rounded-md transition-all"><Trash2 size={12} /></button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {canEdit && (
                        <button onClick={() => openAddModal(selectedDate || today.getDate())} className="mt-8 w-full py-4 bg-white border-2 border-dashed border-slate-200 text-slate-400 rounded-2xl text-xs font-black uppercase tracking-widest hover:border-indigo-400 hover:text-indigo-600 transition-all">
                            + Tambah Agenda
                        </button>
                    )}
                </div>

                {/* Main Calendar Grid */}
                <div className="flex-1 flex flex-col">
                    <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button onClick={prevMonth} className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 transition-all"><ChevronLeft size={20} /></button>
                            <h2 className="text-xl font-black text-slate-800 w-48 text-center">{MONTH_NAMES[currentMonth - 1]} {currentYear}</h2>
                            <button onClick={nextMonth} className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 transition-all"><ChevronRight size={20} /></button>
                        </div>
                        <button onClick={goToday} className="px-4 py-2 bg-indigo-50 text-indigo-700 text-xs font-black rounded-xl hover:bg-indigo-100 transition-all uppercase tracking-widest">Hari Ini</button>
                    </div>

                    <div className="flex-1 p-4 grid grid-cols-7 gap-2">
                        {DAY_NAMES.map(d => <div key={d} className={`text-center py-4 text-[10px] font-black uppercase tracking-[0.2em] ${d === 'Min' ? 'text-red-400' : 'text-slate-300'}`}>{d}</div>)}
                        
                        {loading ? (
                            <div className="col-span-7 flex flex-col items-center justify-center p-20 opacity-20">
                                <Loader2 className="animate-spin" size={48} />
                                <p className="mt-4 font-black text-xs tracking-widest">SINKRONISASI...</p>
                            </div>
                        ) : (
                            calendarDays.map((day, i) => {
                                if (!day) return <div key={`empty-${i}`} className="bg-slate-50/20 rounded-2xl" />;
                                const dayEvents = getEventsForDay(day);
                                const isSelected = selectedDate === day;
                                return (
                                    <div
                                        key={day}
                                        onClick={() => setSelectedDate(day)}
                                        className={`min-h-[100px] p-3 rounded-[24px] border transition-all cursor-pointer relative group flex flex-col gap-1 ${isSelected ? 'border-indigo-500 bg-indigo-50/20 shadow-lg ring-4 ring-indigo-50/50' : 'border-slate-50 hover:border-slate-200 hover:bg-slate-50/50'} ${isTodayNum(day) ? 'bg-indigo-50/30' : ''}`}
                                    >
                                        <span className={`text-sm font-black mb-1 flex items-center justify-center w-7 h-7 rounded-lg ${isTodayNum(day) ? 'bg-indigo-600 text-white shadow-lg' : isSelected ? 'text-indigo-600' : 'text-slate-400'}`}>
                                            {day}
                                        </span>
                                        
                                        <div className="flex-1 space-y-1">
                                            {dayEvents.slice(0, 2).map((ev, idx) => (
                                                <div key={idx} className={`w-full h-1.5 rounded-full ${getCategoryStyle(ev.category).color} opacity-80`} title={ev.title} />
                                            ))}
                                            {dayEvents.length > 2 && <div className="text-[8px] font-black text-slate-300 ml-1">+{dayEvents.length - 2}</div>}
                                        </div>

                                        {dayEvents.some(e => e.isPinned) && <Pin size={10} className="absolute top-3 right-3 text-amber-400" />}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Legend Section */}
            <div className="flex flex-wrap items-center justify-center gap-6 py-4 px-8 bg-white rounded-3xl border border-slate-100">
                {CATEGORIES.map(c => (
                    <div key={c.name} className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${c.color}`} />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{c.name}</span>
                    </div>
                ))}
            </div>

            {/* Modal Detail & Form - Menggunakan Portal/Overlay yang sudah ada di pattern sebelumnya */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-[40px] w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative" onClick={e => e.stopPropagation()}>
                        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-indigo-900 text-white">
                            <h3 className="text-xl font-black tracking-tight">{editingEvent ? 'Revisi Agenda' : 'Jadwalkan Agenda Baru'}</h3>
                            <button onClick={() => setShowModal(false)} className="w-10 h-10 bg-white/10 hover:bg-red-500 rounded-full flex items-center justify-center transition-all">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-8 overflow-y-auto custom-scrollbar space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Judul Kegiatan</label>
                                    <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-600 outline-none" placeholder="Masukkan judul..." />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">🗓️ Mulai</label>
                                        <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-600 outline-none" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">⌛ Akhir</label>
                                        <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-600 outline-none" />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Kategori Agenda</label>
                                    <div className="flex flex-wrap gap-2">
                                        {CATEGORIES.map(c => (
                                            <button key={c.name} onClick={() => setForm({ ...form, category: c.name })} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${form.category === c.name ? `${c.bg} ${c.text} ${c.border}` : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}>
                                                {c.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Lokasi / Ruangan</label>
                                    <input type="text" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-600 outline-none" placeholder="Gedung, lantai..." />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <input type="checkbox" id="pinEvent" checked={form.isPinned} onChange={e => setForm({ ...form, isPinned: e.target.checked })} className="w-5 h-5 rounded-lg border-amber-200 text-amber-500 focus:ring-amber-500" />
                                    <label htmlFor="pinEvent" className="text-xs font-bold text-slate-600 cursor-pointer">Tandai agenda mendesak</label>
                                </div>
                                <button onClick={handleSave} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 active:scale-95">
                                    Simpan Agenda
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SarprasCalendar;
