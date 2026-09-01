import React, { useState, useEffect } from 'react';
import { 
  Search, Box, Upload, Download, FileSpreadsheet, 
  CheckCircle2, AlertCircle, Warehouse, Info, ChevronDown, ChevronUp, X, Sparkles 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../../lib/axios';

export default function InventoryStock() {
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedItemId, setExpandedItemId] = useState(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resItems, resWh] = await Promise.all([
        api.get('/inventory/items'),
        api.get('/inventory/warehouses')
      ]);
      setItems(resItems.data || []);
      setWarehouses(resWh.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
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
      
      setImportResult({
        successCount: res.data.successCount,
        errorCount: res.data.errorCount || 0,
        errors: res.data.errors || []
      });
      
      setImportFile(null);
      fetchData();
    } catch (error) {
      alert(error.response?.data?.error || 'Terjadi kesalahan saat import data');
    } finally {
      setIsImporting(false);
    }
  };

  const downloadExcelTemplate = () => {
    const wb = XLSX.utils.book_new();

    const sampleItem = items.length > 0 ? items[0].name : 'Kertas HVS A4 80gr';
    const sampleWh1 = warehouses.length > 0 ? warehouses[0].name : 'Gudang Utama';
    const sampleWh2 = warehouses.length > 1 ? warehouses[1].name : (warehouses.length > 0 ? warehouses[0].name : 'Gudang Cadangan');

    // Sheet 1: Template Transaksi
    const headers = ['Tipe', 'Nama Barang', 'Kuantitas', 'Gudang Sumber', 'Gudang Tujuan', 'Catatan'];
    const sampleRows = [
      ['IN', sampleItem, 10, sampleWh1, '', 'Stok Awal / Pengadaan'],
      ['OUT', sampleItem, 2, sampleWh1, '', 'Digunakan untuk Operasional Unit'],
      ['MUTATION', sampleItem, 5, sampleWh1, sampleWh2, 'Pindah lokasi antar gudang']
    ];

    const wsTemplate = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    wsTemplate['!cols'] = [
      { wch: 14 }, // Tipe
      { wch: 35 }, // Nama Barang
      { wch: 12 }, // Kuantitas
      { wch: 25 }, // Gudang Sumber
      { wch: 25 }, // Gudang Tujuan
      { wch: 35 }  // Catatan
    ];
    XLSX.utils.book_append_sheet(wb, wsTemplate, 'Template Transaksi');

    // Sheet 2: Referensi Master Data
    const refHeaders = ['Nama Barang (Sesuai Master Data)', 'Kode Barang', 'Gudang Tersedia (Sesuai Master Data)'];
    const maxRows = Math.max(items.length, warehouses.length);
    const refRows = [];
    for (let i = 0; i < maxRows; i++) {
      const it = items[i];
      const wh = warehouses[i];
      refRows.push([
        it ? it.name : '',
        it ? it.code : '',
        wh ? wh.name : ''
      ]);
    }
    const wsRef = XLSX.utils.aoa_to_sheet([refHeaders, ...refRows]);
    wsRef['!cols'] = [
      { wch: 38 },
      { wch: 18 },
      { wch: 35 }
    ];
    XLSX.utils.book_append_sheet(wb, wsRef, 'Referensi Master Data');

    XLSX.writeFile(wb, 'Template_Import_Transaksi_Stok.xlsx');
  };

  const downloadCsvTemplate = () => {
    const sampleItem = items.length > 0 ? items[0].name : 'Kertas HVS A4 80gr';
    const sampleWh1 = warehouses.length > 0 ? warehouses[0].name : 'Gudang Utama';
    const sampleWh2 = warehouses.length > 1 ? warehouses[1].name : 'Gudang Cadangan';

    const csvRows = [
      'Tipe,Nama Barang,Kuantitas,Gudang Sumber,Gudang Tujuan,Catatan',
      `IN,"${sampleItem.replace(/"/g, '""')}",10,"${sampleWh1.replace(/"/g, '""')}",,"Stok Awal"`,
      `OUT,"${sampleItem.replace(/"/g, '""')}",2,"${sampleWh1.replace(/"/g, '""')}",,"Pengeluaran"`,
      `MUTATION,"${sampleItem.replace(/"/g, '""')}",5,"${sampleWh1.replace(/"/g, '""')}","${sampleWh2.replace(/"/g, '""')}","Pindah Lokasi"`
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'Template_Import_Transaksi_Stok.csv');
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Box className="w-6 h-6 text-blue-600" />
            Stok Barang (Multi-Gudang)
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Monitor posisi dan pergerakan stok barang di setiap gudang penyimpanan.
          </p>
        </div>
        <button 
          onClick={() => {
            setImportResult(null);
            setImportFile(null);
            setIsImportModalOpen(true);
          }}
          className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl hover:bg-emerald-700 font-semibold flex items-center gap-2 shadow-sm transition-colors"
        >
          <Upload className="w-4 h-4" />
          Import Transaksi Stok
        </button>
      </div>

      <div className="bg-white shadow-sm border border-gray-200 rounded-xl mb-6 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 justify-between items-center bg-gray-50/70">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Cari nama atau kode barang..."
              className="pl-9 pr-4 py-2 w-full border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-1.5">
            <Info size={14} className="text-blue-500" />
            Klik baris barang untuk melihat rincian lokasi gudang
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100/70 text-gray-600 text-xs uppercase tracking-wider border-b font-semibold">
                <th className="p-4">Kode</th>
                <th className="p-4">Nama Barang</th>
                <th className="p-4">Kategori</th>
                <th className="p-4">Satuan</th>
                <th className="p-4 text-center">Min. Stok</th>
                <th className="p-4 text-center">Total Stok</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-500">Memuat data stok...</td>
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
                        className={`hover:bg-blue-50/40 cursor-pointer transition-colors ${isLowStock ? 'bg-amber-50/40' : ''}`}
                        onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                      >
                        <td className="p-4 font-mono text-xs font-semibold text-gray-600">{item.code}</td>
                        <td className="p-4 font-medium text-gray-900">{item.name}</td>
                        <td className="p-4 text-sm text-gray-600">{item.category?.name || '-'}</td>
                        <td className="p-4 text-sm text-gray-600">{item.unit}</td>
                        <td className="p-4 text-center text-sm font-medium text-gray-600">{item.minStock}</td>
                        <td className="p-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${isLowStock ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                            {item.totalStock} {item.unit}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50/70 border-b border-gray-200">
                          <td colSpan="6" className="p-4">
                            <div className="bg-white border border-gray-200 rounded-xl p-4 ml-6 shadow-sm">
                              <h4 className="font-semibold text-xs uppercase tracking-wider text-gray-600 mb-3 border-b pb-2 flex items-center gap-2">
                                <Warehouse size={14} className="text-blue-600" />
                                Rincian Stok per Lokasi Gudang
                              </h4>
                              {item.stocks && item.stocks.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {item.stocks.map((stock) => (
                                    <div key={stock.id} className="flex justify-between items-center p-3 bg-gray-50 border border-gray-100 rounded-lg">
                                      <div>
                                        <div className="font-semibold text-sm text-gray-800">{stock.warehouse?.name}</div>
                                        {stock.location && <div className="text-xs text-gray-500">Rak/Lokasi: {stock.location}</div>}
                                      </div>
                                      <div className="text-base font-bold text-gray-800 bg-white px-2.5 py-1 rounded border border-gray-200 shadow-2xs">
                                        {stock.quantity} <span className="text-xs font-normal text-gray-500">{item.unit}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-500 italic">Belum ada stok barang di gudang manapun.</p>
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b bg-gray-50/80 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                  <Upload size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Import Transaksi Stok</h2>
                  <p className="text-xs text-gray-500">Upload file Excel atau CSV untuk transaksi Masuk, Keluar, atau Mutasi</p>
                </div>
              </div>
              <button 
                onClick={() => setIsImportModalOpen(false)} 
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200/50 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* HASIL IMPORT REPORT */}
            {importResult ? (
              <div className="p-6 space-y-4">
                <div className={`p-4 rounded-xl border flex items-start gap-3 ${importResult.errorCount === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                  {importResult.errorCount === 0 ? (
                    <CheckCircle2 size={24} className="text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={24} className="text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h3 className="font-bold text-sm">
                      {importResult.errorCount === 0 
                        ? `Berhasil! ${importResult.successCount} transaksi stok berhasil diimport.` 
                        : `Import Selesai: ${importResult.successCount} transaksi berhasil, ${importResult.errorCount} baris gagal.`}
                    </h3>
                    <p className="text-xs mt-1">
                      {importResult.errorCount === 0 
                        ? 'Semua data transaksi dan jumlah stok gudang telah diperbarui di sistem.' 
                        : 'Silakan periksa daftar kesalahan berikut dan perbaiki data sebelum mengimpor kembali baris yang gagal.'}
                    </p>
                  </div>
                </div>

                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Detail Kesalahan Baris:</h4>
                    <div className="max-h-48 overflow-y-auto bg-gray-50 border border-gray-200 rounded-xl p-3 divide-y divide-gray-200 text-xs text-red-700 font-mono">
                      {importResult.errors.map((err, i) => (
                        <div key={i} className="py-1.5 first:pt-0 last:pb-0 flex items-start gap-2">
                          <span className="text-red-500 font-bold">•</span>
                          <span>{err}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t flex justify-end gap-3">
                  <button 
                    onClick={() => {
                      setImportResult(null);
                      setIsImportModalOpen(false);
                    }}
                    className="px-5 py-2.5 bg-gray-800 text-white rounded-xl text-sm font-semibold hover:bg-gray-900 transition-colors"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleImport} className="p-6 space-y-4">
                {/* Petunjuk Import Box */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-blue-900 p-4 rounded-xl text-xs space-y-2.5">
                  <div className="flex items-center gap-2 font-bold text-blue-950 text-sm">
                    <Info size={16} className="text-blue-600 shrink-0" />
                    Format Kolom Import yang Dibutuhkan:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6 list-disc">
                    <div><b>1. Tipe:</b> <span className="text-blue-700 font-mono">IN</span>, <span className="text-blue-700 font-mono">OUT</span>, atau <span className="text-blue-700 font-mono">MUTATION</span></div>
                    <div><b>2. Nama Barang:</b> Sesuai Master Data Barang</div>
                    <div><b>3. Kuantitas:</b> Angka jumlah (&gt; 0)</div>
                    <div><b>4. Gudang Sumber:</b> Sesuai Master Gudang</div>
                    <div><b>5. Gudang Tujuan:</b> Wajib untuk MUTATION</div>
                    <div><b>6. Catatan:</b> Keterangan transaksi (opsional)</div>
                  </div>
                  
                  <div className="pt-2 border-t border-blue-200 flex items-center gap-1.5 text-[11px] text-blue-800 font-medium">
                    <Sparkles size={14} className="text-amber-500 shrink-0" />
                    <span><b>Tanggal Transaksi:</b> Terisi otomatis dengan waktu saat import dijalankan.</span>
                  </div>

                  {/* Tombol Download Template */}
                  <div className="pt-2 flex flex-wrap gap-2">
                    <button 
                      type="button" 
                      onClick={downloadExcelTemplate} 
                      className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-emerald-700 shadow-xs transition-colors"
                    >
                      <FileSpreadsheet size={14} /> Unduh Template Excel (.xlsx)
                    </button>
                    <button 
                      type="button" 
                      onClick={downloadCsvTemplate} 
                      className="flex items-center gap-1.5 bg-white border border-blue-300 text-blue-800 px-3 py-1.5 rounded-lg font-semibold hover:bg-blue-100 transition-colors"
                    >
                      <Download size={14} /> Unduh Template CSV
                    </button>
                  </div>
                </div>

                {/* Collapsible Referensi Master Data */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowReference(!showReference)}
                    className="w-full p-3 bg-gray-50 hover:bg-gray-100 flex justify-between items-center text-xs font-semibold text-gray-700 transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <Warehouse size={14} className="text-gray-500" />
                      Lihat Daftar Nama Gudang & Barang Aktif ({warehouses.length} Gudang, {items.length} Barang)
                    </span>
                    {showReference ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {showReference && (
                    <div className="p-3 bg-white border-t border-gray-200 text-xs space-y-3 max-h-48 overflow-y-auto">
                      <div>
                        <span className="font-bold text-gray-800 block mb-1.5">Nama Gudang Terdaftar:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {warehouses.map(w => (
                            <span key={w.id} className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border text-[11px] font-medium">
                              {w.name}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="font-bold text-gray-800 block mb-1.5">Contoh Nama Barang:</span>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                          {items.slice(0, 15).map(it => (
                            <span key={it.id} className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-100 text-[11px]">
                              {it.name}
                            </span>
                          ))}
                          {items.length > 15 && (
                            <span className="text-[11px] text-gray-500 self-center">+ {items.length - 15} lainnya (lihat di Template Excel)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* File Input */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                    Pilih File Excel (.xlsx) / CSV
                  </label>
                  <input 
                    type="file" 
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    className="w-full border border-gray-300 rounded-xl p-2.5 text-sm file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" 
                    onChange={(e) => setImportFile(e.target.files[0])} 
                    required 
                  />
                  {importFile && (
                    <p className="text-xs text-gray-500 mt-1.5">
                      File terpilih: <b>{importFile.name}</b> ({(importFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t flex justify-end gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsImportModalOpen(false)} 
                    className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={isImporting} 
                    className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
                  >
                    {isImporting ? (
                      <>
                        <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                        Sedang Mengimpor...
                      </>
                    ) : (
                      <>
                        <Upload size={16} />
                        Mulai Import
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
