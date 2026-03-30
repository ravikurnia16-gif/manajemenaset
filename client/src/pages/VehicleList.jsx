import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Plus, Search, MapPin, Fuel, Gauge, Trash2, Edit, Calendar, FileText, Wrench } from 'lucide-react';
import api from '../lib/axios';
import { getMediaUrl } from '../lib/media';

const VehicleList = () => {
    const navigate = useNavigate();
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isUser = user.role === 'USER';

    useEffect(() => {
        fetchVehicles();
    }, []);

    const fetchVehicles = async () => {
        try {
            // If it's a regular PIC (USER role), we only want their assigned vehicles
            const url = isUser ? '/vehicles?forMaintenance=true' : '/vehicles';
            const res = await api.get(url);
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
                {!isUser && (
                    <button
                        onClick={() => navigate('/kendaraan/data/new')}
                        className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all transform hover:-translate-y-0.5"
                    >
                        <Plus size={20} /> Tambah Kendaraan
                    </button>
                )}
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
                                    <img src={getMediaUrl(v.photo)} alt={v.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
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
                                    {v.isBorrowed && (
                                        <div className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-bold uppercase mt-1">
                                            Sedang Dipinjam
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-y-3 mb-6">
                                    {v.pics?.length > 0 && (
                                        <div className="col-span-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-500 italic">
                                            <span className="font-bold uppercase not-italic">PIC:</span> {v.pics.map(p => p.name).join(', ')}
                                        </div>
                                    )}
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
                                    {v.taxDueDate && (
                                        <div className={`col-span-2 flex items-center gap-2 text-[10px] font-bold py-1 px-3 rounded-lg ${new Date(v.taxDueDate) <= new Date(new Date().setDate(new Date().getDate() + 25))
                                            ? 'bg-orange-50 text-orange-600 animate-pulse'
                                            : 'bg-slate-50 text-slate-500'
                                            }`}>
                                            <Calendar size={12} />
                                            Pajak Tahunan: {new Date(v.taxDueDate).toLocaleDateString('id-ID')}
                                        </div>
                                    )}
                                    {v.stnkDueDate && (
                                        <div className={`col-span-2 flex items-center gap-2 text-[10px] font-bold py-1 px-3 rounded-lg ${new Date(v.stnkDueDate) <= new Date(new Date().setDate(new Date().getDate() + 25))
                                            ? 'bg-red-50 text-red-600 animate-pulse'
                                            : 'bg-slate-50 text-slate-500'
                                            }`}>
                                            <FileText size={12} />
                                            STNK (5 Thn): {new Date(v.stnkDueDate).toLocaleDateString('id-ID')}
                                        </div>
                                    )}
                                    {v.kirDueDate && (
                                        <div className={`col-span-2 flex items-center gap-2 text-[10px] font-bold py-1 px-3 rounded-lg ${new Date(v.kirDueDate) <= new Date(new Date().setDate(new Date().getDate() + 30))
                                            ? 'bg-blue-50 text-blue-600 animate-pulse'
                                            : 'bg-slate-50 text-slate-500'
                                            }`}>
                                            <Calendar size={12} />
                                            Jadwal KIR: {new Date(v.kirDueDate).toLocaleDateString('id-ID')}
                                        </div>
                                    )}
                                    {v.nextServiceOdometer ? (() => {
                                        const kmRemaining = v.nextServiceOdometer - (v.odometer || 0);
                                        const isUrgent = kmRemaining <= 500 && kmRemaining > 0;
                                        const isPastDue = kmRemaining <= 0;
                                        return (
                                            <div className={`col-span-2 flex items-center gap-2 text-[10px] font-bold py-1 px-3 rounded-lg ${isPastDue ? 'bg-red-50 text-red-600 animate-pulse'
                                                : isUrgent ? 'bg-orange-50 text-orange-600 animate-pulse'
                                                    : 'bg-blue-50 text-blue-500'
                                                }`}>
                                                <Wrench size={12} />
                                                Service Berikutnya: {v.nextServiceOdometer.toLocaleString()} km
                                                {isPastDue && ' ⚠ LEWAT!'}
                                                {isUrgent && !isPastDue && ` (sisa ${kmRemaining.toLocaleString()} km)`}
                                            </div>
                                        );
                                    })() : null}
                                </div>

                                <div className="flex gap-2 pt-4 border-t border-slate-50">
                                    <button
                                        onClick={() => navigate(`/kendaraan/laporan-mingguan/${v.id}`)}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all text-[10px] font-bold"
                                    >
                                        <FileText size={12} /> Laporan
                                    </button>
                                    <button
                                        onClick={() => navigate(`/kendaraan/inspeksi/${v.id}`)}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all text-[10px] font-bold"
                                    >
                                        <Car size={12} /> Inspeksi
                                    </button>
                                    <button
                                        onClick={() => navigate(`/kendaraan/inspeksi/riwayat/${v.id}`)}
                                        className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-200 hover:text-slate-700 transition-colors"
                                        title="Riwayat Inspeksi"
                                    >
                                        <Search size={14} />
                                    </button>
                                    {!isUser && (
                                        <>
                                            <button
                                                onClick={() => navigate(`/kendaraan/data/edit/${v.id}`)}
                                                className="flex items-center justify-center gap-1.5 p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                            >
                                                <Edit size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(v.id)}
                                                className="flex items-center justify-center gap-1.5 p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                    }
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
