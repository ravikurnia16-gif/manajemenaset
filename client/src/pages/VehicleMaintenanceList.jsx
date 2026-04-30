import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Plus, Search, Calendar, Car, Wrench, Trash2, Pencil, Eye, Download } from 'lucide-react';
import api from '../lib/axios';
import * as XLSX from 'xlsx';

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

    const handleExport = () => {
        const exportData = filteredLogs.map((log, index) => ({
            'No': index + 1,
            'Tanggal': new Date(log.date).toLocaleDateString('id-ID'),
            'Kendaraan': log.vehicle?.name || 'Tanpa Nama',
            'Plat Nomor': log.vehicle?.plateNumber || '-',
            'Kategori': log.category === 'ROUTINE' ? 'Rutin' : 'Tidak Rutin',
            'Tipe Servis': log.type,
            'Deskripsi': log.description || '-',
            'Odometer (km)': log.odometer || 0,
            'Next Service (km)': log.nextServiceOdometer || '-',
            'Biaya (Rp)': log.cost || 0
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        
        const colWidths = [
            { wch: 5 },  // No
            { wch: 15 }, // Tanggal
            { wch: 25 }, // Kendaraan
            { wch: 15 }, // Plat Nomor
            { wch: 15 }, // Kategori
            { wch: 20 }, // Tipe Servis
            { wch: 40 }, // Deskripsi
            { wch: 15 }, // Odometer
            { wch: 20 }, // Next Service
            { wch: 15 }  // Biaya
        ];
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Riwayat Pemeliharaan");
        XLSX.writeFile(wb, `Data_Pemeliharaan_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const filteredLogs = logs.filter(log =>
        log.vehicle?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.vehicle?.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Settings className="text-blue-600" /> Riwayat Pemeliharaan Kendaraan
                    </h1>
                    <p className="text-sm text-slate-500">Pantau servis rutin dan perbaikan armada.</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button
                        onClick={handleExport}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-amber-500 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-amber-600 shadow-lg shadow-amber-500/20 transition-all transform hover:-translate-y-0.5 text-xs sm:text-sm"
                    >
                        <Download size={20} /> <span className="sm:hidden lg:inline">Ekspor Excel</span><span className="hidden sm:inline lg:hidden">Ekspor</span>
                    </button>
                    <button
                        onClick={() => navigate('/kendaraan/pemeliharaan/reminder')}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all transform hover:-translate-y-0.5 text-xs sm:text-sm"
                    >
                        🩺 <span>Health Monitor</span>
                    </button>
                    <button
                        onClick={() => navigate('/kendaraan/pemeliharaan/new')}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all transform hover:-translate-y-0.5 text-xs sm:text-sm"
                    >
                        <Plus size={20} /> <span className="sm:hidden lg:inline">Tambah Log Servis</span><span className="hidden sm:inline lg:hidden">Tambah Log</span>
                    </button>
                </div>
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
                <div className="space-y-4">
                    {/* DESKTOP TABLE */}
                    <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
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
                                                <button onClick={() => navigate(`/kendaraan/pemeliharaan/view/${log.id}`)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Lihat Rincian">
                                                    <Eye size={16} />
                                                </button>
                                                <button onClick={() => navigate(`/kendaraan/pemeliharaan/edit/${log.id}`)} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg" title="Edit Data">
                                                    <Pencil size={16} />
                                                </button>
                                                <button onClick={() => handleDelete(log.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Hapus">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* MOBILE CARDS */}
                    <div className="grid grid-cols-1 gap-4 md:hidden">
                        {filteredLogs.map(log => (
                            <div key={log.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-800 text-lg">{log.vehicle?.name || 'Tanpa Nama'}</span>
                                        <span className="text-xs uppercase font-mono text-slate-400 tracking-wider">{log.vehicle?.plateNumber}</span>
                                    </div>
                                    <div className={`px-2 py-1 rounded-lg text-[10px] font-bold ${log.category === 'ROUTINE' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>
                                        {log.category === 'ROUTINE' ? 'RUTIN' : 'NON-RUTIN'}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-50">
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Tanggal</span>
                                        <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                                            <Calendar size={14} className="text-blue-500" />
                                            {new Date(log.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Odometer</span>
                                        <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                                            <Car size={14} className="text-blue-500" />
                                            {log.odometer?.toLocaleString()} km
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Tipe Layanan</span>
                                    <div className="text-sm font-bold text-slate-700">{log.type}</div>
                                    {log.description && <div className="text-xs text-slate-500 line-clamp-2">{log.description}</div>}
                                </div>

                                <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold">Total Biaya</span>
                                        <span className="text-lg font-black text-blue-600">Rp {log.cost.toLocaleString('id-ID')}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => navigate(`/kendaraan/pemeliharaan/view/${log.id}`)}
                                            className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all border border-blue-100"
                                        >
                                            <Eye size={18} />
                                        </button>
                                        <button
                                            onClick={() => navigate(`/kendaraan/pemeliharaan/edit/${log.id}`)}
                                            className="p-2.5 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-100 transition-all border border-orange-100"
                                        >
                                            <Pencil size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(log.id)}
                                            className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all border border-red-100"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
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
