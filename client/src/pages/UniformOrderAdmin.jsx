import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Filter, Trash2, ChevronDown, ChevronUp, Edit3, X, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../lib/axios';

const UNITS = ['SD', 'SMP', 'SMA', 'Pondok Putra', 'Pondok Putri', 'Yayasan'];

const statusFlow = ['PENDING', 'CONFIRMED', 'READY', 'PICKED_UP'];
const statusLabel = { PENDING: 'Menunggu', CONFIRMED: 'Dikonfirmasi', READY: 'Siap', PICKED_UP: 'Diambil', INDENT: 'Indent', CANCELLED: 'Batal' };
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
    const [filter, setFilter] = useState({ status: '', unit: '', search: '' });
    const [activeTab, setActiveTab] = useState('WARID');
    const [expandedId, setExpandedId] = useState(null);
    const [itemEdits, setItemEdits] = useState({});
    const [savingBulk, setSavingBulk] = useState(false);
    
    // Edit Modal State
    const [editModal, setEditModal] = useState({ isOpen: false, order: null });
    const [formData, setFormData] = useState({ studentName: '', customerName: '', customerPhone: '', customerUnit: '', note: '' });


    useEffect(() => {
        const timer = setTimeout(() => {
            fetchOrders();
        }, 500);
        return () => clearTimeout(timer);
    }, [filter]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filter.status) params.append('status', filter.status);
            if (filter.unit) params.append('unit', filter.unit);
            if (filter.search) params.append('search', filter.search);
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

    const openEditModal = (order) => {
        setFormData({
            studentName: order.studentName || '',
            customerName: order.customerName || '',
            customerPhone: order.customerPhone || '',
            customerUnit: order.customerUnit || '',
            note: order.note || ''
        });
        setEditModal({ isOpen: true, order });
    };

    const handleEditOrderSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/uniform-order/admin/orders/${editModal.order.id}/details`, formData);
            setEditModal({ isOpen: false, order: null });
            fetchOrders();
        } catch (e) {
            alert(e.response?.data?.error || 'Gagal menyimpan');
        }
    };

    const getOrderDisplay = (order) => {
        if (order.note && order.note.includes('ITEM PESANAN:')) {
            return order.note.split('ITEM PESANAN:')[1].trim();
        }
        if (order.items && order.items.length > 0) {
            return order.items.map(oi =>
                `${oi.itemName || oi.item?.name || 'Item'} (${oi.size || oi.item?.size || '-'}) x${oi.quantity}`
            ).join('\n');
        }
        return order.note || '-';
    };

    const getAllSizes = (originalSize) => {
        const defaultSizes = ['SS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', '38', '40', '42', '44', '46', '48', '50/20', '50/22', '50/24', '52/20', '52/22', '52/24', '54/20', '54/22', '54/24', '20', '20.5', '21', '21.5', '22', '22.5', '23', '23.5', '24', 'Ukuran Khusus'];
        if (originalSize && !defaultSizes.includes(originalSize)) {
            return [originalSize, ...defaultSizes];
        }
        return defaultSizes;
    };

    const handleEditItem = (itemId, updatesOrStatus, pickupDetails = null) => {
        setItemEdits(prev => {
            const currentItem = orders.flatMap(o => o.items || []).find(i => i.id === itemId);
            const existing = prev[itemId] || {
                status: currentItem?.status || 'PENDING',
                pickupDetails: currentItem?.pickupDetails || null,
                size: currentItem?.size || ''
            };
            
            let merged = {};
            if (typeof updatesOrStatus === 'object' && updatesOrStatus !== null) {
                merged = { ...existing, ...updatesOrStatus };
            } else {
                merged = { ...existing, status: updatesOrStatus, pickupDetails };
            }
            
            return {
                ...prev,
                [itemId]: merged
            };
        });
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

    const getStatusPriority = (status) => {
        if (status === 'PENDING') return 0;
        if (status === 'CONFIRMED') return 1;
        if (status === 'READY') return 2;
        if (status === 'INDENT') return 3;
        if (status === 'CANCELLED') return 4;
        if (status === 'PICKED_UP') return 5;
        return 6;
    };

    const getGender = (order) => {
        if (order.note) {
            const match = order.note.match(/GENDER:\s*([^\n]+)/i);
            if (match) return match[1].trim();
        }
        return '-';
    };

    const displayedOrders = orders.filter(order => {
        const isUnit = (order.note && order.note.includes('PESANAN UNIT INTERNAL')) ||
            (order.studentName && order.studentName.toUpperCase().includes('PESANAN UNIT'));
        return activeTab === 'WARID' ? !isUnit : isUnit;
    }).sort((a, b) => {
        const prioA = getStatusPriority(a.status);
        const prioB = getStatusPriority(b.status);
        if (prioA !== prioB) return prioA - prioB;
        
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        if (prioA <= 3) {
            return dateA - dateB; // Terlama di atas untuk pesanan aktif
        }
        return dateB - dateA; // Terbaru di atas untuk pesanan selesai/batal
    });

    const handleExport = () => {
        if (displayedOrders.length === 0) {
            alert('Tidak ada data untuk diekspor');
            return;
        }
        
        const exportData = displayedOrders.map((order, index) => {
            return {
                'No': index + 1,
                'ID Pesanan': order.id,
                'Kode Transaksi': order.code,
                'Tanggal': new Date(order.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                'Jenis Pesanan': activeTab === 'WARID' ? 'Wali Murid' : 'Unit Internal',
                'Status': statusLabel[order.status] || order.status,
                'Nama Siswa / Barang': order.studentName,
                'Pemesan': order.customerName || '-',
                'No HP': order.customerPhone || '-',
                'Unit / Kelas': order.customerUnit || '-',
                'Gender': getGender(order),
                'Rincian Pesanan': getOrderDisplay(order).replace(/\n/g, ', '),
                'Catatan': order.note || '-'
            };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data Pesanan");
        XLSX.writeFile(wb, `Pesanan_Seragam_${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><ClipboardList className="text-indigo-600" /> Pesanan</h1>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleExport} className="text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded-lg font-bold border border-green-200 hover:bg-green-100 transition flex items-center gap-1 shadow-sm">
                        <Download size={14} /> Ekspor
                    </button>
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
            <div className="flex flex-wrap gap-3 items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg flex-1 min-w-[200px]">
                    <Filter size={16} className="text-slate-400" />
                    <input
                        type="text"
                        placeholder="Cari nama atau kode..."
                        className="bg-transparent border-none outline-none text-sm w-full font-medium"
                        value={filter.search}
                        onChange={e => setFilter({ ...filter, search: e.target.value })}
                    />
                </div>
                <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })} className="bg-slate-50 border-none rounded-lg px-3 py-1.5 text-sm font-medium outline-none">
                    <option value="">Semua Status</option>
                    {Object.entries(statusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select value={filter.unit} onChange={e => setFilter({ ...filter, unit: e.target.value })} className="bg-slate-50 border-none rounded-lg px-3 py-1.5 text-sm font-medium outline-none">
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
                                <div className="font-bold text-slate-800">
                                    {order.studentName} <span className="text-xs font-normal text-slate-500">({order.customerUnit} • {getGender(order)})</span>
                                </div>
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
                                <button onClick={() => openEditModal(order)} className="p-2 text-slate-300 hover:text-indigo-500 transition" title="Edit Orderan">
                                    <Edit3 size={16} />
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
                                                            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                                                <span className="flex items-center">Ukuran: 
                                                                    <select
                                                                        value={itemEdits[item.id]?.size || item.size || ''}
                                                                        onChange={(e) => handleEditItem(item.id, { size: e.target.value })}
                                                                        className="text-xs border border-slate-200 rounded px-1.5 py-0.5 bg-white font-bold text-slate-700 outline-none cursor-pointer focus:border-indigo-500 ml-1.5"
                                                                    >
                                                                        {getAllSizes(item.size).map(sz => (
                                                                            <option key={sz} value={sz}>{sz}</option>
                                                                        ))}
                                                                    </select>
                                                                </span>
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

                                                            {/* Processing Options - Dropdown */}
                                                            <div className="flex items-center gap-2 ml-2">
                                                                <select
                                                                    value={currentStatus}
                                                                    onChange={(e) => handleEditItem(item.id, e.target.value)}
                                                                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white font-medium text-slate-600 hover:border-indigo-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all cursor-pointer"
                                                                >
                                                                    <option value="PENDING">Menunggu</option>
                                                                    <option value="READY">Sedia</option>
                                                                    <option value="NO_STOCK">Kosong</option>
                                                                    <option value="INDENT">Indent (Pesan)</option>
                                                                    <option value="CANCEL_ITEM">Batal / Ditolak</option>
                                                                    <option value="DONE">Selesai (Sudah Diambil)</option>
                                                                </select>

                                                                {currentStatus === 'READY' && (
                                                                    <select
                                                                        value={currentPickup || ''}
                                                                        onChange={(e) => handleEditItem(item.id, 'READY', e.target.value)}
                                                                        className="text-xs border border-green-200 rounded-lg px-2 py-1.5 bg-green-50 font-medium text-green-700 outline-none cursor-pointer"
                                                                    >
                                                                        <option value="">-- Hari Jemput --</option>
                                                                        <option value="Senin">Senin</option>
                                                                        <option value="Selasa">Selasa</option>
                                                                        <option value="Rabu">Rabu</option>
                                                                        <option value="Kamis">Kamis</option>
                                                                        <option value="Jumat">Jumat</option>
                                                                    </select>
                                                                )}
                                                            </div>
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

            {/* Edit Order Modal */}
            {editModal.isOpen && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Edit3 size={18} className="text-indigo-600" />
                                Edit Detail Pesanan
                            </h3>
                            <button onClick={() => setEditModal({ isOpen: false, order: null })} className="text-slate-400 hover:text-slate-600 transition">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleEditOrderSubmit} className="p-4 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Nama Siswa / Barang</label>
                                <input 
                                    type="text" 
                                    value={formData.studentName} 
                                    onChange={e => setFormData({...formData, studentName: e.target.value})}
                                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Nama Pemesan</label>
                                    <input 
                                        type="text" 
                                        value={formData.customerName} 
                                        onChange={e => setFormData({...formData, customerName: e.target.value})}
                                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">No HP / WA</label>
                                    <input 
                                        type="text" 
                                        value={formData.customerPhone} 
                                        onChange={e => setFormData({...formData, customerPhone: e.target.value})}
                                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Unit</label>
                                <select 
                                    value={formData.customerUnit} 
                                    onChange={e => setFormData({...formData, customerUnit: e.target.value})}
                                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                                >
                                    <option value="">Pilih Unit</option>
                                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                    <option value="Lainnya">Lainnya</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Catatan Tambahan</label>
                                <textarea 
                                    value={formData.note} 
                                    onChange={e => setFormData({...formData, note: e.target.value})}
                                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 h-24"
                                />
                            </div>
                            <div className="pt-4 flex justify-end gap-2">
                                <button 
                                    type="button" 
                                    onClick={() => setEditModal({ isOpen: false, order: null })}
                                    className="px-4 py-2 text-sm font-bold text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
                                >
                                    Batal
                                </button>
                                <button 
                                    type="submit"
                                    className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition"
                                >
                                    Simpan Perubahan
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UniformOrderAdmin;
