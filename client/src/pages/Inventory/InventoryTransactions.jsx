import React, { useState, useEffect } from 'react';
import { Plus, ArrowRightLeft, ArrowDownToLine, ArrowUpFromLine, Search, Upload, Download } from 'lucide-react';
import api from '../../lib/axios';

export default function InventoryTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  // Filter states
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [formData, setFormData] = useState({
    type: 'IN',
    itemId: '',
    warehouseId: '',
    toWarehouseId: '',
    quantity: '',
    note: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchTransactions();
    fetchOptions();
  }, [typeFilter]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const res = await api.get('/inventory/transactions', { params: { type: typeFilter } });
      setTransactions(res.data);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
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
    } catch (error) {
      console.error('Failed to fetch options:', error);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/inventory/transactions', formData);
      setIsModalOpen(false);
      setFormData({ ...formData, quantity: '', note: '' }); // Reset some fields
      fetchTransactions();
      alert('Transaksi berhasil dicatat');
    } catch (error) {
      alert(error.response?.data?.error || 'Terjadi kesalahan saat memproses transaksi');
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!importFile) return alert('Pilih file Excel/CSV terlebih dahulu');

    const formData = new FormData();
    formData.append('file', importFile);

    setIsImporting(true);
    try {
      const res = await api.post('/inventory/transactions/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert(`Import berhasil! ${res.data.successCount} transaksi ditambahkan. ${res.data.errorCount > 0 ? `Terdapat ${res.data.errorCount} baris yang gagal diimport.` : ''}`);
      if (res.data.errorCount > 0) {
        console.warn('Import Errors:', res.data.errors);
        alert('Beberapa baris gagal diimpor. Cek Console Log untuk detail errornya.');
      }
      setIsImportModalOpen(false);
      setImportFile(null);
      fetchTransactions();
    } catch (error) {
      alert(error.response?.data?.error || 'Terjadi kesalahan saat import data');
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,Tipe,Tanggal,Kode Barang,Kuantitas,Gudang Sumber,Gudang Tujuan,Catatan\nIN,2026-08-20,INV/BRG/0001,10,Gudang Utama,,Stok Awal\nOUT,2026-08-21,INV/BRG/0001,2,Gudang Utama,,Digunakan divisi IT\nMUTATION,2026-08-22,INV/BRG/0001,5,Gudang Utama,Gudang Cadangan,Pindah lokasi";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Template_Import_Transaksi_Stok.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTypeIcon = (type) => {
    switch(type) {
      case 'IN': return <ArrowDownToLine className="w-5 h-5 text-green-600" />;
      case 'OUT': return <ArrowUpFromLine className="w-5 h-5 text-red-600" />;
      case 'MUTATION': return <ArrowRightLeft className="w-5 h-5 text-blue-600" />;
      default: return null;
    }
  };

  const getTypeBadge = (type) => {
    switch(type) {
      case 'IN': return <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">MASUK</span>;
      case 'OUT': return <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">KELUAR</span>;
      case 'MUTATION': return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">MUTASI</span>;
      default: return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold">{type}</span>;
    }
  };

  const filteredTransactions = transactions.filter(t => 
    t.code.toLowerCase().includes(search.toLowerCase()) ||
    t.item?.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <ArrowRightLeft className="w-6 h-6 mr-2 text-blue-600" />
          Transaksi Stok (Ledger)
        </h1>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Buat Transaksi Baru
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg mb-6">
        <div className="p-4 border-b flex flex-wrap gap-4 bg-gray-50 rounded-t-lg items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Cari kode TRX atau nama barang..."
              className="pl-10 pr-4 py-2 w-full border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select 
            className="border p-2 rounded-lg outline-none"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">Semua Tipe Transaksi</option>
            <option value="IN">Stok Masuk (IN)</option>
            <option value="OUT">Stok Keluar (OUT)</option>
            <option value="MUTATION">Mutasi Gudang (MUTATION)</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-600 text-sm uppercase tracking-wider border-b">
                <th className="p-4">Tanggal & Kode</th>
                <th className="p-4">Tipe</th>
                <th className="p-4">Barang</th>
                <th className="p-4">Sumber / Tujuan</th>
                <th className="p-4 text-center">Kuantitas</th>
                <th className="p-4">Keterangan</th>
                <th className="p-4">Oleh</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="p-8 text-center text-gray-500">Memuat data...</td></tr>
              ) : filteredTransactions.length === 0 ? (
                <tr><td colSpan="7" className="p-8 text-center text-gray-500">Tidak ada transaksi ditemukan.</td></tr>
              ) : (
                filteredTransactions.map((trx) => (
                  <tr key={trx.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div className="font-semibold text-sm">{new Date(trx.date).toLocaleDateString('id-ID')}</div>
                      <div className="text-xs text-gray-500 font-mono mt-1">{trx.code}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        {getTypeIcon(trx.type)}
                        {getTypeBadge(trx.type)}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-sm text-gray-800">{trx.item?.name}</div>
                      <div className="text-xs text-gray-500">{trx.item?.code}</div>
                    </td>
                    <td className="p-4 text-sm">
                      <div className="text-gray-800"><span className="text-gray-500">Dari:</span> {trx.warehouse?.name}</div>
                      {trx.toWarehouse && (
                        <div className="text-blue-700 mt-1"><span className="text-blue-500">Ke:</span> {trx.toWarehouse.name}</div>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-lg font-bold">{trx.quantity}</span> <span className="text-xs text-gray-500">{trx.item?.unit}</span>
                    </td>
                    <td className="p-4 text-sm text-gray-600 max-w-xs truncate" title={trx.note}>
                      {trx.note || '-'}
                    </td>
                    <td className="p-4 text-sm text-gray-500">
                      {trx.createdBy?.name || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL BUAT TRANSAKSI */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-800">Catat Transaksi Stok</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-800 font-bold">&times;</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                  <input type="date" required className="w-full border rounded p-2"
                    value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Transaksi</label>
                  <select required className="w-full border rounded p-2"
                    value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                    <option value="IN">Stok Masuk (IN)</option>
                    <option value="OUT">Stok Keluar (OUT)</option>
                    <option value="MUTATION">Mutasi Antar Gudang</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Barang</label>
                <select required className="w-full border rounded p-2"
                  value={formData.itemId} onChange={e => setFormData({...formData, itemId: e.target.value})}>
                  <option value="">-- Pilih Barang --</option>
                  {items.map(it => <option key={it.id} value={it.id}>{it.code} - {it.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gudang / Lokasi (Sumber)</label>
                <select required className="w-full border rounded p-2"
                  value={formData.warehouseId} onChange={e => setFormData({...formData, warehouseId: e.target.value})}>
                  <option value="">-- Pilih Gudang --</option>
                  {warehouses.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
                </select>
                <p className="text-xs text-gray-500 mt-1">Gudang tempat stok ditambah (IN) atau dikurangi (OUT/MUTASI).</p>
              </div>

              {formData.type === 'MUTATION' && (
                <div className="bg-blue-50 p-3 rounded border border-blue-100">
                  <label className="block text-sm font-medium text-blue-800 mb-1">Gudang Tujuan Mutasi</label>
                  <select required className="w-full border border-blue-300 rounded p-2"
                    value={formData.toWarehouseId} onChange={e => setFormData({...formData, toWarehouseId: e.target.value})}>
                    <option value="">-- Pilih Gudang Tujuan --</option>
                    {warehouses.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kuantitas</label>
                  <input type="number" min="1" required className="w-full border rounded p-2"
                    value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan / Catatan</label>
                <textarea className="w-full border rounded p-2" rows="2"
                  value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})}></textarea>
              </div>

              <div className="pt-4 border-t flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50">Batal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Simpan Transaksi</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL IMPORT */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-800">Import Transaksi Stok</h2>
              <button onClick={() => setIsImportModalOpen(false)} className="text-gray-500 hover:text-gray-800 font-bold">&times;</button>
            </div>
            <form onSubmit={handleImport} className="p-6 space-y-4">
              <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm mb-4">
                <p className="font-bold mb-2">Petunjuk Import:</p>
                <ul className="list-disc ml-5 space-y-1">
                  <li>Gunakan format <b>Excel (.xlsx)</b> atau <b>CSV</b>.</li>
                  <li>Pastikan Anda sudah mengunduh dan mengisi file sesuai template.</li>
                  <li>Gudang dan Kode Barang harus persis sama dengan yang ada di sistem.</li>
                </ul>
                <button type="button" onClick={downloadTemplate} className="mt-3 flex items-center text-blue-600 hover:text-blue-800 font-semibold underline">
                  <Download className="w-4 h-4 mr-1" /> Unduh Template CSV
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pilih File</label>
                <input 
                  type="file" 
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  className="w-full border rounded p-2" 
                  onChange={(e) => setImportFile(e.target.files[0])} 
                  required 
                />
              </div>

              <div className="pt-4 border-t flex justify-end gap-3">
                <button type="button" onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50">Batal</button>
                <button type="submit" disabled={isImporting} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                  {isImporting ? 'Sedang Mengimpor...' : 'Mulai Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
