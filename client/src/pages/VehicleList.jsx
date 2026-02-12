import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Plus, Search, MapPin, Fuel, Gauge, Trash2, Edit } from 'lucide-react';
import api from '../lib/axios';

const VehicleList = () => {
    const navigate = useNavigate();
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchVehicles();
    }, []);

    const fetchVehicles = async () => {
        try {
            const res = await api.get('/vehicles');
            setVehicles(res.data);
        } catch (error) {
            console.error('Failed to fetch vehicles:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Hapus kendaraan ini?')) return;
        try {
            await api.delete(`/vehicles/${id}`);
            fetchVehicles();
        } catch (error) {
            alert('Gagal menghapus kendaraan');
        }
    };

    const filteredVehicles = vehicles.filter(v =>
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.brand.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Car className="text-blue-600" /> Manajemen Kendaraan
                    </h1>
                    <p className="text-slate-500">Daftar armada dan kendaraan operasional.</p>
                </div>
                <button
                    onClick={() => navigate('/kendaraan/data/new')}
                    className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all transform hover:-translate-y-0.5"
                >
                    <Plus size={20} /> Tambah Kendaraan
                </button>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Cari Nama, Plat, atau Merk..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            ) : filteredVehicles.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredVehicles.map(v => (
                        <div key={v.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow group">
                            <div className="aspect-video bg-slate-100 relative overflow-hidden">
                                {v.photo ? (
                                    <img src={v.photo} alt={v.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                                        <Car size={48} />
                                        <span className="text-xs mt-2 italic">Belum ada foto</span>
                                    </div>
                                )}
                                <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold ${v.status === 'ACTIVE' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                    {v.status === 'ACTIVE' ? 'Aktif' : 'Non-Aktif'}
                                </div>
                            </div>
                            <div className="p-5">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-lg">{v.name}</h3>
                                        <p className="text-sm text-slate-500 uppercase font-mono tracking-wider">{v.plateNumber}</p>
                                    </div>
                                    <div className="bg-slate-50 px-2 py-1 rounded text-[10px] font-bold text-slate-400 uppercase">
                                        {v.type}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-y-3 mb-6">
                                    <div className="flex items-center gap-2 text-slate-600 text-xs">
                                        <MapPin size={14} className="text-blue-500" />
                                        <span>{v.brand} {v.model}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-600 text-xs">
                                        <Fuel size={14} className="text-orange-500" />
                                        <span>{v.fuelType || '-'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-600 text-xs text-nowrap">
                                        <Gauge size={14} className="text-green-500" />
                                        <span>{v.odometer?.toLocaleString()} km</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-600 text-xs">
                                        <div className="w-3 h-3 rounded-full border border-slate-200" style={{ backgroundColor: v.color }}></div>
                                        <span>{v.color || '-'}</span>
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-4 border-t border-slate-50">
                                    <button
                                        onClick={() => navigate(`/kendaraan/data/edit/${v.id}`)}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors text-xs font-bold"
                                    >
                                        <Edit size={14} /> Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(v.id)}
                                        className="flex tems-center justify-center gap-1.5 p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white p-20 rounded-2xl border border-dashed border-slate-200 text-center">
                    <Car size={64} className="mx-auto text-slate-200 mb-4" />
                    <h3 className="text-slate-500 font-medium">Belum ada data kendaraan</h3>
                    <p className="text-slate-400 text-sm mb-6">Klik tombol Tambah Kendaraan untuk memulai.</p>
                </div>
            )}
        </div>
    );
};

export default VehicleList;
