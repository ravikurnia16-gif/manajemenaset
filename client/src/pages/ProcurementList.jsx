import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, ShoppingCart, Filter, Files, Trash2 } from 'lucide-react';

import api from '../lib/axios';

import * as XLSX from 'xlsx'; // Import XLSX

const ProcurementList = () => {
    const navigate = useNavigate();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({ categoryId: '', type: '', unitId: '' });
    const [units, setUnits] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [pagination, setPagination] = useState({ limit: 10, page: 1 });

    useEffect(() => {
        fetchUnits();
        fetchCategories();
    }, []);

    useEffect(() => {
        fetchRequests();
        setSelectedIds([]); // Reset selection on filter change
    }, [filter, pagination.limit, pagination.page]); // Add pagination dependencies

    const fetchUnits = async () => {
        try {
            const res = await api.get('/master/units');
            setUnits(res.data);
        } catch (error) {
            console.error("Failed to fetch units");
        }
    };

    const fetchCategories = async () => {
        try {
            const res = await api.get('/master/categories');
            setCategories(res.data);
        } catch (error) {
            console.error("Failed to fetch categories");
        }
    };

    const fetchRequests = async () => {
        setLoading(true);
        try {
            // Remove empty filters
            const params = new URLSearchParams();
            if (filter.categoryId) params.append('categoryId', filter.categoryId);
            if (filter.type) params.append('type', filter.type);
            if (filter.unitId) params.append('unitId', filter.unitId);
            params.append('limit', pagination.limit);
            params.append('page', pagination.page);

            const res = await api.get(`/procurements?${params.toString()}`);
            setRequests(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Apakah anda yakin ingin menghapus request ini? Data yang dihapus tidak dapat dikembalikan.')) return;
        try {
            await api.delete(`/procurements/${id}`);
            fetchRequests();
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal menghapus');
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Apakah anda yakin ingin menghapus ${selectedIds.length} request terpilih?`)) return;
        try {
            await api.post('/procurements/bulk-delete', { ids: selectedIds });
            fetchRequests();
            setSelectedIds([]);
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal menghapus banyak');
        }
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedIds(paginatedRequests.map(r => r.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(sid => sid !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const handleExport = () => {
        if (requests.length === 0) return alert('Tidak ada data untuk diexport');

        const dataToExport = requests.map(req => ({
            'Kode Request': req.code,
            'Judul': req.title,
            'Unit Kerja': req.unit?.name,
            'Pemohon': req.user?.username,
            'Jenis': req.type,
            'Status': req.status,
            'Tanggal': new Date(req.createdAt).toLocaleDateString('id-ID'),
            'Jumlah Item': req._count?.items || 0
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Request Data");
        XLSX.writeFile(wb, `List_Request_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // Client-side Pagination Logic (assuming API handles pagination, this part is for display)
    const filteredRequests = requests; // API already filters, but if we added client search...
    const totalItems = filteredRequests.length; // This should come from API metadata for true pagination
    const totalPages = pagination.limit === -1 ? 1 : Math.ceil(totalItems / pagination.limit);

    const paginatedRequests = pagination.limit === -1
        ? filteredRequests
        : filteredRequests.slice((pagination.page - 1) * pagination.limit, pagination.page * pagination.limit);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-1">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Pengadaan Barang & Jasa</h1>
                    <p className="text-slate-500 text-xs sm:text-sm">Daftar permintaan pengadaan aset dan non-aset</p>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    {selectedIds.length > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-sm"
                        >
                            <Trash2 size={16} /> Hapus ({selectedIds.length})
                        </button>
                    )}
                    <button
                        onClick={handleExport}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-sm flex-1 sm:flex-none justify-center"
                    >
                        <Files size={16} /> Export
                    </button>
                    <button
                        onClick={() => navigate('/procurements/new')}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-lg shadow-blue-600/20 flex-1 sm:flex-none justify-center"
                    >
                        <Plus size={16} /> Buat Pengajuan
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap gap-2 sm:gap-4 items-center bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 text-slate-500">
                    <Filter size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Filter:</span>
                </div>

                <select
                    className="border-none bg-slate-50 rounded-lg px-2 sm:px-3 py-1.5 text-xs sm:text-sm focus:ring-2 focus:ring-blue-100 outline-none text-slate-600 font-medium flex-1 sm:flex-none min-w-[100px] max-w-full sm:max-w-[200px]"
                    value={filter.categoryId}
                    onChange={e => setFilter({ ...filter, categoryId: e.target.value })}
                >
                    <option value="">Semua Kategori</option>
                    {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>

                <select
                    className="border-none bg-slate-50 rounded-lg px-2 sm:px-3 py-1.5 text-xs sm:text-sm focus:ring-2 focus:ring-blue-100 outline-none text-slate-600 font-medium flex-1 sm:flex-none min-w-[100px]"
                    value={filter.type}
                    onChange={e => setFilter({ ...filter, type: e.target.value })}
                >
                    <option value="">Semua Jenis</option>
                    <option value="ASSET">Aset</option>
                    <option value="NON_ASSET">Non-Aset</option>
                </select>

                <select
                    className="border-none bg-slate-50 rounded-lg px-2 sm:px-3 py-1.5 text-xs sm:text-sm focus:ring-2 focus:ring-blue-100 outline-none text-slate-600 font-medium flex-1 sm:flex-none min-w-[100px] max-w-full sm:max-w-[200px]"
                    value={filter.unitId || ''}
                    onChange={e => setFilter({ ...filter, unitId: e.target.value })}
                >
                    <option value="">Semua Unit</option>
                    {units.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                </select>

                <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
                    <span className="text-xs text-slate-400">Tampilkan:</span>
                    <select
                        className="border-none bg-slate-50 rounded-lg px-2 py-1 text-xs focus:ring-0 text-slate-600 font-bold"
                        value={pagination.limit}
                        onChange={e => setPagination({ ...pagination, limit: parseInt(e.target.value), page: 1 })}
                    >
                        <option value="10">10</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="-1">Semua</option>
                    </select>
                </div>
            </div>

            {/* Mobile Card Layout */}
            <div className="block sm:hidden space-y-3">
                {loading ? (
                    <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100 text-center text-slate-500">Loading data...</div>
                ) : paginatedRequests.length === 0 ? (
                    <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100 text-center text-slate-500">Belum ada request pengadaan.</div>
                ) : (
                    paginatedRequests.map((req) => (
                        <div key={req.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 active:bg-slate-50 transition-colors">
                            <div className="flex items-start gap-2">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.includes(req.id)}
                                    onChange={() => handleSelectOne(req.id)}
                                    className="rounded text-blue-600 focus:ring-blue-500 mt-1 shrink-0"
                                />
                                <div className="flex-1 min-w-0" onClick={() => navigate(`/procurements/${req.id}`)}>
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <span className="font-mono text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{req.code}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${req.type === 'ASSET' ? 'border-purple-200 text-purple-600 bg-purple-50' : 'border-orange-200 text-orange-600 bg-orange-50'}`}>{req.type}</span>
                                    </div>
                                    <div className="font-bold text-sm text-slate-800 truncate">{req.title || '-'}</div>
                                    <div className="text-[10px] text-slate-500 mt-0.5">{req.unit?.name} • {req.user?.username}</div>
                                    <div className="flex items-center justify-between mt-2">
                                        <span className="text-[10px] text-slate-400">
                                            {new Date(req.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${req.status === 'SUBMITTED' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' :
                                            req.status === 'APPROVED' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                                req.status === 'PROCESS' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' :
                                                    req.status === 'COMPLETED' ? 'bg-green-50 text-green-600 border-green-200' :
                                                        'bg-red-50 text-red-600 border-red-200'
                                            }`}>
                                            {req.status}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(req.id)}
                                    className="p-1.5 text-slate-300 hover:text-red-500 shrink-0"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Desktop Table Layout */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden hidden sm:block">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-xs">
                        <tr>
                            <th className="p-4 w-10 text-center">
                                <input
                                    type="checkbox"
                                    onChange={handleSelectAll}
                                    checked={paginatedRequests.length > 0 && selectedIds.length === paginatedRequests.length}
                                    className="rounded text-blue-600 focus:ring-blue-500"
                                />
                            </th>
                            <th className="p-4">Kode Request</th>
                            <th className="p-4">Judul & Unit</th>
                            <th className="p-4">Jenis</th>
                            <th className="p-4">Tanggal</th>
                            <th className="p-4 text-center">Status</th>
                            <th className="p-4 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan="7" className="p-8 text-center text-slate-500">Loading data...</td></tr>
                        ) : paginatedRequests.length === 0 ? (
                            <tr><td colSpan="7" className="p-8 text-center text-slate-500">Belum ada request pengadaan.</td></tr>
                        ) : (
                            paginatedRequests.map((req) => (
                                <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 text-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(req.id)}
                                            onChange={() => handleSelectOne(req.id)}
                                            className="rounded text-blue-600 focus:ring-blue-500"
                                        />
                                    </td>
                                    <td className="p-4 font-mono font-bold text-slate-700">{req.code}</td>
                                    <td className="p-4">
                                        <div className="font-bold text-slate-800">{req.title || '-'}</div>
                                        <div className="text-xs text-slate-500">{req.unit?.name} • {req.user?.username}</div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold border ${req.type === 'ASSET' ? 'border-purple-200 text-purple-600 bg-purple-50' : 'border-orange-200 text-orange-600 bg-orange-50'
                                            }`}>{req.type}</span>
                                    </td>
                                    <td className="p-4 text-slate-600">
                                        {new Date(req.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${req.status === 'SUBMITTED' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' :
                                            req.status === 'APPROVED' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                                req.status === 'PROCESS' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' :
                                                    req.status === 'COMPLETED' ? 'bg-green-50 text-green-600 border-green-200' :
                                                        'bg-red-50 text-red-600 border-red-200'
                                            }`}>
                                            {req.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => navigate(`/procurements/${req.id}`)}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                title="Lihat Detail"
                                            >
                                                <Eye size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(req.id)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                title="Hapus"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {pagination.limit !== -1 && totalPages > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-sm text-slate-500">
                    <div>
                        Menampilkan {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, totalItems)} dari {totalItems} data
                    </div>
                    <div className="flex gap-1">
                        <button
                            disabled={pagination.page === 1}
                            onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                            className="px-3 py-1 border rounded hover:bg-slate-50 disabled:opacity-50"
                        >
                            Prev
                        </button>
                        {[...Array(totalPages)].map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setPagination({ ...pagination, page: i + 1 })}
                                className={`px-3 py-1 border rounded ${pagination.page === i + 1 ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-slate-50'}`}
                            >
                                {i + 1}
                            </button>
                        ))}
                        <button
                            disabled={pagination.page === totalPages}
                            onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                            className="px-3 py-1 border rounded hover:bg-slate-50 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProcurementList;
