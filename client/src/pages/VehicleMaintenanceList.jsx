import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Plus, Search, Calendar, Car, Wrench, AlertCircle, FileText } from 'lucide-react';
import api from '../lib/axios';

const VehicleMaintenanceList = () => {
    const navigate = useNavigate();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        try {
            const res = await api.get('/vehicles/maintenance/all');
            setLogs(res.data);
        } catch (error) {
            console.error('Failed to fetch maintenance logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Hapus log pemeliharaan ini?')) return;
        try {
            await api.delete(`/vehicles/maintenance/${id}`);
            fetchLogs();
        } catch (error) {
            alert('Gagal menghapus log');
        }
    };

    const filteredLogs = logs.filter(log =>
        log.vehicle?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.vehicle?.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100 italic">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Settings className="text-blue-600" /> Riwayat Pemeliharaan Kendaraan
                    </h1>
                    <p className="text-slate-500">Pantau servis rutin dan perbaikan armada.</p>
                </div>
                <button
                    onClick={() => navigate('/kendaraan/pemeliharaan/new')}
                    className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all transform hover:-translate-y-0.5"
                >
                    <Plus size={20} /> Tambah Log Servis
                </button>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Cari Kendaraan atau Tipe Servis..."
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
            ) : filteredLogs.length > 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                <th className="px-6 py-4">Tanggal</th>
                                <th className="px-6 py-4">Kendaraan</th>
                                <th className="px-6 py-4">Kategori / Tipe</th>
                                <th className="px-6 py-4">Deskripsi</th>
                                <th className="px-6 py-4">Kilometer</th>
                                <th className="px-6 py-4 text-right">Biaya (Rp)</th>
                                <th className="px-6 py-4 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredLogs.map(log => (
                                <tr key={log.id} className="hover:bg-slate-50 transition-colors group text-sm font-medium text-slate-600">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <Calendar size={14} className="text-slate-400" />
                                            {new Date(log.date).toLocaleDateString('id-ID')}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-800">{log.vehicle?.name || 'Tanpa Nama'}</span>
                                            <span className="text-[10px] uppercase font-mono text-slate-400">{log.vehicle?.plateNumber}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <span className={`text-[10px] w-fit px-2 py-0.5 rounded-full font-bold ${log.category === 'ROUTINE' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                                                {log.category === 'ROUTINE' ? 'RUTIN' : 'TIDAK RUTIN'}
                                            </span>
                                            <span>{log.type}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 max-w-xs truncate">{log.description}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span>{log.odometer?.toLocaleString()} km</span>
                                            {log.nextServiceOdometer && (
                                                <span className="text-[10px] text-blue-500 italic">Next: {log.nextServiceOdometer.toLocaleString()} km</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-slate-800">
                                        {log.cost.toLocaleString('id-ID')}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => navigate(`/kendaraan/pemeliharaan/edit/${log.id}`)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg">
                                                <FileText size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(log.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg">
                                                <AlertCircle size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="bg-white p-20 rounded-2xl border border-dashed border-slate-200 text-center italic">
                    <Wrench size={64} className="mx-auto text-slate-200 mb-4" />
                    <h3 className="text-slate-500 font-medium font-serif">Belum ada riwayat pemeliharaan</h3>
                    <p className="text-slate-400 text-xs mb-6 font-mono">Klik "Tambah Log Servis" untuk mulai mencatat.</p>
                </div>
            )}
        </div>
    );
};

export default VehicleMaintenanceList;
