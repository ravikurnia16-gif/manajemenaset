import { useState, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Pin, MapPin, Clock, Repeat, Trash2, Edit3, X, BarChart3, Wrench, User, Search } from 'lucide-react';
import api from '../lib/axios';

const CATEGORIES = [
    { name: 'Pemeliharaan', color: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
    { name: 'Pengadaan', color: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
    { name: 'Kerja', color: 'bg-indigo-500', text: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
    { name: 'Kebersihan', color: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
    { name: 'Rapat', color: 'bg-purple-500', text: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
    { name: 'Deadline', color: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
    { name: 'Lainnya', color: 'bg-slate-400', text: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
];

const RECURRING_TYPES = [
    { value: '', label: 'Tidak Berulang' },
    { value: 'DAILY', label: 'Setiap Hari' },
    { value: 'WEEKLY', label: 'Setiap Minggu' },
    { value: 'MONTHLY', label: 'Setiap Bulan' },
    { value: 'YEARLY', label: 'Setiap Tahun' },
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

    // Form State
    const [form, setForm] = useState({
        title: '', description: '', category: 'Lainnya', date: '',
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
            const res = await api.get('/users');
            setUsers(res.data.map(u => ({ id: u.id, name: u.name || u.username })));
        } catch (err) { console.error(err); }
    };

    // Calendar grid
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

        // Target date normalized to local midnight
        const targetDate = new Date(currentYear, currentMonth - 1, day);
        targetDate.setHours(0, 0, 0, 0);
        const targetTime = targetDate.getTime();

        return events.filter(event => {
            if (!event.date) return false;

            // Start date normalized to local midnight
            const startDate = new Date(event.date);
            startDate.setHours(0, 0, 0, 0);
            const startTime = startDate.getTime();

            // If it has an endDate, check range
            if (event.endDate) {
                const endDate = new Date(event.endDate);
                endDate.setHours(23, 59, 59, 999);
                const endTime = endDate.getTime();
                return targetTime >= startTime && targetTime <= endTime;
            }

            // Fallback to single day event
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
        setForm({ title: '', description: '', category: 'Lainnya', date: dateStr, endDate: '', isPinned: false, location: '', picIds: [], isRecurring: false, recurringType: '', recurringInterval: 1, recurringDays: [], recurringEndDate: '' });
        setEditingEvent(null);
        setPicSearch('');
        setShowModal(true);
    };

    const openEditModal = (event) => {
        setForm({
            title: event.title, description: event.description || '',
            category: event.category, date: event.date?.split('T')[0] || '',
            endDate: event.endDate?.split('T')[0] || '', isPinned: event.isPinned,
            location: event.location || '', picIds: event.pics?.map(p => p.id) || [],
            isRecurring: event.isRecurring, recurringType: event.recurringType || '',
            recurringInterval: event.recurringInterval || 1,
            recurringDays: event.recurringDays ? event.recurringDays.split(',').map(Number) : [],
            recurringEndDate: event.recurringEndDate?.split('T')[0] || ''
        });
        setEditingEvent(event);
        setPicSearch('');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.title || !form.date) return alert('Judul dan tanggal wajib diisi');
        try {
            const payload = {
                ...form,
                picIds: (form.picIds || []).map(id => parseInt(id)),
                isRecurring: form.isRecurring,
                recurringType: form.isRecurring ? form.recurringType : null,
                recurringInterval: form.isRecurring ? parseInt(form.recurringInterval) : 1,
                recurringDays: (form.isRecurring && form.recurringType === 'WEEKLY') ? form.recurringDays : null,
                recurringEndDate: form.isRecurring && form.recurringEndDate ? form.recurringEndDate : null
            };

            if (editingEvent) {
                await api.put(`/calendar/${editingEvent.id}`, payload);
            } else {
                await api.post('/calendar', payload);
            }
            setShowModal(false);
            alert('Kegiatan berhasil disimpan');
            fetchAll();
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal menyimpan');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Hapus kegiatan ini?')) return;
        try {
            await api.delete(`/calendar/${id}`);
            fetchAll();
            setSelectedDate(null);
        } catch (err) {
            alert('Gagal menghapus');
        }
    };

    const isToday = (day) => day === today.getDate() && currentMonth === today.getMonth() + 1 && currentYear === today.getFullYear();

    return (
        <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in">
            {/* HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <CalendarIcon className="text-indigo-600" /> Kalender Kerja Sarpras
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Jadwal kegiatan bidang Sarana & Prasarana</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowSummary(!showSummary)} className="px-3 py-2 text-xs font-bold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 transition">
                        <BarChart3 size={14} /> Ringkasan
                    </button>
                    {canEdit && (
                        <button onClick={() => openAddModal(today.getDate())} className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 flex items-center gap-1.5 shadow-sm transition">
                            <Plus size={14} /> Tambah Kegiatan
                        </button>
                    )}
                </div>
            </div>

            {/* PINNED EVENTS BAR */}
            {pinnedEvents.length > 0 && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
                    <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Pin size={12} /> Kegiatan Penting
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {pinnedEvents.map(e => (
                            <div key={e.id} className="bg-white px-3 py-1.5 rounded-lg border border-amber-200 text-xs font-medium text-slate-700 flex items-center gap-2 shadow-sm">
                                <span className={`w-2 h-2 rounded-full ${getCategoryStyle(e.category).color}`} />
                                <span className="font-bold">{e.title}</span>
                                <span className="text-slate-400">{new Date(e.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* SUMMARY PANEL */}
            {showSummary && summary && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm animate-in slide-in-from-top-2">
                    <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <BarChart3 size={16} /> Ringkasan {MONTH_NAMES[currentMonth - 1]} {currentYear}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-indigo-50 rounded-lg p-3 text-center border border-indigo-100">
                            <div className="text-2xl font-bold text-indigo-700">{summary.totalEvents}</div>
                            <div className="text-[10px] font-bold text-indigo-500 uppercase">Total Kegiatan</div>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-100">
                            <div className="text-2xl font-bold text-amber-700">{summary.totalPinned}</div>
                            <div className="text-[10px] font-bold text-amber-500 uppercase">Diprioritaskan</div>
                        </div>
                        {Object.entries(summary.byCategory || {}).map(([cat, count]) => {
                            const style = getCategoryStyle(cat);
                            return (
                                <div key={cat} className={`${style.bg} rounded-lg p-3 text-center ${style.border} border`}>
                                    <div className={`text-2xl font-bold ${style.text}`}>{count}</div>
                                    <div className={`text-[10px] font-bold ${style.text} uppercase opacity-70`}>{cat}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* MONTH NAVIGATION */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-lg transition"><ChevronLeft size={20} /></button>
                    <div className="text-center">
                        <h2 className="text-lg font-bold text-slate-800">{MONTH_NAMES[currentMonth - 1]} {currentYear}</h2>
                        <button onClick={goToday} className="text-[10px] font-bold text-indigo-600 hover:underline mt-0.5">Hari Ini</button>
                    </div>
                    <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-lg transition"><ChevronRight size={20} /></button>
                </div>

                {/* CALENDAR GRID */}
                {loading ? (
                    <div className="p-12 text-center text-slate-400 animate-pulse">Memuat kalender...</div>
                ) : (
                    <div className="p-3">
                        {/* Day Headers */}
                        <div className="grid grid-cols-7 mb-1">
                            {DAY_NAMES.map(d => (
                                <div key={d} className={`text-center text-[10px] font-bold uppercase py-2 ${d === 'Min' ? 'text-red-400' : 'text-slate-400'}`}>{d}</div>
                            ))}
                        </div>
                        {/* Day Cells */}
                        <div className="grid grid-cols-7 gap-1">
                            {calendarDays.map((day, i) => {
                                if (!day) return <div key={`empty-${i}`} className="min-h-[80px]" />;
                                const dayEvents = getEventsForDay(day);
                                const isSunday = new Date(currentYear, currentMonth - 1, day).getDay() === 0;
                                return (
                                    <div
                                        key={day}
                                        onClick={() => setSelectedDate(selectedDate === day ? null : day)}
                                        className={`min-h-[80px] p-1.5 rounded-lg border cursor-pointer transition-all hover:shadow-md ${isToday(day) ? 'border-indigo-400 bg-indigo-50/50 ring-1 ring-indigo-200' :
                                            selectedDate === day ? 'border-slate-400 bg-slate-50 ring-1 ring-slate-300' :
                                                'border-slate-100 hover:border-slate-200'
                                            }`}
                                    >
                                        <div className={`text-xs font-bold mb-1 flex items-center justify-between ${isSunday ? 'text-red-500' : isToday(day) ? 'text-indigo-700' : 'text-slate-600'}`}>
                                            <span className={isToday(day) ? 'bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-[11px]' : ''}>{day}</span>
                                            {canEdit && (
                                                <button onClick={(e) => { e.stopPropagation(); openAddModal(day); }} className="opacity-0 group-hover:opacity-100 hover:bg-slate-200 rounded p-0.5 text-slate-400 hover:text-indigo-600 transition">
                                                    <Plus size={12} />
                                                </button>
                                            )}
                                        </div>
                                        <div className="space-y-0.5">
                                            {dayEvents.slice(0, 3).map((ev, idx) => {
                                                const style = getCategoryStyle(ev.category);
                                                return (
                                                    <div key={ev.instanceId || `${ev.id}-${idx}`} className={`text-[9px] px-1 py-0.5 rounded truncate font-medium ${style.bg} ${style.text} ${style.border} border`} title={ev.title}>
                                                        {ev.isPinned && '📌 '}{ev.title}
                                                    </div>
                                                );
                                            })}
                                            {dayEvents.length > 3 && (
                                                <div className="text-[9px] text-slate-400 font-bold text-center">+{dayEvents.length - 3} lagi</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* SELECTED DATE DETAIL PANEL */}
            {selectedDate && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm animate-in slide-in-from-bottom-2">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-800">
                            {selectedDate} {MONTH_NAMES[currentMonth - 1]} {currentYear}
                        </h3>
                        <div className="flex items-center gap-2">
                            {canEdit && (
                                <button onClick={() => openAddModal(selectedDate)} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-1">
                                    <Plus size={12} /> Tambah
                                </button>
                            )}
                            <button onClick={() => setSelectedDate(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                        </div>
                    </div>
                    {getEventsForDay(selectedDate).length === 0 ? (
                        <p className="text-sm text-slate-400 italic text-center py-6">Tidak ada kegiatan pada tanggal ini.</p>
                    ) : (
                        <div className="space-y-3">
                            {getEventsForDay(selectedDate).map((ev, idx) => {
                                const style = getCategoryStyle(ev.category);
                                return (
                                    <div key={`${ev.id}-${idx}`} className={`p-4 rounded-lg border ${style.border} ${style.bg} relative group`}>
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`w-2.5 h-2.5 rounded-full ${style.color}`} />
                                                    <span className={`text-sm font-bold ${style.text}`}>{ev.title}</span>
                                                    {ev.isPinned && <Pin size={12} className="text-amber-500" />}
                                                    {ev.isRecurring && <Repeat size={12} className="text-slate-400" />}
                                                </div>
                                                {ev.description && <p className="text-xs text-slate-600 ml-4.5 mb-1">{ev.description}</p>}
                                                <div className="flex flex-wrap gap-3 ml-4.5 text-[11px] text-slate-500">
                                                    {ev.location && <span className="flex items-center gap-1"><MapPin size={10} /> {ev.location}</span>}
                                                    {ev.pics && ev.pics.length > 0 && (
                                                        <div className="flex flex-wrap gap-2 mt-1 ml-4.5">
                                                            <span className="text-[11px] text-slate-500 flex items-center gap-1 self-center">
                                                                <User size={10} /> PIC:
                                                            </span>
                                                            {ev.pics.map(p => {
                                                                const ass = ev.assignments?.find(a => a.assigneeId === p.id);
                                                                const statusMap = {
                                                                    'PENDING': 'bg-slate-100 text-slate-500',
                                                                    'IN_PROGRESS': 'bg-blue-100 text-blue-600',
                                                                    'COMPLETED': 'bg-green-100 text-green-600',
                                                                    'CANCELLED': 'bg-red-100 text-red-600'
                                                                };
                                                                return (
                                                                    <span key={p.id} className={`text-[10px] px-2 py-0.5 rounded-full font-bold border border-current opacity-80 ${ass ? statusMap[ass.status] : 'bg-slate-50 text-slate-400'}`}>
                                                                        {p.name} {ass?.status === 'COMPLETED' && '✓'}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                    {ev.isRecurring && <span className="flex items-center gap-1"><Repeat size={10} /> {RECURRING_TYPES.find(r => r.value === ev.recurringType)?.label}</span>}
                                                </div>
                                            </div>
                                            {canEdit && !ev.isRecurringInstance && (
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                                                    <button onClick={() => openEditModal(ev)} className="p-1.5 hover:bg-white rounded text-slate-400 hover:text-indigo-600"><Edit3 size={14} /></button>
                                                    <button onClick={() => handleDelete(ev.id)} className="p-1.5 hover:bg-white rounded text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* CATEGORY LEGEND */}
            <div className="flex flex-wrap gap-3 justify-center">
                {CATEGORIES.map(c => (
                    <div key={c.name} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <span className={`w-2.5 h-2.5 rounded-full ${c.color}`} />
                        {c.name}
                    </div>
                ))}
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Pin size={12} className="text-amber-500" /> Penting
                </div>
            </div>

            {/* ADD/EDIT MODAL */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-in fade-in" onClick={() => setShowModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800">{editingEvent ? 'Edit Kegiatan' : 'Tambah Kegiatan Baru'}</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Title */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Judul Kegiatan *</label>
                                <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Contoh: Servis AC Gedung B" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                            </div>
                            {/* Category */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Kategori</label>
                                <div className="flex flex-wrap gap-2">
                                    {CATEGORIES.map(c => (
                                        <button key={c.name} onClick={() => setForm({ ...form, category: c.name })}
                                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${form.category === c.name ? `${c.bg} ${c.text} ${c.border}` : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                                            <span className={`inline-block w-2 h-2 rounded-full ${c.color} mr-1.5`} />{c.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Date */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Tanggal *</label>
                                    <input type="date" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Sampai Tanggal</label>
                                    <input type="date" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
                                </div>
                            </div>
                            {/* Location */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Lokasi</label>
                                <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Contoh: Gedung A Lt. 2" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
                            </div>
                            {/* PICs Multi-select with Search */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2">PIC (Penanggung Jawab)</label>
                                <div className="mb-2">
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Cari nama staff..."
                                            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50/50"
                                            value={picSearch}
                                            onChange={(e) => setPicSearch(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 border border-slate-200 rounded-lg p-3 max-h-40 overflow-y-auto bg-slate-50 shadow-inner">
                                    {users.filter(u => u.name.toLowerCase().includes(picSearch.toLowerCase())).map(u => (
                                        <label key={u.id} className="flex items-center gap-2 cursor-pointer hover:bg-white p-1 rounded transition">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 text-indigo-600 rounded"
                                                checked={form.picIds.includes(u.id)}
                                                onChange={(e) => {
                                                    const newIds = e.target.checked
                                                        ? [...form.picIds, u.id]
                                                        : form.picIds.filter(id => id !== u.id);
                                                    setForm({ ...form, picIds: newIds });
                                                }}
                                            />
                                            <span className="text-xs text-slate-700 truncate">{u.name}</span>
                                        </label>
                                    ))}
                                    {users.filter(u => u.name.toLowerCase().includes(picSearch.toLowerCase())).length === 0 && (
                                        <div className="col-span-2 text-center py-2 text-slate-400 text-[10px] italic">
                                            {picSearch ? 'Nama tidak ditemukan' : 'Tidak ada staff ditemukan'}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* Description */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Deskripsi</label>
                                <textarea className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" rows={3} placeholder="Detail kegiatan..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                            </div>
                            {/* Recurring */}
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <label className="flex items-center gap-2 cursor-pointer mb-2">
                                    <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={form.isRecurring} onChange={e => setForm({ ...form, isRecurring: e.target.checked })} />
                                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1"><Repeat size={12} /> Kegiatan Berulang</span>
                                </label>
                                {form.isRecurring && (
                                    <div className="space-y-3 mt-3 border-t border-slate-200 pt-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 mb-1">Frekuensi</label>
                                                <select className="w-full border border-slate-300 rounded-lg p-2 text-xs outline-none" value={form.recurringType} onChange={e => setForm({ ...form, recurringType: e.target.value })}>
                                                    {RECURRING_TYPES.filter(r => r.value).map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 mb-1">Setiap...</label>
                                                <div className="flex items-center gap-2">
                                                    <input type="number" min="1" className="w-16 border border-slate-300 rounded-lg p-2 text-xs outline-none" value={form.recurringInterval} onChange={e => setForm({ ...form, recurringInterval: e.target.value })} />
                                                    <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
                                                        {form.recurringType === 'DAILY' ? 'Hari' : form.recurringType === 'WEEKLY' ? 'Minggu' : form.recurringType === 'MONTHLY' ? 'Bulan' : 'Tahun'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {form.recurringType === 'WEEKLY' && (
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 mb-2">Pada Hari</label>
                                                <div className="flex justify-between gap-1">
                                                    {DAY_NAMES.map((day, idx) => (
                                                        <button
                                                            key={day}
                                                            type="button"
                                                            onClick={() => {
                                                                const newDays = form.recurringDays.includes(idx)
                                                                    ? form.recurringDays.filter(d => d !== idx)
                                                                    : [...form.recurringDays, idx];
                                                                setForm({ ...form, recurringDays: newDays });
                                                            }}
                                                            className={`w-8 h-8 rounded-full text-[10px] font-bold border transition ${form.recurringDays.includes(idx) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                                                        >
                                                            {day[0]}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 mb-1">Berulang Sampai (Opsional)</label>
                                            <input type="date" className="w-full border border-slate-300 rounded-lg p-2 text-xs outline-none" value={form.recurringEndDate} onChange={e => setForm({ ...form, recurringEndDate: e.target.value })} />
                                        </div>
                                    </div>
                                )}
                            </div>
                            {/* Pinned */}
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 text-amber-500 rounded" checked={form.isPinned} onChange={e => setForm({ ...form, isPinned: e.target.checked })} />
                                <span className="text-xs font-bold text-slate-700 flex items-center gap-1"><Pin size={12} /> Tandai Sebagai Penting</span>
                            </label>
                        </div>
                        <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded-lg transition">Batal</button>
                            <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 shadow-sm transition">
                                {editingEvent ? 'Simpan Perubahan' : 'Tambah Kegiatan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SarprasCalendar;
