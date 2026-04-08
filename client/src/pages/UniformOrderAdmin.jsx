import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Filter, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../lib/axios';

const UNITS = ['SD', 'SMP', 'SMA', 'Pondok Putra', 'Pondok Putri', 'Yayasan'];

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
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({ status: '', unit: '' });
    const [activeTab, setActiveTab] = useState('WARID');
    const [expandedId, setExpandedId] = useState(null);
    const [itemEdits, setItemEdits] = useState({});
    const [savingBulk, setSavingBulk] = useState(false);

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
    const handleEditItem = (itemId, newStatus, pickupDetails = null) => {
        setItemEdits(prev => ({
            ...prev,
            [itemId]: { status: newStatus, pickupDetails }
        }));
    };

    const handleBulkSave = async (orderId) => {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;
        
        const updates = order.items
            .map(item => {
                if (itemEdits[item.id]) {
                    return { id: item.id, ...itemEdits[item.id] };
                }
                return null;
            })
            .filter(u => u !== null);

        if (updates.length === 0) return;

        if (!confirm('Simpan perubahan dan otomatis kirim 1 pesan WA rekapan ke pemesan?')) return;

        setSavingBulk(true);
        try {
            await api.put(`/uniform-order/admin/orders/${orderId}/bulk-items`, { updates });
            
            // Remove saved edits from local state
            const newEdits = { ...itemEdits };
            updates.forEach(u => delete newEdits[u.id]);
            setItemEdits(newEdits);
            
            alert('Sukses menyimpan dan WA rekap terkirim!');
            fetchOrders();
        } catch (e) {
            alert(e.response?.data?.error || 'Gagal menyimpan data');
        } finally {
            setSavingBulk(false);
        }
    };

    const handleItemStatusNoNotify = async (itemId, newStatus) => {
        if (!confirm(`Tandai sebagai selesai tanpa kirim WA? (Stok gudang akan berkurang otomatis)`)) return;
        try {
            await api.put(`/uniform-order/admin/items/${itemId}/status`, { status: newStatus });
            alert('Status berhasil diubah dan stok terpotong!');
            fetchOrders();
        } catch (e) { alert(e.response?.data?.error || 'Gagal'); }
    };

    const displayedOrders = orders.filter(order => {
        const isUnit = (order.note && order.note.includes('PESANAN UNIT INTERNAL')) || 
                       (order.studentName && order.studentName.toUpperCase().includes('PESANAN UNIT'));
        return activeTab === 'WARID' ? !isUnit : isUnit;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><ClipboardList className="text-indigo-600" /> Pesanan</h1>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => navigate('/gudang/pesanan/unit')} className="text-xs bg-white text-indigo-600 px-3 py-1.5 rounded-lg font-bold border border-indigo-200 hover:bg-indigo-50 transition">
                        Pesanan Unit
                    </button>
                    <a href="/pesan-seragam" target="_blank" className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold border border-indigo-200 hover:bg-indigo-100 transition">
                        Pesanan Warid ↗
                    </a>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl w-max">
                <button 
                    onClick={() => setActiveTab('WARID')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'WARID' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                >Pesanan Warid (Wali Murid)</button>
                <button 
                    onClick={() => setActiveTab('UNIT')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'UNIT' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                >Pesanan Unit (Internal)</button>
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
                <span className="ml-auto text-xs text-slate-400">
                    {displayedOrders.length} pesanan
                </span>
            </div>

            {/* Table */}
            <div className="space-y-4">
                {loading ? (
                    <div className="p-8 text-center text-slate-400 bg-white rounded-xl border">Loading...</div>
                ) : displayedOrders.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 bg-white rounded-xl border">Belum ada pesanan.</div>
                ) : displayedOrders.map(order => (
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
                                        <>
                                            {order.items.map(item => {
                                                const currentStatus = itemEdits[item.id]?.status || item.status;
                                                const currentPickup = itemEdits[item.id]?.pickupDetails || item.pickupDetails;

                                                return (
                                                    <div key={item.id} className={`flex flex-wrap items-center gap-4 p-3 rounded-lg border transition-all ${itemEdits[item.id] ? 'bg-indigo-50/50 border-indigo-200 shadow-sm' : 'bg-slate-50 border-slate-100'}`}>
                                                        <div className="flex-1">
                                                            <div className="font-bold text-slate-700 text-sm">{item.itemName || 'Item'}</div>
                                                            <div className="text-xs text-slate-500 flex gap-2 mt-0.5">
                                                                <span>Ukuran: <b className="text-slate-700">{item.size || '-'}</b></span>
                                                                <span>•</span>
                                                                <span>Qty: <b className="text-slate-700">{item.quantity}</b></span>
                                                            </div>
                                                            {currentPickup && <div className="text-[10px] text-green-600 mt-1.5 font-medium bg-green-100/50 px-2 py-0.5 rounded inline-block border border-green-200">Siap Diambil: {currentPickup}</div>}
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            {/* Status Item */}
                                                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md inline-block uppercase tracking-wider
                                                                ${currentStatus === 'READY' ? 'bg-green-100 text-green-700 border border-green-200' :
                                                                    currentStatus === 'NO_STOCK' ? 'bg-red-100 text-red-700 border border-red-200' :
                                                                        currentStatus === 'CANCEL_ITEM' ? 'bg-slate-100 text-slate-500 border border-slate-200' :
                                                                            currentStatus === 'INDENT' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                                                                                currentStatus === 'DONE' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-yellow-100 text-yellow-700 border border-yellow-200'}
                                                            `}>
                                                                {currentStatus === 'PENDING' ? 'Menunggu' :
                                                                    currentStatus === 'READY' ? 'Sedia' :
                                                                        currentStatus === 'NO_STOCK' ? 'Kosong' :
                                                                            currentStatus === 'INDENT' ? 'Indent' :
                                                                                currentStatus === 'CANCEL_ITEM' ? (activeTab === 'UNIT' ? 'Ditolak' : 'Batal') : 'Selesai'}
                                                            </span>

                                                            {/* Processing Options */}
                                                            {currentStatus !== 'DONE' && currentStatus !== 'CANCEL_ITEM' && (
                                                                <div className="flex gap-1 ml-2">
                                                                    {activeTab === 'UNIT' ? (
                                                                        <>
                                                                            <button
                                                                                onClick={() => handleEditItem(item.id, 'READY')}
                                                                                className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-600 hover:text-white font-bold shadow-sm transition"
                                                                            >
                                                                                TERIMA (APPROVE)
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleEditItem(item.id, 'CANCEL_ITEM')}
                                                                                className="text-[10px] bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-600 hover:text-white font-bold shadow-sm transition"
                                                                            >
                                                                                TOLAK
                                                                            </button>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            {/* Sedia Button (Visible for Pending, No Stock, and Indent) */}
                                                                            {(currentStatus === 'PENDING' || currentStatus === 'NO_STOCK' || currentStatus === 'INDENT') && (
                                                                                <div className="relative group">
                                                                                    <button className="text-[10px] bg-white border border-green-200 text-green-600 px-2 py-1 rounded hover:bg-green-600 hover:text-white font-bold transition">
                                                                                        SEDIA
                                                                                    </button>
                                                                                    <div className="absolute right-0 bottom-full mb-1 bg-white border shadow-xl rounded-lg p-2 invisible group-hover:visible z-50 w-48">
                                                                                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-2 border-b pb-1">Pilih Hari Jemput</div>
                                                                                        <div className="grid grid-cols-1 gap-1">
                                                                                            {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'].map(day => (
                                                                                                <button
                                                                                                    key={day}
                                                                                                    onClick={() => handleEditItem(item.id, 'READY', day)}
                                                                                                    className="text-left py-1.5 px-2 hover:bg-indigo-50 rounded text-[10px] font-medium"
                                                                                                >
                                                                                                    {day} (07.30 - 16.00)
                                                                                                </button>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            )}

                                                                            {/* Kosong Button */}
                                                                            {currentStatus === 'PENDING' && (
                                                                                <button
                                                                                    onClick={() => handleEditItem(item.id, 'NO_STOCK')}
                                                                                    className="text-[10px] bg-white border border-red-200 text-red-600 px-2 py-1 rounded hover:bg-red-600 hover:text-white font-bold transition"
                                                                                >
                                                                                    KOSONG
                                                                                </button>
                                                                            )}

                                                                            {/* Indent (PESAN) Button - Visible when NO_STOCK */}
                                                                            {currentStatus === 'NO_STOCK' && (
                                                                                <button
                                                                                    onClick={() => handleEditItem(item.id, 'INDENT')}
                                                                                    className="text-[10px] bg-white border border-orange-200 text-orange-600 px-2 py-1 rounded hover:bg-orange-600 hover:text-white font-bold transition"
                                                                                >
                                                                                    PESAN (INDENT)
                                                                                </button>
                                                                            )}

                                                                            {/* Batal Button - Visible when NO_STOCK or INDENT */}
                                                                            {(currentStatus === 'NO_STOCK' || currentStatus === 'INDENT') && (
                                                                                <button
                                                                                    onClick={() => handleEditItem(item.id, 'CANCEL_ITEM')}
                                                                                    className="text-[10px] bg-white border border-slate-200 text-slate-500 px-2 py-1 rounded hover:bg-slate-500 hover:text-white font-bold transition"
                                                                                >
                                                                                    BATAL
                                                                                </button>
                                                                            )}

                                                                            {/* Selesai Button */}
                                                                            {currentStatus === 'READY' && (
                                                                                <button
                                                                                    onClick={() => handleItemStatusNoNotify(item.id, 'DONE')}
                                                                                    className="text-[10px] bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 font-bold shadow-sm transition border border-indigo-700"
                                                                                    title="Selesaikan pesanan dan kurangi stok tanpa pemberitahuan WA"
                                                                                >
                                                                                    SELESAI
                                                                                </button>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {/* Bulk Save Section */}
                                            {order.items.some(i => itemEdits[i.id]) && (
                                                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between bg-indigo-50/80 p-4 rounded-xl shadow-sm border border-indigo-200 animate-in slide-in-from-bottom-2">
                                                    <div className="mb-3 sm:mb-0 text-center sm:text-left">
                                                        <h5 className="font-bold text-indigo-800 text-sm">Belum Disimpan</h5>
                                                        <p className="text-xs text-indigo-600 mt-0.5">Ada perubahan status. Klik simpan untuk merekam ke database & mengirim <b>1 WA Rekap.</b></p>
                                                    </div>
                                                    <button 
                                                        disabled={savingBulk}
                                                        onClick={() => handleBulkSave(order.id)}
                                                        className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-bold shadow-md hover:bg-indigo-700 transition flex items-center gap-2 text-sm disabled:opacity-50"
                                                    >
                                                        {savingBulk ? 'Menyimpan...' : 'Simpan & Kirim Pesan WA'}
                                                    </button>
                                                </div>
                                            )}
                                        </>
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
