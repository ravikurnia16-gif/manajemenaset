import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, Search, FileText, CheckCircle, XCircle, Clock, Filter, Plus, Box } from 'lucide-react';
import api from '../lib/axios';

const MutationList = () => {
    const navigate = useNavigate();
    const [movements, setMovements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [selectedItems, setSelectedItems] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const user = JSON.parse(localStorage.getItem('user')) || {};
    const canApprove = ['SUPER_ADMIN', 'KEPALA_BIDANG'].includes(user.role);

    useEffect(() => {
        fetchMovements();
    }, []);

    const fetchMovements = async () => {
        try {
            const res = await api.get('/assets/movements/all');
            setMovements(res.data);
        } catch (error) {
            console.error('Failed to fetch mutations:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleBulkApproval = async (action) => {
        if (!confirm(`Konfirmasi ${action === 'approve' ? 'Persetujuan' : 'Penolakan'} untuk ${selectedItems.length} data?`)) return;
        try {
            await api.post(`/assets/movements/${action}`, { ids: selectedItems, note: `Diproses masal oleh ${user.username}` });
            alert(`${selectedItems.length} data berhasil diproses.`);
            setSelectedItems([]);
            fetchMovements();
        } catch (error) {
            alert('Gagal memproses mutasi: ' + (error.response?.data?.error || error.message));
        }
    };

    const isOnlyPendingSelected = selectedItems.length > 0 && selectedItems.every(id => {
        const item = movements.find(m => m.id === id);
        return item?.status === 'PENDING';
    });

    const filteredMovements = movements.filter(m => {
        const matchesSearch =
            m.asset?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.asset?.code?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const handleBulkDelete = async () => {
        if (!confirm(`Hapus ${selectedItems.length} data mutasi terpilih?`)) return;
        try {
            await api.delete('/assets/movements/bulk', { data: { ids: selectedItems } });
            setSelectedItems([]);
            fetchMovements();
        } catch (error) {
            alert('Gagal menghapus data: ' + (error.response?.data?.error || error.message));
        }
    };

    const toggleSelectAll = () => {
        if (selectedItems.length === filteredMovements.length) {
            setSelectedItems([]);
        } else {
            setSelectedItems(filteredMovements.map(m => m.id));
        }
    };

    const toggleSelectItem = (id) => {
        setSelectedItems(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredMovements.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredMovements.length / itemsPerPage);

    const getStatusBadge = (status) => {
        switch (status) {
            case 'APPROVED': return <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-bold flex items-center gap-1"><CheckCircle size={10} /> Disetujui</span>;
            case 'REJECTED': return <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-bold flex items-center gap-1"><XCircle size={10} /> Ditolak</span>;
            default: return <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold flex items-center gap-1 border border-amber-200 animate-pulse"><Clock size={10} /> Menunggu</span>;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <ArrowLeftRight className="text-blue-600" /> Mutasi Aset
                    </h1>
                    <p className="text-slate-500">Riwayat perpindahan dan mutasi inventaris unit.</p>
                </div>
                <button
                    onClick={() => navigate('/mutasi/request')}
                    className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                >
                    <Plus size={18} /> Ajukan Mutasi
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                <div className="md:col-span-3 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Cari Asset atau Kode..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="md:col-span-1 relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <select
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none appearance-none font-medium"
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setCurrentPage(1);
                        }}
                    >
                        <option value="ALL">Semua Status</option>
                        <option value="PENDING">Menunggu Persetujuan</option>
                        <option value="APPROVED">Disetujui</option>
                        <option value="REJECTED">Ditolak</option>
                    </select>
                </div>
                <div className="md:col-span-2 flex gap-2">
                    {selectedItems.length > 0 && isOnlyPendingSelected && canApprove && (
                        <>
                            <button
                                onClick={() => handleBulkApproval('approve')}
                                className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-3 py-2.5 rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-200"
                            >
                                <CheckCircle size={18} /> Setujui ({selectedItems.length})
                            </button>
                            <button
                                onClick={() => handleBulkApproval('reject')}
                                className="flex-1 flex items-center justify-center gap-2 bg-orange-600 text-white px-3 py-2.5 rounded-xl font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-200"
                            >
                                <XCircle size={18} /> Tolak
                            </button>
                        </>
                    )}
                    {selectedItems.length > 0 && canApprove && (
                        <button
                            onClick={handleBulkDelete}
                            className={`p-2.5 rounded-xl font-bold transition-all border ${isOnlyPendingSelected ? 'bg-red-50 text-red-600 border-red-100 hover:bg-red-600 hover:text-white' : 'flex-1 bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-200'}`}
                            title="Hapus Terpilih"
                        >
                            <Plus size={18} className="rotate-45" /> {isOnlyPendingSelected ? '' : `Hapus ${selectedItems.length}`}
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-6 py-4 w-10">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        checked={movements.length > 0 && selectedItems.length === filteredMovements.length}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Aset Info</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Jenis & Lokasi Mutasi</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Tanggal & Alasan</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan="6" className="px-6 py-20 text-center"><div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div></td></tr>
                            ) : filteredMovements.length === 0 ? (
                                <tr><td colSpan="6" className="px-6 py-20 text-center text-slate-400 font-medium">Belum ada riwayat mutasi</td></tr>
                            ) : currentItems.map(m => (
                                <tr key={m.id} className={`hover:bg-slate-50/50 transition-colors ${selectedItems.includes(m.id) ? 'bg-blue-50/30' : ''}`}>
                                    <td className="px-6 py-4">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            checked={selectedItems.includes(m.id)}
                                            onChange={() => toggleSelectItem(m.id)}
                                        />
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                                <Box size={20} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 text-sm line-clamp-1">{m.asset?.name}</p>
                                                <p className="text-[10px] text-slate-400 font-mono italic">{m.asset?.code}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                {m.type === 'EXTERNAL' ? (
                                                    <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded uppercase border border-orange-200">Antar Unit</span>
                                                ) : (
                                                    <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded uppercase border border-purple-200">Internal</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 text-xs">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Asal</span>
                                                    <span className="font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-md">{m.fromLocation}</span>
                                                </div>
                                                <div className="pt-3">
                                                    <ArrowLeftRight size={14} className="text-blue-400" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-blue-400 uppercase font-bold tracking-tighter">Tujuan</span>
                                                    <span className="font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">{m.toLocation}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-xs text-slate-600 flex items-center gap-1 mb-1">
                                            <Clock size={12} className="text-slate-400" />
                                            {new Date(m.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </p>
                                        <p className="text-[11px] text-slate-400 italic line-clamp-1">"{m.reason || 'Tanpa alasan'}"</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        {getStatusBadge(m.status)}
                                    </td>
                                    <td className="px-6 py-4">
                                        {m.status === 'PENDING' && canApprove ? (
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handleApproval(m.id, 'approve')}
                                                    className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all shadow-sm"
                                                    title="Setujui"
                                                >
                                                    <CheckCircle size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleApproval(m.id, 'reject')}
                                                    className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                                    title="Tolak"
                                                >
                                                    <XCircle size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="text-center">
                                                <button
                                                    onClick={() => navigate(`/mutasi/detail/${m.id}`)}
                                                    className="p-1.5 bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-100 transition-all shadow-sm"
                                                >
                                                    <FileText size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="px-6 py-4 bg-white border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                        <span>Tampilkan:</span>
                        <select
                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none font-bold text-slate-700 focus:ring-1 focus:ring-blue-500"
                            value={itemsPerPage}
                            onChange={(e) => {
                                setItemsPerPage(parseInt(e.target.value));
                                setCurrentPage(1);
                            }}
                        >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                        <span>dari {filteredMovements.length} data</span>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-bold"
                            >
                                Sebelumnya
                            </button>

                            <div className="flex items-center gap-1 mx-2">
                                {[...Array(totalPages)].map((_, i) => {
                                    const pageNum = i + 1;
                                    // Show first, last, current, and pages around current
                                    if (
                                        pageNum === 1 ||
                                        pageNum === totalPages ||
                                        (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                                    ) {
                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${currentPage === pageNum
                                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                                                    : 'hover:bg-slate-100 text-slate-600'
                                                    }`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    } else if (
                                        (pageNum === 2 && currentPage > 3) ||
                                        (pageNum === totalPages - 1 && currentPage < totalPages - 2)
                                    ) {
                                        return <span key={pageNum} className="text-slate-400">...</span>;
                                    }
                                    return null;
                                })}
                            </div>

                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-bold"
                            >
                                Selanjutnya
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MutationList;
