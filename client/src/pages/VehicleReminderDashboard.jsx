import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Car, AlertTriangle, CheckCircle2, Clock, Gauge, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import api from '../lib/axios';

const statusConfig = {
    OVERDUE: { color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500', label: 'OVERDUE', headerBg: 'bg-red-50 border-red-200' },
    WARNING: { color: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500', label: 'SEGERA', headerBg: 'bg-amber-50 border-amber-200' },
    OK: { color: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500', label: 'AMAN', headerBg: 'bg-green-50 border-green-200' },
};

const VehicleReminderDashboard = () => {
    const navigate = useNavigate();
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedVehicle, setExpandedVehicle] = useState(null);

    useEffect(() => { fetchReminders(); }, []);

    const fetchReminders = async () => {
        try {
            const res = await api.get('/vehicles/reminders/all');
            setVehicles(res.data);
        } catch (err) {
            console.error('Failed to load reminders:', err);
        } finally { setLoading(false); }
    };

    const stats = {
        total: vehicles.length,
        overdue: vehicles.filter(v => v.overallStatus === 'OVERDUE').length,
        warning: vehicles.filter(v => v.overallStatus === 'WARNING').length,
        ok: vehicles.filter(v => v.overallStatus === 'OK').length,
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 p-2 md:p-0">
            <button onClick={() => navigate('/kendaraan/pemeliharaan')} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors text-sm">
                <ArrowLeft size={16} /> Kembali ke Riwayat
            </button>

            {/* Header */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Activity className="text-blue-600" /> Health Monitor Armada
                </h1>
                <p className="text-sm text-slate-500">Status pemeliharaan semua kendaraan berdasarkan KM dan Waktu.</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-center">
                    <div className="text-2xl font-black text-slate-800">{stats.total}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Kendaraan</div>
                </div>
                <div className="bg-red-50 p-4 rounded-2xl border border-red-100 shadow-sm text-center">
                    <div className="text-2xl font-black text-red-600">{stats.overdue}</div>
                    <div className="text-[10px] text-red-500 font-bold uppercase tracking-wider">Overdue</div>
                </div>
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 shadow-sm text-center">
                    <div className="text-2xl font-black text-amber-600">{stats.warning}</div>
                    <div className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">Warning</div>
                </div>
                <div className="bg-green-50 p-4 rounded-2xl border border-green-100 shadow-sm text-center">
                    <div className="text-2xl font-black text-green-600">{stats.ok}</div>
                    <div className="text-[10px] text-green-500 font-bold uppercase tracking-wider">Aman</div>
                </div>
            </div>

            {/* Vehicle List */}
            {loading ? (
                <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" /></div>
            ) : vehicles.length === 0 ? (
                <div className="bg-white p-16 rounded-2xl border border-dashed border-slate-200 text-center">
                    <Activity size={48} className="mx-auto text-slate-200 mb-4" />
                    <p className="text-slate-400 text-sm">Belum ada data pengingat. Catat pemeliharaan untuk mulai tracking.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {vehicles.map(vehicle => {
                        const isExpanded = expandedVehicle === vehicle.id;
                        const cfg = statusConfig[vehicle.overallStatus] || statusConfig.OK;
                        return (
                            <div key={vehicle.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                                <button onClick={() => setExpandedVehicle(isExpanded ? null : vehicle.id)}
                                    className={`w-full p-4 flex items-center justify-between ${cfg.headerBg} border-b transition-all`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${cfg.dot} animate-pulse`} />
                                        <Car size={18} className="text-slate-600" />
                                        <div className="text-left">
                                            <div className="font-bold text-sm text-slate-800">{vehicle.name}</div>
                                            <div className="text-[10px] text-slate-500 font-mono">{vehicle.plateNumber} • {(vehicle.odometer || 0).toLocaleString()} km</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {vehicle.overdueCount > 0 && <span className="text-[9px] font-black bg-red-500 text-white px-2 py-0.5 rounded-full">{vehicle.overdueCount} OVERDUE</span>}
                                        {vehicle.warningCount > 0 && <span className="text-[9px] font-black bg-amber-500 text-white px-2 py-0.5 rounded-full">{vehicle.warningCount} SEGERA</span>}
                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="p-4 space-y-2 animate-in slide-in-from-top-2">
                                        {vehicle.maintenanceReminders.length === 0 ? (
                                            <p className="text-xs text-slate-400 italic text-center py-4">Belum ada data pengingat untuk kendaraan ini.</p>
                                        ) : vehicle.maintenanceReminders.map(r => {
                                            const rCfg = statusConfig[r.calculatedStatus] || statusConfig.OK;
                                            return (
                                                <div key={r.id} className={`p-3 rounded-xl border ${rCfg.color} flex items-center justify-between`}>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-2 h-2 rounded-full ${rCfg.dot}`} />
                                                        <div>
                                                            <div className="font-bold text-xs">{r.componentName}</div>
                                                            <div className="text-[10px] opacity-70 flex items-center gap-3 mt-0.5">
                                                                {r.targetKm && <span className="flex items-center gap-0.5"><Gauge size={10} /> Target: {r.targetKm.toLocaleString()} km</span>}
                                                                {r.targetDate && <span className="flex items-center gap-0.5"><Clock size={10} /> Target: {new Date(r.targetDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${rCfg.color}`}>{rCfg.label}</span>
                                                        <div className="text-[9px] opacity-60 mt-0.5">{r.detail}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default VehicleReminderDashboard;
