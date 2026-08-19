import React, { useState, useEffect } from 'react';
import { Package, FolderTree, Building2, Users, Plus, Edit, Trash2, Search } from 'lucide-react';
import api from '../../lib/axios';

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
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ id: null, name: '', categoryId: '', unit: '', minStock: 5, price: '' });

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

  const filteredItems = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.code.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input type="text" placeholder="Cari barang..." className="pl-10 pr-4 py-2 w-full border rounded-lg focus:ring-blue-500" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => { setFormData({ id: null, name: '', categoryId: '', unit: '', minStock: 5, price: '' }); setIsModalOpen(true); }} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center">
          <Plus className="w-4 h-4 mr-2" /> Tambah Barang
        </button>
      </div>

      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-100 text-gray-600 text-sm">
            <th className="p-3 border-b">Kode</th>
            <th className="p-3 border-b">Nama Barang</th>
            <th className="p-3 border-b">Kategori</th>
            <th className="p-3 border-b">Satuan</th>
            <th className="p-3 border-b">Min Stok</th>
            <th className="p-3 border-b text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {loading ? <tr><td colSpan="6" className="text-center p-4">Memuat...</td></tr> : 
           filteredItems.map(item => (
            <tr key={item.id} className="border-b hover:bg-gray-50">
              <td className="p-3 font-mono text-sm">{item.code}</td>
              <td className="p-3 font-medium">{item.name}</td>
              <td className="p-3">{item.category?.name}</td>
              <td className="p-3">{item.unit}</td>
              <td className="p-3">{item.minStock}</td>
              <td className="p-3 text-right">
                <button onClick={() => { setFormData({ ...item, categoryId: item.categoryId || '' }); setIsModalOpen(true); }} className="text-blue-600 hover:bg-blue-100 p-2 rounded"><Edit className="w-4 h-4"/></button>
                <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:bg-red-100 p-2 rounded ml-2"><Trash2 className="w-4 h-4"/></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isModalOpen && (
        <Modal title={formData.id ? 'Edit Barang' : 'Tambah Barang'} onClose={() => setIsModalOpen(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div><label className="block text-sm mb-1">Nama Barang</label><input required type="text" className="w-full border p-2 rounded" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}/></div>
            <div><label className="block text-sm mb-1">Kategori</label>
              <select required className="w-full border p-2 rounded" value={formData.categoryId} onChange={e => setFormData({...formData, categoryId: e.target.value})}>
                <option value="">-- Pilih Kategori --</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm mb-1">Satuan (Pcs, Box, dll)</label><input required type="text" className="w-full border p-2 rounded" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})}/></div>
              <div><label className="block text-sm mb-1">Minimal Stok (Peringatan)</label><input required type="number" min="0" className="w-full border p-2 rounded" value={formData.minStock} onChange={e => setFormData({...formData, minStock: e.target.value})}/></div>
            </div>
            <div><label className="block text-sm mb-1">Estimasi Harga Satuan (Opsional)</label><input type="number" className="w-full border p-2 rounded" value={formData.price || ''} onChange={e => setFormData({...formData, price: e.target.value})}/></div>
            <div className="flex justify-end pt-4"><button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Simpan</button></div>
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
    try {
      const res = await api.get('/inventory/categories');
      setCategories(res.data);
    } catch (e) { console.error(e); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await api.post('/inventory/categories', { name });
      setIsModalOpen(false);
      setName('');
      fetchCategories();
    } catch (e) { alert('Gagal menyimpan kategori'); }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center"><Plus className="w-4 h-4 mr-2" /> Tambah Kategori</button>
      </div>
      <table className="w-full text-left border-collapse">
        <thead><tr className="bg-gray-100"><th className="p-3 border-b">Nama Kategori</th></tr></thead>
        <tbody>
          {categories.map(c => <tr key={c.id} className="border-b"><td className="p-3">{c.name}</td></tr>)}
        </tbody>
      </table>

      {isModalOpen && (
        <Modal title="Tambah Kategori Baru" onClose={() => setIsModalOpen(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div><label className="block text-sm mb-1">Nama Kategori</label><input required type="text" className="w-full border p-2 rounded" value={name} onChange={e => setName(e.target.value)}/></div>
            <div className="flex justify-end pt-4"><button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Simpan</button></div>
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
