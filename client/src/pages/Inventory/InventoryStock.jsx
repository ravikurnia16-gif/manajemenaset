import React, { useState, useEffect } from 'react';
import { Search, Filter, Box, Upload, Download } from 'lucide-react';
import api from '../../lib/axios';

export default function InventoryStock() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedItemId, setExpandedItemId] = useState(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await api.get('/inventory/items');
      setItems(res.data);
    } catch (error) {
      console.error('Failed to fetch items:', error);
    } finally {
      setLoading(false);
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
      fetchItems();
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

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) || 
    item.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <Box className="w-6 h-6 mr-2 text-blue-600" />
          Stok Barang (Multi-Gudang)
        </h1>
        <button 
          onClick={() => setIsImportModalOpen(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center"
        >
          <Upload className="w-4 h-4 mr-2" />
          Import Stok (CSV/Excel)
        </button>
      </div>

      <div className="bg-white shadow rounded-lg mb-6">
        <div className="p-4 border-b flex flex-wrap gap-4 justify-between items-center bg-gray-50 rounded-t-lg">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Cari nama atau kode barang..."
              className="pl-10 pr-4 py-2 w-full border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="text-sm text-gray-500">
            *Klik baris barang untuk melihat rincian lokasi gudang
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-600 text-sm uppercase tracking-wider border-b">
                <th className="p-4">Kode</th>
                <th className="p-4">Nama Barang</th>
                <th className="p-4">Kategori</th>
                <th className="p-4">Satuan</th>
                <th className="p-4 text-center">Min. Stok</th>
                <th className="p-4 text-center">Total Stok</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-500">Memuat data...</td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-500">Tidak ada data stok ditemukan.</td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isExpanded = expandedItemId === item.id;
                  const isLowStock = item.totalStock <= item.minStock;

                  return (
                    <React.Fragment key={item.id}>
                      <tr 
                        className={`border-b hover:bg-gray-50 cursor-pointer transition-colors ${isLowStock ? 'bg-red-50' : ''}`}
                        onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                      >
                        <td className="p-4 font-mono text-sm">{item.code}</td>
                        <td className="p-4 font-medium">{item.name}</td>
                        <td className="p-4">{item.category?.name || '-'}</td>
                        <td className="p-4 text-sm">{item.unit}</td>
                        <td className="p-4 text-center text-sm">{item.minStock}</td>
                        <td className="p-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-sm font-bold ${isLowStock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {item.totalStock}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <td colSpan="6" className="p-4">
                            <div className="bg-white border rounded-lg p-4 ml-8 shadow-sm">
                              <h4 className="font-semibold text-sm text-gray-700 mb-3 border-b pb-2">Rincian Lokasi Gudang</h4>
                              {item.stocks && item.stocks.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {item.stocks.map((stock) => (
                                    <div key={stock.id} className="flex justify-between items-center p-3 bg-gray-50 border rounded">
                                      <div>
                                        <div className="font-medium text-sm">{stock.warehouse?.name}</div>
                                        {stock.location && <div className="text-xs text-gray-500">Rak: {stock.location}</div>}
                                      </div>
                                      <div className="text-lg font-bold text-gray-800">{stock.quantity}</div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500 italic">Belum ada stok di gudang manapun.</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

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
