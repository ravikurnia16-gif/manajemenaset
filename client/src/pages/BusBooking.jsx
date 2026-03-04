import { useState, useEffect } from 'react';
import {
    Bus, Calendar, MapPin, Clock, Users, Plus, X, ArrowRight, Trash2, Search, Info, ChevronLeft, ChevronRight, LayoutList
} from 'lucide-react';
import api from '../lib/axios';

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const BusBooking = () => {
    const [vehicles, setVehicles] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [toasts, setToasts] = useState([]);
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'

    // Calendar States
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [selectedDate, setSelectedDate] = useState(null);

    // Modal States
    const [showBorrowModal, setShowBorrowModal] = useState(false);
    const [selectedVehicle, setSelectedVehicle] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        vehicleId: '',
        startDate: '',
        startTime: '08:00',
        endDate: '',
        endTime: '17:00',
        destination: '',
        purpose: '',
        passengerCount: 1
    });

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const showToast = (message, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    useEffect(() => {
        fetchVehicles();
        fetchBookings();
    }, []);

    const fetchVehicles = async () => {
        try {
            const res = await api.get('/vehicles');
            // Filter only BUS or MINIBUS
            const busOnly = res.data.filter(v =>
                v.type?.toUpperCase().includes('BUS') ||
                v.name?.toUpperCase().includes('BUS')
            );
            setVehicles(busOnly);
        } catch (err) { console.error(err); }
    };

    const fetchBookings = async () => {
        try {
            setLoading(true);
            const res = await api.get('/bus-bookings');
            setBookings(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            const startStr = `${formData.startDate}T${formData.startTime}`;
            const endStr = `${formData.endDate}T${formData.endTime}`;

            await api.post('/bus-bookings', {
                ...formData,
                startDate: new Date(startStr),
                endDate: new Date(endStr)
            });

            showToast('Booking berhasil dicatat!', 'success');
            setShowBorrowModal(false);
            fetchBookings();
            setFormData({
                vehicleId: '', startDate: '', startTime: '08:00', endDate: '', endTime: '17:00',
                destination: '', purpose: '', passengerCount: 1
            });
        } catch (err) {
            showToast('Gagal mencatat booking: ' + (err.response?.data?.error || err.message), 'error');
        } finally { setSubmitting(false); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Hapus jadwal booking ini?')) return;
        try {
            await api.delete(`/bus-bookings/${id}`);
            showToast('Booking berhasil dihapus');
            fetchBookings();
        } catch (err) {
            showToast('Gagal menghapus: ' + (err.response?.data?.error || err.message), 'error');
        }
    };

    // Calendar logic
    const calendarDays = (() => {
        const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
        const days = [];
        for (let i = 0; i < firstDay; i++) days.push(null);
        for (let d = 1; d <= daysInMonth; d++) days.push(d);
        return days;
    })();

    const getBookingsForDay = (day) => {
        if (!day) return [];
        const targetDate = new Date(currentYear, currentMonth - 1, day);
        targetDate.setHours(0, 0, 0, 0);
        const targetTime = targetDate.getTime();

        return bookings.filter(b => {
            const start = new Date(b.startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(b.endDate);
            end.setHours(23, 59, 59, 999);
            return targetTime >= start.getTime() && targetTime <= end.getTime();
        });
    };

    const prevMonth = () => {
        if (currentMonth === 1) { setCurrentMonth(12); setCurrentYear(y => y - 1); }
        else setCurrentMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (currentMonth === 12) { setCurrentMonth(1); setCurrentYear(y => y + 1); }
        else setCurrentMonth(m => m + 1);
    };

    const isToday = (day) => day === today.getDate() && currentMonth === today.getMonth() + 1 && currentYear === today.getFullYear();

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Bus className="text-blue-600" /> Booking Jadwal Bus
                    </h1>
                    <p className="text-slate-500 text-sm">Pencatatan penggunaan bus operasional.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-slate-100 p-1 rounded-xl mr-2">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <LayoutList size={14} /> Daftar
                        </button>
                        <button
                            onClick={() => setViewMode('calendar')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${viewMode === 'calendar' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Calendar size={14} /> Kalender
                        </button>
                    </div>
                    <button
                        onClick={() => setShowBorrowModal(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                    >
                        <Plus size={18} /> Tambah Jadwal
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Available Buses */}
                <div className="lg:col-span-1 space-y-4">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-1">Armada Bus</h2>
                    {vehicles.length === 0 ? (
                        <div className="bg-white p-8 text-center rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                            Tidak ada armada bus ditemukan.
                        </div>
                    ) : (
                        vehicles.map(v => (
                            <div key={v.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                                <div className="flex gap-4 items-center">
                                    <div className="w-16 h-16 bg-slate-50 rounded-xl flex items-center justify-center text-slate-300">
                                        <Bus size={32} />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-slate-800">{v.name}</h3>
                                        <p className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded inline-block mt-1">{v.plateNumber}</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setSelectedVehicle(v);
                                            setFormData(prev => ({ ...prev, vehicleId: v.id }));
                                            setShowBorrowModal(true);
                                        }}
                                        className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                                    >
                                        <Plus size={18} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Main View Area */}
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-1">
                        {viewMode === 'list' ? 'Jadwal Mendatang' : 'Kalender Jadwal'}
                    </h2>

                    {viewMode === 'list' ? (
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            {loading ? (
                                <div className="p-12 text-center text-slate-400">Memuat data...</div>
                            ) : bookings.length === 0 ? (
                                <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                                    <Calendar size={48} strokeWidth={1} />
                                    <p>Belum ada jadwal booking bus.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {bookings.map(b => (
                                        <div key={b.id} className="p-4 hover:bg-slate-50/50 transition-colors flex items-center justify-between group">
                                            <div className="flex gap-4 items-start">
                                                <div className="bg-blue-50 text-blue-600 p-3 rounded-xl">
                                                    <Bus size={20} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-800">{b.vehicle.name}</span>
                                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono font-bold uppercase">{b.vehicle.plateNumber}</span>
                                                    </div>
                                                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                                        <div className="flex items-center gap-1.5">
                                                            <Calendar size={14} className="text-blue-500" />
                                                            {new Date(b.startDate).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                            {new Date(b.startDate).toDateString() !== new Date(b.endDate).toDateString() && (
                                                                <>
                                                                    <ArrowRight size={10} className="mx-0.5" />
                                                                    {new Date(b.endDate).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                                </>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 font-bold text-slate-700">
                                                            <Clock size={14} className="text-blue-500" />
                                                            {new Date(b.startDate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} - {new Date(b.endDate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-blue-600 font-bold">
                                                            <MapPin size={14} /> {b.destination}
                                                        </div>
                                                    </div>
                                                    <div className="mt-2 text-xs text-slate-400 flex items-center gap-2">
                                                        <span className="font-bold text-slate-600">Pemohon: {b.user.name}</span>
                                                        <span>•</span>
                                                        <span>Kapasitas: {b.passengerCount} Orang</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {(b.userId === user.id || ['SUPER_ADMIN', 'ADMIN_ASET'].includes(user.role)) && (
                                                    <button
                                                        onClick={() => handleDelete(b.id)}
                                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Calendar Header */}
                            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                                <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-lg transition"><ChevronLeft size={20} /></button>
                                <div className="text-center">
                                    <h3 className="font-bold text-slate-800">{MONTH_NAMES[currentMonth - 1]} {currentYear}</h3>
                                </div>
                                <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-lg transition"><ChevronRight size={20} /></button>
                            </div>

                            {/* Calendar Body */}
                            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                                <div className="grid grid-cols-7 mb-2">
                                    {DAY_NAMES.map(d => (
                                        <div key={d} className={`text-center text-[10px] font-bold uppercase py-2 ${d === 'Min' ? 'text-red-400' : 'text-slate-400'}`}>{d}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-1">
                                    {calendarDays.map((day, i) => {
                                        if (!day) return <div key={`empty-${i}`} className="min-h-[100px] bg-slate-50/30 rounded-xl" />;
                                        const dayBookings = getBookingsForDay(day);
                                        const isSunday = new Date(currentYear, currentMonth - 1, day).getDay() === 0;
                                        return (
                                            <div
                                                key={day}
                                                onClick={() => setSelectedDate(selectedDate === day ? null : day)}
                                                className={`min-h-[100px] p-2 rounded-2xl border cursor-pointer transition-all hover:shadow-md relative group ${isToday(day) ? 'border-blue-400 bg-blue-50/30 shadow-sm ring-1 ring-blue-100' :
                                                    selectedDate === day ? 'border-slate-400 bg-slate-50 ring-1 ring-slate-300' :
                                                        'border-slate-100 hover:border-slate-200'
                                                    }`}
                                            >
                                                <div className={`text-xs font-bold mb-2 flex items-center justify-between ${isSunday ? 'text-red-500' : isToday(day) ? 'text-blue-700' : 'text-slate-600'}`}>
                                                    <span className={isToday(day) ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-[11px] shadow-sm shadow-blue-200' : ''}>{day}</span>
                                                </div>
                                                <div className="space-y-1">
                                                    {dayBookings.slice(0, 3).map((b, idx) => (
                                                        <div key={b.id} className="text-[9px] px-1.5 py-1 rounded-lg truncate font-bold bg-blue-100 text-blue-700 border border-blue-200" title={`${b.vehicle.name} - ${b.destination}`}>
                                                            {b.vehicle.name}
                                                        </div>
                                                    ))}
                                                    {dayBookings.length > 3 && (
                                                        <div className="text-[9px] text-slate-400 font-bold text-center">+{dayBookings.length - 3} lagi</div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Selected Date Detail */}
                            {selectedDate && (
                                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-lg animate-in slide-in-from-bottom-2">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="font-bold text-slate-800">
                                            {selectedDate} {MONTH_NAMES[currentMonth - 1]} {currentYear}
                                        </h4>
                                        <button onClick={() => setSelectedDate(null)} className="p-1 hover:bg-slate-100 rounded-full text-slate-400"><X size={18} /></button>
                                    </div>
                                    <div className="space-y-3">
                                        {getBookingsForDay(selectedDate).length === 0 ? (
                                            <p className="text-sm text-slate-400 italic text-center py-4">Tidak ada jadwal pada tanggal ini.</p>
                                        ) : (
                                            getBookingsForDay(selectedDate).map(b => (
                                                <div key={b.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group">
                                                    <div className="flex gap-3 items-center">
                                                        <div className="bg-blue-600 text-white p-2 rounded-xl">
                                                            <Bus size={16} />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold text-slate-800">{b.vehicle.name} ({b.vehicle.plateNumber})</div>
                                                            <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                                                                <span className="flex items-center gap-1"><MapPin size={10} /> {b.destination}</span>
                                                                <span className="flex items-center gap-1"><Clock size={10} /> {new Date(b.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {(b.userId === user.id || ['SUPER_ADMIN', 'ADMIN_ASET'].includes(user.role)) && (
                                                        <button
                                                            onClick={() => handleDelete(b.id)}
                                                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Form */}
            {showBorrowModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
                            <h2 className="text-xl font-bold flex items-center gap-3">
                                <Bus size={24} /> Catat Jadwal Bus
                            </h2>
                            <button onClick={() => setShowBorrowModal(false)} className="hover:bg-white/10 p-1 rounded-full">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Pilih Armada Bus</label>
                                <select
                                    required
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.vehicleId}
                                    onChange={e => setFormData({ ...formData, vehicleId: e.target.value })}
                                >
                                    <option value="">Pilih Bus...</option>
                                    {vehicles.map(v => (
                                        <option key={v.id} value={v.id}>{v.name} ({v.plateNumber})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Mulai Tanggal</label>
                                    <input
                                        type="date" required
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.startDate}
                                        onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Selesai Tanggal</label>
                                    <input
                                        type="date" required
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.endDate}
                                        onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Jam Mulai</label>
                                    <input
                                        type="time" required
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.startTime}
                                        onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Jam Selesai</label>
                                    <input
                                        type="time" required
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.endTime}
                                        onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Tujuan</label>
                                <input
                                    type="text" required
                                    placeholder="Contoh: Gedung A, Lokasi Kegiatan"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.destination}
                                    onChange={e => setFormData({ ...formData, destination: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Jumlah Penumpang</label>
                                    <input
                                        type="number" min="1" required
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.passengerCount}
                                        onChange={e => setFormData({ ...formData, passengerCount: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Keperluan (Opsional)</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.purpose}
                                        onChange={e => setFormData({ ...formData, purpose: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowBorrowModal(false)}
                                    className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-600"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-[2] py-3 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center gap-2"
                                >
                                    {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Simpan Jadwal'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Toasts */}
            <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
                {toasts.map(t => (
                    <div key={t.id} className={`px-4 py-3 rounded-xl shadow-2xl border text-white text-sm font-bold animate-in slide-in-from-right duration-300 ${t.type === 'success' ? 'bg-green-600 border-green-500' : 'bg-red-600 border-red-500'}`}>
                        {t.type === 'success' ? '✅ ' : '❌ '}{t.message}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BusBooking;
