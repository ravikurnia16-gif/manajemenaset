import { useState, useEffect } from 'react';
import {
    Bus, Calendar, MapPin, Clock, Users, Plus, X, ArrowRight, Info, ChevronLeft, ChevronRight, Phone, User
} from 'lucide-react';
import api from '../lib/axios';

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const BusBookingPublic = () => {
    const [vehicles, setVehicles] = useState([]);
    const [units, setUnits] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [toasts, setToasts] = useState([]);

    // Calendar States
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedBooking, setSelectedBooking] = useState(null);

    // Modal States
    const [showBorrowModal, setShowBorrowModal] = useState(false);
    const [formData, setFormData] = useState({
        vehicleId: '',
        requesterName: '',
        requesterPhone: '',
        unit: '',
        destination: '',
        purpose: '',
        startDate: '',
        endDate: '',
        startTime: '08:00',
        endTime: '17:00',
        passengerCount: 1
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [vRes, bRes, uRes] = await Promise.all([
                api.get('/vehicles/public'),
                api.get('/bus-bookings/public'),
                api.get('/master/units/public')
            ]);
            setVehicles(vRes.data.filter(v => v.type?.toLowerCase().includes('bus') || v.name?.toLowerCase().includes('bus')));
            setBookings(bRes.data);
            setUnits(uRes.data);
        } catch (err) {
            showToast('Gagal memuat data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const showToast = (message, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const startStr = `${formData.startDate}T${formData.startTime}:00`;
            const endStr = `${formData.endDate}T${formData.endTime}:00`;

            if (new Date(startStr) >= new Date(endStr)) {
                throw new Error('Waktu selesai harus setelah waktu mulai');
            }

            await api.post('/bus-bookings/public', {
                ...formData,
                startDate: startStr,
                endDate: endStr
            });

            showToast('Booking berhasil diajukan!');
            setShowBorrowModal(false);
            setFormData({
                vehicleId: '',
                requesterName: '',
                requesterPhone: '',
                unit: '',
                destination: '',
                purpose: '',
                startDate: '',
                endDate: '',
                startTime: '08:00',
                endTime: '17:00',
                passengerCount: 1
            });
            fetchData();
        } catch (err) {
            showToast(err.response?.data?.error || err.message, 'error');
        } finally {
            setSubmitting(false);
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
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200">
                                <Bus size={24} />
                            </div>
                            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Public Bus Booking</h1>
                        </div>
                        <p className="text-slate-500">Lihat jadwal dan ajukan pemesanan bus operasional secara publik.</p>
                    </div>
                    <button
                        onClick={() => setShowBorrowModal(true)}
                        className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 active:scale-95"
                    >
                        <Plus size={20} /> Buat Pesanan Baru
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Bus Info Cards */}
                    <div className="space-y-4">
                        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-1">Armada Bus Kami</h2>
                        <div className="space-y-3">
                            {loading ? (
                                [1, 2].map(i => <div key={i} className="h-24 bg-white rounded-2xl border border-slate-100 animate-pulse" />)
                            ) : vehicles.length === 0 ? (
                                <div className="bg-white p-6 rounded-2xl border border-slate-100 text-center text-slate-400 italic text-sm">Tidak ada bus tersedia.</div>
                            ) : vehicles.map(v => (
                                <div key={v.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-slate-100 p-3 rounded-xl text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                                <Bus size={24} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-800">{v.name}</h3>
                                                <p className="text-xs text-slate-400 font-mono mt-0.5">{v.plateNumber}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setFormData(prev => ({ ...prev, vehicleId: v.id }));
                                                setShowBorrowModal(true);
                                            }}
                                            className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                            title="Pesan Bus Ini"
                                        >
                                            <Plus size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Calendar Section */}
                    <div className="lg:col-span-2 space-y-4">
                        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-1">Jadwal Penggunaan</h2>

                        <div className="space-y-4">
                            {/* Calendar Navigation */}
                            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                                <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-lg transition"><ChevronLeft size={20} /></button>
                                <div className="text-center">
                                    <h3 className="font-bold text-slate-800 text-lg">{MONTH_NAMES[currentMonth - 1]} {currentYear}</h3>
                                </div>
                                <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-lg transition"><ChevronRight size={20} /></button>
                            </div>

                            {/* Calendar Grid */}
                            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                                <div className="grid grid-cols-7 mb-4">
                                    {DAY_NAMES.map(d => (
                                        <div key={d} className={`text-center text-[11px] font-bold uppercase py-2 ${d === 'Min' ? 'text-red-400' : 'text-slate-400'}`}>{d}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-2">
                                    {calendarDays.map((day, i) => {
                                        if (!day) return <div key={`empty-${i}`} className="min-h-[120px] bg-slate-50/30 rounded-2xl" />;
                                        const dayBookings = getBookingsForDay(day);
                                        const isSunday = new Date(currentYear, currentMonth - 1, day).getDay() === 0;
                                        return (
                                            <div
                                                key={day}
                                                onClick={() => setSelectedDate(selectedDate === day ? null : day)}
                                                className={`min-h-[120px] p-2 rounded-2xl border cursor-pointer transition-all hover:shadow-lg relative group ${isToday(day) ? 'border-blue-400 bg-blue-50/30 ring-1 ring-blue-100' :
                                                    selectedDate === day ? 'border-slate-400 bg-slate-50 ring-1 ring-slate-300' :
                                                        'border-slate-100 hover:border-slate-200 bg-white'
                                                    }`}
                                            >
                                                <div className={`text-xs font-bold mb-2 flex items-center justify-between ${isSunday ? 'text-red-500' : isToday(day) ? 'text-blue-700' : 'text-slate-600'}`}>
                                                    <span className={isToday(day) ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-[11px] shadow-sm shadow-blue-200' : ''}>{day}</span>
                                                </div>
                                                <div className="space-y-1">
                                                    {dayBookings.slice(0, 3).map((b, idx) => (
                                                        <div
                                                            key={b.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedBooking(b);
                                                            }}
                                                            className="text-[8px] sm:text-[9px] px-1 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg font-bold bg-blue-100 text-blue-700 border border-blue-200 leading-tight hover:bg-blue-600 hover:text-white transition-all active:scale-95 overflow-hidden"
                                                        >
                                                            <div className="truncate">{b.vehicle.name}</div>
                                                            <div className="text-[7px] sm:text-[7.5px] opacity-70 font-medium truncate">@{b.unit || 'Umum'}</div>
                                                        </div>
                                                    ))}
                                                    {dayBookings.length > 3 && (
                                                        <div className="text-[9px] text-slate-400 font-bold text-center mt-1">+{dayBookings.length - 3} lagi</div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Selected Date Detail */}
                            {selectedDate && (
                                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl animate-in slide-in-from-bottom-4">
                                    <div className="flex items-center justify-between mb-6">
                                        <h4 className="font-extrabold text-xl text-slate-800">
                                            Jadwal pada {selectedDate} {MONTH_NAMES[currentMonth - 1]} {currentYear}
                                        </h4>
                                        <button onClick={() => setSelectedDate(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"><X size={24} /></button>
                                    </div>
                                    <div className="space-y-4">
                                        {getBookingsForDay(selectedDate).length === 0 ? (
                                            <div className="p-8 text-center text-slate-400 italic">Tidak ada jadwal pada tanggal ini.</div>
                                        ) : (
                                            getBookingsForDay(selectedDate).map(b => (
                                                <div
                                                    key={b.id}
                                                    onClick={() => setSelectedBooking(b)}
                                                    className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between cursor-pointer hover:bg-blue-50/50 hover:border-blue-200 transition-all group"
                                                >
                                                    <div className="flex gap-4 items-center">
                                                        <div className="bg-blue-600 text-white p-3 rounded-2xl shadow-md group-hover:scale-110 transition-transform">
                                                            <Bus size={20} />
                                                        </div>
                                                        <div>
                                                            <div className="text-lg font-bold text-slate-800">{b.vehicle.name} ({b.vehicle.plateNumber})</div>
                                                            <div className="text-sm text-slate-500 flex items-center gap-4 mt-1">
                                                                <span className="flex items-center gap-1.5 font-medium text-blue-600"><Plus size={14} /> {b.unit || 'Umum'}</span>
                                                                <span className="flex items-center gap-1.5 font-medium"><MapPin size={14} className="text-slate-400" /> {b.destination}</span>
                                                                <span className="flex items-center gap-1.5 font-medium text-slate-700"><Clock size={14} className="text-slate-400" /> {new Date(b.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <ArrowRight size={20} className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Booking Modal */}
            {showBorrowModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-extrabold text-slate-800">Ajukan Booking Bus</h3>
                                <p className="text-xs text-slate-500 mt-1">Lengkapi data perjalanan Anda di bawah ini.</p>
                            </div>
                            <button onClick={() => setShowBorrowModal(false)} className="p-2 hover:bg-white rounded-full text-slate-400 transition-colors shadow-sm">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Armada */}
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Pilih Armada Bus</label>
                                    <select
                                        required
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        value={formData.vehicleId}
                                        onChange={e => setFormData({ ...formData, vehicleId: e.target.value })}
                                    >
                                        <option value="">-- Pilih Bus --</option>
                                        {vehicles.map(v => (
                                            <option key={v.id} value={v.id}>{v.name} ({v.plateNumber})</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Personal Info */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nama Pemesan</label>
                                    <div className="relative">
                                        <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            required
                                            placeholder="Nama Lengkap"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            value={formData.requesterName}
                                            onChange={e => setFormData({ ...formData, requesterName: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Unit / Departemen</label>
                                    <select
                                        required
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        value={formData.unit}
                                        onChange={e => setFormData({ ...formData, unit: e.target.value })}
                                    >
                                        <option value="">-- Pilih Unit --</option>
                                        {units.map(u => (
                                            <option key={u.id} value={u.name}>{u.name}</option>
                                        ))}
                                        <option value="LAINNYA">Lainnya / Umum</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">No. HP / WhatsApp</label>
                                    <div className="relative">
                                        <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            required
                                            placeholder="Contoh: 08123456789"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            value={formData.requesterPhone}
                                            onChange={e => setFormData({ ...formData, requesterPhone: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="hidden md:block"></div>

                                {/* Dates */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tanggal Mulai</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        value={formData.startDate}
                                        onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Jam Mulai</label>
                                    <input
                                        type="time"
                                        required
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        value={formData.startTime}
                                        onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tanggal Selesai</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        value={formData.endDate}
                                        onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Jam Selesai</label>
                                    <input
                                        type="time"
                                        required
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        value={formData.endTime}
                                        onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                                    />
                                </div>

                                {/* Destination & Purpose */}
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tujuan Perjalanan</label>
                                    <div className="relative">
                                        <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            required
                                            placeholder="Contoh: Yogyakarta, Bali, Jakarta"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            value={formData.destination}
                                            onChange={e => setFormData({ ...formData, destination: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="md:col-span-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Jumlah Penumpang</label>
                                    <div className="relative">
                                        <Users size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="number"
                                            min="1"
                                            required
                                            placeholder="Contoh: 30"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            value={formData.passengerCount}
                                            onChange={e => setFormData({ ...formData, passengerCount: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Keperluan / Keterangan</label>
                                    <textarea
                                        rows={3}
                                        placeholder="Tulis alasan atau detail lainnya..."
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                                        value={formData.purpose}
                                        onChange={e => setFormData({ ...formData, purpose: e.target.value })}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-blue-600 text-white font-bold py-5 rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 group active:scale-[0.98]"
                            >
                                {submitting ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>Kirim Pesanan <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" /></>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {selectedBooking && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-6 bg-blue-600 text-white flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="bg-white/20 p-2 rounded-xl">
                                    <Bus size={24} />
                                </div>
                                <h3 className="text-xl font-bold italic tracking-tight">Detail Booking Bus</h3>
                            </div>
                            <button onClick={() => setSelectedBooking(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Armada</label>
                                    <div className="text-lg font-bold text-slate-800">{selectedBooking.vehicle.name} ({selectedBooking.vehicle.plateNumber})</div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Pemesan</label>
                                        <div className="font-bold text-slate-700">{selectedBooking.requesterName || selectedBooking.user?.name || '-'}</div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Unit</label>
                                        <div className="font-bold text-blue-600">{selectedBooking.unit || 'Umum'}</div>
                                    </div>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-2xl space-y-3 border border-slate-100">
                                    <div className="flex items-start gap-3">
                                        <MapPin size={16} className="text-blue-500 mt-1" />
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Tujuan</label>
                                            <div className="text-sm font-bold text-slate-800">{selectedBooking.destination}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <Calendar size={16} className="text-blue-500 mt-1" />
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Jadwal</label>
                                            <div className="text-sm font-bold text-slate-800">
                                                {new Date(selectedBooking.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} -
                                                {new Date(selectedBooking.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                            </div>
                                            <div className="text-xs text-slate-500 font-medium mt-0.5">
                                                {new Date(selectedBooking.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} s/d {new Date(selectedBooking.endDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <Users size={16} className="text-blue-500 mt-1" />
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Penumpang</label>
                                            <div className="text-sm font-bold text-slate-800">{selectedBooking.passengerCount} Orang</div>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Keperluan</label>
                                    <div className="text-sm text-slate-600 bg-slate-50 p-4 rounded-2xl italic border border-slate-100">
                                        {selectedBooking.purpose || 'Tidak ada keterangan tambahan.'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Toasts */}
            <div className="fixed bottom-8 right-8 z-[100] flex flex-col gap-3">
                {toasts.map(t => (
                    <div
                        key={t.id}
                        className={`${t.type === 'error' ? 'bg-red-500' : 'bg-blue-600'} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-full duration-300 font-bold`}
                    >
                        {t.type === 'error' ? <Info size={20} /> : <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">✓</div>}
                        {t.message}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BusBookingPublic;
