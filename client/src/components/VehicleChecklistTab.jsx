import React, { useState, useEffect, useMemo } from 'react';
import { 
    CheckCircle2, 
    AlertCircle, 
    Save, 
    RefreshCw, 
    Calendar, 
    Clock, 
    Filter, 
    Plus, 
    X, 
    ChevronDown, 
    ChevronUp, 
    CheckSquare, 
    Square, 
    Search,
    Car,
    UserCheck,
    Wrench,
    ShieldAlert,
    FileText,
    History,
    LayoutDashboard,
    ArrowRight,
    Sparkles,
    ShieldCheck,
    AlertTriangle,
    Eye
} from 'lucide-react';
import api from '../lib/axios';

const DAILY_ITEMS = [
    'Kebersihan Eksterior', 
    'Kebersihan Interior', 
    'Tekanan Ban', 
    'Lampu Utama', 
    'Lampu Sein & Rem', 
    'Indikator Dashboard', 
    'Wiper & Air Washer', 
    'Cek Oli Mesin', 
    'Cek Air Radiator', 
    'Cek Minyak Rem'
];

const WEEKLY_ITEMS = [
    'Cek Air Aki', 
    'Cek Minyak Power Steering', 
    'Tekanan Ban Serep', 
    'Fungsi Klakson', 
    'Cek Sabuk Pengaman'
];

const MONTHLY_ITEMS = [
    'Cek Kampas Rem', 
    'Cek Filter Udara', 
    'Cek Filter AC', 
    'Ketebalan Ban', 
    'Cek Tali Kipas (Fan Belt)'
];

export default function VehicleChecklistTab({ vehicles = [], currentUserProfile, isAdmin }) {
    const [checklists, setChecklists] = useState([]);
    const [missingSummary, setMissingSummary] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState('READINESS'); // 'READINESS' | 'HISTORY'
    const [showForm, setShowForm] = useState(false);
    const [triggeringAudit, setTriggeringAudit] = useState(false);
    
    // Filters & Search for History Table
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [filterVehicle, setFilterVehicle] = useState('ALL');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [page, setPage] = useState(1);
    const itemsPerPage = 15;

    // Detail Modal State
    const [selectedChecklist, setSelectedChecklist] = useState(null);

    // Form State
    const [formVehicleId, setFormVehicleId] = useState('');
    const [formType, setFormType] = useState('DAILY');
    const [formItems, setFormItems] = useState({});
    const [formStatus, setFormStatus] = useState('SIAP JALAN');
    const [formNotes, setFormNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchChecklists();
        fetchMissingSummary();
    }, []);

    const fetchChecklists = async () => {
        try {
            setLoading(true);
            const res = await api.get('/vehicle-checklists');
            setChecklists(res.data || []);
        } catch (error) {
            console.error('Failed to fetch checklists:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMissingSummary = async () => {
        try {
            const res = await api.get('/vehicle-checklists/summary/missing');
            setMissingSummary(res.data || []);
        } catch (error) {
            console.error('Failed to fetch missing checklist summary:', error);
        }
    };

    const handleTriggerAudit = async () => {
        try {
            setTriggeringAudit(true);
            const res = await api.post('/vehicle-checklists/audit/trigger');
            alert(res.data.message || 'Audit berhasil dijalankan! 1 Pesan ringkasan telah dikirim.');
            fetchMissingSummary();
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal menjalankan audit');
        } finally {
            setTriggeringAudit(false);
        }
    };

    // Open form with a pre-selected vehicle
    const handleOpenFormForVehicle = (vehicleId, defaultType = 'DAILY') => {
        setFormVehicleId(vehicleId.toString());
        setFormType(defaultType);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Initialize items when formType changes
    useEffect(() => {
        const items = formType === 'DAILY' ? DAILY_ITEMS : formType === 'WEEKLY' ? WEEKLY_ITEMS : MONTHLY_ITEMS;
        const initial = {};
        items.forEach(item => {
            initial[item] = false;
        });
        setFormItems(initial);
        setFormStatus('SIAP JALAN');
    }, [formType]);

    // Check all / uncheck all helpers
    const handleCheckAll = (checked) => {
        const updated = {};
        Object.keys(formItems).forEach(key => {
            updated[key] = checked;
        });
        setFormItems(updated);
        setFormStatus(checked ? 'SIAP JALAN' : 'PERLU PERBAIKAN');
    };

    const handleToggleItem = (itemKey) => {
        const nextVal = !formItems[itemKey];
        const updated = { ...formItems, [itemKey]: nextVal };
        setFormItems(updated);

        const allChecked = Object.values(updated).every(Boolean);
        if (!allChecked && formStatus === 'SIAP JALAN') {
            setFormStatus('PERLU PERBAIKAN');
        } else if (allChecked) {
            setFormStatus('SIAP JALAN');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formVehicleId) {
            alert('Silakan pilih armada kendaraan terlebih dahulu!');
            return;
        }
        
        try {
            setSubmitting(true);
            const payload = {
                vehicleId: parseInt(formVehicleId),
                type: formType,
                checks: formItems,
                status: formStatus,
                notes: formNotes.trim() || null
            };

            await api.post('/vehicle-checklists', payload);
            
            alert('Laporan ceklis kendaraan berhasil disimpan!');
            setShowForm(false);
            setFormVehicleId('');
            setFormNotes('');
            fetchChecklists();
            fetchMissingSummary();
        } catch (error) {
            console.error('Submit checklist error:', error);
            alert(error.response?.data?.error || 'Gagal menyimpan ceklis kendaraan');
        } finally {
            setSubmitting(false);
        }
    };

    // Calculate Latest Checklist Status for each active vehicle (Readiness Board)
    const fleetReadiness = useMemo(() => {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const weekStart = new Date(todayStart.getTime() - (7 * 24 * 60 * 60 * 1000));
        const monthStart = new Date(todayStart.getTime() - (30 * 24 * 60 * 60 * 1000));

        const activeVehicles = vehicles.filter(v => v.status === 'ACTIVE');

        return activeVehicles.map(v => {
            const vehicleChecks = checklists.filter(c => c.vehicleId === v.id);
            
            // Latest daily check
            const latestDaily = vehicleChecks.find(c => ['DAILY', 'HARIAN'].includes(c.type));
            const isDailyDoneToday = latestDaily && new Date(latestDaily.date || latestDaily.createdAt) >= todayStart;

            // Latest weekly check
            const latestWeekly = vehicleChecks.find(c => ['WEEKLY', 'MINGGUAN'].includes(c.type));
            const isWeeklyDone = latestWeekly && new Date(latestWeekly.date || latestWeekly.createdAt) >= weekStart;

            // Latest monthly check
            const latestMonthly = vehicleChecks.find(c => ['MONTHLY', 'BULANAN'].includes(c.type));
            const isMonthlyDone = latestMonthly && new Date(latestMonthly.date || latestMonthly.createdAt) >= monthStart;

            // Most recent check overall
            const mostRecent = vehicleChecks[0] || null;

            // Missing checklist types
            const missingTypes = [];
            if (v.requireDailyChecklist && !isDailyDoneToday) missingTypes.push('Harian');
            if (v.requireWeeklyChecklist && !isWeeklyDone) missingTypes.push('Mingguan');
            if (v.requireMonthlyChecklist && !isMonthlyDone) missingTypes.push('Bulanan');

            // Overall Readiness
            let readiness = 'READY'; // 'READY' | 'NEEDS_CHECK' | 'REPAIR'
            if (mostRecent && mostRecent.status === 'PERLU PERBAIKAN') {
                readiness = 'REPAIR';
            } else if (missingTypes.length > 0) {
                readiness = 'NEEDS_CHECK';
            } else {
                readiness = 'READY';
            }

            return {
                vehicle: v,
                latestDaily,
                isDailyDoneToday,
                latestWeekly,
                isWeeklyDone,
                latestMonthly,
                isMonthlyDone,
                mostRecent,
                missingTypes,
                readiness
            };
        });
    }, [vehicles, checklists]);

    // KPI Summary
    const stats = useMemo(() => {
        const total = fleetReadiness.length;
        const ready = fleetReadiness.filter(f => f.readiness === 'READY').length;
        const needsCheck = fleetReadiness.filter(f => f.readiness === 'NEEDS_CHECK').length;
        const repair = fleetReadiness.filter(f => f.readiness === 'REPAIR').length;
        return { total, ready, needsCheck, repair };
    }, [fleetReadiness]);

    // Filtered checklists for Table History
    const filteredChecklists = useMemo(() => {
        return checklists.filter(c => {
            if (filterType !== 'ALL' && c.type !== filterType) return false;
            if (filterStatus !== 'ALL' && c.status !== filterStatus) return false;
            if (filterVehicle !== 'ALL' && c.vehicleId.toString() !== filterVehicle) return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const vName = (c.vehicle?.name || '').toLowerCase();
                const vPlate = (c.vehicle?.plateNumber || '').toLowerCase();
                const dName = (c.driver?.name || c.user?.name || '').toLowerCase();
                const notes = (c.notes || '').toLowerCase();
                if (!vName.includes(q) && !vPlate.includes(q) && !dName.includes(q) && !notes.includes(q)) {
                    return false;
                }
            }

            if (startDate && new Date(c.createdAt) < new Date(startDate)) return false;
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                if (new Date(c.createdAt) > end) return false;
            }

            return true;
        });
    }, [checklists, filterType, filterStatus, filterVehicle, searchQuery, startDate, endDate]);

    // Paginated checklists for Table
    const paginatedChecklists = useMemo(() => {
        const start = (page - 1) * itemsPerPage;
        return filteredChecklists.slice(start, start + itemsPerPage);
    }, [filteredChecklists, page]);

    const totalPages = Math.ceil(filteredChecklists.length / itemsPerPage) || 1;

    return (
        <div className="p-4 md:p-6 space-y-6">
            {/* Header section with Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                        <Car size={24} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Manajemen Ceklis Rutin Armada</h2>
                        <p className="text-xs text-slate-500">Monitoring kesiapan operasional & riwayat pemeriksaan berkala.</p>
                    </div>
                </div>

                {!showForm && (
                    <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                        {isAdmin && (
                            <button
                                onClick={handleTriggerAudit}
                                disabled={triggeringAudit}
                                className="flex-1 sm:flex-none bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-2xs disabled:opacity-50"
                                title="Kirim 1 Pesan Ringkasan Notifikasi Audit ke WhatsApp Kepala Bidang & Staf"
                            >
                                <RefreshCw className={triggeringAudit ? 'animate-spin text-amber-600' : 'text-amber-600'} size={15} />
                                {triggeringAudit ? 'Mengaudit...' : 'Audit & Notifikasi (1x)'}
                            </button>
                        )}
                        <button 
                            onClick={() => {
                                setFormVehicleId('');
                                setShowForm(true);
                            }}
                            className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md"
                        >
                            <Plus size={16} /> Isi Laporan Ceklis
                        </button>
                    </div>
                )}
            </div>

            {/* KPI Summary Cards */}
            {!showForm && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <Car size={22} />
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Armada Aktif</p>
                            <p className="text-xl font-black text-slate-800">{stats.total} <span className="text-xs font-normal text-slate-400">Unit</span></p>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                            <ShieldCheck size={22} />
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Siap Jalan (Lengkap)</p>
                            <p className="text-xl font-black text-emerald-600">{stats.ready} <span className="text-xs font-normal text-slate-400">Armada</span></p>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                            <AlertTriangle size={22} />
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Belum Dicek Hari Ini</p>
                            <p className="text-xl font-black text-amber-600">{stats.needsCheck} <span className="text-xs font-normal text-slate-400">Armada</span></p>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                            <Wrench size={22} />
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Perlu Perbaikan</p>
                            <p className="text-xl font-black text-rose-600">{stats.repair} <span className="text-xs font-normal text-slate-400">Armada</span></p>
                        </div>
                    </div>
                </div>
            )}

            {/* View Mode Switcher (Tab Buttons) */}
            {!showForm && (
                <div className="flex border-b border-slate-200 gap-2">
                    <button
                        onClick={() => setActiveView('READINESS')}
                        className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
                            activeView === 'READINESS'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <LayoutDashboard size={16} />
                        Papan Kesiapan Armada (Status Terkini)
                    </button>
                    <button
                        onClick={() => setActiveView('HISTORY')}
                        className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
                            activeView === 'HISTORY'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <History size={16} />
                        Tabel Riwayat Ceklis (Log Lengkap)
                    </button>
                </div>
            )}

            {/* Form Mode */}
            {showForm ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm animate-in slide-in-from-top-4 duration-300">
                    <div className="flex justify-between items-center pb-4 mb-6 border-b border-slate-100">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                                <CheckSquare size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-base">Form Pengisian Ceklis Armada</h3>
                                <p className="text-xs text-slate-500">Pemeriksaan fisik rutin untuk memastikan kelayakan armada.</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setShowForm(false)} 
                            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-rose-500 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Type & Vehicle Selection */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                                    Tipe Pengecekan <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: 'DAILY', label: 'Harian', desc: '10 Item Fisik' },
                                        { id: 'WEEKLY', label: 'Mingguan', desc: '5 Item Tambahan' },
                                        { id: 'MONTHLY', label: 'Bulanan', desc: '5 Item Servis' }
                                    ].map(t => (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => setFormType(t.id)}
                                            className={`p-3 rounded-xl border text-center transition-all ${
                                                formType === t.id 
                                                    ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold shadow-2xs' 
                                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="text-xs">{t.label}</div>
                                            <div className="text-[10px] text-slate-400 font-normal">{t.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                                    Pilih Kendaraan <span className="text-red-500">*</span>
                                </label>
                                <select 
                                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white font-semibold text-slate-700 text-sm"
                                    value={formVehicleId}
                                    onChange={e => setFormVehicleId(e.target.value)}
                                    required
                                >
                                    <option value="">-- Pilih Armada Kendaraan --</option>
                                    {vehicles.filter(v => v.status === 'ACTIVE').map(v => (
                                        <option key={v.id} value={v.id}>{v.name} ({v.plateNumber})</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Checklist Item Grid */}
                        <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200 space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                <div>
                                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                        <CheckSquare size={16} className="text-blue-600" />
                                        Item Pemeriksaan Fisik
                                    </label>
                                    <p className="text-[11px] text-slate-500">Klik item yang kondisinya baik dan berfungsi normal.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleCheckAll(true)}
                                        className="px-2.5 py-1 text-xs font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg transition-colors flex items-center gap-1"
                                    >
                                        <CheckSquare size={13} /> Centang Semua Baik
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleCheckAll(false)}
                                        className="px-2.5 py-1 text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors flex items-center gap-1"
                                    >
                                        <Square size={13} /> Reset
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {Object.keys(formItems).map(item => {
                                    const isOk = formItems[item];
                                    return (
                                        <div
                                            key={item}
                                            onClick={() => handleToggleItem(item)}
                                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer select-none transition-all ${
                                                isOk 
                                                    ? 'bg-emerald-50/70 border-emerald-200/90 shadow-2xs' 
                                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                            }`}
                                        >
                                            <span className={`text-xs font-semibold ${isOk ? 'text-emerald-900' : 'text-slate-700'}`}>
                                                {item}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                                    isOk ? 'bg-emerald-200/80 text-emerald-800' : 'bg-slate-100 text-slate-400'
                                                }`}>
                                                    {isOk ? 'Baik' : 'Bermasalah'}
                                                </span>
                                                <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                                                    isOk ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                                                }`}>
                                                    {isOk && <CheckCircle2 size={14} />}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Status Selection */}
                        <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                                Kesimpulan Kelayakan Armada
                            </label>
                            <div className="grid grid-cols-2 gap-3 max-w-md">
                                <button
                                    type="button"
                                    onClick={() => setFormStatus('SIAP JALAN')}
                                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                                        formStatus === 'SIAP JALAN' 
                                            ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs' 
                                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                    }`}
                                >
                                    <CheckCircle2 size={15} /> SIAP JALAN
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormStatus('PERLU PERBAIKAN')}
                                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                                        formStatus === 'PERLU PERBAIKAN' 
                                            ? 'bg-rose-50 border-rose-500 text-rose-800 shadow-2xs' 
                                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                    }`}
                                >
                                    <Wrench size={15} /> PERLU PERBAIKAN
                                </button>
                            </div>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                                Catatan / Temuan Kendala (Opsional)
                            </label>
                            <textarea 
                                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-slate-700 h-24 resize-none"
                                placeholder="Tuliskan temuan atau kendala fisik armada (misal: klakson mati, tekanan ban depan kurang)..."
                                value={formNotes}
                                onChange={e => setFormNotes(e.target.value)}
                            />
                        </div>

                        {/* Submit Button */}
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition-all"
                            >
                                Batal
                            </button>
                            <button 
                                type="submit" 
                                disabled={submitting}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-7 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-md disabled:opacity-50"
                            >
                                {submitting ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                                Simpan Laporan Ceklis
                            </button>
                        </div>
                    </form>
                </div>
            ) : activeView === 'READINESS' ? (
                /* ── TAB 1: FLEET READINESS BOARD (Clean, Grouped per Vehicle) ── */
                <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <div>
                            <h3 className="font-bold text-slate-800 text-sm">Status Kesiapan Armada Hari Ini</h3>
                            <p className="text-[11px] text-slate-500">Satu baris per kendaraan untuk memantau status ceklis terkini.</p>
                        </div>
                        <span className="text-xs font-semibold text-slate-500">
                            Total: <strong>{fleetReadiness.length} Armada</strong>
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200/80 uppercase text-[10px] tracking-wider">
                                    <th className="p-3.5 pl-4">Armada & Plat Nomor</th>
                                    <th className="p-3.5">Penanggung Jawab (PJ)</th>
                                    <th className="p-3.5">Ceklis Harian</th>
                                    <th className="p-3.5">Ceklis Mingguan</th>
                                    <th className="p-3.5">Status Terkini</th>
                                    <th className="p-3.5 text-right pr-4">Aksi Cepat</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {fleetReadiness.map(({ vehicle, latestDaily, isDailyDoneToday, latestWeekly, isWeeklyDone, mostRecent, missingTypes, readiness }) => {
                                    return (
                                        <tr key={vehicle.id} className="hover:bg-slate-50/80 transition-colors">
                                            {/* Vehicle name & Plate */}
                                            <td className="p-3.5 pl-4">
                                                <div className="font-bold text-slate-800 text-sm">{vehicle.name}</div>
                                                <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold inline-block mt-0.5">
                                                    {vehicle.plateNumber}
                                                </span>
                                            </td>

                                            {/* Responsible Person */}
                                            <td className="p-3.5 text-slate-600">
                                                <div className="flex items-center gap-1.5">
                                                    <UserCheck size={14} className="text-slate-400 shrink-0" />
                                                    <span className="font-medium truncate max-w-[150px]">
                                                        {vehicle.pics?.map(p => p.name).join(', ') || <span className="text-slate-400 italic">Belum Ditentukan</span>}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Daily Checklist Status */}
                                            <td className="p-3.5">
                                                {!vehicle.requireDailyChecklist ? (
                                                    <span className="text-slate-400 text-[11px] italic">Tidak Wajib</span>
                                                ) : isDailyDoneToday ? (
                                                    <div>
                                                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                                                            <CheckCircle2 size={12} /> Sudah Hari Ini
                                                        </span>
                                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                                            {new Date(latestDaily.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} • {latestDaily.driver?.name || 'Petugas'}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                                                            <AlertCircle size={12} /> Belum Hari Ini
                                                        </span>
                                                        {latestDaily && (
                                                            <div className="text-[10px] text-slate-400 mt-0.5">
                                                                Terakhir: {new Date(latestDaily.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Weekly Checklist Status */}
                                            <td className="p-3.5">
                                                {!vehicle.requireWeeklyChecklist ? (
                                                    <span className="text-slate-400 text-[11px] italic">Tidak Wajib</span>
                                                ) : isWeeklyDone ? (
                                                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                                                        <CheckCircle2 size={12} /> Minggu Ini OK
                                                    </span>
                                                ) : (
                                                    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                                                        <AlertCircle size={12} /> Belum Minggu Ini
                                                    </span>
                                                )}
                                            </td>

                                            {/* Overall Status Badge */}
                                            <td className="p-3.5">
                                                {readiness === 'REPAIR' ? (
                                                    <div>
                                                        <span className="bg-rose-100 text-rose-800 text-[10px] font-extrabold px-2.5 py-1 rounded-lg inline-flex items-center gap-1">
                                                            <Wrench size={12} /> PERLU PERBAIKAN
                                                        </span>
                                                        {mostRecent?.notes && (
                                                            <div className="text-[10px] text-rose-700 font-medium truncate max-w-[150px] mt-0.5" title={mostRecent.notes}>
                                                                "{mostRecent.notes}"
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : readiness === 'READY' ? (
                                                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-1 rounded-lg inline-flex items-center gap-1">
                                                        <CheckCircle2 size={12} /> SIAP JALAN
                                                    </span>
                                                ) : (
                                                    <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2.5 py-1 rounded-lg inline-flex items-center gap-1">
                                                        <AlertCircle size={12} /> PERLU CEKLIS
                                                    </span>
                                                )}
                                            </td>

                                            {/* Action Buttons */}
                                            <td className="p-3.5 text-right pr-4">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => handleOpenFormForVehicle(vehicle.id, 'DAILY')}
                                                        className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-xs transition-colors inline-flex items-center gap-1"
                                                        title="Isi Ceklis Harian"
                                                    >
                                                        <Plus size={13} /> Isi Ceklis
                                                    </button>
                                                    {mostRecent && (
                                                        <button
                                                            onClick={() => setSelectedChecklist(mostRecent)}
                                                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors"
                                                            title="Lihat Ceklis Terakhir"
                                                        >
                                                            <Eye size={15} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* ── TAB 2: HISTORY LOG TABLE (Compact & Searchable Data Table) ── */
                <div className="space-y-4">
                    {/* Filters Toolbar */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-wrap items-center gap-3">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3.5 top-3 text-slate-400" size={15} />
                            <input 
                                type="text"
                                className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Cari armada, plat nomor, driver, atau catatan..."
                                value={searchQuery}
                                onChange={e => {
                                    setSearchQuery(e.target.value);
                                    setPage(1);
                                }}
                            />
                        </div>

                        {/* Type Filter */}
                        <select 
                            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500"
                            value={filterType}
                            onChange={e => {
                                setFilterType(e.target.value);
                                setPage(1);
                            }}
                        >
                            <option value="ALL">Semua Tipe Ceklis</option>
                            <option value="DAILY">Harian</option>
                            <option value="WEEKLY">Mingguan</option>
                            <option value="MONTHLY">Bulanan</option>
                        </select>

                        {/* Status Filter */}
                        <select 
                            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500"
                            value={filterStatus}
                            onChange={e => {
                                setFilterStatus(e.target.value);
                                setPage(1);
                            }}
                        >
                            <option value="ALL">Semua Status</option>
                            <option value="SIAP JALAN">Siap Jalan</option>
                            <option value="PERLU PERBAIKAN">Perlu Perbaikan</option>
                        </select>

                        {/* Vehicle Filter */}
                        <select 
                            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500 max-w-[180px]"
                            value={filterVehicle}
                            onChange={e => {
                                setFilterVehicle(e.target.value);
                                setPage(1);
                            }}
                        >
                            <option value="ALL">Semua Armada</option>
                            {vehicles.map(v => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                        </select>

                        {/* Date Range */}
                        <div className="flex items-center gap-1.5">
                            <input 
                                type="date" 
                                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-600 outline-none focus:ring-2 focus:ring-blue-500"
                                value={startDate}
                                onChange={e => {
                                    setStartDate(e.target.value);
                                    setPage(1);
                                }}
                            />
                            <span className="text-slate-400 text-xs font-bold">-</span>
                            <input 
                                type="date" 
                                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-600 outline-none focus:ring-2 focus:ring-blue-500"
                                value={endDate}
                                onChange={e => {
                                    setEndDate(e.target.value);
                                    setPage(1);
                                }}
                            />
                        </div>

                        {/* Reset Filter Button */}
                        {(filterType !== 'ALL' || filterStatus !== 'ALL' || filterVehicle !== 'ALL' || searchQuery || startDate || endDate) && (
                            <button 
                                onClick={() => {
                                    setFilterType('ALL');
                                    setFilterStatus('ALL');
                                    setFilterVehicle('ALL');
                                    setSearchQuery('');
                                    setStartDate('');
                                    setEndDate('');
                                    setPage(1);
                                }}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-xl transition-colors flex items-center gap-1 text-xs font-bold"
                                title="Reset Filter"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Table View */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-16">
                                <RefreshCw className="animate-spin text-blue-500 mb-2" size={24} />
                                <p className="text-xs font-semibold text-slate-400">Memuat data riwayat ceklis...</p>
                            </div>
                        ) : paginatedChecklists.length === 0 ? (
                            <div className="text-center py-16 space-y-2">
                                <FileText className="mx-auto text-slate-300" size={32} />
                                <h4 className="text-sm font-bold text-slate-600">Tidak ada riwayat ceklis</h4>
                                <p className="text-xs text-slate-400">Belum ada pemeriksaan sesuai filter yang dipilih.</p>
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200/80 uppercase text-[10px] tracking-wider">
                                                <th className="p-3.5 pl-4">Waktu Input</th>
                                                <th className="p-3.5">Armada & Plat</th>
                                                <th className="p-3.5">Tipe Ceklis</th>
                                                <th className="p-3.5">Status Kelayakan</th>
                                                <th className="p-3.5">Hasil Pemeriksaan</th>
                                                <th className="p-3.5">Catatan Masalah</th>
                                                <th className="p-3.5">Driver / Petugas</th>
                                                <th className="p-3.5 text-right pr-4">Detail</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {paginatedChecklists.map(c => {
                                                const checksData = c.checks || c.items || {};
                                                const checkedCount = Object.values(checksData).filter(Boolean).length;
                                                const totalCount = Object.keys(checksData).length;
                                                const isReady = c.status === 'SIAP JALAN';

                                                return (
                                                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                                                        {/* Timestamp */}
                                                        <td className="p-3.5 pl-4 text-slate-600 whitespace-nowrap">
                                                            <div className="font-semibold text-slate-800">
                                                                {new Date(c.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400">
                                                                {new Date(c.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                                                            </div>
                                                        </td>

                                                        {/* Vehicle */}
                                                        <td className="p-3.5 whitespace-nowrap">
                                                            <div className="font-bold text-slate-800">{c.vehicle?.name}</div>
                                                            <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-semibold">
                                                                {c.vehicle?.plateNumber}
                                                            </span>
                                                        </td>

                                                        {/* Type */}
                                                        <td className="p-3.5 whitespace-nowrap">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                                c.type === 'DAILY' ? 'bg-blue-50 text-blue-700 border border-blue-200/60' : 
                                                                c.type === 'WEEKLY' ? 'bg-orange-50 text-orange-700 border border-orange-200/60' : 
                                                                'bg-purple-50 text-purple-700 border border-purple-200/60'
                                                            }`}>
                                                                {c.type === 'DAILY' ? 'Harian' : c.type === 'WEEKLY' ? 'Mingguan' : 'Bulanan'}
                                                            </span>
                                                        </td>

                                                        {/* Status */}
                                                        <td className="p-3.5 whitespace-nowrap">
                                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 ${
                                                                isReady ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                                            }`}>
                                                                {isReady ? <CheckCircle2 size={12} /> : <Wrench size={12} />}
                                                                {c.status || (checkedCount === totalCount ? 'SIAP JALAN' : 'PERLU PERBAIKAN')}
                                                            </span>
                                                        </td>

                                                        {/* Items checked */}
                                                        <td className="p-3.5 whitespace-nowrap">
                                                            <span className={`font-semibold ${checkedCount === totalCount ? 'text-emerald-700' : 'text-amber-700'}`}>
                                                                {checkedCount}/{totalCount} Item OK
                                                            </span>
                                                        </td>

                                                        {/* Notes */}
                                                        <td className="p-3.5 max-w-[200px]">
                                                            {c.notes ? (
                                                                <span className="text-[11px] text-amber-800 bg-amber-50 px-2 py-1 rounded-md border border-amber-100 line-clamp-1 block" title={c.notes}>
                                                                    {c.notes}
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-400 italic text-[11px]">-</span>
                                                            )}
                                                        </td>

                                                        {/* Driver */}
                                                        <td className="p-3.5 text-slate-700 font-medium whitespace-nowrap">
                                                            {c.driver?.name || c.user?.name || 'Petugas'}
                                                        </td>

                                                        {/* Action */}
                                                        <td className="p-3.5 text-right pr-4 whitespace-nowrap">
                                                            <button
                                                                onClick={() => setSelectedChecklist(c)}
                                                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                                                            >
                                                                Lihat Detail
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="p-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
                                        <span>
                                            Menampilkan {(page - 1) * itemsPerPage + 1} - {Math.min(page * itemsPerPage, filteredChecklists.length)} dari {filteredChecklists.length} data
                                        </span>
                                        <div className="flex gap-1">
                                            <button
                                                disabled={page === 1}
                                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                                className="px-2.5 py-1 border border-slate-200 rounded-lg bg-white disabled:opacity-40 font-bold hover:bg-slate-50"
                                            >
                                                Sebelumnya
                                            </button>
                                            <span className="px-2.5 py-1 font-bold text-slate-700">
                                                {page} / {totalPages}
                                            </span>
                                            <button
                                                disabled={page === totalPages}
                                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                                className="px-2.5 py-1 border border-slate-200 rounded-lg bg-white disabled:opacity-40 font-bold hover:bg-slate-50"
                                            >
                                                Selanjutnya
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Checklist Detail Modal */}
            {selectedChecklist && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200" onClick={() => setSelectedChecklist(null)}>
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                            <div>
                                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                                    <Car size={18} className="text-blue-600" />
                                    Detail Pemeriksaan Armada
                                </h3>
                                <p className="text-xs text-slate-500 font-medium">
                                    {selectedChecklist.vehicle?.name} ({selectedChecklist.vehicle?.plateNumber})
                                </p>
                            </div>
                            <button onClick={() => setSelectedChecklist(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>
                        
                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-5">
                            {/* Summary Metadata Cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Tipe Ceklis</p>
                                    <p className="font-bold text-xs text-slate-800">
                                        {selectedChecklist.type === 'DAILY' ? 'Harian' : selectedChecklist.type === 'WEEKLY' ? 'Mingguan' : 'Bulanan'}
                                    </p>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Status Kelayakan</p>
                                    <p className={`font-bold text-xs ${selectedChecklist.status === 'SIAP JALAN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {selectedChecklist.status || 'SIAP JALAN'}
                                    </p>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Pelapor / Driver</p>
                                    <p className="font-bold text-xs text-slate-800 truncate">
                                        {selectedChecklist.driver?.name || selectedChecklist.user?.name || 'Petugas'}
                                    </p>
                                </div>
                            </div>

                            {/* Inspection Items */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 pb-1 border-b border-slate-100 flex items-center justify-between">
                                    <span>Rincian Item Pemeriksaan</span>
                                    {(() => {
                                        const checksData = selectedChecklist.checks || selectedChecklist.items || {};
                                        const okCount = Object.values(checksData).filter(Boolean).length;
                                        const total = Object.keys(checksData).length;
                                        return (
                                            <span className={okCount === total ? 'text-emerald-600' : 'text-amber-600'}>
                                                {okCount}/{total} Item Sesuai Standar
                                            </span>
                                        );
                                    })()}
                                </h4>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {Object.entries(selectedChecklist.checks || selectedChecklist.items || {}).map(([key, value]) => (
                                        <div 
                                            key={key} 
                                            className={`flex justify-between items-center text-xs p-2.5 rounded-xl border ${
                                                value ? 'bg-emerald-50/60 border-emerald-100 text-emerald-900' : 'bg-rose-50/60 border-rose-100 text-rose-900'
                                            }`}
                                        >
                                            <span className="font-semibold">{key}</span>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                                    value ? 'bg-emerald-200/70 text-emerald-800' : 'bg-rose-200/70 text-rose-800'
                                                }`}>
                                                    {value ? 'Baik' : 'Bermasalah'}
                                                </span>
                                                {value ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-rose-600" />}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Notes */}
                            {selectedChecklist.notes && (
                                <div>
                                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Catatan Tambahan</h4>
                                    <div className="bg-amber-50/80 p-3.5 rounded-xl border border-amber-200/80 text-amber-900 text-xs leading-relaxed">
                                        {selectedChecklist.notes}
                                    </div>
                                </div>
                            )}

                            {/* Timestamp */}
                            <div className="text-[11px] text-slate-400 text-right pt-2 border-t border-slate-100">
                                Dilaporkan pada {new Date(selectedChecklist.createdAt).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
