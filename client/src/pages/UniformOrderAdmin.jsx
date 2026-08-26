import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ClipboardList, Filter, Trash2, ChevronDown, ChevronUp, Edit3, X,
    Download, FileSpreadsheet, Layers, Package, Calendar, Settings2
} from 'lucide-react';
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

    // Export Menu & Modal State
    const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [exportOptions, setExportOptions] = useState({
        format: 'summary', // 'summary' | 'items' | 'stock'
        source: 'current', // 'current' | 'all' | 'warid' | 'unit'
        timeRange: 'all', // 'all' | 'today' | '7days' | 'month' | 'custom'
        startDate: '',
        endDate: ''
    });
    const exportDropdownRef = useRef(null);

    // Close export dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target)) {
                setExportDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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

    // --- EXPORT LOGIC ---

    // 1. Rekap Per Pesanan / Transaksi
    const exportOrdersSummary = (targetOrders, filenameSuffix = '') => {
        if (!targetOrders || targetOrders.length === 0) {
            alert('Tidak ada data pesanan untuk diekspor');
            return;
        }

        const exportData = targetOrders.map((order, index) => {
            const isUnit = (order.note && order.note.includes('PESANAN UNIT INTERNAL')) ||
                (order.studentName && order.studentName.toUpperCase().includes('PESANAN UNIT'));
            const totalQty = (order.items && order.items.length > 0)
                ? order.items.reduce((sum, it) => sum + (it.quantity || 1), 0)
                : 1;

            return {
                'No': index + 1,
                'Kode Transaksi': order.code,
                'Tanggal': new Date(order.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                'Jenis Pesanan': isUnit ? 'Unit Internal' : 'Wali Murid',
                'Status': statusLabel[order.status] || order.status,
                'Nama Siswa / Barang': order.studentName,
                'Pemesan': order.customerName || '-',
                'No HP': order.customerPhone || '-',
                'Unit / Kelas': order.customerUnit || '-',
                'Gender': getGender(order),
                'Total Qty': totalQty,
                'Rincian Pesanan': getOrderDisplay(order).replace(/\n/g, ', '),
                'Catatan': order.note || '-'
            };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Rekap Pesanan");
        const suffix = filenameSuffix || activeTab;
        XLSX.writeFile(wb, `Rekap_Pesanan_Seragam_${suffix}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // 2. Rincian Per Item / Barang
    const exportItemsDetail = (targetOrders, filenameSuffix = '') => {
        if (!targetOrders || targetOrders.length === 0) {
            alert('Tidak ada data pesanan untuk diekspor');
            return;
        }

        const exportData = [];
        let no = 1;

        targetOrders.forEach(order => {
            const isUnit = (order.note && order.note.includes('PESANAN UNIT INTERNAL')) ||
                (order.studentName && order.studentName.toUpperCase().includes('PESANAN UNIT'));
            const dateStr = new Date(order.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const gender = getGender(order);

            if (order.items && order.items.length > 0) {
                order.items.forEach(item => {
                    exportData.push({
                        'No': no++,
                        'Kode Transaksi': order.code,
                        'Tanggal Pesan': dateStr,
                        'Jenis Pesanan': isUnit ? 'Unit Internal' : 'Wali Murid',
                        'Status Pesanan': statusLabel[order.status] || order.status,
                        'Nama Siswa / Barang': order.studentName,
                        'Unit / Jenjang': order.customerUnit || '-',
                        'Gender': gender,
                        'Nama Barang / Seragam': item.itemName || item.item?.name || 'Item Seragam',
                        'Ukuran': item.size || item.item?.size || '-',
                        'Jumlah (Qty)': item.quantity || 1,
                        'Status Item': statusLabel[item.status] || item.status || statusLabel[order.status],
                        'Rincian Pengambilan': item.pickupDetails ? `Diambil: ${item.pickupDetails.takenQty || 0}, Sisa: ${item.pickupDetails.remainingQty || 0}` : '-',
                        'Pemesan': order.customerName || '-',
                        'No HP (WA)': order.customerPhone || '-',
                        'Catatan Pesanan': order.note || '-'
                    });
                });
            } else {
                exportData.push({
                    'No': no++,
                    'Kode Transaksi': order.code,
                    'Tanggal Pesan': dateStr,
                    'Jenis Pesanan': isUnit ? 'Unit Internal' : 'Wali Murid',
                    'Status Pesanan': statusLabel[order.status] || order.status,
                    'Nama Siswa / Barang': order.studentName,
                    'Unit / Jenjang': order.customerUnit || '-',
                    'Gender': gender,
                    'Nama Barang / Seragam': getOrderDisplay(order).replace(/\n/g, ', '),
                    'Ukuran': '-',
                    'Jumlah (Qty)': 1,
                    'Status Item': statusLabel[order.status] || order.status,
                    'Rincian Pengambilan': '-',
                    'Pemesan': order.customerName || '-',
                    'No HP (WA)': order.customerPhone || '-',
                    'Catatan Pesanan': order.note || '-'
                });
            }
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Rincian Item");
        const suffix = filenameSuffix || activeTab;
        XLSX.writeFile(wb, `Rincian_Item_Pesanan_${suffix}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // 3. Rekap Akumulasi Kebutuhan Stok (Per Barang & Ukuran)
    const exportStockRequirementSummary = (targetOrders, filenameSuffix = '') => {
        if (!targetOrders || targetOrders.length === 0) {
            alert('Tidak ada data pesanan untuk diekspor');
            return;
        }

        const aggregate = {};

        targetOrders.forEach(order => {
            if (order.items && order.items.length > 0) {
                order.items.forEach(item => {
                    const name = item.itemName || item.item?.name || 'Item Lainnya';
                    const size = item.size || item.item?.size || '-';
                    const key = `${name}___${size}`;
                    const qty = item.quantity || 1;
                    const status = (item.status || order.status || 'PENDING').toUpperCase();

                    if (!aggregate[key]) {
                        aggregate[key] = {
                            name,
                            size,
                            totalQty: 0,
                            pendingQty: 0,
                            confirmedQty: 0,
                            readyQty: 0,
                            pickedUpQty: 0,
                            indentQty: 0,
                            cancelledQty: 0
                        };
                    }

                    aggregate[key].totalQty += qty;
                    if (status === 'PENDING') aggregate[key].pendingQty += qty;
                    else if (status === 'CONFIRMED') aggregate[key].confirmedQty += qty;
                    else if (status === 'READY') aggregate[key].readyQty += qty;
                    else if (status === 'PICKED_UP' || status === 'DONE') aggregate[key].pickedUpQty += qty;
                    else if (status === 'INDENT') aggregate[key].indentQty += qty;
                    else if (status === 'CANCELLED') aggregate[key].cancelledQty += qty;
                });
            }
        });

        const rows = Object.values(aggregate)
            .sort((a, b) => a.name.localeCompare(b.name) || a.size.localeCompare(b.size))
            .map((agg, idx) => ({
                'No': idx + 1,
                'Nama Barang / Seragam': agg.name,
                'Ukuran': agg.size,
                'Total Dipesan (Qty)': agg.totalQty,
                'Menunggu (Pending)': agg.pendingQty,
                'Dikonfirmasi': agg.confirmedQty,
                'Siap Diambil (Ready)': agg.readyQty,
                'Indent': agg.indentQty,
                'Sudah Diambil (Picked Up)': agg.pickedUpQty,
                'Batal': agg.cancelledQty
            }));

        if (rows.length === 0) {
            alert('Tidak ada item terstruktur yang ditemukan untuk direkap kebutuhan stoknya');
            return;
        }

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Rekap Kebutuhan Stok");
        const suffix = filenameSuffix || activeTab;
        XLSX.writeFile(wb, `Rekap_Kebutuhan_Stok_${suffix}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // Filter Helper for Modal Export
    const getFilteredOrdersForExport = (options) => {
        let base = [...orders];

        if (options.source === 'current') {
            base = displayedOrders;
        } else if (options.source === 'warid') {
            base = base.filter(order => {
                const isUnit = (order.note && order.note.includes('PESANAN UNIT INTERNAL')) ||
                    (order.studentName && order.studentName.toUpperCase().includes('PESANAN UNIT'));
                return !isUnit;
            });
        } else if (options.source === 'unit') {
            base = base.filter(order => {
                const isUnit = (order.note && order.note.includes('PESANAN UNIT INTERNAL')) ||
                    (order.studentName && order.studentName.toUpperCase().includes('PESANAN UNIT'));
                return isUnit;
            });
        }

        const now = new Date();
        if (options.timeRange === 'today') {
            const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            base = base.filter(o => new Date(o.createdAt) >= startToday);
        } else if (options.timeRange === '7days') {
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            base = base.filter(o => new Date(o.createdAt) >= sevenDaysAgo);
        } else if (options.timeRange === 'month') {
            const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            base = base.filter(o => new Date(o.createdAt) >= startMonth);
        } else if (options.timeRange === 'custom') {
            if (options.startDate) {
                const start = new Date(options.startDate);
                start.setHours(0, 0, 0, 0);
                base = base.filter(o => new Date(o.createdAt) >= start);
            }
            if (options.endDate) {
                const end = new Date(options.endDate);
                end.setHours(23, 59, 59, 999);
                base = base.filter(o => new Date(o.createdAt) <= end);
            }
        }

        return base;
    };

    const handleRunExport = (format, source = 'current') => {
        setExportDropdownOpen(false);
        const target = getFilteredOrdersForExport({ source, timeRange: 'all' });
        const suffix = source === 'current' ? activeTab : source.toUpperCase();
        if (format === 'summary') exportOrdersSummary(target, suffix);
        else if (format === 'items') exportItemsDetail(target, suffix);
        else if (format === 'stock') exportStockRequirementSummary(target, suffix);
    };

    const handleModalExportSubmit = (e) => {
        e.preventDefault();
        const target = getFilteredOrdersForExport(exportOptions);
        const suffix = `${exportOptions.source.toUpperCase()}_${exportOptions.timeRange}`;
        if (exportOptions.format === 'summary') exportOrdersSummary(target, suffix);
        else if (exportOptions.format === 'items') exportItemsDetail(target, suffix);
        else if (exportOptions.format === 'stock') exportStockRequirementSummary(target, suffix);
        setExportModalOpen(false);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <ClipboardList className="text-indigo-600" /> Pesanan
                    </h1>
                    <p className="text-xs text-slate-400 mt-0.5">Kelola dan rekap pesanan seragam masuk</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Menu Ekspor Dropdown */}
                    <div className="relative" ref={exportDropdownRef}>
                        <button
                            onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                            className="text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
                            title="Buka Menu Ekspor Excel"
                        >
                            <FileSpreadsheet size={16} /> Menu Ekspor <ChevronDown size={14} className={`transition-transform ${exportDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {exportDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                                <div className="px-4 py-2 border-b border-slate-100">
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ekspor Cepat ({activeTab === 'WARID' ? 'Wali Murid' : 'Unit'})</p>
                                </div>
                                <button
                                    onClick={() => handleRunExport('summary')}
                                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-2.5 transition"
                                >
                                    <ClipboardList size={16} className="text-indigo-600" />
                                    <div>
                                        <div className="font-bold">Rekap Transaksi</div>
                                        <div className="text-[10px] text-slate-400 font-normal">1 baris per nota/pesanan</div>
                                    </div>
                                </button>
                                <button
                                    onClick={() => handleRunExport('items')}
                                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-2.5 transition"
                                >
                                    <Layers size={16} className="text-emerald-600" />
                                    <div>
                                        <div className="font-bold">Rincian Per Item</div>
                                        <div className="text-[10px] text-slate-400 font-normal">Detail breakdown setiap barang & ukuran</div>
                                    </div>
                                </button>
                                <button
                                    onClick={() => handleRunExport('stock')}
                                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-2.5 transition"
                                >
                                    <Package size={16} className="text-amber-600" />
                                    <div>
                                        <div className="font-bold">Rekap Kebutuhan Stok</div>
                                        <div className="text-[10px] text-slate-400 font-normal">Total akumulasi per barang & ukuran</div>
                                    </div>
                                </button>

                                <div className="border-t border-slate-100 my-1 pt-1">
                                    <button
                                        onClick={() => { setExportDropdownOpen(false); setExportModalOpen(true); }}
                                        className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 text-xs font-bold text-indigo-600 flex items-center gap-2.5 transition"
                                    >
                                        <Settings2 size={16} />
                                        <span>Filter & Pengaturan Ekspor Lanjutan...</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <button onClick={() => navigate('/gudang/pesanan/unit')} className="text-xs sm:text-sm bg-white text-indigo-600 px-3.5 py-2 rounded-xl font-bold border border-indigo-200 hover:bg-indigo-50 transition shadow-sm">
                        Pesanan Unit
                    </button>
                    <a href="/pesan-seragam" target="_blank" className="text-xs sm:text-sm bg-indigo-50 text-indigo-600 px-3.5 py-2 rounded-xl font-bold border border-indigo-200 hover:bg-indigo-100 transition shadow-sm">
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
                                    onChange={e => setFormData({ ...formData, studentName: e.target.value })}
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
                                        onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">No HP / WA</label>
                                    <input
                                        type="text"
                                        value={formData.customerPhone}
                                        onChange={e => setFormData({ ...formData, customerPhone: e.target.value })}
                                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Unit</label>
                                <select
                                    value={formData.customerUnit}
                                    onChange={e => setFormData({ ...formData, customerUnit: e.target.value })}
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
                                    onChange={e => setFormData({ ...formData, note: e.target.value })}
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

            {/* Advanced Export Modal */}
            {exportModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-emerald-50 to-teal-50">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-2xl">
                                    <FileSpreadsheet size={22} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-base">Menu Ekspor Data Pesanan</h3>
                                    <p className="text-xs text-slate-500">Pilih format laporan dan filter data yang diinginkan</p>
                                </div>
                            </div>
                            <button onClick={() => setExportModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-white transition">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleModalExportSubmit} className="p-6 space-y-5 text-sm">
                            {/* 1. Format Ekspor */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">1. Format Laporan</label>
                                <div className="grid grid-cols-1 gap-2.5">
                                    <label className={`p-3 rounded-2xl border flex items-start gap-3 cursor-pointer transition ${exportOptions.format === 'summary' ? 'bg-indigo-50/70 border-indigo-500 ring-1 ring-indigo-500' : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'}`}>
                                        <input
                                            type="radio"
                                            name="exportFormat"
                                            value="summary"
                                            checked={exportOptions.format === 'summary'}
                                            onChange={e => setExportOptions({ ...exportOptions, format: e.target.value })}
                                            className="mt-0.5"
                                        />
                                        <div>
                                            <div className="font-bold text-slate-800 text-xs sm:text-sm">Rekap Per Transaksi (Ringkasan)</div>
                                            <div className="text-[11px] text-slate-500">1 baris per invoice/pesanan, mencakup data pemesan, status, dan ringkasan isi nota.</div>
                                        </div>
                                    </label>

                                    <label className={`p-3 rounded-2xl border flex items-start gap-3 cursor-pointer transition ${exportOptions.format === 'items' ? 'bg-emerald-50/70 border-emerald-500 ring-1 ring-emerald-500' : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'}`}>
                                        <input
                                            type="radio"
                                            name="exportFormat"
                                            value="items"
                                            checked={exportOptions.format === 'items'}
                                            onChange={e => setExportOptions({ ...exportOptions, format: e.target.value })}
                                            className="mt-0.5"
                                        />
                                        <div>
                                            <div className="font-bold text-slate-800 text-xs sm:text-sm">Rincian Per Item Barang (Detail Item)</div>
                                            <div className="text-[11px] text-slate-500">1 baris per model seragam & ukuran, status item, dan rincian pengambilan barang.</div>
                                        </div>
                                    </label>

                                    <label className={`p-3 rounded-2xl border flex items-start gap-3 cursor-pointer transition ${exportOptions.format === 'stock' ? 'bg-amber-50/70 border-amber-500 ring-1 ring-amber-500' : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'}`}>
                                        <input
                                            type="radio"
                                            name="exportFormat"
                                            value="stock"
                                            checked={exportOptions.format === 'stock'}
                                            onChange={e => setExportOptions({ ...exportOptions, format: e.target.value })}
                                            className="mt-0.5"
                                        />
                                        <div>
                                            <div className="font-bold text-slate-800 text-xs sm:text-sm">Rekap Kebutuhan Stok (Agregasi)</div>
                                            <div className="text-[11px] text-slate-500">Total akumulasi kebutuhan seragam per barang & ukuran (Siap, Pending, Indent).</div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* 2. Sumber Data */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">2. Sumber / Tipe Pesanan</label>
                                <select
                                    value={exportOptions.source}
                                    onChange={e => setExportOptions({ ...exportOptions, source: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                                >
                                    <option value="current">Sesuai Tab & Filter Saat Ini ({activeTab === 'WARID' ? 'Pesanan Wali Murid' : 'Pesanan Unit'})</option>
                                    <option value="warid">Hanya Pesanan Wali Murid (Warid)</option>
                                    <option value="unit">Hanya Pesanan Unit Internal</option>
                                    <option value="all">Semua Pesanan (Gabungan Warid & Unit)</option>
                                </select>
                            </div>

                            {/* 3. Rentang Waktu */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">3. Rentang Tanggal</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                                    {[
                                        { id: 'all', label: 'Semua Waktu' },
                                        { id: 'today', label: 'Hari Ini' },
                                        { id: '7days', label: '7 Hari Terakhir' },
                                        { id: 'month', label: 'Bulan Ini' }
                                    ].map(t => (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => setExportOptions({ ...exportOptions, timeRange: t.id })}
                                            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition border ${exportOptions.timeRange === t.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                                        <input
                                            type="radio"
                                            name="customDateRadio"
                                            checked={exportOptions.timeRange === 'custom'}
                                            onChange={() => setExportOptions({ ...exportOptions, timeRange: 'custom' })}
                                        />
                                        <span>Gunakan Rentang Tanggal Custom</span>
                                    </label>
                                    {exportOptions.timeRange === 'custom' && (
                                        <div className="grid grid-cols-2 gap-2 pt-1">
                                            <div>
                                                <span className="text-[10px] text-slate-400 block mb-1">Dari Tanggal:</span>
                                                <input
                                                    type="date"
                                                    value={exportOptions.startDate}
                                                    onChange={e => setExportOptions({ ...exportOptions, startDate: e.target.value })}
                                                    className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-indigo-500"
                                                />
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-slate-400 block mb-1">Sampai Tanggal:</span>
                                                <input
                                                    type="date"
                                                    value={exportOptions.endDate}
                                                    onChange={e => setExportOptions({ ...exportOptions, endDate: e.target.value })}
                                                    className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-indigo-500"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setExportModalOpen(false)}
                                    className="px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
                                >
                                    <Download size={16} /> Unduh File Excel
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
