import React, { useState, useEffect } from 'react';
import { Plus, Search, ShoppingCart, Eye, CheckCircle, XCircle } from 'lucide-react';
import api from '../../lib/axios';

export default function InventoryOrders() {
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

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

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (formData.items.length === 0) return alert('Pilih minimal satu barang');
    
    try {
      await api.post('/inventory/orders', formData);
      setIsCreateModalOpen(false);
      setFormData({
        requesterName: '', requesterUnit: '', date: new Date().toISOString().split('T')[0], note: '', items: []
      });
      fetchOrders();
      alert('Pesanan berhasil dibuat');
    } catch (e) {
      alert(e.response?.data?.error || 'Terjadi kesalahan saat membuat pesanan');
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
      case 'PENDING': return <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold">MENUNGGU</span>;
      case 'APPROVED': return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">DISETUJUI</span>;
      case 'PROCESS': return <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-bold">DIPROSES</span>;
      case 'COMPLETED': return <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">SELESAI</span>;
      case 'REJECTED': return <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">DITOLAK</span>;
      default: return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold">{status}</span>;
    }
  };

  const filteredOrders = orders.filter(o => 
    o.code.toLowerCase().includes(search.toLowerCase()) ||
    o.requesterName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <ShoppingCart className="w-6 h-6 mr-2 text-blue-600" />
          Pesanan Barang (Requisition)
        </h1>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Buat Pesanan Baru
        </button>
      </div>

      <div className="bg-white shadow rounded-lg mb-6">
        <div className="p-4 border-b flex flex-wrap gap-4 bg-gray-50 rounded-t-lg items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Cari kode pesanan atau nama pemesan..."
              className="pl-10 pr-4 py-2 w-full border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select 
            className="border p-2 rounded-lg outline-none"
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

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-600 text-sm uppercase tracking-wider border-b">
                <th className="p-4">Tanggal & Kode</th>
                <th className="p-4">Pemesan</th>
                <th className="p-4">Unit</th>
                <th className="p-4">Jumlah Barang</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="p-8 text-center text-gray-500">Memuat data...</td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan="6" className="p-8 text-center text-gray-500">Tidak ada pesanan ditemukan.</td></tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div className="font-semibold text-sm">{new Date(order.date).toLocaleDateString('id-ID')}</div>
                      <div className="text-xs text-gray-500 font-mono mt-1">{order.code}</div>
                    </td>
                    <td className="p-4 font-medium">{order.requesterName}</td>
                    <td className="p-4 text-sm text-gray-600">{order.requesterUnit || '-'}</td>
                    <td className="p-4 text-sm font-semibold">{order.items.length} jenis item</td>
                    <td className="p-4">{getStatusBadge(order.status)}</td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => openProcessModal(order)}
                        className="text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded inline-flex items-center text-sm font-medium"
                      >
                        <Eye className="w-4 h-4 mr-1" /> Detail / Proses
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL BUAT PESANAN BARU */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-800">Buat Pesanan Baru</h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-500 hover:text-gray-800 font-bold">&times;</button>
            </div>
            <form onSubmit={handleCreateOrder} className="overflow-y-auto p-6 space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Pesanan</label>
                  <input type="date" required className="w-full border rounded p-2"
                    value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Pemesan</label>
                  <input type="text" required className="w-full border rounded p-2" placeholder="Cth: Budi"
                    value={formData.requesterName} onChange={e => setFormData({...formData, requesterName: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit / Bagian</label>
                <input type="text" className="w-full border rounded p-2" placeholder="Cth: SD IT, SMP IT, dll"
                  value={formData.requesterUnit} onChange={e => setFormData({...formData, requesterUnit: e.target.value})} />
              </div>
              
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-gray-700">Daftar Barang Pesanan</h3>
                  <button type="button" onClick={() => setFormData({...formData, items: [...formData.items, { itemId: '', qtyRequested: 1, note: '' }]})} className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200">
                    + Tambah Barang
                  </button>
                </div>
                {formData.items.length === 0 && <p className="text-sm text-gray-500 italic">Belum ada barang yang dipilih.</p>}
                
                {formData.items.map((item, index) => (
                  <div key={index} className="flex gap-2 mb-2 items-start">
                    <div className="flex-1">
                      <select required className="w-full border rounded p-2 text-sm" value={item.itemId} 
                        onChange={e => {
                          const newItems = [...formData.items];
                          newItems[index].itemId = e.target.value;
                          setFormData({...formData, items: newItems});
                        }}
                      >
                        <option value="">-- Pilih Barang --</option>
                        {items.map(it => <option key={it.id} value={it.id}>{it.code} - {it.name}</option>)}
                      </select>
                    </div>
                    <div className="w-24">
                      <input type="number" min="1" required className="w-full border rounded p-2 text-sm" placeholder="Qty" value={item.qtyRequested}
                        onChange={e => {
                          const newItems = [...formData.items];
                          newItems[index].qtyRequested = e.target.value;
                          setFormData({...formData, items: newItems});
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <input type="text" className="w-full border rounded p-2 text-sm" placeholder="Catatan opsional..." value={item.note}
                        onChange={e => {
                          const newItems = [...formData.items];
                          newItems[index].note = e.target.value;
                          setFormData({...formData, items: newItems});
                        }}
                      />
                    </div>
                    <button type="button" onClick={() => {
                        const newItems = [...formData.items];
                        newItems.splice(index, 1);
                        setFormData({...formData, items: newItems});
                      }} 
                      className="p-2 text-red-500 hover:bg-red-100 rounded"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan Umum</label>
                <textarea className="w-full border rounded p-2" rows="2"
                  value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})}></textarea>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50">Batal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Buat Pesanan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PROSES PESANAN */}
      {isProcessModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Detail & Proses Pesanan</h2>
                <p className="text-sm text-gray-500 font-mono">{selectedOrder.code}</p>
              </div>
              <button onClick={() => setIsProcessModalOpen(false)} className="text-gray-500 hover:text-gray-800 font-bold">&times;</button>
            </div>
            
            <form onSubmit={handleProcessOrder} className="overflow-y-auto p-6 space-y-6 flex-1">
              
              <div className="grid grid-cols-2 gap-6 bg-gray-50 p-4 rounded-lg border">
                <div>
                  <p className="text-sm text-gray-500">Pemesan</p>
                  <p className="font-semibold text-gray-800">{selectedOrder.requesterName} <span className="text-sm font-normal text-gray-500">({selectedOrder.requesterUnit})</span></p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Tanggal Pesanan</p>
                  <p className="font-semibold text-gray-800">{new Date(selectedOrder.date).toLocaleDateString('id-ID')}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-500">Catatan Pemesan</p>
                  <p className="text-gray-800 italic">{selectedOrder.note || 'Tidak ada catatan'}</p>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-gray-800 mb-3 border-b pb-2">Daftar Barang & Persetujuan</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-2 border">Kode</th>
                        <th className="p-2 border">Nama Barang</th>
                        <th className="p-2 border text-center">Req Qty</th>
                        <th className="p-2 border">Approval Qty</th>
                        <th className="p-2 border">Terkirim</th>
                        <th className="p-2 border">Catatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items.map((item, idx) => {
                        const approvedQtyValue = processData.approvedItems.find(ai => ai.orderItemId === item.id)?.qtyApproved ?? item.qtyRequested;
                        
                        return (
                        <tr key={item.id} className="border-b hover:bg-gray-50">
                          <td className="p-2 border font-mono text-xs">{item.item.code}</td>
                          <td className="p-2 border font-medium">{item.item.name}</td>
                          <td className="p-2 border text-center font-bold">{item.qtyRequested}</td>
                          <td className="p-2 border">
                            <input type="number" min="0" className="w-20 border rounded p-1 text-center" 
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
                          <td className="p-2 border text-center text-green-600 font-bold">{item.qtyDelivered}</td>
                          <td className="p-2 border text-gray-500 italic max-w-[150px] truncate" title={item.note}>{item.note || '-'}</td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div>
                  <label className="block text-sm font-bold text-blue-900 mb-1">Ubah Status Pesanan</label>
                  <select required className="w-full border rounded p-2"
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
                    <label className="block text-sm font-bold text-blue-900 mb-1">Pilih Gudang Pengeluaran</label>
                    <select required className="w-full border border-blue-300 rounded p-2 shadow-sm focus:ring-blue-500"
                      value={processData.warehouseId} onChange={e => setProcessData({...processData, warehouseId: e.target.value})}>
                      <option value="">-- Wajib Pilih Gudang --</option>
                      {warehouses.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
                    </select>
                    <p className="text-xs text-blue-700 mt-1">Stok akan dipotong dari gudang ini saat status berubah menjadi COMPLETED.</p>
                  </div>
                )}
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-blue-900 mb-1">Catatan Admin</label>
                  <textarea className="w-full border rounded p-2" rows="2" placeholder="Alasan penolakan atau catatan tambahan..."
                    value={processData.note} onChange={e => setProcessData({...processData, note: e.target.value})}></textarea>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setIsProcessModalOpen(false)} className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50">Tutup</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" /> Simpan Perubahan
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
