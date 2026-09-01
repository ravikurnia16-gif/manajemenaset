import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, ShoppingCart, Eye, CheckCircle, XCircle, Trash2, 
  Package, Minus, Filter, ArrowRight, Check, X, Store, ShoppingBag, 
  Sparkles, Calendar, User, Building2, FileText, AlertCircle, RefreshCw, 
  Printer, ExternalLink, ArrowLeft, Clock, ShieldCheck, CheckCheck, 
  Tag, Info, AlertTriangle, Layers, ChevronRight, Copy
} from 'lucide-react';
import Swal from 'sweetalert2';
import api from '../../lib/axios';
import { getMediaUrl } from '../../lib/media';

export default function InventoryOrders() {
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Catalog search & filter states for Shopee/Tokopedia E-Commerce modal
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('SEMUA');
  const [activeMobileTab, setActiveMobileTab] = useState('catalog'); // 'catalog' | 'cart'

  // Form states for creating order
  const [formData, setFormData] = useState({
    requesterName: '',
    requesterUnit: '',
    date: new Date().toISOString().split('T')[0],
    note: '',
    items: [] // array of { itemId, qtyRequested, note }
  });

  // Form states for processing order
  const [processData, setProcessData] = useState({
    status: '',
    note: '',
    warehouseId: '',
    approvedItems: [] // array of { orderItemId, qtyApproved }
  });

  useEffect(() => {
    fetchOrders();
    fetchOptions();
  }, [statusFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/orders', { params: { status: statusFilter } });
      setOrders(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const [resItems, resWh] = await Promise.all([
        api.get('/inventory/items'),
        api.get('/inventory/warehouses')
      ]);
      setItems(resItems.data || []);
      setWarehouses(resWh.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  // Helper to extract logged-in user profile info
  const getLoggedInUserInfo = () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const name = user.name || user.fullName || user.username || '';
      let unit = '';
      if (user.unit) {
        if (typeof user.unit === 'string') unit = user.unit;
        else if (typeof user.unit === 'object' && user.unit.name) unit = user.unit.name;
      } else if (user.unitName) {
        unit = user.unitName;
      } else if (user.unit_name) {
        unit = user.unit_name;
      } else if (user.department) {
        unit = user.department;
      }
      return { name, unit };
    } catch (e) {
      return { name: '', unit: '' };
    }
  };

  // Helper untuk cek stok barang di gudang
  const getItemStockInWh = (itemId, whId) => {
    const it = items.find(i => i.id === itemId);
    if (!it || !it.stocks) return 0;
    if (whId) {
      const st = it.stocks.find(s => s.warehouseId === parseInt(whId));
      return st?.quantity || 0;
    }
    return it.totalStock || 0;
  };

  const openCreateModal = () => {
    const userInfo = getLoggedInUserInfo();
    setFormData({
      requesterName: userInfo.name,
      requesterUnit: userInfo.unit,
      date: new Date().toISOString().split('T')[0],
      note: '',
      items: []
    });
    setCatalogSearch('');
    setSelectedCategory('SEMUA');
    setActiveMobileTab('catalog');
    setIsCreateModalOpen(true);
  };

  // Cart Helper Functions
  const addToCart = (item) => {
    setFormData(prev => {
      const exists = prev.items.find(i => i.itemId === item.id);
      if (exists) return prev;
      return {
        ...prev,
        items: [...prev.items, { itemId: item.id, qtyRequested: 1, note: '' }]
      };
    });
  };

  const updateCartQty = (itemId, qty) => {
    const parsedQty = parseInt(qty);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      removeFromCart(itemId);
      return;
    }
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(i => i.itemId === itemId ? { ...i, qtyRequested: parsedQty } : i)
    }));
  };

  const updateCartNote = (itemId, note) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(i => i.itemId === itemId ? { ...i, note } : i)
    }));
  };

  const removeFromCart = (itemId) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(i => i.itemId !== itemId)
    }));
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (formData.items.length === 0) return Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Keranjang masih kosong. Pilih minimal satu barang.' });
    if (!formData.requesterName.trim()) return Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Nama pemesan wajib diisi.' });
    
    setSubmitting(true);
    try {
      await api.post('/inventory/orders', {
        ...formData,
        items: formData.items.map(i => ({
          itemId: parseInt(i.itemId),
          qtyRequested: parseInt(i.qtyRequested),
          note: i.note
        }))
      });
      setIsCreateModalOpen(false);
      fetchOrders();
      Swal.fire({
        icon: 'success',
        title: 'Pesanan Dikirim!',
        text: 'Permohonan barang logistik berhasil diajukan dan masuk ke sistem.',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal Membuat Pesanan', text: e.response?.data?.error || 'Terjadi kesalahan saat membuat pesanan' });
    } finally {
      setSubmitting(false);
    }
  };

  const openProcessModal = (order) => {
    setSelectedOrder(order);
    setCopiedCode(false);
    setProcessData({
      status: order.status || 'PENDING',
      note: order.note || '',
      warehouseId: warehouses.length === 1 ? String(warehouses[0].id) : '',
      approvedItems: (order.items || []).map(it => ({ 
        orderItemId: it.id, 
        qtyApproved: it.qtyApproved ?? it.qtyRequested 
      }))
    });
    setIsProcessModalOpen(true);
  };

  // Quick helper: Setujui semua barang 100% sesuai permintaan
  const handleApproveAllFull = () => {
    if (!selectedOrder) return;
    setProcessData(prev => ({
      ...prev,
      status: prev.status === 'PENDING' ? 'APPROVED' : prev.status,
      approvedItems: selectedOrder.items.map(it => ({
        orderItemId: it.id,
        qtyApproved: it.qtyRequested
      }))
    }));
  };

  // Quick helper: Setujui semua barang = 0 (Tolak/Kosong)
  const handleApproveAllZero = () => {
    if (!selectedOrder) return;
    setProcessData(prev => ({
      ...prev,
      approvedItems: selectedOrder.items.map(it => ({
        orderItemId: it.id,
        qtyApproved: 0
      }))
    }));
  };

  const handleProcessOrder = async (e) => {
    e.preventDefault();
    try {
      if (processData.status === 'COMPLETED' && selectedOrder.status !== 'COMPLETED' && !processData.warehouseId) {
        return Swal.fire({ icon: 'warning', title: 'Pilih Gudang', text: 'Pilih gudang sumber untuk memproses dan memotong stok barang pesanan.' });
      }

      await api.put(`/inventory/orders/${selectedOrder.id}/status`, processData);
      setIsProcessModalOpen(false);
      fetchOrders();
      Swal.fire({
        icon: 'success',
        title: 'Status Diperbarui',
        text: `Pesanan ${selectedOrder.code} berhasil diperbarui ke status ${processData.status}.`,
        timer: 2000,
        showConfirmButton: false
      });
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal Memproses', text: e.response?.data?.error || 'Terjadi kesalahan saat memproses pesanan' });
    }
  };

  const handleCopyOrderCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING': 
        return <span className="bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-full text-xs font-extrabold inline-flex items-center gap-1">⏳ Menunggu</span>;
      case 'APPROVED': 
        return <span className="bg-blue-50 text-blue-800 border border-blue-300 px-2.5 py-1 rounded-full text-xs font-extrabold inline-flex items-center gap-1">✓ Disetujui</span>;
      case 'PROCESS': 
        return <span className="bg-indigo-50 text-indigo-800 border border-indigo-300 px-2.5 py-1 rounded-full text-xs font-extrabold inline-flex items-center gap-1">🔄 Diproses</span>;
      case 'COMPLETED': 
        return <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-full text-xs font-extrabold inline-flex items-center gap-1">✓ Selesai</span>;
      case 'REJECTED': 
        return <span className="bg-rose-50 text-rose-800 border border-rose-300 px-2.5 py-1 rounded-full text-xs font-extrabold inline-flex items-center gap-1">✕ Ditolak</span>;
      default: 
        return <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs font-bold">{status}</span>;
    }
  };

  const filteredOrders = orders.filter(o => 
    o.code.toLowerCase().includes(search.toLowerCase()) ||
    o.requesterName.toLowerCase().includes(search.toLowerCase()) ||
    (o.requesterUnit || '').toLowerCase().includes(search.toLowerCase())
  );

  // Categories extracted from items list
  const categoryList = ['SEMUA', ...new Set(items.map(i => i.category?.name).filter(Boolean))];

  // Filtered Catalog Items for E-Commerce View
  const catalogItems = items.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(catalogSearch.toLowerCase()) || item.code.toLowerCase().includes(catalogSearch.toLowerCase());
    const matchCategory = selectedCategory === 'SEMUA' || item.category?.name === selectedCategory;
    return matchSearch && matchCategory;
  });

  // Calculate Total Quantity & Estimated Value in Cart
  const totalCartCount = formData.items.reduce((acc, curr) => acc + (parseInt(curr.qtyRequested) || 0), 0);
  const totalEstimatedValue = formData.items.reduce((acc, curr) => {
    const itemObj = items.find(i => i.id === curr.itemId);
    const price = itemObj?.sellingPrice || itemObj?.price || 0;
    return acc + (price * (parseInt(curr.qtyRequested) || 0));
  }, 0);

  // Stats in selected order
  const totalRequestedInOrder = selectedOrder ? (selectedOrder.items || []).reduce((acc, i) => acc + (i.qtyRequested || 0), 0) : 0;
  const totalApprovedInOrder = selectedOrder ? (processData.approvedItems || []).reduce((acc, i) => acc + (parseInt(i.qtyApproved) || 0), 0) : 0;

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-slate-50 min-h-screen">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
              <ShoppingBag size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight">
                Pesanan & Permohonan Barang Logistik
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola permohonan pengadaan barang antar unit dan proses serah terima barang gudang.
              </p>
            </div>
          </div>
        </div>

        <button 
          onClick={openCreateModal}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 text-xs sm:text-sm"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>+ Buat Pesanan Baru</span>
        </button>
      </div>

      {/* ORDERS LIST CARD */}
      <div className="bg-white shadow-sm border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 bg-slate-50/70 items-center justify-between">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Cari kode pesanan, pemesan, atau unit..."
              className="pl-10 pr-4 py-2 w-full border border-slate-200 bg-white rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-2xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-slate-400" />
            <select 
              className="border border-slate-200 bg-white px-3 py-2 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">-- Semua Status ({orders.length}) --</option>
              <option value="PENDING">Menunggu (Pending)</option>
              <option value="APPROVED">Disetujui (Approved)</option>
              <option value="PROCESS">Diproses (Process)</option>
              <option value="COMPLETED">Selesai (Completed)</option>
              <option value="REJECTED">Ditolak (Rejected)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 font-extrabold uppercase tracking-wider border-b border-slate-200">
                <th className="p-3.5">Tanggal & Kode</th>
                <th className="p-3.5">Pemohon</th>
                <th className="p-3.5">Unit Kerja</th>
                <th className="p-3.5">Jumlah Barang</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
                    Memuat data pesanan...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-400">
                    Tidak ada pesanan barang yang cocok dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-sm text-slate-800">
                        {new Date(order.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono font-bold mt-0.5">{order.code}</div>
                    </td>
                    <td className="p-3.5 font-bold text-slate-800">{order.requesterName}</td>
                    <td className="p-3.5">
                      <span className="text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-medium text-[11px]">
                        {order.requesterUnit || 'Umum'}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-700 font-bold">
                      {order.items?.length || 0} jenis barang
                    </td>
                    <td className="p-3.5">{getStatusBadge(order.status)}</td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        <a 
                          href={`/public/invoice-gudang/${order.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-lg inline-flex items-center text-xs font-bold transition-all gap-1 shadow-2xs"
                          title="Buka & Cetak Invoice / Surat Jalan Gudang"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-600" /> Invoice
                        </a>
                        <button 
                          onClick={() => openProcessModal(order)}
                          className="text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1.5 rounded-lg inline-flex items-center text-xs font-bold transition-all gap-1 shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" /> Detail & Proses
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: BUAT PESANAN BARU (E-COMMERCE VIEW) */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-slate-50 rounded-3xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 animate-in fade-in zoom-in-95 duration-200 my-auto">
            
            {/* Modal Header */}
            <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Store size={22} />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                    Katalog & Permohonan Logistik
                    <span className="bg-blue-50 text-blue-600 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border border-blue-100">
                      Katalog Barang
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500">Pilih barang langsung dari katalog dan tentukan kuantitas kebutuhan unit Anda.</p>
                </div>
              </div>

              {/* Mobile Tabs Switcher */}
              <div className="flex lg:hidden items-center bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setActiveMobileTab('catalog')}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    activeMobileTab === 'catalog' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  📦 Katalog ({catalogItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMobileTab('cart')}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    activeMobileTab === 'cart' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  <ShoppingCart size={13} />
                  <span>Keranjang ({formData.items.length})</span>
                </button>
              </div>

              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body: Split 2 Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
              
              {/* LEFT COLUMN: CATALOG PRODUCTS (7 Columns) */}
              <div className={`lg:col-span-7 p-4 border-r border-slate-200 overflow-y-auto space-y-4 ${activeMobileTab === 'catalog' ? 'block' : 'hidden lg:block'}`}>
                
                {/* Search & Category Filter */}
                <div className="space-y-2.5 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Cari nama barang atau kode barang..."
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={catalogSearch}
                      onChange={e => setCatalogSearch(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {categoryList.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                          selectedCategory === cat
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                        }`}
                      >
                        {cat === 'SEMUA' ? '🌐 Semua Kategori' : cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Catalog Product Cards Grid */}
                {catalogItems.length === 0 ? (
                  <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 space-y-2">
                    <Package className="w-12 h-12 mx-auto text-slate-300" />
                    <p className="font-bold text-slate-700">Barang Tidak Ditemukan</p>
                    <p className="text-xs text-slate-400">Coba cari dengan kata kunci lain atau pilih kategori berbeda.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {catalogItems.map(item => {
                      const cartItem = formData.items.find(i => i.itemId === item.id);
                      const inCart = !!cartItem;
                      const hasStock = (item.totalStock ?? 0) > 0;
                      const isLowStock = hasStock && (item.totalStock <= (item.minStock || 5));

                      return (
                        <div 
                          key={item.id}
                          className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between hover:shadow-md ${
                            inCart ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 hover:border-blue-300'
                          }`}
                        >
                          <div>
                            <div className="h-28 bg-slate-100 relative overflow-hidden flex items-center justify-center border-b border-slate-100 group">
                              {item.image ? (
                                <img 
                                  src={getMediaUrl(item.image)} 
                                  alt={item.name} 
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                                />
                              ) : (
                                <Package className="w-10 h-10 text-slate-300" />
                              )}
                              
                              <div className="absolute top-2 left-2">
                                {item.totalStock === 0 ? (
                                  <span className="bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm">
                                    Habis
                                  </span>
                                ) : isLowStock ? (
                                  <span className="bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm">
                                    Stok: {item.totalStock} {item.unit}
                                  </span>
                                ) : (
                                  <span className="bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm">
                                    Stok: {item.totalStock} {item.unit}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="p-3 space-y-1">
                              <p className="text-[10px] font-mono text-slate-400">{item.code}</p>
                              <h3 className="font-bold text-slate-800 text-xs line-clamp-2 leading-snug" title={item.name}>
                                {item.name}
                              </h3>
                              <p className="text-[10px] text-slate-500 font-medium">Satuan: {item.unit}</p>
                            </div>
                          </div>

                          <div className="p-2 pt-0">
                            {inCart ? (
                              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl p-1">
                                <button
                                  type="button"
                                  onClick={() => updateCartQty(item.id, cartItem.qtyRequested - 1)}
                                  className="w-7 h-7 bg-white text-blue-700 rounded-lg flex items-center justify-center font-bold hover:bg-blue-100 shadow-xs"
                                >
                                  <Minus size={12} />
                                </button>
                                <span className="text-xs font-bold text-blue-900 px-2">{cartItem.qtyRequested}</span>
                                <button
                                  type="button"
                                  onClick={() => updateCartQty(item.id, cartItem.qtyRequested + 1)}
                                  className="w-7 h-7 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold hover:bg-blue-700 shadow-xs"
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => addToCart(item)}
                                className="w-full bg-slate-900 hover:bg-blue-600 text-white py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                              >
                                <Plus size={13} /> Tambah
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: CHECKOUT CART & ORDER FORM (5 Columns) */}
              <div className={`lg:col-span-5 bg-white flex flex-col justify-between overflow-y-auto ${activeMobileTab === 'cart' ? 'block' : 'hidden lg:flex'}`}>
                <form onSubmit={handleCreateOrder} className="p-4 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    {/* Pemesan Info Card */}
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                        <User size={14} className="text-blue-600" /> Identitas Pemohon
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nama Pemohon</label>
                          <input 
                            type="text"
                            required
                            placeholder="Nama pemohon..."
                            className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.requesterName}
                            onChange={e => setFormData({...formData, requesterName: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Unit / Departemen</label>
                          <input 
                            type="text"
                            required
                            placeholder="Contoh: SD IT, TK, IT..."
                            className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.requesterUnit}
                            onChange={e => setFormData({...formData, requesterUnit: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Cart Items List */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <ShoppingCart size={14} className="text-blue-600" />
                          Rincian Keranjang ({formData.items.length})
                        </h3>
                        {formData.items.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, items: [] }))}
                            className="text-[10px] text-rose-600 font-bold hover:underline"
                          >
                            Kosongkan
                          </button>
                        )}
                      </div>

                      {formData.items.length === 0 ? (
                        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center space-y-2 bg-slate-50/50">
                          <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto" />
                          <p className="text-xs font-bold text-slate-600">Keranjang Masih Kosong</p>
                          <p className="text-[11px] text-slate-400">Pilih barang dari katalog di sebelah kiri untuk ditambahkan ke pesanan.</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {formData.items.map((cartItem) => {
                            const itemDetails = items.find(i => i.id === cartItem.itemId) || {};
                            return (
                              <div 
                                key={cartItem.itemId} 
                                className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-2 relative"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <h4 className="text-xs font-bold text-slate-800 truncate" title={itemDetails.name}>
                                      {itemDetails.name || 'Barang'}
                                    </h4>
                                    <p className="text-[10px] text-slate-400 font-mono">{itemDetails.code} • Satuan: {itemDetails.unit || '-'}</p>
                                  </div>

                                  <div className="flex items-center border border-slate-300 bg-white rounded-lg">
                                    <button
                                      type="button"
                                      onClick={() => updateCartQty(cartItem.itemId, cartItem.qtyRequested - 1)}
                                      className="p-1 text-slate-600 hover:bg-slate-100 rounded-l-lg"
                                    >
                                      <Minus size={12} />
                                    </button>
                                    <input 
                                      type="number" 
                                      min="1" 
                                      className="w-10 text-center text-xs font-bold bg-transparent outline-none"
                                      value={cartItem.qtyRequested}
                                      onChange={(e) => updateCartQty(cartItem.itemId, e.target.value)}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => updateCartQty(cartItem.itemId, cartItem.qtyRequested + 1)}
                                      className="p-1 text-slate-600 hover:bg-slate-100 rounded-r-lg"
                                    >
                                      <Plus size={12} />
                                    </button>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => removeFromCart(cartItem.itemId)}
                                    className="text-slate-400 hover:text-rose-600 p-1"
                                    title="Hapus"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>

                                <input
                                  type="text"
                                  placeholder="Catatan khusus item ini (opsional)..."
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] text-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
                                  value={cartItem.note}
                                  onChange={(e) => updateCartNote(cartItem.itemId, e.target.value)}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* General Order Note */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Catatan Umum Pesanan</label>
                      <textarea
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                        rows="2"
                        placeholder="Contoh: Diperlukan untuk kegiatan operasional unit..."
                        value={formData.note}
                        onChange={e => setFormData({...formData, note: e.target.value})}
                      ></textarea>
                    </div>
                  </div>

                  {/* Checkout Footer */}
                  <div className="pt-3 border-t border-slate-200 space-y-2 bg-white">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Total Kuantitas Permintaan:</span>
                      <span className="text-blue-600 font-extrabold">{totalCartCount} Unit</span>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        type="button" 
                        onClick={() => setIsCreateModalOpen(false)} 
                        className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                      >
                        Batal
                      </button>
                      <button 
                        type="submit" 
                        disabled={submitting || formData.items.length === 0}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2.5 rounded-xl text-xs font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {submitting ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" /> Mengirim...
                          </>
                        ) : (
                          <>
                            <ShoppingBag size={14} /> Ajukan Permohonan ({formData.items.length})
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: DETAIL & PROSES PESANAN (PREMIUM, STRUCTURED & INTERACTIVE) */}
      {/* ========================================================================= */}
      {isProcessModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 animate-in fade-in zoom-in-95 duration-200 my-auto">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <FileText size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-black text-slate-800">Detail & Proses Pesanan</h2>
                    <div className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs font-mono text-xs font-bold text-blue-700">
                      <span>{selectedOrder.code}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyOrderCode(selectedOrder.code)}
                        className="text-slate-400 hover:text-blue-600 transition p-0.5"
                        title="Salin Kode Pesanan"
                      >
                        {copiedCode ? <CheckCheck size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Verifikasi kuantitas, persetujuan admin, dan serah terima pengeluaran stok.</p>
                </div>
              </div>

              {/* Action Buttons Header */}
              <div className="flex items-center gap-2">
                <a
                  href={`/public/invoice-gudang/${selectedOrder.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 px-3.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition shadow-2xs"
                  title="Buka / Cetak Lembar Invoice Resmi & Surat Jalan"
                >
                  <Printer size={14} className="text-emerald-700" /> Cetak Invoice / Surat Jalan
                </a>
                <button 
                  onClick={() => setIsProcessModalOpen(false)} 
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <form onSubmit={handleProcessOrder} className="overflow-y-auto p-4 sm:p-6 space-y-5 flex-1 custom-scrollbar">
              
              {/* 1. INTERACTIVE WORKFLOW STEPPER */}
              <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-slate-50 p-3.5 sm:p-4 rounded-2xl border border-blue-200/80 space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                  <Clock size={13} className="text-blue-600" /> Alur Tahapan Pesanan:
                </span>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {/* Step 1: PENDING */}
                  <div className={`p-2.5 rounded-xl border flex items-center gap-2 transition ${
                    selectedOrder.status === 'PENDING'
                      ? 'bg-amber-100/90 border-amber-300 text-amber-900 shadow-2xs font-bold'
                      : ['APPROVED', 'PROCESS', 'COMPLETED'].includes(selectedOrder.status)
                      ? 'bg-white border-slate-200 text-emerald-700'
                      : 'bg-white/60 border-slate-200 text-slate-400'
                  }`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      ['APPROVED', 'PROCESS', 'COMPLETED'].includes(selectedOrder.status) ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                    }`}>
                      {['APPROVED', 'PROCESS', 'COMPLETED'].includes(selectedOrder.status) ? '✓' : '1'}
                    </div>
                    <span className="text-xs">1. Diajukan</span>
                  </div>

                  {/* Step 2: APPROVED */}
                  <div className={`p-2.5 rounded-xl border flex items-center gap-2 transition ${
                    selectedOrder.status === 'APPROVED'
                      ? 'bg-blue-100 border-blue-300 text-blue-900 shadow-2xs font-bold'
                      : ['PROCESS', 'COMPLETED'].includes(selectedOrder.status)
                      ? 'bg-white border-slate-200 text-emerald-700'
                      : 'bg-white/60 border-slate-200 text-slate-400'
                  }`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      ['PROCESS', 'COMPLETED'].includes(selectedOrder.status) ? 'bg-emerald-600 text-white' : (selectedOrder.status === 'APPROVED' ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-700')
                    }`}>
                      {['PROCESS', 'COMPLETED'].includes(selectedOrder.status) ? '✓' : '2'}
                    </div>
                    <span className="text-xs">2. Disetujui</span>
                  </div>

                  {/* Step 3: PROCESS */}
                  <div className={`p-2.5 rounded-xl border flex items-center gap-2 transition ${
                    selectedOrder.status === 'PROCESS'
                      ? 'bg-indigo-100 border-indigo-300 text-indigo-900 shadow-2xs font-bold'
                      : selectedOrder.status === 'COMPLETED'
                      ? 'bg-white border-slate-200 text-emerald-700'
                      : 'bg-white/60 border-slate-200 text-slate-400'
                  }`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      selectedOrder.status === 'COMPLETED' ? 'bg-emerald-600 text-white' : (selectedOrder.status === 'PROCESS' ? 'bg-indigo-600 text-white' : 'bg-slate-300 text-slate-700')
                    }`}>
                      {selectedOrder.status === 'COMPLETED' ? '✓' : '3'}
                    </div>
                    <span className="text-xs">3. Penyiapan</span>
                  </div>

                  {/* Step 4: COMPLETED */}
                  <div className={`p-2.5 rounded-xl border flex items-center gap-2 transition ${
                    selectedOrder.status === 'COMPLETED'
                      ? 'bg-emerald-100 border-emerald-300 text-emerald-900 shadow-2xs font-bold'
                      : selectedOrder.status === 'REJECTED'
                      ? 'bg-rose-100 border-rose-300 text-rose-900 shadow-2xs font-bold'
                      : 'bg-white/60 border-slate-200 text-slate-400'
                  }`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      selectedOrder.status === 'COMPLETED' ? 'bg-emerald-600 text-white' : (selectedOrder.status === 'REJECTED' ? 'bg-rose-600 text-white' : 'bg-slate-300 text-slate-700')
                    }`}>
                      {selectedOrder.status === 'COMPLETED' ? '✓' : (selectedOrder.status === 'REJECTED' ? '✕' : '4')}
                    </div>
                    <span className="text-xs">{selectedOrder.status === 'REJECTED' ? '4. Ditolak' : '4. Diserahkan'}</span>
                  </div>
                </div>
              </div>

              {/* 2. SUMMARY GRID: PEMOHON & KEPERLUAN */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Identitas Pemohon</span>
                  <div className="font-extrabold text-slate-800 text-sm">{selectedOrder.requesterName}</div>
                  <div className="text-xs font-semibold text-blue-700 mt-0.5">{selectedOrder.requesterUnit || 'Unit Umum'}</div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Tanggal Permohonan</span>
                  <div className="font-bold text-slate-800 text-sm">
                    {new Date(selectedOrder.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Input: {new Date(selectedOrder.createdAt).toLocaleDateString('id-ID')}</div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Ringkasan Item</span>
                  <div className="font-bold text-slate-800 text-sm">
                    {selectedOrder.items?.length || 0} Jenis Barang
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Permintaan: <b>{totalRequestedInOrder} Unit</b> • Disetujui: <b className="text-blue-700">{totalApprovedInOrder} Unit</b>
                  </div>
                </div>

                {selectedOrder.note && (
                  <div className="sm:col-span-3 bg-amber-50/60 p-3 rounded-xl border border-amber-200/80 text-xs">
                    <span className="font-bold text-amber-900 flex items-center gap-1.5 mb-0.5">
                      <Tag size={13} className="text-amber-600" /> Catatan / Keterangan Pemohon:
                    </span>
                    <p className="text-amber-950 italic">{selectedOrder.note}</p>
                  </div>
                )}
              </div>

              {/* 3. TABLE OF ITEMS & APPROVAL QTY */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                    <Package size={15} className="text-blue-600" />
                    Daftar Barang & Kuantitas Persetujuan
                  </h3>
                  
                  {/* Quick Action Buttons */}
                  {selectedOrder.status !== 'COMPLETED' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleApproveAllFull}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition shadow-2xs"
                      >
                        ✓ Setujui Penuh (100%)
                      </button>
                      <button
                        type="button"
                        onClick={handleApproveAllZero}
                        className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-bold transition shadow-2xs"
                      >
                        ✕ Nol-kan
                      </button>
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-100/90 text-slate-600 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="p-3">Barang & Kategori</th>
                        <th className="p-3 text-center">Stok Gudang</th>
                        <th className="p-3 text-center">Diminta</th>
                        <th className="p-3 text-center w-36">Disetujui (Approve)</th>
                        <th className="p-3 text-center">Diserahkan</th>
                        <th className="p-3">Catatan Khusus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedOrder.items.map((item) => {
                        const approvedQtyValue = processData.approvedItems.find(ai => ai.orderItemId === item.id)?.qtyApproved ?? (item.qtyApproved ?? item.qtyRequested);
                        const currentWhStock = getItemStockInWh(item.itemId, processData.warehouseId);
                        const isExceedWhStock = processData.status === 'COMPLETED' && processData.warehouseId && approvedQtyValue > currentWhStock;

                        return (
                          <tr key={item.id} className={`hover:bg-slate-50/80 transition-colors ${isExceedWhStock ? 'bg-rose-50/40' : ''}`}>
                            <td className="p-3">
                              <div className="font-extrabold text-slate-800 text-sm">{item.item?.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                {item.item?.code} • {item.item?.category?.name || 'Umum'} • [{item.item?.unit || 'Pcs'}]
                              </div>
                            </td>
                            
                            {/* Stock Indicator */}
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-[11px] ${
                                currentWhStock === 0 
                                  ? 'bg-rose-100 text-rose-800' 
                                  : (currentWhStock < item.qtyRequested ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700')
                              }`}>
                                {currentWhStock} unit
                              </span>
                            </td>

                            <td className="p-3 text-center">
                              <span className="bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg font-bold text-slate-800 font-mono text-sm">
                                {item.qtyRequested}
                              </span>
                            </td>

                            <td className="p-3 text-center">
                              {selectedOrder.status === 'COMPLETED' ? (
                                <span className="font-extrabold font-mono text-blue-700 text-sm">
                                  {approvedQtyValue} {item.item?.unit || 'Pcs'}
                                </span>
                              ) : (
                                <div className="flex items-center justify-center gap-1">
                                  <input 
                                    type="number" 
                                    min="0" 
                                    max={item.qtyRequested * 2}
                                    className={`w-20 border rounded-xl p-1.5 text-center font-extrabold text-xs outline-none focus:ring-2 focus:ring-blue-400 ${
                                      isExceedWhStock ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-slate-300 bg-white text-slate-800'
                                    }`} 
                                    value={approvedQtyValue}
                                    onChange={(e) => {
                                      const newAppItems = [...processData.approvedItems];
                                      const existIdx = newAppItems.findIndex(ai => ai.orderItemId === item.id);
                                      const val = parseInt(e.target.value) || 0;
                                      if (existIdx >= 0) newAppItems[existIdx].qtyApproved = val;
                                      else newAppItems.push({ orderItemId: item.id, qtyApproved: val });
                                      setProcessData({...processData, approvedItems: newAppItems});
                                    }}
                                  />
                                </div>
                              )}
                              {isExceedWhStock && (
                                <div className="text-[10px] text-rose-600 font-bold mt-0.5">Melebihi stok gudang!</div>
                              )}
                            </td>

                            <td className="p-3 text-center">
                              <span className="font-extrabold font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs">
                                {item.qtyDelivered ?? (selectedOrder.status === 'COMPLETED' ? approvedQtyValue : 0)}
                              </span>
                            </td>

                            <td className="p-3 text-slate-500 italic max-w-[160px] truncate" title={item.note}>
                              {item.note || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold text-slate-800 border-t border-slate-200 text-xs">
                      <tr>
                        <td colSpan="2" className="p-3 text-right uppercase tracking-wider text-[11px] text-slate-500">
                          Total Akumulasi :
                        </td>
                        <td className="p-3 text-center font-mono font-extrabold">{totalRequestedInOrder}</td>
                        <td className="p-3 text-center font-mono font-extrabold text-blue-700">{totalApprovedInOrder}</td>
                        <td colSpan="2" className="p-3 text-slate-500 font-medium text-[11px]">Unit barang logistik</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* 4. DECISION PANEL: STATUS PROSES & GUDANG */}
              <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/50 p-4 sm:p-5 rounded-2xl border border-blue-200 space-y-4">
                <div>
                  <label className="block text-xs font-extrabold text-blue-950 uppercase tracking-wider mb-2">
                    Tentukan Status Pesanan:
                  </label>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      { key: 'PENDING', label: 'Menunggu', desc: 'Belum diproses', color: 'amber' },
                      { key: 'APPROVED', label: 'Disetujui', desc: 'Barang disetujui', color: 'blue' },
                      { key: 'PROCESS', label: 'Diproses', desc: 'Sedang disiapkan', color: 'indigo' },
                      { key: 'COMPLETED', label: 'Selesai / Serahkan', desc: 'Potong stok gudang', color: 'emerald' },
                      { key: 'REJECTED', label: 'Tolak', desc: 'Batalkan pesanan', color: 'rose' }
                    ].map(st => (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() => setProcessData({ ...processData, status: st.key })}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          processData.status === st.key
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20 ring-2 ring-blue-300'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/40'
                        }`}
                      >
                        <div className="font-extrabold text-xs">{st.label}</div>
                        <div className={`text-[10px] mt-0.5 ${processData.status === st.key ? 'text-blue-100' : 'text-slate-400'}`}>
                          {st.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Warehouse Selector (Wajib jika COMPLETED) */}
                {processData.status === 'COMPLETED' && selectedOrder.status !== 'COMPLETED' && (
                  <div className="p-3.5 bg-white border-2 border-emerald-400 rounded-xl space-y-2 shadow-2xs animate-in fade-in">
                    <div className="flex items-center gap-2 font-extrabold text-emerald-950 text-xs">
                      <Warehouse size={16} className="text-emerald-600 shrink-0" />
                      <span>Pilih Lokasi Gudang Pengeluaran Stok Fisik:</span>
                    </div>
                    <select 
                      required 
                      className="w-full bg-emerald-50/50 border border-emerald-300 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                      value={processData.warehouseId} 
                      onChange={e => setProcessData({...processData, warehouseId: e.target.value})}
                    >
                      <option value="">-- Wajib Pilih Gudang Sumber Pengeluaran --</option>
                      {warehouses.map(wh => (
                        <option key={wh.id} value={wh.id}>{wh.name} {wh.location ? `(${wh.location})` : ''}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      * Sistem akan otomatis memotong kuantitas stok barang yang disetujui dari gudang di atas dan mencatat bukti transaksi pengeluaran (OUT).
                    </p>
                  </div>
                )}

                {/* Admin Note with Quick Chips */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-extrabold text-blue-950 uppercase tracking-wider">
                      Catatan / Pesan Admin:
                    </label>
                  </div>
                  
                  {/* Quick Chips */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {[
                      'Barang telah disiapkan dan diserahkan lengkap.',
                      'Disetujui sebagian karena keterbatasan stok gudang.',
                      'Barang sedang disiapkan di gudang logistik.',
                      'Mohon maaf, permohonan belum dapat disetujui saat ini.'
                    ].map(chip => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setProcessData(prev => ({ ...prev, note: chip }))}
                        className="text-[10px] bg-white hover:bg-blue-100 text-slate-700 border border-slate-200 rounded-lg px-2 py-0.5 transition"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>

                  <textarea 
                    className="w-full bg-white border border-blue-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500" 
                    rows="2" 
                    placeholder="Tuliskan catatan tambahan untuk pemohon atau alasan persetujuan/penolakan..."
                    value={processData.note} 
                    onChange={e => setProcessData({...processData, note: e.target.value})}
                  ></textarea>
                </div>
              </div>

              {/* FOOTER ACTIONS */}
              <div className="pt-2 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 border-t border-slate-200">
                <a
                  href={`/public/invoice-gudang/${selectedOrder.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  <FileText size={14} className="text-emerald-600" /> Buka Invoice Resmi
                </a>

                <div className="flex items-center gap-2">
                  <button 
                    type="button" 
                    onClick={() => setIsProcessModalOpen(false)} 
                    className="flex-1 sm:flex-initial px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Batal / Tutup
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 sm:flex-initial px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition"
                  >
                    <CheckCircle size={15} /> Simpan Perubahan Status
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
