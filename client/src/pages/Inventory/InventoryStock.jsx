import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Box, ArrowLeftRight, Search, Plus, Upload, Download, FileSpreadsheet,
  Warehouse, Calendar, AlertTriangle, Layers, Trash2, PlusCircle, RefreshCw,
  Info, CheckCircle2, AlertCircle, Sparkles, ChevronDown, ChevronUp, X, Filter, Tag,
  Printer, Loader2, FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import api from '../../lib/axios';

/* ── jsPDF + autoTable CDN loader ── */
function loadJsPDF() {
  return new Promise((resolve) => {
    if (window.jspdf) { resolve(window.jspdf.jsPDF); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = () => {
      const s2 = document.createElement('script');
      s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
      s2.onload = () => resolve(window.jspdf.jsPDF);
      document.head.appendChild(s2);
    };
    document.head.appendChild(s);
  });
}

const computeStockDateRange = (preset) => {
  const now = new Date();
  const toYMD = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const todayStr = toYMD(now);

  if (preset === 'TODAY') return { startDate: todayStr, endDate: todayStr };
  if (preset === 'THIS_WEEK') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(new Date().setDate(diff));
    return { startDate: toYMD(monday), endDate: todayStr };
  }
  if (preset === 'LAST_7_DAYS') {
    const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    return { startDate: toYMD(sevenDaysAgo), endDate: todayStr };
  }
  if (preset === 'THIS_MONTH') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: toYMD(firstDay), endDate: todayStr };
  }
  if (preset === 'LAST_30_DAYS') {
    const thirtyDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
    return { startDate: toYMD(thirtyDaysAgo), endDate: todayStr };
  }
  return { startDate: '', endDate: '' };
};

export default function InventoryStock({ defaultTab = 'stock' }) {
  const location = useLocation();

  // Active Tab State ('stock' | 'transactions')
  const [activeTab, setActiveTab] = useState(() => {
    if (location.pathname.includes('/transaksi') || location.pathname.includes('/transactions')) {
      return 'transactions';
    }
    return defaultTab;
  });

  // Shared Data States
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tab 1: Stock States
  const [stockSearch, setStockSearch] = useState('');
  const [stockWarehouseFilter, setStockWarehouseFilter] = useState('');
  const [expandedItemId, setExpandedItemId] = useState(null);

  // Tab 2: Transaction States & Date Filtering
  const [trxTypeFilter, setTrxTypeFilter] = useState('');
  const [trxWarehouseFilter, setTrxWarehouseFilter] = useState('');
  const [trxSearch, setTrxSearch] = useState('');
  const [trxDatePreset, setTrxDatePreset] = useState('ALL');
  const [trxStartDate, setTrxStartDate] = useState('');
  const [trxEndDate, setTrxEndDate] = useState('');
  const [trxCustomStart, setTrxCustomStart] = useState('');
  const [trxCustomEnd, setTrxCustomEnd] = useState('');
  const [showTrxCustom, setShowTrxCustom] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Multi-Item Manual Transaction Modal State
  const [isTrxModalOpen, setIsTrxModalOpen] = useState(false);
  const [isSubmittingTrx, setIsSubmittingTrx] = useState(false);
  const [trxFormData, setTrxFormData] = useState({
    type: 'IN',
    warehouseId: '',
    toWarehouseId: '',
    date: new Date().toISOString().split('T')[0],
    note: '',
    items: [
      { itemId: '', quantity: 1, note: '' }
    ]
  });

  // Batch Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showImportRef, setShowImportRef] = useState(false);

  const handleTrxPresetChange = (preset) => {
    setTrxDatePreset(preset);
    if (preset === 'ALL') {
      setShowTrxCustom(false);
      setTrxStartDate('');
      setTrxEndDate('');
      setTrxCustomStart('');
      setTrxCustomEnd('');
    } else if (preset === 'CUSTOM') {
      setShowTrxCustom(true);
    } else {
      setShowTrxCustom(false);
      const r = computeStockDateRange(preset);
      setTrxStartDate(r.startDate);
      setTrxEndDate(r.endDate);
      setTrxCustomStart(r.startDate);
      setTrxCustomEnd(r.endDate);
    }
  };

  const handleApplyTrxCustomDate = () => {
    setTrxStartDate(trxCustomStart);
    setTrxEndDate(trxCustomEnd);
  };

  useEffect(() => {
    fetchAllData();
  }, [trxTypeFilter, trxWarehouseFilter, trxStartDate, trxEndDate]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (trxTypeFilter) params.type = trxTypeFilter;
      if (trxWarehouseFilter) params.warehouseId = trxWarehouseFilter;
      if (trxStartDate) params.startDate = trxStartDate;
      if (trxEndDate) params.endDate = trxEndDate;

      const [resItems, resWh, resTrx] = await Promise.all([
        api.get('/inventory/items'),
        api.get('/inventory/warehouses'),
        api.get('/inventory/transactions', { params })
      ]);

      setItems(resItems.data || []);
      setWarehouses(resWh.data || []);
      setTransactions(resTrx.data || []);
    } catch (error) {
      console.error('Failed to fetch inventory data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper untuk cek stok barang di gudang tertentu
  const getItemStockInWarehouse = (itemId, whId) => {
    if (!itemId || !whId) return 0;
    const it = items.find(i => i.id === parseInt(itemId));
    if (!it || !it.stocks) return 0;
    const st = it.stocks.find(s => s.warehouseId === parseInt(whId));
    return st?.quantity || 0;
  };

  // Metrik Ringkasan
  const metrics = useMemo(() => {
    const totalItems = items.length;
    const totalStockUnits = items.reduce((acc, item) => acc + (item.totalStock || 0), 0);
    const lowStockCount = items.filter(item => (item.totalStock || 0) <= (item.minStock || 5) && (item.totalStock || 0) > 0).length;
    const outOfStockCount = items.filter(item => (item.totalStock || 0) === 0).length;
    const totalTransactions = transactions.length;

    return {
      totalItems,
      totalStockUnits,
      lowStockCount,
      outOfStockCount,
      totalTransactions
    };
  }, [items, transactions]);

  // Handlers untuk Multi-Item Form
  const handleAddItemRow = () => {
    setTrxFormData(prev => ({
      ...prev,
      items: [...prev.items, { itemId: '', quantity: 1, note: '' }]
    }));
  };

  const handleRemoveItemRow = (idx) => {
    if (trxFormData.items.length <= 1) return;
    setTrxFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  const handleItemChange = (idx, field, value) => {
    setTrxFormData(prev => {
      const updated = [...prev.items];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, items: updated };
    });
  };

  const handleCreateTransaction = async (e) => {
    e.preventDefault();
    
    if (!trxFormData.warehouseId) {
      return Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Pilih Gudang Sumber terlebih dahulu!' });
    }

    if (trxFormData.type === 'MUTATION') {
      if (!trxFormData.toWarehouseId) {
        return Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Pilih Gudang Tujuan mutasi!' });
      }
      if (parseInt(trxFormData.warehouseId) === parseInt(trxFormData.toWarehouseId)) {
        return Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Gudang sumber dan gudang tujuan tidak boleh sama!' });
      }
    }

    if (!trxFormData.items || trxFormData.items.length === 0) {
      return Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Tambahkan minimal 1 barang!' });
    }

    for (let i = 0; i < trxFormData.items.length; i++) {
      const row = trxFormData.items[i];
      if (!row.itemId) {
        return Swal.fire({ icon: 'warning', title: 'Perhatian', text: `Barang pada baris #${i + 1} belum dipilih!` });
      }
      const qty = parseInt(row.quantity, 10);
      if (isNaN(qty) || qty <= 0) {
        return Swal.fire({ icon: 'warning', title: 'Perhatian', text: `Kuantitas pada baris #${i + 1} harus lebih dari 0!` });
      }

      if (trxFormData.type === 'OUT' || trxFormData.type === 'MUTATION') {
        const available = getItemStockInWarehouse(row.itemId, trxFormData.warehouseId);
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

    setIsSubmittingTrx(true);
    try {
      await api.post('/inventory/transactions', trxFormData);
      Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: `Transaksi ${trxFormData.type} untuk ${trxFormData.items.length} barang berhasil dicatat.`,
        timer: 2000,
        showConfirmButton: false
      });

      setIsTrxModalOpen(false);
      setTrxFormData({
        type: 'IN',
        warehouseId: '',
        toWarehouseId: '',
        date: new Date().toISOString().split('T')[0],
        note: '',
        items: [{ itemId: '', quantity: 1, note: '' }]
      });

      fetchAllData();
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Menyimpan Transaksi',
        text: error.response?.data?.error || 'Terjadi kesalahan saat memproses transaksi.'
      });
    } finally {
      setIsSubmittingTrx(false);
    }
  };

  const handleDeleteTransaction = async (id) => {
    const result = await Swal.fire({
      title: 'Hapus Transaksi?',
      text: 'Transaksi yang dihapus akan mengembalikan/menyesuaikan stok barang kembali.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`/inventory/transactions/${id}`);
        Swal.fire({ icon: 'success', title: 'Terhapus!', text: 'Transaksi berhasil dihapus dan stok disesuaikan.', timer: 1500, showConfirmButton: false });
        fetchAllData();
      } catch (error) {
        Swal.fire({ icon: 'error', title: 'Gagal Menghapus', text: error.response?.data?.error || 'Gagal menghapus transaksi.' });
      }
    }
  };

  // Handler Export Excel Transaksi
  const handleExportTransactions = () => {
    if (filteredTransactions.length === 0) {
      return Swal.fire({ icon: 'info', title: 'Data Kosong', text: 'Tidak ada data transaksi yang dapat diekspor pada filter ini.' });
    }

    const rows = filteredTransactions.map((tx, idx) => ({
      'No': idx + 1,
      'Kode Transaksi': tx.code,
      'Tanggal': new Date(tx.date).toLocaleDateString('id-ID'),
      'Tipe': tx.type,
      'Nama Barang': tx.item?.name || '-',
      'Kode Barang': tx.item?.code || '-',
      'Kategori': tx.item?.category?.name || '-',
      'Kuantitas': tx.quantity,
      'Satuan': tx.item?.unit || 'Pcs',
      'Gudang Asal / Sumber': tx.warehouse?.name || '-',
      'Gudang Tujuan (Mutasi)': tx.toWarehouse?.name || '-',
      'Keterangan / Catatan': tx.note || '-',
      'Dicatat Oleh': tx.createdBy?.name || tx.createdBy?.username || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 6 }, { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 30 }, 
      { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 22 }, 
      { wch: 22 }, { wch: 30 }, { wch: 18 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Riwayat Transaksi');
    const fileName = `Laporan_Transaksi_Logistik_${trxStartDate || 'all'}_sd_${trxEndDate || 'all'}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Handler Export PDF Transaksi Resmi
  const handleExportPDF = async () => {
    if (filteredTransactions.length === 0) {
      return Swal.fire({ icon: 'info', title: 'Data Kosong', text: 'Tidak ada riwayat transaksi untuk dicetak pada periode ini.' });
    }

    setIsExportingPdf(true);
    try {
      const jsPDF = await loadJsPDF();
      const doc = new jsPDF('landscape', 'mm', 'a4');
      const pageW = doc.internal.pageSize.getWidth();
      const now = new Date();

      let periodLabel = 'Semua Riwayat Data';
      if (trxStartDate && trxEndDate) {
        if (trxStartDate === trxEndDate) {
          periodLabel = `Tanggal: ${new Date(trxStartDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
        } else {
          periodLabel = `Periode: ${new Date(trxStartDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} s/d ${new Date(trxEndDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
        }
      } else if (trxDatePreset === 'THIS_WEEK') {
        periodLabel = 'Minggu Ini';
      } else if (trxDatePreset === 'LAST_7_DAYS') {
        periodLabel = '7 Hari Terakhir (Mingguan)';
      } else if (trxDatePreset === 'THIS_MONTH') {
        periodLabel = 'Bulan Ini';
      } else if (trxDatePreset === 'LAST_30_DAYS') {
        periodLabel = '30 Hari Terakhir';
      }

      const whName = trxWarehouseFilter
        ? (warehouses.find(w => w.id === parseInt(trxWarehouseFilter))?.name || 'Gudang Terpilih')
        : 'Semua Gudang Logistik';

      const typeName = trxTypeFilter
        ? (trxTypeFilter === 'IN' ? 'Barang Masuk (IN)' : trxTypeFilter === 'OUT' ? 'Barang Keluar (OUT)' : trxTypeFilter === 'MUTATION' ? 'Mutasi Antar Gudang' : 'Penyesuaian (ADJUSTMENT)')
        : 'Semua Tipe Transaksi';

      // 1. Institutional Header
      doc.setFillColor(30, 58, 138); // Blue 900
      doc.rect(0, 0, pageW, 24, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text('YAYASAN PONDOK PESANTREN ISLAM AL-MUKMIN NGKRUKI', 14, 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(224, 231, 255);
      doc.text('SISTEM MANAJEMEN ASET & LOGISTIK — DIVISI INVENTARIS & SARPRAS', 14, 17);

      doc.setFontSize(8);
      doc.setTextColor(199, 210, 254);
      const printStr = `Dicetak: ${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
      doc.text(printStr, pageW - 14, 17, { align: 'right' });

      // Title & Period Sub-bar
      let y = 32;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(30, 41, 59);
      doc.text('LAPORAN TRANSAKSI & MUTASI STOK GUDANG', 14, y);

      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Lokasi: ${whName}   |   Tipe: ${typeName}   |   ${periodLabel}`, 14, y);

      // 2. Summary KPI Box
      y += 5;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, y, pageW - 28, 14, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('RINGKASAN PERIODE:', 18, y + 5);

      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      const colW = (pageW - 28 - 8) / 4;
      doc.text(`Total Transaksi: ${trxMetrics.total}`, 18, y + 10);
      doc.setTextColor(22, 101, 52); // green
      doc.text(`Barang Masuk (IN): ${trxMetrics.inCount} trx (${trxMetrics.inQty} unit)`, 18 + colW, y + 10);
      doc.setTextColor(159, 18, 57); // rose
      doc.text(`Barang Keluar (OUT): ${trxMetrics.outCount} trx (${trxMetrics.outQty} unit)`, 18 + colW * 2, y + 10);
      doc.setTextColor(107, 33, 168); // purple
      doc.text(`Mutasi Antar Gudang: ${trxMetrics.mutCount} trx (${trxMetrics.mutQty} unit)`, 18 + colW * 3, y + 10);

      y += 18;

      // 3. Transactions Table
      const headers = [
        ['No', 'Tanggal', 'Kode TRX', 'Tipe', 'Nama Barang', 'Kategori', 'Qty', 'Satuan', 'Gudang Sumber', 'Gudang Tujuan', 'Catatan / Keterangan', 'Petugas']
      ];

      const body = filteredTransactions.map((tx, idx) => [
        idx + 1,
        new Date(tx.date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        tx.code || '-',
        tx.type === 'IN' ? 'MASUK (IN)' : tx.type === 'OUT' ? 'KELUAR (OUT)' : tx.type === 'MUTATION' ? 'MUTASI' : tx.type,
        tx.item?.name || '-',
        tx.item?.category?.name || '-',
        tx.quantity || 0,
        tx.item?.unit || 'Pcs',
        tx.warehouse?.name || '-',
        tx.type === 'MUTATION' ? (tx.toWarehouse?.name || '-') : '-',
        tx.note || '-',
        tx.createdBy?.name || tx.createdBy?.username || '-'
      ]);

      doc.autoTable({
        startY: y,
        head: headers,
        body: body,
        theme: 'striped',
        headStyles: {
          fillColor: [30, 58, 138],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7.5,
          halign: 'center'
        },
        bodyStyles: {
          fontSize: 7,
          textColor: [30, 41, 59]
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 18, halign: 'center' },
          2: { cellWidth: 22, fontStyle: 'bold' },
          3: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
          4: { cellWidth: 38 },
          5: { cellWidth: 22 },
          6: { cellWidth: 14, halign: 'right', fontStyle: 'bold' },
          7: { cellWidth: 12, halign: 'center' },
          8: { cellWidth: 25 },
          9: { cellWidth: 25 },
          10: { cellWidth: 'auto' },
          11: { cellWidth: 22 }
        },
        didParseCell: function(data) {
          if (data.section === 'body' && data.column.index === 3) {
            const val = data.cell.raw;
            if (val === 'MASUK (IN)') {
              data.cell.styles.textColor = [22, 101, 52];
            } else if (val === 'KELUAR (OUT)') {
              data.cell.styles.textColor = [159, 18, 57];
            } else if (val === 'MUTASI') {
              data.cell.styles.textColor = [107, 33, 168];
            }
          }
        },
        margin: { left: 14, right: 14 },
        styles: { overflow: 'linebreak' }
      });

      // 4. Signatures Block
      let finalY = doc.lastAutoTable?.finalY || y + 50;
      if (finalY + 40 > doc.internal.pageSize.getHeight()) {
        doc.addPage();
        finalY = 25;
      } else {
        finalY += 12;
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);

      const sigDate = `Sukoharjo, ${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
      doc.text(sigDate, pageW - 70, finalY);

      doc.text('Dibuat Oleh,', 25, finalY + 5);
      doc.text('Petugas Logistik / Gudang', 25, finalY + 9);

      doc.text('Mengetahui,', pageW - 70, finalY + 5);
      doc.text('Kepala Bagian Sarana & Prasarana', pageW - 70, finalY + 9);

      doc.setDrawColor(148, 163, 184);
      doc.line(25, finalY + 28, 75, finalY + 28);
      doc.line(pageW - 70, finalY + 28, pageW - 20, finalY + 28);

      doc.setFont('helvetica', 'bold');
      doc.text('( .................................................. )', 25, finalY + 32);
      doc.text('( .................................................. )', pageW - 70, finalY + 32);

      // Page numbers
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Halaman ${i} dari ${totalPages} — Dokumen Resmi Laporan Mutasi Stok Logistik Al-Mukmin`,
          pageW / 2,
          doc.internal.pageSize.getHeight() - 6,
          { align: 'center' }
        );
      }

      const fileName = `Laporan_Mutasi_Gudang_${trxStartDate || 'all'}_sd_${trxEndDate || 'all'}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      Swal.fire({ icon: 'error', title: 'Gagal Cetak PDF', text: 'Terjadi kesalahan saat memproses laporan PDF.' });
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Handler Template Import & Download
  const downloadExcelTemplate = () => {
    const wb = XLSX.utils.book_new();
    const sampleItem = items.length > 0 ? items[0].name : 'Kertas HVS A4 80gr';
    const sampleWh1 = warehouses.length > 0 ? warehouses[0].name : 'Gudang Utama';
    const sampleWh2 = warehouses.length > 1 ? warehouses[1].name : (warehouses.length > 0 ? warehouses[0].name : 'Gudang Cadangan');

    const headers = ['Tipe', 'Nama Barang', 'Kuantitas', 'Gudang Sumber', 'Gudang Tujuan', 'Catatan'];
    const sampleRows = [
      ['IN', sampleItem, 10, sampleWh1, '', 'Stok Awal / Pengadaan Barang'],
      ['OUT', sampleItem, 2, sampleWh1, '', 'Pemakaian Operasional Unit'],
      ['MUTATION', sampleItem, 5, sampleWh1, sampleWh2, 'Pindah lokasi antar gudang logistik']
    ];

    const wsTemplate = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    wsTemplate['!cols'] = [{ wch: 14 }, { wch: 35 }, { wch: 12 }, { wch: 25 }, { wch: 25 }, { wch: 35 }];
    XLSX.utils.book_append_sheet(wb, wsTemplate, 'Template Transaksi');

    // Sheet 2: Master Reference Data
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
      `IN,"${sampleItem.replace(/"/g, '""')}",10,"${sampleWh1.replace(/"/g, '""')}",,"Stok Awal / Pengadaan"`,
      `OUT,"${sampleItem.replace(/"/g, '""')}",2,"${sampleWh1.replace(/"/g, '""')}",,"Pemakaian Operasional"`,
      `MUTATION,"${sampleItem.replace(/"/g, '""')}",5,"${sampleWh1.replace(/"/g, '""')}","${sampleWh2.replace(/"/g, '""')}","Pindah Gudang"`
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
      fetchAllData();
    } catch (error) {
      alert(error.response?.data?.error || 'Terjadi kesalahan saat import data transaksi');
    } finally {
      setIsImporting(false);
    }
  };

  // Filtered Stock Items
  const filteredStockItems = useMemo(() => {
    return items.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(stockSearch.toLowerCase()) || 
                          item.code.toLowerCase().includes(stockSearch.toLowerCase()) ||
                          (item.category?.name || '').toLowerCase().includes(stockSearch.toLowerCase());
      
      if (!matchSearch) return false;
      if (!stockWarehouseFilter) return true;

      return (item.stocks || []).some(s => s.warehouseId === parseInt(stockWarehouseFilter) && s.quantity > 0);
    });
  }, [items, stockSearch, stockWarehouseFilter]);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (trxStartDate || trxEndDate) {
        const txDate = new Date(tx.date).toISOString().split('T')[0];
        if (trxStartDate && txDate < trxStartDate) return false;
        if (trxEndDate && txDate > trxEndDate) return false;
      }
      if (trxSearch) {
        const q = trxSearch.toLowerCase();
        const matchCode = (tx.code || '').toLowerCase().includes(q);
        const matchItem = (tx.item?.name || '').toLowerCase().includes(q);
        const matchNote = (tx.note || '').toLowerCase().includes(q);
        const matchUser = (tx.createdBy?.name || tx.createdBy?.username || '').toLowerCase().includes(q);
        if (!matchCode && !matchItem && !matchNote && !matchUser) return false;
      }
      return true;
    });
  }, [transactions, trxStartDate, trxEndDate, trxSearch]);

  // Ringkasan Metrik Transaksi Terfilter
  const trxMetrics = useMemo(() => {
    const list = filteredTransactions;
    const inList = list.filter(t => t.type === 'IN');
    const outList = list.filter(t => t.type === 'OUT');
    const mutList = list.filter(t => t.type === 'MUTATION');
    const adjList = list.filter(t => t.type === 'ADJUSTMENT');

    const inQty = inList.reduce((acc, t) => acc + (t.quantity || 0), 0);
    const outQty = outList.reduce((acc, t) => acc + (t.quantity || 0), 0);
    const mutQty = mutList.reduce((acc, t) => acc + (t.quantity || 0), 0);
    const adjQty = adjList.reduce((acc, t) => acc + (t.quantity || 0), 0);

    return {
      total: list.length,
      inCount: inList.length,
      inQty,
      outCount: outList.length,
      outQty,
      mutCount: mutList.length,
      mutQty,
      adjCount: adjList.length,
      adjQty
    };
  }, [filteredTransactions]);

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-slate-50 min-h-screen">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
              <Layers size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight">
                Stok & Transaksi Gudang Logistik
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Pusat monitoring posisi stok multi-gudang dan riwayat transaksi mutasi barang.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => {
              setImportResult(null);
              setImportFile(null);
              setIsImportModalOpen(true);
            }}
            className="flex-1 md:flex-none px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs"
            title="Import Transaksi via Excel/CSV"
          >
            <Upload size={14} className="text-emerald-600" />
            <span>Import Excel</span>
          </button>

          <button
            onClick={handleExportTransactions}
            className="flex-1 md:flex-none px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs"
            title="Ekspor Transaksi ke Excel"
          >
            <Download size={14} className="text-slate-500" />
            <span>Ekspor Excel</span>
          </button>

          <button
            onClick={() => setIsTrxModalOpen(true)}
            className="flex-1 md:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md shadow-blue-500/20"
          >
            <Plus size={15} />
            <span>+ Input Transaksi Baru</span>
          </button>
        </div>
      </div>

      {/* SUMMARY STATS BAR */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Katalog Barang</span>
            <div className="text-xl font-black text-slate-800 mt-1">{metrics.totalItems} <span className="text-xs font-semibold text-slate-500">Jenis</span></div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Box size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Stok Fisik</span>
            <div className="text-xl font-black text-indigo-600 mt-1">{(metrics.totalStockUnits).toLocaleString('id-ID')} <span className="text-xs font-semibold text-slate-500">Unit</span></div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Layers size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Peringatan Stok</span>
            <div className="text-xl font-black text-rose-600 mt-1">
              {metrics.lowStockCount + metrics.outOfStockCount} <span className="text-xs font-semibold text-slate-500">Item</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertTriangle size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Riwayat Transaksi</span>
            <div className="text-xl font-black text-emerald-600 mt-1">{metrics.totalTransactions} <span className="text-xs font-semibold text-slate-500">Mutasi</span></div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ArrowLeftRight size={20} />
          </div>
        </div>
      </div>

      {/* UNIFIED SUB-MENU TABS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 px-4 bg-slate-50/70">
          <button
            onClick={() => setActiveTab('stock')}
            className={`flex items-center gap-2 py-3.5 px-4 text-xs sm:text-sm font-extrabold border-b-2 transition-all cursor-pointer ${
              activeTab === 'stock'
                ? 'border-blue-600 text-blue-600 bg-white shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
            }`}
          >
            <Box size={16} />
            <span>Posisi Stok per Gudang</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${activeTab === 'stock' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-600'}`}>
              {items.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex items-center gap-2 py-3.5 px-4 text-xs sm:text-sm font-extrabold border-b-2 transition-all cursor-pointer ${
              activeTab === 'transactions'
                ? 'border-blue-600 text-blue-600 bg-white shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
            }`}
          >
            <ArrowLeftRight size={16} />
            <span>Riwayat Transaksi & Mutasi</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${activeTab === 'transactions' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-600'}`}>
              {transactions.length}
            </span>
          </button>
        </div>

        {/* ========================================================= */}
        {/* TAB 1: POSISI STOK PER GUDANG */}
        {/* ========================================================= */}
        {activeTab === 'stock' && (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Cari nama, kode, atau kategori barang..."
                  className="pl-9 pr-4 py-2 w-full border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={stockWarehouseFilter}
                  onChange={(e) => setStockWarehouseFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 shadow-2xs"
                >
                  <option value="">-- Semua Lokasi Gudang ({warehouses.length}) --</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>

                <button
                  onClick={fetchAllData}
                  className="p-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
                  title="Muat Ulang Data"
                >
                  <RefreshCw size={15} className={loading ? 'animate-spin text-blue-600' : ''} />
                </button>
              </div>
            </div>

            {/* Table of Stocks */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-600 font-extrabold uppercase tracking-wider border-b border-slate-200">
                    <th className="p-3.5 w-12 text-center">#</th>
                    <th className="p-3.5">Kode & Nama Barang</th>
                    <th className="p-3.5">Kategori</th>
                    <th className="p-3.5 text-center">Satuan</th>
                    <th className="p-3.5 text-center">Min. Stok</th>
                    <th className="p-3.5 text-center">Total Stok</th>
                    <th className="p-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
                        Memuat data stok barang...
                      </td>
                    </tr>
                  ) : filteredStockItems.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-slate-400">
                        Tidak ada data stok barang yang cocok dengan pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredStockItems.map((item, idx) => {
                      const isExpanded = expandedItemId === item.id;
                      const currentStock = item.totalStock || 0;
                      const minStock = item.minStock || 5;
                      const isOut = currentStock === 0;
                      const isLow = currentStock > 0 && currentStock <= minStock;

                      return (
                        <React.Fragment key={item.id}>
                          <tr 
                            className={`hover:bg-blue-50/40 cursor-pointer transition-colors ${isOut ? 'bg-rose-50/20' : (isLow ? 'bg-amber-50/20' : '')}`}
                            onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                          >
                            <td className="p-3.5 text-center text-slate-400 font-bold">{idx + 1}</td>
                            <td className="p-3.5">
                              <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                                <span>{item.name}</span>
                                {isExpanded ? <ChevronUp size={14} className="text-blue-600" /> : <ChevronDown size={14} className="text-slate-400" />}
                              </div>
                              <div className="font-mono text-[11px] text-slate-500">{item.code}</div>
                            </td>
                            <td className="p-3.5 text-slate-600 font-medium">{item.category?.name || '-'}</td>
                            <td className="p-3.5 text-center text-slate-600 font-semibold">{item.unit}</td>
                            <td className="p-3.5 text-center font-mono font-bold text-slate-500">{minStock}</td>
                            <td className="p-3.5 text-center">
                              <span className="font-extrabold text-sm text-slate-800 font-mono">
                                {currentStock}
                              </span>
                            </td>
                            <td className="p-3.5 text-center">
                              {isOut ? (
                                <span className="bg-rose-100 text-rose-800 border border-rose-200 px-2.5 py-1 rounded-full font-bold text-[10px]">
                                  Habis
                                </span>
                              ) : isLow ? (
                                <span className="bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full font-bold text-[10px]">
                                  Menipis
                                </span>
                              ) : (
                                <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full font-bold text-[10px]">
                                  Aman
                                </span>
                              )}
                            </td>
                          </tr>

                          {/* Expanded Breakdown per Warehouse */}
                          {isExpanded && (
                            <tr className="bg-slate-50/80 border-b border-slate-200">
                              <td colSpan="7" className="p-4 pl-12">
                                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600 mb-3 border-b pb-2 flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                      <Warehouse size={15} className="text-blue-600" />
                                      Rincian Stok Barang per Lokasi Gudang ({item.name})
                                    </span>
                                    <span className="text-[11px] font-normal text-slate-400">Total: {currentStock} {item.unit}</span>
                                  </h4>

                                  {item.stocks && item.stocks.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                      {item.stocks.map((stock) => (
                                        <div key={stock.id} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                          <div>
                                            <div className="font-bold text-xs text-slate-800">{stock.warehouse?.name}</div>
                                            <div className="text-[11px] text-slate-500">
                                              Lokasi/Rak: <span className="font-mono font-medium">{stock.location || '-'}</span>
                                            </div>
                                          </div>
                                          <div className="text-sm font-extrabold text-blue-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs font-mono">
                                            {stock.quantity} <span className="text-[10px] font-normal text-slate-500">{item.unit}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-slate-400 italic">Belum ada stok yang dialokasikan di gudang manapun.</p>
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
        )}

        {/* ========================================================= */}
        {/* TAB 2: RIWAYAT TRANSAKSI & MUTASI */}
        {/* ========================================================= */}
        {activeTab === 'transactions' && (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Filter & Reporting Toolbar */}
            <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                {/* Search & Selectors */}
                <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={15} />
                    <input
                      type="text"
                      placeholder="Cari kode TRX, barang, catatan..."
                      className="pl-8 pr-3 py-2 w-full border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none shadow-2xs"
                      value={trxSearch}
                      onChange={(e) => setTrxSearch(e.target.value)}
                    />
                  </div>

                  <select
                    value={trxTypeFilter}
                    onChange={(e) => setTrxTypeFilter(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                  >
                    <option value="">-- Semua Tipe Mutasi --</option>
                    <option value="IN">Barang Masuk (IN)</option>
                    <option value="OUT">Barang Keluar (OUT)</option>
                    <option value="MUTATION">Mutasi Antar Gudang</option>
                    <option value="ADJUSTMENT">Penyesuaian (ADJUSTMENT)</option>
                  </select>

                  <select
                    value={trxWarehouseFilter}
                    onChange={(e) => setTrxWarehouseFilter(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                  >
                    <option value="">-- Semua Gudang ({warehouses.length}) --</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                {/* Report Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleExportPDF}
                    disabled={isExportingPdf || filteredTransactions.length === 0}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm shadow-rose-500/20 cursor-pointer disabled:cursor-not-allowed"
                    title="Cetak Laporan Resmi Transaksi & Mutasi ke PDF"
                  >
                    {isExportingPdf ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
                    <span>Cetak PDF</span>
                  </button>

                  <button
                    onClick={handleExportTransactions}
                    disabled={filteredTransactions.length === 0}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-500/20 cursor-pointer disabled:cursor-not-allowed"
                    title="Ekspor Data Terfilter ke Excel"
                  >
                    <Download size={14} />
                    <span>Ekspor Excel</span>
                  </button>
                </div>
              </div>

              {/* Date Presets and Custom Range */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/70 text-xs">
                <span className="font-bold text-slate-500 flex items-center gap-1.5 shrink-0">
                  <Calendar size={13} className="text-blue-600" />
                  Periode Laporan:
                </span>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'ALL', label: 'Semua Riwayat' },
                    { id: 'TODAY', label: 'Hari Ini' },
                    { id: 'LAST_7_DAYS', label: '7 Hari Terakhir (Mingguan)' },
                    { id: 'THIS_WEEK', label: 'Minggu Ini' },
                    { id: 'THIS_MONTH', label: 'Bulan Ini' },
                    { id: 'LAST_30_DAYS', label: '30 Hari Terakhir' },
                    { id: 'CUSTOM', label: 'Kustom Tanggal' },
                  ].map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleTrxPresetChange(p.id)}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                        trxDatePreset === p.id
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {showTrxCustom && (
                  <div className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded-xl border border-blue-200 shadow-2xs ml-auto">
                    <span className="text-[11px] text-slate-400 font-medium">Dari:</span>
                    <input
                      type="date"
                      value={trxCustomStart}
                      onChange={(e) => setTrxCustomStart(e.target.value)}
                      className="px-2 py-1 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500"
                    />
                    <span className="text-[11px] text-slate-400 font-medium">S/D:</span>
                    <input
                      type="date"
                      value={trxCustomEnd}
                      onChange={(e) => setTrxCustomEnd(e.target.value)}
                      className="px-2 py-1 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleApplyTrxCustomDate}
                      className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition"
                    >
                      Terapkan
                    </button>
                  </div>
                )}
              </div>

              {/* Active Filter Info & Status */}
              {(trxStartDate || trxEndDate || trxWarehouseFilter || trxTypeFilter) && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/50 text-[11px] text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                      Filter Aktif: {trxStartDate ? new Date(trxStartDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Awal'} s/d {trxEndDate ? new Date(trxEndDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sekarang'}
                    </span>
                    {trxWarehouseFilter && (
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium border border-slate-200">
                        Gudang: {warehouses.find(w => w.id === parseInt(trxWarehouseFilter))?.name || trxWarehouseFilter}
                      </span>
                    )}
                    {trxTypeFilter && (
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium border border-slate-200">
                        Tipe: {trxTypeFilter}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      handleTrxPresetChange('ALL');
                      setTrxWarehouseFilter('');
                      setTrxTypeFilter('');
                      setTrxSearch('');
                    }}
                    className="text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
                  >
                    Reset Semua Filter
                  </button>
                </div>
              )}
            </div>

            {/* Quick Summary Highlights for filtered transactions */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Mutasi</span>
                <div className="text-base font-black text-slate-800 mt-0.5">{trxMetrics.total} <span className="text-[11px] font-semibold text-slate-400">Transaksi</span></div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/20 shadow-2xs">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Barang Masuk (IN)</span>
                <div className="text-base font-black text-emerald-700 mt-0.5">{trxMetrics.inQty} <span className="text-[11px] font-semibold text-emerald-600/70">unit ({trxMetrics.inCount} trx)</span></div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-rose-100 bg-rose-50/20 shadow-2xs">
                <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Barang Keluar (OUT)</span>
                <div className="text-base font-black text-rose-700 mt-0.5">{trxMetrics.outQty} <span className="text-[11px] font-semibold text-rose-600/70">unit ({trxMetrics.outCount} trx)</span></div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-purple-100 bg-purple-50/20 shadow-2xs">
                <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Mutasi Antar Gudang</span>
                <div className="text-base font-black text-purple-700 mt-0.5">{trxMetrics.mutQty} <span className="text-[11px] font-semibold text-purple-600/70">unit ({trxMetrics.mutCount} trx)</span></div>
              </div>
            </div>

            {/* Table of Transactions */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-600 font-extrabold uppercase tracking-wider border-b border-slate-200">
                    <th className="p-3">Tanggal & Kode TRX</th>
                    <th className="p-3">Tipe</th>
                    <th className="p-3">Barang & Kategori</th>
                    <th className="p-3">Lokasi Gudang</th>
                    <th className="p-3 text-center">Jumlah</th>
                    <th className="p-3">Keterangan</th>
                    <th className="p-3">Petugas</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
                        Memuat riwayat transaksi...
                      </td>
                    </tr>
                  ) : filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-slate-400">
                        Tidak ada riwayat transaksi yang cocok dengan filter.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3">
                          <div className="font-mono font-bold text-slate-800 text-[11px]">{tx.code}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {new Date(tx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </td>
                        <td className="p-3">
                          {tx.type === 'IN' ? (
                            <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-extrabold text-[10px]">
                              MASUK (IN)
                            </span>
                          ) : tx.type === 'OUT' ? (
                            <span className="bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-md font-extrabold text-[10px]">
                              KELUAR (OUT)
                            </span>
                          ) : tx.type === 'MUTATION' ? (
                            <span className="bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-md font-extrabold text-[10px]">
                              MUTASI
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded-md font-extrabold text-[10px]">
                              {tx.type}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-800">{tx.item?.name || '-'}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{tx.item?.code} • {tx.item?.category?.name || '-'}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-medium text-slate-700">
                            {tx.type === 'MUTATION' ? (
                              <div className="flex items-center gap-1">
                                <span>{tx.warehouse?.name}</span>
                                <span className="text-slate-400">➔</span>
                                <span className="font-bold text-blue-700">{tx.toWarehouse?.name || '-'}</span>
                              </div>
                            ) : (
                              <span>{tx.warehouse?.name || '-'}</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-mono font-extrabold text-slate-800 text-sm">
                            {tx.quantity}
                          </span>
                          <span className="text-[10px] text-slate-500 ml-1 font-medium">{tx.item?.unit || 'Pcs'}</span>
                        </td>
                        <td className="p-3 text-slate-600 max-w-[200px] truncate" title={tx.note}>
                          {tx.note || '-'}
                        </td>
                        <td className="p-3 text-slate-600 text-[11px]">
                          {tx.createdBy?.name || tx.createdBy?.username || '-'}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleDeleteTransaction(tx.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Hapus riwayat transaksi ini"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: MANUAL MULTI-ITEM TRANSACTION INPUT */}
      {/* ========================================================= */}
      {isTrxModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto">
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                  <Plus size={18} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">Catat Transaksi Stok Barang</h3>
                  <p className="text-xs text-slate-500">Pencatatan mutasi barang masuk, keluar, atau pindah gudang</p>
                </div>
              </div>
              <button 
                onClick={() => setIsTrxModalOpen(false)} 
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/60 transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateTransaction} className="p-4 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Row 1: Tipe, Tanggal, Gudang */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tipe Transaksi</label>
                  <select
                    className="w-full px-3 py-2 border rounded-xl text-xs font-bold outline-none focus:border-blue-500 bg-white"
                    value={trxFormData.type}
                    onChange={(e) => setTrxFormData({ ...trxFormData, type: e.target.value })}
                  >
                    <option value="IN">🟢 Barang Masuk (IN)</option>
                    <option value="OUT">🔴 Barang Keluar (OUT)</option>
                    <option value="MUTATION">🔄 Mutasi Antar Gudang</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Transaksi</label>
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:border-blue-500 bg-white font-medium"
                    value={trxFormData.date}
                    onChange={(e) => setTrxFormData({ ...trxFormData, date: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {trxFormData.type === 'MUTATION' ? 'Gudang Sumber (Asal)' : 'Gudang Penyimpanan'}
                  </label>
                  <select
                    required
                    className="w-full px-3 py-2 border rounded-xl text-xs font-bold outline-none focus:border-blue-500 bg-white"
                    value={trxFormData.warehouseId}
                    onChange={(e) => setTrxFormData({ ...trxFormData, warehouseId: e.target.value })}
                  >
                    <option value="">-- Pilih Gudang --</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Gudang Tujuan (jika MUTATION) */}
              {trxFormData.type === 'MUTATION' && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                  <label className="block text-xs font-bold text-purple-900 mb-1">Gudang Tujuan Mutasi</label>
                  <select
                    required
                    className="w-full px-3 py-2 border border-purple-300 rounded-lg text-xs font-bold outline-none focus:border-purple-500 bg-white"
                    value={trxFormData.toWarehouseId}
                    onChange={(e) => setTrxFormData({ ...trxFormData, toWarehouseId: e.target.value })}
                  >
                    <option value="">-- Pilih Gudang Tujuan --</option>
                    {warehouses.filter(w => w.id !== parseInt(trxFormData.warehouseId)).map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Daftar Barang Dinamis */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Daftar Barang yang Ditransaksikan ({trxFormData.items.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs"
                  >
                    <Plus size={13} /> Tambah Barang Lain
                  </button>
                </div>

                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {trxFormData.items.map((row, idx) => {
                    const currentWhStock = trxFormData.warehouseId && row.itemId
                      ? getItemStockInWarehouse(row.itemId, trxFormData.warehouseId)
                      : null;
                    const isExceedStock = (trxFormData.type === 'OUT' || trxFormData.type === 'MUTATION') && currentWhStock !== null && row.quantity > currentWhStock;

                    return (
                      <div key={idx} className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-400 font-mono">Baris #{idx + 1}</span>
                          {trxFormData.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(idx)}
                              className="text-slate-400 hover:text-red-600 transition-colors p-0.5"
                              title="Hapus baris ini"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                          <div className="sm:col-span-7">
                            <select
                              required
                              className="w-full px-2.5 py-1.5 border rounded-lg text-xs font-medium outline-none focus:border-blue-500 bg-slate-50/70"
                              value={row.itemId}
                              onChange={(e) => handleItemChange(idx, 'itemId', e.target.value)}
                            >
                              <option value="">-- Pilih Barang --</option>
                              {items.map(it => (
                                <option key={it.id} value={it.id}>
                                  {it.name} ({it.code}) - {it.category?.name || 'Umum'} [{it.unit}]
                                </option>
                              ))}
                            </select>
                            {currentWhStock !== null && (
                              <div className={`text-[10px] mt-1 font-bold ${isExceedStock ? 'text-rose-600' : 'text-slate-500'}`}>
                                Stok saat ini: <b>{currentWhStock} unit</b> {isExceedStock && '(Kuantitas melebihi stok!)'}
                              </div>
                            )}
                          </div>

                          <div className="sm:col-span-2">
                            <input
                              type="number"
                              min="1"
                              required
                              placeholder="Qty"
                              className={`w-full px-2 py-1.5 border rounded-lg text-xs text-center font-bold outline-none ${isExceedStock ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-slate-300'}`}
                              value={row.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                            />
                          </div>

                          <div className="sm:col-span-3">
                            <input
                              type="text"
                              placeholder="Ket. barang (opsional)"
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500"
                              value={row.note || ''}
                              onChange={(e) => handleItemChange(idx, 'note', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Catatan Umum */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Catatan / Keterangan Transaksi</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:border-blue-500"
                  rows={2}
                  placeholder="Contoh: Pengadaan triwulan 1 dari toko ATK, atau pemakaian logistik kantor..."
                  value={trxFormData.note}
                  onChange={(e) => setTrxFormData({ ...trxFormData, note: e.target.value })}
                ></textarea>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTrxModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTrx}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 disabled:opacity-50 transition"
                >
                  {isSubmittingTrx ? 'Menyimpan...' : 'Simpan Transaksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: BATCH IMPORT EXCEL / CSV */}
      {/* ========================================================= */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b bg-slate-50 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <Upload size={20} />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-800">Import Transaksi Stok</h2>
                  <p className="text-xs text-slate-500">Upload file Excel atau CSV untuk transaksi Masuk, Keluar, atau Mutasi</p>
                </div>
              </div>
              <button 
                onClick={() => setIsImportModalOpen(false)} 
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-4">
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
                      className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-emerald-700 shadow-2xs transition-colors text-xs"
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
