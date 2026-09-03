import React, { useState, useEffect } from 'react';
import { 
  Package, FolderTree, Building2, Users, Plus, Edit, Trash2, Search, Upload, X, 
  Image as ImageIcon, Tag, DollarSign, Percent, TrendingUp, Calculator, 
  CheckSquare, Square, AlertCircle, Check, Sparkles, RefreshCw
} from 'lucide-react';
import api from '../../lib/axios';
import { getMediaUrl, compressImage } from '../../lib/media';

export default function InventoryMaster() {
  const [activeTab, setActiveTab] = useState('items');

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <FolderTree className="w-6 h-6 mr-2 text-blue-600" />
          Master Data Gudang & Logistik
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 bg-white rounded-t-lg px-2 pt-2">
        <TabButton active={activeTab === 'items'} onClick={() => setActiveTab('items')} icon={<Package className="w-4 h-4 mr-2"/>} text="Master Barang" />
        <TabButton active={activeTab === 'categories'} onClick={() => setActiveTab('categories')} icon={<FolderTree className="w-4 h-4 mr-2"/>} text="Kategori Barang" />
        <TabButton active={activeTab === 'warehouses'} onClick={() => setActiveTab('warehouses')} icon={<Building2 className="w-4 h-4 mr-2"/>} text="Lokasi Gudang" />
      </div>

      {/* Tab Content */}
      <div className="bg-white shadow rounded-lg p-6">
        {activeTab === 'items' && <ItemsTab />}
        {activeTab === 'categories' && <CategoriesTab />}
        {activeTab === 'warehouses' && <WarehousesTab />}
      </div>
    </div>
  );
}

const TabButton = ({ active, onClick, icon, text }) => (
  <button
    onClick={onClick}
    className={`flex items-center px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
      active ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`}
  >
    {icon}
    {text}
  </button>
);

// ==========================================
// ITEMS TAB
// ==========================================
const ItemsTab = () => {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [assetFilter, setAssetFilter] = useState('ALL'); // ALL, ASSET, NON_ASSET
  const [priceFilter, setPriceFilter] = useState('ALL'); // ALL, HAS_PRICE, NO_PRICE
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  
  // Standard Item Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ id: null, name: '', categoryId: '', unit: '', minStock: 5, price: '', sellingPrice: '', image: null, isAsset: false });

  // Single Price Update Modal state
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [priceModalData, setPriceModalData] = useState({
    item: null,
    price: '',
    sellingPrice: ''
  });
  const [savingPrice, setSavingPrice] = useState(false);

  // Bulk Price Update Modal state
  const [isBulkPriceModalOpen, setIsBulkPriceModalOpen] = useState(false);
  const [bulkConfig, setBulkConfig] = useState({
    adjustmentType: 'MARGIN_FROM_COST', // MARGIN_FROM_COST, INCREASE_SELLING_PERCENT, DECREASE_SELLING_PERCENT, INCREASE_COST_PERCENT
    percentage: 20
  });
  const [savingBulkPrice, setSavingBulkPrice] = useState(false);

  useEffect(() => {
    fetchItems();
    fetchCategories();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/items');
      setItems(res.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  
  const fetchCategories = async () => {
    try {
      const res = await api.get('/inventory/categories');
      setCategories(res.data);
    } catch (e) { console.error(e); }
  };

  const formatRupiah = (val) => {
    if (val === null || val === undefined || val === '') return '-';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return '-';
    return `Rp ${Math.round(num).toLocaleString('id-ID')}`;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (formData.id) {
        await api.put(`/inventory/items/${formData.id}`, formData);
      } else {
        await api.post('/inventory/items', formData);
      }
      setIsModalOpen(false);
      fetchItems();
    } catch (e) { alert('Gagal menyimpan barang: ' + (e.response?.data?.error || e.message)); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus barang ini? Stok dan riwayat transaksinya bisa ikut terhapus atau error jika berelasi.')) return;
    try {
      await api.delete(`/inventory/items/${id}`);
      fetchItems();
    } catch (e) { alert('Gagal menghapus barang. Mungkin barang ini sedang digunakan dalam transaksi.'); }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('File harus berupa gambar (JPG, PNG, WebP)');
      return;
    }

    try {
      const compressedFile = await compressImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.7 });
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, image: reader.result }));
      };
      reader.readAsDataURL(compressedFile);
    } catch (err) {
      console.error('Compress image error:', err);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, image: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Open Single Price Update Modal
  const openPriceModal = (item) => {
    setPriceModalData({
      item,
      price: item.price !== null && item.price !== undefined ? item.price : '',
      sellingPrice: item.sellingPrice !== null && item.sellingPrice !== undefined ? item.sellingPrice : ''
    });
    setIsPriceModalOpen(true);
  };

  // Save Single Price
  const handleSavePrice = async (e) => {
    e.preventDefault();
    if (!priceModalData.item) return;
    setSavingPrice(true);
    try {
      await api.put(`/inventory/items/${priceModalData.item.id}`, {
        price: priceModalData.price === '' ? null : priceModalData.price,
        sellingPrice: priceModalData.sellingPrice === '' ? null : priceModalData.sellingPrice
      });
      setIsPriceModalOpen(false);
      fetchItems();
    } catch (err) {
      alert('Gagal mengupdate harga: ' + (err.response?.data?.error || err.message));
    } finally {
      setSavingPrice(false);
    }
  };

  // Apply markup percentage preset to selling price in single price modal
  const applyMarkupPreset = (percent) => {
    const cost = parseFloat(priceModalData.price);
    if (isNaN(cost) || cost <= 0) {
      alert('Silakan masukkan Estimasi Harga Modal terlebih dahulu untuk menghitung persentase margin secara otomatis.');
      return;
    }
    const newSell = Math.round(cost * (1 + percent / 100));
    setPriceModalData(prev => ({ ...prev, sellingPrice: newSell }));
  };

  // Save Bulk Price
  const handleSaveBulkPrice = async (e) => {
    e.preventDefault();
    if (selectedItemIds.length === 0) {
      alert('Pilih setidaknya 1 barang untuk diupdate!');
      return;
    }
    setSavingBulkPrice(true);
    try {
      await api.patch('/inventory/items/bulk-price', {
        itemIds: selectedItemIds,
        adjustmentType: bulkConfig.adjustmentType,
        percentage: parseFloat(bulkConfig.percentage) || 0
      });
      setIsBulkPriceModalOpen(false);
      setSelectedItemIds([]);
      fetchItems();
    } catch (err) {
      alert('Gagal mengupdate harga massal: ' + (err.response?.data?.error || err.message));
    } finally {
      setSavingBulkPrice(false);
    }
  };

  // Toggle selection
  const toggleSelectItem = (id) => {
    setSelectedItemIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.length === filteredItems.length && filteredItems.length > 0) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(filteredItems.map(i => i.id));
    }
  };

  const filteredItems = items.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) || i.code.toLowerCase().includes(search.toLowerCase());
    const matchAsset = assetFilter === 'ALL' ? true : (assetFilter === 'ASSET' ? !!i.isAsset : !i.isAsset);
    const matchPrice = priceFilter === 'ALL' ? true : (
      priceFilter === 'HAS_PRICE' ? (i.sellingPrice !== null && i.sellingPrice !== undefined) :
      priceFilter === 'NO_PRICE' ? (!i.sellingPrice) : true
    );
    return matchSearch && matchAsset && matchPrice;
  });

  return (
    <div>
      {/* Top Filter & Action Bar */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Cari nama atau kode barang..." 
              className="pl-10 pr-4 py-2 w-full border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm outline-none" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
          <select 
            value={assetFilter} 
            onChange={e => setAssetFilter(e.target.value)}
            className="border p-2 rounded-lg text-sm bg-white text-gray-700 font-medium outline-none"
          >
            <option value="ALL">Semua Klasifikasi</option>
            <option value="ASSET">Hanya Jenis Aset</option>
            <option value="NON_ASSET">Non-Aset (Habis Pakai)</option>
          </select>
          <select 
            value={priceFilter} 
            onChange={e => setPriceFilter(e.target.value)}
            className="border p-2 rounded-lg text-sm bg-white text-gray-700 font-medium outline-none"
          >
            <option value="ALL">Semua Status Harga</option>
            <option value="HAS_PRICE">Ada Harga Jual</option>
            <option value="NO_PRICE">Belum Ada Harga Jual</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Bulk Price Action Trigger */}
          <button 
            type="button"
            onClick={() => {
              if (selectedItemIds.length === 0) {
                setSelectedItemIds(filteredItems.map(i => i.id));
              }
              setIsBulkPriceModalOpen(true);
            }} 
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            title="Update harga jual secara massal"
          >
            <Tag className="w-4 h-4" />
            <span>Update Harga Massal</span>
          </button>

          <button 
            type="button"
            onClick={() => { 
              setFormData({ id: null, name: '', categoryId: '', unit: '', minStock: 5, price: '', sellingPrice: '', image: null, isAsset: false }); 
              setIsModalOpen(true); 
            }} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Tambah Barang
          </button>
        </div>
      </div>

      {/* Selected Items Bulk Action Bar */}
      {selectedItemIds.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl mb-4 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
              {selectedItemIds.length}
            </span>
            <span className="text-xs font-bold text-emerald-950">
              {selectedItemIds.length} barang terpilih dari tabel
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsBulkPriceModalOpen(true)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Update Harga {selectedItemIds.length} Barang Ini</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedItemIds([])}
              className="px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            >
              Batal Pilih
            </button>
          </div>
        </div>
      )}

      {/* Table Master Data Barang */}
      <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-2xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100/90 text-gray-600 text-xs uppercase tracking-wider font-bold">
              <th className="p-3 border-b text-center w-10">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 cursor-pointer"
                  checked={filteredItems.length > 0 && selectedItemIds.length === filteredItems.length}
                  onChange={toggleSelectAll}
                  title="Pilih Semua Barang"
                />
              </th>
              <th className="p-3 border-b">Foto</th>
              <th className="p-3 border-b">Kode</th>
              <th className="p-3 border-b">Nama Barang</th>
              <th className="p-3 border-b">Klasifikasi</th>
              <th className="p-3 border-b">Kategori</th>
              <th className="p-3 border-b">Satuan</th>
              <th className="p-3 border-b">Min Stok</th>
              <th className="p-3 border-b">Harga Modal</th>
              <th className="p-3 border-b">Harga Jual</th>
              <th className="p-3 border-b">Margin / Laba</th>
              <th className="p-3 border-b text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm">
            {loading ? (
              <tr><td colSpan="12" className="text-center p-6 text-gray-500">Memuat data barang...</td></tr>
            ) : filteredItems.length === 0 ? (
              <tr><td colSpan="12" className="text-center p-6 text-gray-500">Belum ada data barang yang sesuai</td></tr>
            ) : (
              filteredItems.map(item => {
                const isSelected = selectedItemIds.includes(item.id);
                const cost = item.price;
                const sell = item.sellingPrice;
                const hasBoth = cost !== null && cost !== undefined && sell !== null && sell !== undefined;
                const profit = hasBoth ? sell - cost : null;
                const profitPercent = hasBoth && cost > 0 ? Math.round((profit / cost) * 100) : null;

                return (
                  <tr key={item.id} className={`hover:bg-blue-50/40 transition-colors ${isSelected ? 'bg-blue-50/70' : ''}`}>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 cursor-pointer"
                        checked={isSelected}
                        onChange={() => toggleSelectItem(item.id)}
                      />
                    </td>
                    <td className="p-3">
                      {item.image ? (
                        <img src={getMediaUrl(item.image)} alt={item.name} className="w-10 h-10 object-cover rounded-lg border border-gray-200 shadow-sm" />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 border border-gray-200">
                          <Package className="w-5 h-5" />
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-mono text-xs font-bold text-gray-700">{item.code}</td>
                    <td className="p-3 font-medium text-gray-900">{item.name}</td>
                    <td className="p-3">
                      {item.isAsset ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                          📦 Aset
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                          Habis Pakai
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-gray-600">{item.category?.name || '-'}</td>
                    <td className="p-3 text-gray-600">{item.unit}</td>
                    <td className="p-3 text-gray-600 font-semibold">{item.minStock}</td>
                    
                    {/* Harga Modal Column */}
                    <td className="p-3 text-gray-700 font-medium">
                      {item.price !== null && item.price !== undefined ? (
                        <span>{formatRupiah(item.price)}</span>
                      ) : (
                        <span className="text-gray-400 text-xs italic">Belum diisi</span>
                      )}
                    </td>

                    {/* Harga Jual Column */}
                    <td className="p-3 font-bold text-blue-700">
                      {item.sellingPrice !== null && item.sellingPrice !== undefined ? (
                        <span>{formatRupiah(item.sellingPrice)}</span>
                      ) : (
                        <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-xs font-semibold">
                          Belum diset
                        </span>
                      )}
                    </td>

                    {/* Margin / Laba Column */}
                    <td className="p-3">
                      {hasBoth ? (
                        profit > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200" title={`Profit: ${formatRupiah(profit)}`}>
                            <TrendingUp className="w-3 h-3" /> +{formatRupiah(profit)} ({profitPercent > 0 ? `+${profitPercent}%` : '0%'})
                          </span>
                        ) : profit === 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            Impas (0%)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200" title={`Rugi: ${formatRupiah(Math.abs(profit))}`}>
                            ⚠️ -{formatRupiah(Math.abs(profit))} ({profitPercent}%)
                          </span>
                        )
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>

                    {/* Action Column */}
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Dedicated Update Harga Button */}
                        <button 
                          type="button"
                          onClick={() => openPriceModal(item)} 
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                          title="Update Harga Modal & Harga Jual"
                        >
                          <Tag className="w-3.5 h-3.5" />
                          <span>Harga</span>
                        </button>
                        <button 
                          type="button"
                          onClick={() => { setFormData({ ...item, categoryId: item.categoryId || '', image: item.image || null, isAsset: !!item.isAsset }); setIsModalOpen(true); }} 
                          className="text-blue-600 hover:bg-blue-100 p-1.5 rounded-lg transition-colors cursor-pointer"
                          title="Edit Lengkap"
                        >
                          <Edit className="w-4 h-4"/>
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleDelete(item.id)} 
                          className="text-red-600 hover:bg-red-100 p-1.5 rounded-lg transition-colors cursor-pointer"
                          title="Hapus Barang"
                        >
                          <Trash2 className="w-4 h-4"/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL 1: SINGLE ITEM PRICE UPDATE MODAL */}
      {isPriceModalOpen && priceModalData.item && (
        <Modal 
          title={`Update Harga: ${priceModalData.item.name}`} 
          onClose={() => setIsPriceModalOpen(false)}
        >
          <form onSubmit={handleSavePrice} className="space-y-4">
            {/* Item Info Summary Card */}
            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              {priceModalData.item.image ? (
                <img 
                  src={getMediaUrl(priceModalData.item.image)} 
                  alt={priceModalData.item.name} 
                  className="w-12 h-12 object-cover rounded-xl border border-slate-200 shrink-0" 
                />
              ) : (
                <div className="w-12 h-12 bg-white rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                  <Package className="w-6 h-6" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {priceModalData.item.code}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    Satuan: <b>{priceModalData.item.unit}</b>
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-800 truncate mt-0.5">
                  {priceModalData.item.name}
                </h4>
              </div>
            </div>

            {/* Input Harga Modal */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Estimasi Harga Modal / Beli (Rp)
                </label>
                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                  {formatRupiah(priceModalData.price)}
                </span>
              </div>
              <input 
                type="number" 
                min="0"
                step="1"
                placeholder="Contoh: 25000"
                className="w-full border border-slate-200 p-2.5 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" 
                value={priceModalData.price} 
                onChange={e => setPriceModalData({ ...priceModalData, price: e.target.value })}
              />
              <p className="text-[11px] text-slate-400 mt-1">Estimasi biaya pengadaan/pembelian per satuan barang.</p>
            </div>

            {/* Input Harga Jual */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Harga Jual (Rp)
                </label>
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                  {formatRupiah(priceModalData.sellingPrice)}
                </span>
              </div>
              <input 
                type="number" 
                min="0"
                step="1"
                placeholder="Contoh: 35000"
                className="w-full border border-slate-200 p-2.5 rounded-xl text-sm font-bold text-blue-700 focus:ring-2 focus:ring-blue-500 outline-none" 
                value={priceModalData.sellingPrice} 
                onChange={e => setPriceModalData({ ...priceModalData, sellingPrice: e.target.value })}
              />
              <p className="text-[11px] text-slate-400 mt-1">Harga yang dibebankan saat unit atau pemesan memesan barang ini.</p>
            </div>

            {/* Quick Markup Presets */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                <Calculator size={13} className="text-emerald-600" />
                <span>Hitung Cepat Margin dari Harga Modal:</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[10, 15, 20, 25, 30, 50, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => applyMarkupPreset(pct)}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 text-xs font-bold rounded-lg transition-all border border-emerald-200 cursor-pointer active:scale-95"
                    title={`Set harga jual = harga modal + ${pct}%`}
                  >
                    +{pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Live Profit Margin Calculator Card */}
            {(() => {
              const c = parseFloat(priceModalData.price) || 0;
              const s = parseFloat(priceModalData.sellingPrice) || 0;
              if (c > 0 && s > 0) {
                const profit = s - c;
                const percent = Math.round((profit / c) * 100);
                const isPositive = profit >= 0;

                return (
                  <div className={`p-4 rounded-2xl border ${isPositive ? 'bg-emerald-50/70 border-emerald-200' : 'bg-rose-50/70 border-rose-200'} space-y-2.5`}>
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className={isPositive ? 'text-emerald-950 flex items-center gap-1' : 'text-rose-950 flex items-center gap-1'}>
                        {isPositive ? <TrendingUp size={14} className="text-emerald-600" /> : <AlertCircle size={14} className="text-rose-600" />}
                        {isPositive ? 'Proyeksi Margin Keuntungan:' : 'Peringatan Harga Jual di Bawah Modal:'}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${isPositive ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                        {isPositive ? `+${percent}%` : `${percent}%`}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center pt-1">
                      <div className="bg-white/80 p-2 rounded-xl border border-slate-200/70 shadow-2xs">
                        <span className="text-[10px] text-slate-500 font-bold block">Modal</span>
                        <span className="text-xs font-black text-slate-800">{formatRupiah(c)}</span>
                      </div>
                      <div className="bg-white/80 p-2 rounded-xl border border-slate-200/70 shadow-2xs">
                        <span className="text-[10px] text-slate-500 font-bold block">Harga Jual</span>
                        <span className="text-xs font-black text-blue-700">{formatRupiah(s)}</span>
                      </div>
                      <div className="bg-white/80 p-2 rounded-xl border border-slate-200/70 shadow-2xs">
                        <span className="text-[10px] text-slate-500 font-bold block">Laba / Unit</span>
                        <span className={`text-xs font-black ${isPositive ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {isPositive ? `+${formatRupiah(profit)}` : `-${formatRupiah(Math.abs(profit))}`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button 
                type="button" 
                onClick={() => setIsPriceModalOpen(false)} 
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
              >
                Batal
              </button>
              <button 
                type="submit" 
                disabled={savingPrice}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {savingPrice ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Simpan Harga</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 2: BULK PRICE UPDATE MODAL */}
      {isBulkPriceModalOpen && (
        <Modal 
          title={`Update Harga Massal (${selectedItemIds.length} Barang Terpilih)`} 
          onClose={() => setIsBulkPriceModalOpen(false)}
        >
          <form onSubmit={handleSaveBulkPrice} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-2xl text-xs text-blue-900 space-y-1">
              <span className="font-bold flex items-center gap-1.5">
                <Sparkles size={14} className="text-blue-600" /> Penyesuaian Harga Sekaligus
              </span>
              <p className="leading-relaxed">
                Pilih metode penyesuaian untuk mengkalkulasi ulang harga dari <b>{selectedItemIds.length} barang</b> yang Anda centang.
              </p>
            </div>

            {/* Adjustment Type Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Metode Penyesuaian Harga
              </label>
              
              <div className="grid grid-cols-1 gap-2 text-xs">
                <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                  bulkConfig.adjustmentType === 'MARGIN_FROM_COST' ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}>
                  <input
                    type="radio"
                    name="adjustmentType"
                    value="MARGIN_FROM_COST"
                    checked={bulkConfig.adjustmentType === 'MARGIN_FROM_COST'}
                    onChange={e => setBulkConfig({ ...bulkConfig, adjustmentType: e.target.value })}
                    className="text-emerald-600"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">Set Harga Jual = Harga Modal + %</span>
                    <span className="text-slate-500 text-[11px]">Kalkulasi otomatis harga jual berdasarkan persentase margin di atas modal.</span>
                  </div>
                </label>

                <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                  bulkConfig.adjustmentType === 'INCREASE_SELLING_PERCENT' ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}>
                  <input
                    type="radio"
                    name="adjustmentType"
                    value="INCREASE_SELLING_PERCENT"
                    checked={bulkConfig.adjustmentType === 'INCREASE_SELLING_PERCENT'}
                    onChange={e => setBulkConfig({ ...bulkConfig, adjustmentType: e.target.value })}
                    className="text-emerald-600"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">Naikkan Harga Jual Saat Ini (+%)</span>
                    <span className="text-slate-500 text-[11px]">Menaikkan harga jual yang sudah ada sebesar persentase tertentu.</span>
                  </div>
                </label>

                <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                  bulkConfig.adjustmentType === 'DECREASE_SELLING_PERCENT' ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}>
                  <input
                    type="radio"
                    name="adjustmentType"
                    value="DECREASE_SELLING_PERCENT"
                    checked={bulkConfig.adjustmentType === 'DECREASE_SELLING_PERCENT'}
                    onChange={e => setBulkConfig({ ...bulkConfig, adjustmentType: e.target.value })}
                    className="text-emerald-600"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">Turunkan Harga Jual Saat Ini (-%)</span>
                    <span className="text-slate-500 text-[11px]">Menurunkan harga jual saat ini (misal diskon atau penyesuaian pasar).</span>
                  </div>
                </label>

                <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                  bulkConfig.adjustmentType === 'INCREASE_COST_PERCENT' ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}>
                  <input
                    type="radio"
                    name="adjustmentType"
                    value="INCREASE_COST_PERCENT"
                    checked={bulkConfig.adjustmentType === 'INCREASE_COST_PERCENT'}
                    onChange={e => setBulkConfig({ ...bulkConfig, adjustmentType: e.target.value })}
                    className="text-emerald-600"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">Naikkan Estimasi Harga Modal (+%)</span>
                    <span className="text-slate-500 text-[11px]">Penyesuaian kenaikan harga beli/kulakan dari supplier.</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Percentage Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Besaran Persentase (%)
              </label>
              <div className="flex items-center gap-2">
                <input 
                  required
                  type="number" 
                  min="1"
                  max="1000"
                  step="0.5"
                  className="flex-1 border border-slate-200 p-2.5 rounded-xl text-sm font-black text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" 
                  value={bulkConfig.percentage} 
                  onChange={e => setBulkConfig({ ...bulkConfig, percentage: e.target.value })}
                />
                <span className="px-3 py-2.5 bg-slate-100 border border-slate-200 text-slate-600 rounded-xl font-black text-sm">
                  %
                </span>
              </div>
              
              {/* Percentage presets */}
              <div className="flex items-center gap-1.5 pt-2 flex-wrap">
                {[5, 10, 15, 20, 25, 30, 50].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setBulkConfig({ ...bulkConfig, percentage: p })}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      Number(bulkConfig.percentage) === p ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Items Preview List */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Daftar Barang yang Akan Diubah ({selectedItemIds.length})
              </label>
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2 divide-y divide-slate-100 text-xs custom-scrollbar">
                {items.filter(i => selectedItemIds.includes(i.id)).map(i => (
                  <div key={i.id} className="py-1.5 flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800 truncate">{i.name}</span>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-slate-400 block">Saat ini: {formatRupiah(i.sellingPrice)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button 
                type="button" 
                onClick={() => setIsBulkPriceModalOpen(false)} 
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
              >
                Batal
              </button>
              <button 
                type="submit" 
                disabled={savingBulkPrice}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {savingBulkPrice ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Terapkan ke {selectedItemIds.length} Barang</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 3: STANDARD EDIT/ADD ITEM MODAL */}
      {isModalOpen && (
        <Modal title={formData.id ? 'Edit Barang' : 'Tambah Barang'} onClose={() => setIsModalOpen(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Foto Barang</label>
              <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-xl border border-dashed border-gray-300">
                <div className="w-20 h-20 bg-white rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden relative group shadow-sm flex-shrink-0">
                  {formData.image ? (
                    <>
                      <img src={getMediaUrl(formData.image)} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, image: null }))}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                        title="Hapus Foto"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <ImageIcon className="w-7 h-7" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    id="item-photo-upload"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  <label
                    htmlFor="item-photo-upload"
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg cursor-pointer transition-all shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5 text-blue-600" />
                    {formData.image ? 'Ganti Foto' : 'Upload Foto Barang...'}
                  </label>
                  <p className="text-[11px] text-gray-500 mt-1">Format: JPG, PNG, WebP (Otomatis dikompres)</p>
                </div>
              </div>
            </div>

            <div><label className="block text-sm font-medium text-gray-700 mb-1">Nama Barang</label><input required type="text" className="w-full border p-2 rounded-lg" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}/></div>
            
            {/* Klasifikasi Aset Toggle Card */}
            <div className={`p-3.5 rounded-xl border transition-all ${formData.isAsset ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={!!formData.isAsset} 
                  onChange={e => setFormData({ ...formData, isAsset: e.target.checked })}
                  className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <div>
                  <div className="font-semibold text-sm text-gray-800 flex items-center gap-1.5">
                    <span>Termasuk Jenis Aset (Inventaris)</span>
                    {formData.isAsset && <span className="text-[11px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">Aset</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    Centang jika barang ini adalah aset/inventaris. Barang jenis ini dapat dipilih saat pemenuhan pengadaan aset langsung dari gudang di menu Pengadaan.
                  </p>
                </div>
              </label>
            </div>

            <div><label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
              <select required className="w-full border p-2 rounded-lg" value={formData.categoryId} onChange={e => setFormData({...formData, categoryId: e.target.value})}>
                <option value="">-- Pilih Kategori --</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Satuan (Pcs, Box, dll)</label><input required type="text" className="w-full border p-2 rounded-lg" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})}/></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Minimal Stok (Peringatan)</label><input required type="number" min="0" className="w-full border p-2 rounded-lg" value={formData.minStock} onChange={e => setFormData({...formData, minStock: e.target.value})}/></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Estimasi Harga Modal</label><input type="number" className="w-full border p-2 rounded-lg" value={formData.price || ''} onChange={e => setFormData({...formData, price: e.target.value})}/></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Harga Jual</label><input type="number" className="w-full border p-2 rounded-lg" value={formData.sellingPrice || ''} onChange={e => setFormData({...formData, sellingPrice: e.target.value})}/></div>
            </div>
            <div className="flex justify-end pt-4"><button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-medium shadow-sm">Simpan</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
};

// ==========================================
// CATEGORIES TAB
// ==========================================
const CategoriesTab = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ id: null, name: '' });

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/categories');
      setCategories(res.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (formData.id) {
        await api.put(`/inventory/categories/${formData.id}`, { name: formData.name });
      } else {
        await api.post('/inventory/categories', { name: formData.name });
      }
      setIsModalOpen(false);
      setFormData({ id: null, name: '' });
      fetchCategories();
    } catch (e) { 
      alert(e.response?.data?.error || 'Gagal menyimpan kategori'); 
    }
  };

  const handleDelete = async (id, categoryName) => {
    if (!window.confirm(`Yakin ingin menghapus kategori "${categoryName}"?`)) return;
    try {
      await api.delete(`/inventory/categories/${id}`);
      fetchCategories();
    } catch (e) {
      alert(e.response?.data?.error || 'Gagal menghapus kategori');
    }
  };

  const filteredCategories = categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Cari kategori..." 
            className="pl-9 pr-4 py-2 w-full border rounded-lg focus:ring-blue-500 text-sm outline-none" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
        <button 
          onClick={() => { setFormData({ id: null, name: '' }); setIsModalOpen(true); }} 
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" /> Tambah Kategori
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-600 text-sm">
              <th className="p-3 border-b">Nama Kategori</th>
              <th className="p-3 border-b">Jumlah Barang</th>
              <th className="p-3 border-b text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="3" className="text-center p-4 text-gray-500">Memuat data kategori...</td></tr>
            ) : filteredCategories.length === 0 ? (
              <tr><td colSpan="3" className="text-center p-4 text-gray-500">Belum ada kategori</td></tr>
            ) : (
              filteredCategories.map(c => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-semibold text-gray-800">{c.name}</td>
                  <td className="p-3">
                    <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-xs font-bold border border-blue-200">
                      {c._count?.items || 0} Barang
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button 
                      onClick={() => { setFormData({ id: c.id, name: c.name }); setIsModalOpen(true); }} 
                      className="text-blue-600 hover:bg-blue-100 p-2 rounded transition-colors"
                      title="Edit Kategori"
                    >
                      <Edit className="w-4 h-4"/>
                    </button>
                    <button 
                      onClick={() => handleDelete(c.id, c.name)} 
                      className="text-red-600 hover:bg-red-100 p-2 rounded ml-2 transition-colors"
                      title="Hapus Kategori"
                    >
                      <Trash2 className="w-4 h-4"/>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <Modal title={formData.id ? 'Edit Kategori' : 'Tambah Kategori Baru'} onClose={() => setIsModalOpen(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Kategori *</label>
              <input 
                required 
                type="text" 
                className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                placeholder="Contoh: ATK, Kebersihan, Cetakan"
                value={formData.name} 
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Batal
              </button>
              <button 
                type="submit" 
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
              >
                Simpan
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

// ==========================================
// WAREHOUSES TAB (Shared with Uniforms)
// ==========================================
const WarehousesTab = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ id: null, name: '', location: '', isActive: true });

  useEffect(() => { fetchWarehouses(); }, []);

  const fetchWarehouses = async () => {
    try {
      const res = await api.get('/inventory/warehouses');
      setWarehouses(res.data);
    } catch (e) { console.error(e); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (formData.id) await api.put(`/inventory/warehouses/${formData.id}`, formData);
      else await api.post('/inventory/warehouses', formData);
      setIsModalOpen(false);
      fetchWarehouses();
    } catch (e) { alert('Gagal menyimpan gudang'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus lokasi gudang ini?')) return;
    try {
      await api.delete(`/inventory/warehouses/${id}`);
      fetchWarehouses();
    } catch (e) { alert('Gagal menghapus gudang.'); }
  };

  return (
    <div>
      <div className="bg-blue-50 text-blue-800 p-4 rounded-lg mb-4 text-sm flex items-start">
        <span className="font-bold mr-2">Info:</span> Data lokasi gudang ini tersinkronisasi dan sama persis dengan master data lokasi gudang di Manajemen Seragam.
      </div>
      <div className="flex justify-end mb-4">
        <button onClick={() => { setFormData({ id: null, name: '', location: '', isActive: true }); setIsModalOpen(true); }} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center"><Plus className="w-4 h-4 mr-2" /> Tambah Gudang</button>
      </div>
      <table className="w-full text-left border-collapse">
        <thead><tr className="bg-gray-100"><th className="p-3 border-b">Nama Gudang</th><th className="p-3 border-b">Lokasi</th><th className="p-3 border-b text-right">Aksi</th></tr></thead>
        <tbody>
          {warehouses.map(w => (
            <tr key={w.id} className="border-b">
              <td className="p-3 font-medium">{w.name}</td>
              <td className="p-3 text-gray-600">{w.location || '-'}</td>
              <td className="p-3 text-right">
                <button onClick={() => { setFormData(w); setIsModalOpen(true); }} className="text-blue-600 p-2"><Edit className="w-4 h-4"/></button>
                <button onClick={() => handleDelete(w.id)} className="text-red-600 p-2 ml-2"><Trash2 className="w-4 h-4"/></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isModalOpen && (
        <Modal title={formData.id ? 'Edit Gudang' : 'Tambah Gudang'} onClose={() => setIsModalOpen(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div><label className="block text-sm mb-1">Nama Gudang</label><input required type="text" className="w-full border p-2 rounded" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}/></div>
            <div><label className="block text-sm mb-1">Lokasi Detail</label><textarea className="w-full border p-2 rounded" value={formData.location || ''} onChange={e => setFormData({...formData, location: e.target.value})}></textarea></div>
            <div className="flex justify-end pt-4"><button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Simpan</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
};

// ==========================================
// VENDORS TAB
// ==========================================
const VendorsTab = () => {
  const [vendors, setVendors] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ id: null, name: '', phone: '', address: '', contactPerson: '' });

  useEffect(() => { fetchVendors(); }, []);

  const fetchVendors = async () => {
    try {
      const res = await api.get('/inventory/vendors');
      setVendors(res.data);
    } catch (e) { console.error(e); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (formData.id) await api.put(`/inventory/vendors/${formData.id}`, formData);
      else await api.post('/inventory/vendors', formData);
      setIsModalOpen(false);
      fetchVendors();
    } catch (e) { alert('Gagal menyimpan vendor'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus vendor ini?')) return;
    try {
      await api.delete(`/inventory/vendors/${id}`);
      fetchVendors();
    } catch (e) { alert('Gagal menghapus vendor.'); }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => { setFormData({ id: null, name: '', phone: '', address: '', contactPerson: '' }); setIsModalOpen(true); }} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center"><Plus className="w-4 h-4 mr-2" /> Tambah Vendor</button>
      </div>
      <table className="w-full text-left border-collapse">
        <thead><tr className="bg-gray-100"><th className="p-3 border-b">Nama Vendor</th><th className="p-3 border-b">Kontak</th><th className="p-3 border-b">Alamat</th><th className="p-3 border-b text-right">Aksi</th></tr></thead>
        <tbody>
          {vendors.map(v => (
            <tr key={v.id} className="border-b">
              <td className="p-3 font-medium">{v.name}</td>
              <td className="p-3 text-gray-600">
                <div>{v.contactPerson || '-'}</div>
                <div className="text-sm">{v.phone}</div>
              </td>
              <td className="p-3 text-gray-600 text-sm">{v.address || '-'}</td>
              <td className="p-3 text-right">
                <button onClick={() => { setFormData(v); setIsModalOpen(true); }} className="text-blue-600 p-2"><Edit className="w-4 h-4"/></button>
                <button onClick={() => handleDelete(v.id)} className="text-red-600 p-2 ml-2"><Trash2 className="w-4 h-4"/></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isModalOpen && (
        <Modal title={formData.id ? 'Edit Vendor' : 'Tambah Vendor'} onClose={() => setIsModalOpen(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div><label className="block text-sm mb-1">Nama Vendor / Toko</label><input required type="text" className="w-full border p-2 rounded" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}/></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm mb-1">Nama Kontak Person</label><input type="text" className="w-full border p-2 rounded" value={formData.contactPerson || ''} onChange={e => setFormData({...formData, contactPerson: e.target.value})}/></div>
              <div><label className="block text-sm mb-1">Nomor Telepon/WA</label><input type="text" className="w-full border p-2 rounded" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})}/></div>
            </div>
            <div><label className="block text-sm mb-1">Alamat</label><textarea className="w-full border p-2 rounded" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})}></textarea></div>
            <div className="flex justify-end pt-4"><button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Simpan</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
};

// ==========================================
// SHARED MODAL COMPONENT
// ==========================================
const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden">
      <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
        <button onClick={onClose} type="button" className="text-gray-500 hover:text-gray-800 font-bold">&times;</button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  </div>
);
