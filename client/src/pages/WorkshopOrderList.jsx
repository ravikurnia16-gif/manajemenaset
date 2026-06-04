import React, { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    Filter,
    HardHat,
    Cog,
    Eye,
    Edit,
    Trash2,
    Calendar,
    ArrowLeft
} from 'lucide-react';
import api from '../utils/api';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

function WorkshopOrderList() {
    const location = useLocation();
    const navigate = useNavigate();
    const searchParams = new URLSearchParams(location.search);
    const typeParam = searchParams.get('type') || '';

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState(typeParam);
    const [filterStatus, setFilterStatus] = useState('');

    useEffect(() => {
        fetchOrders();
    }, [filterType, filterStatus]);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filterType) params.append('type', filterType);
            if (filterStatus) params.append('status', filterStatus);

            const res = await api.get(`/workshop/orders?${params.toString()}`);
            setOrders(res.data);
        } catch (error) {
            console.error('Error fetching workshop orders:', error);
            Swal.fire('Error', 'Gagal memuat data pesanan', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id, code) => {
        const result = await Swal.fire({
            title: 'Hapus Pesanan?',
            text: `Anda yakin ingin menghapus pesanan ${code}? Tindakan ini tidak dapat dibatalkan.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Ya, Hapus'
        });

        if (result.isConfirmed) {
            try {
                await api.delete(`/workshop/orders/${id}`);
                Swal.fire('Terhapus!', 'Pesanan berhasil dihapus.', 'success');
                fetchOrders();
            } catch (error) {
                Swal.fire('Gagal!', error.response?.data?.error || 'Terjadi kesalahan.', 'error');
            }
        }
    };

    const filteredOrders = orders.filter(o => 
        (o.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (o.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.requestedBy?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusBadge = (status) => {
        const colors = {
            DRAFT: 'bg-gray-100 text-gray-800',
            PENDING: 'bg-yellow-100 text-yellow-800',
            IN_PROGRESS: 'bg-blue-100 text-blue-800',
            QUALITY_CHECK: 'bg-purple-100 text-purple-800',
            COMPLETED: 'bg-green-100 text-green-800',
            CANCELLED: 'bg-red-100 text-red-800'
        };
        return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${colors[status] || 'bg-gray-100'}`}>{status.replace('_', ' ')}</span>;
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-3">
                    <button onClick={() => navigate('/workshop/dashboard')} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Daftar Pesanan Workshop</h1>
                        <p className="text-sm text-gray-500">Kelola pesanan pekerjaan Workshop Kayu & Besi</p>
                    </div>
                </div>
                <div className="flex space-x-2">
                    {/* Placeholder for Procurement Generate Button */}
                    <Link to="/workshop/orders/new" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center shadow-sm">
                        <Plus size={18} className="mr-2" />
                        Buat Pesanan
                    </Link>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center justify-between mb-6">
                <div className="flex flex-wrap gap-4 items-center w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={18} className="text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Cari kode, judul, pemohon..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                        />
                    </div>

                    <div className="flex items-center border border-gray-300 rounded-lg p-1 bg-gray-50">
                        <button
                            onClick={() => { setFilterType(''); navigate('/workshop/orders'); }}
                            className={`px-3 py-1 text-sm rounded-md transition-colors ${filterType === '' ? 'bg-white shadow text-gray-800 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Semua
                        </button>
                        <button
                            onClick={() => { setFilterType('KAYU'); navigate('/workshop/orders?type=KAYU'); }}
                            className={`px-3 py-1 text-sm rounded-md transition-colors flex items-center ${filterType === 'KAYU' ? 'bg-orange-100 text-orange-800 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <HardHat size={14} className="mr-1" /> Kayu
                        </button>
                        <button
                            onClick={() => { setFilterType('BESI'); navigate('/workshop/orders?type=BESI'); }}
                            className={`px-3 py-1 text-sm rounded-md transition-colors flex items-center ${filterType === 'BESI' ? 'bg-slate-200 text-slate-800 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Cog size={14} className="mr-1" /> Besi
                        </button>
                    </div>

                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                    >
                        <option value="">Semua Status</option>
                        <option value="DRAFT">DRAFT</option>
                        <option value="PENDING">PENDING</option>
                        <option value="IN_PROGRESS">IN PROGRESS</option>
                        <option value="QUALITY_CHECK">QUALITY CHECK</option>
                        <option value="COMPLETED">COMPLETED</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kode & Judul</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipe</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pemohon</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tgl / Deadline</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-10 text-center text-gray-500">
                                        <div className="flex justify-center items-center space-x-2">
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600"></div>
                                            <span>Memuat data...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-10 text-center text-gray-500">Tidak ada pesanan yang ditemukan.</td>
                                </tr>
                            ) : (
                                filteredOrders.map((order) => (
                                    <tr key={order.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-bold text-emerald-600">{order.code}</div>
                                            <div className="text-sm text-gray-900 truncate max-w-xs" title={order.title}>{order.title}</div>
                                            <div className="text-xs text-gray-500 mt-1">{order._count?.items || 0} Item</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {order.workshopType === 'KAYU' ? (
                                                <span className="flex items-center text-xs font-medium text-orange-700 bg-orange-50 px-2 py-1 rounded border border-orange-100 w-max">
                                                    <HardHat size={12} className="mr-1" /> Kayu
                                                </span>
                                            ) : (
                                                <span className="flex items-center text-xs font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200 w-max">
                                                    <Cog size={12} className="mr-1" /> Besi
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{order.requestedBy?.name || '-'}</div>
                                            <div className="text-xs text-gray-500">{order.unit?.name || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <div className="flex items-center text-gray-600 mb-1">
                                                <Calendar size={14} className="mr-1.5" />
                                                {new Date(order.orderDate).toLocaleDateString('id-ID')}
                                            </div>
                                            {order.deadline && (
                                                <div className="flex items-center text-red-500 text-xs font-medium">
                                                    Target: {new Date(order.deadline).toLocaleDateString('id-ID')}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getStatusBadge(order.status)}
                                            {order.priority === 'URGENT' && <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-[10px] rounded uppercase font-bold">Urgent</span>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end space-x-2">
                                                <Link to={`/workshop/orders/${order.id}`} className="text-blue-600 hover:text-blue-900 p-1.5 hover:bg-blue-50 rounded" title="Lihat Detail">
                                                    <Eye size={18} />
                                                </Link>
                                                {(order.status === 'DRAFT' || order.status === 'PENDING') && (
                                                    <button onClick={() => handleDelete(order.id, order.code)} className="text-red-600 hover:text-red-900 p-1.5 hover:bg-red-50 rounded" title="Hapus">
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default WorkshopOrderList;
