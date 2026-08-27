import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, ShoppingCart, Eye, CheckCircle, XCircle, Trash2, 
  Package, Minus, Filter, ArrowRight, Check, X, Store, ShoppingBag, 
  Sparkles, Calendar, User, Building2, FileText, AlertCircle, RefreshCw
} from 'lucide-react';
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
      setOrders(res.data);
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
      setItems(resItems.data);
      setWarehouses(resWh.data);
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
    if (formData.items.length === 0) return alert('Keranjang masih kosong. Pilih minimal satu barang.');
    if (!formData.requesterName.trim()) return alert('Nama pemesan wajib diisi.');
    
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
      alert('🎉 Pesanan berhasil dibuat dan dikirim!');
    } catch (e) {
      alert(e.response?.data?.error || 'Terjadi kesalahan saat membuat pesanan');
    } finally {
      setSubmitting(false);
    }
  };

  const openProcessModal = (order) => {
    setSelectedOrder(order);
    setProcessData({
      status: order.status,
      note: order.note || '',
      warehouseId: '',
      approvedItems: order.items.map(it => ({ orderItemId: it.id, qtyApproved: it.qtyApproved || it.qtyRequested }))
    });
    setIsProcessModalOpen(true);
  };

  const handleProcessOrder = async (e) => {
    e.preventDefault();
    try {
      if (processData.status === 'COMPLETED' && !processData.warehouseId) {
        return alert('Pilih gudang sumber untuk memproses barang pesanan');
      }

      await api.put(`/inventory/orders/${selectedOrder.id}/status`, processData);
      setIsProcessModalOpen(false);
      fetchOrders();
      alert('Status pesanan berhasil diperbarui');
    } catch (e) {
      alert(e.response?.data?.error || 'Terjadi kesalahan saat memproses pesanan');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING': return <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full text-xs font-bold border border-amber-200">MENUNGGU</span>;
      case 'APPROVED': return <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full text-xs font-bold border border-blue-200">DISETUJUI</span>;
      case 'PROCESS': return <span className="bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full text-xs font-bold border border-indigo-200">DIPROSES</span>;
      case 'COMPLETED': return <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-bold border border-emerald-200">SELESAI</span>;
      case 'REJECTED': return <span className="bg-rose-100 text-rose-700 px-2.5 py-1 rounded-full text-xs font-bold border border-rose-200">DITOLAK</span>;
      default: return <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs font-bold">{status}</span>;
    }
  };

  const filteredOrders = orders.filter(o => 
    o.code.toLowerCase().includes(search.toLowerCase()) ||
    o.requesterName.toLowerCase().includes(search.toLowerCase())
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShoppingBag className="w-7 h-7 text-blue-600" />
            Pesanan Barang (Requisition)
          </h1>
          <p className="text-sm text-slate-500 mt-1">Kelola dan ajukan permintaan barang logistik unit Anda.</p>
        </div>
        <button 
          onClick={openCreateModal}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
        >
          <ShoppingCart className="w-5 h-5" />
          Buat Pesanan Baru
        </button>
      </div>

      <div className="bg-white shadow-sm border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 bg-slate-50 items-center justify-between">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Cari kode pesanan atau nama pemesan..."
              className="pl-10 pr-4 py-2 w-full border border-slate-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select 
              className="border border-slate-200 bg-white px-3 py-2 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Semua Status</option>
              <option value="PENDING">Menunggu (Pending)</option>
              <option value="APPROVED">Disetujui (Approved)</option>
              <option value="PROCESS">Diproses (Process)</option>
              <option value="COMPLETED">Selesai (Completed)</option>
              <option value="REJECTED">Ditolak (Rejected)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                <th className="p-4">Tanggal & Kode</th>
                <th className="p-4">Pemesan</th>
                <th className="p-4">Unit</th>
                <th className="p-4">Jumlah Barang</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="6" className="p-8 text-center text-slate-400">Memuat data pesanan...</td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan="6" className="p-8 text-center text-slate-400">Tidak ada pesanan ditemukan.</td></tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-sm text-slate-800">{new Date(order.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{order.code}</div>
                    </td>
                    <td className="p-4 font-semibold text-slate-800">{order.requesterName}</td>
                    <td className="p-4 text-sm text-slate-600">{order.requesterUnit || '-'}</td>
                    <td className="p-4 text-sm font-semibold text-slate-700">{order.items.length} item barang</td>
                    <td className="p-4">{getStatusBadge(order.status)}</td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => openProcessModal(order)}
                        className="text-blue-600 hover:bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg inline-flex items-center text-xs font-bold transition-all"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" /> Detail / Proses
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL BUAT PESANAN BARU (SHOPEE / TOKOPEDIA E-COMMERCE STYLE) */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 animate-in fade-in zoom-in duration-200">
            
            {/* Modal Header */}
            <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Store size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    Katalog & Pemesanan Logistik
                    <span className="bg-blue-50 text-blue-600 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border border-blue-100">
                      E-Commerce View
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500">Pilih barang langsung dari katalog dan tentukan jumlah pesanan Anda.</p>
                </div>
              </div>

              {/* Mobile Tab Switcher */}
              <div className="flex lg:hidden items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setActiveMobileTab('catalog')}
                  className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeMobileTab === 'catalog' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}
                >
                  🛍️ Katalog Barang
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMobileTab('cart')}
                  className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeMobileTab === 'cart' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600'}`}
                >
                  <ShoppingCart size={14} /> Keranjang ({formData.items.length})
                </button>
              </div>

              <button 
                onClick={() => setIsCreateModalOpen(false)} 
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content - Dual Column Layout (Shopee Style) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
              
              {/* LEFT COLUMN: CATALOG GRID (7 Columns) */}
              <div className={`lg:col-span-7 p-4 border-r border-slate-200 overflow-y-auto space-y-4 bg-slate-50 ${activeMobileTab === 'catalog' ? 'block' : 'hidden lg:block'}`}>
                
                {/* Search & Category Filter Pills */}
                <div className="space-y-3 sticky top-0 bg-slate-50 z-10 pb-2">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Cari barang berdasarkan nama atau kode..."
                      className="pl-10 pr-10 py-2.5 w-full bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                    />
                    {catalogSearch && (
                      <button 
                        onClick={() => setCatalogSearch('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {/* Category Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {categoryList.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                          selectedCategory === cat
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
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
                            {/* Photo Thumbnail */}
                            <div className="h-32 bg-slate-100 relative overflow-hidden flex items-center justify-center border-b border-slate-100 group">
                              {item.image ? (
                                <img 
                                  src={getMediaUrl(item.image)} 
                                  alt={item.name} 
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                                />
                              ) : (
                                <Package className="w-10 h-10 text-slate-300" />
                              )}
                              
                              {/* Stock Badge */}
                              <div className="absolute top-2 left-2">
                                {item.totalStock === 0 ? (
                                  <span className="bg-rose-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-sm">
                                    Habis
                                  </span>
                                ) : isLowStock ? (
                                  <span className="bg-amber-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-sm">
                                    Stok: {item.totalStock} {item.unit}
                                  </span>
                                ) : (
                                  <span className="bg-emerald-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-sm">
                                    Stok: {item.totalStock} {item.unit}
                                  </span>
                                )}
                              </div>

                              {/* Category Badge */}
                              {item.category?.name && (
                                <div className="absolute bottom-2 left-2 right-2">
                                  <span className="bg-slate-900/70 backdrop-blur-sm text-white text-[9px] font-semibold px-2 py-0.5 rounded-md truncate block max-w-full">
                                    {item.category.name}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Details */}
                            <div className="p-3 space-y-1">
                              <p className="text-[10px] font-mono text-slate-400">{item.code}</p>
                              <h3 className="font-bold text-slate-800 text-xs line-clamp-2 leading-snug" title={item.name}>
                                {item.name}
                              </h3>
                              {item.sellingPrice ? (
                                <p className="text-xs font-extrabold text-blue-600 mt-1">
                                  Rp {item.sellingPrice.toLocaleString('id-ID')} <span className="text-[10px] font-normal text-slate-400">/{item.unit}</span>
                                </p>
                              ) : (
                                <p className="text-[11px] font-semibold text-slate-500 mt-1">Satuan: {item.unit}</p>
                              )}
                            </div>
                          </div>

                          {/* Card Action Button */}
                          <div className="p-2 pt-0">
                            {inCart ? (
                              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl p-1">
                                <button
                                  type="button"
                                  onClick={() => updateCartQty(item.id, cartItem.qtyRequested - 1)}
                                  className="w-7 h-7 bg-white text-blue-700 rounded-lg flex items-center justify-center font-bold hover:bg-blue-100 shadow-sm"
                                >
                                  <Minus size={12} />
                                </button>
                                <span className="text-xs font-bold text-blue-900 px-2">{cartItem.qtyRequested}</span>
                                <button
                                  type="button"
                                  onClick={() => updateCartQty(item.id, cartItem.qtyRequested + 1)}
                                  className="w-7 h-7 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold hover:bg-blue-700 shadow-sm"
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => addToCart(item)}
                                className="w-full bg-slate-900 hover:bg-blue-600 text-white py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                              >
                                <Plus size={14} /> Tambah
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
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <User size={14} className="text-blue-600" /> Informasi Pemesan
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle size={10} /> Akun Login
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{formData.date}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nama Pemesan *</label>
                          <input 
                            type="text" 
                            required 
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" 
                            placeholder="Contoh: Budi Prasetyo"
                            value={formData.requesterName} 
                            onChange={e => setFormData({...formData, requesterName: e.target.value})} 
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Unit / Bagian</label>
                          <input 
                            type="text" 
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" 
                            placeholder="Cth: SD IT, Sarpras, dll"
                            value={formData.requesterUnit} 
                            onChange={e => setFormData({...formData, requesterUnit: e.target.value})} 
                          />
                        </div>
                      </div>
                    </div>

                    {/* Cart Items Section */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <ShoppingCart size={14} className="text-blue-600" /> Keranjang Pesanan ({formData.items.length} Barang)
                        </h3>
                        {formData.items.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, items: [] }))}
                            className="text-[11px] text-rose-600 hover:text-rose-800 font-bold"
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
                        <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                          {formData.items.map((cartItem) => {
                            const itemDetails = items.find(i => i.id === cartItem.itemId) || {};
                            return (
                              <div 
                                key={cartItem.itemId} 
                                className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-2 relative group hover:border-blue-300 transition-all"
                              >
                                <div className="flex items-center gap-3">
                                  {/* Item Photo */}
                                  <div className="w-12 h-12 bg-white rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                                    {itemDetails.image ? (
                                      <img src={getMediaUrl(itemDetails.image)} alt={itemDetails.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <Package className="w-6 h-6 text-slate-300" />
                                    )}
                                  </div>

                                  {/* Title & Price */}
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-xs font-bold text-slate-800 truncate" title={itemDetails.name}>
                                      {itemDetails.name || 'Barang'}
                                    </h4>
                                    <p className="text-[10px] text-slate-400 font-mono">{itemDetails.code} • Satuan: {itemDetails.unit || '-'}</p>
                                  </div>

                                  {/* Quantity Stepper */}
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

                                  {/* Remove Button */}
                                  <button
                                    type="button"
                                    onClick={() => removeFromCart(cartItem.itemId)}
                                    className="text-slate-400 hover:text-rose-600 p-1"
                                    title="Hapus"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>

                                {/* Optional Item Note */}
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
                        placeholder="Contoh: Diperlukan untuk kegiatan awal semester unit SD IT..."
                        value={formData.note}
                        onChange={e => setFormData({...formData, note: e.target.value})}
                      ></textarea>
                    </div>
                  </div>

                  {/* Checkout Footer Bar */}
                  <div className="pt-4 border-t border-slate-200 space-y-3 bg-white">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Total Pesanan:</span>
                      <span className="text-blue-600 font-extrabold">{totalCartCount} Item</span>
                    </div>

                    {totalEstimatedValue > 0 && (
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                        <span>Estimasi Total Nilai:</span>
                        <span className="text-emerald-600 font-extrabold">Rp {totalEstimatedValue.toLocaleString('id-ID')}</span>
                      </div>
                    )}

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
                        className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2.5 rounded-xl text-xs font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {submitting ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" /> Mengirim...
                          </>
                        ) : (
                          <>
                            <ShoppingBag size={14} /> Buat & Kirim Pesanan ({formData.items.length})
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
      {/* MODAL PROSES PESANAN (UNTOUCHED / COMPATIBLE) */}
      {/* ========================================================================= */}
      {isProcessModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Detail & Proses Pesanan</h2>
                <p className="text-xs text-slate-500 font-mono">{selectedOrder.code}</p>
              </div>
              <button onClick={() => setIsProcessModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold text-xl">&times;</button>
            </div>
            
            <form onSubmit={handleProcessOrder} className="overflow-y-auto p-6 space-y-6 flex-1">
              
              <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase">Pemesan</p>
                  <p className="font-semibold text-slate-800">{selectedOrder.requesterName} <span className="text-xs font-normal text-slate-500">({selectedOrder.requesterUnit})</span></p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase">Tanggal Pesanan</p>
                  <p className="font-semibold text-slate-800">{new Date(selectedOrder.date).toLocaleDateString('id-ID')}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-slate-500 font-bold uppercase">Catatan Pemesan</p>
                  <p className="text-slate-800 italic text-sm">{selectedOrder.note || 'Tidak ada catatan'}</p>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">Daftar Barang & Persetujuan</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-100 text-xs font-bold text-slate-600">
                      <tr>
                        <th className="p-2.5 border">Kode</th>
                        <th className="p-2.5 border">Nama Barang</th>
                        <th className="p-2.5 border text-center">Req Qty</th>
                        <th className="p-2.5 border">Approval Qty</th>
                        <th className="p-2.5 border">Terkirim</th>
                        <th className="p-2.5 border">Catatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items.map((item) => {
                        const approvedQtyValue = processData.approvedItems.find(ai => ai.orderItemId === item.id)?.qtyApproved ?? item.qtyRequested;
                        
                        return (
                        <tr key={item.id} className="border-b hover:bg-slate-50">
                          <td className="p-2.5 border font-mono text-xs">{item.item.code}</td>
                          <td className="p-2.5 border font-medium text-slate-800">{item.item.name}</td>
                          <td className="p-2.5 border text-center font-bold">{item.qtyRequested}</td>
                          <td className="p-2.5 border">
                            <input type="number" min="0" className="w-20 border rounded-lg p-1 text-center font-bold" 
                              value={approvedQtyValue}
                              onChange={(e) => {
                                const newAppItems = [...processData.approvedItems];
                                const existIdx = newAppItems.findIndex(ai => ai.orderItemId === item.id);
                                if (existIdx >= 0) newAppItems[existIdx].qtyApproved = parseInt(e.target.value) || 0;
                                else newAppItems.push({ orderItemId: item.id, qtyApproved: parseInt(e.target.value) || 0 });
                                setProcessData({...processData, approvedItems: newAppItems});
                              }}
                              disabled={selectedOrder.status === 'COMPLETED'}
                            />
                          </td>
                          <td className="p-2.5 border text-center text-emerald-600 font-bold">{item.qtyDelivered}</td>
                          <td className="p-2.5 border text-slate-500 italic max-w-[150px] truncate text-xs" title={item.note}>{item.note || '-'}</td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
                <div>
                  <label className="block text-xs font-bold text-blue-900 uppercase mb-1">Ubah Status Pesanan</label>
                  <select required className="w-full bg-white border border-blue-200 rounded-xl p-2 text-xs font-bold text-slate-800 outline-none"
                    value={processData.status} onChange={e => setProcessData({...processData, status: e.target.value})}>
                    <option value="PENDING">PENDING</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="PROCESS">PROCESS</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>
                {processData.status === 'COMPLETED' && selectedOrder.status !== 'COMPLETED' && (
                  <div>
                    <label className="block text-xs font-bold text-blue-900 uppercase mb-1">Pilih Gudang Pengeluaran</label>
                    <select required className="w-full bg-white border border-blue-300 rounded-xl p-2 text-xs font-bold text-slate-800 shadow-sm focus:ring-blue-500 outline-none"
                      value={processData.warehouseId} onChange={e => setProcessData({...processData, warehouseId: e.target.value})}>
                      <option value="">-- Wajib Pilih Gudang --</option>
                      {warehouses.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
                    </select>
                    <p className="text-[10px] text-blue-700 mt-1">*Stok akan dipotong otomatis dari gudang ini.</p>
                  </div>
                )}
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-blue-900 uppercase mb-1">Catatan Admin</label>
                  <textarea className="w-full bg-white border border-blue-200 rounded-xl p-2 text-xs outline-none" rows="2" placeholder="Alasan penolakan atau catatan tambahan..."
                    value={processData.note} onChange={e => setProcessData({...processData, note: e.target.value})}></textarea>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setIsProcessModalOpen(false)} className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50">Tutup</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-xs font-bold flex items-center shadow-lg shadow-blue-500/20">
                  <CheckCircle className="w-4 h-4 mr-1.5" /> Simpan Perubahan
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}

