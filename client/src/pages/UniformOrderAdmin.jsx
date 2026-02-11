import { useState, useEffect } from 'react';
import { ClipboardList, Filter, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../lib/axios';

const UNITS = ['TK', 'TAUD', 'SD', 'SMP', 'SMA', 'Pondok Putra', 'Pondok Putri', 'MIT', 'Yayasan'];

const statusFlow = ['PENDING', 'CONFIRMED', 'READY', 'PICKED_UP'];
const statusLabel = { PENDING: 'Menunggu', CONFIRMED: 'Dikonfirmasi', READY: 'Siap', PICKED_UP: 'Diambil', CANCELLED: 'Batal' };
const statusColor = {
    PENDING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    CONFIRMED: 'bg-blue-100 text-blue-700 border-blue-200',
    READY: 'bg-green-100 text-green-700 border-green-200',
    PICKED_UP: 'bg-slate-100 text-slate-600 border-slate-200',
    CANCELLED: 'bg-red-100 text-red-600 border-red-200'
};

const UniformOrderAdmin = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({ status: '', unit: '' });
    const [expandedId, setExpandedId] = useState(null);

    useEffect(() => { fetchOrders(); }, [filter]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filter.status) params.append('status', filter.status);
            if (filter.unit) params.append('unit', filter.unit);
            const res = await api.get(`/uniform-order/admin/orders?${params}`);
            setOrders(res.data);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const handleStatusChange = async (id, newStatus) => {
        if (!confirm(`Ubah status ke "${statusLabel[newStatus]}"?`)) return;
        try {
            await api.put(`/uniform-order/admin/${id}`, { status: newStatus });
            fetchOrders();
        } catch (e) { alert(e.response?.data?.error || 'Gagal'); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Hapus pesanan ini?')) return;
        try {
            await api.delete(`/uniform-order/admin/${id}`);
            fetchOrders();
        } catch (e) { alert('Gagal menghapus'); }
    };

    // Helper to extract displayable order content
    const getOrderDisplay = (order) => {
        // 1. Decoupled Mode: Check for "ITEM PESANAN:" marker in Note
        if (order.note && order.note.includes('ITEM PESANAN:')) {
            return order.note.split('ITEM PESANAN:')[1].trim();
        }

        // 2. Legacy/Standard Mode: Check items array
        if (order.items && order.items.length > 0) {
            return order.items.map(oi =>
                `${oi.item?.name || 'Item'} (${oi.item?.size || '-'}) x${oi.quantity}`
            ).join('\n');
        }

        // 3. Fallback: Raw Note
        return order.note || '-';
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><ClipboardList className="text-indigo-600" /> Pesanan Seragam</h1>
                </div>
                <a href="/pesan-seragam" target="_blank" className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold border border-indigo-200 hover:bg-indigo-100 transition">
                    Buka Halaman Publik ↗
                </a>
            </div>

            {/* Filter */}
            <div className="flex flex-wrap gap-3 items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <Filter size={16} className="text-slate-400" />
                <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })} className="bg-slate-50 border-none rounded-lg px-3 py-1.5 text-sm font-medium">
                    <option value="">Semua Status</option>
                    {Object.entries(statusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select value={filter.unit} onChange={e => setFilter({ ...filter, unit: e.target.value })} className="bg-slate-50 border-none rounded-lg px-3 py-1.5 text-sm font-medium">
                    <option value="">Semua Unit</option>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <span className="ml-auto text-xs text-slate-400">{orders.length} pesanan</span>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-xs">
                        <tr>
                            <th className="p-4 w-[10%]">Kode</th>
                            <th className="p-4 w-[15%]">Pemesan</th>
                            <th className="p-4 w-[15%]">Siswa</th>
                            <th className="p-4 w-[10%] text-center">Unit</th>
                            <th className="p-4 w-[25%]">Pesanan</th>
                            <th className="p-4 w-[10%] text-center">Status</th>
                            <th className="p-4 w-[10%] text-center">Tanggal</th>
                            <th className="p-4 w-[5%] text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={8} className="p-8 text-center text-slate-400">Loading...</td></tr>
                        ) : orders.length === 0 ? (
                            <tr><td colSpan={8} className="p-8 text-center text-slate-400">Belum ada pesanan.</td></tr>
                        ) : orders.map(order => (
                            <tr key={order.id} className="hover:bg-slate-50 transition">
                                {/* 1. Kode */}
                                <td className="p-4 font-mono font-bold text-indigo-600 align-top">{order.code}</td>

                                {/* 2. Pemesan */}
                                <td className="p-4 align-top">
                                    <div className="font-bold text-slate-800">{order.customerName || '-'}</div>
                                    <div className="text-xs text-slate-500 flex items-center gap-1">
                                        📱 {order.customerPhone}
                                    </div>
                                </td>

                                {/* 3. Siswa */}
                                <td className="p-4 align-top">
                                    <div className="font-bold">{order.studentName}</div>
                                    {order.studentClass && <div className="text-xs text-slate-400">Kelas {order.studentClass}</div>}
                                </td>

                                {/* 4. Unit */}
                                <td className="p-4 text-center align-top">
                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-600">{order.customerUnit}</span>
                                </td>

                                {/* 5. Pesanan */}
                                <td className="p-4 align-top">
                                    <div className="text-xs font-mono bg-slate-50 p-2 rounded border border-slate-100 whitespace-pre-wrap">
                                        {getOrderDisplay(order)}
                                    </div>
                                    {/* Show extra note if exists and differs from displayed content */}
                                    {order.note && !order.note.includes('ITEM PESANAN:') && (
                                        <div className="text-[10px] text-slate-400 mt-1 italic">
                                            Catatan: {order.note}
                                        </div>
                                    )}
                                </td>

                                {/* 6. Status */}
                                <td className="p-4 text-center align-top">
                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${statusColor[order.status]}`}>
                                        {statusLabel[order.status]}
                                    </span>
                                </td>

                                {/* 7. Tanggal */}
                                <td className="p-4 text-center text-xs text-slate-500 align-top">
                                    {new Date(order.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                </td>

                                {/* 8. Aksi */}
                                <td className="p-4 text-center align-top">
                                    <div className="flex flex-col gap-2 items-center">
                                        {order.status !== 'PICKED_UP' && order.status !== 'CANCELLED' && (
                                            <select
                                                value=""
                                                onChange={e => { if (e.target.value) handleStatusChange(order.id, e.target.value); }}
                                                className="text-[10px] border rounded px-1 py-1 bg-white w-full"
                                            >
                                                <option value="">Ubah Status</option>
                                                {statusFlow.filter(s => s !== order.status).map(s => (
                                                    <option key={s} value={s}>{statusLabel[s]}</option>
                                                ))}
                                                <option value="CANCELLED">Batalkan</option>
                                            </select>
                                        )}
                                        <button onClick={() => handleDelete(order.id)} className="text-slate-300 hover:text-red-500 transition" title="Hapus">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default UniformOrderAdmin;
