import { useState, useEffect } from 'react';
import {
    Car, Calendar, MapPin, Info, CheckCircle, XCircle,
    Clock, Gauge, Fuel, User, Plus, Search,
    ArrowRight, ChevronRight, AlertCircle, Trash2,
    Users, Navigation2, LogIn, LogOut, Receipt
} from 'lucide-react';
import api from '../lib/axios';

const VehicleBooking = () => {
    const [activeTab, setActiveTab] = useState('CURRENT_FLEET');
    const [vehicles, setVehicles] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Form State for Request
    const [formData, setFormData] = useState({
        vehicleId: '',
        startDate: '',
        startTime: '08:00',
        endDate: '',
        endTime: '17:00',
        destination: '',
        purpose: '',
        passengerCount: 1,
        driverId: ''
    });

    // Modal States
    const [showDetailModal, setShowDetailModal] = useState(null);
    const [showActionModal, setShowActionModal] = useState(null); // { type: 'REJECT'|'START'|'END', data: booking }
    const [actionData, setActionData] = useState({ reason: '', km: '', notes: '', fuelRefill: false, fuelPrice: '' });

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isSuperAdmin = ['SUPER_ADMIN', 'BIDANG_IT'].includes(user.role);

    useEffect(() => {
        fetchVehicles();
        fetchStaff();
    }, []);

    useEffect(() => {
        fetchBookings();
    }, [activeTab]);

    const fetchVehicles = async () => {
        try {
            const res = await api.get('/vehicles');
            setVehicles(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchStaff = async () => {
        try {
            const res = await api.get('/personnel/staff');
            setStaff(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchBookings = async () => {
        try {
            setLoading(true);
            const res = await api.get('/vehicles/booking/all', { params: { tab: activeTab } });
            setBookings(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleSubmitRequest = async (e) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            const startStr = `${formData.startDate}T${formData.startTime}`;
            const endStr = `${formData.endDate}T${formData.endTime}`;

            await api.post('/vehicles/booking/request', {
                ...formData,
                startDate: new Date(startStr),
                endDate: new Date(endStr)
            });
            alert('Permohonan berhasil dikirim!');
            setActiveTab('MY_REQUESTS');
            setFormData({
                vehicleId: '', startDate: '', startTime: '08:00', endDate: '', endTime: '17:00',
                destination: '', purpose: '', passengerCount: 1, driverId: ''
            });
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal mengirim permohonan');
        } finally { setSubmitting(false); }
    };

    const handleAction = async (bookingId, status) => {
        try {
            setSubmitting(true);
            await api.post(`/vehicles/booking/${bookingId}/review`, {
                status,
                adminNote: actionData.reason
            });
            setShowActionModal(null);
            fetchBookings();
        } catch (err) { alert('Gagal memproses'); }
        finally { setSubmitting(false); }
    };

    const handleStartTrip = async () => {
        try {
            setSubmitting(true);
            await api.post(`/vehicles/booking/${showActionModal.data.id}/start`, {
                startKm: actionData.km
            });
            setShowActionModal(null);
            fetchBookings();
        } catch (err) { alert('Gagal memulai perjalanan'); }
        finally { setSubmitting(false); }
    };

    const handleEndTrip = async () => {
        try {
            setSubmitting(true);
            await api.post(`/vehicles/booking/${showActionModal.data.id}/end`, {
                endKm: actionData.km,
                tripNotes: actionData.notes,
                fuelRefill: actionData.fuelRefill,
                fuelPrice: actionData.fuelPrice
            });
            setShowActionModal(null);
            fetchBookings();
        } catch (err) { alert('Gagal menyelesaikan perjalanan'); }
        finally { setSubmitting(false); }
    };

    const handleCancel = async (id) => {
        if (!confirm('Batalkan permohonan ini?')) return;
        try {
            await api.post(`/vehicles/booking/${id}/cancel`);
            fetchBookings();
        } catch (err) { alert('Gagal membatalkan'); }
    };

    // Render Logic for Status Badges
    const getStatusBadge = (status) => {
        const badges = {
            PENDING: 'bg-amber-100 text-amber-700',
            APPROVED: 'bg-blue-100 text-blue-700',
            REJECTED: 'bg-red-100 text-red-700',
            COMPLETED: 'bg-green-100 text-green-700',
            CANCELLED: 'bg-slate-100 text-slate-500'
        };
        const labels = {
            PENDING: 'MENUNGGU',
            APPROVED: 'DISETUJUI',
            REJECTED: 'DITOLAK',
            COMPLETED: 'SELESAI',
            CANCELLED: 'DIBATALKAN'
        };
        return <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${badges[status]}`}>{labels[status]}</span>;
    };

    const tabs = [
        { id: 'CURRENT_FLEET', label: 'Kendaraan Dipinjam', icon: <Car size={16} /> },
        { id: 'REQUEST_FORM', label: 'Buat Request', icon: <Plus size={16} /> },
        { id: 'APPROVAL', label: 'Persetujuan', icon: <CheckCircle size={16} />, count: bookings.filter(b => b.status === 'PENDING').length },
        { id: 'MY_REQUESTS', label: 'Permohonan Saya', icon: <User size={16} /> },
        { id: 'HISTORY', label: 'Riwayat', icon: <Clock size={16} /> }
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
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100 overflow-x-auto no-scrollbar">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                        {tab.count > 0 && tab.id === 'APPROVAL' && (
                            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px]">
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Contents */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 min-h-[400px]">
                {activeTab === 'CURRENT_FLEET' && (
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {vehicles.map(v => (
                                <div key={v.id} className="border border-slate-100 rounded-xl p-4 hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="font-bold text-slate-800">{v.name}</h3>
                                            <p className="text-xs font-mono text-slate-400 uppercase">{v.plateNumber}</p>
                                        </div>
                                        <div className={`px-2 py-1 rounded text-[10px] font-bold ${v.status === 'ACTIVE' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                            {v.status === 'ACTIVE' ? 'Standby' : v.status}
                                        </div>
                                    </div>
                                    <div className="space-y-2 mb-4">
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <Gauge size={14} className="text-blue-500" />
                                            <span>{v.odometer?.toLocaleString()} km</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <User size={14} className="text-purple-500" />
                                            <span>PIC: {v.pic?.name || 'Belum ditunjuk'}</span>
                                        </div>
                                    </div>
                                    {/* Availability check can be added here if needed */}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'REQUEST_FORM' && (
                    <div className="p-6 max-w-2xl mx-auto">
                        <form onSubmit={handleSubmitRequest} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Pilih Kendaraan</label>
                                    <select
                                        required
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.vehicleId}
                                        onChange={e => setFormData({ ...formData, vehicleId: e.target.value })}
                                    >
                                        <option value="">-- Pilih Armada --</option>
                                        {vehicles.filter(v => v.status === 'ACTIVE').map(v => (
                                            <option key={v.id} value={v.id}>{v.name} ({v.plateNumber})</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Mulai Pinjam</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="date" required
                                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
                                            value={formData.startDate}
                                            onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                        />
                                        <input
                                            type="time" required
                                            className="w-24 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
                                            value={formData.startTime}
                                            onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Selesai Pinjam</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="date" required
                                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
                                            value={formData.endDate}
                                            onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                        />
                                        <input
                                            type="time" required
                                            className="w-24 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
                                            value={formData.endTime}
                                            onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tujuan (Lokasi)</label>
                                    <input
                                        type="text" required
                                        placeholder="Contoh: Yogyakarta / Kantor Pusat"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
                                        value={formData.destination}
                                        onChange={e => setFormData({ ...formData, destination: e.target.value })}
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Keperluan</label>
                                    <textarea
                                        required
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
                                        rows={3}
                                        value={formData.purpose}
                                        onChange={e => setFormData({ ...formData, purpose: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Jumlah Penumpang</label>
                                    <input
                                        type="number" min="1" required
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
                                        value={formData.passengerCount}
                                        onChange={e => setFormData({ ...formData, passengerCount: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Pilih Driver</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
                                        value={formData.driverId}
                                        onChange={e => setFormData({ ...formData, driverId: e.target.value })}
                                    >
                                        <option value="">Bawa Sendiri</option>
                                        {staff.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                            >
                                {submitting ? 'Mengirim...' : <><LogIn size={18} /> Kirim Request</>}
                            </button>
                        </form>
                    </div>
                )}

                {activeTab === 'APPROVAL' && (
                    <div className="overflow-x-auto">
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
                                {loading ? (
                                    <tr><td colSpan="4" className="p-10 text-center text-slate-400">Memuat data...</td></tr>
                                ) : bookings.length === 0 ? (
                                    <tr><td colSpan="4" className="p-10 text-center text-slate-400">Tidak ada permohonan tertunda.</td></tr>
                                ) : bookings.map(b => (
                                    <tr key={b.id} className="hover:bg-slate-50/50">
                                        <td className="px-6 py-4">
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
                                                <button
                                                    onClick={() => handleAction(b.id, 'APPROVED')}
                                                    className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-bold hover:bg-green-600 hover:text-white transition-all"
                                                >
                                                    Setujui
                                                </button>
                                                <button
                                                    onClick={() => setShowActionModal({ type: 'REJECT', data: b })}
                                                    className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-600 hover:text-white transition-all"
                                                >
                                                    Tolak
                                                </button>
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
                )}

                {activeTab === 'MY_REQUESTS' && (
                    <div className="overflow-x-auto">
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
                                {loading ? (
                                    <tr><td colSpan="5" className="p-10 text-center text-slate-400">Memuat data...</td></tr>
                                ) : bookings.length === 0 ? (
                                    <tr><td colSpan="5" className="p-10 text-center text-slate-400">Belum ada permohonan.</td></tr>
                                ) : bookings.map(b => (
                                    <tr key={b.id} className="hover:bg-slate-50/50">
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
                                                        onClick={() => setShowActionModal({ type: 'START', data: b })}
                                                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:shadow-lg transition-all flex items-center gap-1"
                                                    >
                                                        <LogIn size={14} /> Start Trip
                                                    </button>
                                                )}
                                                {b.status === 'APPROVED' && b.startKm && (
                                                    <button
                                                        onClick={() => setShowActionModal({ type: 'END', data: b })}
                                                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:shadow-lg transition-all flex items-center gap-1"
                                                    >
                                                        <LogOut size={14} /> End Trip
                                                    </button>
                                                )}
                                                {b.status === 'PENDING' && (
                                                    <button
                                                        onClick={() => handleCancel(b.id)}
                                                        className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'HISTORY' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-600 text-xs font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Peminjam</th>
                                    <th className="px-6 py-4">Unit</th>
                                    <th className="px-6 py-4">Armada</th>
                                    <th className="px-6 py-4">Waktu & Tujuan</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr><td colSpan="6" className="p-10 text-center text-slate-400">Memuat data...</td></tr>
                                ) : bookings.length === 0 ? (
                                    <tr><td colSpan="6" className="p-10 text-center text-slate-400">Belum ada riwayat.</td></tr>
                                ) : bookings.map(b => (
                                    <tr key={b.id} className="hover:bg-slate-50/50">
                                        <td className="px-6 py-4 font-bold text-slate-700">{b.user.name}</td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] font-bold uppercase">
                                                {b.user.unit?.name || 'UMUM'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-700">{b.vehicle.name}</div>
                                            <div className="text-[10px] text-slate-400 font-mono italic">{b.vehicle.plateNumber}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs text-slate-600">{new Date(b.startDate).toLocaleDateString('id-ID')}</div>
                                            <div className="text-xs text-blue-600 mt-1 truncate max-w-[150px]">{b.destination}</div>
                                        </td>
                                        <td className="px-6 py-4">{getStatusBadge(b.status)}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    onClick={() => setShowDetailModal(b)}
                                                    className="p-1.5 text-slate-400 hover:text-blue-600"
                                                >
                                                    <Info size={18} />
                                                </button>
                                                {isSuperAdmin && (
                                                    <button
                                                        onClick={() => handleCancel(b.id)}
                                                        className="p-1.5 text-red-300 hover:text-red-500"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Action Modals */}
            {showActionModal && (
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
                                        <div className="animate-in slide-in-from-top-2 duration-200">
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Biaya Pengisian BBM</label>
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
            )}

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
        </div>
    );
};

export default VehicleBooking;
