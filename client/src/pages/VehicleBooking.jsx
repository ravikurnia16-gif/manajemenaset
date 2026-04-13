import { useState, useEffect, useMemo } from 'react';
import {
    Car, Calendar, MapPin, Info, CheckCircle, XCircle,
    Clock, Gauge, Fuel, User, Plus, Search, X, Lock,
    ArrowRight, ChevronRight, ChevronLeft, AlertCircle, Trash2,
    Users, LogIn, LogOut, Receipt, Navigation2, Loader2
} from 'lucide-react';
import api from '../lib/axios';

const VehicleBooking = () => {
    const [activeTab, setActiveTab] = useState('CURRENT_FLEET');
    const [vehicles, setVehicles] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [staff, setStaff] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [candidateSearch, setCandidateSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [toasts, setToasts] = useState([]);
    const [driverSearch, setDriverSearch] = useState('');
    const [showDriverDropdown, setShowDriverDropdown] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [vSearch, setVSearch] = useState('');
    const [vTypeFilter, setVTypeFilter] = useState('ALL');

    const showToast = (message, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    // Form State for Request
    const [formData, setFormData] = useState({
        vehicleId: '',
        startDate: new Date().toISOString().split('T')[0],
        startTime: new Date().toTimeString().split(' ')[0].slice(0, 5),
        endDate: new Date().toISOString().split('T')[0],
        endTime: '17:00',
        destination: '',
        purpose: '',
        passengerCount: 1,
        driverId: JSON.parse(localStorage.getItem('user') || '{}').id || '',
        isRented: false,
        rentalDays: 1,
        startKm: ''
    });

    // Modal States
    const [showKeyReminderModal, setShowKeyReminderModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(null);
    const [showBorrowModal, setShowBorrowModal] = useState(false);
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [showActionModal, setShowActionModal] = useState(null); // { type: 'REJECT'|'START'|'END', data: booking }
    const [actionData, setActionData] = useState({ reason: '', km: '', notes: '', fuelRefill: false, fuelPrice: '', fuelLiters: '', fuelCondition: null });

    // Filter State for History
    const [filterVehicle, setFilterVehicle] = useState('');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [filterType, setFilterType] = useState('ALL'); // ALL, INTERNAL, SEWA

    // Calendar States
    const dateNow = new Date();
    const [calMonth, setCalMonth] = useState(dateNow.getMonth() + 1);
    const [calYear, setCalYear] = useState(dateNow.getFullYear());
    const [selectedDate, setSelectedDate] = useState(null);
    const [showDayModal, setShowDayModal] = useState(false);

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isSuperAdmin = ['SUPER_ADMIN', 'BIDANG_IT'].includes(user.role);
    const isAdminAset = ['ADMIN_ASET'].includes(user.role);
    
    // Special Roles: Yayasan Leadership
    const yayasanPositions = ['Ketua Yayasan', 'Bendahara Yayasan', 'Sekretaris Yayasan'];
    const isYayasanLeader = yayasanPositions.includes(user.position);
    
    // Head of Sarpras
    const isKabidSarpras = user.position === 'Kepala Bidang Sarana dan Prasarana';

    const [isPIC, setIsPIC] = useState(false);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (showDriverDropdown && !e.target.closest('.relative')) {
                setShowDriverDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showDriverDropdown]);

    useEffect(() => {
        fetchVehicles();
        fetchStaff();
        fetchDrivers();
    }, []);

    useEffect(() => {
        // Determine if user is PIC of any vehicle
        if (vehicles.length > 0 && user.id) {
            const picStatus = vehicles.some(v => v.pics?.some(p => p.id === user.id));
            setIsPIC(picStatus);
        }
    }, [vehicles, user.id]);

    // Calendar Handlers
    const calendarDays = useMemo(() => {
        const firstDay = new Date(calYear, calMonth - 1, 1).getDay();
        const daysInMonth = new Date(calYear, calMonth, 0).getDate();
        const days = [];
        for (let i = 0; i < firstDay; i++) days.push(null);
        for (let d = 1; d <= daysInMonth; d++) days.push(d);
        return days;
    }, [calMonth, calYear]);

    const getEventsForDay = (day) => {
        if (!day) return [];
        const targetDate = new Date(calYear, calMonth - 1, day);
        targetDate.setHours(0, 0, 0, 0);
        const targetTime = targetDate.getTime();

        return bookings.filter(b => {
            if (!b.startDate || (b.status !== 'APPROVED' && b.status !== 'BERLANGSUNG')) return false;
            const startDate = new Date(b.startDate);
            startDate.setHours(0, 0, 0, 0);
            const startTime = startDate.getTime();

            const endDate = new Date(b.endDate);
            endDate.setHours(23, 59, 59, 999);
            const endTime = endDate.getTime();

            return targetTime >= startTime && targetTime <= endTime;
        });
    };

    const prevMonth = () => {
        if (calMonth === 1) { setCalMonth(12); setCalYear(y => y - 1); }
        else setCalMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (calMonth === 12) { setCalMonth(1); setCalYear(y => y + 1); }
        else setCalMonth(m => m + 1);
    };
    const goToday = () => { setCalMonth(dateNow.getMonth() + 1); setCalYear(dateNow.getFullYear()); };
    const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    // Vehicle Color mapping for calendar
    const [vehicleColors, setVehicleColors] = useState({});
    useEffect(() => {
        if (vehicles.length > 0 && Object.keys(vehicleColors).length === 0) {
            const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-sky-500', 'bg-rose-500', 'bg-amber-500', 'bg-purple-500', 'bg-teal-500', 'bg-pink-500', 'bg-cyan-500'];
            const mapping = {};
            vehicles.forEach((v, index) => {
                mapping[v.id] = colors[index % colors.length];
            });
            setVehicleColors(mapping);
        }
    }, [vehicles]);

    useEffect(() => {
        fetchBookings();
        if (activeTab === 'DRIVERS') {
            fetchDrivers();
            fetchStaff();
        }
    }, [activeTab, filterVehicle, filterStartDate, filterEndDate, filterType, calMonth, calYear]);

    const fetchVehicles = async () => {
        try {
            const res = await api.get('/vehicles');
            setVehicles(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchStaff = async () => {
        try {
            const res = await api.get('personnel/all-users');
            setStaff(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchDrivers = async () => {
        try {
            setLoading(true);
            const res = await api.get('personnel/drivers');
            setDrivers(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleToggleDriver = async (userId, isCurrentlyDriver) => {
        try {
            await api.post('personnel/drivers/toggle', { userId, isCurrentlyDriver: !isCurrentlyDriver });
            showToast(`Status driver berhasil diperbarui.`, 'success');
            fetchDrivers();
            fetchStaff();
        } catch (err) {
            const msg = err.response?.data?.error || err.response?.data?.message || err.message;
            showToast('Gagal mengubah status driver: ' + msg, 'error');
        }
    };

    const fetchBookings = async () => {
        try {
            setLoading(true);
            const params = { tab: activeTab };
            if (activeTab === 'HISTORY') {
                if (filterVehicle) params.vehicleId = filterVehicle;
                if (filterStartDate) params.startDate = filterStartDate;
                if (filterEndDate) params.endDate = filterEndDate;
            } else if (activeTab === 'CALENDAR') {
                // Pass month start and end dates
                const startStr = `${calYear}-${String(calMonth).padStart(2, '0')}-01`;
                const daysInMonth = new Date(calYear, calMonth, 0).getDate();
                const endStr = `${calYear}-${String(calMonth).padStart(2, '0')}-${daysInMonth}`;
                params.startDate = startStr;
                params.endDate = endStr;
            }

            if (filterType === 'INTERNAL') params.isRented = 'false';
            if (filterType === 'SEWA') params.isRented = 'true';

            const res = await api.get('/vehicles/booking/all', { params });
            setBookings(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleSubmitRequest = async (e) => {
        e.preventDefault();
        if (submitting) return; // Prevent double clicking
        
        try {
            setSubmitting(true);
            const startStr = `${formData.startDate}T${formData.startTime}`;
            const endStr = `${formData.endDate}T${formData.endTime}`;
            const startDateObj = new Date(startStr);
            const now = new Date();

            if (!formData.destination) {
                showToast('Silakan isi tujuan peminjaman.', 'error');
                setSubmitting(false);
                return;
            }

            if (startDateObj < now) {
                showToast('Waktu mulai peminjaman tidak boleh di masa lampau.', 'error');
                setSubmitting(false);
                return;
            }

            if (new Date(endStr) <= startDateObj) {
                showToast('Waktu selesai harus setelah waktu mulai.', 'error');
                setSubmitting(false);
                return;
            }

            await api.post('/vehicles/booking/request', {
                ...formData,
                startDate: startDateObj,
                endDate: formData.isRented 
                    ? new Date(startDateObj.getTime() + (parseInt(formData.rentalDays) * 24 * 60 * 60 * 1000))
                    : new Date(endStr),
                rentalPrice: formData.isRented ? selectedVehicle?.defaultRentalPrice : null,
                startKm: formData.startKm || null
            });
            showToast('Permohonan berhasil dikirim!', 'success');
            setShowBorrowModal(false);
            setActiveTab('MY_REQUESTS');
            setFormData({
                vehicleId: '', 
                startDate: new Date().toISOString().split('T')[0], 
                startTime: new Date().toTimeString().split(' ')[0].slice(0, 5), 
                endDate: new Date().toISOString().split('T')[0], 
                endTime: '17:00',
                destination: '', purpose: '', passengerCount: 1, driverId: user.id || '',
                isRented: false, rentalDays: 1, startKm: ''
            });
        } catch (err) {
            showToast('Gagal mengirim permohonan: ' + (err.response?.data?.error || err.message), 'error');
        } finally { setSubmitting(false); }
    };

    const handleAction = async (bookingId, status) => {
        if (submitting) return;
        try {
            setSubmitting(true);
            await api.post(`/vehicles/booking/${bookingId}/review`, {
                status,
                adminNote: actionData.reason
            });
            showToast(`Peminjaman telah ${status === 'APPROVED' ? 'disetujui' : 'ditolak'}.`, 'success');
            setShowActionModal(null);
            fetchBookings();
        } catch (err) { showToast('Gagal memproses: ' + (err.response?.data?.error || err.message), 'error'); }
        finally { setSubmitting(false); }
    };

    const handleStartTrip = async () => {
        if (submitting) return;
        try {
            const currentOdometer = showActionModal.data.vehicle.odometer || 0;
            const inputKm = parseInt(actionData.km);

            if (inputKm < currentOdometer) {
                showToast(`KM Awal (${inputKm}) tidak boleh lebih kecil dari odometer kendaraan saat ini (${currentOdometer}).`, 'error');
                return;
            }

            setSubmitting(true);
            await api.post(`/vehicles/booking/${showActionModal.data.id}/start`, {
                startKm: actionData.km
            });
            showToast('Perjalanan dimulai!', 'success');
            setShowActionModal(null);
            fetchBookings();
        } catch (err) { showToast('Gagal memulai perjalanan: ' + (err.response?.data?.error || err.message), 'error'); }
        finally { setSubmitting(false); }
    };

    const handleEndTrip = async () => {
        if (submitting) return;
        try {
            if (parseInt(actionData.km) < (showActionModal.data.startKm || 0)) {
                showToast(`KM Akhir tidak boleh lebih kecil dari KM Awal (${showActionModal.data.startKm || 0})`, 'error');
                return;
            }
            setSubmitting(true);
            await api.post(`/vehicles/booking/${showActionModal.data.id}/end`, {
                endKm: parseInt(actionData.km),
                tripNotes: actionData.notes,
                fuelRefill: actionData.fuelRefill,
                fuelPrice: actionData.fuelPrice,
                fuelLiters: actionData.fuelLiters,
                fuelCondition: actionData.fuelCondition
            });
            showToast('Perjalanan selesai!', 'success');
            setShowActionModal(null);
            setActionData({ reason: '', km: '', notes: '', fuelRefill: false, fuelPrice: '', fuelLiters: '', fuelCondition: null });
            fetchBookings();
            fetchVehicles(); // Refresh vehicles to update last fuel condition
            
            // Pop up pemberitahuan pengembalian kunci
            setTimeout(() => {
                setShowKeyReminderModal(true);
            }, 300);

        } catch (err) { showToast('Gagal menyelesaikan perjalanan: ' + (err.response?.data?.error || err.message), 'error'); }
        finally { setSubmitting(false); }
    };

    const handleCancel = async (id) => {
        if (!confirm('Batalkan permohonan ini?')) return;
        try {
            setSubmitting(true);
            await api.post(`/vehicles/booking/${id}/cancel`);
            showToast('Peminjaman telah dibatalkan.', 'success');
            fetchBookings();
        } catch (err) { showToast('Gagal membatalkan: ' + (err.response?.data?.error || err.message), 'error'); }
        finally { setSubmitting(false); }
    };

    // Sort & Pagination Logic
    const sortedBookings = [...bookings].sort((a, b) => {
        if (activeTab === 'MY_REQUESTS') {
            const getStatusWeight = (status) => {
                if (['BERLANGSUNG'].includes(status)) return 1;
                if (['APPROVED', 'PENDING'].includes(status)) return 2;
                return 3; // COMPLETED, CANCELLED, REJECTED
            };
            
            const weightA = getStatusWeight(a.status);
            const weightB = getStatusWeight(b.status);
            
            if (weightA !== weightB) return weightA - weightB;
            
            if (weightA <= 2) {
                // nearest upcoming start date first
                return new Date(a.startDate) - new Date(b.startDate);
            }
            // most recently finished first
            return new Date(b.startDate) - new Date(a.startDate);
        }
        
        // Default for History and Approval: most recent first
        return new Date(b.createdAt || b.startDate) - new Date(a.createdAt || a.startDate);
    });

    const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(sortedBookings.length / itemsPerPage);
    const paginatedBookings = itemsPerPage === 'all'
        ? sortedBookings
        : sortedBookings.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    useEffect(() => {
        setCurrentPage(1); // Reset to first page when filters or items per page changes
    }, [itemsPerPage, activeTab, filterVehicle, filterStartDate, filterEndDate, filterType]);

    // Render Logic for Status Badges
    const getStatusBadge = (status) => {
        const badges = {
            PENDING: 'bg-amber-100 text-amber-700',
            APPROVED: 'bg-blue-100 text-blue-700',
            BERLANGSUNG: 'bg-indigo-600 text-white shadow-sm',
            REJECTED: 'bg-red-100 text-red-700',
            COMPLETED: 'bg-green-100 text-green-700',
            CANCELLED: 'bg-slate-100 text-slate-500'
        };
        const labels = {
            PENDING: 'MENUNGGU',
            APPROVED: 'DISETUJUI',
            BERLANGSUNG: 'BERLANGSUNG',
            REJECTED: 'DITOLAK',
            COMPLETED: 'SELESAI',
            CANCELLED: 'DIBATALKAN'
        };
        return <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${badges[status]}`}>{labels[status]}</span>;
    };


    const canApprove = isSuperAdmin || isAdminAset || isPIC || isKabidSarpras;

    const tabs = [
        { id: 'CURRENT_FLEET', label: 'Daftar Kendaraan', icon: <Car size={16} /> },
        { id: 'CALENDAR', label: 'Kalender', icon: <Calendar size={16} /> },
        ...(canApprove ? [{ id: 'APPROVAL', label: 'Persetujuan', icon: <CheckCircle size={16} />, count: bookings.filter(b => b.status === 'PENDING').length }] : []),
        { id: 'MY_REQUESTS', label: 'Permohonan Saya', icon: <User size={16} /> },
        ...(canApprove ? [{ id: 'HISTORY', label: 'Riwayat Seluruhnya', icon: <Clock size={16} /> }] : []),
        ...((isSuperAdmin || isAdminAset) ? [{ id: 'DRIVERS', label: 'Driver', icon: <Navigation2 size={16} /> }] : [])
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Navigation2 className="text-blue-600" /> Peminjaman Kendaraan
                </h1>
                <p className="text-slate-500">Alur peminjaman armada operasional.</p>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                <div className="grid grid-cols-2 lg:flex bg-slate-50 p-1 rounded-xl w-full md:w-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id);
                                if (tab.id === 'CURRENT_FLEET') setFilterType('ALL');
                            }}
                            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {tab.icon} {tab.label}
                            {tab.count > 0 && <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded-full text-[9px]">{tab.count}</span>}
                        </button>
                    ))}
                </div>

                {/* Sub-Filter Toggle (Show for non-fleet tabs) */}
                {activeTab !== 'CURRENT_FLEET' && activeTab !== 'DRIVERS' && (
                    <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
                        {[
                            { id: 'ALL', label: 'SEMUA' },
                            { id: 'INTERNAL', label: 'INTERNAL' },
                            { id: 'SEWA', label: 'SEWA' }
                        ].map(type => (
                            <button
                                key={type.id}
                                onClick={() => setFilterType(type.id)}
                                className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-[10px] font-black tracking-tight transition-all ${filterType === type.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {type.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>


            {/* Tab Contents */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 min-h-[400px]">
                {activeTab === 'CURRENT_FLEET' && (
                    <div className="p-6">
                        {/* Search & Filter Bar */}
                        <div className="flex flex-col md:flex-row gap-4 mb-8 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Cari nama kendaraan atau plat nomor..."
                                    className="w-full bg-white border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-sm focus:ring-4 focus:ring-blue-100 outline-none transition-all shadow-sm"
                                    value={vSearch}
                                    onChange={e => setVSearch(e.target.value)}
                                />
                            </div>
                            <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-x-auto custom-scrollbar no-scrollbar-h">
                                {[
                                    { id: 'ALL', label: 'SEMUA', icon: <Car size={14} /> },
                                    { id: 'Mobil', label: 'MOBIL', icon: <Car size={14} /> },
                                    { id: 'Motor', label: 'MOTOR', icon: <Navigation2 size={14} /> },
                                    { id: 'Bus', label: 'BUS', icon: <Users size={14} /> },
                                ].map(type => (
                                    <button
                                        key={type.id}
                                        onClick={() => setVTypeFilter(type.id)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black transition-all whitespace-nowrap ${vTypeFilter === type.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        {type.icon} {type.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {(() => {
                                const filtered = vehicles.filter(v => {
                                    const matchSearch = (v.name || '').toLowerCase().includes(vSearch.toLowerCase()) || 
                                                       (v.plateNumber || '').toLowerCase().includes(vSearch.toLowerCase());
                                    const matchType = vTypeFilter === 'ALL' || v.type === vTypeFilter;
                                    const isActive = v.status === 'ACTIVE';
                                    return matchSearch && matchType && isActive;
                                }).sort((a, b) => {
                                    const typeA = (a.type || '').toLowerCase();
                                    const typeB = (b.type || '').toLowerCase();
                                    
                                    const getPriority = (type) => {
                                        if (type.includes('mobil')) return 1;
                                        if (type.includes('bus') || type.includes('microbus') || type.includes('minibus')) return 2;
                                        if (type.includes('motor') || type.includes('sepeda motor')) return 3;
                                        return 99; // Lainnya di paling akhir
                                    };

                                    return getPriority(typeA) - getPriority(typeB);
                                });

                                if (filtered.length === 0) {
                                    return (
                                        <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                                            <Search size={48} className="mb-4 opacity-20" />
                                            <p className="font-bold text-lg">Tidak ada kendaraan yang cocok</p>
                                            <p className="text-sm">Coba ubah kata kunci atau filter pencarian ustadz.</p>
                                            <button 
                                                onClick={() => { setVSearch(''); setVTypeFilter('ALL'); }}
                                                className="mt-4 text-blue-600 font-bold text-xs hover:underline"
                                            >
                                                Reset Semua Filter
                                            </button>
                                        </div>
                                    );
                                }

                                return filtered.map(v => (
                                    <div key={v.id} className="group bg-white border border-slate-100 rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                                        {/* Vehicle Image Container */}
                                        <div className="relative h-44 md:h-72 lg:h-80 overflow-hidden bg-slate-50 flex items-center justify-center p-3">
                                            {v.photo ? (
                                                <img
                                                    src={v.photo}
                                                    alt={v.name}
                                                    className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-500"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200 text-slate-300">
                                                    <Car size={48} strokeWidth={1} />
                                                    <span className="text-[10px] font-bold uppercase tracking-widest mt-2">No Photo Available</span>
                                                </div>
                                            )}
                                            {/* Status Tag Overlay */}
                                            <div className="absolute top-3 right-3">
                                                <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm backdrop-blur-md ${v.isBorrowed
                                                    ? 'bg-indigo-600/90 text-white'
                                                    : v.status === 'ACTIVE'
                                                        ? 'bg-green-500/90 text-white'
                                                        : 'bg-red-500/90 text-white'
                                                    }`}>
                                                    {v.isBorrowed ? 'SEDANG DIGUNAKAN' : (v.status === 'ACTIVE' ? 'TERSEDIA' : v.status)}
                                                </div>
                                            </div>
                                            {/* Type Tag Overlay */}
                                            <div className="absolute bottom-3 left-3">
                                                <div className="px-2 py-1 bg-black/40 backdrop-blur-md text-white/90 rounded text-[9px] font-bold uppercase tracking-wider">
                                                    {v.type}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-5">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h3 className="font-bold text-slate-800 text-lg group-hover:text-blue-600 transition-colors">{v.name}</h3>
                                                    <p className="text-xs font-mono text-slate-400 font-bold uppercase tracking-wider">{v.plateNumber}</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                                <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                                                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">
                                                        <Gauge size={10} className="text-blue-500" />
                                                        Odometer
                                                    </div>
                                                    <div className="text-xs font-bold text-slate-700">{v.odometer?.toLocaleString()} km</div>
                                                </div>
                                                <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                                                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">
                                                        <Fuel size={10} className="text-orange-500" />
                                                        BBM
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-xs font-bold text-slate-700">{v.fuelType || '-'}</div>
                                                        {v.lastFuelCondition && (
                                                            <div className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                                v.lastFuelCondition === 'LOW' ? 'bg-red-100 text-red-600' :
                                                                v.lastFuelCondition === 'MEDIUM' ? 'bg-amber-100 text-amber-600' :
                                                                'bg-green-100 text-green-600'
                                                            }`}>
                                                                {v.lastFuelCondition === 'LOW' ? '< 1/4' : v.lastFuelCondition === 'MEDIUM' ? '1/4 - 1/2' : '> 1/2'}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 mb-4">
                                                <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">
                                                    <User size={10} className="text-purple-500" />
                                                    PIC Unit
                                                </div>
                                                <div className="text-xs font-bold text-slate-700 leading-relaxed">
                                                    {v.pics?.length > 0 ? v.pics.map(p => p.name).join(', ') : 'Belum ditunjuk'}
                                                </div>
                                            </div>

                                            {/* Usage Info */}
                                            <div className="mb-5 px-1">
                                                {v.isBorrowed ? (
                                                    <div className="flex items-center gap-2 text-[11px] font-bold text-indigo-600 bg-indigo-50 p-2 rounded-xl border border-indigo-100">
                                                        <Navigation2 size={13} className="animate-pulse" />
                                                        <span>Sedang digunakan: {v.currentUsedBy}</span>
                                                    </div>
                                                ) : (
                                                    v.lastUsedBy && (
                                                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold bg-slate-50/50 p-2 rounded-xl border border-dashed border-slate-200">
                                                            <Clock size={12} />
                                                            <span>Terakhir oleh: {v.lastUsedBy}</span>
                                                        </div>
                                                    )
                                                )}
                                            </div>

                                            {v.status === 'ACTIVE' || v.status === 'INACTIVE' ? (
                                                <button
                                                    disabled={submitting || v.isBorrowed || v.status !== 'ACTIVE'}
                                                    onClick={() => {
                                                        setSelectedVehicle(v);
                                                        const now = new Date();
                                                        setFormData({ 
                                                            ...formData, 
                                                            vehicleId: v.id,
                                                            startDate: now.toISOString().split('T')[0],
                                                            startTime: now.toTimeString().split(' ')[0].slice(0, 5)
                                                        });
                                                        setShowBorrowModal(true);
                                                    }}
                                                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all group/btn active:scale-[0.98] disabled:opacity-70 ${v.isBorrowed
                                                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
                                                        : v.status !== 'ACTIVE'
                                                            ? 'bg-red-50 text-red-400 cursor-not-allowed border border-red-100'
                                                            : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200'
                                                        }`}
                                                >
                                                    {v.isBorrowed ? (
                                                        <>
                                                            <Lock size={16} />
                                                            Sedang Digunakan
                                                        </>
                                                    ) : v.status !== 'ACTIVE' ? (
                                                        <>
                                                            <XCircle size={16} />
                                                            NON-AKTIF
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Plus size={16} className="group-hover/btn:rotate-90 transition-transform" />
                                                            Pinjam Sekarang
                                                        </>
                                                    )}
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>
                )}

                {activeTab === 'CALENDAR' && (
                    <div className="flex flex-col h-[800px] border border-slate-100 rounded-2xl overflow-hidden bg-white">
                        <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <button onClick={prevMonth} className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 transition-all"><ChevronLeft size={20} /></button>
                                <h2 className="text-xl font-black text-slate-800 w-48 text-center">{MONTH_NAMES[calMonth - 1]} {calYear}</h2>
                                <button onClick={nextMonth} className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 transition-all"><ChevronRight size={20} /></button>
                            </div>
                            <div className="flex gap-4 items-center">
                                <button onClick={goToday} className="px-4 py-2 bg-indigo-50 text-indigo-700 text-xs font-black rounded-xl hover:bg-indigo-100 transition-all uppercase tracking-widest">Hari Ini</button>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col p-4 bg-slate-50/30">
                            {/* Days Header */}
                            <div className="grid grid-cols-7 gap-2 mb-2">
                                {DAY_NAMES.map(d => <div key={d} className={`text-center py-2 text-[10px] font-black uppercase tracking-[0.2em] ${d === 'Min' ? 'text-red-400' : 'text-slate-400'}`}>{d}</div>)}
                            </div>

                            {/* Calendar Grid */}
                            <div className="flex-1 grid grid-cols-7 gap-2 auto-rows-fr">
                                {loading ? (
                                    <div className="col-span-7 flex flex-col items-center justify-center p-20 opacity-20">
                                        <Loader2 className="animate-spin" size={48} />
                                        <p className="mt-4 font-black text-xs tracking-widest">SINKRONISASI...</p>
                                    </div>
                                ) : (
                                    calendarDays.map((day, i) => {
                                        if (!day) return <div key={`empty-${i}`} className="bg-slate-50/20 rounded-2xl" />;
                                        const dayEvents = getEventsForDay(day);
                                        const isToday = day === dateNow.getDate() && calMonth === dateNow.getMonth() + 1 && calYear === dateNow.getFullYear();
                                        
                                        return (
                                            <div
                                                key={day}
                                                onClick={() => {
                                                    if (dayEvents.length > 0) {
                                                        setSelectedDate(day);
                                                        setShowDayModal(true);
                                                    }
                                                }}
                                                className={`min-h-[100px] p-2 rounded-2xl border transition-all relative flex flex-col gap-1 ${dayEvents.length > 0 ? 'cursor-pointer hover:border-slate-300 hover:bg-white hover:shadow-md border-slate-200 bg-white' : 'border-dashed border-slate-200 bg-slate-50/50'} ${isToday ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className={`text-sm font-black flex items-center justify-center w-7 h-7 rounded-lg ${isToday ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}`}>
                                                        {day}
                                                    </span>
                                                    {dayEvents.length > 0 && <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md">{dayEvents.length}</span>}
                                                </div>
                                                
                                                <div className="flex-1 overflow-y-auto custom-scrollbar no-scrollbar-h space-y-1">
                                                    {dayEvents.slice(0, 3).map((ev, idx) => (
                                                        <div key={idx} className={`w-full px-1.5 py-1 text-[9px] font-bold text-white rounded cursor-pointer truncate ${vehicleColors[ev.vehicleId] || 'bg-slate-500'} hover:opacity-90`} title={`${ev.vehicle?.name || 'Mobil'} - ${ev.user?.name || 'User'}`}>
                                                            {ev.vehicle?.name || 'Mobil'}
                                                        </div>
                                                    ))}
                                                    {dayEvents.length > 3 && <div className="text-[8px] font-black text-slate-400 text-center uppercase tracking-wider">+{dayEvents.length - 3} lainnya</div>}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Event Details Modal */}
                        {showDayModal && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                                <div className="bg-white rounded-3xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col shadow-2xl relative">
                                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50">
                                        <div>
                                            <h3 className="text-xl font-black tracking-tight text-indigo-900">Jadwal Tanggal {selectedDate} {MONTH_NAMES[calMonth - 1]} {calYear}</h3>
                                            <p className="text-xs text-indigo-600/80 font-bold mt-1">Total {getEventsForDay(selectedDate).length} Kendaraan Berangkat</p>
                                        </div>
                                        <button onClick={() => setShowDayModal(false)} className="w-10 h-10 bg-white hover:bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center transition-all shadow-sm">
                                            <X size={20} />
                                        </button>
                                    </div>
                                    <div className="p-6 overflow-y-auto custom-scrollbar space-y-4">
                                        {getEventsForDay(selectedDate).map(ev => (
                                            <div key={ev.id} className="p-4 border border-slate-100 rounded-2xl flex gap-4 hover:shadow-md transition-shadow relative overflow-hidden group">
                                                <div className={`absolute top-0 left-0 w-1.5 h-full ${vehicleColors[ev.vehicleId] || 'bg-slate-500'}`} />
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                                            <Car size={14} className="text-slate-400" /> {ev.vehicle?.name || 'Mobil'} <span className="text-[10px] text-slate-400 font-mono tracking-wider">{ev.vehicle?.plateNumber || ''}</span>
                                                        </h4>
                                                        <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${ev.status === 'BERLANGSUNG' ? 'bg-indigo-100 text-indigo-700' : 'bg-green-100 text-green-700'}`}>
                                                            {ev.status === 'BERLANGSUNG' ? 'Di Jalan' : 'Disetujui'}
                                                        </div>
                                                    </div>
                                                    <div className="mt-2 space-y-1.5">
                                                        <div className="flex items-center gap-2 text-xs text-slate-600">
                                                            <User size={12} className="text-blue-400" /> <span className="font-bold">{ev.user?.name || 'User'}</span> <span className="text-slate-400 text-[10px] uppercase">({ev.user?.unit?.name || 'Unit -'})</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-slate-600">
                                                            <MapPin size={12} className="text-red-400" /> {ev.destination}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-slate-600">
                                                            <Clock size={12} className="text-amber-400" /> {new Date(ev.startDate).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })}
                                                            {' - '}
                                                            {new Date(ev.endDate).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Modal Form Peminjaman */}
                {showBorrowModal && selectedVehicle && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                            {/* Modal Header */}
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-bold flex items-center gap-3">
                                        <Car size={24} /> Pinjam Kendaraan
                                    </h2>
                                    <p className="text-blue-100 text-sm mt-1">Armada: {selectedVehicle.name} ({selectedVehicle.plateNumber})</p>
                                </div>
                                <button
                                    onClick={() => setShowBorrowModal(false)}
                                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 max-h-[80vh] overflow-y-auto">
                                {isYayasanLeader && (
                                    <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex gap-3 items-start animate-in slide-in-from-top-2 duration-500">
                                        <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                                            <AlertCircle size={20} />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-amber-800">Prioritas Pimpinan Yayasan</h4>
                                            <p className="text-xs text-amber-600 leading-relaxed mt-0.5">
                                                Sebagai <strong>{user.position}</strong>, permohonan Anda akan mendapatkan <strong>Persetujuan Otomatis</strong> oleh sistem tanpa perlu menunggu verifikasi PIC.
                                            </p>
                                        </div>
                                    </div>
                                )}
                                <form onSubmit={handleSubmitRequest} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Jenis Peminjaman */}
                                        <div className="md:col-span-2 space-y-1.5">
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Jenis Peminjaman</label>
                                            <div className="flex p-1 bg-slate-100 rounded-2xl w-full md:w-80">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, isRented: false })}
                                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${!formData.isRented ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                                                >
                                                    <Users size={14} /> Operasional
                                                </button>
                                                {selectedVehicle.isRentable && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, isRented: true })}
                                                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${formData.isRented ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                                                    >
                                                        <Receipt size={14} /> Sewa
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Mulai */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">
                                                {formData.isRented ? 'Mulai Sewa' : 'Mulai Pinjam'}
                                            </label>
                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" size={16} />
                                                    <input
                                                        type="date" required
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                        value={formData.startDate}
                                                        onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                                    />
                                                </div>
                                                <div className="relative w-32">
                                                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" size={16} />
                                                    <input
                                                        type="time" required
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                        value={formData.startTime}
                                                        onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Selesai / Lama Sewa */}
                                        {formData.isRented ? (
                                            <>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Lama Sewa (Hari)</label>
                                                    <div className="relative">
                                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500" size={16} />
                                                        <input
                                                            type="number" min="1" required
                                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                                                            value={formData.rentalDays}
                                                            onChange={e => setFormData({ ...formData, rentalDays: parseInt(e.target.value) || 1 })}
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Biaya Sewa per Hari</label>
                                                    <div className="relative">
                                                        <Receipt className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500" size={16} />
                                                        <input
                                                            type="text" readOnly
                                                            className="w-full bg-slate-100 border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-sm font-bold text-indigo-600 cursor-not-allowed"
                                                            value={selectedVehicle?.defaultRentalPrice ? `Rp ${selectedVehicle.defaultRentalPrice.toLocaleString('id-ID')}` : 'Rp 0'}
                                                        />
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Selesai Pinjam</label>
                                                <div className="flex gap-2">
                                                    <div className="relative flex-1">
                                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" size={16} />
                                                        <input
                                                            type="date" required
                                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                            value={formData.endDate}
                                                            onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="relative w-32">
                                                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" size={16} />
                                                        <input
                                                            type="time" required
                                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                            value={formData.endTime}
                                                            onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Tujuan & Keperluan */}
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Tujuan (Lokasi)</label>
                                            <div className="relative">
                                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" size={16} />
                                                <input
                                                    type="text" required
                                                    placeholder="Contoh: Kantor Wilayah, Kota"
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                    value={formData.destination}
                                                    onChange={e => setFormData({ ...formData, destination: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Keperluan</label>
                                            <textarea
                                                required
                                                placeholder="Deskripsikan tujuan peminjaman..."
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                rows={2}
                                                value={formData.purpose}
                                                onChange={e => setFormData({ ...formData, purpose: e.target.value })}
                                            />
                                        </div>

                                        {/* Optional KM Awal for Motor */}
                                        {selectedVehicle?.type?.toLowerCase().includes('motor') && (
                                            <div className="md:col-span-2 p-4 bg-blue-50 border border-blue-100 rounded-2xl animate-in zoom-in-95 duration-300">
                                                <div className="flex justify-between items-center mb-2">
                                                    <label className="block text-xs font-black text-blue-700 uppercase tracking-wider">Kilometer Awal (Opsional)</label>
                                                    <span className="text-[10px] font-bold text-blue-500 bg-white px-2 py-0.5 rounded-full border border-blue-100">Odometer: {selectedVehicle.odometer || 0} km</span>
                                                </div>
                                                <div className="relative">
                                                    <Gauge className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-600" size={18} />
                                                    <input
                                                        type="number"
                                                        placeholder="Isi jika ingin langsung mulai perjalanan..."
                                                        className="w-full bg-white border border-blue-200 rounded-xl pl-12 pr-4 py-3 text-sm font-bold text-blue-900 focus:ring-4 focus:ring-blue-100 outline-none transition-all placeholder:text-blue-300 placeholder:font-normal"
                                                        value={formData.startKm}
                                                        onChange={e => setFormData({ ...formData, startKm: e.target.value })}
                                                    />
                                                </div>
                                                <p className="text-[10px] text-blue-500 mt-2 font-medium italic">* Kosongkan jika ustadz ingin mengisi KM nanti saat berangkat.</p>
                                            </div>
                                        )}

                                        {/* Penumpang & Driver */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Jumlah Penumpang</label>
                                            <div className="relative">
                                                <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" size={16} />
                                                <input
                                                    type="number" min="1" required
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                    value={formData.passengerCount}
                                                    onChange={e => setFormData({ ...formData, passengerCount: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Pilih Driver</label>
                                            <div className="relative">
                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" size={16} />
                                                <div
                                                    className={`w-full bg-slate-50 border ${showDriverDropdown ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'} rounded-xl pl-12 pr-10 py-3 text-sm cursor-pointer transition-all relative min-h-[46px] flex items-center`}
                                                    onClick={() => setShowDriverDropdown(!showDriverDropdown)}
                                                >
                                                    {formData.driverId ? (
                                                        <span className="font-bold text-slate-800">
                                                            {parseInt(formData.driverId) === user.id ? (
                                                                <span className="text-blue-600">SAYA SENDIRI (BAWA SENDIRI)</span>
                                                            ) : (
                                                                <>
                                                                    {drivers.find(s => s.id === parseInt(formData.driverId))?.name || 'User Terpilih'}
                                                                    <span className="ml-2 text-[10px] text-slate-400 font-normal">
                                                                        ({drivers.find(s => s.id === parseInt(formData.driverId))?.unit?.name || 'Tanpa Unit'})
                                                                    </span>
                                                                </>
                                                            )}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 font-medium italic">Pilih Driver...</span>
                                                    )}
                                                    <ChevronRight className={`absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-transform ${showDriverDropdown ? 'rotate-90' : ''}`} size={16} />
                                                </div>

                                                {showDriverDropdown && (
                                                    <div className="absolute z-[60] left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[350px] flex flex-col">
                                                        <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                                                            <div className="relative">
                                                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                                <input
                                                                    autoFocus
                                                                    type="text"
                                                                    placeholder="Cari nama atau unit..."
                                                                    className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                                                    value={driverSearch}
                                                                    onChange={e => setDriverSearch(e.target.value)}
                                                                    onClick={e => e.stopPropagation()}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="overflow-y-auto p-2 custom-scrollbar">
                                                            <button
                                                                type="button"
                                                                className={`w-full text-left p-3 rounded-xl text-xs font-bold transition-all mb-1 ${parseInt(formData.driverId) === user.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setFormData({ ...formData, driverId: user.id });
                                                                    setShowDriverDropdown(false);
                                                                    setDriverSearch('');
                                                                }}
                                                            >
                                                                BAWA SENDIRI
                                                            </button>

                                                            {Object.entries(
                                                                drivers
                                                                    .filter(s => {
                                                                        const searchStr = `${s.name || ''} ${s.unit?.name || ''}`.toLowerCase();
                                                                        return searchStr.includes(driverSearch.toLowerCase());
                                                                    })
                                                                    .reduce((acc, s) => {
                                                                        const unitName = s.unit?.name || 'UMUM / LAINNYA';
                                                                        if (!acc[unitName]) acc[unitName] = [];
                                                                        acc[unitName].push(s);
                                                                        return acc;
                                                                    }, {})
                                                            ).map(([unitName, members]) => (
                                                                <div key={unitName} className="mt-2 first:mt-0">
                                                                    <div className="px-3 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50 rounded-lg mb-1">
                                                                        {unitName}
                                                                    </div>
                                                                    {members.map(s => (
                                                                        <button
                                                                            key={s.id}
                                                                            type="button"
                                                                            className={`w-full text-left p-3 rounded-xl transition-all mb-1 group ${formData.driverId === s.id.toString() ? 'bg-blue-50 border border-blue-100' : 'hover:bg-slate-50 border border-transparent'}`}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setFormData({ ...formData, driverId: s.id.toString() });
                                                                                setShowDriverDropdown(false);
                                                                                setDriverSearch('');
                                                                            }}
                                                                        >
                                                                            <div className="text-xs font-bold text-slate-800 flex justify-between items-center">
                                                                                {s.name}
                                                                                {formData.driverId === s.id.toString() && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                                                                            </div>
                                                                            <div className="text-[10px] text-slate-400 font-medium">
                                                                                {s.position || 'Staff'}
                                                                            </div>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer Buttons */}
                                    <div className="flex gap-3 mt-8">
                                        <button
                                            type="button"
                                            onClick={() => setShowBorrowModal(false)}
                                            className="flex-1 py-3 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                                        >
                                            Batal
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className={`flex-[2] py-3 px-4 rounded-xl text-sm font-bold shadow-lg transition-all flex justify-center items-center gap-2 ${isYayasanLeader ? 'bg-amber-600 text-white shadow-amber-200 hover:bg-amber-700' : 'bg-blue-600 text-white shadow-blue-200 hover:bg-blue-700'} disabled:opacity-50`}
                                        >
                                            {submitting ? (
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <>
                                                    {isYayasanLeader ? 'Ajukan & Setujui Otomatis' : 'Kirim Permohonan'}
                                                    <ArrowRight size={18} />
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'APPROVAL' && (
                    <div className="p-4 md:p-6">
                        {loading ? (
                            <div className="p-10 text-center text-slate-400">Memuat data...</div>
                        ) : bookings.length === 0 ? (
                            <div className="p-10 text-center text-slate-400 font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">Tidak ada permohonan tertunda.</div>
                        ) : (
                            <>
                                {/* Mobile List */}
                                <div className="grid grid-cols-1 gap-4 md:hidden">
                                    {bookings.map(b => (
                                        <div key={b.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4 group">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <div className={`px-2 py-0.5 rounded text-[8px] font-black tracking-tighter uppercase border ${b.isRented ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                                                            {b.isRented ? 'SEWA' : 'INTERNAL'}
                                                        </div>
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase">{b.vehicle.name}</span>
                                                    </div>
                                                    <div className="font-bold text-slate-800 text-sm">{b.destination}</div>
                                                </div>
                                                {getStatusBadge(b.status)}
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                                    <Car size={14} className="text-blue-500" /> {b.vehicle.name}
                                                </div>
                                                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                                    <Calendar size={14} className="text-slate-400" /> {new Date(b.startDate).toLocaleString('id-ID')}
                                                </div>
                                                <div className="flex items-center gap-2 text-[11px] text-blue-600 font-bold">
                                                    <MapPin size={14} /> {b.destination}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                {b.status === 'PENDING' ? (
                                                    <>
                                                        <button
                                                            disabled={submitting}
                                                            onClick={() => handleAction(b.id, 'APPROVED')}
                                                            className="flex-1 py-2.5 bg-green-50 text-green-600 rounded-xl text-xs font-bold hover:bg-green-600 hover:text-white transition-all disabled:opacity-50"
                                                        >
                                                            Setujui
                                                        </button>
                                                        <button
                                                            disabled={submitting}
                                                            onClick={() => setShowActionModal({ type: 'REJECT', data: b })}
                                                            className="flex-1 py-2.5 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-600 hover:text-white transition-all disabled:opacity-50"
                                                        >
                                                            Tolak
                                                        </button>
                                                    </>
                                                ) : null}
                                                <button
                                                    onClick={() => setShowDetailModal(b)}
                                                    className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all border border-slate-100"
                                                >
                                                    <Info size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Desktop Table */}
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-600 text-xs font-bold uppercase tracking-wider">
                                            <tr>
                                                <th className="px-6 py-4">Pemohon</th>
                                                <th className="px-6 py-4">Armada</th>
                                                <th className="px-6 py-4">Jadwal & Tujuan</th>
                                                <th className="px-6 py-4 text-center">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {bookings.map(b => (
                                                <tr key={b.id} className="hover:bg-slate-50/50">
                                                    <td className="px-6 py-4">
                                                        <div className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black tracking-tighter uppercase border mb-1.5 ${b.isRented ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                                                            {b.isRented ? 'SEWA' : 'INTERNAL'}
                                                        </div>
                                                        <div className="font-bold text-slate-700">{b.user.name}</div>
                                                        <div className="text-[10px] text-slate-400 font-bold uppercase">{b.user.unit?.name || 'Unit -'}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-slate-700">{b.vehicle.name}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono">{b.vehicle.plateNumber}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold">
                                                            <Calendar size={12} className="text-blue-500" />
                                                            {new Date(b.startDate).toLocaleString('id-ID')}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-xs text-blue-600 font-bold mt-1">
                                                            <MapPin size={12} /> {b.destination}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex justify-center gap-2">
                                                            {b.status === 'PENDING' ? (
                                                                <>
                                                                    <button
                                                                        disabled={submitting}
                                                                        onClick={() => handleAction(b.id, 'APPROVED')}
                                                                        className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-bold hover:bg-green-600 hover:text-white transition-all disabled:opacity-50"
                                                                    >
                                                                        Setujui
                                                                    </button>
                                                                    <button
                                                                        disabled={submitting}
                                                                        onClick={() => setShowActionModal({ type: 'REJECT', data: b })}
                                                                        className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-600 hover:text-white transition-all disabled:opacity-50"
                                                                    >
                                                                        Tolak
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                getStatusBadge(b.status)
                                                            )}
                                                            <button
                                                                onClick={() => setShowDetailModal(b)}
                                                                className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                                                            >
                                                                <Info size={18} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                )}


                {activeTab === 'MY_REQUESTS' && (
                    <div className="p-4 md:p-6">
                        {loading ? (
                            <div className="p-10 text-center text-slate-400">Memuat data...</div>
                        ) : bookings.length === 0 ? (
                            <div className="p-10 text-center text-slate-400 font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">Belum ada permohonan.</div>
                        ) : (
                            <>
                                {/* Mobile List */}
                                <div className="grid grid-cols-1 gap-4 md:hidden">
                                    {paginatedBookings.map(b => (
                                        <div key={b.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-bold text-slate-800">{b.vehicle.name}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono">{b.vehicle.plateNumber}</div>
                                                </div>
                                                {getStatusBadge(b.status)}
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                                    <Clock size={14} className="text-blue-500" /> {new Date(b.startDate).toLocaleString('id-ID')}
                                                </div>
                                                <div className="flex items-center gap-2 text-[11px] text-blue-600 font-bold">
                                                    <MapPin size={14} /> {b.destination}
                                                </div>
                                                <div className="pt-2 border-t border-slate-200 flex justify-between">
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase">KM Start: {b.startKm || '-'}</div>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase">KM End: {b.endKm || '-'}</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                {b.status === 'APPROVED' && !b.startKm && (
                                                    <button
                                                        disabled={submitting}
                                                        onClick={() => {
                                                            setActionData({ ...actionData, km: b.vehicle.odometer || '' });
                                                            setShowActionModal({ type: 'START', data: b });
                                                        }}
                                                        className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                                    >
                                                        <LogIn size={16} /> Start Trip
                                                    </button>
                                                )}
                                                {b.status === 'BERLANGSUNG' && (
                                                    <button
                                                        disabled={submitting}
                                                        onClick={() => {
                                                            setActionData({ ...actionData, km: '' });
                                                            setShowActionModal({ type: 'END', data: b });
                                                        }}
                                                        className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-xs font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                                    >
                                                        <LogOut size={16} /> End Trip
                                                    </button>
                                                )}
                                                {b.status === 'PENDING' && (
                                                    <button
                                                        disabled={submitting}
                                                        onClick={() => handleCancel(b.id)}
                                                        className="flex-1 py-2.5 bg-white border border-red-100 text-red-500 rounded-xl text-xs font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                                    >
                                                        <Trash2 size={16} /> Batalkan
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setShowDetailModal(b)}
                                                    className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all border border-slate-100"
                                                >
                                                    <Info size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Desktop Table */}
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-600 text-xs font-bold uppercase tracking-wider">
                                            <tr>
                                                <th className="px-6 py-4">Armada</th>
                                                <th className="px-6 py-4">Jadwal & Tujuan</th>
                                                <th className="px-6 py-4">Status</th>
                                                <th className="px-6 py-4">Kilometer</th>
                                                <th className="px-6 py-4 text-center">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {paginatedBookings.map(b => (
                                                <tr key={b.id} className="hover:bg-slate-50/50">
                                                    <td className="px-6 py-4">
                                                        <div className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black tracking-tighter uppercase border mb-1.5 ${b.isRented ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                                                            {b.isRented ? 'SEWA' : 'INTERNAL'}
                                                        </div>
                                                        <div className="font-bold text-slate-700">{b.vehicle.name}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono">{b.vehicle.plateNumber}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold">
                                                            <Clock size={12} className="text-blue-500" />
                                                            {new Date(b.startDate).toLocaleString('id-ID')}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-xs text-blue-600 font-bold mt-1">
                                                            <MapPin size={12} /> {b.destination}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {getStatusBadge(b.status)}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-[10px] font-bold text-slate-500">
                                                            START: {b.startKm ? `${b.startKm} km` : '-'}
                                                        </div>
                                                        <div className="text-[10px] font-bold text-slate-500 mt-1">
                                                            END: {b.endKm ? `${b.endKm} km` : '-'}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex justify-center gap-2">
                                                            {b.status === 'APPROVED' && !b.startKm && (
                                                                <button
                                                                    disabled={submitting}
                                                                    onClick={() => {
                                                                        setActionData({ ...actionData, km: b.vehicle.odometer || '' });
                                                                        setShowActionModal({ type: 'START', data: b });
                                                                    }}
                                                                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:shadow-lg transition-all flex items-center gap-1 disabled:opacity-50"
                                                                >
                                                                    <LogIn size={14} /> Start Trip
                                                                </button>
                                                            )}
                                                            {b.status === 'BERLANGSUNG' && (
                                                                <button
                                                                    disabled={submitting}
                                                                    onClick={() => {
                                                                        setActionData({ ...actionData, km: '' });
                                                                        setShowActionModal({ type: 'END', data: b });
                                                                    }}
                                                                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:shadow-lg transition-all flex items-center gap-1 disabled:opacity-50"
                                                                >
                                                                    <LogOut size={14} /> End Trip
                                                                </button>
                                                            )}
                                                            {b.status === 'PENDING' && (
                                                                <button
                                                                    disabled={submitting}
                                                                    onClick={() => handleCancel(b.id)}
                                                                    className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                                >
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => setShowDetailModal(b)}
                                                                className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                                                            >
                                                                <Info size={18} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination Controls (My Bookings) */}
                                <div className="bg-slate-50/50 p-4 border rounded-2xl mt-4 flex flex-col sm:flex-row justify-between items-center gap-4">
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
                                                <ChevronRight className="rotate-180" size={16} />
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
                )}


                {activeTab === 'HISTORY' && (
                    <div className="space-y-4 p-4 md:p-6">
                        {/* History Filters */}
                        <div className="flex flex-col md:flex-row gap-4 mb-4">
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Pilih Kendaraan</label>
                                <select
                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    value={filterVehicle}
                                    onChange={(e) => setFilterVehicle(e.target.value)}
                                >
                                    <option value="">Semua Kendaraan</option>
                                    {vehicles.map(v => (
                                        <option key={v.id} value={v.id}>{v.name} ({v.plateNumber})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mulai Tanggal</label>
                                <input
                                    type="date"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    value={filterStartDate}
                                    onChange={(e) => setFilterStartDate(e.target.value)}
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Sampai Tanggal</label>
                                <input
                                    type="date"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    value={filterEndDate}
                                    onChange={(e) => setFilterEndDate(e.target.value)}
                                />
                            </div>
                        </div>

                        {loading ? (
                            <div className="p-10 text-center text-slate-400">Memuat riwayat...</div>
                        ) : bookings.length === 0 ? (
                            <div className="p-10 text-center text-slate-400 font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">Tidak ada riwayat ditemukan.</div>
                        ) : (
                            <>
                                {/* Mobile History List */}
                                <div className="grid grid-cols-1 gap-4 md:hidden">
                                    {paginatedBookings.map(b => (
                                        <div key={b.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black tracking-tighter uppercase border mb-1 ${b.isRented ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                                                        {b.isRented ? 'SEWA' : 'INTERNAL'}
                                                    </div>
                                                    <div className="font-bold text-slate-800">{b.user.name}</div>
                                                    <div className="text-[10px] text-slate-400 font-bold uppercase">{b.user.unit?.name || 'Unit -'}</div>
                                                </div>
                                                {getStatusBadge(b.status)}
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                                    <Car size={14} className="text-blue-500" /> {b.vehicle.name}
                                                </div>
                                                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                                    <Clock size={14} className="text-slate-400" /> {new Date(b.startDate).toLocaleString('id-ID')}
                                                </div>
                                                <div className="flex items-center gap-2 text-[11px] text-blue-600 font-bold">
                                                    <MapPin size={14} /> {b.destination}
                                                </div>
                                                <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-2">
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase">Trip: {b.startKm || '?'} - {b.endKm || '?'} km</div>
                                                    {b.fuelRefill && (
                                                        <span className="bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded text-[9px] font-bold border border-orange-100">BBM: Rp {b.fuelPrice.toLocaleString()}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setShowDetailModal(b)}
                                                className="w-full py-2 bg-slate-50 text-slate-400 rounded-xl text-xs font-bold hover:bg-blue-50 hover:text-blue-600 transition-all border border-slate-100"
                                            >
                                                Tampilkan Detail
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Desktop History Table */}
                                <div className="hidden md:block overflow-x-auto border border-slate-100 rounded-xl">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-600 text-xs font-bold uppercase tracking-wider">
                                            <tr>
                                                <th className="px-6 py-4">Pemohon</th>
                                                <th className="px-6 py-4">Armada</th>
                                                <th className="px-6 py-4">Jadwal & Tujuan</th>
                                                <th className="px-6 py-4">Info Perjalanan</th>
                                                <th className="px-6 py-4">Status Akhir</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {paginatedBookings.map(b => (
                                                <tr key={b.id} className="hover:bg-slate-50/50">
                                                    <td className="px-6 py-4">
                                                        <div className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black tracking-tighter uppercase border mb-1.5 ${b.isRented ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                                                            {b.isRented ? 'SEWA' : 'INTERNAL'}
                                                        </div>
                                                        <div className="font-bold text-slate-700">{b.user.name}</div>
                                                        <div className="text-[10px] text-slate-400 font-bold uppercase">{b.user.unit?.name || 'Unit -'}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-slate-700">{b.vehicle.name}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono">{b.vehicle.plateNumber}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold">
                                                            <Clock size={12} className="text-blue-500" />
                                                            {new Date(b.startDate).toLocaleString('id-ID')}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-xs text-blue-600 font-bold mt-1">
                                                            <MapPin size={12} /> {b.destination}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-[10px] font-bold text-slate-500 mb-1">
                                                            Trip: {b.startKm || '?'} km - {b.endKm || '?'} km
                                                        </div>
                                                        {b.fuelRefill ? (
                                                            <div className="inline-flex items-center gap-1 bg-orange-50 text-orange-600 px-2 py-0.5 rounded text-[10px] font-bold border border-orange-100">
                                                                <Fuel size={10} /> Isi BBM {b.fuelPrice > 0 ? `(Rp ${b.fuelPrice.toLocaleString()})` : ''}
                                                            </div>
                                                        ) : (
                                                            <div className="inline-flex items-center gap-1 bg-slate-50 text-slate-500 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200">
                                                                <Fuel size={10} /> Tidak Isi BBM
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            {getStatusBadge(b.status)}
                                                            <button
                                                                onClick={() => setShowDetailModal(b)}
                                                                className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                                                            >
                                                                <Info size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                
                                {/* Pagination Controls (Global for this tab) */}
                                <div className="bg-slate-50/50 p-4 border rounded-2xl mt-4 flex flex-col sm:flex-row justify-between items-center gap-4">
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
                                                <ChevronRight className="rotate-180" size={16} />
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
                )}


                {activeTab === 'DRIVERS' && (
                    <div className="p-6 space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Daftar Sopir / Driver</h3>
                                <p className="text-sm text-slate-500">Personel yang ditunjuk sebagai pengemudi armada.</p>
                            </div>
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Cari nama..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    onChange={(e) => {
                                        const val = e.target.value.toLowerCase();
                                        setDrivers(prev => prev.map(d => ({ ...d, hidden: !(d.name || '').toLowerCase().includes(val) })));
                                    }}
                                />
                            </div>
                        </div>

                        <div className="space-y-8">
                            {drivers.length === 0 ? (
                                <div className="py-20 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                    <User className="mx-auto text-slate-200 mb-2" size={48} />
                                    <p className="text-slate-400 font-bold">Tidak ada driver yang ditemukan.</p>
                                </div>
                            ) : Object.entries(
                                drivers
                                    .reduce((acc, d) => {
                                        const unitName = d.unit?.name || 'UMUM / LAINNYA';
                                        if (!acc[unitName]) acc[unitName] = [];
                                        acc[unitName].push(d);
                                        return acc;
                                    }, {})
                            ).map(([unitName, unitDrivers]) => (
                                <div key={unitName} className="space-y-4">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
                                        <div className="h-px bg-slate-100 flex-1"></div>
                                        {unitName}
                                        <div className="h-px bg-slate-100 flex-1"></div>
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {unitDrivers.map(d => (
                                            <div key={d.id} className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-lg">
                                                        {(d.name || d.username || '?').charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-800">{d.name || d.username}</div>
                                                        <div className="text-[10px] text-slate-400 font-bold uppercase">{d.unit?.name || 'UMUM'}</div>
                                                        <div className="text-[10px] text-blue-500 font-bold mt-0.5">{d.position}</div>
                                                    </div>
                                                </div>
                                                {(isSuperAdmin || isAdminAset) && (
                                                    <button
                                                        onClick={() => handleToggleDriver(d.id, true)}
                                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                        title="Hapus Status Driver"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {(isSuperAdmin || isAdminAset) && (
                            <div className="pt-6 border-t border-slate-100">
                                <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
                                    <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                        <Plus size={16} className="text-blue-500" /> Tunjuk Driver Baru
                                    </h4>
                                    <div className="relative w-full md:w-64">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        <input
                                            type="text"
                                            placeholder="Cari staf..."
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={candidateSearch}
                                            onChange={(e) => setCandidateSearch(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-6">
                                    {Object.entries(
                                        staff
                                            .filter(s => {
                                                const isAlreadyDriver = (s.position || '').toLowerCase().includes('sopir') || (s.position || '').toLowerCase().includes('driver');
                                                const searchStr = `${s.name || ''} ${s.username || ''}`.toLowerCase();
                                                const matchesSearch = searchStr.includes(candidateSearch.toLowerCase());
                                                return !isAlreadyDriver && matchesSearch;
                                            })
                                            .reduce((acc, s) => {
                                                const unitName = s.unit?.name || 'UMUM / LAINNYA';
                                                if (!acc[unitName]) acc[unitName] = [];
                                                acc[unitName].push(s);
                                                return acc;
                                            }, {})
                                    ).map(([unitName, members]) => (
                                        <div key={unitName} className="space-y-3">
                                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <div className="h-px bg-slate-200 flex-1"></div>
                                                {unitName}
                                                <div className="h-px bg-slate-200 flex-1"></div>
                                            </h5>
                                            <div className="flex flex-wrap gap-2">
                                                {members.map(s => (
                                                    <button
                                                        key={s.id}
                                                        onClick={() => handleToggleDriver(s.id, false)}
                                                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm"
                                                    >
                                                        + {s.name || s.username}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}

                                    {staff.filter(s => {
                                        const isNotDriver = !(s.position || '').toLowerCase().includes('sopir') && !(s.position || '').toLowerCase().includes('driver');
                                        const matchesSearch = `${s.name || ''} ${s.username || ''}`.toLowerCase().includes(candidateSearch.toLowerCase());
                                        return isNotDriver && matchesSearch;
                                    }).length === 0 && (
                                            <p className="text-xs text-slate-400 italic text-center py-4">Tidak ada staf yang cocok.</p>
                                        )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Action Modals */}
            {
                showActionModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-start mb-6">
                                <h3 className="text-xl font-bold text-slate-800">
                                    {showActionModal.type === 'REJECT' && 'Tolak Permohonan'}
                                    {showActionModal.type === 'START' && 'Mulai Perjalanan'}
                                    {showActionModal.type === 'END' && 'Selesai Perjalanan'}
                                </h3>
                                <button onClick={() => setShowActionModal(null)} className="text-slate-400 hover:text-slate-600">
                                    <XCircle size={24} />
                                </button>
                            </div>

                            {showActionModal.type === 'REJECT' && (
                                <div className="space-y-4">
                                    <label className="block text-xs font-bold text-slate-500 uppercase">Alasan Penolakan</label>
                                    <textarea
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                        rows={3} autoFocus
                                        placeholder="Wajib diisi..."
                                        value={actionData.reason}
                                        onChange={e => setActionData({ ...actionData, reason: e.target.value })}
                                    />
                                    <button
                                        disabled={!actionData.reason || submitting}
                                        onClick={() => handleAction(showActionModal.data.id, 'REJECT')}
                                        className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50 transition-all shadow-lg shadow-red-200"
                                    >
                                        Konfirmasi Tolak
                                    </button>
                                </div>
                            )}

                            {showActionModal.type === 'START' && (
                                <div className="space-y-4">
                                    <div className="p-4 bg-blue-50 text-blue-700 rounded-xl flex gap-3 text-sm">
                                        <AlertCircle className="shrink-0" size={20} />
                                        <p>Pastikan kondisi kendaraan baik dan periksa bahan bakar sebelum berangkat.</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Kilometer Keberangkatan (Km Awal)</label>
                                        <div className="relative">
                                            <Gauge className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input
                                                type="number"
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-lg font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="Masukkan angka KM"
                                                value={actionData.km}
                                                onChange={e => setActionData({ ...actionData, km: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <button
                                        disabled={!actionData.km || submitting}
                                        onClick={handleStartTrip}
                                        className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-200"
                                    >
                                        Berangkat Sekarang
                                    </button>
                                </div>
                            )}

                            {showActionModal.type === 'END' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Kilometer Tiba (Km Akhir)</label>
                                        <div className="relative">
                                            <Gauge className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input
                                                type="number"
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-lg font-bold focus:ring-2 focus:ring-green-500 outline-none"
                                                placeholder="Masukkan angka KM"
                                                value={actionData.km}
                                                onChange={e => setActionData({ ...actionData, km: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2 font-bold text-sm text-slate-700">
                                                <Fuel size={16} className="text-orange-500" />
                                                Isi BBM di Perjalanan?
                                            </div>
                                            <div
                                                onClick={() => setActionData({ ...actionData, fuelRefill: !actionData.fuelRefill })}
                                                className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${actionData.fuelRefill ? 'bg-green-500' : 'bg-slate-300'}`}
                                            >
                                                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${actionData.fuelRefill ? 'translate-x-6' : 'translate-x-0'}`} />
                                            </div>
                                        </div>

                                        {actionData.fuelRefill && (
                                            <div className="animate-in slide-in-from-top-2 duration-200 mt-4 space-y-3">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Total Biaya (Rp)</label>
                                                        <div className="relative">
                                                            <Receipt className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                                            <input
                                                                type="number"
                                                                className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm font-bold"
                                                                placeholder="Rp 0"
                                                                value={actionData.fuelPrice}
                                                                onChange={e => setActionData({ ...actionData, fuelPrice: e.target.value })}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Jumlah Liter (L)</label>
                                                        <div className="relative">
                                                            <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                                            <input
                                                                type="number" step="0.01"
                                                                className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm font-bold"
                                                                placeholder="0.00"
                                                                value={actionData.fuelLiters}
                                                                onChange={e => setActionData({ ...actionData, fuelLiters: e.target.value })}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Kondisi BBM Saat Ini</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setActionData({ ...actionData, fuelCondition: 'LOW' })}
                                                className={`py-2 px-1 rounded-xl border text-[10px] sm:text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                                                    actionData.fuelCondition === 'LOW' ? 'bg-red-50 border-red-500 text-red-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                                }`}
                                            >
                                                <div className={`w-3 h-3 rounded-full ${actionData.fuelCondition === 'LOW' ? 'bg-red-500' : 'bg-slate-300'}`}></div>
                                                &lt; 1/4
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setActionData({ ...actionData, fuelCondition: 'MEDIUM' })}
                                                className={`py-2 px-1 rounded-xl border text-[10px] sm:text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                                                    actionData.fuelCondition === 'MEDIUM' ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                                }`}
                                            >
                                                <div className={`w-3 h-3 rounded-full ${actionData.fuelCondition === 'MEDIUM' ? 'bg-amber-500' : 'bg-slate-300'}`}></div>
                                                1/4 - 1/2
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setActionData({ ...actionData, fuelCondition: 'HIGH' })}
                                                className={`py-2 px-1 rounded-xl border text-[10px] sm:text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                                                    actionData.fuelCondition === 'HIGH' ? 'bg-green-50 border-green-500 text-green-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                                }`}
                                            >
                                                <div className={`w-3 h-3 rounded-full ${actionData.fuelCondition === 'HIGH' ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                                                &gt; 1/2
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Catatan Perjalanan (Opsional)</label>
                                        <textarea
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm"
                                            rows={2}
                                            placeholder="Kondisi jalan, cuaca, atau kendala..."
                                            value={actionData.notes}
                                            onChange={e => setActionData({ ...actionData, notes: e.target.value })}
                                        />
                                    </div>

                                    <button
                                        disabled={!actionData.km || submitting}
                                        onClick={handleEndTrip}
                                        className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 transition-all shadow-lg shadow-green-200"
                                    >
                                        Selesaikan Perjalanan
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {/* Detail Modal */}
            {showDetailModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800">Detail Peminjaman</h3>
                            <button onClick={() => setShowDetailModal(null)} className="text-slate-400 hover:text-slate-600">
                                <XCircle size={24} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-slate-50 rounded-xl">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase">Armada</div>
                                    <div className="font-bold text-slate-700">{showDetailModal.vehicle.name}</div>
                                    <div className="text-[10px] font-mono text-slate-400">{showDetailModal.vehicle.plateNumber}</div>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase">Status</div>
                                    <div className="mt-1">{getStatusBadge(showDetailModal.status)}</div>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase">Pemohon</div>
                                    <div className="font-bold text-slate-700">{showDetailModal.user.name}</div>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase">Driver</div>
                                    <div className="font-bold text-slate-700">{showDetailModal.driver?.name || 'Bawa Sendiri'}</div>
                                </div>
                            </div>

                            <div className="p-4 border border-slate-100 rounded-xl space-y-3">
                                <div className="flex items-start gap-3">
                                    <Calendar className="text-blue-500 shrink-0" size={18} />
                                    <div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Jadwal Penggunaan</div>
                                        <div className="text-sm font-semibold text-slate-600">
                                            {new Date(showDetailModal.startDate).toLocaleString('id-ID')}
                                            <ArrowRight size={14} className="inline mx-2" />
                                            {new Date(showDetailModal.endDate).toLocaleString('id-ID')}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <MapPin className="text-red-500 shrink-0" size={18} />
                                    <div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Tujuan & Keperluan</div>
                                        <div className="text-sm font-semibold text-slate-600">{showDetailModal.destination}</div>
                                        <div className="text-xs text-slate-500 mt-1 italic">"{showDetailModal.purpose}"</div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Users className="text-green-500 shrink-0" size={18} />
                                    <div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Penumpang</div>
                                        <div className="text-sm font-semibold text-slate-600">{showDetailModal.passengerCount} Orang</div>
                                    </div>
                                </div>
                            </div>

                            {showDetailModal.endKm && (
                                <div className="p-4 bg-green-50 rounded-xl border border-green-100 space-y-2">
                                    <div className="text-xs font-bold text-green-700 uppercase">Ringkasan Perjalanan</div>
                                    <div className="grid grid-cols-2 text-sm">
                                        <div className="text-slate-500">Jarak Tempuh:</div>
                                        <div className="text-right font-bold text-green-700">{(showDetailModal.endKm - showDetailModal.startKm).toLocaleString()} KM</div>
                                        <div className="text-slate-500">BBM Refill:</div>
                                        <div className="text-right font-bold text-green-700">{showDetailModal.fuelRefill ? `Rp ${showDetailModal.fuelPrice?.toLocaleString()}` : 'TIDAK'}</div>
                                    </div>
                                    {showDetailModal.tripNotes && (
                                        <div className="pt-2 mt-2 border-t border-green-100/50 text-xs italic text-green-600">
                                            Notes: {showDetailModal.tripNotes}
                                        </div>
                                    )}
                                </div>
                            )}

                            {showDetailModal.adminNote && (
                                <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                                    <div className="text-[10px] font-bold text-red-400 uppercase mb-1">Catatan Admin/PIC</div>
                                    <div className="text-sm text-red-600 font-medium italic">"{showDetailModal.adminNote}"</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Key Reminder Modal */}
            {showKeyReminderModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300 border border-slate-100">
                        <div className="p-8 text-center space-y-4">
                            <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-amber-100">
                                <Lock size={36} className="text-amber-500" strokeWidth={2.5} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Kunci Kendaraan</h3>
                            <p className="text-sm font-medium text-slate-500 leading-relaxed">
                                Mohon pastikan Anda telah <strong className="text-amber-600 font-bold">mengembalikan kunci kendaraan</strong> ke Pos Satpam.
                            </p>
                            
                            <div className="pt-6">
                                <button 
                                    onClick={() => setShowKeyReminderModal(false)}
                                    className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-3.5 font-black transition-all shadow-xl shadow-slate-900/20 active:scale-95"
                                >
                                    Siap, Sudah Dikembalikan!
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notifications */}
            <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-bold min-w-[280px] animate-in slide-in-from-right-full duration-300 pointer-events-auto ${toast.type === 'success'
                            ? 'bg-white border-green-100 text-green-700'
                            : 'bg-white border-red-100 text-red-700'
                            }`}
                    >
                        {toast.type === 'success' ? (
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                <CheckCircle size={18} />
                            </div>
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                                <AlertCircle size={18} />
                            </div>
                        )}
                        <span className="flex-1">{toast.message}</span>
                        <button
                            onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                            className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
                        >
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default VehicleBooking;
