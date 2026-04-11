import { useState, useEffect } from 'react';
import {
    Bus, Calendar, MapPin, Clock, Users, Plus, X, ArrowRight, Trash2, LayoutList, Phone, CheckCircle2,
    ChevronLeft, ChevronRight, Printer, BarChart3
} from 'lucide-react';
import api from '../lib/axios';

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const BusBooking = () => {
    const [vehicles, setVehicles] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const [completing, setCompleting] = useState(false);
    const [paying, setPaying] = useState(false);
    const [drivers, setDrivers] = useState([]);
    const [toasts, setToasts] = useState([]);
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [selectedInvoices, setSelectedInvoices] = useState([]);
    const [filterUnit, setFilterUnit] = useState('');
    const [revMonthFilter, setRevMonthFilter] = useState('all'); // 'all' or 'YYYY-MM'

    // Calendar States
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedBooking, setSelectedBooking] = useState(null);

    // Modal States
    const [showBorrowModal, setShowBorrowModal] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        vehicleIds: [],
        startDate: '',
        startTime: '08:00',
        endDate: '',
        endTime: '17:00',
        destination: '',
        purpose: '',
        requesterName: '',
        requesterPhone: '',
        unit: '',
        passengerCount: ''
    });

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAuthorizedForWA = user.name?.toLowerCase().includes('wegi') ||
        user.position === 'Kepala Bidang Sarana dan Prasarana' ||
        user.role === 'SUPER_ADMIN';

    const isSarpras = user.position?.toLowerCase().includes('sarana dan prasarana') || user.role === 'SUPER_ADMIN';
    const isAdminAset = user.role === 'ADMIN_ASET' || user.role === 'SUPER_ADMIN';

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
        fetchDrivers();
    }, []);

    // Auto-fill form for logged in users
    useEffect(() => {
        if (showBorrowModal && user.id) {
            // Pre-fill basic info
            setFormData(prev => ({
                ...prev,
                requesterName: prev.requesterName || user.name || '',
                requesterPhone: prev.requesterPhone || user.phone || '',
                unit: prev.unit || user.unit?.name || ''
            }));

            // If unit is missing, fetch full user profile to get unit name
            if (!user.unit?.name) {
                api.get('/user/profile').then(res => {
                    if (res.data?.unit?.name) {
                        setFormData(prev => ({
                            ...prev,
                            unit: prev.unit || res.data.unit.name
                        }));
                    }
                }).catch(err => console.error('Failed to auto-fill unit:', err));
            }
        }
    }, [showBorrowModal]);

    const fetchVehicles = async () => {
        try {
            const res = await api.get('/vehicles');
            const busOnly = res.data.filter(v =>
                v.type?.toUpperCase().includes('BUS') ||
                v.name?.toUpperCase().includes('BUS')
            );
            setVehicles(busOnly);
        } catch (err) { console.error(err); }
    };

    const fetchDrivers = async () => {
        try {
            const res = await api.get('/personnel/drivers');
            setDrivers(res.data || []);
        } catch (err) { console.error('Failed to fetch drivers:', err); }
    };

    const fetchBookings = async () => {
        try {
            setLoading(true);
            const res = await api.get('/bus-bookings');
            setBookings(res.data || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.vehicleIds.length === 0) {
            showToast('Pilih setidaknya satu armada', 'error');
            return;
        }
        if (!formData.requesterName || !formData.requesterPhone) {
            showToast('Nama dan No. HP wajib diisi', 'error');
            return;
        }
        try {
            setSubmitting(true);
            const startStr = `${formData.startDate}T${formData.startTime}`;
            const endStr = `${formData.endDate}T${formData.endTime}`;

            await api.post('/bus-bookings', {
                ...formData,
                startDate: new Date(startStr),
                endDate: new Date(endStr)
            });

            showToast('Booking berhasil dicatat!');
            setShowBorrowModal(false);
            fetchBookings();
            setFormData({
                vehicleIds: [], startDate: '', startTime: '08:00', endDate: '', endTime: '17:00',
                destination: '', purpose: '', passengerCount: '', requesterName: '', requesterPhone: '', unit: ''
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

    const handleAssignDriver = async (bookingId, driverId) => {
        try {
            setAssigning(true);
            await api.put(`/bus-bookings/${bookingId}/assign-driver`, { driverId });
            showToast('Supir berhasil ditugaskan');
            fetchBookings();
            // Update selected booking with new driver data
            const res = await api.get('/bus-bookings');
            const updated = res.data.find(b => b.id === bookingId);
            if (updated) setSelectedBooking(updated);
        } catch (err) {
            showToast('Gagal menugaskan supir: ' + (err.response?.data?.error || err.message), 'error');
        } finally {
            setAssigning(false);
        }
    };

    const handleCompleteTrip = async (bookingId, totalKm) => {
        if (!totalKm || totalKm <= 0) {
            showToast('Input KM perjalanan yang valid', 'error');
            return;
        }
        try {
            setCompleting(true);
            const res = await api.put(`/bus-bookings/${bookingId}/complete`, { totalKm });
            showToast('Perjalanan selesai & Tagihan terkirim!');
            fetchBookings();
            setSelectedBooking(res.data);
        } catch (err) {
            showToast('Gagal menyelesaikan: ' + (err.response?.data?.error || err.message), 'error');
        } finally {
            setCompleting(false);
        }
    };

    const handleMarkAsPaid = async (bookingId) => {
        if (!confirm('Tandai tagihan ini sebagai Lunas?')) return;
        try {
            setPaying(true);
            const res = await api.put(`/bus-bookings/${bookingId}/pay`);
            showToast('Pembayaran berhasil dikonfirmasi (Lunas)');
            fetchBookings();
            setSelectedBooking(res.data);
        } catch (err) {
            showToast('Gagal konfirmasi: ' + (err.response?.data?.error || err.message), 'error');
        } finally {
            setPaying(false);
        }
    };

    // Filtering & Pagination Logic
    const uniqueUnits = [...new Set(bookings.map(b => b.unit || 'Umum'))].sort();
    
    const filteredBookings = bookings.filter(b => {
        if (!filterUnit) return true;
        return (b.unit || 'Umum') === filterUnit;
    });

    const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(filteredBookings.length / itemsPerPage);
    const paginatedBookings = itemsPerPage === 'all'
        ? filteredBookings
        : filteredBookings.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    useEffect(() => {
        setCurrentPage(1); // Reset to first page when items per page or filter changes
    }, [itemsPerPage, filterUnit]);

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
        <div className="space-y-6 animate-in fade-in duration-500 p-2 md:p-0">
            {/* Header */}
            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-center md:text-left">
                    <h1 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center justify-center md:justify-start gap-2">
                        <Bus className="text-blue-600" /> Booking Jadwal Bus
                    </h1>
                    <p className="text-slate-500 text-xs md:text-sm">Pencatatan penggunaan bus operasional.</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto justify-center">
                    <div className="flex bg-slate-100 p-1 rounded-xl">
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
                        {isAdminAset && (
                            <button
                                onClick={() => setViewMode('revenue')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${viewMode === 'revenue' ? 'bg-emerald-500 text-white shadow-sm' : 'text-emerald-600 hover:bg-emerald-100'}`}
                            >
                                <BarChart3 size={14} /> Omset
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => setShowBorrowModal(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                    >
                        <Plus size={18} /> Tambah Jadwal
                    </button>
                </div>
            </div>

            <div className="w-full space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                        {viewMode === 'list' ? 'Jadwal Mendatang' : viewMode === 'calendar' ? 'Kalender Jadwal' : 'Rekapitulasi Keuangan Bus'}
                    </h2>
                    {viewMode === 'list' && (
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <select 
                                className="w-full sm:w-auto bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 shadow-sm"
                                value={filterUnit}
                                onChange={(e) => setFilterUnit(e.target.value)}
                            >
                                <option value="">Semua Unit</option>
                                {uniqueUnits.map(u => (
                                    <option key={u} value={u}>{u}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {viewMode === 'list' ? (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        {loading ? (
                            <div className="p-12 text-center text-slate-400 text-sm">Memuat data...</div>
                        ) : bookings.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3 text-sm">
                                <Calendar size={48} strokeWidth={1} />
                                <p>Belum ada jadwal booking bus.</p>
                            </div>
                        ) : (
                            <>
                                <div className="divide-y divide-slate-100">
                                    {paginatedBookings.map(b => (
                                        <div
                                            key={b.id}
                                            onClick={() => setSelectedBooking(b)}
                                            className="p-4 hover:bg-slate-50/50 transition-colors flex flex-col md:flex-row md:items-center justify-between group cursor-pointer gap-4"
                                        >
                                            <div className="flex gap-4 items-start" >
                                                {b.isPaid && (
                                                    <div 
                                                        className="mt-2"
                                                        onClick={(e) => {
                                                            e.stopPropagation(); // Mencegah click nyebar ke parent card
                                                            if (selectedInvoices.includes(b.id)) {
                                                                setSelectedInvoices(selectedInvoices.filter(id => id !== b.id));
                                                            } else {
                                                                setSelectedInvoices([...selectedInvoices, b.id]);
                                                            }
                                                        }}
                                                    >
                                                        <div className={`w-5 h-5 rounded border ${selectedInvoices.includes(b.id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white hover:border-blue-400'} flex items-center justify-center transition-colors cursor-pointer`}>
                                                            {selectedInvoices.includes(b.id) && <CheckCircle2 size={14} strokeWidth={3} />}
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="bg-blue-50 text-blue-600 p-3 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all flex-shrink-0" >
                                                    <Bus size={20} />
                                                </div>
                                                <div className="min-w-0 flex-1" >
                                                    <div className="flex flex-wrap items-center gap-2" >
                                                        <span className="font-bold text-slate-800 text-sm md:text-base truncate" >{b.vehicle?.name}</span>
                                                        <span className="text-[9px] md:text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono font-bold uppercase" >{b.vehicle?.plateNumber}</span>
                                                        <span className="text-[9px] md:text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold underline underline-offset-2 decoration-blue-100" >{b.unit || 'Umum'}</span>
                                                    </div>
                                                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] md:text-xs text-slate-500" >
                                                        <div className="flex items-center gap-1.5 shrink-0" >
                                                            <Calendar size={13} className="text-blue-500" />
                                                            {new Date(b.startDate).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 font-bold text-slate-700 shrink-0" >
                                                            <Clock size={13} className="text-blue-500" />
                                                            {new Date(b.startDate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} - {new Date(b.endDate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-blue-600 font-bold shrink-0" >
                                                            <MapPin size={13} /> {b.destination}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-0 pt-3 md:pt-0" >
                                                <div className="flex flex-col items-end gap-1">
                                                    <div className="text-[10px] text-slate-400 italic" >Pesanan: {b.requesterName || b.user?.name}</div>
                                                    <div className="flex items-center gap-2">
                                                        {b.isPaid ? (
                                                            <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-tighter">LUNAS</span>
                                                        ) : b.status === 'COMPLETED' ? (
                                                            <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-tighter">MENUNGGU BAYAR</span>
                                                        ) : (
                                                            <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase tracking-tighter">BOOKING</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <ArrowRight size={18} className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                {/* Pagination Controls */}
                                <div className="bg-slate-50/50 p-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                                    <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
                                        <span>Tampilkan:</span>
                                        <select 
                                            value={itemsPerPage} 
                                            onChange={(e) => setItemsPerPage(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                                            className="bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value={10}>10</option>
                                            <option value={25}>25</option>
                                            <option value={50}>50</option>
                                            <option value="all">Semua</option>
                                        </select>
                                        <span className="opacity-50">| Menampilkan {paginatedBookings.length} dari {bookings.length} data</span>
                                    </div>

                                    {itemsPerPage !== 'all' && totalPages > 1 && (
                                        <div className="flex items-center gap-2">
                                            <button 
                                                disabled={currentPage === 1}
                                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 transition-all text-slate-600"
                                            >
                                                <ChevronLeft size={16} />
                                            </button>
                                            
                                            <div className="flex items-center gap-1">
                                                {[...Array(totalPages)].map((_, i) => (
                                                    <button
                                                        key={i + 1}
                                                        onClick={() => setCurrentPage(i + 1)}
                                                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === i + 1 ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'text-slate-500 hover:bg-slate-100'}`}
                                                    >
                                                        {i + 1}
                                                    </button>
                                                )).slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))}
                                            </div>

                                            <button 
                                                disabled={currentPage === totalPages}
                                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 transition-all text-slate-600"
                                            >
                                                <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                ) : viewMode === 'revenue' && isAdminAset ? (
                    <BusRevenueDashboard 
                        bookings={bookings} 
                        monthFilter={revMonthFilter} 
                        setMonthFilter={setRevMonthFilter} 
                    />
                ) : (
                    <div className="space-y-4">
                        {/* Calendar Header */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                            <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-lg transition"><ChevronLeft size={20} /></button>
                            <div className="text-center">
                                <h3 className="font-bold text-slate-800 text-sm md:text-base">{MONTH_NAMES[currentMonth - 1]} {currentYear}</h3>
                            </div>
                            <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-lg transition"><ChevronRight size={20} /></button>
                        </div>

                        {/* Calendar Body */}
                        <div className="bg-white p-2 md:p-6 rounded-3xl border border-slate-100 shadow-sm overflow-x-auto">
                            <div className="min-w-[600px] md:min-w-0 md:w-full">
                                <div className="grid grid-cols-7 mb-2">
                                    {DAY_NAMES.map(d => (
                                        <div key={d} className={`text-center text-[10px] font-bold uppercase py-2 ${d === 'Min' ? 'text-red-400' : 'text-slate-400'}`}>{d}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-1 md:gap-2">
                                    {calendarDays.map((day, i) => {
                                        if (!day) return <div key={`empty-${i}`} className="min-h-[80px] md:min-h-[110px] bg-slate-50/30 rounded-xl" />;
                                        const dayBookings = getBookingsForDay(day);
                                        const isSunday = new Date(currentYear, currentMonth - 1, day).getDay() === 0;
                                        return (
                                            <div
                                                key={day}
                                                onClick={() => setSelectedDate(selectedDate === day ? null : day)}
                                                className={`min-h-[90px] md:min-h-[110px] p-1.5 md:p-2 rounded-2xl border cursor-pointer transition-all hover:shadow-md relative group ${isToday(day) ? 'border-blue-400 bg-blue-50/30 shadow-sm ring-1 ring-blue-100' :
                                                    selectedDate === day ? 'border-slate-400 bg-slate-50 ring-1 ring-slate-300' :
                                                        'border-slate-100 hover:border-slate-200 bg-white'
                                                    }`}
                                            >
                                                <div className={`text-[10px] md:text-xs font-bold mb-2 flex items-center justify-between ${isSunday ? 'text-red-500' : isToday(day) ? 'text-blue-700' : 'text-slate-600'}`}>
                                                    <span className={isToday(day) ? 'bg-blue-600 text-white w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[9px] md:text-[11px] shadow-sm shadow-blue-200' : ''}>{day}</span>
                                                </div>
                                                <div className="space-y-1">
                                                    {dayBookings.slice(0, 3).map((b, idx) => (
                                                        <div
                                                            key={b.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedBooking(b);
                                                            }}
                                                            className="text-[7px] md:text-[9px] px-1 md:px-1.5 py-0.5 md:py-1 rounded-md md:rounded-lg font-bold bg-blue-100 text-blue-700 border border-blue-200 leading-tight hover:bg-blue-600 hover:text-white transition-all overflow-hidden"
                                                        >
                                                            <div className="truncate">{b.vehicle?.name}</div>
                                                            <div className="text-[6px] md:text-[7.5px] opacity-70 truncate">@{b.unit || 'Umum'}</div>
                                                        </div>
                                                    ))}
                                                    {dayBookings.length > 3 && (
                                                        <div className="text-[8px] md:text-[9px] text-slate-400 font-bold text-center">+{dayBookings.length - 3}</div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Selected Date Detail */}
                        {selectedDate && (
                            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-lg animate-in slide-in-from-bottom-2">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="font-bold text-slate-800 text-sm md:text-base">
                                        Jadwal {selectedDate} {MONTH_NAMES[currentMonth - 1]} {currentYear}
                                    </h4>
                                    <button onClick={() => setSelectedDate(null)} className="p-1 hover:bg-slate-100 rounded-full text-slate-400"><X size={18} /></button>
                                </div>
                                <div className="space-y-3">
                                    {getBookingsForDay(selectedDate).length === 0 ? (
                                        <p className="text-xs text-slate-400 italic text-center py-4">Tidak ada jadwal.</p>
                                    ) : (
                                        getBookingsForDay(selectedDate).map(b => (
                                            <div
                                                key={b.id}
                                                onClick={() => setSelectedBooking(b)}
                                                className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group cursor-pointer hover:bg-blue-50/50 hover:border-blue-200 transition-all font-medium"
                                            >
                                                <div className="flex gap-3 items-center">
                                                    <div className="bg-blue-600 group-hover:scale-110 transition-transform text-white p-2 rounded-xl">
                                                        <Bus size={14} />
                                                    </div>
                                                    <div>
                                                        <div className="text-xs md:text-sm font-bold text-slate-800">{b.vehicle?.name}</div>
                                                        <div className="text-[9px] md:text-[10px] text-slate-500 flex items-center gap-3 mt-0.5">
                                                            <span className="text-blue-600 font-bold">@{b.unit || 'Umum'}</span>
                                                            <span className="flex items-center gap-1"><MapPin size={10} /> {b.destination}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <ArrowRight size={14} className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal Form */}
            {showBorrowModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col h-auto max-h-[90vh]">
                        <div className="bg-blue-600 p-5 text-white flex justify-between items-center flex-shrink-0">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Bus size={20} /> Catat Jadwal Bus
                            </h2>
                            <button onClick={() => setShowBorrowModal(false)} className="hover:bg-white/10 p-1 rounded-full"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-4 md:space-y-6 overflow-y-auto">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Pilih Armada (Bisa pilih multi)</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {vehicles.map(v => (
                                            <div
                                                key={v.id}
                                                onClick={() => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        vehicleIds: prev.vehicleIds.includes(v.id)
                                                            ? prev.vehicleIds.filter(id => id !== v.id)
                                                            : [...prev.vehicleIds, v.id]
                                                    }));
                                                }}
                                                className={`p-2.5 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 ${formData.vehicleIds.includes(v.id) ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}
                                            >
                                                <div className={`p-1.5 rounded-lg transition-colors ${formData.vehicleIds.includes(v.id) ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                                    <Bus size={14} />
                                                </div>
                                                <div className="flex-1 truncate">
                                                    <div className="text-[11px] font-bold text-slate-800 truncate">{v.name}</div>
                                                    <div className="text-[9px] text-slate-400 font-mono italic uppercase truncate">{v.plateNumber}</div>
                                                </div>
                                                <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${formData.vehicleIds.includes(v.id) ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                                                    {formData.vehicleIds.includes(v.id) && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <input type="text" required placeholder="Nama Pemesan" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none" value={formData.requesterName} onChange={e => setFormData({ ...formData, requesterName: e.target.value })} />
                                    <input type="text" required placeholder="No. HP Pemesan" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none" value={formData.requesterPhone} onChange={e => setFormData({ ...formData, requesterPhone: e.target.value })} />
                                    <input type="text" required placeholder="Unit / Departemen" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} />
                                    <input type="number" min="1" required placeholder="Penumpang" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none" value={formData.passengerCount} onChange={e => setFormData({ ...formData, passengerCount: parseInt(e.target.value) })} />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-[9px] font-bold text-slate-400 block mb-1">Tgl Mulai</label><input type="date" required className="w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} /></div>
                                    <div><label className="text-[9px] font-bold text-slate-400 block mb-1">Jam</label><input type="time" required className="w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs" value={formData.startTime} onChange={e => setFormData({ ...formData, startTime: e.target.value })} /></div>
                                    <div><label className="text-[9px] font-bold text-slate-400 block mb-1">Tgl Selesai</label><input type="date" required className="w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} /></div>
                                    <div><label className="text-[9px] font-bold text-slate-400 block mb-1">Jam</label><input type="time" required className="w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs" value={formData.endTime} onChange={e => setFormData({ ...formData, endTime: e.target.value })} /></div>
                                </div>

                                <input type="text" required placeholder="Tujuan (Gedung, Lokasi, dsb)" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none" value={formData.destination} onChange={e => setFormData({ ...formData, destination: e.target.value })} />
                                <textarea placeholder="Keperluan (Opsional)" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none resize-none" rows="2" value={formData.purpose} onChange={e => setFormData({ ...formData, purpose: e.target.value })} />
                            </div>

                            <button type="submit" disabled={submitting} className="w-full py-3.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center gap-2">
                                {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Simpan Jadwal'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {selectedBooking && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-3 animate-in fade-in duration-300" onClick={() => setSelectedBooking(null)}>
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-5 bg-blue-600 text-white flex justify-between items-center">
                            <div className="flex items-center gap-2"><Bus size={20} /><h3 className="font-bold">Detail Booking Bus</h3></div>
                            <button onClick={() => setSelectedBooking(null)}><X size={20} /></button>
                        </div>
                        <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[80vh]">
                            <div className="grid grid-cols-2 gap-4 text-xs md:text-sm">
                                <div><label className="text-[9px] font-bold text-slate-400 uppercase block mb-1 tracking-widest">Armada</label><div className="font-bold text-slate-800">{selectedBooking.vehicle?.name}</div></div>
                                <div><label className="text-[9px] font-bold text-slate-400 uppercase block mb-1 tracking-widest">Plat</label><div className="font-bold text-slate-700">{selectedBooking.vehicle?.plateNumber}</div></div>
                                <div><label className="text-[9px] font-bold text-slate-400 uppercase block mb-1 tracking-widest">Pemesan</label><div className="font-bold text-slate-700">{selectedBooking.requesterName || selectedBooking.user?.name || '-'}</div></div>
                                <div><label className="text-[9px] font-bold text-slate-400 uppercase block mb-1 tracking-widest">Unit</label><div className="font-bold text-blue-600">{selectedBooking.unit || 'Umum'}</div></div>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl space-y-3 border border-slate-100 text-xs md:text-sm">
                                <div className="flex items-start gap-3"><MapPin size={14} className="text-blue-500 mt-1" /><div><label className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider">Tujuan</label><div className="font-bold">{selectedBooking.destination}</div></div></div>
                                <div className="flex items-start gap-3"><Calendar size={14} className="text-blue-500 mt-1" /><div><label className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider">Jadwal</label><div className="font-bold">{new Date(selectedBooking.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</div><div className="text-[10px] text-slate-500">{new Date(selectedBooking.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} s/d {new Date(selectedBooking.endDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div></div></div>
                                <div className="flex items-start gap-3"><Users size={14} className="text-blue-500 mt-1" /><div><label className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider">Penumpang</label><div className="font-bold">{selectedBooking.passengerCount} Orang</div></div></div>
                                <div className="flex items-start gap-3 pt-1 border-t border-slate-200/50">
                                    <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                                        <Users size={14} />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider mb-1">Supir Terpilih</label>
                                        {isSarpras ? (
                                            <select 
                                                className="w-full bg-slate-100 border-none rounded-lg px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-blue-500"
                                                value={selectedBooking.driverId || ''}
                                                onChange={(e) => handleAssignDriver(selectedBooking.id, e.target.value)}
                                                disabled={assigning}
                                            >
                                                <option value="">-- Pilih Supir --</option>
                                                {drivers.map(d => (
                                                    <option key={d.id} value={d.id}>{d.name} ({d.position})</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <div className="font-bold text-slate-700 text-xs py-1">
                                                {selectedBooking.driver?.name || 'Belum ditugaskan'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Billing & Administration (Admin Only) */}
                            {isAdminAset && (
                                <div className="bg-slate-900 text-white p-5 rounded-3xl space-y-4 shadow-xl">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Clock size={16} className="text-blue-400" />
                                            <h4 className="text-xs font-black uppercase tracking-widest text-blue-200">Administrasi Perjalanan</h4>
                                        </div>
                                        {selectedBooking.isPaid && <span className="text-[10px] font-black text-emerald-400 border border-emerald-400/30 px-2 py-0.5 rounded-full">LUNAS</span>}
                                    </div>

                                    {selectedBooking.status !== 'COMPLETED' ? (
                                        <div className="space-y-3">
                                            <p className="text-[10px] text-slate-400 font-bold leading-relaxed">Masukkan total KM perjalanan (termasuk jemput/pool) untuk mengirim tagihan otomatis ke Pemesan.</p>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="number" 
                                                    placeholder="Total KM"
                                                    className="flex-1 bg-slate-800 border-none rounded-xl px-4 py-2.5 text-sm font-black focus:ring-2 focus:ring-blue-500 outline-none text-white"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            handleCompleteTrip(selectedBooking.id, e.target.value);
                                                        }
                                                    }}
                                                    id="km-input"
                                                />
                                                <button 
                                                    onClick={() => handleCompleteTrip(selectedBooking.id, document.getElementById('km-input').value)}
                                                    disabled={completing}
                                                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2"
                                                >
                                                    {completing ? '...' : 'TAGIH'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4 pb-4 border-b border-white/10">
                                                <div>
                                                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Total Jarak</label>
                                                    <div className="text-base font-black">{selectedBooking.totalKm} KM</div>
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Total Tagihan</label>
                                                    <div className="text-base font-black text-emerald-400">Rp {selectedBooking.totalBill?.toLocaleString('id-ID')}</div>
                                                </div>
                                            </div>
                                            {!selectedBooking.isPaid ? (
                                                <button 
                                                    onClick={() => handleMarkAsPaid(selectedBooking.id)}
                                                    disabled={paying}
                                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex justify-center items-center gap-2"
                                                >
                                                    {paying ? 'Memproses...' : 'TANDAI TELAH BAYAR (LUNAS)'}
                                                </button>
                                            ) : (
                                                <div className="flex flex-col gap-3">
                                                    <div className="flex items-center gap-2 text-emerald-400 py-1 font-bold text-xs">
                                                        <CheckCircle2 size={16} /> Pembayaran telah diterima pada {new Date(selectedBooking.paidAt).toLocaleDateString('id-ID')}
                                                    </div>
                                                    <a 
                                                        href={`/public/invoice-bus/${selectedBooking.id}`}
                                                        target="_blank" rel="noopener noreferrer"
                                                        className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-xs font-black transition-all flex justify-center items-center gap-2"
                                                    >
                                                        LIHAT / CETAK INVOICE LUNAS
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="space-y-3 pt-2">
                                {isAuthorizedForWA && selectedBooking.requesterPhone && (
                                    <a
                                        href={`https://wa.me/${selectedBooking.requesterPhone.replace(/\D/g, '').startsWith('0') ? '62' + selectedBooking.requesterPhone.replace(/\D/g, '').substring(1) : selectedBooking.requesterPhone.replace(/\D/g, '')}`}
                                        target="_blank" rel="noopener noreferrer"
                                        className="w-full py-3.5 bg-green-600 text-white rounded-xl text-xs sm:text-sm font-bold flex justify-center items-center gap-2"
                                    >
                                        <Phone size={14} /> WhatsApp Pemesan
                                    </a>
                                )}
                                {(selectedBooking.userId === user.id || ['SUPER_ADMIN', 'ADMIN_ASET'].includes(user.role)) && (
                                    <button
                                        onClick={() => { handleDelete(selectedBooking.id); setSelectedBooking(null); }}
                                        className="w-full py-3.5 bg-red-50 text-red-600 rounded-xl text-xs sm:text-sm font-bold flex justify-center items-center gap-2"
                                    >
                                        <Trash2 size={14} /> Hapus Jadwal
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Toasts */}
            <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
                {toasts.map(t => (
                    <div key={t.id} className={`px-4 py-3 rounded-xl shadow-2xl border text-white text-xs sm:text-sm font-bold animate-in slide-in-from-right duration-300 ${t.type === 'success' ? 'bg-green-600 border-green-500' : 'bg-red-600 border-red-500'}`}>
                        {t.type === 'success' ? '✅ ' : '❌ '}{t.message}
                    </div>
                ))}
            </div>
            {/* Floating Action Button for Batch Print */}
            {selectedInvoices.length > 0 && (
                <div className="fixed bottom-6 right-6 md:bottom-10 md:right-10 z-50 animate-in slide-in-from-bottom-5">
                    <div className="bg-slate-900 border border-slate-700 p-4 rounded-2xl shadow-2xl flex items-center gap-4">
                        <div>
                            <div className="text-white font-bold text-sm">{selectedInvoices.length} Invoice Terpilih</div>
                            <div className="text-slate-400 text-xs">Pilih kelipatan 4 untuk presisi cetak.</div>
                        </div>
                        <a 
                            href={`/public/invoice-bus/batch?ids=${selectedInvoices.join(',')}`}
                            target="_blank" rel="noopener noreferrer"
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all text-sm"
                            onClick={() => {
                                // Tunggu sebentar lalu reset agar centang hilang setelah popup tercetak
                                setTimeout(() => setSelectedInvoices([]), 1000);
                            }}
                        >
                            <Printer size={16} /> Buka Batch Print
                        </a>
                        <button 
                            onClick={() => setSelectedInvoices([])}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            title="Batal"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Sub-Component: Revenue Dashboard ---
const BusRevenueDashboard = ({ bookings, monthFilter, setMonthFilter }) => {
    // Hanya hitung yang sudah lunas
    const paidBookings = bookings.filter(b => b.isPaid);

    // Dapatkan semua opsi bulan yang tersedia dari data (Format: YYYY-MM)
    const availableMonths = [...new Set(paidBookings.map(b => {
        const d = new Date(b.paidAt || b.startDate);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }))].sort().reverse(); // Terbaru di atas

    // Filter by month
    const filtered = monthFilter === 'all' 
        ? paidBookings 
        : paidBookings.filter(b => {
            const d = new Date(b.paidAt || b.startDate);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === monthFilter;
        });

    // Aggregates
    const totalRev = filtered.reduce((sum, b) => sum + (b.totalBill || 0), 0);
    const totalKm = filtered.reduce((sum, b) => sum + (Number(b.totalKm) || 0), 0);
    const totalTrips = filtered.length;

    // Group By Unit
    const byUnit = filtered.reduce((acc, b) => {
        const u = b.unit || 'Umum';
        acc[u] = (acc[u] || 0) + (b.totalBill || 0);
        return acc;
    }, {});
    const topUnits = Object.entries(byUnit).sort((a,b) => b[1] - a[1]); // Descending

    // Group By Vehicle
    const byVehicle = filtered.reduce((acc, b) => {
        const v = b.vehicle?.name || 'Bus Unknown';
        acc[v] = (acc[v] || 0) + (b.totalBill || 0);
        return acc;
    }, {});
    const topVehicles = Object.entries(byVehicle).sort((a,b) => b[1] - a[1]);

    const formatBulan = (yyyymm) => {
        if(yyyymm === 'all') return 'Semua Waktu';
        const [y, m] = yyyymm.split('-');
        const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return `${monthNames[parseInt(m)-1]} ${y}`;
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header / Filter */}
            <div className="flex justify-between items-end mb-6 pb-4 border-b border-slate-100">
                <div>
                    <h3 className="text-lg font-black text-slate-800">Ringkasan Omset Bus</h3>
                    <p className="text-slate-500 text-xs">Total pendapatan bersih dari peminjaman LUNAS.</p>
                </div>
                <select
                    className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-xl px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value)}
                >
                    <option value="all">Total Semua Waktu (All-Time)</option>
                    {availableMonths.map(m => (
                        <option key={m} value={m}>{formatBulan(m)}</option>
                    ))}
                </select>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-20"><BarChart3 size={64} /></div>
                    <div className="text-emerald-100 text-xs font-bold uppercase tracking-widest mb-1 relative z-10">Total Omset</div>
                    <div className="text-3xl font-black relative z-10">Rp {totalRev.toLocaleString('id-ID')}</div>
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                    <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Total Jarak Terbayar</div>
                    <div className="text-2xl font-black text-slate-800">{totalKm.toLocaleString('id-ID')} <span className="text-lg text-slate-400 font-medium tracking-normal">KM</span></div>
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                    <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Jumlah Perjalanan Lunas</div>
                    <div className="text-2xl font-black text-slate-800">{totalTrips} <span className="text-lg text-slate-400 font-medium tracking-normal">Trip</span></div>
                </div>
            </div>

            {/* Two Column details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Ranking By Unit */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                    <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Users size={16} className="text-blue-500" /> Top Penyewa (Berdasarkan Unit)
                    </h4>
                    <div className="space-y-3">
                        {topUnits.length === 0 && <div className="text-xs text-slate-400 italic">Belum ada data pendapatan.</div>}
                        {topUnits.map(([unitName, sum], i) => (
                            <div key={unitName} className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-black">{i + 1}</div>
                                    <div className="font-bold text-sm text-slate-700">{unitName}</div>
                                </div>
                                <div className="font-black text-emerald-600">Rp {sum.toLocaleString('id-ID')}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Ranking By Vehicle */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                    <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Bus size={16} className="text-amber-500" /> Kontribusi Per Armada
                    </h4>
                    <div className="space-y-3">
                        {topVehicles.length === 0 && <div className="text-xs text-slate-400 italic">Belum ada data pendapatan.</div>}
                        {topVehicles.map(([vName, sum], i) => (
                            <div key={vName} className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[10px] font-black">{i + 1}</div>
                                    <div className="font-bold text-sm text-slate-700">{vName}</div>
                                </div>
                                <div className="font-black text-emerald-600">Rp {sum.toLocaleString('id-ID')}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BusBooking;
