import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Plus, Search, Calendar, Car, Wrench, Trash2, Pencil, Eye, Download, AlertTriangle, Image, X, ExternalLink, CheckCircle } from 'lucide-react';
import api from '../lib/axios';
import * as XLSX from 'xlsx';

const VehicleMaintenanceList = () => {
    const navigate = useNavigate();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedVehicleId, setSelectedVehicleId] = useState('');
    const [activeTab, setActiveTab] = useState('maintenance'); // 'maintenance' | 'incidents'
    const [previewPhoto, setPreviewPhoto] = useState(null); // photo lightbox modal

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
        if (!confirm('Hapus log pemeliharaan / laporan kerusakan ini?')) return;
        try {
            await api.delete(`/vehicles/maintenance/${id}`);
            fetchLogs();
        } catch (error) {
            alert('Gagal menghapus log');
        }
    };

    // Helper identifikasi apakah log merupakan Laporan Kerusakan / Insiden Peminjaman
    const isIncidentLog = (log) => {
        if (!log) return false;
        const type = (log.type || '').toUpperCase();
        const category = (log.category || '').toUpperCase();
        const desc = (log.description || '');
        return type === 'PERBAIKAN_KERUSAKAN' || 
               category === 'INSIDENTAL' || 
               desc.includes('[LAPORAN INSIDEN JALAN') ||
               desc.toLowerCase().includes('insiden');
    };

    // Helper ekstrak info pelapor dari deskripsi insiden
    const parseIncidentInfo = (desc = '') => {
        const match = desc.match(/\[LAPORAN INSIDEN JALAN oleh (.*?)\]:\s*(.*)/i);
        if (match) {
            return {
                reporter: match[1],
                notes: match[2] || 'Tidak ada catatan tambahan'
            };
        }
        return {
            reporter: null,
            notes: desc || 'Tidak ada deskripsi'
        };
    };

    const maintenanceLogs = logs.filter(l => !isIncidentLog(l));
    const incidentLogs = logs.filter(l => isIncidentLog(l));

    const currentTabLogs = activeTab === 'maintenance' ? maintenanceLogs : incidentLogs;

    const uniqueVehicles = [...new Map(logs.map(log => [log.vehicle?.id, log.vehicle])).values()].filter(Boolean);

    const filteredLogs = currentTabLogs.filter(log =>
        (selectedVehicleId ? log.vehicle?.id === parseInt(selectedVehicleId) : true) &&
        (log.vehicle?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.vehicle?.plateNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.description && log.description.toLowerCase().includes(searchTerm.toLowerCase())))
    );

    const handleExport = () => {
        const exportData = filteredLogs.map((log, index) => {
            const incInfo = isIncidentLog(log) ? parseIncidentInfo(log.description) : null;
            return {
                'No': index + 1,
                'Tanggal': new Date(log.date).toLocaleDateString('id-ID'),
                'Kendaraan': log.vehicle?.name || 'Tanpa Nama',
                'Plat Nomor': log.vehicle?.plateNumber || '-',
                'Kategori': log.category === 'ROUTINE' ? 'Rutin' : 'Tidak Rutin / Insidental',
                'Tipe': log.type,
                'Pelapor / Deskripsi': incInfo?.reporter ? `[Pelapor: ${incInfo.reporter}] ${incInfo.notes}` : (log.description || '-'),
                'Odometer (km)': log.odometer || 0,
                'Bengkel': log.workshop || '-',
                'Biaya (Rp)': log.cost || 0
            };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const colWidths = [
            { wch: 5 },  // No
            { wch: 15 }, // Tanggal
            { wch: 25 }, // Kendaraan
            { wch: 15 }, // Plat Nomor
            { wch: 20 }, // Kategori
            { wch: 20 }, // Tipe
            { wch: 45 }, // Deskripsi
            { wch: 15 }, // Odometer
            { wch: 25 }, // Bengkel
            { wch: 15 }  // Biaya
        ];
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        const sheetTitle = activeTab === 'maintenance' ? 'Pemeliharaan_Kendaraan' : 'Laporan_Kerusakan_Insiden';
        XLSX.utils.book_append_sheet(wb, ws, sheetTitle);
        XLSX.writeFile(wb, `${sheetTitle}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Settings className="text-blue-600" /> Riwayat Pemeliharaan & Kerusakan Kendaraan
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Pantau jadwal servis berkala, riwayat perawatan, dan tindak lanjut laporan kerusakan armada.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <button
                        onClick={handleExport}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-amber-500 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-amber-600 shadow-lg shadow-amber-500/20 transition-all text-xs sm:text-sm cursor-pointer"
                    >
                        <Download size={18} /> <span>Ekspor Excel</span>
                    </button>
                    <button
                        onClick={() => navigate('/kendaraan/pemeliharaan/reminder')}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all text-xs sm:text-sm cursor-pointer"
                    >
                        🩺 <span>Health Monitor</span>
                    </button>
                    <button
                        onClick={() => navigate('/kendaraan/pemeliharaan/new')}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all text-xs sm:text-sm cursor-pointer"
                    >
                        <Plus size={18} /> <span>Tambah Log Servis</span>
                    </button>
                </div>
            </div>

            {/* TAB NAVIGATION: 1. Pemeliharaan, 2. Laporan Kerusakan */}
            <div className="bg-white rounded-2xl border border-slate-100 p-1.5 shadow-sm flex flex-wrap gap-2">
                <button
                    onClick={() => setActiveTab('maintenance')}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                        activeTab === 'maintenance'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                >
                    <Wrench size={16} />
                    <span>Pemeliharaan & Servis</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                        activeTab === 'maintenance' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                        {maintenanceLogs.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('incidents')}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                        activeTab === 'incidents'
                            ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                >
                    <AlertTriangle size={16} className={incidentLogs.length > 0 ? 'text-rose-500 animate-pulse' : ''} />
                    <span>Laporan Kerusakan & Insiden</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                        activeTab === 'incidents' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'
                    }`}>
                        {incidentLogs.length}
                    </span>
                </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder={activeTab === 'maintenance' ? 'Cari kendaraan, jenis servis, atau deskripsi...' : 'Cari laporan kerusakan, pelapor, atau armada...'}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select
                    className="px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none min-w-[220px] text-sm cursor-pointer"
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                >
                    <option value="">Semua Kendaraan</option>
                    {uniqueVehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.name} ({v.plateNumber})</option>
                    ))}
                </select>
            </div>

            {/* Content Display */}
            {loading ? (
                <div className="flex justify-center py-20 bg-white rounded-2xl border border-slate-100">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                </div>
            ) : filteredLogs.length > 0 ? (
                <div className="space-y-4">
                    {/* TAB 1: PEMELIHARAAN (DESKTOP TABLE) */}
                    {activeTab === 'maintenance' && (
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
                                                    <span className={`text-[10px] w-fit px-2 py-0.5 rounded-full font-bold ${log.category === 'ROUTINE' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                        {log.category === 'ROUTINE' ? 'RUTIN' : 'NON-RUTIN'}
                                                    </span>
                                                    <span>{log.type}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 max-w-xs truncate">{log.description || '-'}</td>
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
                                                <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => navigate(`/kendaraan/pemeliharaan/view/${log.id}`)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer" title="Lihat Rincian">
                                                        <Eye size={16} />
                                                    </button>
                                                    <button onClick={() => navigate(`/kendaraan/pemeliharaan/edit/${log.id}`)} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg cursor-pointer" title="Edit Data">
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button onClick={() => handleDelete(log.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer" title="Hapus">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* TAB 2: LAPORAN KERUSAKAN & INSIDEN (DESKTOP TABLE) */}
                    {activeTab === 'incidents' && (
                        <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-rose-50/50 border-b border-rose-100 text-[10px] font-bold text-rose-800 uppercase tracking-wider">
                                        <th className="px-6 py-4">Tanggal Laporan</th>
                                        <th className="px-6 py-4">Kendaraan</th>
                                        <th className="px-6 py-4">Pelapor & Rincian Kerusakan</th>
                                        <th className="px-6 py-4 text-center">Bukti Foto</th>
                                        <th className="px-6 py-4">Kilometer</th>
                                        <th className="px-6 py-4">Status & Biaya</th>
                                        <th className="px-6 py-4 text-center">Aksi Tindak Lanjut</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredLogs.map(log => {
                                        const incInfo = parseIncidentInfo(log.description);
                                        const isHandled = log.cost > 0 || (log.workshop && log.workshop !== 'Perlu Penanganan Sarpras');

                                        return (
                                            <tr key={log.id} className="hover:bg-rose-50/20 transition-colors group text-sm font-medium text-slate-600">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar size={14} className="text-slate-400" />
                                                        <span>{new Date(log.date).toLocaleDateString('id-ID')}</span>
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-800">{log.vehicle?.name || 'Tanpa Nama'}</span>
                                                        <span className="text-[10px] uppercase font-mono text-slate-400">{log.vehicle?.plateNumber}</span>
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4 max-w-sm">
                                                    <div className="space-y-1">
                                                        {incInfo.reporter && (
                                                            <div className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                                                                👤 Pengemudi: {incInfo.reporter}
                                                            </div>
                                                        )}
                                                        <p className="text-xs text-slate-800 font-semibold leading-relaxed break-words">
                                                            {incInfo.notes}
                                                        </p>
                                                    </div>
                                                </td>

                                                {/* Bukti Foto */}
                                                <td className="px-6 py-4 text-center">
                                                    {log.proofFile ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setPreviewPhoto(log.proofFile)}
                                                            className="relative group/photo inline-block cursor-pointer overflow-hidden rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 transition"
                                                            title="Klik untuk memperbesar foto bukti kerusakan"
                                                        >
                                                            <img 
                                                                src={log.proofFile} 
                                                                alt="Bukti Kerusakan" 
                                                                className="w-14 h-14 object-cover group-hover/photo:scale-110 transition duration-300"
                                                            />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/photo:opacity-100 flex items-center justify-center text-white transition">
                                                                <Eye size={16} />
                                                            </div>
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">Tanpa Foto</span>
                                                    )}
                                                </td>

                                                {/* KM */}
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="font-mono text-slate-700 font-bold">{log.odometer?.toLocaleString()} km</span>
                                                </td>

                                                {/* Status & Biaya */}
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        {isHandled ? (
                                                            <>
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full w-fit">
                                                                    <CheckCircle size={11} /> Sudah Ditangani
                                                                </span>
                                                                <span className="text-xs font-bold text-slate-800">
                                                                    Rp {log.cost.toLocaleString('id-ID')}
                                                                </span>
                                                                {log.workshop && <span className="text-[10px] text-slate-400 truncate max-w-[140px]">{log.workshop}</span>}
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full w-fit">
                                                                    🔴 Perlu Penanganan
                                                                </span>
                                                                <span className="text-[11px] text-slate-400 italic">
                                                                    Belum ada biaya perbaikan
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Aksi */}
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button 
                                                            onClick={() => navigate(`/kendaraan/pemeliharaan/edit/${log.id}`)} 
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs" 
                                                            title="Tindak lanjut dan input biaya perbaikan bengkel"
                                                        >
                                                            <Wrench size={12} />
                                                            <span>Tindak Lanjut</span>
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDelete(log.id)} 
                                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer" 
                                                            title="Hapus Laporan Kerusakan"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* MOBILE CARDS (BOTH TABS) */}
                    <div className="grid grid-cols-1 gap-4 md:hidden">
                        {filteredLogs.map(log => {
                            const isInc = isIncidentLog(log);
                            const incInfo = isInc ? parseIncidentInfo(log.description) : null;
                            const isHandled = log.cost > 0 || (log.workshop && log.workshop !== 'Perlu Penanganan Sarpras');

                            return (
                                <div key={log.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-800 text-lg">{log.vehicle?.name || 'Tanpa Nama'}</span>
                                            <span className="text-xs uppercase font-mono text-slate-400 tracking-wider">{log.vehicle?.plateNumber}</span>
                                        </div>
                                        <div>
                                            {isInc ? (
                                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold ${isHandled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                                                    {isHandled ? '✓ DITANGANI' : '🔴 PERLU PENANGANAN'}
                                                </span>
                                            ) : (
                                                <div className={`px-2 py-1 rounded-lg text-[10px] font-bold ${log.category === 'ROUTINE' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>
                                                    {log.category === 'ROUTINE' ? 'RUTIN' : 'NON-RUTIN'}
                                                </div>
                                            )}
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

                                    {/* Deskripsi & Bukti Foto */}
                                    <div className="space-y-2">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">
                                            {isInc ? 'Rincian Kerusakan' : 'Deskripsi Servis'}
                                        </span>
                                        {incInfo?.reporter && (
                                            <div className="text-[11px] font-bold text-slate-600">
                                                Pelapor: <span className="text-slate-800">{incInfo.reporter}</span>
                                            </div>
                                        )}
                                        <div className="text-xs text-slate-700 font-medium leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                            {incInfo ? incInfo.notes : (log.description || '-')}
                                        </div>

                                        {log.proofFile && (
                                            <div className="pt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewPhoto(log.proofFile)}
                                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 cursor-pointer"
                                                >
                                                    <Image size={14} /> Lihat Foto Bukti
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold">Total Biaya</span>
                                            <span className="text-lg font-black text-blue-600">Rp {log.cost.toLocaleString('id-ID')}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => navigate(`/kendaraan/pemeliharaan/view/${log.id}`)}
                                                className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all border border-blue-100 cursor-pointer"
                                                title="Lihat Rincian"
                                            >
                                                <Eye size={18} />
                                            </button>
                                            <button
                                                onClick={() => navigate(`/kendaraan/pemeliharaan/edit/${log.id}`)}
                                                className="p-2.5 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-100 transition-all border border-orange-100 cursor-pointer"
                                                title="Edit / Tindak Lanjut"
                                            >
                                                <Pencil size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(log.id)}
                                                className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all border border-red-100 cursor-pointer"
                                                title="Hapus"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="bg-white p-16 rounded-2xl border border-dashed border-slate-200 text-center">
                    {activeTab === 'maintenance' ? (
                        <>
                            <Wrench size={54} className="mx-auto text-slate-300 mb-3" />
                            <h3 className="text-slate-600 font-bold text-base">Belum ada riwayat pemeliharaan</h3>
                            <p className="text-slate-400 text-xs mt-1">Klik "Tambah Log Servis" untuk mencatat perawatan armada.</p>
                        </>
                    ) : (
                        <>
                            <CheckCircle size={54} className="mx-auto text-emerald-400 mb-3" />
                            <h3 className="text-slate-600 font-bold text-base">Tidak ada laporan kerusakan aktif</h3>
                            <p className="text-slate-400 text-xs mt-1">Seluruh armada dalam kondisi baik dan tidak ada insiden yang dilaporkan.</p>
                        </>
                    )}
                </div>
            )}

            {/* LIGHTBOX MODAL PREVIEW FOTO BUKTI KERUSAKAN */}
            {previewPhoto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
                    <div className="relative max-w-4xl w-full bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between p-4 bg-slate-800/80 text-white border-b border-white/10">
                            <div className="flex items-center gap-2">
                                <Image size={18} className="text-blue-400" />
                                <span className="font-bold text-sm">Foto Bukti Kerusakan / Kejadian</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={previewPhoto}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold inline-flex items-center gap-1 transition"
                                >
                                    <ExternalLink size={14} /> Tab Baru
                                </a>
                                <button
                                    type="button"
                                    onClick={() => setPreviewPhoto(null)}
                                    className="p-1.5 rounded-lg bg-white/10 hover:bg-rose-600 text-white transition cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                        <div className="p-4 flex items-center justify-center overflow-auto bg-black/40">
                            <img
                                src={previewPhoto}
                                alt="Foto Bukti Kerusakan"
                                className="max-h-[70vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VehicleMaintenanceList;
