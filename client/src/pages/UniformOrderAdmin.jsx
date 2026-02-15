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
                `${oi.itemName || oi.item?.name || 'Item'} (${oi.size || oi.item?.size || '-'}) x${oi.quantity}`
            ).join('\n');
        }

        // 3. Fallback: Raw Note
        return order.note || '-';
    };

    const handleItemStatus = async (itemId, newStatus, pickupDetails = null) => {
        try {
            await api.put(`/uniform-order/admin/items/${itemId}/status`, { status: newStatus, pickupDetails });
            fetchOrders();
        } catch (e) { alert(e.response?.data?.error || 'Gagal'); }
    };

    const handleItemNotify = async (itemId, type, day = '') => {
        try {
            await api.post(`/uniform-order/admin/items/${itemId}/notify`, { type, day });
            alert('Notifikasi WhatsApp telah dikirim ke pemesan');
            fetchOrders();
        } catch (e) { alert(e.response?.data?.error || 'Gagal mengirim notifikasi'); }
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
            <div className="space-y-4">
                {loading ? (
                    <div className="p-8 text-center text-slate-400 bg-white rounded-xl border">Loading...</div>
                ) : orders.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 bg-white rounded-xl border">Belum ada pesanan.</div>
                ) : orders.map(order => (
                    <div key={order.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden transition-all duration-300">
                        {/* Header Order */}
                        <div className="p-4 flex flex-wrap items-center gap-4 bg-slate-50/50">
                            <div className="font-mono font-bold text-indigo-600 w-32">{order.code}</div>
                            <div className="flex-1">
                                <div className="font-bold text-slate-800">{order.studentName} <span className="text-xs font-normal text-slate-500">({order.customerUnit})</span></div>
                                <div className="text-[10px] text-slate-500 uppercase tracking-tight">Pemesan: {order.customerName || '-'} • 📱 {order.customerPhone}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-[10px] text-slate-400 uppercase">Status</div>
                                <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColor[order.status]}`}>{statusLabel[order.status]}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-[10px] text-slate-400 uppercase">Tanggal</div>
                                <div className="text-xs font-medium">{new Date(order.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' })}</div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                                    className="p-2 hover:bg-white rounded-lg transition border border-transparent hover:border-slate-200"
                                >
                                    {expandedId === order.id ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                                </button>
                                <button onClick={() => handleDelete(order.id)} className="p-2 text-slate-300 hover:text-red-500 transition" title="Hapus">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Collapsible Content */}
                        {expandedId === order.id && (
                            <div className="p-4 bg-white border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                                    <ClipboardList size={14} /> Rincian Item Pesanan
                                </h4>

                                <div className="space-y-3">
                                    {(order.items || []).length > 0 ? (
                                        order.items.map(item => (
                                            <div key={item.id} className="flex flex-wrap items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                <div className="flex-1">
                                                    <div className="font-bold text-slate-700 text-sm">{item.itemName || 'Item'}</div>
                                                    <div className="text-xs text-slate-500">Ukuran: <span className="font-bold">{item.size || '-'}</span> • Qty: <span className="font-bold">{item.quantity}</span></div>
                                                    {item.pickupDetails && <div className="text-[10px] text-green-600 mt-1 font-medium bg-green-50 px-2 py-0.5 rounded inline-block">Siap Diambil: {item.pickupDetails}</div>}
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {/* Status Item */}
                                                    <span className={`text-[10px] font-bold px-2 py-1 rounded inline-block
                                                        ${item.status === 'READY' ? 'bg-green-100 text-green-700' :
                                                            item.status === 'NO_STOCK' ? 'bg-red-100 text-red-700' :
                                                                item.status === 'DONE' ? 'bg-indigo-100 text-indigo-700' : 'bg-yellow-100 text-yellow-700'}
                                                    `}>
                                                        {item.status === 'PENDING' ? 'Menunggu' : item.status === 'READY' ? 'Sedia' : item.status === 'NO_STOCK' ? 'Kosong' : 'Selesai'}
                                                    </span>

                                                    {/* Processing Options */}
                                                    {item.status !== 'DONE' && (
                                                        <div className="flex gap-1">
                                                            {/* Sedia Button */}
                                                            <div className="relative group">
                                                                <button className="text-[10px] bg-white border border-green-200 text-green-600 px-2 py-1 rounded hover:bg-green-600 hover:text-white font-bold transition">
                                                                    SEDIA
                                                                </button>
                                                                <div className="absolute right-0 bottom-full mb-1 bg-white border shadow-xl rounded-lg p-2 invisible group-hover:visible z-50 w-48">
                                                                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-2 border-b pb-1">PIlih Hari Jemput</div>
                                                                    <div className="grid grid-cols-1 gap-1">
                                                                        {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'].map(day => (
                                                                            <button
                                                                                key={day}
                                                                                onClick={() => {
                                                                                    handleItemStatus(item.id, 'READY', day);
                                                                                    handleItemNotify(item.id, 'READY', day);
                                                                                }}
                                                                                className="text-left py-1.5 px-2 hover:bg-indigo-50 rounded text-[10px] font-medium"
                                                                            >
                                                                                {day} (07.30 - 16.00)
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Kosong Button */}
                                                            <button
                                                                onClick={() => {
                                                                    if (confirm('Kirim notifikasi stok kosong ke pemesan?')) {
                                                                        handleItemStatus(item.id, 'NO_STOCK');
                                                                        handleItemNotify(item.id, 'NO_STOCK');
                                                                    }
                                                                }}
                                                                className="text-[10px] bg-white border border-red-200 text-red-600 px-2 py-1 rounded hover:bg-red-600 hover:text-white font-bold transition"
                                                            >
                                                                KOSONG
                                                            </button>

                                                            {/* Selesai Button */}
                                                            {item.status === 'READY' && (
                                                                <button
                                                                    onClick={() => handleItemStatus(item.id, 'DONE')}
                                                                    className="text-[10px] bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 font-bold shadow-sm transition"
                                                                >
                                                                    SELESAI
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-lg border border-dashed text-center">
                                            Pesanan dibuat dalam mode lawas (Raw Note). <br />
                                            {order.note || '-'}
                                        </div>
                                    )}
                                </div>

                                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                                    <div className="text-[10px] text-slate-400">
                                        ID Pesanan: {order.id}
                                    </div>
                                    <select
                                        value={order.status}
                                        onChange={e => handleStatusChange(order.id, e.target.value)}
                                        className="text-[10px] border border-slate-200 rounded px-2 py-1 bg-white outline-none"
                                    >
                                        <option value="">Ubah Status Induk</option>
                                        {Object.entries(statusLabel).map(([k, v]) => (
                                            <option key={k} value={k}>{v}</option>
                                        ))}
                                        <option value="CANCELLED">Batalkan Pesanan</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default UniformOrderAdmin;
