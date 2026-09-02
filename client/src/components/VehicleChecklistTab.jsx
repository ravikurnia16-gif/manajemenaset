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
    Fuel, 
    CheckSquare, 
    Square, 
    Search,
    Car,
    UserCheck,
    Wrench,
    ShieldAlert,
    FileText,
    TrendingUp
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

const FUEL_OPTIONS = ['E (Kosong)', '1/4', '1/2', '3/4', 'F (Penuh)'];

export default function VehicleChecklistTab({ vehicles = [], currentUserProfile, isAdmin }) {
    const [checklists, setChecklists] = useState([]);
    const [missingSummary, setMissingSummary] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [triggeringAudit, setTriggeringAudit] = useState(false);
    const [isBannerExpanded, setIsBannerExpanded] = useState(false);
    
    // Filters & Search
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [filterVehicle, setFilterVehicle] = useState('ALL');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Detail Modal State
    const [selectedChecklist, setSelectedChecklist] = useState(null);

    // Form State
    const [formVehicleId, setFormVehicleId] = useState('');
    const [formType, setFormType] = useState('DAILY');
    const [formItems, setFormItems] = useState({});
    const [formFuelLevel, setFormFuelLevel] = useState('1/2');
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
            alert(res.data.message || 'Audit berhasil dijalankan! Pesan ringkasan telah dikirim.');
            fetchMissingSummary();
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal menjalankan audit');
        } finally {
            setTriggeringAudit(false);
        }
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
        
        if (formVehicleId) {
            const v = vehicles.find(v => v.id.toString() === formVehicleId.toString());
            if (v) {
                if (formType === 'DAILY' && !v.requireDailyChecklist) setFormVehicleId('');
                else if (formType === 'WEEKLY' && !v.requireWeeklyChecklist) setFormVehicleId('');
                else if (formType === 'MONTHLY' && !v.requireMonthlyChecklist) setFormVehicleId('');
            }
        }
    }, [formType, vehicles]);

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

        // Auto update status suggestion if any item is false
        const allChecked = Object.values(updated).every(Boolean);
        if (!allChecked && formStatus === 'SIAP JALAN') {
            // suggest needing repair if an item is broken
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
                fuelLevel: formFuelLevel,
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

    // Filtered checklists
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

    // KPI Summary
    const stats = useMemo(() => {
        const total = checklists.length;
        const ready = checklists.filter(c => c.status === 'SIAP JALAN').length;
        const needRepair = checklists.filter(c => c.status === 'PERLU PERBAIKAN').length;
        const missingCount = missingSummary.length;
        return { total, ready, needRepair, missingCount };
    }, [checklists, missingSummary]);

    return (
        <div className="p-4 md:p-6 space-y-6">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                            <Car size={22} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">Ceklis Rutin Armada Kendaraan</h2>
                            <p className="text-xs text-slate-500">Pengecekan kondisi berkala: Harian, Mingguan, dan Bulanan.</p>
                        </div>
                    </div>
                </div>

                {!showForm && (
                    <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                        {isAdmin && (
                            <button
                                onClick={handleTriggerAudit}
                                disabled={triggeringAudit}
                                className="flex-1 sm:flex-none bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-2xs disabled:opacity-50"
                                title="Kirim notifikasi ringkasan 1 kali ke Kepala Bidang Sarana & Staf"
                            >
                                <RefreshCw className={triggeringAudit ? 'animate-spin text-amber-600' : 'text-amber-600'} size={15} />
                                {triggeringAudit ? 'Mengaudit...' : 'Kirim Ringkasan Audit'}
                            </button>
                        )}
                        <button 
                            onClick={() => setShowForm(true)}
                            className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md"
                        >
                            <Plus size={16} /> Isi Ceklis Baru
                        </button>
                    </div>
                )}
            </div>

            {/* KPI Statistics Bar */}
            {!showForm && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <FileText size={20} />
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Ceklis</p>
                            <p className="text-lg font-extrabold text-slate-800">{stats.total}</p>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                            <CheckCircle2 size={20} />
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Siap Jalan</p>
                            <p className="text-lg font-extrabold text-emerald-600">{stats.ready}</p>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                            <Wrench size={20} />
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Perlu Perbaikan</p>
                            <p className="text-lg font-extrabold text-rose-600">{stats.needRepair}</p>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                            <ShieldAlert size={20} />
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Belum Ceklis</p>
                            <p className="text-lg font-extrabold text-amber-600">{stats.missingCount} Armada</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Warning Banner for Missing Checklists (Collapsible) */}
            {!showForm && missingSummary.length > 0 && (
                <div className="bg-gradient-to-r from-amber-50/90 via-orange-50/70 to-amber-50/90 border border-amber-200/90 rounded-2xl overflow-hidden shadow-xs transition-all duration-300">
                    <div 
                        onClick={() => setIsBannerExpanded(!isBannerExpanded)}
                        className="px-4 py-3.5 flex items-center justify-between cursor-pointer hover:bg-amber-100/40 transition-colors select-none"
                    >
                        <div className="flex items-center gap-3">
                            <span className="flex h-3 w-3 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                            </span>
                            <div>
                                <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                                    <AlertCircle size={16} className="text-amber-600 shrink-0" />
                                    {missingSummary.length} Armada Memerlukan Pengisian Ceklis Rutin
                                </span>
                                <span className="text-[11px] text-amber-800/80 hidden sm:inline-block">
                                    Ringkasan notifikasi terkirim 1 kali ke Kepala Bidang Sarana & Tim Kendaraan.
                                </span>
                            </div>
                        </div>

                        <button className="text-xs font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 bg-amber-200/60 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors">
                            {isBannerExpanded ? 'Tutup Rincian' : 'Lihat Rincian'}
                            {isBannerExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    </div>

                    {isBannerExpanded && (
                        <div className="p-4 pt-2 border-t border-amber-200/60 bg-white/70 backdrop-blur-xs animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {missingSummary.map(item => (
                                    <div key={item.id} className="bg-white border border-amber-200/80 p-3.5 rounded-xl shadow-2xs hover:border-amber-300 transition-all">
                                        <div className="font-bold text-slate-800 text-xs flex justify-between items-center mb-1">
                                            <span className="truncate pr-2">{item.name}</span>
                                            <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold shrink-0">{item.plateNumber}</span>
                                        </div>
                                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mb-2">
                                            <UserCheck size={13} className="text-slate-400 shrink-0" />
                                            <span className="truncate">PJ: <strong className="text-slate-700">{item.pics?.map(p => p.name).join(', ') || 'Belum Ditentukan'}</strong></span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {item.missingTypes.map((m, idx) => (
                                                <span key={idx} className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                                    Belum Ceklis {m.label}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
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
                                <p className="text-xs text-slate-500">Isi seluruh item pemeriksaan fisik kendaraan secara cermat.</p>
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
                                        { id: 'DAILY', label: 'Harian', desc: '10 Item' },
                                        { id: 'WEEKLY', label: 'Mingguan', desc: '5 Item' },
                                        { id: 'MONTHLY', label: 'Bulanan', desc: '5 Item' }
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
                                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white font-medium text-slate-700 text-sm"
                                    value={formVehicleId}
                                    onChange={e => setFormVehicleId(e.target.value)}
                                    required
                                >
                                    <option value="">-- Pilih Armada Kendaraan --</option>
                                    {vehicles.filter(v => {
                                        if (v.status !== 'ACTIVE') return false;
                                        if (formType === 'DAILY' && !v.requireDailyChecklist) return false;
                                        if (formType === 'WEEKLY' && !v.requireWeeklyChecklist) return false;
                                        if (formType === 'MONTHLY' && !v.requireMonthlyChecklist) return false;
                                        return true;
                                    }).map(v => (
                                        <option key={v.id} value={v.id}>{v.name} ({v.plateNumber})</option>
                                    ))}
                                </select>
                                <p className="text-[11px] text-slate-400 mt-1 italic">
                                    * Menampilkan armada yang memiliki kewajiban ceklis {formType === 'DAILY' ? 'Harian' : formType === 'WEEKLY' ? 'Mingguan' : 'Bulanan'}.
                                </p>
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
                                    <p className="text-[11px] text-slate-500">Centang item yang kondisinya baik dan berfungsi normal.</p>
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

                        {/* Fuel Level & Status */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <Fuel size={14} className="text-amber-500" />
                                    Level Bahan Bakar (BBM)
                                </label>
                                <div className="grid grid-cols-5 gap-1.5">
                                    {FUEL_OPTIONS.map(opt => (
                                        <button
                                            key={opt}
                                            type="button"
                                            onClick={() => setFormFuelLevel(opt)}
                                            className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all text-center ${
                                                formFuelLevel === opt 
                                                    ? 'bg-amber-50 border-amber-400 text-amber-900 shadow-2xs' 
                                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                                    Kesimpulan Kondisi Armada
                                </label>
                                <div className="grid grid-cols-2 gap-2">
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
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                                Catatan / Temuan Kerusakan (Opsional)
                            </label>
                            <textarea 
                                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-slate-700 h-24 resize-none"
                                placeholder="Tuliskan temuan atau kendala fisik armada (misal: klakson mati, ban depan kanan kurang angin)..."
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
            ) : (
                /* List & Filter Section */
                <div className="space-y-4">
                    {/* Filters Toolbar */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-wrap items-center gap-3">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3.5 top-3 text-slate-400" size={15} />
                            <input 
                                type="text"
                                className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Cari nama armada, plat nomor, atau driver..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {/* Type Filter */}
                        <select 
                            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500"
                            value={filterType}
                            onChange={e => setFilterType(e.target.value)}
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
                            onChange={e => setFilterStatus(e.target.value)}
                        >
                            <option value="ALL">Semua Status</option>
                            <option value="SIAP JALAN">Siap Jalan</option>
                            <option value="PERLU PERBAIKAN">Perlu Perbaikan</option>
                        </select>

                        {/* Vehicle Filter */}
                        <select 
                            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500 max-w-[180px]"
                            value={filterVehicle}
                            onChange={e => setFilterVehicle(e.target.value)}
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
                                onChange={e => setStartDate(e.target.value)}
                            />
                            <span className="text-slate-400 text-xs font-bold">-</span>
                            <input 
                                type="date" 
                                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-600 outline-none focus:ring-2 focus:ring-blue-500"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
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
                                }}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-xl transition-colors flex items-center gap-1 text-xs font-bold"
                                title="Reset Filter"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Checklists Feed */}
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-100">
                            <RefreshCw className="animate-spin text-blue-500 mb-2" size={28} />
                            <p className="text-xs font-semibold text-slate-400">Memuat riwayat ceklis armada...</p>
                        </div>
                    ) : filteredChecklists.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-xs space-y-3">
                            <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-300 flex items-center justify-center mx-auto">
                                <Car size={24} />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-slate-700">Tidak ada data ceklis</h4>
                                <p className="text-xs text-slate-400">Belum ada riwayat pengecekan armada sesuai filter yang dipilih.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredChecklists.map(c => {
                                const checksData = c.checks || c.items || {};
                                const checkedCount = Object.values(checksData).filter(Boolean).length;
                                const totalCount = Object.keys(checksData).length;
                                const isPerfect = totalCount > 0 && checkedCount === totalCount;
                                const isReady = c.status === 'SIAP JALAN';

                                return (
                                    <div 
                                        key={c.id} 
                                        onClick={() => setSelectedChecklist(c)}
                                        className="bg-white border border-slate-100 rounded-2xl p-4.5 hover:shadow-md hover:border-slate-200 transition-all cursor-pointer relative overflow-hidden group flex flex-col justify-between"
                                    >
                                        {/* Status indicator bar */}
                                        <div className={`absolute top-0 left-0 w-1.5 h-full ${
                                            isReady ? 'bg-emerald-500' : 'bg-rose-500'
                                        }`} />

                                        <div>
                                            {/* Header */}
                                            <div className="flex justify-between items-start mb-2.5 pl-2">
                                                <div>
                                                    <h4 className="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors line-clamp-1">
                                                        {c.vehicle?.name}
                                                    </h4>
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold">
                                                            {c.vehicle?.plateNumber}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                                            c.type === 'DAILY' ? 'bg-blue-50 text-blue-700 border border-blue-200/60' : 
                                                            c.type === 'WEEKLY' ? 'bg-orange-50 text-orange-700 border border-orange-200/60' : 
                                                            'bg-purple-50 text-purple-700 border border-purple-200/60'
                                                        }`}>
                                                            {c.type === 'DAILY' ? 'Harian' : c.type === 'WEEKLY' ? 'Mingguan' : 'Bulanan'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="text-right shrink-0">
                                                    <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                                        isReady ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                                    }`}>
                                                        {c.status || (isPerfect ? 'SIAP JALAN' : 'PERLU PERBAIKAN')}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Inspection progress & Fuel */}
                                            <div className="pl-2 my-3 space-y-2">
                                                <div>
                                                    <div className="flex justify-between items-center text-[11px] font-semibold text-slate-500 mb-1">
                                                        <span>Kondisi Item</span>
                                                        <span className={isPerfect ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                                                            {checkedCount}/{totalCount} OK
                                                        </span>
                                                    </div>
                                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full transition-all ${isPerfect ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                                                            style={{ width: `${totalCount > 0 ? (checkedCount / totalCount) * 100 : 0}%` }} 
                                                        />
                                                    </div>
                                                </div>

                                                {c.fuelLevel && (
                                                    <div className="flex items-center gap-1 text-[11px] text-slate-500 bg-slate-50 px-2 py-1 rounded-lg">
                                                        <Fuel size={13} className="text-amber-500 shrink-0" />
                                                        <span>BBM: <strong>{c.fuelLevel}</strong></span>
                                                    </div>
                                                )}

                                                {c.notes && (
                                                    <p className="text-[11px] text-amber-800 bg-amber-50/70 p-2 rounded-xl border border-amber-100/80 flex items-start gap-1.5">
                                                        <AlertCircle size={13} className="text-amber-600 shrink-0 mt-0.5" />
                                                        <span className="line-clamp-2">{c.notes}</span>
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Footer info */}
                                        <div className="pl-2 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                                            <div className="flex items-center gap-1.5 truncate pr-2">
                                                <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[9px] font-bold shrink-0">
                                                    {(c.driver?.name || c.user?.name || '?').charAt(0)}
                                                </div>
                                                <span className="font-medium text-slate-600 truncate">{c.driver?.name || c.user?.name || 'Petugas'}</span>
                                            </div>
                                            <span className="shrink-0 font-medium">
                                                {new Date(c.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} • {new Date(c.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
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
                                    Detail Ceklis Armada
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
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Tipe</p>
                                    <p className="font-bold text-xs text-slate-800">
                                        {selectedChecklist.type === 'DAILY' ? 'Harian' : selectedChecklist.type === 'WEEKLY' ? 'Mingguan' : 'Bulanan'}
                                    </p>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Status</p>
                                    <p className={`font-bold text-xs ${selectedChecklist.status === 'SIAP JALAN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {selectedChecklist.status || 'SIAP JALAN'}
                                    </p>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">BBM</p>
                                    <p className="font-bold text-xs text-amber-700 flex items-center gap-1">
                                        <Fuel size={13} /> {selectedChecklist.fuelLevel || '-'}
                                    </p>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Pelapor</p>
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
                                                {okCount}/{total} Sesuai Standar
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
