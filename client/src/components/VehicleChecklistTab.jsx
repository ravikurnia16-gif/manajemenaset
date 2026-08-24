import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Camera, Save, RefreshCw, Calendar, Clock, Filter, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../lib/axios';

const DAILY_ITEMS = ['Kebersihan Eksterior', 'Kebersihan Interior', 'Tekanan Ban', 'Lampu Utama', 'Lampu Sein & Rem', 'Indikator Dashboard', 'Wiper & Air Washer', 'Cek Oli Mesin', 'Cek Air Radiator', 'Cek Minyak Rem'];
const WEEKLY_ITEMS = ['Cek Air Aki', 'Cek Minyak Power Steering', 'Tekanan Ban Serep', 'Fungsi Klakson', 'Cek Sabuk Pengaman'];
const MONTHLY_ITEMS = ['Cek Kampas Rem', 'Cek Filter Udara', 'Cek Filter AC', 'Ketebalan Ban', 'Cek Tali Kipas (Fan Belt)'];

export default function VehicleChecklistTab({ vehicles, currentUserProfile, isAdmin }) {
    const [checklists, setChecklists] = useState([]);
    const [missingSummary, setMissingSummary] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [triggeringAudit, setTriggeringAudit] = useState(false);
    const [isBannerExpanded, setIsBannerExpanded] = useState(false);
    
    // Filters
    const [filterType, setFilterType] = useState('ALL');
    const [filterVehicle, setFilterVehicle] = useState('ALL');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Detail Modal State
    const [selectedChecklist, setSelectedChecklist] = useState(null);

    // Form State
    const [formVehicleId, setFormVehicleId] = useState('');
    const [formType, setFormType] = useState('DAILY');
    const [formItems, setFormItems] = useState({});
    const [formNotes, setFormNotes] = useState('');
    const [formPhoto, setFormPhoto] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchChecklists();
        fetchMissingSummary();
    }, []);

    const fetchChecklists = async () => {
        try {
            setLoading(true);
            const res = await api.get('/vehicle-checklists');
            setChecklists(res.data);
        } catch (error) {
            console.error('Failed to fetch checklists:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMissingSummary = async () => {
        try {
            const res = await api.get('/vehicle-checklists/summary/missing');
            setMissingSummary(res.data);
        } catch (error) {
            console.error('Failed to fetch missing checklist summary:', error);
        }
    };

    const handleTriggerAudit = async () => {
        try {
            setTriggeringAudit(true);
            const res = await api.post('/vehicle-checklists/audit/trigger');
            alert(res.data.message || 'Audit berhasil dijalankan!');
            fetchMissingSummary();
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal menjalankan audit');
        } finally {
            setTriggeringAudit(false);
        }
    };

    useEffect(() => {
        // Initialize form items when type changes
        const items = formType === 'DAILY' ? DAILY_ITEMS : formType === 'WEEKLY' ? WEEKLY_ITEMS : MONTHLY_ITEMS;
        const initialItems = {};
        items.forEach(item => initialItems[item] = false);
        setFormItems(initialItems);
        
        if (formVehicleId) {
            const v = vehicles.find(v => v.id.toString() === formVehicleId);
            if (v) {
                if (formType === 'DAILY' && !v.requireDailyChecklist) setFormVehicleId('');
                else if (formType === 'WEEKLY' && !v.requireWeeklyChecklist) setFormVehicleId('');
                else if (formType === 'MONTHLY' && !v.requireMonthlyChecklist) setFormVehicleId('');
            }
        }
    }, [formType, vehicles, formVehicleId]);

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFormPhoto(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formVehicleId) return alert('Pilih kendaraan!');
        
        try {
            setSubmitting(true);
            const payload = {
                vehicleId: formVehicleId,
                type: formType,
                checks: JSON.stringify(formItems),
                notes: formNotes
            };

            await api.post('/vehicle-checklists', payload);
            
            alert('Ceklis berhasil disimpan!');
            setShowForm(false);
            setFormVehicleId('');
            setFormNotes('');
            setFormPhoto(null);
            setPhotoPreview(null);
            fetchChecklists();
            fetchMissingSummary();
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal menyimpan ceklis');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredChecklists = checklists.filter(c => {
        if (filterType !== 'ALL' && c.type !== filterType) return false;
        if (filterVehicle !== 'ALL' && c.vehicleId.toString() !== filterVehicle) return false;
        if (startDate && new Date(c.createdAt) < new Date(startDate)) return false;
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (new Date(c.createdAt) > end) return false;
        }
        return true;
    });

    return (
        <div className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Ceklis Kendaraan</h2>
                    <p className="text-sm text-slate-500">Pengecekan rutin Harian, Mingguan, dan Bulanan.</p>
                </div>
                {!showForm && (
                    <div className="flex items-center gap-2">
                        {isAdmin && (
                            <button
                                onClick={handleTriggerAudit}
                                disabled={triggeringAudit}
                                className="bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                                title="Kirim Notifikasi Peringatan Ceklis ke Kepala Bidang Sarana"
                            >
                                <RefreshCw className={triggeringAudit ? 'animate-spin' : ''} size={14} />
                                {triggeringAudit ? 'Memproses Audit...' : 'Audit & Notifikasi'}
                            </button>
                        )}
                        <button 
                            onClick={() => setShowForm(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm"
                        >
                            <Plus size={16} /> Buat Laporan Ceklis
                        </button>
                    </div>
                )}
            </div>

            {/* Warning Banner for Missing Checklists (Compact & Collapsible) */}
            {!showForm && missingSummary.length > 0 && (
                <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl overflow-hidden shadow-xs transition-all duration-300">
                    {/* Collapsed Bar Header */}
                    <div 
                        onClick={() => setIsBannerExpanded(!isBannerExpanded)}
                        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-amber-100/40 transition-colors select-none"
                    >
                        <div className="flex items-center gap-2.5">
                            <span className="flex h-2.5 w-2.5 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                            </span>
                            <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                                <AlertCircle size={15} className="text-amber-600" />
                                {missingSummary.length} Armada Belum Diisi Ceklis
                            </span>
                            <span className="hidden sm:inline-block text-[10px] bg-amber-200/80 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-300/50">
                                Notifikasi Aktif ke Kabid Sarana
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button className="text-xs font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 bg-amber-200/50 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition-colors">
                                {isBannerExpanded ? 'Sembunyikan' : 'Lihat Detail'}
                                {isBannerExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                        </div>
                    </div>

                    {/* Expandable Details Grid */}
                    {isBannerExpanded && (
                        <div className="p-4 pt-2 border-t border-amber-200/60 bg-white/60 backdrop-blur-xs animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {missingSummary.map(item => (
                                    <div key={item.id} className="bg-white border border-amber-200/70 p-3 rounded-xl shadow-2xs">
                                        <div className="font-bold text-slate-800 text-xs flex justify-between items-center">
                                            <span>{item.name}</span>
                                            <span className="text-[10px] text-slate-400 font-medium">{item.plateNumber}</span>
                                        </div>
                                        <div className="text-[11px] text-slate-500 mt-1">
                                            PJ: <span className="font-semibold text-slate-700">{item.pics?.map(p => p.name).join(', ') || 'Belum Ditentukan'}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {item.missingTypes.map((m, idx) => (
                                                <span key={idx} className="bg-red-50 text-red-700 border border-red-200/70 text-[10px] font-bold px-2 py-0.5 rounded-md">
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

            {showForm ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 animate-in slide-in-from-top-4">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2"><CheckCircle className="text-blue-600" /> Form Ceklis Baru</h3>
                        <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-red-500">Batal</button>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tipe Ceklis</label>
                                <select 
                                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formType}
                                    onChange={e => setFormType(e.target.value)}
                                >
                                    <option value="DAILY">Harian</option>
                                    <option value="WEEKLY">Mingguan</option>
                                    <option value="MONTHLY">Bulanan</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Pilih Kendaraan (Sesuai Tipe)</label>
                                <select 
                                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formVehicleId}
                                    onChange={e => setFormVehicleId(e.target.value)}
                                    required
                                >
                                    <option value="">-- Pilih Kendaraan --</option>
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
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                            <label className="block text-xs font-bold text-slate-800 uppercase mb-4">Item Pengecekan</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {Object.keys(formItems).map(item => (
                                    <label key={item} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${formItems[item] ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
                                        <span className="text-sm font-medium text-slate-700">{item}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase">{formItems[item] ? 'Baik' : 'Belum Dicek/Bermasalah'}</span>
                                            <input 
                                                type="checkbox" 
                                                className="w-5 h-5 accent-blue-600 cursor-pointer"
                                                checked={formItems[item]}
                                                onChange={e => setFormItems({...formItems, [item]: e.target.checked})}
                                            />
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Catatan / Temuan</label>
                                <textarea 
                                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none h-32"
                                    placeholder="Ada temuan kerusakan? Tulis disini..."
                                    value={formNotes}
                                    onChange={e => setFormNotes(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Foto Bukti (Opsional)</label>
                                <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center bg-white hover:bg-slate-50 transition-colors cursor-pointer relative h-32 flex flex-col items-center justify-center">
                                    {photoPreview ? (
                                        <img src={photoPreview} className="absolute inset-0 w-full h-full object-cover rounded-xl" alt="Preview" />
                                    ) : (
                                        <>
                                            <Camera className="text-slate-400 mb-2" size={24} />
                                            <span className="text-xs text-slate-500 font-medium">Klik untuk upload foto</span>
                                        </>
                                    )}
                                    <input 
                                        type="file" 
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        accept="image/*"
                                        onChange={handlePhotoChange}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button 
                                type="submit" 
                                disabled={submitting}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md disabled:opacity-50"
                            >
                                {submitting ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                                Simpan Ceklis
                            </button>
                        </div>
                    </form>
                </div>
            ) : (
                <>
                    <div className="flex flex-wrap gap-4 mb-6 bg-slate-50 p-3 rounded-xl items-center shadow-sm border border-slate-200">
                        <select 
                            className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:border-blue-400"
                            value={filterType}
                            onChange={e => setFilterType(e.target.value)}
                        >
                            <option value="ALL">Semua Tipe</option>
                            <option value="DAILY">Harian</option>
                            <option value="WEEKLY">Mingguan</option>
                            <option value="MONTHLY">Bulanan</option>
                        </select>
                        <select 
                            className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:border-blue-400"
                            value={filterVehicle}
                            onChange={e => setFilterVehicle(e.target.value)}
                        >
                            <option value="ALL">Semua Kendaraan</option>
                            {vehicles.map(v => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                        </select>
                        <div className="h-6 w-px bg-slate-300 mx-2 hidden md:block"></div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="date" 
                                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:border-blue-400"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                            />
                            <span className="text-slate-400 text-xs font-bold">-</span>
                            <input 
                                type="date" 
                                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:border-blue-400"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                            />
                        </div>
                        {(filterType !== 'ALL' || filterVehicle !== 'ALL' || startDate || endDate) && (
                            <button 
                                onClick={() => {
                                    setFilterType('ALL');
                                    setFilterVehicle('ALL');
                                    setStartDate('');
                                    setEndDate('');
                                }}
                                className="ml-auto bg-slate-200 hover:bg-slate-300 text-slate-600 p-1.5 rounded-lg transition-colors flex items-center"
                                title="Reset Filter"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-blue-500" /></div>
                    ) : filteredChecklists.length === 0 ? (
                        <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100">
                            <CheckCircle className="mx-auto text-slate-300 mb-3" size={32} />
                            <h4 className="text-slate-500 font-bold">Belum ada data ceklis</h4>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredChecklists.map(c => {
                                const checkedCount = Object.values(c.items || {}).filter(Boolean).length;
                                const totalCount = Object.keys(c.items || {}).length;
                                const isPerfect = checkedCount === totalCount;

                                return (
                                    <div 
                                        key={c.id} 
                                        onClick={() => setSelectedChecklist(c)}
                                        className="border border-slate-100 rounded-2xl p-4 hover:shadow-md transition-all bg-white relative overflow-hidden group cursor-pointer"
                                    >
                                        <div className={`absolute top-0 left-0 w-1 h-full ${c.type === 'DAILY' ? 'bg-blue-500' : c.type === 'WEEKLY' ? 'bg-orange-500' : 'bg-green-500'}`} />
                                        
                                        <div className="flex justify-between items-start mb-3 pl-2">
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-sm truncate w-40 group-hover:text-blue-600 transition-colors">{c.vehicle?.name}</h4>
                                                <span className={`inline-block px-2 py-0.5 mt-1 rounded text-[9px] font-bold uppercase tracking-wider ${
                                                    c.type === 'DAILY' ? 'bg-blue-100 text-blue-700' : 
                                                    c.type === 'WEEKLY' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                                                }`}>
                                                    {c.type === 'DAILY' ? 'Harian' : c.type === 'WEEKLY' ? 'Mingguan' : 'Bulanan'}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                                                    {new Date(c.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                </div>
                                                <div className="text-[9px] text-slate-400 mt-0.5">{new Date(c.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                                            </div>
                                        </div>

                                        <div className="pl-2 mb-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className={`h-full transition-all ${isPerfect ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${(checkedCount/totalCount)*100}%` }} />
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-500">{checkedCount}/{totalCount} OK</span>
                                            </div>
                                            {c.notes && (
                                                <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg mt-2 border border-amber-100 flex items-start gap-1">
                                                    <AlertCircle size={12} className="shrink-0 mt-0.5" />
                                                    <span className="line-clamp-2">{c.notes}</span>
                                                </p>
                                            )}
                                        </div>

                                        <div className="pl-2 pt-3 border-t border-slate-50 flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500">
                                                {c.user?.name?.charAt(0) || '?'}
                                            </div>
                                            <span className="text-[10px] font-medium text-slate-500 truncate">{c.user?.name || 'Tidak diketahui'}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* Checklist Detail Modal */}
            {selectedChecklist && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedChecklist(null)}>
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                    Detail Ceklis
                                </h3>
                                <p className="text-sm text-slate-500">{selectedChecklist.vehicle?.name}</p>
                            </div>
                            <button onClick={() => setSelectedChecklist(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Tipe Ceklis</p>
                                    <p className="font-medium text-slate-800">
                                        {selectedChecklist.type === 'DAILY' ? 'Harian' : selectedChecklist.type === 'WEEKLY' ? 'Mingguan' : 'Bulanan'}
                                    </p>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Waktu Laporan</p>
                                    <p className="font-medium text-slate-800">
                                        {new Date(selectedChecklist.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                                    </p>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Pelapor</p>
                                    <p className="font-medium text-slate-800 flex items-center gap-2">
                                        {selectedChecklist.user?.name || 'Unknown'}
                                    </p>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Status Ceklis</p>
                                    {(() => {
                                        const checksCount = Object.values(selectedChecklist.items || {}).filter(Boolean).length;
                                        const totalCount = Object.keys(selectedChecklist.items || {}).length;
                                        return (
                                            <p className={`font-medium ${checksCount === totalCount ? 'text-green-600' : 'text-amber-600'}`}>
                                                {checksCount}/{totalCount} OK
                                            </p>
                                        );
                                    })()}
                                </div>
                            </div>

                            <div>
                                <h4 className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">Item Pengecekan</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {Object.entries(selectedChecklist.items || {}).map(([key, value]) => (
                                        <div key={key} className={`flex justify-between items-center text-sm p-2.5 rounded-lg border ${value ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                                            <span className={value ? 'text-slate-700' : 'text-red-700 font-medium'}>{key}</span>
                                            {value ? <CheckCircle size={16} className="text-green-500 shrink-0" /> : <AlertCircle size={16} className="text-red-500 shrink-0" />}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {selectedChecklist.notes && (
                                <div>
                                    <h4 className="text-sm font-bold text-slate-800 mb-2">Catatan Tambahan</h4>
                                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-amber-800 text-sm">
                                        {selectedChecklist.notes}
                                    </div>
                                </div>
                            )}

                            {selectedChecklist.photo && (
                                <div>
                                    <h4 className="text-sm font-bold text-slate-800 mb-2">Foto Bukti</h4>
                                    <img src={selectedChecklist.photo} alt="Bukti ceklis" className="w-full max-w-md rounded-xl border border-slate-200" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
