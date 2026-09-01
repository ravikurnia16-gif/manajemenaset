import React, { useState, useEffect } from 'react';
import { 
  Plus, ArrowRightLeft, ArrowDownToLine, ArrowUpFromLine, Search, 
  Info, Sparkles, Filter, CheckCircle, Clock, Package, RefreshCw, 
  Upload, Download, FileSpreadsheet, Warehouse, Calendar, AlertTriangle, 
  Tag, X, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Trash2, PlusCircle, Layers, Box
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import api from '../../lib/axios';

export default function InventoryTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  // Filter states
  const [typeFilter, setTypeFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Manual Multi-Item Transaction Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    type: 'IN',
    warehouseId: '',
    toWarehouseId: '',
    date: new Date().toISOString().split('T')[0],
    note: '',
    items: [
      { itemId: '', quantity: 1, note: '' }
    ]
  });

  // Batch Import Modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showImportRef, setShowImportRef] = useState(false);

  useEffect(() => {
    fetchTransactions();
    fetchOptions();
  }, [typeFilter, warehouseFilter]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const params = {};
      if (typeFilter) params.type = typeFilter;
      if (warehouseFilter) params.warehouseId = warehouseFilter;
      const res = await api.get('/inventory/transactions', { params });
      setTransactions(res.data || []);
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
      setItems(resItems.data || []);
      setWarehouses(resWh.data || []);
    } catch (error) {
      console.error('Failed to fetch options:', error);
    }
  };

  // Helper untuk mendapatkan stok item di gudang tertentu
  const getItemStockInWarehouse = (itemId, whId) => {
    if (!itemId || !whId) return 0;
    const it = items.find(i => i.id === parseInt(itemId));
    if (!it || !it.stocks) return 0;
    const st = it.stocks.find(s => s.warehouseId === parseInt(whId));
    return st?.quantity || 0;
  };

  // Handlers untuk multi-item form
  const handleAddItemRow = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { itemId: '', quantity: 1, note: '' }]
    }));
  };

  const handleRemoveItemRow = (idx) => {
    if (formData.items.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  const handleItemChange = (idx, field, value) => {
    setFormData(prev => {
      const updated = [...prev.items];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, items: updated };
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    
    if (!formData.warehouseId) {
      return Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Pilih Gudang Sumber terlebih dahulu!' });
    }

    if (formData.type === 'MUTATION') {
      if (!formData.toWarehouseId) {
        return Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Pilih Gudang Tujuan mutasi!' });
      }
      if (parseInt(formData.warehouseId) === parseInt(formData.toWarehouseId)) {
        return Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Gudang sumber dan gudang tujuan tidak boleh sama!' });
      }
    }

    if (!formData.items || formData.items.length === 0) {
      return Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Tambahkan minimal 1 barang!' });
    }

    // Validasi setiap baris barang
    for (let i = 0; i < formData.items.length; i++) {
      const row = formData.items[i];
      if (!row.itemId) {
        return Swal.fire({ icon: 'warning', title: 'Perhatian', text: `Barang pada baris #${i + 1} belum dipilih!` });
      }
      const qty = parseInt(row.quantity, 10);
      if (isNaN(qty) || qty <= 0) {
        return Swal.fire({ icon: 'warning', title: 'Perhatian', text: `Kuantitas pada baris #${i + 1} harus lebih dari 0!` });
      }

      if (formData.type === 'OUT' || formData.type === 'MUTATION') {
        const available = getItemStockInWarehouse(row.itemId, formData.warehouseId);
        if (qty > available) {
          const it = items.find(item => item.id === parseInt(row.itemId));
          return Swal.fire({
            icon: 'error',
            title: 'Stok Tidak Mencukupi',
            text: `Stok "${it?.name || 'Barang'}" pada baris #${i + 1} di gudang terpilih hanya tersedia ${available} ${it?.unit || 'Pcs'}, diminta ${qty}.`
          });
        }
      }
    }

    setIsSubmitting(true);
    try {
      const res = await api.post('/inventory/transactions', formData);
      setIsModalOpen(false);
      setFormData({
        type: 'IN',
        warehouseId: warehouses.length > 0 ? warehouses[0].id : '',
        toWarehouseId: '',
        date: new Date().toISOString().split('T')[0],
        note: '',
        items: [{ itemId: '', quantity: 1, note: '' }]
      });
      fetchTransactions();
      fetchOptions(); // Refresh data stok barang

      Swal.fire({
        icon: 'success',
        title: 'Transaksi Berhasil!',
        text: res.data?.message || 'Transaksi multi-barang berhasil dicatat & stok telah diperbarui.',
        timer: 2500,
        showConfirmButton: false
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Memproses Transaksi',
        text: error.response?.data?.error || 'Terjadi kesalahan sistem.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick preset note chips
  const noteSuggestions = {
    IN: ['Pengadaan Baru', 'Restock Gudang', 'Retur Barang', 'Stok Awal'],
    OUT: ['Pemakaian Operasional', 'Barang Rusak / Kadaluwarsa', 'Koreksi Opname', 'Kebutuhan Unit'],
    MUTATION: ['Pindah Lokasi Rak', 'Distribusi Antar Gudang', 'Konsolidasi Stok Gudang']
  };

  // Handle Batch Import
  const handleImport = async (e) => {
    e.preventDefault();
    if (!importFile) return alert('Pilih file Excel/CSV terlebih dahulu');

    const formDataUpload = new FormData();
    formDataUpload.append('file', importFile);

    setIsImporting(true);
    try {
      const res = await api.post('/inventory/transactions/import', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setImportResult({
        successCount: res.data.successCount,
        errorCount: res.data.errorCount || 0,
        errors: res.data.errors || []
      });
      
      setImportFile(null);
      fetchTransactions();
      fetchOptions();
    } catch (error) {
      alert(error.response?.data?.error || 'Terjadi kesalahan saat import data');
    } finally {
      setIsImporting(false);
    }
  };

  // Download Templates
  const downloadExcelTemplate = () => {
    const wb = XLSX.utils.book_new();
    const sampleItem = items.length > 0 ? items[0].name : 'Kertas HVS A4 80gr';
    const sampleWh1 = warehouses.length > 0 ? warehouses[0].name : 'Gudang Utama';
    const sampleWh2 = warehouses.length > 1 ? warehouses[1].name : 'Gudang Cadangan';

    const headers = ['Tipe', 'Nama Barang', 'Kuantitas', 'Gudang Sumber', 'Gudang Tujuan', 'Catatan'];
    const sampleRows = [
      ['IN', sampleItem, 10, sampleWh1, '', 'Stok Awal / Pengadaan'],
      ['OUT', sampleItem, 2, sampleWh1, '', 'Digunakan untuk Operasional Unit'],
      ['MUTATION', sampleItem, 5, sampleWh1, sampleWh2, 'Pindah lokasi antar gudang']
    ];

    const wsTemplate = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    wsTemplate['!cols'] = [{ wch: 14 }, { wch: 35 }, { wch: 12 }, { wch: 25 }, { wch: 25 }, { wch: 35 }];
    XLSX.utils.book_append_sheet(wb, wsTemplate, 'Template Transaksi');

    const refHeaders = ['Nama Barang (Sesuai Master Data)', 'Kode Barang', 'Gudang Tersedia (Sesuai Master Data)'];
    const maxRows = Math.max(items.length, warehouses.length);
    const refRows = [];
    for (let i = 0; i < maxRows; i++) {
      const it = items[i];
      const wh = warehouses[i];
      refRows.push([it ? it.name : '', it ? it.code : '', wh ? wh.name : '']);
    }
    const wsRef = XLSX.utils.aoa_to_sheet([refHeaders, ...refRows]);
    wsRef['!cols'] = [{ wch: 38 }, { wch: 18 }, { wch: 35 }];
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

  // Export Transactions to Excel
  const handleExportExcel = () => {
    if (filteredTransactions.length === 0) {
      return Swal.fire({ icon: 'info', title: 'Data Kosong', text: 'Tidak ada data transaksi untuk diexport.' });
    }

    const exportRows = filteredTransactions.map((trx, idx) => ({
      No: idx + 1,
      Tanggal: new Date(trx.date).toLocaleDateString('id-ID'),
      Kode_Transaksi: trx.code,
      Tipe: trx.type,
      Nama_Barang: trx.item?.name || '-',
      Kode_Barang: trx.item?.code || '-',
      Kuantitas: trx.quantity,
      Satuan: trx.item?.unit || 'Pcs',
      Gudang_Sumber: trx.warehouse?.name || '-',
      Gudang_Tujuan: trx.toWarehouse?.name || '-',
      Catatan: trx.note || '-',
      Petugas: trx.createdBy?.name || trx.createdBy?.username || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws['!cols'] = [
      { wch: 6 }, { wch: 14 }, { wch: 22 }, { wch: 12 }, 
      { wch: 32 }, { wch: 16 }, { wch: 12 }, { wch: 10 }, 
      { wch: 22 }, { wch: 22 }, { wch: 35 }, { wch: 20 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Riwayat Transaksi');
    XLSX.writeFile(wb, `Riwayat_Transaksi_Stok_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getTypeIcon = (type) => {
    switch(type) {
      case 'IN': return <ArrowDownToLine className="w-4 h-4 text-emerald-600" />;
      case 'OUT': return <ArrowUpFromLine className="w-4 h-4 text-rose-600" />;
      case 'MUTATION': return <ArrowRightLeft className="w-4 h-4 text-blue-600" />;
      default: return null;
    }
  };

  const getTypeBadge = (type) => {
    switch(type) {
      case 'IN': return <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold">STOK MASUK (IN)</span>;
      case 'OUT': return <span className="bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold">STOK KELUAR (OUT)</span>;
      case 'MUTATION': return <span className="bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold">MUTASI GUDANG</span>;
      default: return <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold">{type}</span>;
    }
  };

  const isAutoTransaction = (note = '') => {
    const lower = note.toLowerCase();
    return lower.includes('pesanan') || lower.includes('order') || lower.includes('import') || lower.includes('pengadaan');
  };

  // Filtered transactions
  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = 
      t.code.toLowerCase().includes(search.toLowerCase()) ||
      t.item?.name.toLowerCase().includes(search.toLowerCase()) ||
      t.item?.code.toLowerCase().includes(search.toLowerCase()) ||
      (t.note && t.note.toLowerCase().includes(search.toLowerCase())) ||
      (t.createdBy?.name && t.createdBy.name.toLowerCase().includes(search.toLowerCase()));
    
    let matchesDate = true;
    if (dateFilter) {
      const trxDate = new Date(t.date).toISOString().split('T')[0];
      matchesDate = trxDate === dateFilter;
    }

    return matchesSearch && matchesDate;
  });

  // Calculate statistics
  const countIn = transactions.filter(t => t.type === 'IN').reduce((acc, t) => acc + t.quantity, 0);
  const countOut = transactions.filter(t => t.type === 'OUT').reduce((acc, t) => acc + t.quantity, 0);
  const countMut = transactions.filter(t => t.type === 'MUTATION').reduce((acc, t) => acc + t.quantity, 0);

  // Total quantity calculation in modal form
  const totalModalQty = formData.items.reduce((acc, it) => acc + (parseInt(it.quantity, 10) || 0), 0);

  return (
    <div className="p-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ArrowRightLeft className="w-7 h-7 text-blue-600" />
            Transaksi Stok (Buku Mutasi Logistik)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Riwayat lengkap perpindahan, penambahan, dan pengeluaran barang di seluruh gudang.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5">
          <button 
            onClick={handleExportExcel}
            className="bg-white border border-slate-200 text-slate-700 px-3.5 py-2.5 rounded-xl font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2 text-xs shadow-2xs"
            title="Export riwayat ke Excel"
          >
            <Download size={15} className="text-emerald-600" />
            Export Excel
          </button>
          
          <button 
            onClick={() => {
              setImportResult(null);
              setImportFile(null);
              setIsImportModalOpen(true);
            }}
            className="bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 px-3.5 py-2.5 rounded-xl font-semibold transition-colors flex items-center gap-2 text-xs shadow-2xs"
          >
            <Upload size={15} />
            Import Transaksi
          </button>

          <button 
            onClick={() => {
              setFormData({
                type: 'IN',
                warehouseId: warehouses.length > 0 ? warehouses[0].id : '',
                toWarehouseId: '',
                date: new Date().toISOString().split('T')[0],
                note: '',
                items: [{ itemId: '', quantity: 1, note: '' }]
              });
              setIsModalOpen(true);
            }}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 text-xs"
          >
            <Plus className="w-4 h-4" />
            Input Transaksi (Multi-Barang)
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-emerald-100 rounded-2xl p-4 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <ArrowDownToLine size={24} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Masuk (IN)</div>
            <div className="text-xl font-extrabold text-slate-800 mt-0.5">{countIn.toLocaleString()} <span className="text-xs font-normal text-slate-400">item</span></div>
            <div className="text-[11px] text-emerald-600 font-semibold">{transactions.filter(t => t.type === 'IN').length} Transaksi</div>
          </div>
        </div>

        <div className="bg-white border border-rose-100 rounded-2xl p-4 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <ArrowUpFromLine size={24} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Keluar (OUT)</div>
            <div className="text-xl font-extrabold text-slate-800 mt-0.5">{countOut.toLocaleString()} <span className="text-xs font-normal text-slate-400">item</span></div>
            <div className="text-[11px] text-rose-600 font-semibold">{transactions.filter(t => t.type === 'OUT').length} Transaksi</div>
          </div>
        </div>

        <div className="bg-white border border-blue-100 rounded-2xl p-4 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <ArrowRightLeft size={24} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mutasi Antar Gudang</div>
            <div className="text-xl font-extrabold text-slate-800 mt-0.5">{countMut.toLocaleString()} <span className="text-xs font-normal text-slate-400">item</span></div>
            <div className="text-[11px] text-blue-600 font-semibold">{transactions.filter(t => t.type === 'MUTATION').length} Mutasi</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Package size={24} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Aktivitas</div>
            <div className="text-xl font-extrabold text-slate-800 mt-0.5">{transactions.length} <span className="text-xs font-normal text-slate-400">rekaman</span></div>
            <div className="text-[11px] text-slate-500">{items.length} Master Barang</div>
          </div>
        </div>
      </div>

      {/* Info Banner: Otomatisasi Stok */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3 shadow-2xs">
        <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
          <Sparkles size={20} />
        </div>
        <div className="space-y-1">
          <h3 className="text-xs font-bold text-blue-900 flex items-center gap-2">
            ⚡ Transaksi Stok Otomatis Berjalan!
            <span className="bg-blue-600 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase">
              Auto Sync
            </span>
          </h3>
          <p className="text-xs text-blue-800 leading-relaxed">
            Stok barang dikurangi <strong>secara otomatis oleh sistem</strong> setiap kali pesanan unit (*Requisition Order*) diselesaikan (<strong>COMPLETED</strong>). Anda tidak perlu menginput ulang transaksi stok keluar secara manual untuk pesanan barang yang telah diproses.
          </p>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white shadow-sm border border-slate-200 rounded-2xl overflow-hidden">
        
        {/* Table Filters */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3 bg-slate-50 items-center justify-between">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Cari kode TRX, nama barang, petugas, atau catatan..."
              className="pl-10 pr-4 py-2 w-full border border-slate-200 bg-white rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Tanggal */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl">
              <Calendar size={14} className="text-slate-400" />
              <input 
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="text-xs outline-none text-slate-700 bg-transparent"
                title="Filter tanggal transaksi"
              />
              {dateFilter && (
                <button onClick={() => setDateFilter('')} className="text-slate-400 hover:text-slate-600">
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Filter Gudang */}
            <select 
              className="border border-slate-200 bg-white px-3 py-2 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
            >
              <option value="">Semua Gudang</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>

            {/* Filter Tipe */}
            <select 
              className="border border-slate-200 bg-white px-3 py-2 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">Semua Tipe Transaksi</option>
              <option value="IN">Stok Masuk (IN)</option>
              <option value="OUT">Stok Keluar (OUT)</option>
              <option value="MUTATION">Mutasi Gudang (MUTATION)</option>
            </select>

            <button 
              onClick={() => {
                fetchTransactions();
                fetchOptions();
              }} 
              className="p-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl transition-colors"
              title="Refresh data"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                <th className="p-4">Tanggal & Kode</th>
                <th className="p-4">Tipe Transaksi</th>
                <th className="p-4">Nama Barang</th>
                <th className="p-4">Gudang Sumber / Tujuan</th>
                <th className="p-4 text-center">Kuantitas</th>
                <th className="p-4">Keterangan / Catatan</th>
                <th className="p-4">Petugas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="7" className="p-8 text-center text-slate-400">Memuat riwayat transaksi...</td></tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-slate-400">
                    <Package className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                    Tidak ada transaksi ditemukan sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((trx) => {
                  const autoTrx = isAutoTransaction(trx.note);
                  return (
                    <tr key={trx.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-sm text-slate-800">
                          {new Date(trx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">{trx.code}</div>
                      </td>
                      <td className="p-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            {getTypeIcon(trx.type)}
                            {getTypeBadge(trx.type)}
                          </div>
                          {autoTrx && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                              ⚡ Otomatis Sistem
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-sm text-slate-800">{trx.item?.name || '-'}</div>
                        <div className="text-xs text-slate-400 font-mono">{trx.item?.code || '-'}</div>
                      </td>
                      <td className="p-4 text-xs">
                        <div className="text-slate-800 font-medium">
                          <span className="text-slate-400">Dari:</span> <b>{trx.warehouse?.name || '-'}</b>
                        </div>
                        {trx.toWarehouse && (
                          <div className="text-blue-600 font-semibold mt-1">
                            <span className="text-slate-400 font-normal">Ke:</span> <b>{trx.toWarehouse.name}</b>
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`text-base font-extrabold ${trx.type === 'IN' ? 'text-emerald-600' : trx.type === 'OUT' ? 'text-rose-600' : 'text-blue-600'}`}>
                          {trx.type === 'IN' ? '+' : trx.type === 'OUT' ? '-' : ''}{trx.quantity}
                        </span>{' '}
                        <span className="text-xs font-medium text-slate-500">{trx.item?.unit || 'Pcs'}</span>
                      </td>
                      <td className="p-4 text-xs text-slate-600 max-w-xs truncate" title={trx.note}>
                        {trx.note || '-'}
                      </td>
                      <td className="p-4 text-xs font-medium text-slate-500">
                        {trx.createdBy?.name || trx.createdBy?.username || 'Sistem'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL INPUT TRANSAKSI MULTI-BARANG DI GUDANG YANG SAMA    */}
      {/* ======================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/90 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                  <Layers size={22} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">Catat Transaksi Stok (Multi-Barang)</h2>
                  <p className="text-xs text-slate-500">Input beberapa transaksi barang sekaligus di gudang yang sama</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form Scrollable */}
            <form onSubmit={handleCreate} className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
              
              {/* Header Information Box: Tipe, Tanggal, Gudang Sumber, Gudang Tujuan */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <Warehouse size={16} className="text-blue-600" />
                  1. Informasi Gudang & Jenis Transaksi
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  
                  {/* Tipe Transaksi */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Tipe Transaksi
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, type: 'IN' })}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${formData.type === 'IN' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'}`}
                      >
                        <ArrowDownToLine size={12} /> IN
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, type: 'OUT' })}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${formData.type === 'OUT' ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'}`}
                      >
                        <ArrowUpFromLine size={12} /> OUT
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, type: 'MUTATION' })}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${formData.type === 'MUTATION' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'}`}
                      >
                        <ArrowRightLeft size={12} /> MUTASI
                      </button>
                    </div>
                  </div>

                  {/* Tanggal */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Tanggal Transaksi
                    </label>
                    <input 
                      type="date" 
                      required 
                      className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.date} 
                      onChange={e => setFormData({...formData, date: e.target.value})} 
                    />
                  </div>

                  {/* Gudang Sumber */}
                  <div className={formData.type === 'MUTATION' ? '' : 'sm:col-span-2'}>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      {formData.type === 'IN' ? 'Gudang Penyimpanan (Tujuan)' : 'Gudang Sumber (Asal Stok)'}
                    </label>
                    <select 
                      required 
                      className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.warehouseId} 
                      onChange={e => setFormData({...formData, warehouseId: e.target.value})}
                    >
                      <option value="">-- Pilih Gudang Sumber --</option>
                      {warehouses.map(wh => (
                        <option key={wh.id} value={wh.id}>{wh.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Gudang Tujuan Mutasi */}
                  {formData.type === 'MUTATION' && (
                    <div className="bg-blue-50 p-2 rounded-xl border border-blue-200">
                      <label className="block text-[11px] font-bold text-blue-900 uppercase mb-1">
                        Gudang Tujuan Mutasi
                      </label>
                      <select 
                        required 
                        className="w-full bg-white border border-blue-300 rounded-lg p-1.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.toWarehouseId} 
                        onChange={e => setFormData({...formData, toWarehouseId: e.target.value})}
                      >
                        <option value="">-- Pilih Gudang Tujuan --</option>
                        {warehouses
                          .filter(wh => wh.id !== parseInt(formData.warehouseId))
                          .map(wh => (
                            <option key={wh.id} value={wh.id}>{wh.name}</option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Catatan Umum */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase">
                      Catatan / Keterangan Umum Transaksi
                    </label>
                    <div className="flex flex-wrap items-center gap-1">
                      {(noteSuggestions[formData.type] || []).map((chip, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setFormData({ ...formData, note: chip })}
                          className="px-1.5 py-0.5 bg-white hover:bg-blue-50 text-blue-700 border border-slate-200 rounded text-[10px] font-semibold transition-colors"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Contoh: Pengadaan awal bulan, pemindahan stok berkala, pemakaian operasional divisi..."
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.note}
                    onChange={e => setFormData({ ...formData, note: e.target.value })}
                  />
                </div>
              </div>

              {/* Multi-Item Table Section */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Box size={16} className="text-blue-600" />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      2. Daftar Barang yang Ditransaksikan ({formData.items.length} Barang)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="flex items-center gap-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors"
                  >
                    <PlusCircle size={14} />
                    Tambah Baris Barang
                  </button>
                </div>

                {/* Table Rows */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/80 text-slate-600 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                        <th className="p-3 w-10 text-center">#</th>
                        <th className="p-3 min-w-[240px]">Nama Barang & Ketersediaan Stok</th>
                        <th className="p-3 w-36">Kuantitas</th>
                        <th className="p-3 min-w-[180px]">Catatan Khusus (Opsional)</th>
                        <th className="p-3 w-12 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {formData.items.map((row, idx) => {
                        const selectedItemInRow = items.find(it => it.id === parseInt(row.itemId));
                        const availableStock = getItemStockInWarehouse(row.itemId, formData.warehouseId);
                        const isOverStock = (formData.type === 'OUT' || formData.type === 'MUTATION') && parseInt(row.quantity, 10) > availableStock;

                        return (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-3 text-center text-xs font-bold text-slate-400">
                              {idx + 1}
                            </td>
                            
                            {/* Pilih Barang */}
                            <td className="p-3 space-y-1">
                              <select
                                required
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                                value={row.itemId}
                                onChange={e => handleItemChange(idx, 'itemId', e.target.value)}
                              >
                                <option value="">-- Pilih Barang --</option>
                                {items.map(it => (
                                  <option key={it.id} value={it.id}>
                                    {it.name} ({it.code}) - {it.category?.name || 'Umum'} [Total: {it.totalStock || 0} {it.unit}]
                                  </option>
                                ))}
                              </select>

                              {/* Stok Info Badge */}
                              {selectedItemInRow && formData.warehouseId && (
                                <div className="flex items-center justify-between text-[11px] px-1">
                                  <span className="text-slate-500">Stok di gudang sumber:</span>
                                  <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${availableStock > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                                    {availableStock} {selectedItemInRow.unit}
                                  </span>
                                </div>
                              )}
                            </td>

                            {/* Kuantitas */}
                            <td className="p-3 space-y-1">
                              <div className="relative">
                                <input
                                  type="number"
                                  min="1"
                                  required
                                  placeholder="Jumlah..."
                                  className={`w-full bg-slate-50 border rounded-xl p-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:bg-white ${
                                    isOverStock ? 'border-rose-400 focus:ring-rose-500 bg-rose-50/50' : 'border-slate-200 focus:ring-blue-500'
                                  }`}
                                  value={row.quantity}
                                  onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                                />
                                {selectedItemInRow && (
                                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                                    {selectedItemInRow.unit}
                                  </span>
                                )}
                              </div>

                              {isOverStock && (
                                <div className="text-[10px] text-rose-600 font-bold flex items-center gap-0.5">
                                  <AlertTriangle size={11} className="shrink-0" /> Melebihi stok ({availableStock})
                                </div>
                              )}
                            </td>

                            {/* Catatan Baris */}
                            <td className="p-3">
                              <input
                                type="text"
                                placeholder="Keterangan item ini..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                                value={row.note}
                                onChange={e => handleItemChange(idx, 'note', e.target.value)}
                              />
                            </td>

                            {/* Delete Button */}
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                disabled={formData.items.length <= 1}
                                onClick={() => handleRemoveItemRow(idx)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                                title="Hapus baris barang"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Add Row Button at Bottom of Table */}
                  <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap justify-between items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAddItemRow}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-blue-100/50 transition-colors"
                    >
                      <Plus size={14} /> Tambah Barang Lain
                    </button>

                    <div className="text-xs text-slate-600 font-medium flex items-center gap-4">
                      <span>Total Jenis Barang: <b>{formData.items.length}</b></span>
                      <span>Total Kuantitas: <b className="text-blue-600 font-extrabold">{totalModalQty}</b> item</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                <div className="text-xs text-slate-400 italic">
                  *Semua transaksi di atas akan disimpan dan stok gudang akan diperbarui otomatis.
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)} 
                    className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full"></span>
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <CheckCircle size={15} />
                        Simpan Semua Transaksi ({formData.items.length} Barang)
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL IMPORT TRANSAKSI STOK (EXCEL / CSV)  */}
      {/* ========================================== */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b bg-slate-50/80 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <Upload size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">Import Transaksi Stok Sekaligus</h2>
                  <p className="text-xs text-slate-500">Upload file Excel (.xlsx) atau CSV untuk input transaksi massal</p>
                </div>
              </div>
              <button 
                onClick={() => setIsImportModalOpen(false)} 
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Hasil Import Result View */}
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
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Detail Kesalahan Baris:</h4>
                    <div className="max-h-48 overflow-y-auto bg-slate-50 border border-slate-200 rounded-xl p-3 divide-y divide-slate-200 text-xs text-red-700 font-mono">
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
                    className="px-5 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition-colors"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleImport} className="p-6 space-y-4">
                {/* Petunjuk Format Import */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-blue-900 p-4 rounded-xl text-xs space-y-2.5">
                  <div className="flex items-center gap-2 font-bold text-blue-950 text-sm">
                    <Info size={16} className="text-blue-600 shrink-0" />
                    Format Kolom Import:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-4 list-disc">
                    <div><b>1. Tipe:</b> <span className="text-blue-700 font-mono font-bold">IN</span>, <span className="text-blue-700 font-mono font-bold">OUT</span>, atau <span className="text-blue-700 font-mono font-bold">MUTATION</span></div>
                    <div><b>2. Nama Barang:</b> Sesuai Master Data Barang</div>
                    <div><b>3. Kuantitas:</b> Angka jumlah (&gt; 0)</div>
                    <div><b>4. Gudang Sumber:</b> Sesuai Master Gudang</div>
                    <div><b>5. Gudang Tujuan:</b> Wajib untuk MUTATION</div>
                    <div><b>6. Catatan:</b> Keterangan transaksi (opsional)</div>
                  </div>
                  
                  <div className="pt-2 border-t border-blue-200 flex items-center gap-1.5 text-[11px] text-blue-800 font-medium">
                    <Sparkles size={14} className="text-amber-500 shrink-0" />
                    <span><b>Tanggal Transaksi:</b> Terisi otomatis saat import dijalankan.</span>
                  </div>

                  {/* Buttons Download Template */}
                  <div className="pt-2 flex flex-wrap gap-2">
                    <button 
                      type="button" 
                      onClick={downloadExcelTemplate} 
                      className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-emerald-700 shadow-xs transition-colors text-xs"
                    >
                      <FileSpreadsheet size={14} /> Unduh Template Excel (.xlsx)
                    </button>
                    <button 
                      type="button" 
                      onClick={downloadCsvTemplate} 
                      className="flex items-center gap-1.5 bg-white border border-blue-300 text-blue-800 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-100 transition-colors text-xs"
                    >
                      <Download size={14} /> Unduh Template CSV
                    </button>
                  </div>
                </div>

                {/* Collapsible Referensi Master Data */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowImportRef(!showImportRef)}
                    className="w-full p-3 bg-slate-50 hover:bg-slate-100 flex justify-between items-center text-xs font-semibold text-slate-700 transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <Warehouse size={14} className="text-slate-500" />
                      Lihat Daftar Nama Gudang & Barang Aktif ({warehouses.length} Gudang, {items.length} Barang)
                    </span>
                    {showImportRef ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {showImportRef && (
                    <div className="p-3 bg-white border-t border-slate-200 text-xs space-y-3 max-h-44 overflow-y-auto">
                      <div>
                        <span className="font-bold text-slate-800 block mb-1.5">Nama Gudang Terdaftar:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {warehouses.map(w => (
                            <span key={w.id} className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border text-[11px] font-medium">
                              {w.name}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="font-bold text-slate-800 block mb-1.5">Contoh Nama Barang:</span>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                          {items.slice(0, 15).map(it => (
                            <span key={it.id} className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-100 text-[11px]">
                              {it.name}
                            </span>
                          ))}
                          {items.length > 15 && (
                            <span className="text-[11px] text-slate-500 self-center">+ {items.length - 15} lainnya (ada di Sheet 2 Excel)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* File Input */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Pilih File Excel (.xlsx) / CSV
                  </label>
                  <input 
                    type="file" 
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" 
                    onChange={(e) => setImportFile(e.target.files[0])} 
                    required 
                  />
                  {importFile && (
                    <p className="text-xs text-slate-500 mt-1.5">
                      File terpilih: <b>{importFile.name}</b> ({(importFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t flex justify-end gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsImportModalOpen(false)} 
                    className="px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={isImporting} 
                    className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
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



