import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Wrench, Save, Calendar, Car, Gauge, DollarSign, PenTool as Tool2, Plus, Trash2, CheckCircle2, Clock, Route } from 'lucide-react';
import api from '../lib/axios';

// Helper: resolve vehicle type string to component category
function resolveVehicleCategory(vehicleType) {
    if (!vehicleType) return 'GENERAL';
    const t = vehicleType.toLowerCase();
    if (t.includes('motor') || t.includes('sepeda')) return 'MOTOR';
    if (t.includes('bus') || t.includes('microbus')) return 'BUS';
    return 'GENERAL';
}

// Routine maintenance items categorized by vehicle type
const ROUTINE_COMPONENTS_BY_TYPE = {
    MOTOR: [
        { name: 'Oli Mesin', intervalKm: 2000, intervalMonths: 2, icon: '🛢️' },
        { name: 'Busi', intervalKm: 8000, intervalMonths: 6, icon: '⚡' },
        { name: 'Filter Udara', intervalKm: 8000, intervalMonths: 6, icon: '💨' },
        { name: 'Oli Gardan (Matic)', intervalKm: 8000, intervalMonths: 6, icon: '⚙️' },
        { name: 'V-Belt (Matic)', intervalKm: 20000, intervalMonths: 18, icon: '🔗' },
        { name: 'Roller (Matic)', intervalKm: 20000, intervalMonths: 18, icon: '🔘' },
        { name: 'Rantai & Gir (Manual)', intervalKm: 15000, intervalMonths: 12, icon: '⛓️' },
        { name: 'Kampas Rem', intervalKm: 15000, intervalMonths: 12, icon: '🛑' },
        { name: 'Minyak Rem', intervalKm: 20000, intervalMonths: 18, icon: '💧' },
        { name: 'Ban (Ganti)', intervalKm: 20000, intervalMonths: 18, icon: '🔘' },
        { name: 'Aki (Battery)', intervalKm: null, intervalMonths: 12, icon: '🔋' },
        { name: 'Air Radiator (Coolant)', intervalKm: 20000, intervalMonths: 24, icon: '🌡️' },
        { name: 'Tune Up / Servis Berkala', intervalKm: 4000, intervalMonths: 3, icon: '🔩' },
    ],
    BUS: [
        { name: 'Oli Mesin', intervalKm: 10000, intervalMonths: 3, icon: '🛢️' },
        { name: 'Filter Oli', intervalKm: 10000, intervalMonths: 3, icon: '🔧' },
        { name: 'Oli Transmisi', intervalKm: 40000, intervalMonths: 12, icon: '⚙️' },
        { name: 'Oli Gardan', intervalKm: 40000, intervalMonths: 12, icon: '⚙️' },
        { name: 'Filter Udara', intervalKm: 15000, intervalMonths: 6, icon: '💨' },
        { name: 'Filter AC', intervalKm: 15000, intervalMonths: 6, icon: '❄️' },
        { name: 'Kompresor AC', intervalKm: null, intervalMonths: 24, icon: '❄️' },
        { name: 'Filter BBM', intervalKm: 20000, intervalMonths: 6, icon: '⛽' },
        { name: 'Filter Solar / Water Separator', intervalKm: 10000, intervalMonths: 6, icon: '⛽' },
        { name: 'Kampas Rem', intervalKm: 30000, intervalMonths: 12, icon: '🛑' },
        { name: 'Minyak Rem', intervalKm: 40000, intervalMonths: 18, icon: '💧' },
        { name: 'Ban (Rotasi/Ganti)', intervalKm: 50000, intervalMonths: 18, icon: '🔘' },
        { name: 'Spooring & Balancing', intervalKm: 20000, intervalMonths: 12, icon: '🎯' },
        { name: 'Aki (Battery)', intervalKm: null, intervalMonths: 18, icon: '🔋' },
        { name: 'Air Radiator (Coolant)', intervalKm: 40000, intervalMonths: 12, icon: '🌡️' },
        { name: 'Greasing / Pelumasan', intervalKm: 5000, intervalMonths: 3, icon: '🧴' },
        { name: 'Sistem Pneumatik (Angin Rem)', intervalKm: 20000, intervalMonths: 12, icon: '🌬️' },
        { name: 'Busi / Nozzle Injector', intervalKm: 40000, intervalMonths: 12, icon: '⚡' },
        { name: 'Timing Belt/Chain', intervalKm: 100000, intervalMonths: 48, icon: '🔗' },
        { name: 'Tune Up / Servis Berkala', intervalKm: 10000, intervalMonths: 3, icon: '🔩' },
    ],
    GENERAL: [
        { name: 'Oli Mesin', intervalKm: 5000, intervalMonths: 6, icon: '🛢️' },
        { name: 'Filter Oli', intervalKm: 10000, intervalMonths: 6, icon: '🔧' },
        { name: 'Oli Transmisi', intervalKm: 20000, intervalMonths: 12, icon: '⚙️' },
        { name: 'Oli Gardan', intervalKm: 20000, intervalMonths: 12, icon: '⚙️' },
        { name: 'Filter Udara', intervalKm: 15000, intervalMonths: 12, icon: '💨' },
        { name: 'Filter AC', intervalKm: 15000, intervalMonths: 12, icon: '❄️' },
        { name: 'Filter BBM', intervalKm: 20000, intervalMonths: 12, icon: '⛽' },
        { name: 'Kampas Rem', intervalKm: 30000, intervalMonths: 18, icon: '🛑' },
        { name: 'Ban (Rotasi/Ganti)', intervalKm: 40000, intervalMonths: 24, icon: '🔘' },
        { name: 'Spooring & Balancing', intervalKm: 20000, intervalMonths: 12, icon: '🎯' },
        { name: 'Aki (Battery)', intervalKm: null, intervalMonths: 18, icon: '🔋' },
        { name: 'Air Radiator (Coolant)', intervalKm: 40000, intervalMonths: 24, icon: '🌡️' },
        { name: 'Minyak Rem', intervalKm: 40000, intervalMonths: 24, icon: '💧' },
        { name: 'Busi', intervalKm: 20000, intervalMonths: 12, icon: '⚡' },
        { name: 'Timing Belt/Chain', intervalKm: 80000, intervalMonths: 48, icon: '🔗' },
        { name: 'Tune Up / Servis Berkala', intervalKm: 10000, intervalMonths: 6, icon: '🔩' },
    ],
};

const VehicleMaintenanceForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = !!id;

    const [vehicles, setVehicles] = useState([]);
    const [routineComponents, setRoutineComponents] = useState(ROUTINE_COMPONENTS_BY_TYPE.GENERAL);
    const [vehicleCategory, setVehicleCategory] = useState('GENERAL');
    const [form, setForm] = useState({
        vehicleId: '', date: new Date().toISOString().split('T')[0],
        odometer: '', workshop: '', description: '', proofFile: ''
    });
    const [selectedRoutine, setSelectedRoutine] = useState([]);
    const [nonRoutineItems, setNonRoutineItems] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api.get('/vehicles?forMaintenance=true').then(res => setVehicles(res.data));
        if (isEdit) {
            api.get(`/vehicles/maintenance/${id}`).then(res => {
                const d = res.data;
                setForm({ ...d, date: new Date(d.date).toISOString().split('T')[0] });
                
                let parsedItems = d.items;
                if (typeof parsedItems === 'string') {
                    try { parsedItems = JSON.parse(parsedItems); } catch(e) { parsedItems = null; }
                }

                if (parsedItems && Array.isArray(parsedItems)) {
                    setSelectedRoutine(parsedItems.filter(i => i.isRoutine || i.isRoutine === 'true').map(i => {
                        // Populate missing intervals from defaults (useful for old records)
                        let defaultComp = null;
                        for (const cat in ROUTINE_COMPONENTS_BY_TYPE) {
                            const found = ROUTINE_COMPONENTS_BY_TYPE[cat].find(c => c.name === i.name);
                            if (found) { defaultComp = found; break; }
                        }
                        return {
                            ...i,
                            intervalKm: i.intervalKm || (defaultComp ? defaultComp.intervalKm : ''),
                            intervalMonths: i.intervalMonths || (defaultComp ? defaultComp.intervalMonths : '')
                        };
                    }));
                    setNonRoutineItems(parsedItems.filter(i => !i.isRoutine && i.isRoutine !== 'true'));
                }
            });
        }
    }, [id]);

    // When selected vehicle changes, update routine components list
    useEffect(() => {
        if (!form.vehicleId || vehicles.length === 0) return;
        const selectedVehicle = vehicles.find(v => v.id === parseInt(form.vehicleId));
        if (selectedVehicle) {
            const cat = resolveVehicleCategory(selectedVehicle.type);
            setVehicleCategory(cat);
            setRoutineComponents(ROUTINE_COMPONENTS_BY_TYPE[cat] || ROUTINE_COMPONENTS_BY_TYPE.GENERAL);
            // Clear routine selections when vehicle type changes (only on new form)
            if (!isEdit) {
                setSelectedRoutine([]);
            }
        }
    }, [form.vehicleId, vehicles]);


    const toggleRoutine = (comp) => {
        const exists = selectedRoutine.find(r => r.name === comp.name);
        if (exists) {
            setSelectedRoutine(prev => prev.filter(r => r.name !== comp.name));
        } else {
            setSelectedRoutine(prev => [...prev, {
                name: comp.name, cost: '', intervalKm: comp.intervalKm || '',
                intervalMonths: comp.intervalMonths || '', isRoutine: true
            }]);
        }
    };

    const updateRoutineItem = (name, field, value) => {
        setSelectedRoutine(prev => prev.map(r => r.name === name ? { ...r, [field]: value } : r));
    };

    const addNonRoutine = () => {
        setNonRoutineItems(prev => [...prev, { name: '', cost: '', isRoutine: false }]);
    };

    const updateNonRoutine = (idx, field, value) => {
        setNonRoutineItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
    };

    const removeNonRoutine = (idx) => {
        setNonRoutineItems(prev => prev.filter((_, i) => i !== idx));
    };

    const totalCost = () => {
        const routineCost = selectedRoutine.reduce((s, r) => s + (parseFloat(r.cost) || 0), 0);
        const nonCost = nonRoutineItems.reduce((s, r) => s + (parseFloat(r.cost) || 0), 0);
        return routineCost + nonCost;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.vehicleId || !form.date) return alert('Pilih kendaraan dan tanggal!');
        if (selectedRoutine.length === 0 && nonRoutineItems.length === 0) return alert('Minimal satu item harus diisi!');

        const allItems = [...selectedRoutine, ...nonRoutineItems];
        const hasRoutine = selectedRoutine.length > 0;
        const typeStr = allItems.map(i => i.name).filter(Boolean).join(', ') || 'Servis';

        // Calculate Hybrid Targets for the log summary
        let nextServiceOdometer = null;
        let nextServiceDate = null;

        if (hasRoutine && form.odometer) {
            const kmIntervals = selectedRoutine.map(r => parseInt(r.intervalKm)).filter(v => v > 0);
            if (kmIntervals.length > 0) {
                nextServiceOdometer = parseInt(form.odometer) + Math.min(...kmIntervals);
            }

            const monthIntervals = selectedRoutine.map(r => parseInt(r.intervalMonths)).filter(v => v > 0);
            if (monthIntervals.length > 0) {
                const d = new Date(form.date);
                d.setMonth(d.getMonth() + Math.min(...monthIntervals));
                nextServiceDate = d.toISOString().split('T')[0];
            }
        }

        setLoading(true);
        try {
            const payload = {
                vehicleId: form.vehicleId,
                date: form.date,
                category: hasRoutine ? 'ROUTINE' : 'NON_ROUTINE',
                type: typeStr.substring(0, 200),
                description: form.description || allItems.map(i => i.name).join(', '),
                cost: totalCost(),
                odometer: form.odometer || null,
                nextServiceOdometer,
                nextServiceDate,
                workshop: form.workshop,
                proofFile: form.proofFile,
                items: allItems
            };

            if (isEdit) {
                await api.put(`/vehicles/maintenance/${id}`, payload);
            } else {
                await api.post('/vehicles/maintenance', payload);
            }
            alert('Riwayat pemeliharaan berhasil disimpan!');
            navigate('/kendaraan/pemeliharaan');
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal menyimpan data');
        } finally { setLoading(false); }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in slide-in-from-bottom-4 p-2 md:p-0">
            <button onClick={() => navigate('/kendaraan/pemeliharaan')} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors text-sm">
                <ArrowLeft size={16} /> Kembali
            </button>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Header */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                            <Wrench size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800">{isEdit ? 'Edit Log Pemeliharaan' : 'Catat Pemeliharaan Baru'}</h1>
                            <p className="text-slate-500 text-xs">Catat servis rutin dan/atau perbaikan sekaligus dalam satu nota.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase mb-2"><Car size={14} className="text-blue-500" /> Pilih Kendaraan *</label>
                            <select required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-bold text-slate-700 text-sm"
                                value={form.vehicleId} onChange={e => setForm({ ...form, vehicleId: e.target.value })}>
                                <option value="">--- Pilih Armada ---</option>
                                {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.plateNumber})</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase mb-2"><Calendar size={14} className="text-green-500" /> Tanggal Servis *</label>
                            <input type="date" required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-700 text-sm"
                                value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase mb-2"><Gauge size={14} className="text-blue-500" /> KM Saat Servis</label>
                            <input type="number" placeholder="Opsional" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 text-sm"
                                value={form.odometer} onChange={e => setForm({ ...form, odometer: e.target.value })} />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Bengkel / Lokasi</label>
                            <input className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 text-sm"
                                placeholder="Nama Bengkel" value={form.workshop} onChange={e => setForm({ ...form, workshop: e.target.value })} />
                        </div>
                    </div>
                </div>

                {/* Section 1: Routine Checklist */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2"><CheckCircle2 size={18} className="text-green-600" /> Perawatan Rutin</h2>
                        {form.vehicleId && (
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${vehicleCategory === 'MOTOR' ? 'bg-purple-100 text-purple-700' :
                                vehicleCategory === 'BUS' ? 'bg-indigo-100 text-indigo-700' :
                                    'bg-slate-100 text-slate-600'
                                }`}>
                                {vehicleCategory === 'MOTOR' ? '🏍️ Motor' : vehicleCategory === 'BUS' ? '🚌 Bus' : '🚗 Umum'}
                            </span>
                        )}
                    </div>
                    <p className="text-[11px] text-slate-400 mb-4">Centang item yang dilakukan. Komponen & interval disesuaikan otomatis berdasarkan tipe kendaraan.</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {[...routineComponents, ...selectedRoutine.filter(r => !routineComponents.some(comp => comp.name === r.name)).map(r => ({ ...r, icon: '⚠️' }))].map(comp => {
                            const isSelected = selectedRoutine.find(r => r.name === comp.name);
                            return (
                                <div key={comp.name}>
                                    <button type="button" onClick={() => toggleRoutine(comp)}
                                        className={`w-full text-left p-3 rounded-xl border-2 transition-all text-sm ${isSelected
                                            ? 'border-green-500 bg-green-50 shadow-sm' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{comp.icon}</span>
                                            <span className={`font-bold text-xs ${isSelected ? 'text-green-700' : 'text-slate-600'}`}>{comp.name}</span>
                                        </div>
                                        <div className="text-[9px] text-slate-400 mt-1 flex gap-2">
                                            {comp.intervalKm && <span className="flex items-center gap-0.5"><Route size={9} /> {comp.intervalKm.toLocaleString()} km</span>}
                                            {comp.intervalMonths && <span className="flex items-center gap-0.5"><Clock size={9} /> {comp.intervalMonths} bln</span>}
                                        </div>
                                    </button>

                                    {isSelected && (
                                        <div className="mt-1 p-3 bg-green-50 rounded-xl border border-green-200 space-y-2 animate-in slide-in-from-top-2">
                                            <input type="number" placeholder="Biaya (Rp)" className="w-full px-3 py-1.5 rounded-lg border border-green-200 text-xs font-bold outline-none focus:ring-1 focus:ring-green-400"
                                                value={isSelected.cost} onChange={e => updateRoutineItem(comp.name, 'cost', e.target.value)} />
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[8px] text-green-700 font-bold block">Interval KM</label>
                                                    <input type="number" className="w-full px-2 py-1 rounded-lg border border-green-200 text-[11px] font-bold outline-none"
                                                        value={isSelected.intervalKm} onChange={e => updateRoutineItem(comp.name, 'intervalKm', e.target.value)} />
                                                </div>
                                                <div>
                                                    <label className="text-[8px] text-green-700 font-bold block">Interval Bulan</label>
                                                    <input type="number" className="w-full px-2 py-1 rounded-lg border border-green-200 text-[11px] font-bold outline-none"
                                                        value={isSelected.intervalMonths} onChange={e => updateRoutineItem(comp.name, 'intervalMonths', e.target.value)} />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Section 2: Non-Routine Repairs */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Tool2 size={18} className="text-orange-600" /> Perbaikan Tambahan</h2>
                            <p className="text-[11px] text-slate-400">Perbaikan insidental yang dilakukan bersamaan (tanpa pengingat).</p>
                        </div>
                        <button type="button" onClick={addNonRoutine}
                            className="flex items-center gap-1 bg-orange-50 text-orange-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-orange-100 border border-orange-200">
                            <Plus size={14} /> Tambah
                        </button>
                    </div>

                    {nonRoutineItems.length === 0 ? (
                        <div className="text-center py-6 text-slate-300 text-xs italic">Tidak ada perbaikan tambahan.</div>
                    ) : (
                        <div className="space-y-2">
                            {nonRoutineItems.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2 p-3 bg-orange-50/50 rounded-xl border border-orange-100">
                                    <input placeholder="Nama Perbaikan" className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold outline-none focus:ring-1 focus:ring-orange-400"
                                        value={item.name} onChange={e => updateNonRoutine(idx, 'name', e.target.value)} />
                                    <input type="number" placeholder="Biaya (Rp)" className="w-32 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold outline-none focus:ring-1 focus:ring-orange-400"
                                        value={item.cost} onChange={e => updateNonRoutine(idx, 'cost', e.target.value)} />
                                    <button type="button" onClick={() => removeNonRoutine(idx)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Section 3: Notes & Summary */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Catatan Tambahan</label>
                    <textarea className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 text-sm h-20"
                        placeholder="Detail perbaikan jika ada..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />

                    <div className="mt-4 p-4 bg-slate-900 rounded-2xl flex items-center justify-between">
                        <div>
                            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Total Biaya</div>
                            <div className="text-2xl font-black text-white">Rp {totalCost().toLocaleString('id-ID')}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{selectedRoutine.length} item rutin + {nonRoutineItems.length} perbaikan</div>
                        </div>
                        <button type="submit" disabled={loading}
                            className="bg-orange-600 text-white px-8 py-3 rounded-xl font-black hover:bg-orange-700 shadow-xl shadow-orange-600/30 transition-all transform hover:-translate-y-1 flex items-center gap-2 text-sm">
                            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save size={18} /> SIMPAN</>}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default VehicleMaintenanceForm;
