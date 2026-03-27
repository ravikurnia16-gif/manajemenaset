import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Car, ArrowLeft, Calendar, User, Eye, Plus, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import api from '../lib/axios';
import { getMediaUrl } from '../lib/media';

const VehicleInspectionList = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [vehicle, setVehicle] = useState(null);
    const [inspections, setInspections] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            const [vRes, iRes] = await Promise.all([
                api.get(`/vehicles/${id}`),
                api.get(`/vehicle-inspections/vehicle/${id}`)
            ]);
            setVehicle(vRes.data);
            setInspections(iRes.data);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-10 text-center flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-slate-500 font-medium tracking-tight">Memuat data riwayat inspeksi...</p>
    </div>;

    if (!vehicle) return <div className="p-10 text-center bg-white rounded-2xl border border-slate-100 shadow-sm max-w-md mx-auto mt-20">
        <AlertTriangle className="mx-auto text-amber-500 mb-4" size={48} />
        <h3 className="text-slate-800 font-bold text-xl mb-2">Oops!</h3>
        <p className="text-slate-500 mb-6">Data kendaraan tidak ditemukan atau telah dihapus.</p>
        <button onClick={() => navigate('/kendaraan/data')} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold">Kembali</button>
    </div>;

    const severityColors = {
        light: 'bg-green-500',
        medium: 'bg-yellow-500',
        heavy: 'bg-red-500'
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/kendaraan/data')}
                        className="p-2 hover:bg-slate-50 rounded-xl transition-colors"
                    >
                        <ArrowLeft className="text-slate-600" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                             Riwayat Inspeksi Goresan
                        </h1>
                        <p className="text-slate-500 font-medium">
                            {vehicle.name} • <span className="uppercase font-mono text-blue-600 font-bold">{vehicle.plateNumber}</span>
                        </p>
                    </div>
                </div>
                <button 
                    onClick={() => navigate(`/kendaraan/inspeksi/${id}`)}
                    className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all transform hover:-translate-y-0.5"
                >
                    <Plus size={20} /> Inspeksi Baru
                </button>
            </div>

            {/* Inspections List */}
            {inspections.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {inspections.map(inspection => {
                        const totalScratches = (inspection.scratches || []).length;
                        return (
                            <div key={inspection.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden group hover:shadow-md transition-shadow">
                                <div className="aspect-video bg-slate-50 relative overflow-hidden">
                                    {inspection.frontPhoto ? (
                                        <img 
                                            src={getMediaUrl(inspection.frontPhoto)} 
                                            alt="Preview" 
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Car size={40} className="text-slate-200" />
                                        </div>
                                    )}
                                    <div className="absolute top-3 right-3 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-[10px] font-bold text-slate-700 shadow-sm border border-white/50">
                                        ID #{inspection.id}
                                    </div>
                                    {totalScratches > 0 && (
                                        <div className="absolute bottom-3 left-3 px-3 py-1 bg-red-500 text-white rounded-full text-[10px] font-bold shadow-lg shadow-red-500/20">
                                            {totalScratches} Goresan Terdeteksi
                                        </div>
                                    )}
                                </div>
                                <div className="p-5">
                                    <div className="space-y-3 mb-6">
                                        <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                                            <Calendar size={16} className="text-blue-500" />
                                            {new Date(inspection.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                                            <User size={16} className="text-blue-500" />
                                            Staff: {inspection.user?.name || 'Unknown'}
                                        </div>
                                        {inspection.notes && (
                                            <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-500 italic line-clamp-2">
                                                "{inspection.notes}"
                                            </div>
                                        )}
                                    </div>
                                    <button 
                                        className="w-full py-2.5 bg-slate-50 text-slate-600 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-50 hover:text-blue-600 transition-all border border-transparent hover:border-blue-100"
                                        onClick={() => alert('Fitur Detail Inspeksi (Popup) sedang dalam pengembangan. Coordinate data: ' + JSON.stringify(inspection.scratches))}
                                    >
                                        <Eye size={18} /> Lihat Detail
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="bg-white p-20 rounded-2xl border border-dashed border-slate-200 text-center">
                    <CheckCircle2 size={64} className="mx-auto text-green-100 mb-4" />
                    <h3 className="text-slate-800 font-bold text-xl mb-1">Body Mulus!</h3>
                    <p className="text-slate-500 text-sm mb-6">Belum ada catatan inspeksi goresan untuk kendaraan ini.</p>
                    <button 
                        onClick={() => navigate(`/kendaraan/inspeksi/${id}`)}
                        className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20"
                    >
                        Mulai Inspeksi Pertama
                    </button>
                </div>
            )}
        </div>
    );
};

export default VehicleInspectionList;
