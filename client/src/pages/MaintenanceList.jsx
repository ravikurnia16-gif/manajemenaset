import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Plus, Search, Filter, Trash2, Eye, Wrench, Calendar, AlertCircle } from 'lucide-react';
import api from '../lib/axios';

const statusColors = {
    SUBMITTED: 'bg-blue-100 text-blue-700',
    APPROVED: 'bg-cyan-100 text-cyan-700',
    VALIDATED: 'bg-indigo-100 text-indigo-700',
    ASSIGNED: 'bg-yellow-100 text-yellow-700',
    COMPLETED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700'
};

const statusLabels = {
    SUBMITTED: 'Diajukan',
    APPROVED: 'Disetujui',
    ASSIGNED: 'Ditugaskan',
    COMPLETED: 'Selesai',
    REJECTED: 'Ditolak'
};

const MaintenanceList = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const navigate = useNavigate();
    const location = useLocation();

    // Get category from query param
    const queryParams = new URLSearchParams(location.search);
    const categoryFromUrl = queryParams.get('category');

    const fetchReports = async () => {
        try {
            setLoading(true);
            const params = {};
            if (statusFilter) params.status = statusFilter;
            if (typeFilter) params.type = typeFilter;
            if (categoryFromUrl) params.category = categoryFromUrl;
            const res = await api.get('/maintenance', { params });
            setReports(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, [statusFilter, typeFilter, categoryFromUrl]);

    const handleDelete = async (id) => {
        if (!confirm('Hapus laporan ini?')) return;
        try {
            await api.delete(`/maintenance/${id}`);
            setReports(prev => prev.filter(r => r.id !== id));
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal menghapus');
        }
    };

    const filtered = Array.isArray(reports) ? reports.filter(r => {
        const searchLower = search.toLowerCase();

        // Match code, title, or username
        const basicMatch =
            (r.title?.toLowerCase() || '').includes(searchLower) ||
            (r.code?.toLowerCase() || '').includes(searchLower) ||
            (r.user?.name?.toLowerCase() || '').includes(searchLower);

        // Match within assets array (code or name)
        const assetMatch = r.assets?.some(asset =>
            (asset.name?.toLowerCase() || '').includes(searchLower) ||
            (asset.code?.toLowerCase() || '').includes(searchLower)
        );

        return basicMatch || assetMatch;
    }) : [];

    return (
        <div className="p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Wrench className="text-blue-600" /> Pemeliharaan
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Daftar seluruh laporan pemeliharaan aset dan umum
                    </p>
                </div>
                <button
                    onClick={() => navigate('/pemeliharaan/input')}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all text-sm"
                >
                    <Plus size={18} /> Buat Laporan
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col md:flex-row gap-3 items-center">
                <div className="relative flex-1 w-full">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Cari kode, judul, pelapor..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
                <select
                    value={categoryFromUrl || ''}
                    onChange={e => {
                        const val = e.target.value;
                        navigate(val ? `/pemeliharaan?category=${val}` : '/pemeliharaan');
                    }}
                    className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm min-w-[140px]"
                >
                    <option value="">Semua Kategori</option>
                    <option value="ROUTINE">📅 Rutin</option>
                    <option value="INCIDENTAL">🚨 Insidentil</option>
                </select>
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm min-w-[140px]"
                >
                    <option value="">Semua Status</option>
                    {Object.keys(statusLabels).map(s => (
                        <option key={s} value={s}>{statusLabels[s]}</option>
                    ))}
                </select>
                <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                    className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm min-w-[140px]"
                >
                    <option value="">Semua Tipe</option>
                    <option value="ASSET">Aset Terdata</option>
                    <option value="NON_ASSET">Non-Aset</option>
                </select>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-10 text-center text-slate-400">Memuat data...</div>
                ) : filtered.length === 0 ? (
                    <div className="p-10 text-center text-slate-400">
                        <Wrench size={40} className="mx-auto mb-2 text-slate-300" />
                        Belum ada laporan pemeliharaan
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left p-3 font-semibold text-slate-600">Kode</th>
                                    <th className="text-left p-3 font-semibold text-slate-600">Judul</th>
                                    <th className="text-left p-3 font-semibold text-slate-600 text-center">Aset</th>
                                    <th className="text-left p-3 font-semibold text-slate-600 text-center">Masa</th>
                                    <th className="text-left p-3 font-semibold text-slate-600">Status</th>
                                    <th className="text-left p-3 font-semibold text-slate-600">Tanggal</th>
                                    <th className="text-center p-3 font-semibold text-slate-600">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(r => (
                                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                        <td className="p-3 font-mono text-xs">{r.code}</td>
                                        <td className="p-3">
                                            <div className="font-medium">{r.title}</div>
                                            <div className="text-[10px] text-slate-400">{r.user?.username} ({r.unit?.name})</div>
                                        </td>
                                        <td className="p-3 text-center">
                                            {r.assets && r.assets.length > 0 ? (
                                                <div className="flex flex-col items-center">
                                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold border border-blue-100">
                                                        {r.assets.length} Aset
                                                    </span>
                                                    <div className="text-[9px] text-slate-400 mt-1 max-w-[100px] truncate">
                                                        {r.assets?.map(a => a.code).join(', ')}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${r.category === 'ROUTINE' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {r.category === 'ROUTINE' ? 'Rutin' : 'Insidentil'}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusColors[r.status] || 'bg-gray-100 text-gray-600'}`}>
                                                {statusLabels[r.status] || r.status}
                                            </span>
                                        </td>
                                        <td className="p-3 text-slate-500 text-xs">
                                            {r.createdAt ? new Date(r.createdAt).toLocaleDateString('id-ID') : '-'}
                                        </td>
                                        <td className="p-3 text-center flex items-center justify-center gap-1">
                                            <button onClick={() => navigate(`/pemeliharaan/${r.id}`)} className="p-1.5 hover:bg-blue-50 rounded text-blue-600" title="Detail">
                                                <Eye size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(r.id)} className="p-1.5 hover:bg-red-50 rounded text-red-500" title="Hapus">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MaintenanceList;
