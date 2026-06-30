import { useState, useEffect, useMemo, useRef } from 'react';
import {
    Car, Calendar, MapPin, Info, CheckCircle, XCircle,
    Clock, Gauge, Fuel, User, Plus, Search, X, Lock, Edit,
    ArrowRight, ChevronRight, ChevronLeft, AlertCircle, Trash2,
    Users, LogIn, LogOut, Receipt, Navigation2, Loader2, History, Camera
} from 'lucide-react';
import Swal from 'sweetalert2';
import socket from '../lib/socket';
import api from '../lib/axios';
import { getMediaUrl } from '../lib/media';

import VehicleChecklistTab from '../components/VehicleChecklistTab';

import LiveTrackingMap from '../components/LiveTrackingMap';

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

    const [currentUserProfile, setCurrentUserProfile] = useState(null);

    // Driver States
    const [driverSubTab, setDriverSubTab] = useState('DATABASE');
    const [selectedDriverForEdit, setSelectedDriverForEdit] = useState(null);

    const [selectedHistoryDriver, setSelectedHistoryDriver] = useState(null);
    const [driverHistory, setDriverHistory] = useState([]);
    const [historyMonth, setHistoryMonth] = useState(new Date().getMonth() + 1);
    const [historyYear, setHistoryYear] = useState(new Date().getFullYear());

    const [driverViolations, setDriverViolations] = useState([]);
    const [sanctionedUsers, setSanctionedUsers] = useState([]);
    const [showViolationAddModal, setShowViolationAddModal] = useState(false);
    const [showSanctionProposeModal, setShowSanctionProposeModal] = useState(false);
    const [sanctionProposeReason, setSanctionProposeReason] = useState('');
    const [showSanctionReviewModal, setShowSanctionReviewModal] = useState(null);
    const [sanctionReviewAction, setSanctionReviewAction] = useState({ approved: true, reviewNotes: '' });

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
    const [actionData, setActionData] = useState({
        reason: '', km: '', notes: '', fuelRefill: false,
        fuelPrice: '', fuelLiters: '', fuelCondition: null,
        returnLocation: '', customLocation: ''
    });

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

    const user = JSON.parse(localStorage.getItem('user') || '{}') || {};
    const isSuperAdmin = ['SUPER_ADMIN', 'BIDANG_IT'].includes(user.role);
    const isAdminAset = ['ADMIN_ASET'].includes(user.role);

    // Special Roles: Yayasan Leadership
    const yayasanPositions = ['Ketua Yayasan', 'Bendahara Yayasan', 'Sekretaris Yayasan'];

    // --- GPS Tracking Fallback ---
    const gpsWatchId = useRef(null);
    const lastSocketSentAt = useRef(0);
    const lastDbSavedAt = useRef(0);
    const lastDbSavedLocation = useRef(null);

    // Haversine formula to calculate distance in meters
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
        const R = 6371e3;
        const p1 = lat1 * Math.PI/180;
        const p2 = lat2 * Math.PI/180;
        const dp = (lat2-lat1) * Math.PI/180;
        const dl = (lon2-lon1) * Math.PI/180;
        const a = Math.sin(dp/2) * Math.sin(dp/2) +
                  Math.cos(p1) * Math.cos(p2) *
                  Math.sin(dl/2) * Math.sin(dl/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    };

    useEffect(() => {
        const activeTrip = bookings.find(b => 
            b.status === 'BERLANGSUNG' && 
            (b.driverId === user.id || b.userId === user.id)
        );

        const sendLocation = (position) => {
            if (activeTrip && position?.coords) {
                const now = Date.now();
                const { latitude, longitude, speed } = position.coords;
                const vehicleId = activeTrip.vehicleId;
                
                // 1. Live Socket Update (setiap 5 detik)
                if (now - lastSocketSentAt.current >= 5000) {
                    lastSocketSentAt.current = now;
                    socket.emit('driver_location', {
                        vehicleId,
                        bookingId: activeTrip.id,
                        latitude,
                        longitude,
                        speed: speed || 0
                    });
                }

                // 2. Database Save (setiap 60 detik DAN bergeser > 50 meter)
                if (now - lastDbSavedAt.current >= 60000) {
                    const lastLoc = lastDbSavedLocation.current;
                    const distance = lastLoc ? calculateDistance(lastLoc.lat, lastLoc.lng, latitude, longitude) : Infinity;

                    if (distance >= 50) { // Hanya simpan jika bergerak lebih dari 50 meter
                        lastDbSavedAt.current = now;
                        lastDbSavedLocation.current = { lat: latitude, lng: longitude };
                        
                        api.post(`/vehicles/booking/${activeTrip.id}/location`, {
                            latitude, longitude, speed: speed || 0
                        }).catch(err => console.error('GPS send error', err));
                    }
                }
            }
        };

        const setupGPS = async () => {
            if (!activeTrip) {
                // Stop watching if no active trip
                if (gpsWatchId.current !== null) {
                    try {
                        const { Geolocation } = await import('@capacitor/geolocation');
                        Geolocation.clearWatch({ id: gpsWatchId.current });
                    } catch {
                        if (navigator.geolocation) navigator.geolocation.clearWatch(gpsWatchId.current);
                    }
                    gpsWatchId.current = null;
                }
                return;
            }

            // Already watching
            if (gpsWatchId.current !== null) return;

            try {
                // Try Capacitor Geolocation (Native)
                const { Geolocation } = await import('@capacitor/geolocation');
                const permissions = await Geolocation.checkPermissions();
                if (permissions.location !== 'granted') {
                    const requested = await Geolocation.requestPermissions();
                    if (requested.location !== 'granted') {
                        console.error('Location permission denied');
                        return;
                    }
                }
                // Quick initial ping
                try {
                    const initPos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000 });
                    sendLocation(initPos);
                } catch (e) { /* ignore initial ping failure */ }
                // Continuous watch
                gpsWatchId.current = await Geolocation.watchPosition(
                    { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
                    (position, err) => { if (!err) sendLocation(position); }
                );
            } catch (err) {
                console.log("Capacitor Geolocation failed, falling back to Web Geolocation", err);
                
                const fallbackToIPLocation = async () => {
                    try {
                        const res = await fetch('https://ipapi.co/json/');
                        const data = await res.json();
                        if (data.latitude && data.longitude) {
                            sendLocation({ coords: { latitude: data.latitude, longitude: data.longitude, speed: 0 } });
                        } else {
                            throw new Error('No coordinates from IP API');
                        }
                    } catch (e) {
                        console.error('IP Fallback failed, using default depot location', e);
                        sendLocation({ coords: { latitude: -0.9471, longitude: 100.4172, speed: 0 } });
                    }
                };

                // Fallback: Browser navigator.geolocation (Web)
                if (navigator.geolocation) {
                    // Try to get a quick ping immediately (important for Desktop testing)
                    navigator.geolocation.getCurrentPosition(
                        (position) => sendLocation(position),
                        (error) => {
                            console.log('Initial Web GPS Ping Error:', error);
                            fallbackToIPLocation();
                        },
                        { enableHighAccuracy: false, timeout: 10000 }
                    );

                    gpsWatchId.current = navigator.geolocation.watchPosition(
                        (position) => sendLocation(position),
                        (error) => {
                            console.error('Web GPS Watch Error:', error);
                        },
                        { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
                    );
                } else {
                    fallbackToIPLocation();
                }
            }
        };

        setupGPS();

        return () => {
            if (gpsWatchId.current !== null) {
                // Best-effort cleanup
                try { navigator.geolocation?.clearWatch(gpsWatchId.current); } catch {}
                gpsWatchId.current = null;
            }
        };
    }, [bookings, user.id]);
    const isYayasanLeader = yayasanPositions.includes(user.position);

    // Head of Sarpras
    const isKabidSarpras = user.position === 'Kepala Bidang Sarana';
    const isStaffKendaraan = user.position === 'Staff Kendaraan' || Boolean(user.position?.toLowerCase()?.includes('staff kendaraan'));
    const canManageBooking = isAdminAset || isSuperAdmin || isKabidSarpras || isStaffKendaraan;

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
        if (formData.isRented && formData.startDate && formData.startTime && formData.rentalDays) {
            try {
                const start = new Date(`${formData.startDate}T${formData.startTime}`);
                if (!isNaN(start.getTime())) {
                    const end = new Date(start.getTime() + (parseInt(formData.rentalDays) * 24 * 60 * 60 * 1000));
                    
                    // Gunakan local time, jangan toISOString() karena menggunakan UTC (Jam Internasional)
                    const year = end.getFullYear();
                    const month = String(end.getMonth() + 1).padStart(2, '0');
                    const day = String(end.getDate()).padStart(2, '0');
                    const endDate = `${year}-${month}-${day}`;
                    
                    const hours = String(end.getHours()).padStart(2, '0');
                    const minutes = String(end.getMinutes()).padStart(2, '0');
                    const endTime = `${hours}:${minutes}`;

                    if (formData.endDate !== endDate || formData.endTime !== endTime) {
                        setFormData(prev => ({ ...prev, endDate, endTime }));
                    }
                }
            } catch (err) {
                console.error('Error calculating rental end date:', err);
            }
        }
    }, [formData.isRented, formData.startDate, formData.startTime, formData.rentalDays]);

    useEffect(() => {
        fetchVehicles();
        fetchStaff();
        fetchDrivers();
        fetchCurrentUser();
        fetchDriverViolations();

        // Listen for real-time booking updates
        const handleBookingUpdate = () => {
            fetchBookings();
            fetchVehicles();
        };

        socket.on('booking_update', handleBookingUpdate);
        return () => {
            socket.off('booking_update', handleBookingUpdate);
        };
    }, []);

    const fetchCurrentUser = async () => {
        try {
            const res = await api.get('/users/profile');
            setCurrentUserProfile(res.data);
        } catch (err) {
            console.error('Error fetching current user:', err);
        }
    };

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
            if (!b.startDate || (b.status !== 'APPROVED' && b.status !== 'BERLANGSUNG' && b.status !== 'COMPLETED')) return false;
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
            if (driverSubTab === 'PELANGGARAN') {
                fetchDriverViolations();
            }
        } else if (activeTab === 'USER_VIOLATIONS') {
            fetchDriverViolations();
            fetchDrivers();
            if (isSuperAdmin || isAdminAset) {
                fetchSanctionedUsers();
            }
        }
    }, [activeTab, driverSubTab, filterVehicle, filterStartDate, filterEndDate, filterType, calMonth, calYear]);

    useEffect(() => {
        const fetchDriverHistory = async () => {
            if (!selectedHistoryDriver) return;
            try {
                const res = await api.get(`personnel/drivers/${selectedHistoryDriver.id}/history?month=${historyMonth}&year=${historyYear}`);
                setDriverHistory(res.data);
            } catch (err) {
                console.error(err);
            }
        };
        fetchDriverHistory();
    }, [selectedHistoryDriver, historyMonth, historyYear]);

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

    const fetchDriverViolations = async () => {
        try {
            const res = await api.get('personnel/violations');
            setDriverViolations(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchSanctionedUsers = async () => {
        try {
            const res = await api.get('personnel/sanctions');
            setSanctionedUsers(res.data);
        } catch (err) { console.error('Error fetching sanctioned users:', err); }
    };
    const handleToggleDriver = async (userId, isCurrentlyDriver) => {
        try {
            await api.post('personnel/drivers/toggle', { userId, isDriver: !isCurrentlyDriver });
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
                endDate: new Date(endStr),
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
            const currentOdometer = showActionModal.data.vehicle?.odometer || 0;
            const inputKm = parseInt(actionData.km);

            if (inputKm < currentOdometer) {
                showToast(`KM Awal (${inputKm}) tidak boleh lebih kecil dari odometer kendaraan saat ini (${currentOdometer}).`, 'error');
                return;
            }
            if ((inputKm - currentOdometer) > 750) {
                if (!window.confirm(`Terdapat lonjakan odometer sebesar ${inputKm - currentOdometer} km dari pencatatan terakhir (${currentOdometer} km). Apakah Anda yakin angka KM awal (${inputKm}) sudah benar?`)) {
                    return;
                }
            }

            setSubmitting(true);
            
            // 1. Mulai perjalanan
            await api.post(`/vehicles/booking/${showActionModal.data.id}/start`, {
                startKm: actionData.km
            });
            
            showToast('Perjalanan dimulai!', 'success');

            // 2. Langsung baca GPS saat itu juga
            const bookingId = showActionModal.data.id;
            const sendInitialLocation = async (lat, lng) => {
                try {
                    await api.post(`/vehicles/booking/${bookingId}/location`, { latitude: lat, longitude: lng, speed: 0 });
                } catch (err) {
                    console.error('Failed to send initial location:', err);
                }
            };

            const fallbackToIP = async () => {
                try {
                    const res = await fetch('https://ipapi.co/json/');
                    const data = await res.json();
                    if (data.latitude && data.longitude) {
                        await sendInitialLocation(data.latitude, data.longitude);
                    } else {
                        throw new Error('No coordinates from IP API');
                    }
                } catch (e) {
                    console.error('IP Fallback failed, using default depot location', e);
                    // Default fallback to Padang / Depot to ensure it shows on map
                    await sendInitialLocation(-0.9471, 100.4172);
                }
            };

            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        sendInitialLocation(position.coords.latitude, position.coords.longitude);
                    },
                    (error) => {
                        console.log('Initial Ping Error:', error);
                        fallbackToIP();
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                );
            } else {
                fallbackToIP();
            }

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
            if ((parseInt(actionData.km) - (showActionModal.data.startKm || 0)) > 750) {
                if (!window.confirm(`Jarak tempuh tercatat sangat jauh (${parseInt(actionData.km) - (showActionModal.data.startKm || 0)} km). Apakah Anda yakin angka KM akhir (${actionData.km}) sudah benar?`)) {
                    return;
                }
            }
            setSubmitting(true);
            const finalLocation = actionData.returnLocation === 'Lainnya' ? actionData.customLocation : actionData.returnLocation;
            const bookingId = showActionModal.data.id;

            // --- Capture Final Location ---
            const sendEndLocation = async (lat, lng) => {
                try {
                    await api.post(`/vehicles/booking/${bookingId}/location`, { latitude: lat, longitude: lng, speed: 0 });
                } catch (err) { console.error('Failed to send end location:', err); }
            };
            
            const fallbackToIP = async () => {
                try {
                    const res = await fetch('https://ipapi.co/json/');
                    const data = await res.json();
                    if (data.latitude && data.longitude) {
                        await sendEndLocation(data.latitude, data.longitude);
                    }
                } catch (e) {}
            };

            if (navigator.geolocation) {
                // Fire and forget to not block the end trip process too long
                navigator.geolocation.getCurrentPosition(
                    (position) => { sendEndLocation(position.coords.latitude, position.coords.longitude); },
                    (error) => { fallbackToIP(); },
                    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
                );
            } else {
                fallbackToIP();
            }
            // -----------------------------

            await api.post(`/vehicles/booking/${bookingId}/end`, {
                endKm: parseInt(actionData.km),
                tripNotes: actionData.notes,
                fuelRefill: actionData.fuelRefill,
                fuelPrice: actionData.fuelPrice,
                fuelCondition: actionData.fuelCondition,
                returnLocation: finalLocation
            });
            showToast('Perjalanan selesai!', 'success');
            setShowActionModal(null);
            setActionData({ reason: '', km: '', notes: '', fuelRefill: false, fuelPrice: '', fuelCondition: null, returnLocation: '', customLocation: '' });
            fetchBookings();
            fetchVehicles(); // Refresh vehicles to update last fuel condition

            // Pop up pemberitahuan pengembalian kunci
            setTimeout(() => {
                setShowKeyReminderModal(true);
            }, 300);

        } catch (err) { showToast('Gagal menyelesaikan perjalanan: ' + (err.response?.data?.error || err.message), 'error'); }
        finally { setSubmitting(false); }
    };

    const handleExtendTrip = async () => {
        if (submitting) return;
        try {
            if (!actionData.newEndDate || !actionData.extendReason) {
                showToast('Waktu perpanjangan dan alasan kendala wajib diisi', 'error');
                return;
            }
            setSubmitting(true);
            await api.put(`/vehicles/booking/${showActionModal.data.id}/extend`, {
                newEndDate: new Date(actionData.newEndDate).toISOString(),
                extendReason: actionData.extendReason
            });
            showToast('Jadwal pengembalian berhasil diperpanjang!', 'success');
            setShowActionModal(null);
            setActionData({ reason: '', km: '', notes: '', fuelRefill: false, fuelPrice: '', fuelCondition: null, newEndDate: '', extendReason: '' });
            fetchBookings();
        } catch (err) {
            showToast('Gagal memperpanjang: ' + (err.response?.data?.error || err.message), 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditHistory = async () => {
        if (submitting) return;
        try {
            if (actionData.endKm && actionData.startKm && parseInt(actionData.endKm) < parseInt(actionData.startKm)) {
                showToast(`KM Akhir tidak boleh lebih kecil dari KM Awal`, 'error');
                return;
            }
            if (actionData.endKm && actionData.startKm && (parseInt(actionData.endKm) - parseInt(actionData.startKm)) > 750) {
                if (!window.confirm(`Jarak tempuh yang diedit sangat jauh (${parseInt(actionData.endKm) - parseInt(actionData.startKm)} km). Yakin data sudah benar?`)) {
                    return;
                }
            }
            setSubmitting(true);
            await api.put(`/vehicles/booking/${showActionModal.data.id}/history`, {
                startKm: actionData.startKm,
                endKm: actionData.endKm,
                fuelLiters: actionData.fuelLiters,
                fuelPrice: actionData.fuelPrice,
                tripNotes: actionData.tripNotes,
                returnLocation: actionData.returnLocation
            });
            showToast('Riwayat peminjaman berhasil diperbarui!', 'success');
            setShowActionModal(null);
            fetchBookings();
            fetchVehicles(); // refresh odometer
        } catch (err) { showToast('Gagal mengedit riwayat: ' + (err.response?.data?.error || err.message), 'error'); }
        finally { setSubmitting(false); }
    };

    const handleCancelClick = (booking) => {
        setActionData({ ...actionData, reason: '' });
        setShowActionModal({ type: 'CANCEL', data: booking });
    };

    const handleCancelSubmit = async () => {
        if (submitting) return;
        if (!actionData.reason || !actionData.reason.trim()) {
            showToast('Alasan pembatalan wajib diisi', 'error');
            return;
        }
        try {
            setSubmitting(true);
            await api.post(`/vehicles/booking/${showActionModal.data.id}/cancel`, {
                reason: actionData.reason
            });
            showToast('Peminjaman telah dibatalkan.', 'success');
            setShowActionModal(null);
            setActionData({ ...actionData, reason: '' });
            fetchBookings();
        } catch (err) { showToast('Gagal membatalkan: ' + (err.response?.data?.error || err.message), 'error'); }
        finally { setSubmitting(false); }
    };

    const handleProposeSanctionLift = async () => {
        if (!sanctionProposeReason.trim()) {
            showToast('Alasan pencabutan sanksi wajib diisi', 'error');
            return;
        }
        try {
            setSubmitting(true);
            await api.post('/personnel/sanctions/propose', { reason: sanctionProposeReason });
            showToast('Usulan pencabutan sanksi berhasil dikirim', 'success');
            setShowSanctionProposeModal(false);
            setSanctionProposeReason('');
            fetchCurrentUser();
        } catch (err) {
            showToast('Gagal mengirim usulan: ' + (err.response?.data?.error || err.message), 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleReviewSanctionLift = async () => {
        if (!sanctionReviewAction.reviewNotes.trim()) {
            showToast('Catatan reviu wajib diisi', 'error');
            return;
        }
        try {
            setSubmitting(true);
            await api.post('/personnel/sanctions/review', {
                userId: showSanctionReviewModal.id,
                isApproved: sanctionReviewAction.approved,
                reviewNotes: sanctionReviewAction.reviewNotes
            });
            showToast('Review sanksi berhasil disimpan', 'success');
            setShowSanctionReviewModal(null);
            setSanctionReviewAction({ approved: true, reviewNotes: '' });
            fetchSanctionedUsers();
            fetchCurrentUser();
        } catch (err) {
            showToast('Gagal menyimpan review: ' + (err.response?.data?.error || err.message), 'error');
        } finally {
            setSubmitting(false);
        }
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
        ...((isSuperAdmin || isAdminAset || isPIC) ? [{ id: 'CHECKLISTS', label: 'Ceklis Kendaraan', icon: <CheckCircle size={16} /> }] : []),
        { id: 'USER_VIOLATIONS', label: 'Pelanggaran User', icon: <AlertCircle size={16} /> },
        ...(canApprove ? [{ id: 'HISTORY', label: 'Riwayat Seluruhnya', icon: <Clock size={16} /> }] : []),
        ...((isSuperAdmin || isAdminAset) ? [{ id: 'DRIVERS', label: 'Driver', icon: <Navigation2 size={16} /> }] : []),
        ...(isKabidSarpras ? [{ id: 'TRACKING_MAP', label: 'Peta Pelacakan', icon: <MapPin size={16} /> }] : [])
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* GPS Companion App Banner (HIDDEN AS REQUESTED)
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 shadow-lg shadow-blue-600/20 text-white flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-white/20 p-3 rounded-xl">
                        <Navigation2 size={24} className="text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            💡 Lebih Praktis Kelola Perjalanan!
                        </h3>
                        <p className="text-blue-100 text-sm mt-1">
                            Gunakan Aplikasi Driver untuk fitur <b>Start Trip</b>, <b>End Trip</b>, dan permudah akses aplikasi di latar belakang.
                        </p>
                    </div>
                </div>
                <button onClick={() => alert("File APK Driver sedang disiapkan. Hubungi Admin IT untuk versi beta.")} className="px-6 py-2.5 bg-white text-blue-600 font-bold rounded-xl shadow-sm hover:bg-blue-50 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0">
                    <ArrowRight size={18} /> Download Aplikasi (.APK)
                </button>
            </div>
            */}

            {/* Header */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Navigation2 className="text-blue-600" /> Peminjaman Kendaraan
                </h1>
                <p className="text-slate-500">Alur peminjaman armada operasional.</p>
            </div>

            {/* Sanction Banner */}
            {currentUserProfile?.isSanctioned && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row items-center gap-4 justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                            <AlertCircle size={20} />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-red-800">Akun Anda Sedang Disanksi</h4>
                            <p className="text-xs text-red-600">
                                Anda telah melakukan pelanggaran (tidak memulai/mengakhiri perjalanan lebih dari 10 kali). 
                                Anda tidak dapat melakukan peminjaman kendaraan sampai sanksi dicabut.
                            </p>
                        </div>
                    </div>
                    <div>
                        {currentUserProfile?.sanctionProposedLift ? (
                            <div className="px-4 py-2 bg-red-100 text-red-700 rounded-xl text-xs font-bold text-center border border-red-200">
                                Usulan Pencabutan Sedang Direviu
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowSanctionProposeModal(true)}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-red-200 whitespace-nowrap"
                            >
                                Usulkan Pencabutan Sanksi
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* User Violations Banner */}
            {driverViolations.filter(v => v.driverId === user.id).length > 0 && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl shadow-sm flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                            <AlertCircle size={20} />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-amber-800">Catatan Pelanggaran Anda</h4>
                            <p className="text-xs text-amber-600">
                                Anda memiliki {driverViolations.filter(v => v.driverId === user.id).length} catatan pelanggaran yang perlu diperhatikan.
                            </p>
                        </div>
                    </div>
                    <div className="space-y-2 mt-2">
                        {driverViolations.filter(v => v.driverId === user.id).map(violation => (
                            <div key={violation.id} className="bg-white p-3 rounded-xl border border-amber-100 text-sm flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                <div>
                                    <span className="font-bold text-amber-900">{violation.category}</span>
                                    <span className="text-slate-500 text-xs ml-2">{new Date(violation.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                    <p className="text-slate-600 text-xs mt-1">{violation.description}</p>
                                </div>
                                <div className="px-3 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold text-center self-start sm:self-auto">
                                    Sanksi: {violation.sanction}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
                {activeTab !== 'CURRENT_FLEET' && activeTab !== 'DRIVERS' && activeTab !== 'USER_VIOLATIONS' && (
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
                {activeTab === 'TRACKING_MAP' && <LiveTrackingMap />}
                {activeTab === 'CHECKLISTS' && <VehicleChecklistTab vehicles={vehicles} currentUserProfile={currentUserProfile} isAdmin={isAdminAset || isSuperAdmin} />}
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
                                                    src={getMediaUrl(v.photo)}
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
                                                            <div className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${v.lastFuelCondition === 'LOW' ? 'bg-red-100 text-red-600' :
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
                                                <div className="text-xs font-bold text-slate-700 leading-relaxed flex flex-wrap gap-1.5">
                                                    {v.pics?.length > 0 ? (
                                                        v.pics.map(p => (
                                                            p.phone ? (
                                                                <a
                                                                    key={p.id}
                                                                    href={`https://wa.me/${p.phone.replace(/[^0-9]/g, '').replace(/^0/, '62')}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-full transition-colors cursor-pointer"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <svg className="w-3 h-3 pt-0.5" viewBox="0 0 24 24" fill="currentColor">
                                                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                                                                    </svg>
                                                                    <span>{p.name}</span>
                                                                </a>
                                                            ) : (
                                                                <span key={p.id} className="inline-block px-2.5 py-0.5 bg-slate-200 text-slate-600 rounded-full cursor-default" onClick={(e) => e.stopPropagation()}>{p.name}</span>
                                                            )
                                                        ))
                                                    ) : (
                                                        'Belum ditunjuk'
                                                    )}
                                                </div>
                                                {v.lastPosition && (
                                                    <div className="mt-2 pt-2 border-t border-slate-200/50">
                                                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">
                                                            <MapPin size={10} className="text-red-500" />
                                                            Posisi Terakhir
                                                        </div>
                                                        <div className="text-[10px] font-black text-blue-600 uppercase">{v.lastPosition}</div>
                                                    </div>
                                                )}
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
                                                    disabled={submitting || v.isBorrowed || v.status !== 'ACTIVE' || currentUserProfile?.isSanctioned}
                                                    onClick={() => {
                                                        if (currentUserProfile?.isSanctioned) {
                                                            showToast('Akun Anda sedang disanksi. Tidak dapat melakukan peminjaman.', 'error');
                                                            return;
                                                        }
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
                                                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all group/btn active:scale-[0.98] disabled:opacity-70 ${
                                                        currentUserProfile?.isSanctioned 
                                                        ? 'bg-red-50 text-red-500 cursor-not-allowed border border-red-100'
                                                        : v.isBorrowed
                                                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
                                                        : v.status !== 'ACTIVE'
                                                            ? 'bg-red-50 text-red-400 cursor-not-allowed border border-red-100'
                                                            : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200'
                                                        }`}
                                                >
                                                    {currentUserProfile?.isSanctioned ? (
                                                        <>
                                                            <AlertCircle size={16} />
                                                            Akun Disanksi
                                                        </>
                                                    ) : v.isBorrowed ? (
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
                                                        <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${ev.status === 'BERLANGSUNG' ? 'bg-indigo-100 text-indigo-700' :
                                                            ev.status === 'COMPLETED' ? 'bg-slate-100 text-slate-600' :
                                                                'bg-green-100 text-green-700'
                                                            }`}>
                                                            {ev.status === 'BERLANGSUNG' ? 'Di Jalan' :
                                                                ev.status === 'COMPLETED' ? 'Selesai' :
                                                                    'Disetujui'}
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
                                                            <Clock size={12} className="text-amber-400" /> {new Date(ev.startDate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                                            {' - '}
                                                            {new Date(ev.endDate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
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
                                                <div className="md:col-span-2 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl animate-in slide-in-from-top-2 duration-500">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <label className="block text-[10px] font-black text-indigo-700 uppercase tracking-wider">Estimasi Waktu Selesai</label>
                                                        <span className="text-[10px] font-bold text-indigo-500 bg-white px-2 py-0.5 rounded-full border border-indigo-100">Otomatis Terhitung</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-white rounded-lg border border-indigo-100 text-indigo-600 shadow-sm">
                                                            <Calendar size={18} />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-black text-indigo-900">
                                                                {new Date(`${formData.endDate}T${formData.endTime}`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                                            </div>
                                                            <div className="text-xs font-bold text-indigo-500 flex items-center gap-1 mt-0.5">
                                                                <Clock size={12} /> Pukul {formData.endTime} WIB
                                                            </div>
                                                        </div>
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
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase">{b.vehicle?.name}</span>
                                                    </div>
                                                    <div className="font-bold text-slate-800 text-sm">{b.destination}</div>
                                                </div>
                                                {getStatusBadge(b.status)}
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                                    <Car size={14} className="text-blue-500" /> {b.vehicle?.name}
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
                                                        <div className="font-bold text-slate-700">{b.user?.name || 'Sistem'}</div>
                                                        <div className="text-[10px] text-slate-400 font-bold uppercase">{b.user?.unit?.name || 'Unit -'}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-slate-700">{b.vehicle?.name}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono">{b.vehicle?.plateNumber}</div>
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
                                                    <div className="font-bold text-slate-800">{b.vehicle?.name}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono">{b.vehicle?.plateNumber}</div>
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
                                                <div className="pt-2 border-t border-slate-200 flex flex-col gap-1.5">
                                                    <div className="flex justify-between">
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase">KM Start: {b.startKm || '-'}</div>
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase">KM End: {b.endKm || '-'}</div>
                                                    </div>
                                                    {b.returnLocation && (
                                                        <div className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1">
                                                            <MapPin size={10} /> LOKASI AKHIR: {b.returnLocation}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                {b.status === 'APPROVED' && !b.startKm && (b.userId === user?.id || canManageBooking) && (
                                                    <button
                                                        disabled={submitting}
                                                        onClick={() => {
                                                            setActionData({ ...actionData, km: b.vehicle?.odometer || '' });
                                                            setShowActionModal({ type: 'START', data: b });
                                                        }}
                                                        className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                                    >
                                                        <LogIn size={16} /> Start Trip
                                                    </button>
                                                )}
                                                {b.status === 'BERLANGSUNG' && (b.userId === user?.id || canManageBooking) && (
                                                    <button
                                                        disabled={submitting}
                                                        onClick={() => {
                                                            setActionData({ ...actionData, newEndDate: '', extendReason: '' });
                                                            setShowActionModal({ type: 'EXTEND', data: b });
                                                        }}
                                                        className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-xs font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                                    >
                                                        <Clock size={16} /> Perpanjang
                                                    </button>
                                                )}
                                                {b.status === 'BERLANGSUNG' && (b.userId === user?.id || canManageBooking) && (
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
                                                {['PENDING', 'APPROVED'].includes(b.status) && !b.startKm && (b.userId === user?.id || canManageBooking) && (
                                                    <button
                                                        disabled={submitting}
                                                        onClick={() => handleCancelClick(b)}
                                                        className={`flex-1 py-2.5 ${b.status === 'APPROVED' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-white border border-red-100 text-red-500'} rounded-xl text-xs font-bold hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50`}
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
                                                        <div className="font-bold text-slate-700">{b.vehicle?.name}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono">{b.vehicle?.plateNumber}</div>
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
                                                        {b.returnLocation && (
                                                            <div className="text-[10px] font-black text-blue-600 mt-1 uppercase flex items-center gap-1">
                                                                <MapPin size={10} /> {b.returnLocation}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex justify-center gap-2">
                                                            {b.status === 'APPROVED' && !b.startKm && (b.userId === user?.id || canManageBooking) && (
                                                                <button
                                                                    disabled={submitting}
                                                                    onClick={() => {
                                                                        setActionData({ ...actionData, km: b.vehicle?.odometer || '' });
                                                                        setShowActionModal({ type: 'START', data: b });
                                                                    }}
                                                                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:shadow-lg transition-all flex items-center gap-1 disabled:opacity-50"
                                                                >
                                                                    <LogIn size={14} /> Start Trip
                                                                </button>
                                                            )}
                                                            {b.status === 'BERLANGSUNG' && (b.userId === user?.id || canManageBooking) && (
                                                                <button
                                                                    disabled={submitting}
                                                                    onClick={() => {
                                                                        setActionData({ ...actionData, newEndDate: '', extendReason: '' });
                                                                        setShowActionModal({ type: 'EXTEND', data: b });
                                                                    }}
                                                                    className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold hover:shadow-lg transition-all flex items-center gap-1 disabled:opacity-50"
                                                                >
                                                                    <Clock size={14} /> Perpanjang
                                                                </button>
                                                            )}
                                                            {b.status === 'BERLANGSUNG' && (b.userId === user?.id || canManageBooking) && (
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
                                                            {['PENDING', 'APPROVED'].includes(b.status) && !b.startKm && (b.userId === user?.id || canManageBooking) && (
                                                                <button
                                                                    disabled={submitting}
                                                                    onClick={() => handleCancelClick(b)}
                                                                    className={`p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1 ${b.status === 'APPROVED' ? 'border border-red-100 px-2' : ''}`}
                                                                    title="Batalkan Peminjaman"
                                                                >
                                                                    <Trash2 size={18} />
                                                                    {b.status === 'APPROVED' && <span className="text-[10px] font-bold">Batal</span>}
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
                                                    <div className="font-bold text-slate-800">{b.user?.name || 'Sistem'}</div>
                                                    <div className="text-[10px] text-slate-400 font-bold uppercase">{b.user?.unit?.name || 'Unit -'}</div>
                                                </div>
                                                {getStatusBadge(b.status)}
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                                    <Car size={14} className="text-blue-500" /> {b.vehicle?.name}
                                                </div>
                                                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                                    <Clock size={14} className="text-slate-400" /> {new Date(b.startDate).toLocaleString('id-ID')}
                                                </div>
                                                <div className="flex items-center gap-2 text-[11px] text-blue-600 font-bold">
                                                    <MapPin size={14} /> {b.destination}
                                                </div>
                                                <div className="pt-2 border-t border-slate-200 flex flex-col gap-1.5">
                                                    <div className="flex flex-wrap gap-2">
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Trip: {b.startKm || '?'} - {b.endKm || '?'} km</div>
                                                        {b.fuelRefill && (
                                                            <span className="bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded text-[9px] font-bold border border-orange-100">BBM: Rp {b.fuelPrice.toLocaleString()}</span>
                                                        )}
                                                    </div>
                                                    {b.returnLocation && (
                                                        <div className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1">
                                                            <MapPin size={10} /> POSISI: {b.returnLocation}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setShowDetailModal(b)}
                                                    className="flex-1 py-2 bg-slate-50 text-slate-400 rounded-xl text-xs font-bold hover:bg-blue-50 hover:text-blue-600 transition-all border border-slate-100"
                                                >
                                                    Detail
                                                </button>
                                                {b.status === 'COMPLETED' && canManageBooking && (
                                                    <button
                                                        onClick={() => {
                                                            setActionData({ ...actionData, startKm: b.startKm || '', endKm: b.endKm || '', fuelLiters: b.fuelLiters || '', fuelPrice: b.fuelPrice || '', tripNotes: b.tripNotes || '', returnLocation: b.returnLocation || '' });
                                                            setShowActionModal({ type: 'EDIT_HISTORY', data: b });
                                                        }}
                                                        className="flex-1 py-2 bg-amber-50 text-amber-500 rounded-xl text-xs font-bold hover:bg-amber-100 transition-all border border-amber-100"
                                                    >
                                                        Edit
                                                    </button>
                                                )}
                                            </div>
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
                                                        <div className="font-bold text-slate-700">{b.user?.name || 'Sistem'}</div>
                                                        <div className="text-[10px] text-slate-400 font-bold uppercase">{b.user?.unit?.name || 'Unit -'}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-slate-700">{b.vehicle?.name}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono">{b.vehicle?.plateNumber}</div>
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
                                                        {b.returnLocation && (
                                                            <div className="text-[10px] font-black text-blue-600 mb-1 uppercase flex items-center gap-1">
                                                                <MapPin size={10} /> POS: {b.returnLocation}
                                                            </div>
                                                        )}
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
                                                                title="Detail"
                                                            >
                                                                <Info size={16} />
                                                            </button>
                                                            {b.status === 'BERLANGSUNG' && (
                                                                <button
                                                                    onClick={async () => {
                                                                        try {
                                                                            // Padang center or slightly offset
                                                                            const lat = -0.9471 + (Math.random() * 0.01 - 0.005);
                                                                            const lng = 100.4172 + (Math.random() * 0.01 - 0.005);
                                                                            await api.post(`/vehicles/booking/${b.id}/location`, { latitude: lat, longitude: lng, speed: Math.floor(Math.random() * 40) + 10 });
                                                                            showToast('Lokasi simulasi berhasil dikirim. Silakan cek peta.');
                                                                        } catch (e) {
                                                                            showToast('Gagal mengirim lokasi simulasi', 'error');
                                                                        }
                                                                    }}
                                                                    className="p-1.5 text-slate-400 hover:text-emerald-500 transition-colors"
                                                                    title="Kirim Simulasi GPS (Jika Geolocation Browser Error)"
                                                                >
                                                                    <Navigation2 size={16} />
                                                                </button>
                                                            )}
                                                            {b.status === 'COMPLETED' && canManageBooking && (
                                                                <button
                                                                    onClick={() => {
                                                                        setActionData({ ...actionData, startKm: b.startKm || '', endKm: b.endKm || '', fuelLiters: b.fuelLiters || '', fuelPrice: b.fuelPrice || '', tripNotes: b.tripNotes || '', returnLocation: b.returnLocation || '' });
                                                                        setShowActionModal({ type: 'EDIT_HISTORY', data: b });
                                                                    }}
                                                                    className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors"
                                                                >
                                                                    <Edit size={16} />
                                                                </button>
                                                            )}
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
                        {/* Subtabs Navigation */}
                        <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar border-b border-slate-100">
                            {['DATABASE', 'ACTIVE_TRIPS', 'HISTORY', 'PELANGGARAN', 'SETTINGS'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setDriverSubTab(tab)}
                                    className={`px-4 py-2 rounded-t-xl text-sm font-bold whitespace-nowrap transition-all border-b-2 ${driverSubTab === tab ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
                                >
                                    {tab === 'DATABASE' && '📇 Database Driver'}
                                    {tab === 'ACTIVE_TRIPS' && '🚚 Sedang Bertugas'}
                                    {tab === 'HISTORY' && '📅 Histori Perjalanan'}
                                    {tab === 'PELANGGARAN' && '⚠️ Pelanggaran'}
                                    {tab === 'SETTINGS' && '⚙️ Pengaturan'}
                                </button>
                            ))}
                        </div>

                        {/* DATABASE TAB */}
                        {driverSubTab === 'DATABASE' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-800">Database Driver</h3>
                                        <p className="text-sm text-slate-500">Informasi profil lengkap dan ketersediaan driver.</p>
                                    </div>
                                    <div className="relative w-full md:w-64">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="text"
                                            placeholder="Cari nama..."
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            onChange={(e) => {
                                                const val = e.target.value.toLowerCase();
                                                setDrivers(prev => prev.map(d => ({ ...d, hidden: !(d.name || d.username || '').toLowerCase().includes(val) })));
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {drivers.filter(d => !d.hidden).map(d => (
                                        <div key={d.id} className="bg-white border flex flex-col justify-between border-slate-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                                            {/* Status Badge */}
                                            <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-xl text-[10px] font-black tracking-wider uppercase ${d.dynamicStatus === 'ON_TRIP' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {d.dynamicStatus === 'ON_TRIP' ? 'ON TRIP' : 'AVAILABLE'}
                                            </div>

                                            <div className="flex items-start gap-4 mb-4">
                                                <div className="w-14 h-14 shrink-0 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-600 font-bold text-xl border-2 border-white shadow-sm">
                                                    {(d.name || d.username || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <div className="mt-1">
                                                    <div className="font-bold text-slate-800 text-base leading-tight">{d.name || d.username}</div>
                                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">{d.unit?.name || 'UMUM'}</div>
                                                    <div className="text-xs text-blue-600 font-medium mt-0.5">{d.position}</div>
                                                </div>
                                            </div>

                                            <div className="bg-slate-50 rounded-xl p-3 space-y-2 mb-4 border border-slate-100">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-500">SIM:</span>
                                                    <span className="font-bold text-slate-700">
                                                        {d.licenseType ? `${d.licenseType} (${d.licenseNumber || '-'})` : 'Belum diisi'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-500">Total Trip:</span>
                                                    <span className="font-bold text-slate-700">{d.totalTrips || 0} Kali</span>
                                                </div>
                                                {d.phone && (
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-slate-500">Kontak:</span>
                                                        <a href={`https://wa.me/${d.phone.replace(/[^0-9]/g, '').replace(/^0/, '62')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg transition-colors font-bold cursor-pointer">
                                                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                                                            </svg>
                                                            Hubungi via WA
                                                        </a>
                                                    </div>
                                                )}
                                            </div>

                                            {(isSuperAdmin || isAdminAset) && (
                                                <div className="pt-2 border-t border-slate-100 flex justify-end">
                                                    <button
                                                        onClick={() => setSelectedDriverForEdit(d)}
                                                        className="text-xs font-bold text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                                                    >
                                                        Edit Profil
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ACTIVE TRIPS TAB */}
                        {driverSubTab === 'ACTIVE_TRIPS' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-800">Sedang Bertugas</h3>
                                        <p className="text-sm text-slate-500">Driver yang saat ini sedang dalam perjalanan aktif.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {drivers.filter(d => d.dynamicStatus === 'ON_TRIP').length === 0 ? (
                                        <div className="col-span-full py-16 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                                            <Navigation2 className="mx-auto text-slate-300 mb-3" size={40} />
                                            <p className="text-slate-500 font-bold">Semua driver sedang standby di kantor.</p>
                                        </div>
                                    ) : drivers.filter(d => d.dynamicStatus === 'ON_TRIP').map(d => (
                                        <div key={d.id} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex items-start gap-4">
                                            <div className="w-12 h-12 shrink-0 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-lg border-2 border-white shadow-sm">
                                                {(d.name || d.username || '?').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start">
                                                    <div className="font-bold text-slate-800 text-lg">{d.name || d.username}</div>
                                                    <div className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-1 rounded">ON TRIP</div>
                                                </div>
                                                <div className="mt-3 space-y-2 text-sm text-slate-600">
                                                    <div className="flex items-start gap-2">
                                                        <Car size={16} className="mt-0.5 text-slate-400 shrink-0" />
                                                        <span><span className="font-bold">{d.currentTrip?.vehicle?.name}</span> ({d.currentTrip?.vehicle?.plateNumber})</span>
                                                    </div>
                                                    <div className="flex items-start gap-2">
                                                        <MapPin size={16} className="mt-0.5 text-slate-400 shrink-0" />
                                                        <span><span className="font-bold">Tujuan:</span> {d.currentTrip?.destination}</span>
                                                    </div>
                                                    <div className="flex items-start gap-2">
                                                        <Clock size={16} className="mt-0.5 text-slate-400 shrink-0" />
                                                        <span><span className="font-bold">Berangkat:</span> {new Date(d.currentTrip?.startDate).toLocaleString('id-ID')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* HISTORY TAB */}
                        {driverSubTab === 'HISTORY' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-800">Histori Perjalanan</h3>
                                        <p className="text-sm text-slate-500">Pilih driver dan bulan untuk melihat riwayat perjalanannya.</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={historyMonth}
                                            onChange={(e) => setHistoryMonth(parseInt(e.target.value))}
                                            className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold bg-white text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((m, i) => (
                                                <option key={i + 1} value={i + 1}>{m}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={historyYear}
                                            onChange={(e) => setHistoryYear(parseInt(e.target.value))}
                                            className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold bg-white text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            {[2024, 2025, 2026].map(y => (
                                                <option key={y} value={y}>{y}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                    <div className="md:col-span-1 space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                        <div className="font-bold text-slate-700 text-sm mb-3 sticky top-0 bg-white z-10 py-2">Daftar Driver:</div>
                                        {drivers.map(d => (
                                            <button
                                                key={d.id}
                                                onClick={() => setSelectedHistoryDriver(d)}
                                                className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${selectedHistoryDriver?.id === d.id ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700'}`}
                                            >
                                                <div className="text-sm font-bold">{d.name || d.username}</div>
                                                <div className={`text-[10px] font-medium mt-1 ${selectedHistoryDriver?.id === d.id ? 'text-blue-100' : 'text-slate-400'}`}>
                                                    {d.totalTrips || 0} Total Perjalanan
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="md:col-span-3">
                                        {!selectedHistoryDriver ? (
                                            <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-10 flex flex-col items-center justify-center text-center h-full min-h-[300px]">
                                                <Navigation2 size={48} className="text-slate-300 mb-4" />
                                                <h4 className="text-lg font-bold text-slate-500">Pilih Driver</h4>
                                                <p className="text-sm text-slate-400 mt-2 max-w-sm">
                                                    Klik nama driver di panel sebelah kiri untuk memuat histori perjalanannya.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                                <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                                                    <div className="font-bold text-slate-700 text-sm">
                                                        Histori: <span className="text-blue-600">{selectedHistoryDriver.name || selectedHistoryDriver.username}</span>
                                                    </div>
                                                    <div className="text-xs font-bold text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">
                                                        {driverHistory.length} Perjalanan
                                                    </div>
                                                </div>
                                                <div className="p-0">
                                                    {driverHistory.length === 0 ? (
                                                        <div className="p-10 text-center">
                                                            <Calendar size={32} className="text-slate-300 mx-auto mb-3" />
                                                            <p className="text-slate-500 text-sm font-medium">Tidak ada riwayat perjalanan di bulan ini.</p>
                                                        </div>
                                                    ) : (
                                                        <table className="w-full text-left border-collapse">
                                                            <thead>
                                                                <tr className="bg-slate-50/50 text-[10px] uppercase tracking-wider text-slate-400">
                                                                    <th className="p-4 font-bold border-b border-slate-100">Waktu</th>
                                                                    <th className="p-4 font-bold border-b border-slate-100">Kendaraan</th>
                                                                    <th className="p-4 font-bold border-b border-slate-100">Tujuan</th>
                                                                    <th className="p-4 font-bold border-b border-slate-100">Tipe</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="text-sm divide-y divide-slate-100">
                                                                {driverHistory.map((trip, idx) => (
                                                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                                        <td className="p-4">
                                                                            <div className="font-bold text-slate-700">{new Date(trip.startDate).toLocaleDateString('id-ID')}</div>
                                                                            <div className="text-xs text-slate-400">{new Date(trip.startDate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                                                                        </td>
                                                                        <td className="p-4">
                                                                            <div className="font-bold text-slate-700">{trip.vehicle?.name || '-'}</div>
                                                                            <div className="text-xs text-slate-500">{trip.vehicle?.plateNumber || '-'}</div>
                                                                        </td>
                                                                        <td className="p-4 text-slate-600">{trip.destination || '-'}</td>
                                                                        <td className="p-4">
                                                                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${trip.tripType === 'BUS' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                                                {trip.tripType}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* PELANGGARAN TAB */}
                        {driverSubTab === 'PELANGGARAN' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-800">Catatan Pelanggaran</h3>
                                        <p className="text-sm text-slate-500">Database monitoring kedisiplinan pengemudi.</p>
                                    </div>
                                    {(isSuperAdmin || isAdminAset) && (
                                        <button
                                            onClick={() => setShowViolationAddModal(true)}
                                            className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200 flex items-center gap-2 whitespace-nowrap"
                                        >
                                            <Plus size={16} /> Tambah Pelanggaran
                                        </button>
                                    )}
                                </div>

                                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                    {driverViolations.length === 0 ? (
                                        <div className="py-20 text-center bg-slate-50">
                                            <CheckCircle className="mx-auto text-emerald-300 mb-3" size={48} />
                                            <p className="text-slate-500 font-bold">Belum ada catatan pelanggaran.</p>
                                            <p className="text-xs text-slate-400 mt-1">Sistem kedisiplinan berjalan dengan baik.</p>
                                        </div>
                                    ) : (
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                                                    <th className="p-4">Tanggal</th>
                                                    <th className="p-4">Driver</th>
                                                    <th className="p-4">Kategori</th>
                                                    <th className="p-4">Sanksi</th>
                                                    <th className="p-4 text-right">Aksi</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-sm">
                                                {driverViolations.map((v) => (
                                                    <tr key={v.id} className="hover:bg-slate-50">
                                                        <td className="p-4 whitespace-nowrap font-medium text-slate-700">
                                                            {new Date(v.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </td>
                                                        <td className="p-4 font-bold text-slate-800">
                                                            {v.driver?.name}
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 px-2 py-1 rounded text-xs font-bold border border-red-100">
                                                                <AlertCircle size={12} /> {v.category}
                                                            </div>
                                                            <div className="text-xs text-slate-500 mt-1 max-w-xs truncate" title={v.description}>{v.description}</div>
                                                        </td>
                                                        <td className="p-4 font-bold text-slate-600">{v.sanction}</td>
                                                        <td className="p-4 text-right">
                                                            {(isSuperAdmin || isAdminAset) && (
                                                                <button
                                                                    onClick={() => {
                                                                        if (window.confirm('Hapus histori pelanggaran ini?')) {
                                                                            api.delete(`/personnel/violations/${v.id}`).then(() => {
                                                                                showToast('Pelanggaran berhasil dihapus');
                                                                                fetchDriverViolations();
                                                                            }).catch(() => showToast('Gagal menghapus', 'error'));
                                                                        }
                                                                    }}
                                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* SETTINGS TAB */}
                        {driverSubTab === 'SETTINGS' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                {(isSuperAdmin || isAdminAset) ? (
                                    <>
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-800">Pengaturan Driver</h3>
                                            <p className="text-sm text-slate-500">Tambah atau hapus penugasan driver dari daftar personel.</p>
                                        </div>
                                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4 pt-4 border-t border-slate-100">
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
                                                                className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 transition-all shadow-sm"
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

                                        <div className="py-6 border-t border-slate-100">
                                            <h4 className="text-sm font-bold text-red-600 flex items-center gap-2 mb-4">
                                                <Trash2 size={16} /> Hapus Penugasan Driver
                                            </h4>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                {drivers.map(d => (
                                                    <button
                                                        key={d.id}
                                                        onClick={() => handleToggleDriver(d.id, true)}
                                                        className="px-3 py-2 bg-white border border-slate-200 hover:border-red-500 hover:bg-red-50 hover:text-red-700 text-slate-600 rounded-xl text-xs font-bold transition-all text-left flex justify-between items-center group"
                                                    >
                                                        <span className="truncate">{d.name || d.username}</span>
                                                        <X size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="py-20 text-center">
                                        <Lock size={48} className="mx-auto text-slate-200 mb-4" />
                                        <h3 className="text-lg font-bold text-slate-600">Akses Terbatas</h3>
                                        <p className="text-slate-400 text-sm">Hanya Admin Sarpras yang dapat mengatur penugasan driver.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'USER_VIOLATIONS' && (
                    <div className="p-6 space-y-6 animate-in fade-in duration-300">
                        {/* Header Section */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Pelanggaran User</h3>
                                <p className="text-sm text-slate-500">
                                    {isSuperAdmin || isAdminAset
                                        ? 'Daftar pelanggaran disiplin penggunaan kendaraan oleh seluruh user.'
                                        : 'Daftar pelanggaran disiplin penggunaan kendaraan Anda.'}
                                </p>
                            </div>
                            {(isSuperAdmin || isAdminAset) && (
                                <button
                                    onClick={() => setShowViolationAddModal(true)}
                                    className="px-4 py-2.5 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-200 flex items-center gap-2 whitespace-nowrap active:scale-[0.98]"
                                >
                                    <Plus size={16} /> Tambah Pelanggaran
                                </button>
                            )}
                        </div>

                        {/* Statistics Section */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {isSuperAdmin || isAdminAset ? (
                                // Admin Stats
                                <>
                                    <div className="bg-gradient-to-br from-red-50 to-red-100/50 border border-red-100 p-5 rounded-2xl shadow-sm flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-red-500 text-white flex items-center justify-center shadow-md shadow-red-200">
                                            <AlertCircle size={24} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black text-red-600 uppercase tracking-wider">Total Pelanggaran</div>
                                            <div className="text-2xl font-black text-slate-800 mt-1">{driverViolations.length} Kasus</div>
                                        </div>
                                    </div>
                                    <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-100 p-5 rounded-2xl shadow-sm flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-200">
                                            <Users size={24} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black text-amber-600 uppercase tracking-wider">User Pelanggar Terbanyak</div>
                                            <div className="text-sm font-black text-slate-800 mt-1.5 truncate max-w-[180px]">
                                                {(() => {
                                                    const counts = {};
                                                    driverViolations.forEach(v => {
                                                        const name = v.driver?.name || 'Unknown';
                                                        counts[name] = (counts[name] || 0) + 1;
                                                    });
                                                    let maxName = '-';
                                                    let maxVal = 0;
                                                    Object.entries(counts).forEach(([name, count]) => {
                                                        if (count > maxVal) {
                                                            maxVal = count;
                                                            maxName = name;
                                                        }
                                                    });
                                                    return maxVal > 0 ? `${maxName} (${maxVal}x)` : '-';
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-100 p-5 rounded-2xl shadow-sm flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-md shadow-blue-200">
                                            <Car size={24} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black text-blue-600 uppercase tracking-wider">Kategori Paling Sering</div>
                                            <div className="text-sm font-black text-slate-800 mt-1.5 truncate max-w-[180px]">
                                                {(() => {
                                                    const counts = {};
                                                    driverViolations.forEach(v => {
                                                        counts[v.category] = (counts[v.category] || 0) + 1;
                                                    });
                                                    let maxCat = '-';
                                                    let maxVal = 0;
                                                    Object.entries(counts).forEach(([cat, count]) => {
                                                        if (count > maxVal) {
                                                            maxVal = count;
                                                            maxCat = cat;
                                                        }
                                                    });
                                                    return maxVal > 0 ? `${maxCat} (${maxVal}x)` : '-';
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                // Regular User Stats
                                <>
                                    <div className="bg-gradient-to-br from-red-50 to-red-100/50 border border-red-100 p-5 rounded-2xl shadow-sm flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-red-500 text-white flex items-center justify-center shadow-md shadow-red-200">
                                            <AlertCircle size={24} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black text-red-600 uppercase tracking-wider">Pelanggaran Saya</div>
                                            <div className="text-2xl font-black text-slate-800 mt-1">
                                                {driverViolations.filter(v => v.driverId === user.id).length} Kasus
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-100 p-5 rounded-2xl shadow-sm flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-200">
                                            <Calendar size={24} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black text-amber-600 uppercase tracking-wider">Pelanggaran Bulan Ini</div>
                                            <div className="text-2xl font-black text-slate-800 mt-1">
                                                {(() => {
                                                    const curMonth = new Date().getMonth();
                                                    const curYear = new Date().getFullYear();
                                                    return driverViolations.filter(v => {
                                                        if (v.driverId !== user.id) return false;
                                                        const d = new Date(v.date);
                                                        return d.getMonth() === curMonth && d.getFullYear() === curYear;
                                                    }).length;
                                                })()} Kasus
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-gradient-to-br from-green-50 to-green-100/50 border border-green-100 p-5 rounded-2xl shadow-sm flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-green-600 text-white flex items-center justify-center shadow-md shadow-green-200">
                                            <CheckCircle size={24} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black text-green-600 uppercase tracking-wider">Status Akumulasi</div>
                                            <div className="text-sm font-black text-slate-800 mt-1.5 uppercase">
                                                {(() => {
                                                    const count = driverViolations.filter(v => v.driverId === user.id).length;
                                                    if (count === 0) return <span className="text-green-600">Sangat Baik</span>;
                                                    if (count <= 2) return <span className="text-amber-600">Peringatan</span>;
                                                    return <span className="text-red-600">Sanksi Berat</span>;
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* List Section */}
                        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                            {(() => {
                                const displayedViolations = isSuperAdmin || isAdminAset
                                    ? driverViolations
                                    : driverViolations.filter(v => v.driverId === user.id);

                                if (displayedViolations.length === 0) {
                                    return (
                                        <div className="py-20 text-center bg-slate-50/50">
                                            <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-100">
                                                <CheckCircle size={32} />
                                            </div>
                                            <p className="text-slate-500 font-bold text-base">Tidak ada catatan pelanggaran.</p>
                                            <p className="text-xs text-slate-400 mt-1">Sistem kedisiplinan berjalan dengan baik dan patuh aturan.</p>
                                        </div>
                                    );
                                }

                                return (
                                    <>
                                        {/* Mobile View */}
                                        <div className="grid grid-cols-1 gap-4 p-4 md:hidden">
                                            {displayedViolations.map((v) => (
                                                <div key={v.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
                                                    <div className="flex justify-between items-start">
                                                        <div className="text-[10px] font-bold text-slate-400">
                                                            {new Date(v.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                        </div>
                                                        {(isSuperAdmin || isAdminAset) && (
                                                            <button
                                                                onClick={() => {
                                                                    if (window.confirm('Hapus histori pelanggaran ini?')) {
                                                                        api.delete(`/personnel/violations/${v.id}`).then(() => {
                                                                            showToast('Pelanggaran berhasil dihapus');
                                                                            fetchDriverViolations();
                                                                        }).catch(() => showToast('Gagal menghapus', 'error'));
                                                                    }
                                                                }}
                                                                className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                    
                                                    {(isSuperAdmin || isAdminAset) && (
                                                        <div className="text-sm font-bold text-slate-800">
                                                            User: <span className="text-blue-600">{v.driver?.name || 'Unknown'}</span>
                                                        </div>
                                                    )}

                                                    <div className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border border-red-100">
                                                        <AlertCircle size={10} /> {v.category}
                                                    </div>

                                                    <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                                        <strong>Detail:</strong> {v.description}
                                                    </div>

                                                    <div className="text-xs text-slate-700 flex items-center gap-1">
                                                        <strong>Sanksi:</strong> <span className="text-red-600 font-bold bg-red-50 border border-red-100 px-2 py-0.5 rounded-md">{v.sanction}</span>
                                                    </div>

                                                    {v.photoUrl && (
                                                        <div className="mt-2 pt-2 border-t border-slate-100">
                                                            <a href={v.photoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-[10px] font-bold flex items-center gap-1.5 uppercase">
                                                                <Camera size={12} /> Lihat Bukti Foto
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Desktop View */}
                                        <div className="hidden md:block overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                        <th className="p-4 pl-6">Tanggal</th>
                                                        {(isSuperAdmin || isAdminAset) && <th className="p-4">User / Driver</th>}
                                                        <th className="p-4">Kategori</th>
                                                        <th className="p-4">Keterangan / Kejadian</th>
                                                        <th className="p-4">Sanksi / Tindakan</th>
                                                        <th className="p-4 text-center">Bukti Foto</th>
                                                        {(isSuperAdmin || isAdminAset) && <th className="p-4 pr-6 text-right">Aksi</th>}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 text-sm">
                                                    {displayedViolations.map((v) => (
                                                        <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="p-4 pl-6 whitespace-nowrap font-medium text-slate-600">
                                                                {new Date(v.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                            </td>
                                                            {(isSuperAdmin || isAdminAset) && (
                                                                <td className="p-4">
                                                                    <div className="font-bold text-slate-800">{v.driver?.name || 'Unknown'}</div>
                                                                    <div className="text-[10px] text-slate-400 font-bold uppercase">{v.driver?.nip ? `NIP: ${v.driver.nip}` : 'No NIP'}</div>
                                                                </td>
                                                            )}
                                                            <td className="p-4 whitespace-nowrap">
                                                                <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 px-2.5 py-1 rounded-full text-xs font-bold border border-red-100 shadow-sm">
                                                                    <AlertCircle size={12} /> {v.category}
                                                                </span>
                                                            </td>
                                                            <td className="p-4 max-w-sm">
                                                                <div className="text-slate-700 leading-relaxed break-words">{v.description}</div>
                                                            </td>
                                                            <td className="p-4 whitespace-nowrap">
                                                                <span className="inline-block px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-black uppercase shadow-inner">
                                                                    {v.sanction}
                                                                </span>
                                                            </td>
                                                            <td className="p-4 text-center">
                                                                {v.photoUrl ? (
                                                                    <a href={v.photoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors" title="Lihat Bukti Foto">
                                                                        <Camera size={18} />
                                                                    </a>
                                                                ) : (
                                                                    <span className="text-slate-300 font-bold text-xs">-</span>
                                                                )}
                                                            </td>
                                                            {(isSuperAdmin || isAdminAset) && (
                                                                <td className="p-4 pr-6 text-right">
                                                                    <button
                                                                        onClick={() => {
                                                                            if (window.confirm('Hapus histori pelanggaran ini?')) {
                                                                                api.delete(`/personnel/violations/${v.id}`).then(() => {
                                                                                    showToast('Pelanggaran berhasil dihapus');
                                                                                    fetchDriverViolations();
                                                                                }).catch(() => showToast('Gagal menghapus', 'error'));
                                                                            }
                                                                        }}
                                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-95"
                                                                        title="Hapus Pelanggaran"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </td>
                                                            )}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>

                        {/* Daftar User Disanksi (Admins Only) */}
                        {(isSuperAdmin || isAdminAset) && (
                            <div className="mt-8">
                                <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <AlertCircle className="text-red-600" /> Daftar User Disanksi
                                </h4>
                                <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                                    {sanctionedUsers.length === 0 ? (
                                        <div className="py-12 text-center bg-slate-50/50">
                                            <p className="text-slate-500 font-bold">Tidak ada user yang sedang disanksi.</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                        <th className="p-4 pl-6">User</th>
                                                        <th className="p-4">Unit</th>
                                                        <th className="p-4">Status Pencabutan</th>
                                                        <th className="p-4 pr-6 text-right">Aksi</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 text-sm">
                                                    {sanctionedUsers.map(su => (
                                                        <tr key={su.id} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="p-4 pl-6">
                                                                <div className="font-bold text-slate-800">{su.name || su.username}</div>
                                                                <div className="text-[10px] text-slate-400 font-bold uppercase">NIP: {su.nip || '-'}</div>
                                                            </td>
                                                            <td className="p-4 text-slate-600">{su.unit?.name || '-'}</td>
                                                            <td className="p-4">
                                                                {su.sanctionProposedLift ? (
                                                                    <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full text-xs font-bold border border-amber-200">
                                                                        <Clock size={12} /> Menunggu Reviu
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 px-2.5 py-1 rounded-full text-xs font-bold border border-red-200">
                                                                        Belum Ada Usulan
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="p-4 pr-6 text-right">
                                                                {su.sanctionProposedLift && (
                                                                    <button
                                                                        onClick={() => setShowSanctionReviewModal(su)}
                                                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                                                                    >
                                                                        Reviu
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Riwayat Sanksi (Dicabut) */}
                        <div className="mt-8">
                            <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <History className="text-blue-600" /> Riwayat Pencabutan Sanksi
                            </h4>
                            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                                {(() => {
                                    const liftedSanctions = (isSuperAdmin || isAdminAset ? driverViolations : driverViolations.filter(v => v.driverId === user.id)).filter(v => v.category === "Sanksi Peminjaman" && v.sanction === "Sanksi Dicabut");

                                    if (liftedSanctions.length === 0) {
                                        return (
                                            <div className="py-12 text-center bg-slate-50/50">
                                                <p className="text-slate-500 font-bold">Belum ada riwayat pencabutan sanksi.</p>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                        <th className="p-4 pl-6">Tanggal</th>
                                                        {(isSuperAdmin || isAdminAset) && <th className="p-4">User</th>}
                                                        <th className="p-4">Status</th>
                                                        <th className="p-4 pr-6">Catatan & Riwayat</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 text-sm">
                                                    {liftedSanctions.map(v => (
                                                        <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="p-4 pl-6 whitespace-nowrap font-medium text-slate-600">
                                                                {new Date(v.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                            </td>
                                                            {(isSuperAdmin || isAdminAset) && (
                                                                <td className="p-4">
                                                                    <div className="font-bold text-slate-800">{v.driver?.name || 'Unknown'}</div>
                                                                    <div className="text-[10px] text-slate-400 font-bold uppercase">{v.driver?.nip ? `NIP: ${v.driver.nip}` : 'No NIP'}</div>
                                                                </td>
                                                            )}
                                                            <td className="p-4 whitespace-nowrap">
                                                                <span className="inline-block px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-black uppercase shadow-inner">
                                                                    {v.sanction}
                                                                </span>
                                                            </td>
                                                            <td className="p-4">
                                                                <div className="text-slate-700 leading-relaxed break-words text-xs whitespace-pre-wrap">{v.description}</div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Driver Edit Modal */}
            {selectedDriverForEdit && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-start mb-6">
                            <h3 className="text-xl font-bold text-slate-800">Edit Profil Driver</h3>
                            <button onClick={() => setSelectedDriverForEdit(null)} className="text-slate-400 hover:text-slate-600">
                                <XCircle size={24} />
                            </button>
                        </div>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                const fd = new FormData(e.target);
                                api.put(`/personnel/drivers/${selectedDriverForEdit.id}`, {
                                    licenseNumber: fd.get('licenseNumber'),
                                    licenseType: fd.get('licenseType'),
                                    driverStatus: fd.get('driverStatus')
                                }).then(() => {
                                    showToast('Profil driver berhasil diperbarui');
                                    fetchDrivers();
                                    setSelectedDriverForEdit(null);
                                }).catch(err => {
                                    showToast('Gagal memperbarui profil driver', 'error');
                                });
                            }}
                            className="space-y-4"
                        >
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl">
                                    {(selectedDriverForEdit.name || selectedDriverForEdit.username || '?').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="font-bold text-slate-800">{selectedDriverForEdit.name || selectedDriverForEdit.username}</div>
                                    <div className="text-xs text-slate-500">{selectedDriverForEdit.position}</div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Tipe SIM</label>
                                <select
                                    name="licenseType"
                                    defaultValue={selectedDriverForEdit.licenseType || ''}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">Pilih Tipe SIM</option>
                                    <option value="SIM A">SIM A</option>
                                    <option value="SIM A Umum">SIM A Umum</option>
                                    <option value="SIM B1">SIM B1</option>
                                    <option value="SIM B1 Umum">SIM B1 Umum</option>
                                    <option value="SIM B2">SIM B2</option>
                                    <option value="SIM B2 Umum">SIM B2 Umum</option>
                                    <option value="SIM C">SIM C</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Nomor SIM</label>
                                <input
                                    name="licenseNumber"
                                    type="text"
                                    defaultValue={selectedDriverForEdit.licenseNumber || ''}
                                    placeholder="Masukkan No. SIM..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Status Driver</label>
                                <select
                                    name="driverStatus"
                                    defaultValue={selectedDriverForEdit.driverStatus || 'AVAILABLE'}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="AVAILABLE">Available (Tersedia)</option>
                                    <option value="OFF">Off / Izin / Sakit</option>
                                    {/* ON_TRIP is automatically resolved by backend, so we don't strictly need to set it, but we can allow override if needed */}
                                    <option value="ON_TRIP">Sedang Jalan (Manual)</option>
                                </select>
                            </div>

                            <div className="pt-4">
                                <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
                                    Simpan Perubahan
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Tambah Pelanggaran Modal */}
            {showViolationAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-start mb-6">
                            <h3 className="text-xl font-bold text-slate-800">Catat Pelanggaran Baru</h3>
                            <button onClick={() => setShowViolationAddModal(false)} className="text-slate-400 hover:text-slate-600">
                                <XCircle size={24} />
                            </button>
                        </div>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                const fd = new FormData(e.target);
                                api.post(`/personnel/violations`, fd, {
                                    headers: { 'Content-Type': 'multipart/form-data' }
                                }).then(() => {
                                    showToast('Pelanggaran berhasil dicatat');
                                    fetchDriverViolations();
                                    setShowViolationAddModal(false);
                                }).catch(err => {
                                    showToast('Gagal mencatat pelanggaran', 'error');
                                });
                            }}
                            className="space-y-4"
                        >
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Pilih Driver</label>
                                <select
                                    name="driverId"
                                    required
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">-- Pilih Driver --</option>
                                    {drivers.map(d => (
                                        <option key={d.id} value={d.id}>{d.name || d.username}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Tanggal Kedjadian</label>
                                <input
                                    type="date"
                                    name="date"
                                    required
                                    defaultValue={new Date().toISOString().split('T')[0]}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Kategori Pelanggaran</label>
                                <select
                                    name="category"
                                    required
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="Tidak mengikuti Sistem Booking">Tidak mengikuti Sistem Booking</option>
                                    <option value="Tidak Mengisi BBM">Tidak Mengisi BBM</option>
                                    <option value="Lalu Lintas / Ugal-ugalan">Lalu Lintas / Ugal-ugalan</option>
                                    <option value="Kerusakan Kendaraan (Kelalaian)">Kerusakan Kendaraan (Kelalaian)</option>
                                    <option value="Lainnya">Lainnya</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Deskripsi Kejadian</label>
                                <textarea
                                    name="description"
                                    required
                                    rows="3"
                                    placeholder="Ceritakan kronologi singkat..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                ></textarea>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Tindakan / Sanksi</label>
                                <input
                                    type="text"
                                    name="sanction"
                                    required
                                    placeholder="Contoh: Teguran Lisan, SP1, Pemotongan Insentif"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Bukti Foto (Opsional)</label>
                                <input
                                    type="file"
                                    name="photo"
                                    accept="image/*"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                                />
                            </div>

                            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                                <input 
                                    type="checkbox" 
                                    name="freezeAccount" 
                                    id="freezeAccount"
                                    value="true"
                                    className="mt-1 w-4 h-4 text-red-600 rounded border-red-300 focus:ring-red-500 cursor-pointer" 
                                />
                                <div>
                                    <label htmlFor="freezeAccount" className="text-sm font-bold text-red-800 cursor-pointer">Bekukan Peminjaman Akun User</label>
                                    <p className="text-[10px] text-red-600 mt-0.5 leading-tight">Jika dicentang, user ini tidak akan bisa meminjam kendaraan (akun disanksi) hingga sanksi dicabut oleh admin.</p>
                                </div>
                            </div>

                            <div className="pt-4">
                                <button type="submit" className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200">
                                    Simpan Pelanggaran
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Action Modals */}
            {
                showActionModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-start mb-6">
                                <h3 className="text-xl font-bold text-slate-800">
                                    {showActionModal.type === 'REJECT' && 'Tolak Permohonan'}
                                    {showActionModal.type === 'CANCEL' && 'Batalkan Peminjaman'}
                                    {showActionModal.type === 'START' && 'Mulai Perjalanan'}
                                    {showActionModal.type === 'END' && 'Selesai Perjalanan'}
                                    {showActionModal.type === 'EDIT_HISTORY' && 'Edit Riwayat Perjalanan'}
                                    {showActionModal.type === 'EXTEND' && 'Perpanjang Jadwal'}
                                </h3>
                                <button onClick={() => setShowActionModal(null)} className="text-slate-400 hover:text-slate-600">
                                    <XCircle size={24} />
                                </button>
                            </div>

                            {(showActionModal.type === 'REJECT' || showActionModal.type === 'CANCEL') && (
                                <div className="space-y-4">
                                    <label className="block text-xs font-bold text-slate-500 uppercase">
                                        {showActionModal.type === 'REJECT' ? 'Alasan Penolakan' : 'Alasan Pembatalan'}
                                    </label>
                                    <textarea
                                        className={`w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 ${showActionModal.type === 'REJECT' ? 'focus:ring-red-500' : 'focus:ring-red-500'} outline-none`}
                                        rows={3} autoFocus
                                        placeholder="Wajib diisi..."
                                        value={actionData.reason}
                                        onChange={e => setActionData({ ...actionData, reason: e.target.value })}
                                    />
                                    <button
                                        disabled={!actionData.reason || submitting}
                                        onClick={showActionModal.type === 'REJECT' ? () => handleAction(showActionModal.data.id, 'REJECT') : handleCancelSubmit}
                                        className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50 transition-all shadow-lg shadow-red-200"
                                    >
                                        {showActionModal.type === 'REJECT' ? 'Konfirmasi Tolak' : 'Konfirmasi Batal'}
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
                                    <div className="flex gap-3 pt-6">
                                        <button
                                            onClick={handleStartTrip}
                                            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-200"
                                        >
                                            Mulai Perjalanan
                                        </button>
                                    </div>
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
                                                <div className="grid grid-cols-1 gap-3">
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
                                                className={`py-2 px-1 rounded-xl border text-[10px] sm:text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${actionData.fuelCondition === 'LOW' ? 'bg-red-50 border-red-500 text-red-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                                    }`}
                                            >
                                                <div className={`w-3 h-3 rounded-full ${actionData.fuelCondition === 'LOW' ? 'bg-red-500' : 'bg-slate-300'}`}></div>
                                                &lt; 1/4
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setActionData({ ...actionData, fuelCondition: 'MEDIUM' })}
                                                className={`py-2 px-1 rounded-xl border text-[10px] sm:text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${actionData.fuelCondition === 'MEDIUM' ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                                    }`}
                                            >
                                                <div className={`w-3 h-3 rounded-full ${actionData.fuelCondition === 'MEDIUM' ? 'bg-amber-500' : 'bg-slate-300'}`}></div>
                                                1/4 - 1/2
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setActionData({ ...actionData, fuelCondition: 'HIGH' })}
                                                className={`py-2 px-1 rounded-xl border text-[10px] sm:text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${actionData.fuelCondition === 'HIGH' ? 'bg-green-50 border-green-500 text-green-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                                    }`}
                                            >
                                                <div className={`w-3 h-3 rounded-full ${actionData.fuelCondition === 'HIGH' ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                                                &gt; 1/2
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Posisi Terakhir Kendaraan</label>
                                        <select
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none mb-2 text-slate-700"
                                            value={actionData.returnLocation || ''}
                                            onChange={e => setActionData({ ...actionData, returnLocation: e.target.value })}
                                        >
                                            <option value="" disabled>-- Pilih Lokasi Terakhir --</option>
                                            {['Lapai', 'Islamic', 'Pondok Putra', 'SD 2', 'Suratu TV/Deiped', 'MIT', 'SD 3', 'Limapuluh Kota', 'Lainnya'].map(loc => (
                                                <option key={loc} value={loc}>{loc}</option>
                                            ))}
                                        </select>
                                        {actionData.returnLocation === 'Lainnya' && (
                                            <input
                                                type="text"
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none animate-in fade-in slide-in-from-top-1"
                                                placeholder="Sebutkan lokasi..."
                                                value={actionData.customLocation}
                                                onChange={e => setActionData({ ...actionData, customLocation: e.target.value })}
                                            />
                                        )}
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
                                        disabled={!actionData.km || !actionData.returnLocation || (actionData.returnLocation === 'Lainnya' && !actionData.customLocation) || submitting}
                                        onClick={handleEndTrip}
                                        className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 transition-all shadow-lg shadow-green-200"
                                    >
                                        Selesaikan Perjalanan
                                    </button>
                                </div>
                            )}

                            {showActionModal.type === 'EDIT_HISTORY' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">KM Awal</label>
                                            <div className="relative">
                                                <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                                <input
                                                    type="number"
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                                    placeholder="0"
                                                    value={actionData.startKm || ''}
                                                    onChange={e => setActionData({ ...actionData, startKm: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">KM Akhir</label>
                                            <div className="relative">
                                                <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                                <input
                                                    type="number"
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                                                    placeholder="0"
                                                    value={actionData.endKm || ''}
                                                    onChange={e => setActionData({ ...actionData, endKm: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">BBM (Liter)</label>
                                            <input
                                                type="number"
                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="0"
                                                value={actionData.fuelLiters || ''}
                                                onChange={e => setActionData({ ...actionData, fuelLiters: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Biaya BBM (Rp)</label>
                                            <div className="relative">
                                                <Receipt className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                                <input
                                                    type="number"
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                                    placeholder="0"
                                                    value={actionData.fuelPrice || ''}
                                                    onChange={e => setActionData({ ...actionData, fuelPrice: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Lokasi Akhir & Catatan</label>
                                        <input
                                            type="text"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none mb-2"
                                            placeholder="Lokasi pengembalian..."
                                            value={actionData.returnLocation || ''}
                                            onChange={e => setActionData({ ...actionData, returnLocation: e.target.value })}
                                        />
                                        <textarea
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="Catatan..."
                                            rows="2"
                                            value={actionData.tripNotes || ''}
                                            onChange={e => setActionData({ ...actionData, tripNotes: e.target.value })}
                                        />
                                    </div>

                                    <button
                                        disabled={submitting}
                                        onClick={handleEditHistory}
                                        className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 disabled:opacity-50 transition-all shadow-lg shadow-amber-200"
                                    >
                                        Simpan Perubahan
                                    </button>
                                </div>
                            )}

                            {showActionModal.type === 'EXTEND' && (
                                <div className="space-y-4">
                                    <div className="p-4 bg-amber-50 text-amber-700 rounded-xl flex gap-3 text-sm">
                                        <AlertCircle className="shrink-0" size={20} />
                                        <p>Perpanjangan jadwal hanya diperbolehkan apabila <b>terjadi kendala di perjalanan</b> (misal: cuaca, macet total, kondisi khusus).</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Batas Waktu Pengembalian Baru</label>
                                        <div className="relative">
                                            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input
                                                type="datetime-local"
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none font-bold"
                                                value={actionData.newEndDate}
                                                onChange={e => setActionData({ ...actionData, newEndDate: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Alasan Kendala</label>
                                        <textarea
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                            rows={2}
                                            placeholder="Deskripsikan alasan mengapa terlambat..."
                                            value={actionData.extendReason}
                                            onChange={e => setActionData({ ...actionData, extendReason: e.target.value })}
                                        />
                                    </div>
                                    <button
                                        disabled={!actionData.newEndDate || !actionData.extendReason || submitting}
                                        onClick={handleExtendTrip}
                                        className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 disabled:opacity-50 transition-all shadow-lg shadow-amber-200"
                                    >
                                        Ajukan Perpanjangan
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
                                    <div className="font-bold text-slate-700">{showDetailModal.vehicle?.name}</div>
                                    <div className="text-[10px] font-mono text-slate-400">{showDetailModal.vehicle?.plateNumber}</div>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase">Status</div>
                                    <div className="mt-1">{getStatusBadge(showDetailModal.status)}</div>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase">Pemohon</div>
                                    <div className="font-bold text-slate-700">{showDetailModal.user?.name}</div>
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
                                        <div className="text-slate-500">Posisi Akhir:</div>
                                        <div className="text-right font-bold text-green-700">{showDetailModal.returnLocation || '-'}</div>
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

            {/* Sanction Propose Modal */}
            {showSanctionProposeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
                        <div className="flex justify-between items-start mb-6">
                            <h3 className="text-xl font-bold text-slate-800">Usulan Pencabutan Sanksi</h3>
                            <button onClick={() => setShowSanctionProposeModal(false)} className="text-slate-400 hover:text-slate-600">
                                <XCircle size={24} />
                            </button>
                        </div>
                        <div className="p-4 bg-amber-50 text-amber-700 rounded-xl flex gap-3 text-sm mb-6">
                            <AlertCircle className="shrink-0" size={20} />
                            <p>Admin akan meninjau alasan Anda sebelum mencabut sanksi pembatasan peminjaman.</p>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Alasan & Komitmen</label>
                                <textarea
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                    rows={4}
                                    placeholder="Jelaskan alasan pencabutan sanksi dan komitmen Anda..."
                                    value={sanctionProposeReason}
                                    onChange={e => setSanctionProposeReason(e.target.value)}
                                />
                            </div>
                            <button
                                disabled={submitting || !sanctionProposeReason.trim()}
                                onClick={handleProposeSanctionLift}
                                className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50 transition-all shadow-lg shadow-red-200"
                            >
                                {submitting ? 'Mengirim...' : 'Kirim Usulan Pencabutan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sanction Review Modal */}
            {showSanctionReviewModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
                        <div className="flex justify-between items-start mb-6">
                            <h3 className="text-xl font-bold text-slate-800">Reviu Pencabutan Sanksi</h3>
                            <button onClick={() => setShowSanctionReviewModal(null)} className="text-slate-400 hover:text-slate-600">
                                <XCircle size={24} />
                            </button>
                        </div>
                        <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="text-xs font-bold text-slate-500 uppercase">User / Driver</div>
                            <div className="font-bold text-slate-800 text-lg">{showSanctionReviewModal.name}</div>
                            <div className="text-sm text-slate-500 mt-2">
                                <div className="text-xs font-bold text-slate-400 uppercase">Alasan Usulan:</div>
                                <div className="italic">"{showSanctionReviewModal.sanctionLiftReason}"</div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <button
                                    className={`flex-1 py-3 rounded-xl font-bold transition-all border ${sanctionReviewAction.approved ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                                    onClick={() => setSanctionReviewAction({ ...sanctionReviewAction, approved: true })}
                                >
                                    Terima & Cabut
                                </button>
                                <button
                                    className={`flex-1 py-3 rounded-xl font-bold transition-all border ${!sanctionReviewAction.approved ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                                    onClick={() => setSanctionReviewAction({ ...sanctionReviewAction, approved: false })}
                                >
                                    Tolak Pencabutan
                                </button>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Catatan Reviu</label>
                                <textarea
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    rows={3}
                                    placeholder="Berikan catatan terkait keputusan..."
                                    value={sanctionReviewAction.reviewNotes}
                                    onChange={e => setSanctionReviewAction({ ...sanctionReviewAction, reviewNotes: e.target.value })}
                                />
                            </div>
                            <button
                                disabled={submitting || !sanctionReviewAction.reviewNotes.trim()}
                                onClick={handleReviewSanctionLift}
                                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-200"
                            >
                                {submitting ? 'Menyimpan...' : 'Simpan Keputusan'}
                            </button>
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
